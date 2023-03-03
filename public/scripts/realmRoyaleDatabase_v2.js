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


const initOptions=  {
    user: 'slicky',
    password: 'Homerun123!',
    host: `localhost`,
    database: 'realm_royale',
    max: 25
}




const pgp = require('pg-promise')();
const db = pgp(initOptions);



const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

class DatabaseHandler_v2 {
    constructor() {

    }

    seconds_since_epoch() {
        return Math.floor(Date.now() / 1000)
    }


    is2dArray(array) {
        if (array[0] === undefined) {
            return false;
        } else {
            return (array[0].constructor === Array);
        }
    }

    async tourneyExists(hashedName) {
        return new Promise(async (resolve, reject) => {
            let query = `select * from realmTourneys where hashedTourneyName = '${hashedName}'`

            await db.query
                .then(async (results) => {
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
                    select
                    pointsPerPlacement,
                    pointsPerKill     ,
                    tourneyName       ,
                    amountOfGames     ,
                    bestOfGames       ,
                    queueType         
                    from realmTourneys where
                    sameTourneyNumber = '${dupTourneyNum}' and
                    tourneyName = '${tourneyName}'
                    `

            await db.query(query)
                .then(async (results) => {
                        return resolve(results)
                    }
                );

        });
    }

    async createTourney(hashedName, tourneyName, amountOfGames, bestOfGames, queueType, pointsPerKill, pointsPerPlacement, tourneyNumber, negativePoints) {
        let negPointsTemp;
        console.log(amountOfGames)
        console.log(bestOfGames)
        console.log(tourneyNumber)

        return new Promise(async (resolve, reject) => {
            let query = `INSERT INTO realmTourneys VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`;

            await db.query(query,[
                hashedName, tourneyName, amountOfGames, bestOfGames, queueType, pointsPerKill, pointsPerPlacement, tourneyNumber,negativePoints
            ])

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

            await db.query(query)
                .then(async (results) => {
                        if (results.length === 0) {
                            return resolve("")
                        } else {
                            return resolve("CORRECT HASH AND NAME")
                        }
                    }
                );

        })
    }

    async tourneyNameChecker(passedTourneyName) {
        return new Promise(async (resolve, reject) => {
            let query = `select COUNT(*) AS namesCount from realmTourneys where tourneyName = $1`

            await db.query(query,[passedTourneyName])
                .then(async (results) => {

                        if (results === undefined) {
                            return resolve(0)
                        } else if (results.length === 0) {
                            return resolve(0)
                        } else {
                            return resolve(parseInt(results[0]['namescount']))
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

            await db.query(
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

            await db.query(query)
                .then(async (results) => {
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

            await db.query(query)
                .then(async (results) => {


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
                                await db.query(query)
                                    .then(async (results) => {
                                            let query = `INSERT INTO realmTourneyGames VALUES ($1,$2,$3,$4,$5)`;
                                            await db.query(query,[
                                                hashedName, tourneyName, sameTourneyNumber, gameNumber, queueId
                                            ])
                                        }
                                    )
                            } else {
                                let query = `INSERT INTO realmTourneyGames VALUES ($1,$2,$3,$4,$5)`;
                                await db.query(query,[
                                    hashedName, tourneyName, sameTourneyNumber, gameNumber, queueId
                                ])
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


            await db.query(query)
            .then(async (results) => {
                    if (results.length === 0) {
                        return resolve("")
                    } else {
                        return resolve(results)
                    }
                }
            );

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
                    timeSinceEpoch > extract(epoch from now())-899 and
                    session_id != ''
                    order by timeSinceEpoch asc
                    limit 1
                `
            lock.acquire(
                "getUsableApiKey",
                async () => {
                    logger.error(`Using lock for getUsableApiKey function`)
                    return new Promise(async (resolve, reject) => {
                        let startTime = performance.now()
                        await db.query(newQuery)
                            .then(async (results) => {
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
                                        let query = `INSERT INTO ApiGrabbingStats VALUES ($1,$2,$3,extract(epoch from now()))`;

                                        await db.query(query,
                                            [
                                                sessionId,
                                                0,
                                                dayjs.utc().format('YYYYMMDDHHmmss')
                                            ]
                                        );
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

                        if(!normalParams) {
                            let methodSignature = md5(`${devId}${endPoint}${authKey}${dayjs.utc().format('YYYYMMDDHHmmss')}`)
                            let normalBaseUrl = `${baseApi}JSON/${endPoint}`
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
                        } else {
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
                    }
                )
            // })
        })

    }

    async updateApiReqCount(apiKey, amount = 1) {
        return new Promise(async (resolve, reject) => {
            let query = `update ApiGrabbingStats set session_message_count = session_message_count + '${amount}' where session_id = '${apiKey}'`

            await db.query(query)
                .then(async (results) => {
                    return resolve(`updated '${apiKey}' with '${amount}' new messages`)
                })

        })
    }

    async mmrPlayerGetStats(playerID) {
        return new Promise(async (resolve, reject) => {
            let query = `
                select playerID,queueTypeID,mmrRankingNumber from MMRPlayerStorage where playerID = '${playerID}' order by queueTypeID asc
            `

            await db.query(query)
                .then(async (results) => {
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

            await db.query(query)
                .then(async (results) => {
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

            await db.query(query)
                .then(async (results) => {
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
            let query = `insert into MMRPlayerStorage VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`;

            await db.query(query,
                [
                    playerID,
                    queueTypeID,
                    mu,
                    sigma,
                    ordinal({mu: mu, sigma: sigma}),
                    gameCount+1
                ]);

            return resolve("");
        })
    }

    async mmrUpdateMMRPlayerChanges(playerID, queueID, queueIDNumber, sigmaChange, muChange, newSigma, newMu,time) {

        return new Promise(async (resolve, reject) => {


            let query = `INSERT INTO MMRGamePointTracking VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`;

            await db.result(query,[
                playerID,
                queueID,
                queueIDNumber,
                sigmaChange,
                muChange,
                ordinal({ mu: muChange, sigma: sigmaChange}),
                newSigma,
                newMu,
                ordinal({ mu: newMu, sigma: newSigma}),
                time
            ])
            .then(async (results) => {
                return resolve(results.rowCount)
            })
            
        })
    }

    async mmrGetTopPlayers() {
        return new Promise(async (resolve, reject) => {
            let query = `select playerID,queueTypeID,mu from MMRPlayerStorage order by mu desc limit 3`

            await db.query(query)
                .then(async (results) => {
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

            await db.query(query)
                .then(async (results) => {
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
                let result = (await db.query(query))
                resultString.push(result[0])
                resultString.push(result[1])
                resultString.push(result[2])
            }
            return resolve(resultString);


        });
    }

    async realmAddMatchDetails(matchDetails) {
        return new Promise(async (resolve, reject) => {
            let values = matchDetails
            let query = "INSERT INTO realmMatchStats VALUES ($1)";

            await db.query(query, [values]);

            return ("");
        })
    }

    async realmGetMatchDetails(match_id) {
        return new Promise(async (resolve, reject) => {
            let query = `select * from realmMatchStats where match_id = '${match_id}'`;

            await db.query(query)
                .then(async (results) => {
                        return resolve(results[0]);
                    }
                );

            // return resolve("");
        })
    }

    async realmAddMatchToProcess(active_flag, ret_msg, match_id) {
        return new Promise(async (resolve, reject) => {
            let query = `insert into matchIdToProcess VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING match_id`

            await db.query(query,
                [
                    active_flag,
                    ret_msg,
                    match_id
                ]
            ).then(async (results) => {
                return resolve(results)
            })

        })
    }

    async realmGetMatchesToProcess() {
        return new Promise(async (resolve, reject) => {
            let query = `select match_id from matchIdToProcess where active_flag = 'n' order by match_id asc limit 200`;

            await db.query(query)
                .then(async (results) => {
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

            await db.query(query);

            // return resolve("");
        })
    }

    async realmDeleteActiveMatchToProcess() {
        return new Promise(async (resolve, reject) => {
            let query = `
                        DELETE FROM matchIdToProcess
                        WHERE active_flag = 'y';
                       `;

            await db.query(query);

            // return resolve("");
        })
    }

    async realmGetProcessedMatch(queueID) {
        return new Promise(async (resolve, reject) => {
            let query = `select * from processedMatchId where queueID = '${queueID}'`;

            await db.query(query)
                .then(async (results) => {
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
            await db.query(query)
                .then(async (results) => {
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
            let query = `insert into processedMatchId VALUES ($1,extract(epoch from now())) ON CONFLICT DO NOTHING`;
            await db.query(query,
                [
                    queueID
                ]
                );
            if(processedMessage !== '') {
                logger.error(`realmAddProcessedMatch:::${queueID}::${processedMessage}`)
            }

            return resolve("");
        })
    }

    async leagueExists(hashedName) {
        return new Promise(async (resolve, reject) => {
            let query = `select * from realmLeagues where hashedTourneyName = '${hashedName}'`

            await db.query(query)
                .then(async (results) => {
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

            await db.query(query)
                .then(async (results) => {
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
            let query = `INSERT INTO realmLeagues VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`;

            await db.query(query,
                [
                    hashedName,
                    tourneyName,
                    bestOfGames,
                    queueType,
                    pointsPerKill,
                    pointsPerPlacement,
                    tourneyNumber,
                    negPointsTemp
                ]
                );

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

            await db.query(query)
                .then(async (results) => {
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

            await db.query(query)
                .then(async (results) => {
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

            await db.query(query)
                .then(async (results) => {
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

            await db.query(query)
                .then(async (results) => {
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

            await db.query(query)
                .then(async (results) => {


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
                                await db.query(query)
                                    .then(async (results) => {
                                            let query = `INSERT INTO realmLeagueGames VALUES ($1,$2,$3,$4,$5)`;
                                            await db.query(query,
                                                [
                                                    hashedName,
                                                    tourneyName,
                                                    sameTourneyNumber,
                                                    gameNumber,
                                                    queueId
                                                ])
                                        }
                                    )
                            } else {
                                let query = `INSERT INTO realmLeagueGames VALUES ($1,$2,$3,$4,$5)`;
                                await db.query(query,
                                    [
                                        hashedName,
                                        tourneyName,
                                        sameTourneyNumber,
                                        gameNumber,
                                        queueId
                                    ]
                                )
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
            await db.query(query)
            .then(async (results) => {
                    if (results.length === 0) {
                        return resolve("")
                    } else {
                        return resolve(results)
                    }
                }
            );

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
                         playerID = $1 and
                         queueID = $2
                     order by
                        secondsSinceEpoch
                     asc
                `

            await db.query(query,
                [
                    playerID,
                    474
                ])
                .then(async (results) => {
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
                    extract(epoch from now())-(match_datetime+duration_secs) as delay 
                from
                    matchDataOverview 
                order by
                    (match_datetime+duration_secs)
                desc limit 1;
                `
            await db.query(query)
                .then(async (results) => {
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
                    to_timestamp(secondsSinceEpoch) > now() - interval '$1 second'
                `
                await db.one(query,
                    [howFarBackSeconds])
                    .then(async (results) => {
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
                    to_timestamp(secondsSinceEpoch) > now() - interval '$1 second' and
                    queueID = $2
                `
                await db.one(query,
                    [
                        howFarBackSeconds,
                        queue
                    ])
                    .then(async (results) => {
                            return resolve(results)
                        }
                    );
            }
        });
    }
    async getRealmStats_v2(howFarBackSeconds,queue = '') {
        return new Promise(async (resolve, reject) => {
            if(queue === '') {
                let query =
                    `
                    select
                        count(mdo_p.player_id) as totalplayersinmatches,
                        count(distinct(mdo_p.player_id)) as uniqueplayers
                    from 
                        matchDataOverview_players mdo_p
                    inner join matchDataOverview mdo
                    on(
                        mdo.match_id = mdo_p.match_id
                    )
                     where to_timestamp(mdo.duration_secs+mdo.match_datetime ) > now() - interval '$1 seconds'
                `
                await db.one(query,
                    [howFarBackSeconds])
                    .then(async (results) => {
                            return resolve(results)
                        }
                    );
            } else {
                let query =
                    `
                    select 
                        count(mdo_p.player_id) as totalplayersinmatches,
                        count(distinct(mdo_p.player_id)) as uniqueplayers
                    from
                         matchDataOverview_players mdo_p
                    inner join matchDataOverview mdo
                    on(
                        mdo.match_id = mdo_p.match_id
                    )
                     where
                    mdo.match_queue_id = $1 and
                    to_timestamp(mdo.duration_secs+mdo.match_datetime ) > now() - interval '$2 seconds'
                `
                await db.one(query,
                    [
                        queue,
                        howFarBackSeconds
                    ])
                    .then(async (results) => {
                            return resolve(results)
                        }
                    );
            }
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
                    to_timestamp(secondsSinceEpoch) > now() - interval '$1 second'
                `
                await db.one(query,
                    [howFarBackSeconds])
                    .then(async (results) => {
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
                    to_timestamp(secondsSinceEpoch) > now() - interval '$1 second' and
                    queueID = $2
                `
                await db.one(query,
                    [
                        howFarBackSeconds,
                        queue
                    ])
                    .then(async (results) => {
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
                                        secondsSinceEpoch > extract(epoch from now())-604800*2
                        )
                `
            await db.query(query)
                .then(async (results) => {
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
                    to_timestamp(secondsSinceEpoch) > now() - interval '$1 seconds'
                `

            await db.query(query,
                [
                    time
                ]
            )
                .then(async (results) => {
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

            await db.query(query)
                .then(async (results) => {
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
            let offSet = ((new Date(playerInfo['created_datetime']).getTimezoneOffset())*-60)

            let query =
                `
                insert into player_information VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`

            await db.query(query,
                [
                    playerID,
                    portal_id,
                    platform,
                    region,
                    steam_id,
                    Math.floor(new Date(created_datetime).getTime()/1000)+offSet
                ]
            ).then(async (results) => {
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

            let query = `insert into matchDataOverview_players VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23) ON CONFLICT DO NOTHING`
            await db.query(query,
                [
                    player_match_id,
                    player_id,
                    team_id,
                    placement,
                    name,
                    level, 
                    deaths,
                    assists,
                    class_id,
                    earned_xp,
                    kills_bot,
                    class_name,
                    damage_taken,
                    kills_player,
                    damage_player,
                    duration_secs,
                    earned_tokens,
                    healing_player,
                    damage_mitigated,
                    dropped_out_flag,
                    killing_spree_max,
                    mines_wards_placed,
                    damage_done_in_hand,
                    healing_player_self
                ])
                .then(async (results) => {
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
            let offSet = ((new Date(gameMatch['match_datetime']).getTimezoneOffset())*-60)

            let match_queue_id = gameMatch['match_queue_id']
            let match_queue_name = gameMatch['match_queue_name']

            let query = `insert into matchDataOverview VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`
            await db.query(query,
                [
                    region,
                    match_id,
                    duration_secs,
                    match_datetime+offSet,
                    match_queue_id,
                    match_queue_name
                ])
                .then(async (results) => {
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
                 match_queue_id = $1
                 and duration_secs+ match_datetime > extract(epoch from now())-$2
                 )
                 and 
                 placement = '1'
                 group by class_name
                 order by games_won_solo desc;
                    `
            await db.query(query,
                [
                    queueMode,
                    secondsToGoback
                ])
                .then(async (results) => {
                        return resolve(results)
                    }
                );
        });
    }
    async getClassWinRate_v2(secondsToGoback,queueMode) {
        return new Promise(async (resolve, reject) => {
            let nonWinningNumbers =
                `
                select class_name,count(*) as games_won_solo from matchDataOverview_players where
                match_id in 
                (
                select match_id from matchDataOverview where
                match_queue_id = $1
                and to_timestamp(duration_secs+ match_datetime ) > now() - interval '$2 seconds'
                )
                group by class_name
                order by class_name desc;
                    `
                let winningNumbers =
                `
                select class_name,count(*) as games_won_solo from matchDataOverview_players where
                match_id in 
                (
                select match_id from matchDataOverview where
                match_queue_id = $1
                and to_timestamp(duration_secs+ match_datetime ) > now() - interval '$2 seconds'
                )
                and placement = 1
                group by class_name
                order by class_name desc;
                    `


                    let [
                        nonWinningNumbersRes,
                        winningNumbersRes
                    ] = await Promise.all([
                        db.query(nonWinningNumbers,
                            [
                                queueMode,
                                secondsToGoback
                            ])
                        ,
                        db.query(winningNumbers,
                            [
                                queueMode,
                                secondsToGoback
                            ])
                        ]);
                    resolve([winningNumbersRes,nonWinningNumbersRes])

        });
    }


    async  getMatchHistoryBreakdown(queueID,lengthOfTime) {
        return new Promise(async (resolve, reject) => {
            let query =
                `
                select count(*) matchesPlayed,region from matchDataOverview where
                match_id in (
                select
                    distinct(queueIDNumber)
                from
                    MMRGamePointTracking
                where 
                    secondsSinceEpoch > extract(epoch from now())-${lengthOfTime} and
                    queueID = ${queueID}
                )
                group by region
                order by matchesPlayed desc
                `

            await db.query(query)
                .then(async (results) => {
                        return resolve(results)
                    }
                );

        });
    }
    async getCrossplayMatchStats(secondsToGoback,queueMode) {
        return new Promise(async (resolve, reject) => {
            let query =
                `
                 select *
                 from matchDataOverview_stats_crossplay_stats_total where
                 queueID = $1 and
                 earliestMatchEpochDate = $2
                    `
            await db.query(query,
                [
                    queueMode,
                    secondsToGoback
                ]
                )
                .then(async (results) => {
                        return resolve(results)
                    }
                );
        });
    }
    async getPlayers_v2(timeOffsetSeconds) {
        return new Promise(async (resolve, reject) => {

        let query = `
            select mdop.player_id
            from matchDataOverview mdo
            inner join matchDataOverview_players mdop
            on (
                mdop.match_id = mdo.match_id)
            where 
                to_timestamp(mdo.match_datetime) > now() - interval '$1 seconds'
            group by mdop.player_id
        `
        await db.query(query,
            [
                timeOffsetSeconds
            ]
            )
            .then(async (results) => {
                    return resolve(results)
                }
            );
        })
    }
    async getCrossPlayPercentage(timeOffsetSeconds,queueID) {
        return new Promise(async (resolve, reject) => {

        let query_SameInputOnly = `
            select 
            count(*) as platformOnlyGames
            from
            (
            SELECT
                t2.platform as platformCount
            FROM
                matchDataOverview_players  t1
            inner join player_information t2
                on (t2.playerID = t1.player_id)
            inner join matchDataOverview t3
                on (t1.match_id = t3.match_id)
            where
                to_timestamp(t3.match_datetime ) > now() - interval '$1 seconds' and
            t3.match_queue_id = $2
            GROUP BY
                t2.platform,t1.match_id
            having
                count(t2.platform) = 1
            )c
        `
        
        let query_anyInput = `
            select 
            count(*) as platformOnlyGames
            from
            (
            SELECT
                t2.platform as platformCount
            FROM
                matchDataOverview_players  t1
            inner join player_information t2
                on (t2.playerID = t1.player_id)
            inner join matchDataOverview t3
                on (t1.match_id = t3.match_id)
            where
                to_timestamp(t3.match_datetime ) > now() - interval '$1 seconds' and
            t3.match_queue_id = $2
            GROUP BY
                t2.platform,t1.match_id
            )c
        `
        let [
            sameInputGames,
            anyInputGames
        ] = await Promise.all([
            db.query(query_SameInputOnly,
                [
                    timeOffsetSeconds,
                    queueID
                ])
            ,
            db.query(query_anyInput,
                [
                    timeOffsetSeconds,
                    queueID
                ])
            ]);
        resolve([sameInputGames[0]['platformonlygames'],anyInputGames[0]['platformonlygames']])

        
        })
    }
    async getAveragePlayersPerGamePerRegion(epochOffset,queueID) {
        return new Promise(async (resolve, reject) => {

            let totalPlayersInRegion = `
                select
                    mdo.region,
                    count(mdo.region)
                from 
                    matchDataOverview mdo
                where
                    mdo.match_queue_id = $1
                    and to_timestamp(mdo.duration_secs+mdo.match_datetime ) > now() - interval '$2 seconds'
                group by
                    mdo.region
                order by
                    mdo.region
            `
            let totalMatches = `
                select 
                    mdo.region,
                    count(mdo.region)
                from 
                    matchDataOverview_players mdo_p
                inner join
                    matchDataOverview mdo on(
                        mdo.match_id = mdo_p.match_id
                    )
                where
                    mdo.match_queue_id = $1 and
                    to_timestamp(mdo.duration_secs+mdo.match_datetime ) > now() - interval '$2 seconds'
                group by
                    mdo.region
                order by
                    mdo.region
            `

            let [
                sameInputGames,
                anyInputGames
            ] = await Promise.all([
                db.query(totalPlayersInRegion,
                    [
                        queueID,
                        epochOffset
                    ])
                ,
                db.query(totalMatches,
                    [
                        queueID,
                        epochOffset
                    ])
                ]
            );
            resolve([sameInputGames,anyInputGames])
        })
    }
    async getPlayerMatchHistory(player_id) {
        return new Promise(async (resolve, reject) => {

        let query = `
                select
                    row_number() OVER () as game_number,
                    match_datetime,
                    name,
                    region,
                    match_queue_id,
                    class_id,
                    placement,
                    mdo_p.duration_secs as duration_secs,
                    kills_player,
                    deaths,
                    damage_player,
                    damage_taken,
                    dropped_out_flag,
                    mdo_p.match_id as match_id
                from
                    matchdataoverview mdo
                inner join matchdataoverview_players  mdo_p on
                (
                    mdo_p.match_id = mdo.match_id
                )
                where mdo_p.player_id = $1
                order by mdo_p.match_id desc
        `
        await db.query(query,
            [
                player_id
            ]
            )
            .then(async (results) => {
                    return resolve(results)
                }
            );
        })
    }
    async graphTestingV1(lengthOfTimeSeconds,secondTimeIntervalSize) {
        return new Promise(async (resolve, reject) => {
            let roundingString = {
                600: "minute",
                3600: "hour",
                86400: "day",
                604800: "week",
                2630000: "month"
            }

            let query =
                `
                    select
                        count(mdo_p.player_id) as totalplayersinmatches,
                        count(distinct(mdo_p.player_id)) as uniqueplayers,
                        min(mdo.match_datetime+mdo.duration_secs) as date
                    from 
                        matchDataOverview_players mdo_p
                    inner join matchDataOverview mdo
                    on(

                        mdo.match_id = mdo_p.match_id
                    )
                    where
                        mdo.duration_secs+mdo.match_datetime >
                        (extract(epoch from (date_trunc($3, now() - interval '$1 second' - interval '$4 second'))))
                    group by
                        (mdo.match_datetime+mdo.duration_secs) / $2
                    `
            await db.query(query,
                [
                    lengthOfTimeSeconds,
                    secondTimeIntervalSize,
                    roundingString[secondTimeIntervalSize],
                    parseInt(secondTimeIntervalSize/2)
                ]
                )
                .then(async (results) => {
                        return resolve(results)
                    }
                );
        });
    }
    async averagePlayersOverTime(lengthOfTimeSeconds,secondTimeIntervalSize,match_queue_id,region) {
        return new Promise(async (resolve, reject) => {
            let roundingString = {
                600: "minute",
                3600: "hour",
                86400: "day",
                604800: "week",
                2630000: "month"
            }

            let totalGames =
                `
                select
                    mdo.region,
                    count(mdo.region),
                    min(mdo.match_datetime+mdo.duration_secs) as to_timestamp
                from 
                    matchDataOverview mdo
                where
                    mdo.region = $5 and
                    mdo.match_queue_id = $4 and
                    mdo.duration_secs+mdo.match_datetime >
                    (extract(epoch from (date_trunc($3, now() - interval '$2 second' - interval '$1 second'))))
                group by
                    ((mdo.match_datetime+mdo.duration_secs) / $2),mdo.region
                order by
                    mdo.region,to_timestamp 
                `

                
            let totalPlayers =
            `
            select 
                mdo.region,
                count(mdo.region),
                min(mdo.match_datetime+mdo.duration_secs) as to_timestamp
            from 
                matchDataOverview_players mdo_p
            inner join
                matchDataOverview mdo on(
                    mdo.match_id = mdo_p.match_id
                )
            where
                mdo.region = $5 and
                mdo.match_queue_id = $4 and
                mdo.duration_secs+mdo.match_datetime >
                (extract(epoch from (date_trunc($3, now() - interval '$2 second' - interval '$1 second'))))
            group by
                ((mdo.match_datetime+mdo.duration_secs) / $2),mdo.region
            order by
                mdo.region,to_timestamp
                `



            let [
                resTotalGames,
                resTotalPlayers
            ] = await Promise.all([
                db.query(totalGames,
                    [
                        lengthOfTimeSeconds,secondTimeIntervalSize,roundingString[secondTimeIntervalSize],match_queue_id,region
                    ])
                ,
                db.query(totalPlayers,
                    [
                        lengthOfTimeSeconds,secondTimeIntervalSize,roundingString[secondTimeIntervalSize],match_queue_id,region
                    ])
                ]);
            
            
            let averages = []
            for(let i = 0; i<resTotalGames.length; i++ ) {
                averages.push(

                        {
                            region: resTotalGames[i]['region'],
                            count: resTotalPlayers[i]['count']/resTotalGames[i]['count'],
                            to_timestamp: resTotalGames[i]['to_timestamp']
                        }

                )
            }
            resolve([resTotalGames,resTotalPlayers,averages])
        });
    }
    async sameInputPlayersOverTime(lengthOfTimeSeconds,secondTimeIntervalSize,match_queue_id) {
        return new Promise(async (resolve, reject) => {
            let roundingString = {
                600: "minute",
                3600: "hour",
                86400: "day",
                604800: "week",
                2630000: "month"
            }

            let totalInputCount =
                `
                    with
                        all_input_games as (
                            SELECT
                                min(t3.match_datetime+t3.duration_secs) as time,
                                t2.platform as platformCount
                            FROM
                                matchDataOverview_players  t1
                            inner join player_information t2
                                on (t2.playerID = t1.player_id)
                            inner join matchDataOverview t3
                                on (t1.match_id = t3.match_id)
                            where
                                t3.duration_secs+t3.match_datetime > 
                                    (extract(epoch from (date_trunc($3, now() - interval '$2 second' - interval '$1 second')))) and
                                t3.match_queue_id = $4
                            GROUP BY
                                t2.platform,t1.match_id
                        )
                        select
                            count(aig.platformCount),
                            (aig.time/$2)*$2 as time
                        from 
                            all_input_games aig
                        group by
                            (aig.time/$2)
                        order by     
                           (aig.time/$2)
                `

                
            let sameInputCount =
            `
                with
                    same_input_games as (
                        SELECT
                            min(t3.match_datetime+t3.duration_secs) as time,
                            t2.platform as platformCount
                        FROM
                            matchDataOverview_players  t1
                        inner join player_information t2
                            on (t2.playerID = t1.player_id)
                        inner join matchDataOverview t3
                            on (t1.match_id = t3.match_id)
                        where
                            t3.duration_secs+t3.match_datetime > 
                                (extract(epoch from (date_trunc($3, now() - interval '$2 second' - interval '$1 second')))) and
                            t3.match_queue_id = $4
                        GROUP BY
                            t2.platform,t1.match_id
                        having
                            count(t2.platform) = 1
                    )
                    
                    select
                        count(sig.platformCount),
                        (sig.time/$2)*$2 as time
                    from 
                        same_input_games sig
                    group by
                        (sig.time/$2)
                    order by
                    (sig.time/$2)
                `



            let [
                resTotalInputCount,
                resSameInputCount
            ] = await Promise.all([
                db.query(totalInputCount,
                    [
                        lengthOfTimeSeconds,
                        secondTimeIntervalSize,
                        roundingString[secondTimeIntervalSize],
                        match_queue_id
                    ])
                ,
                db.query(sameInputCount,
                    [
                        lengthOfTimeSeconds,
                        secondTimeIntervalSize,
                        roundingString[secondTimeIntervalSize],
                        match_queue_id
                    ])
                ]);
            
            
            let averages = []
            for(let i = 0; i<resTotalInputCount.length; i++ ) {
                if(resSameInputCount[i]['time'] !== resTotalInputCount[i]['time']) {
                    resSameInputCount.splice(i, 0, {
                        'time':resTotalInputCount[i]['time'],
                        'count':0
                    })
                }
                averages.push(

                        {
                            time: resTotalInputCount[i]['time'],
                            count: resSameInputCount[i]['count']/resTotalInputCount[i]['count']
                        }

                )
            }
            resolve([resTotalInputCount,resSameInputCount,averages])
        });
    }
    async getHighestIndivKills() {
        return new Promise(async (resolve, reject) => {

        let query = `
            select 
                row_number() OVER (order by kills_player desc) as rank,
                name,
                kills_player as total_kills,
                player_id,
                match_id
            from
                matchdataoverview_players
            order by 
                kills_player desc
            limit 100;
        `
        await db.query(query,[]
            )
            .then(async (results) => {
                    return resolve(results)
                }
            );
        })
    }
    async getHighestTeamKills() {
        return new Promise(async (resolve, reject) => {

        let query = `
                SELECT 
                    row_number() OVER (ORDER BY total_kills DESC) AS rank,
                    array_agg(m.name) AS player_names,
                    array_agg(m.player_id) AS player_ids,
                    tk.total_kills,
                    tk.match_id
                FROM (
                    SELECT 
                        match_id, 
                        SUM(kills_player) AS total_kills
                    FROM matchdataoverview_players
                    WHERE placement = 1
                    GROUP BY match_id
                    ORDER BY total_kills DESC
                    LIMIT 100
                ) tk
                JOIN matchdataoverview_players m ON m.match_id = tk.match_id
                    AND m.placement = 1
                GROUP BY tk.match_id, tk.total_kills
                ORDER BY tk.total_kills DESC;
        `
        await db.query(query,[]
            )
            .then(async (results) => {
                    return resolve(results)
                }
            );
        })
    }
    async getMonthlyRealmLeaderboardStats() {
        return new Promise(async (resolve, reject) => {

        let totalMonthlyPlayerStats = `
                    select
                        format_number(sum(damage_player)) as totalDamage,
                        format_number(sum(damage_taken)) as damageTaken,
                        format_number(sum(kills_player)) as totalKills,
                        format_number(sum(mdop.duration_secs)) as totalTime,
                        format_number(count(mdo.match_id)) as totalMatches,
                        format_number(count(mdop.deaths)) as totalDeaths
                    from
                        matchDataOverview mdo
                    inner join
                        matchDataOverview_players mdop
                    on (mdop.match_id = mdo.match_id)
                    where 
                        to_timestamp(mdo.match_datetime) > now() - interval '2630000 seconds'
            `
            let classMonthlyPlayerStats = `
                        select
                            mdop.class_name as className,
                            format_number(sum(damage_player)) as totalDamage,
                            format_number(sum(damage_taken)) as damageTaken,
                            format_number(sum(kills_player)) as totalKills,
                            format_number(sum(mdop.duration_secs)) as totalTime,
                            format_number(count(mdo.match_id)) as totalMatches,
                            format_number(count(mdop.deaths)) as totalDeaths
                        from
                            matchDataOverview mdo
                        inner join
                            matchDataOverview_players mdop
                        on (mdop.match_id = mdo.match_id)
                        where 
                            to_timestamp(mdo.match_datetime) > now() - interval '2630000 seconds'
                        group by mdop.class_name
                `

            let [
                totalMonthlyPlayerStatsRes,
                classMonthlyPlayerStatsRes
            ] = await Promise.all([
                db.query(totalMonthlyPlayerStats,
                    [])
                ,
                db.query(classMonthlyPlayerStats,
                    [])
                ]);
            resolve([totalMonthlyPlayerStatsRes,classMonthlyPlayerStatsRes])

        })
    }
    async getMatchInformation(matchID) {
        return new Promise(async (resolve, reject) => {

        let totalMonthlyPlayerStats = 
            `
                select
                    min(placement         )  as placement,
                    max(mdo_p.duration_secs     ) as duration_secs,
                    array_agg(name              ) as name,
                    array_agg(player_id         ) as id ,
                    array_agg(kills_player      ) as kills_player ,
                    array_agg(deaths      )  as deaths,
                    array_agg(damage_player     ) as damage_player ,
                    array_agg(damage_taken     )  as damage_taken,
                    array_agg(COALESCE(healing_player_self, 0)     )  as healing_player_self,
                    array_agg(healing_player     ) as healing_player,
                    array_agg(class_name     ) as class_names 
                from 
                    matchdataoverview mdo
                inner join
                    matchdataoverview_players mdo_p on
                        ( mdo_p.match_id = mdo.match_id)
                where
                    mdo.match_id = $1
                group by
                    mdo_p.team_id
                order by
                    max(placement),
                    max(mdo_p.duration_secs),
                    sum(kills_player)
            `

            let matchOverviewInfo = 
            `
                select * from matchdataoverview where match_id = $1;
            `
            let [
                totalMonthlyPlayerStatsRes,
                matchOverviewInfoRes
            ] = await Promise.all([
                db.query(totalMonthlyPlayerStats,
                    [matchID]
                ),
                db.query(matchOverviewInfo,
                    [matchID]
                )
            ]);
            resolve([totalMonthlyPlayerStatsRes,matchOverviewInfoRes])

        })
    }
    async graphTestingV2() {
        return new Promise(async (resolve, reject) => {

        let query = `
        WITH filtered_matches AS (
            SELECT
                mdo.match_datetime + mdo.duration_secs AS match_end_time,
                match_id
            FROM
                matchDataOverview mdo
            WHERE
                mdo.match_datetime + mdo.duration_secs > (
                    SELECT EXTRACT(epoch FROM date_trunc('month', NOW() - INTERVAL '2630000 second' - INTERVAL '1315000 second'))
                )
                AND mdo.match_datetime + mdo.duration_secs <= (
                    SELECT EXTRACT(epoch FROM date_trunc('month', NOW()))
                )
        ), 
        count_query AS (
            SELECT
                COUNT(mdo_p.player_id) AS totalplayersinmatches,
                COUNT(DISTINCT mdo_p.player_id) AS uniqueplayers
            FROM
                matchDataOverview_players mdo_p
            JOIN filtered_matches fm
                ON mdo_p.match_id = fm.match_id
        ), 
        min_query AS (
            SELECT
                MIN(fm.match_end_time) AS date
            FROM
                filtered_matches fm
        )
        SELECT 
            count_query.totalplayersinmatches,
            count_query.uniqueplayers,
            min_query.date
        FROM 
            count_query
        CROSS JOIN 
            min_query;
        `
        await db.query(query,[]
            )
            .then(async (results) => {
                    return resolve(results)
                }
            );
        })
    }
}

module.exports = DatabaseHandler_v2;
