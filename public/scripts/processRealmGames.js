let databaseConfig = require('./realmRoyaleDatabase_v2.js');
let database = new databaseConfig()

let {rate, rating} = require('openskill')

const winston = require('winston');

const logger = winston.createLogger({
    maxsize: '10000000',
    maxFiles: '1000',
    timestamp: true,
    level: 'info',
    format: winston.format.json(),
    defaultMeta: {service: 'processRealmGames'},
    transports: [
        new winston.transports.File({filename: __dirname + '/combined.json'})
    ],
});

function fixRealmGameOutput(totalGameDetails,anArrayOfGameDetail=false) {
    if(anArrayOfGameDetail) {
        for(const [key,value] of totalGameDetails.entries()) {
            let idStored = []
            for(const gameVals in value) {
                if(gameVals === 'teams') {
                    let index = 0
                    for(const teams in value[gameVals]) {
                        if(idStored[value[gameVals][teams]['id']] === undefined) {
                            idStored[value[gameVals][teams]['id']] = {index: index}
                        } else {
                            for(const player in value[gameVals][teams]['players']) {
                                totalGameDetails.get(key)[gameVals][idStored[value[gameVals][teams]['id']]['index']]['players'].push(
                                    value[gameVals][teams]['players'][player])
                            }
                            delete totalGameDetails.get(key)[gameVals][index]
                        }
                        index+=1
                    }
                }
            }
        }

        return totalGameDetails
    } else {
        let idStored = []
        for(const gameVals in totalGameDetails) {
            if(gameVals === 'teams') {
                let index = 0
                for(const teams in totalGameDetails[gameVals]) {

                    if(idStored[totalGameDetails[gameVals][teams]['id']] === undefined) {
                        idStored[totalGameDetails[gameVals][teams]['id']] = {index: index}
                    } else {
                        for(const player in totalGameDetails[gameVals][teams]['players']) {
                            totalGameDetails[gameVals][teams]['players'][player]['duration_secs']= totalGameDetails[gameVals][idStored[totalGameDetails[gameVals][teams]['id']]['index']]['players'][0]['duration_secs']
                            totalGameDetails[gameVals][idStored[totalGameDetails[gameVals][teams]['id']]['index']]['players'].push(
                                totalGameDetails[gameVals][teams]['players'][player])
                        }
                        delete totalGameDetails[gameVals][index]
                    }
                    index+=1
                }
            }
        }
        return totalGameDetails
    }
}



async function insertFormattedGameMatches(gameMatch) {


    await database.insertNewMatchInformationOverview(gameMatch);

    for(const team in gameMatch['teams']) {
        for(const players in gameMatch['teams'][team]) {
            for(const player in gameMatch['teams'][team][players]) {

                if((Object.keys(await database.getStoredPlayerInformation(gameMatch['teams'][team][players][player]['id']))).length === 0) {
                    let playerInfo = await database.callApi(
                        'GetPlayer',
                        true,
                        `GetPlayer::${gameMatch['teams'][team][players][player]['id']}`,
                        gameMatch['teams'][team][players][player]['id'],
                        'hirez'
                    )
                    await database.insertNewPlayerInformation(playerInfo)
                }



                await database.insertNewMatchInformationPerPerson(
                    gameMatch['teams'][team][players][player],
                    gameMatch['match_id'],
                    gameMatch['teams'][team][players][player]['id'],
                    gameMatch['teams'][team]
                );
            }

        }
    }
}


