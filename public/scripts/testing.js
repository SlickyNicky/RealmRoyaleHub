let dayjs = require('dayjs')
let utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// solo duo(trio in reality) squad custom solo, duo, trio, squad

let databaseConfig = require('./realmRoyaleDatabase.js');
let database = new databaseConfig()
// const queueIDsToGrab = ['474', '475', '476', '482', '10188', '10189', '10205', '10190']

async function getPlayerID(searchInput) {
    let playerId = 0
    let players = await database.callApi(
        "SearchPlayers",
        true,
        'SearchPlayers',
        searchInput
    )
    console.log(players)

    for (const player in players) {
        if (players[player]['name'] === searchInput) {
            playerId = players[player]['id']
            break
        }
    }
    if (playerId === 0) {
        playerId = players[0]
        try {
            // this solves the case of id: 123412 name: 123412414151 and the name profile being pulled back....design decision

            if (playerId['name'] !== `${searchInput}` && playerId['name'].toLowerCase() !== `${searchInput.toLowerCase()}`) {
                playerId = searchInput
            } else {
                playerId = playerId['id']
            }
        } catch (e) {
            playerId = searchInput
        }
    }
    return playerId
}

const mysql = require('mysql2/promise');

let config = {
    host: 'localhost',
    user: process.env.mysqlUser,
    password: process.env.mysqlPassword,
    database: 'realm_royale',
    charset: 'UTF8MB4_0900_AI_CI',
    connectionLimit: 60,
}
var pool = mysql.createPool(config);

async function testConnection() {
    return new Promise(async (resolve, reject) => {
        let query =
            `
                    select * from apigrabbingstats
                    `

        await pool.query(query)
            .then(async ([results]) => {
                    return resolve(results)
                }
            );

    });
}

