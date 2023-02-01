let databaseConfig = require('./realmRoyaleDatabase.js');
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

setInterval(async function () {

        database.realmGetMatchesToProcess().then(async matches => {

            for (const match in matches) {

                database.realmGetProcessedMatch(matches[match]['match_id']).then(async results => {

                    if (results.length === 0) {

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
                                            let insertedRow = await database.mmrUpdateMMRPlayerChanges(
                                                teamAndPlayers[team][player][0],
                                                match_queue_id,
                                                matches[match]['match_id'],
                                                newRanksTemp[team][player]['sigma'] - mmrValues[team][player]['sigma'],
                                                newRanksTemp[team][player]['mu'] - mmrValues[team][player]['mu'],
                                                newRanksTemp[team][player]['sigma'],
                                                newRanksTemp[team][player]['mu'],
                                                Math.floor(time.getTime()/1000)
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

                    } else {
                        database.realmDeleteMatchToProcess(matches[match]['match_id'])
                    }
                })

            }
        })
    },
    5000 // polls every 3 seconds )
);