setInterval(async function () {

        database.realmGetMatchesToProcess().then(async matches => {

            for (const match in matches) {



            //this is a very risky call behavior, but works for now and haven't seen any problems - 10/13/22
            // in reality we prob should set up a mid-database and confirm if the transaction goes through
            database.realmDeleteMatchToProcess(matches[match]['match_id'])
            database.callApi(
                'GetMatchDetails',
                true,
                `GetMatchDetails::${matches[match]['match_id']}`,
                matches[match]['match_id']
            ).then(async matchDetails => {

                if (matchDetails['ret_msg'] === null) {
                    matchDetails = fixRealmGameOutput(matchDetails)
                    await insertFormattedGameMatches(matchDetails)


                    logger.error(`Match:::GOOD_MATCH:::${matches[match]['match_id']}::RET_MSG:${matchDetails['ret_msg']}`)

                    let match_queue_id = matchDetails['match_queue_id'] // 474->solos,475->duos,476->squads,etc...

                    let placementOrder = []
                    let teamAndPlayers = []
                    let teamIndex = 0;
                    let mmrValues = []


                    for (const team in matchDetails['teams']) {
                        teamAndPlayers[teamIndex] = []
                        mmrValues[teamIndex] = []
                        placementOrder.push(matchDetails['teams'][team]['placement'])
                        let playerIndex = 0
                        for (const player in matchDetails['teams'][team]['players']) {
                            teamAndPlayers[teamIndex][playerIndex] = []
                            mmrValues[teamIndex][playerIndex] = ''
                            teamAndPlayers[teamIndex][playerIndex][0] = matchDetails['teams'][team]['players'][player]['id']

                            let playerStats = await database.mmrPlayerLookup(matchDetails['teams'][team]['players'][player]['id'], match_queue_id);
                            if (playerStats.length === 0) {

                                // default MMR values if player does not have any
                                await database.mmrUpdateMMRPlayer(matchDetails['teams'][team]['players'][player]['id'], match_queue_id, 300, 100, false);
                                playerStats = await database.mmrPlayerLookup(matchDetails['teams'][team]['players'][player]['id'], match_queue_id);
                            }

                            mmrValues[teamIndex][playerIndex] = rating({
                                mu: parseFloat(playerStats['mu']),
                                sigma: parseFloat(playerStats['sigma'])
                            })
                            playerIndex += 1
                        }

                        teamIndex += 1
                    }

                    try {
                        let newRanksTemp = rate(
                            mmrValues,
                            {rank: placementOrder}
                        )

                        for (const team in teamAndPlayers) {
                            for (const player in teamAndPlayers[team]) {
                                let time = new Date(matchDetails['match_datetime'])
                                let offSet = ((new Date(matchDetails['match_datetime']).getTimezoneOffset())*-60)

                                let insertedRow = await database.mmrUpdateMMRPlayerChanges(
                                    teamAndPlayers[team][player][0],
                                    match_queue_id,
                                    matches[match]['match_id'],
                                    newRanksTemp[team][player]['sigma'] - mmrValues[team][player]['sigma'],
                                    newRanksTemp[team][player]['mu'] - mmrValues[team][player]['mu'],
                                    newRanksTemp[team][player]['sigma'],
                                    newRanksTemp[team][player]['mu'],
                                    Math.floor(time.getTime()/1000)+offSet
                                )
                                if (insertedRow === 1) {
                                    database.mmrUpdateMMRPlayer(
                                        teamAndPlayers[team][player][0],
                                        match_queue_id,
                                        newRanksTemp[team][player]['mu'],
                                        newRanksTemp[team][player]['sigma']
                                    );
                                    logger.error(`mmrUpdateMMRPlayer:::success::${matches[match]['match_id']}::${teamAndPlayers[team][player][0]}`)
                                } else {
                                    logger.error(`mmrUpdateMMRPlayer:::error::${matches[match]['match_id']}::${teamAndPlayers[team][player][0]}`)
                                }
                            }
                        }

                        logger.error(`realmAddMatchDetails:::${matches[match]['match_id']}::RET_MSG:${matchDetails['ret_msg']}`)
                        database.realmAddMatchDetails(JSON.stringify(matchDetails))
                        database.realmAddProcessedMatch(matches[match]['match_id'], 'SUCCESS')
                        database.realmDeleteMatchToProcess(matches[match]['match_id'])
                    } catch (error) {
                        logger.error(`MMR:::Error::${error}:${matches[match]['match_id']}`)
                        // expected output: TypeError: some q id's don't work from realm api :(
                    }


                } else {
                    if (matchDetails['ret_msg'] === `No Match Details:${matches[match]['match_id']}`) {
                        logger.error(`Match:::RET_MSG_ERROR::${matches[match]['match_id']}::${JSON.stringify(matchDetails)}`)
                        database.realmAddProcessedMatch(matches[match]['match_id'], 'ERROR:NODETAILS')
                        database.realmDeleteMatchToProcess(matches[match]['match_id'])
                    } else {
                        logger.error(`Match:::RET_MSG_ERROR::${matches[match]['match_id']}::${JSON.stringify(matchDetails)}`)
                    }
                }
            })

        

                

            } 
        })
    },
    3000 // polls every 3 seconds )
);


