let mysql = require('mysql2');
let dayjs = require('dayjs')
let utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

// solo duo(trio in reality) squad custom solo, duo, trio, squad

let databaseConfig = require('./realmRoyaleDatabase.js');
let database = new databaseConfig()


// For todays date;
Date.prototype.today = function () {
    return ((this.getDate() < 10)?"0":"") + this.getDate() +"/"+(((this.getMonth()+1) < 10)?"0":"") + (this.getMonth()+1) +"/"+ this.getFullYear();
}

// For the time now
Date.prototype.timeNow = function () {
    return ((this.getHours() < 10)?"0":"") + this.getHours() +":"+ ((this.getMinutes() < 10)?"0":"") + this.getMinutes() +":"+ ((this.getSeconds() < 10)?"0":"") + this.getSeconds();
}

let points = [15,8,12,3,14,5,1,2,3,11]

let test = {}
let maxLength = 3

function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); // The maximum is inclusive and the minimum is inclusive
}

setInterval(async function () {


let insertedRow = await database.mmrUpdateMMRPlayerChanges(
    'asdffdsa',
    "-1",
    "-2",
    0,
    0,
    0,
    0,
)
    if(insertedRow === 1) {
        console.log('updated mmr')
    } else {
        console.log('no update :(')
    }

    }, 2500 // polls every 1/2 seconds )
);

// logger.error('Hello again distributed logs');


// setInterval(async function () {
//
//         // database.realmGetMatchesToProcess().then(async (matches) => {
//         //     for (const match in matches) {
//         //         database.realmGetProcessedMatch(matches[match]['match_id']).then(results => {
//         //             if (results.length === 0) {
//         //                 console.log(matches[match]['match_id'])
//         //                 database.callApi(
//         //                     'GetMatchDetails',
//         //                     true,
//         //                     matches[match]['match_id']
//         //                 ).then(matchDetails => {
//         //                     let duration_secs = matchDetails['duration_secs']
//         //                     let match_datetime = matchDetails['match_datetime']
//         //                     let match_id = matchDetails['match_id'] // actual id of game 12432234,124311432,etc...
//         //                     let match_queue_id = matchDetails['match_queue_id'] // 474->solos,475->duos,476->squads,etc...
//         //                     let match_queue_name = matchDetails['match_queue_name']
//         //                     let region = matchDetails['region']
//         //                     let ret_msg = matchDetails['ret_msg']
//         //                     let teams = JSON.stringify(matchDetails['teams'])
//         //                     database.realmAddMatchDetails(
//         //                         duration_secs,
//         //                         match_datetime,
//         //                         match_id,
//         //                         match_queue_id,
//         //                         match_queue_name,
//         //                         region,
//         //                         ret_msg,
//         //                         teams
//         //                     ).then(async (resuls) => {
//         //                         database.realmAddProcessedMatch(matches[match]['match_id'])
//         //                         database.realmDeleteMatchToProcess(matches[match]['match_id'])
//         //
//         //
//         //                         let placementOrder = []
//         //                         let teamAndPlayers = []
//         //                         let teamIndex = 0;
//         //                         let mmrValues = []
//         //
//         //                         for (const team in matchDetails['teams']) {
//         //                             teamAndPlayers[teamIndex] = []
//         //                             mmrValues[teamIndex] = []
//         //                             placementOrder.push(matchDetails['teams'][team]['placement'])
//         //                             let playerIndex = 0
//         //                             for (const player in matchDetails['teams'][team]['players']) {
//         //                                 teamAndPlayers[teamIndex][playerIndex] = []
//         //                                 mmrValues[teamIndex][playerIndex] = ''
//         //                                 teamAndPlayers[teamIndex][playerIndex][0] = matchDetails['teams'][team]['players'][player]['id']
//         //
//         //
//         //                                 let playerStats = await database.mmrPlayerLookup(matchDetails['teams'][team]['players'][player]['id'], match_queue_id);
//         //                                 if (playerStats.length === 0) {
//         //
//         //                                     await database.mmrUpdateMMRPlayer(matchDetails['teams'][team]['players'][player]['id'], match_queue_id, 300, 100, false);
//         //                                     playerStats = await database.mmrPlayerLookup(matchDetails['teams'][team]['players'][player]['id'], match_queue_id);
//         //                                 }
//         //
//         //                                 mmrValues[teamIndex][playerIndex] = rating({
//         //                                     mu: parseFloat(playerStats['mu']),
//         //                                     sigma: parseFloat(playerStats['sigma'])
//         //                                 })
//         //                                 playerIndex += 1
//         //                             }
//         //
//         //                             teamIndex += 1
//         //                         }
//         //                         try {
//         //                             let newRanksTemp = rate(
//         //                                 mmrValues,
//         //                                 {rank: placementOrder}
//         //                             )
//         //
//         //                             for (const team in teamAndPlayers) {
//         //                                 for (const player in teamAndPlayers[team]) {
//         //                                     database.mmrUpdateMMRPlayerChanges(
//         //                                         teamAndPlayers[team][player][0],
//         //                                         match_queue_id,
//         //                                         matches[match]['match'],
//         //                                         newRanksTemp[team][player]['sigma'] - mmrValues[team][player]['sigma'],
//         //                                         newRanksTemp[team][player]['mu'] - mmrValues[team][player]['mu'],
//         //                                         newRanksTemp[team][player]['sigma'],
//         //                                         newRanksTemp[team][player]['mu'],
//         //                                     )
//         //                                     database.mmrUpdateMMRPlayer(
//         //                                         teamAndPlayers[team][player][0],
//         //                                         match_queue_id,
//         //                                         newRanksTemp[team][player]['mu'],
//         //                                         newRanksTemp[team][player]['sigma']
//         //                                     );
//         //                                 }
//         //                             }
//         //                         } catch (error) {
//         //                             console.error(matches[match]['match'])
//         //                             // expected output: TypeError: some q id's don't work from realm api :(
//         //                         }
//         //
//         //                     })
//         //
//         //                 })
//         //             } else {
//         //                 database.realmDeleteMatchToProcess(matches[match]['match_id'])
//         //             }
//         //         })
//         //
//         //     }
//         // })
//
//     }, 30 // polls every 1/2 seconds )
// );