function fixRealmGameOutput(totalGameDetails, anArrayOfGameDetail = false) {
    if (anArrayOfGameDetail) {
        for (const [key, value] of totalGameDetails.entries()) {
            let idStored = []
            for (const gameVals in value) {
                if (gameVals === 'teams') {
                    let index = 0
                    for (const teams in value[gameVals]) {
                        if (idStored[value[gameVals][teams]['id']] === undefined) {
                            idStored[value[gameVals][teams]['id']] = {index: index}
                        } else {
                            for (const player in value[gameVals][teams]['players']) {
                                totalGameDetails.get(key)[gameVals][idStored[value[gameVals][teams]['id']]['index']]['players'].push(
                                    value[gameVals][teams]['players'][player])
                            }
                            delete totalGameDetails.get(key)[gameVals][index]
                        }
                        index += 1
                    }
                }
            }
        }

        // console.log(totalGameDetails)
        return totalGameDetails
    } else {
        let idStored = []
        for (const gameVals in totalGameDetails) {
            if (gameVals === 'teams') {
                let index = 0
                for (const teams in totalGameDetails[gameVals]) {

                    if (idStored[totalGameDetails[gameVals][teams]['id']] === undefined) {
                        idStored[totalGameDetails[gameVals][teams]['id']] = {index: index}
                    } else {
                        for (const player in totalGameDetails[gameVals][teams]['players']) {
                            totalGameDetails[gameVals][teams]['players'][player]['duration_secs'] = totalGameDetails[gameVals][idStored[totalGameDetails[gameVals][teams]['id']]['index']]['players'][0]['duration_secs']
                            totalGameDetails[gameVals][idStored[totalGameDetails[gameVals][teams]['id']]['index']]['players'].push(
                                totalGameDetails[gameVals][teams]['players'][player])
                        }
                        delete totalGameDetails[gameVals][index]
                    }
                    index += 1
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

                if((await database.getStoredPlayerInformation(gameMatch['teams'][team][players][player]['id'])).length === 0) {
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


const fs = require('fs');

const queueIDsToGrab = ['474', '475', '476', '482', '10188', '10189', '10205', '10190']

async function writeFileWithDictData(dict,fileName) {
    let flatten = "Player IDs:\n"
    for(const temp in dict) {
        flatten += 'https://realm.slickynicky.com/stats/'+(dict[temp]['players'] + "\n")
    }

    fs.writeFileSync(`${fileName}.txt`, flatten, function(err) {
        if(err) {
            return console.log(err);
        }
    });
    return true
}


setTimeout(async function () {
    // let data = (await(database.getPlayers(604800)))
    // // console.log(data)
    // await writeFileWithDictData(data,'test432')

    database.callApi(
        'GetDataUsed',
        true,
        `GetDataUsed`,
    ).then(async (matches) => {
        console.log(matches)
    })
    // let bestPlayers = await database.mmrGetTopPlayersTemp()
    // for(const queue in bestPlayers) {
    //     console.log('==========')
    //     for(const players in bestPlayers[queue]) {
    //         console.log('-------')
    //         console.log(bestPlayers[queue][players])
    //         console.log('-------')
    //     }
    //     console.log('==========')
    //
    // }
    console.log(await database.mmrGetTopPlayersTemp())
    console.log('----')
    console.log('----')
    console.log('----')
    console.log(await database.mmrGetTopPlayersTemp_v2())
        //
        //     let matches = await database.callApi(
        //         'GetMatchIDsByQueue',
        //         true,
        //         `GetMatchIDsByQueue:::SpecificQ::474`,
        //         475,
        //         dayjs.utc().format('YYYYMMDD'),
        //         -1
        //     )
        //     // console.log(matches)
        // //
        //     for (const match in matches) {
        //         let results = await database.realmGetProcessedMatchOverview(matches[match]['match'])
        //         if (results.length === 0) {
        //             if (matches[match]['active_flag'] == 'n') {
        //
        //                 let matchDetails = await database.callApi(
        //                     'GetMatchDetails',
        //                     true,
        //                     `GetMatchDetails::${matches[match]['match_id']}`,
        //                     matches[match]['match'])
        //
        //                 await insertFormattedGameMatches(fixRealmGameOutput(matchDetails))
        //             }
        //         }
        //
        //     }
        //     console.log('done!')
        // // }
        // console.log('Done!')



    // '2022-09-24T00:49:01.653'
        // let test = '2023-01-11T01:46:59.433'
        // let time = new Date(test)
        // Math.floor(time.getTime()/1000)

        // console.log('--------------------------')
        // let matches = await database.getHighestKills()
        // let highestKills = 0
        // let queueID = ''
        // for(let match in matches) {
        //     for(let team in matches[match]['matchData']['teams']) {
        //         let teamKills = 0
        //         for(const player in  matches[match]['matchData']['teams'][team]['players']) {
        //             teamKills += matches[match]['matchData']['teams'][team]['players'][player]['kills_player']
        //         }
        //         if(teamKills > highestKills) {
        //             highestKills = teamKills
        //             queueID = matches[match]['matchData']['match_id']
        //         }
        //     }
        // }
        // console.log(highestKills)
        // console.log(queueID)
        // console.log('--------------------------')


        //  id: 5494864,
        //   name: 'Hingle McCringleberry',
        //   level: 1,
        //   deaths: 0,
        //   assists: 0,
        //   class_id: 2285,
        //   earned_xp: 1239,
        //   kills_bot: 12,
        //   class_name: 'Warrior',
        //   damage_taken: 5211,
        //   kills_player: 12,
        //   damage_player: 35146,
        //   duration_secs: 986,
        //   earned_tokens: 0,
        //   healing_player: 0,
        //   damage_mitigated: 0,
        //   dropped_out_flag: 0,
        //   killing_spree_max: 0,
        //   mines_wards_placed: 0,
        //   damage_done_in_hand: 0,
        //   healing_player_self: 2027
    } // polls every 30 seconds from realm api (2*2*7*60->1680*24->40320 api pulls from this every day at a minimum)
);