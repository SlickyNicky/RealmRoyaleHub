const mysql = require('mysql2/promise');
let dayjs = require('dayjs')
let utc = require('dayjs/plugin/utc');
const md5 = require("md5");
dayjs.extend(utc);

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
var AsyncLock = require('async-lock');
var lock = new AsyncLock({maxPending: Number.MAX_SAFE_INTEGER}, {maxOccupationTime: 1000});

const {ordinal} = require('openskill')

const bluebird = require('bluebird');


const path = require("path");
const dotenv = require('dotenv').config({
    path: path.join(__dirname, '.env')
});


let config = {
    host: 'localhost',
    user: process.env.mysqlUser,
    password: process.env.mysqlPassword,
    database: 'realm_royale',
    charset: 'UTF8MB4_0900_AI_CI',
    Promise: bluebird,
    connectionLimit: 50,
}
var pool = mysql.createPool(config);

const devId = process.env.devId
const baseApi = process.env.baseApi
const authKey = process.env.authKey

const winston = require('winston');

const logger = winston.createLogger({
    maxsize: '10000000',
    maxFiles: '1000',
    timestamp: true,
    level: 'info',
    format: winston.format.json(),
    defaultMeta: {service: 'databaseInfoCollection'},
    transports: [
        new winston.transports.File({filename: __dirname + '/combined.json'})
    ],
});

const {performance} = require('perf_hooks');

require('events').EventEmitter.defaultMaxListeners = Infinity;
const https = require('https');
const opts = {
    agent: new https.Agent({
        keepAlive: true
    })
};

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

class DatabaseHandler {
    constructor() {

    }

    seconds_since_epoch() {
        return Math.floor(Date.now() / 1000)
    }


    getTimeStamp() {
        return dayjs.utc().format('YYYYMMDDHHmmss');
    }

    is2dArray(array) {
        if (array[0] === undefined) {
            return false;
        } else {
            return (array[0].constructor === Array);
        }
    }

    async mmrQueueIDExists(queueID) {
        return new Promise(async (resolve, reject) => {
            let query = `select * from MMRQueueIDsEntered where queueID = '${queueID}'`
            await pool.query(query)
                .then(async ([results]) => {
                        if (results.length === 0) {
                            return resolve("")
                        } else {
                            return resolve("EXISTS")
                        }
                    }
                );
        });

    }

    async mmrAddQueueID(queueID) {
        return new Promise(async (resolve, reject) => {
            let query = `INSERT INTO MMRQueueIDsEntered VALUES ('${queueID}')`;

            await pool.query(query);
            return resolve("");
        })
    }


    async tourneyExists(hashedName) {
        return new Promise(async (resolve, reject) => {
            let query = `select * from realmTourneys where hashedTourneyName = '${hashedName}'`

            await pool.query(query)
                .then(async ([results]) => {
                        if (results.length === 0) {
                            return resolve("")
                        } else {
                            return resolve("EXISTS")
                        }
                    }
                );

        });
    }

