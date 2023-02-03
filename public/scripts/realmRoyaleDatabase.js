const mysql = require('mysql2/promise');
let dayjs = require('dayjs')
let utc = require('dayjs/plugin/utc');
const md5 = require("md5");
dayjs.extend(utc);

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
var AsyncLock = require('async-lock');
var lock = new AsyncLock({maxPending: Number.MAX_SAFE_INTEGER}, {maxExecutionTime: 3000});

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
    connectionLimit: 120,
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

    async mmrUpdateMMRPlayerChanges(playerID, queueID, queueIDNumber, sigmaChange, muChange, newSigma, newMu,time) {

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
                            '${time}'
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
    async mmrGetTopPlayersTemp_v2() {
        return new Promise(async (resolve, reject) => {
            // sad inner select query's engage
            const queueIDsToGrab = ['474', '475', '476', '482', '10188', '10189', '10205', '10190']
            let resultString = []
            for(const queue in queueIDsToGrab) {

                let query = `
                    select * from MMRPlayerStorage where queueTypeID = '${queueIDsToGrab[queue]}'
                     order by mmrRankingNumber desc limit 3;
                `
                let result = (await pool.query(query))[0]
                resultString.push(result[0])
                resultString.push(result[1])
                resultString.push(result[2])
            }
            return resolve(resultString);


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
    async realmGetProcessedMatchOverview(queueID) {
        return new Promise(async (resolve, reject) => {
            let query = `select * from matchDataOverview where match_id = '${queueID}'`;
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


    async getMMRChanges(playerID) {
        return new Promise(async (resolve, reject) => {
            let query =
                `
                    select
                        queueID,newRankingNumber,secondsSinceEpoch
                     from 
                        MMRGamePointTracking
                     where 
                         playerID = '${playerID}' and
                         queueID = '474'
                     order by
                        secondsSinceEpoch
                     asc
                `

            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results)
                    }
                );

        });
    }
    async getTotalDelay() {
        return new Promise(async (resolve, reject) => {
            let query =
                `
                    select
                        UNIX_TIMESTAMP()-secondsSinceEpoch as delay
                    from
                        MMRGamePointTracking
                    order by
                        secondsSinceEpoch desc
                    limit 1
                `
            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results)
                    }
                );

        });
    }
    async getRealmStats(howFarBackSeconds,queue = '') {
        return new Promise(async (resolve, reject) => {
            if(queue === '') {
                let query =
                    `
                    select
                        count(distinct(queueIDNumber)) as totalGames,
                        count(playerID) as totalPlayersInMatches,
                        count(distinct(playerID)) as uniquePlayers
                    from
                        MMRGamePointTracking
                    where 
                        secondsSinceEpoch > UNIX_TIMESTAMP()-${howFarBackSeconds}
                `
                await pool.query(query)
                    .then(async ([results]) => {
                            return resolve(results)
                        }
                    );
            } else {
                let query =
                    `
                    select
                        count(distinct(queueIDNumber)) as totalGames,
                        count(playerID) as totalPlayersInMatches,
                        count(distinct(playerID)) as uniquePlayers
                    from
                        MMRGamePointTracking
                    where 
                        secondsSinceEpoch > UNIX_TIMESTAMP()-${howFarBackSeconds} and
                        queueID = ${queue}
                `
                await pool.query(query)
                    .then(async ([results]) => {
                            return resolve(results)
                        }
                    );
            }
        });

    }
    async getHighestKills() {
        return new Promise(async (resolve, reject) => {
            let query =
                `
                    select
                        matchData
                    from 
                        realmMatchStats_temp
                    where
                        match_id_virtual 
                        in (
                                select
                                    distinct(queueIDNumber) as queueid
                                from
                                        MMRGamePointTracking
                                where 
                                          queueid = '475' and 
                                        secondsSinceEpoch > UNIX_TIMESTAMP()-604800*2
                        )
                `
            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results)
                    }
                );

        });
    }

    async getPlayers(time) {
        return new Promise(async (resolve, reject) => {
            let query =
                `
                select
                    distinct(playerID) as players
                from
                    MMRGamePointTracking
                where 
                    secondsSinceEpoch > UNIX_TIMESTAMP()-${time}
                    `

            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results)
                    }
                );

        });
    }


    async  getStoredPlayerInformation(playerID) {
        return new Promise(async (resolve, reject) => {
            let query =
                `
                    select * from player_information
                    where playerID = ${playerID}
                    `

            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results)
                    }
                );

        });
    }

    async  insertNewPlayerInformation(playerInfo) {
        return new Promise(async (resolve, reject) => {
            let playerID = playerInfo['id']
            let  portal_id = playerInfo['portal_id']
            let  platform = playerInfo['platform']
            let  region = playerInfo['region']
            let  steam_id = playerInfo['steam_id']
            let  created_datetime = playerInfo['created_datetime']
            let query =
                `
                    insert into player_information VALUES(
                        '${playerID}',
                        '${portal_id}',
                        '${platform}',
                        '${region}',
                        '${steam_id}',
                        '${Math.floor(new Date(created_datetime).getTime()/1000)}'
                    )
                    `

            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results)
                    }
                );

        });
    }
    mysql_real_escape_string (str) {
        if (typeof str != 'string')
            return str;

        return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
            switch (char) {
                case "\0":
                    return "\\0";
                case "\x08":
                    return "\\b";
                case "\x09":
                    return "\\t";
                case "\x1a":
                    return "\\z";
                case "\n":
                    return "\\n";
                case "\r":
                    return "\\r";
                case "\"":
                case "'":
                case "\\":
                case "%":
                    return "\\"+char; // prepends a backslash to backslash, percent,
                                      // and double/single quotes
            }
        });
    }


    async  insertNewMatchInformationPerPerson(gameMatch,gameMatchMatchID,playerID,teamInfo) {
        return new Promise(async (resolve, reject) => {
            let player_match_id              = gameMatchMatchID
            let player_id                = playerID
            let team_id              = teamInfo['id']
            let placement                = teamInfo['placement']
            let name                 = this.mysql_real_escape_string(gameMatch['name'])
            let level                = gameMatch['level']
            let deaths               = gameMatch['deaths']
            let assists              = gameMatch['assists']
            let class_id            = gameMatch['class_id']
            let earned_xp           = gameMatch['earned_xp']
            let kills_bot           = gameMatch['kills_bot']
            let class_name          = gameMatch['class_name']
            let damage_taken        = gameMatch['damage_taken']
            let kills_player        = gameMatch['kills_player']
            let damage_player       = gameMatch['damage_player']
            let duration_secs       = gameMatch['duration_secs']
            let earned_tokens       = gameMatch['earned_tokens']
            let healing_player      = gameMatch['healing_player']
            let damage_mitigated          = gameMatch['damage_mitigated']
            let dropped_out_flag         = gameMatch['dropped_out_flag']
            let killing_spree_max        = gameMatch['killing_spree_max']
            let mines_wards_placed       = gameMatch['mines_wards_placed']
            let damage_done_in_hand     = gameMatch['damage_done_in_hand']
            let healing_player_self     = gameMatch['healing_player_self']

            let query =

                `
                    insert into matchDataOverview_players VALUES(
                            '${player_match_id}',
                            '${player_id}',
                            '${team_id}',
                            '${placement}',
                            '${name}',
                            '${level}',
                            '${deaths}',
                            '${assists}',
                            '${class_id}',
                            '${earned_xp}',
                            '${kills_bot}',
                            '${class_name}',
                            '${damage_taken}',
                            '${kills_player}',
                            '${damage_player}',
                            '${duration_secs}',
                            '${earned_tokens}',
                            '${healing_player}',
                            '${damage_mitigated}',
                            '${dropped_out_flag}',
                            '${killing_spree_max}',
                            '${mines_wards_placed}',
                            '${damage_done_in_hand}',
                            '${healing_player_self}'
                    )
                    `

            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results)
                    }
                );

        });
    }

    async  insertNewMatchInformationOverview(gameMatch) {
        return new Promise(async (resolve, reject) => {
            let region = gameMatch['region']
            let match_id = gameMatch['match_id']
            let duration_secs = gameMatch['duration_secs']
            let match_datetime =  Math.floor(new Date(gameMatch['match_datetime']).getTime()/1000)
            let match_queue_id = gameMatch['match_queue_id']
            let match_queue_name = gameMatch['match_queue_name']

            let query =
                `
                    insert into matchDataOverview VALUES(
                        '${region}',
                        '${match_id}',
                        '${duration_secs}',
                        '${match_datetime}',
                        '${match_queue_id}',
                        '${match_queue_name}'
                    )
                    `
            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results)
                    }
                );

        });
    }
    async getClassWinRate(secondsToGoback,queueMode) {
        return new Promise(async (resolve, reject) => {
            let query =
                `
                 select class_name,count(*) as games_won_solo from matchDataOverview_players where
                 match_id in 
                 (
                 select match_id from matchDataOverview where
                 match_queue_id = ${queueMode}
                 and duration_secs+ match_datetime > UNIX_TIMESTAMP()-${secondsToGoback}
                 )
                 and 
                 placement = '1'
                 group by class_name
                 order by games_won_solo desc;
                    `
            await pool.query(query)
                .then(async ([results]) => {
                        return resolve(results)
                    }
                );
        });
    }
}

module.exports = DatabaseHandler;
//gamesPlayed = gamesPlayed + '1'