    async getTourneyInfo(tourneyName, dupTourneyNum) {
        return new Promise(async (resolve, reject) => {
            let query =
                `
                    select * from realmTourneys where
                    sameTourneyNumber = '${dupTourneyNum}' and
                    tourneyName = '${tourneyName}'
                    `

            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results)
                    }
                );

        });
    }

    async createTourney(hashedName, tourneyName, amountOfGames, bestOfGames, queueType, pointsPerKill, pointsPerPlacement, tourneyNumber, negativePoints) {
        let negPointsTemp;
        if (negativePoints === true) {
            negPointsTemp = 1
        } else {
            negPointsTemp = 0
        }
        return new Promise(async (resolve, reject) => {
            let query = `INSERT INTO realmTourneys VALUES ('${hashedName}','${tourneyName}','${amountOfGames}','${bestOfGames}','${queueType}','${pointsPerKill}','${pointsPerPlacement}','${tourneyNumber}','${negPointsTemp}')`;

            await pool.query(query).then(async (err, res) => {

            });

            return resolve("");
        })
    }

    async tourneyHashChecker(tourneyName, tourneyGameDupNumber, hashedName) {
        return new Promise(async (resolve, reject) => {
            let query = `
                        select * from realmTourneys 
                        where
                         hashedTourneyName = '${hashedName}'
                         and sameTourneyNumber = '${tourneyGameDupNumber}'
                        and tourneyName = '${tourneyName}'
                        `

            await pool.query(query)
                .then(async ([results]) => {
                        if (results.length === 0) {
                            return resolve("")
                        } else {
                            return resolve("CORRECT HASH AND NAME")
                        }
                    }
                );

        });
    }

    async tourneyNameChecker(passedTourneyName) {
        return new Promise(async (resolve, reject) => {
            let query = `select COUNT(*) AS namesCount from realmTourneys where tourneyName = '${passedTourneyName}'`

            await pool.query(query)
                .then(async ([results]) => {
                        if (results === undefined) {
                            return resolve(0)
                        } else if (results.length === 0) {
                            return resolve(0)
                        } else {
                            return resolve(parseInt(results[0].namesCount))
                        }
                    }
                );

        });
    }


    async updatePenaltyPoints(hashedTourneyName, tourneyName, sameTourneyNumber, teamNameAndID, totalPenalty) {
        return new Promise(async (resolve, reject) => {

            let query = `
                         Select * from realmTourneyGamePenalties where
                          hashedTourneyName = '${hashedTourneyName}'
                          and tourneyName = '${tourneyName}'
                          and sameTourneyNumber = '${sameTourneyNumber}'
                          and teamNameAndID = '${teamNameAndID}'
                          and totalPenalty = '${totalPenalty}'
                        `;

            await pool.query(
                query, function (error, results) {
                    console.log(results)
                    console.log(error)
                }
            );


            return resolve("");
        })
    }


    async getTourneyGameTotalInfo(tourneyName, sameTourneyNumber, hashedTourneyName) {
        return new Promise(async (resolve, reject) => {
            let query =
                `
                    select * from realmTourneyGames where
                    tourneyName = '${tourneyName}' and
                    sameTourneyNumber = '${sameTourneyNumber}'
                    order by gameNumber asc
                    `

            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results)
                    }
                );

        });
    }

    async addGameToTourney(hashedName, tourneyName, sameTourneyNumber, gameNumber, queueId) {
        return new Promise(async (resolve, reject) => {
            let query = `
                        select COUNT(*) AS namesCount from realmTourneyGames where
                         hashedTourneyName = '${hashedName}' and 
                         tourneyName = '${tourneyName}' and 
                         sameTourneyNumber = '${sameTourneyNumber}' and 
                         gameNumber = '${gameNumber}' 

            `

            await pool.query(query)
                .then(async ([results]) => {


                        if (results === undefined) {
                            return resolve(0)
                        } else {
                            if (parseInt(results[0].namesCount) > 0) {
                                let query = `
                                        DELETE From realmTourneyGames
                                         Where
                                         hashedTourneyName = '${hashedName}' and
                                         tourneyName = '${tourneyName}' and
                                         sameTourneyNumber = '${sameTourneyNumber}' and
                                         gameNumber = '${gameNumber}'
                                        `;
                                await pool.query(query)
                                    .then(async ([results]) => {
                                            let query = `INSERT INTO realmTourneyGames VALUES ('${hashedName}','${tourneyName}','${sameTourneyNumber}','${gameNumber}','${queueId}')`;
                                            await pool.query(query)
                                        }
                                    )
                            } else {
                                let query = `INSERT INTO realmTourneyGames VALUES ('${hashedName}','${tourneyName}','${sameTourneyNumber}','${gameNumber}','${queueId}')`;
                                await pool.query(query);
                            }
                        }
                    }
                );


            return resolve("");
        })
    }

    async deleteGameFromTourney(hashedName, tourneyName, sameTourneyNumber, gameNumber) {
        return new Promise(async (resolve, reject) => {
            let query = `
                        DELETE From realmTourneyGames
                         Where
                         hashedTourneyName = '${hashedName}' and
                         tourneyName = '${tourneyName}' and
                         sameTourneyNumber = '${sameTourneyNumber}' and
                         gameNumber = '${gameNumber}'
                        `;
            let connection = await mysql.createConnection(config);

            await connection.query(query);
            connection.end();
            return resolve("");
        })
    }

    async getUsableApiKey() {
        return new Promise(async (resolve, reject) => {
            logger.error(`Waiting on lock for getUsableApiKey function`)
            let newQuery =
                `
                    select * from ApiGrabbingStats
                    where session_message_count < 497 and
                    timeSinceEpoch > ${this.seconds_since_epoch()-899} and
                    session_id != ""
                    order by timeSinceEpoch asc
                    limit 1
                `
            lock.acquire(
                "getUsableApiKey",
                async () => {
                    logger.error(`Using lock for getUsableApiKey function`)
                    return new Promise(async (resolve, reject) => {
                        let startTime = performance.now()
                        await pool.query(newQuery)
                            .then(async ([results]) => {
                                logger.error(`getUsableApiKey:::results::${JSON.stringify(results)}`)
                                logger.error(`getUsableApiKey:::results::length:${results.length}`)
                                if (results.length === 0) {
                                    let methodSignature = md5(`${devId}createsession${authKey}${dayjs.utc().format('YYYYMMDDHHmmss')}`)
                                    let normalBaseUrl = `${baseApi}/createsessionjson/${devId}/${methodSignature}/${dayjs.utc().format('YYYYMMDDHHmmss')}`
                                    const message = (await (await
                                            fetch(normalBaseUrl, opts)
                                    ).json())
                                    logger.error(`getUsableApiKey:::creating::${JSON.stringify(message)}`)
                                    if (message['ret_msg'] === 'Maximum number of active sessions reached.') {
                                        reject(message['ret_msg'])
                                    } else {
                                        let sessionId = message['session_id']
                                        let query = `INSERT INTO ApiGrabbingStats VALUES ('${sessionId}',0,'${dayjs.utc().format('YYYYMMDDHHmmss')}',${this.seconds_since_epoch()})`;
                                        await pool.query(query);
                                        let endTime = performance.now()
                                        logger.error(`Time taken to execute function: getUsableApiKey:::${endTime - startTime}`)
                                        await this.updateApiReqCount(sessionId)
                                        resolve(sessionId);
                                    }
                                } else {
                                    logger.error(`getUsableApiKey:::exists::${results[0]['session_id']}`)
                                    let endTime = performance.now()
                                    logger.error(`Time taken to execute function: getUsableApiKey:::${endTime - startTime}`)
                                    await this.updateApiReqCount(results[0]['session_id'])
                                    resolve(results[0]['session_id']);
                                }
                            })
                    })
                }).then(async result => {
                resolve(result)
            })
        })
    }


    async callApi(endPoint, normalParams = true, apiBeingUsed = '', ...params) {
        return new Promise(async (resolve, reject) => {
            logger.error(`Entering function: callApi function: with -${apiBeingUsed}|`)

            endPoint = endPoint.toLowerCase();
            let endOfUrl = String(params.join("/"))
            if (endOfUrl.length > 0) {
                endOfUrl = "/" + endOfUrl
            }
            this.getUsableApiKey()
                .then(async (sessionId) => {
                    let startTime = performance.now()
                    let methodSignature = md5(`${devId}${endPoint}${authKey}${dayjs.utc().format('YYYYMMDDHHmmss')}`)
                        let normalBaseUrl = `${baseApi}/${endPoint}json/${devId}/${methodSignature}/${sessionId}/${dayjs.utc().format('YYYYMMDDHHmmss')}${endOfUrl}`
                        try {

                            let finalResult = await (await
                                    fetch(normalBaseUrl, opts)
                            ).json()
                            let endTime = performance.now()
                            logger.error(`Time taken to execute function: callApi with params-${endTime - startTime}--|${sessionId}:::${endPoint}::${params}|`)
                            resolve(finalResult)

                        } catch (error) {

                            logger.error(`Something went wrong with query:::${sessionId}::${endPoint}:${params}|ERROR:${error}`)
                            let endTime = performance.now()
                            logger.error(`Time taken to execute function: callApi with params-${endTime - startTime}--|${sessionId}:::${endPoint}::${params}|`)
                            resolve(`${sessionId}:::${endPoint}::${params}`)

                        }
                    }
                )
            // })
        })

    }

    async updateApiReqCount(apiKey, amount = 1) {
        return new Promise(async (resolve, reject) => {
            let query = `update ApiGrabbingStats set session_message_count = session_message_count + '${amount}' where session_id = '${apiKey}'`

            await pool.query(query)
                .then(async ([results]) => {
                    return resolve(`updated '${apiKey}' with '${amount}' new messages`)
                })

        })
    }

    async mmrPlayerGetStats(playerID) {
        return new Promise(async (resolve, reject) => {
            let query = `
                select playerID,queueTypeID,mmrRankingNumber from MMRPlayerStorage where playerID = '${playerID}' order by convert(queueTypeID,decimal) asc
            `

            await pool.query(query)
                .then(async ([results]) => {
                        if (results.length === 0) {
                            return resolve("")
                        } else {
                            return resolve(results)
                        }
                    }
                );

        });
    }

    async mmrPlayerLookup(playerID, queueTypeID) {
        return new Promise(async (resolve, reject) => {
            let query = `select * from MMRPlayerStorage where playerID = '${playerID}' and queueTypeID = '${queueTypeID}'`

            await pool.query(query)
                .then(async ([results]) => {
                        if (results.length === 0) {
                            return resolve("")
                        } else {
                            return resolve(results[0])
                        }
                    }
                );

        });
    }

    async mmrGetGameAmount(playerID, queueId) {
        return new Promise(async (resolve, reject) => {
            let query = `select gamesPlayed from MMRPlayerStorage where playerID = '${playerID}' and queueTypeID = '${queueId}'`

            await pool.query(query)
                .then(async ([results]) => {
                        if (results.length === 0) {
                            return resolve(-1)
                        } else {
                            return resolve(results[0])
                        }
                    }
                );

        });
    }

    async mmrUpdateMMRPlayer(playerID, queueTypeID, mu, sigma, updateCount = true) {
        return new Promise(async (resolve, reject) => {

            let gameCount = (await this.mmrGetGameAmount(playerID, queueTypeID))['gamesPlayed']
            if (gameCount === undefined) {
                gameCount = 0
            }
            if (updateCount === false) {
                gameCount -= 1
            }
            let query = `REPLACE INTO MMRPlayerStorage VALUES ('${playerID}','${queueTypeID}','${mu}','${sigma}','${ordinal({ mu: mu, sigma: sigma})}','${gameCount+1}')`;

            await pool.query(query);

            return resolve("");
        })
    }

    async mmrUpdateMMRPlayerChanges(playerID, queueID, queueIDNumber, sigmaChange, muChange, newSigma, newMu) {
        return new Promise(async (resolve, reject) => {
            let query = `
                            INSERT IGNORE INTO MMRGamePointTracking VALUES (
                            '${playerID}',
                            '${queueID}',
                            '${queueIDNumber}',
                            '${sigmaChange}',
                            '${muChange}',
                            '${ordinal({ mu: muChange, sigma: sigmaChange})}',
                            '${newSigma}',
                            '${newMu}',
                            '${ordinal({ mu: newMu, sigma: newSigma})}',
                            '${this.seconds_since_epoch()}'
                            )
                        `;

            return resolve(
                await pool.query(query)
                    .then(async (err, results) => {
                        return resolve(err[0]['affectedRows'])
                    })
            )
            return resolve("");
        })
    }

    async mmrGetTopPlayers() {
        return new Promise(async (resolve, reject) => {
            let query = `select playerID,queueTypeID,mu from MMRPlayerStorage order by mu desc limit 3`

            await pool.query(query)
                .then(async ([results]) => {
                        if (results.length === 0) {
                            return resolve(-1)
                        } else {
                            return resolve(results)
                        }
                    }
                );

        });
    }

    async mmrGetTopPlayersTemp() {
        return new Promise(async (resolve, reject) => {
            // sad inner select query's engage
            let query = `
                        SELECT *
                        FROM (
                        SELECT *, ROW_NUMBER() OVER (PARTITION BY convert(queueTypeID,decimal) ORDER BY mmrRankingNumber DESC) AS placement
                        FROM MMRPlayerStorage
                        ) AS x
                        WHERE placement <= 3
                        order by convert(queueTypeID,decimal) asc,placement asc;
            `

            await pool.query(query)
                .then(async ([results]) => {
                        if (results.length === 0) {
                            // if this happens scream and shout or start filling up your database
                            return resolve(-1)
                        } else {
                            return resolve(results)
                        }
                    }
                );

        });
    }


    async realmAddMatchDetails(matchDetails) {
        return new Promise(async (resolve, reject) => {
            let values = [matchDetails]
            let query = "INSERT INTO realmMatchStats (`matchData`) VALUES (?)";

            await pool.query(query, [values]);

            return resolve("");
        })
    }

    async realmGetMatchDetails(match_id) {
        return new Promise(async (resolve, reject) => {
            let query = `select * from realmMatchStats where match_id = '${match_id}'`;

            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results[0]);
                    }
                );

            // return resolve("");
        })
    }

    async realmAddMatchToProcess(active_flag, ret_msg, match_id) {
        return new Promise(async (resolve, reject) => {
            let query = `replace into matchIdToProcess VALUES ('${active_flag}','${ret_msg}','${match_id}')`;

            await pool.query(query);

            // return resolve("");
        })
    }

    async realmGetMatchesToProcess() {
        return new Promise(async (resolve, reject) => {
            let query = `select match_id from matchIdToProcess where active_flag = 'n' limit 200`;

            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results);
                    }
                );

            // return resolve("");
        })
    }

    async realmDeleteMatchToProcess(queueID) {
        return new Promise(async (resolve, reject) => {
            let query = `
                                        DELETE From matchIdToProcess
                                         Where
                                         match_id = '${queueID}'`;

            await pool.query(query);

            // return resolve("");
        })
    }

    async realmDeleteActiveMatchToProcess() {
        return new Promise(async (resolve, reject) => {
            let query = `
                        DELETE FROM matchIdToProcess
                        WHERE active_flag = 'y';
                       `;

            await pool.query(query);

            // return resolve("");
        })
    }

    async realmGetProcessedMatch(queueID) {
        return new Promise(async (resolve, reject) => {
            let query = `select * from processedMatchId where queueID = '${queueID}'`;

            await pool.query(query)
                .then(async ([results]) => {
                        if (results === undefined) {
                            return resolve([])
                        } else if (results.length === 0) {
                            return resolve([])
                        } else {
                            return resolve(results);
                        }
                    }
                );

            // return resolve("");
        })
    }

    async realmAddProcessedMatch(queueID,processedMessage = '') {
        return new Promise(async (resolve, reject) => {
            let query = `replace into processedMatchId VALUES ('${queueID}','${this.seconds_since_epoch()}')`;
            await pool.query(query);
            if(processedMessage !== '') {
                logger.error(`realmAddProcessedMatch:::${queueID}::${processedMessage}`)
            }

            // return resolve("");
        })
    }

    async leagueExists(hashedName) {
        return new Promise(async (resolve, reject) => {
            let query = `select * from realmLeagues where hashedTourneyName = '${hashedName}'`

            await pool.query(query)
                .then(async ([results]) => {
                        if (results.length === 0) {
                            return resolve("")
                        } else {
                            return resolve("EXISTS")
                        }
                    }
                );

        });
    }

    async getLeagueInfo(tourneyName, dupTourneyNum) {
        return new Promise(async (resolve, reject) => {
            let query =
                `
                    select tourneyName,bestOfGames,queueType,pointsPerKill,pointsPerPlacement,sortByLowestPoints from realmLeagues where
                    sameTourneyNumber = '${dupTourneyNum}' and
                    tourneyName = '${tourneyName}'
                    `

            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results)
                    }
                );

        });
    }

    async createLeague(hashedName, tourneyName, bestOfGames, queueType, pointsPerKill, pointsPerPlacement, tourneyNumber, negativePoints) {
        let negPointsTemp;
        if (negativePoints === true) {
            negPointsTemp = 1
        } else {
            negPointsTemp = 0
        }
        return new Promise(async (resolve, reject) => {
            let query = `INSERT INTO realmLeagues VALUES ('${hashedName}','${tourneyName}','${bestOfGames}','${queueType}','${pointsPerKill}','${pointsPerPlacement}','${tourneyNumber}','${negPointsTemp}')`;

            await pool.query(query);

            return resolve("");
        })
    }

    async leagueHashChecker(tourneyName, tourneyGameDupNumber, hashedName) {
        return new Promise(async (resolve, reject) => {
            let query = `
                        select * from realmLeagues 
                        where
                         hashedTourneyName = '${hashedName}'
                         and sameTourneyNumber = '${tourneyGameDupNumber}'
                        and tourneyName = '${tourneyName}'
                        `

            await pool.query(query)
                .then(async ([results]) => {
                        if (results.length === 0) {
                            return resolve("")
                        } else {
                            return resolve("CORRECT HASH AND NAME")
                        }
                    }
                );

        });
    }

    async leagueNameChecker(passedTourneyName) {
        return new Promise(async (resolve, reject) => {
            let query = `select COUNT(*) AS namesCount from realmLeagues where tourneyName = '${passedTourneyName}'`

            await pool.query(query)
                .then(async ([results]) => {
                        if (results === undefined) {
                            return resolve(0)
                        } else if (results.length === 0) {
                            return resolve(0)
                        } else {
                            return resolve(parseInt(results[0].namesCount))
                        }
                    }
                );

        });
    }

    async getLeagueTotalGamesEntered(tourneyName, sameTourneyNumber) {
        return new Promise(async (resolve, reject) => {
            let query =
                `
                    select count(*) AS namesCount from realmLeagueGames where
                    tourneyName = '${tourneyName}' and
                    sameTourneyNumber = '${sameTourneyNumber}'
                    `

            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results[0].namesCount)
                    }
                );

        });
    }

    async getLeagueGameTotalInfo(tourneyName, sameTourneyNumber, hashedTourneyName) {
        return new Promise(async (resolve, reject) => {
            let query =
                `
                    select * from realmLeagueGames where
                    tourneyName = '${tourneyName}' and
                    sameTourneyNumber = '${sameTourneyNumber}'
                    order by gameNumber asc
                    `

            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results)
                    }
                );

        });
    }

    async addGameToLeague(hashedName, tourneyName, sameTourneyNumber, gameNumber, queueId) {
        return new Promise(async (resolve, reject) => {
            let query = `
                        select COUNT(*) AS namesCount from realmLeagueGames where
                         hashedTourneyName = '${hashedName}' and 
                         tourneyName = '${tourneyName}' and 
                         sameTourneyNumber = '${sameTourneyNumber}' and 
                         gameNumber = '${gameNumber}' 

            `

            await pool.query(query)
                .then(async ([results]) => {


                        if (results === undefined) {
                            return resolve(0)
                        } else {
                            if (parseInt(results[0].namesCount) > 0) {
                                let query = `
                                        DELETE From realmLeagueGames
                                         Where
                                         hashedTourneyName = '${hashedName}' and
                                         tourneyName = '${tourneyName}' and
                                         sameTourneyNumber = '${sameTourneyNumber}' and
                                         gameNumber = '${gameNumber}'
                                        `;
                                await pool.query(query)
                                    .then(async ([results]) => {
                                            let query = `INSERT INTO realmLeagueGames VALUES ('${hashedName}','${tourneyName}','${sameTourneyNumber}','${gameNumber}','${queueId}')`;
                                            await pool.query(query)
                                        }
                                    )
                            } else {
                                let query = `INSERT INTO realmLeagueGames VALUES ('${hashedName}','${tourneyName}','${sameTourneyNumber}','${gameNumber}','${queueId}')`;
                                await pool.query(query);
                            }
                        }
                    }
                );


            return resolve("");
        })
    }

    async deleteGameFromLeague(hashedName, tourneyName, sameTourneyNumber, gameNumber) {
        return new Promise(async (resolve, reject) => {
            let query = `
                        DELETE From realmLeagueGames
                         Where
                         hashedTourneyName = '${hashedName}' and
                         tourneyName = '${tourneyName}' and
                         sameTourneyNumber = '${sameTourneyNumber}' and
                         gameNumber = '${gameNumber}'
                        `;
            let connection = await mysql.createConnection(config);

            await connection.query(query);
            connection.end();
            return resolve("");
        })
    }
}

module.exports = DatabaseHandler;
//gamesPlayed = gamesPlayed + '1'