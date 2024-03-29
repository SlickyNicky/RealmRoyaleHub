let dayjs = require('dayjs')
let utc = require('dayjs/plugin/utc');
dayjs.extend(utc);




const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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
                        if(value[gameVals][teams] === null) {
                            continue;
                        }
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
        return totalGameDetails
    } else {
        let idStored = []
        for (const gameVals in totalGameDetails) {
            if (gameVals === 'teams') {
                let index = 0
                for (const teams in totalGameDetails[gameVals]) {
                    if(totalGameDetails[gameVals][teams] === null) {
                        continue;
                    }
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
        totalGameDetails['teams'] = totalGameDetails['teams'].filter(n => n !== null)
        totalGameDetails['teams'] = totalGameDetails['teams'].filter(n => n.length != 0)
        return totalGameDetails
    }
}

async function insertFormattedGameMatches(gameMatch) {
    gameMatch = fixRealmGameOutput(gameMatch,false)
    database.insertNewMatchInformationOverview(gameMatch);
    console.log(`Match ID Processing... ${gameMatch['match_id']}`)

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
                    if(playerInfo['id'] !== gameMatch['teams'][team][players][player]['id']) {
                        console.log(`Expected ID: ${gameMatch['teams'][team][players][player]['id']} actual : ${playerInfo['id']}`)
                        console.log(`Player Info Entire ${JSON.stringify(playerInfo)}`)
                        console.log('----------')
                        console.log('----------')
                        console.log('----------')
                        console.log('Trying Again...')
                        playerInfo = await database.callApi(
                            'GetPlayer',
                            true,
                            `GetPlayer::${gameMatch['teams'][team][players][player]['id']}`,
                            gameMatch['teams'][team][players][player]['id'],
                            'hirez'
                        )
                        if(playerInfo['id'] !== gameMatch['teams'][team][players][player]['id']) {
                            console.log(`Expected ID2: ${gameMatch['teams'][team][players][player]['id']} actual : ${playerInfo['id']}`)
                            console.log(`Player Info Entire2 ${JSON.stringify(playerInfo)}`)
                            process.exit('-1')

                        }
                        console.log('----------')
                        console.log('----------')
                        console.log('----------')
                        console.log('----------')


                    }
                    database.insertNewPlayerInformation(playerInfo)
                    console.log(gameMatch['teams'][team][players][player]['id'])
                }

                database.insertNewMatchInformationPerPerson(
                    gameMatch['teams'][team][players][player],
                    gameMatch['match_id'],
                    gameMatch['teams'][team][players][player]['id'],
                    gameMatch['teams'][team]
                );
            }

        }
    }
    console.log(`Match ID Finished Processing: ${gameMatch['match_id']}`)

}


const fs = require('fs');


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

const split2 = require('split2');
const { objOf } = require('ramda');



// var stringTemp = fs.readFileSync("/tmp/test.txt").toString('utf-8');;

function mysql_real_escape_string (str) {
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


const sleep = ms => new Promise(r => setTimeout(r, ms));




let finalString = []



let testString = [12,9,7,5,4,3,3,2,2,2,1,1,1,1,11,1,1,1,11,1,1,1,1,1,1,1,1,1,1]

function ordinal_suffix_of(i) {
    var j = i % 10,
        k = i % 100;
    if (j == 1 && k != 11) {
        return i + "st";
    }
    if (j == 2 && k != 12) {
        return i + "nd";
    }
    if (j == 3 && k != 13) {
        return i + "rd";
    }
    return i + "th";
}



let  grouped = testString.reduce((r, v, i, a) => {
    if (v === a[i - 1]) {
        r[r.length - 1].push(v);
    } else {
        r.push(v === a[i + 1] ? [v] : v);
    }
    return r;
}, []);



async function getPlayerID(searchInput) {
    let playerId = 0
    let players = await database.callApi(
        "SearchPlayers",
        true,
        'SearchPlayers',
        searchInput
    )

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

const { rate ,rating } = require('openskill')
const {bradleyTerryFull}  =  require('openskill')


const a1 = b1 = c1 = d1 = rating()

let databaseConfig = require('./realmRoyaleDatabase_v2.js');
 let database = new databaseConfig()




let queueValues = {
    474: 'Solo\'s',
    475: 'Trio\'s', // who cares about consistency right realm? should be duo kekw thanks reforged
    476: 'Squad\'s',
    10188: 'Solo Custom\'s',
    10189: 'Duo Custom\'s',
    10205: 'Trio Custom\'s',
    10190: 'Squad Custom\'s'
}




function between(x, min, max) {
    return x >= min && x < max;
}

function convertMMRToRank(mmrValue) {
    if (between(mmrValue, -9999999999, -300)) {
        return "Rookie :)"
    } else if (between(mmrValue, -300, 0)) {
        return "Bronze I"
    } else if (between(mmrValue, 0, 300)) {
        return "Bronze II"
    } else if (between(mmrValue, 300, 600)) {
        return "Bronze III"
    } else if (between(mmrValue, 600, 750)) {
        return "Silver I"
    } else if (between(mmrValue, 750, 900)) {
        return "Silver II"
    } else if (between(mmrValue, 900, 1050)) {
        return "Silver III"
    } else if (between(mmrValue, 1050, 1200)) {
        return "Gold I"
    } else if (between(mmrValue, 1200, 1350)) {
        return "Gold II"
    } else if (between(mmrValue, 1350, 1500)) {
        return "Gold III"
    } else if (between(mmrValue, 1500, 1650)) {
        return "Ruby I"
    } else if (between(mmrValue, 1650, 1800)) {
        return "Ruby II"
    } else if (between(mmrValue, 1800, 1950)) {
        return "Ruby III"
    } else if (between(mmrValue, 1950, 2150)) {
        return "Platinum I"
    } else if (between(mmrValue, 2150, 2350)) {
        return "Platinum II"
    } else if (between(mmrValue, 2350, 2550)) {
        return "Platinum III"
    } else if (between(mmrValue, 2550, 2850)) {
        return "Diamond I"
    } else if (between(mmrValue, 2850, 3150)) {
        return "Diamond II"
    } else if (between(mmrValue, 3150, 3450)) {
        return "Diamond III"
    } else if (between(mmrValue, 3450, 3900)) {
        return "Champion I"
    } else if (between(mmrValue, 4350, 4800)) {
        return "Champion II"
    } else if (between(mmrValue, 4800, 5250)) {
        return "Champion III"
    }
}

async function getPlayerID(searchInput) {
    let playerId = 0
    let players = await database.callApi(
        "SearchPlayers",
        true,
        'SearchPlayers',
        searchInput
    )

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

function sortTopPlayers(players) {
    let result = {};
    for (const player in players) {
        if (result[queueValues[players[player]['queuetypeid']]] === undefined) {
            result[queueValues[players[player]['queuetypeid']]] = []
        }
        result[queueValues[players[player]['queuetypeid']]].push([
            {'score': convertMMRToRank(players[player]['mmrrankingnumber'])},
            {'profileLink': `https://realm.slickynicky.com/stats/${players[player]['playerid']}`}
        ])
    }
    return result
}

function formatPlayerMMR(player) {
    for (const playerDetails in player) {
        player[playerDetails]['queuetypeid'] = queueValues[player[playerDetails]['queuetypeid']]
        player[playerDetails]['mmrrankingnumber'] = convertMMRToRank(player[playerDetails]['mmrrankingnumber'])
    }
    return player
}


const queueIDsToGrab = ['474', '475', '476','482', '10188', '10189', '10205', '10190']

let  JSONStream = require('JSONStream')


function checkForDuplicates(jsonArray) {
    const valuesAlreadySeen = [];
    for (let i = 0; i < jsonArray.length; i++) {
      const value = jsonArray[i].id;
      if (valuesAlreadySeen.includes(value)) {
        return true; // duplicate found
      }
      valuesAlreadySeen.push(value);
    }
    return false; // no duplicates found
  }

function placementPoints(place) {
    if(place === 1) {
        return 30
    } else if(place === 2) {
        return 25
    } else if(place === 3) {
        return 21
    } else if(place === 4) {
        return 18
    } else if(place === 5) {
        return 16
    } else if(place >=6 & place <= 10) {
        return 14
    } else if(place >= 11 & place <= 15) {
        return 10
    } else if(place >= 16 & place <= 25) {
        return 7
    } else if(place >= 26 & place <= 40) {
        return 5
    } else if(place >= 41 & place <= 60) {
        return 3
    } else if(place >= 61 & place <= 80) {
        return 2
    } else if(place >= 81) {
        return 1
    }
}


const processMatch = async (matchID) => {
    const matchDetails = await database.callApi('GetMatchDetails', `GetMatchDetails::${matchID}`, matchID);
    console.log(`start_process:::${matchID}::${new Date().toLocaleString()}:RET_MSG:${matchDetails.ret_msg}`);

    if (matchDetails.ret_msg !== null) return;

    const fixedMatchDetails = fixRealmGameOutput(matchDetails);
    await insertFormattedGameMatches(fixedMatchDetails);

    const {  teams } = fixedMatchDetails;
    const killsAndPlacementPoints = [], teamAndPlayers = [], mmrValues = [];

    for (const team of teams) {
        const teamIdx = teamAndPlayers.length;
        teamAndPlayers[teamIdx] = [];
        mmrValues[teamIdx] = [];
        console.log(team.placement)
        killsAndPlacementPoints[teamIdx] = 0;
        killsAndPlacementPoints[teamIdx] += (placementPoints(team.placement));
        const playerPromises = team.players.map(async (player) => {
          const playerIdx = teamAndPlayers[teamIdx].length;
          teamAndPlayers[teamIdx][playerIdx] = [player.id];
          killsAndPlacementPoints[teamIdx] += (player.kills_bot*3);
          let playerStats = await database.mmrPlayerLookup(player.id, fixedMatchDetails['match_queue_id']);
          
          if (playerStats.length === 0) {
            await database.mmrUpdateMMRPlayer(player.id, match_queue_id, 300, 100, false);
            playerStats = await database.mmrPlayerLookup(player.id, fixedMatchDetails['match_queue_id']);
          }
    
          mmrValues[teamIdx][playerIdx] = rating({ mu: parseFloat(playerStats.mu), sigma: parseFloat(playerStats.sigma) });
        });
    
        await Promise.all(playerPromises);
      }

    // console.log(mmrValues)

    try {
    console.log(mmrValues)
    console.log('______________')  
    console.log(killsAndPlacementPoints)
    console.log('______________')  

    const newRanksTemp = rate(mmrValues, { score: killsAndPlacementPoints,  tau: 0.2});

    console.log((newRanksTemp))


    teamAndPlayers.forEach((team, teamIdx) => {
    team.forEach(async (player, playerIdx) => {
        const playerID = player[0];
        const newRank = newRanksTemp[teamIdx][playerIdx];
        const oldRank = mmrValues[teamIdx][playerIdx];
        const matchTime = new Date(matchDetails.match_datetime);
        const offSet = matchTime.getTimezoneOffset() * -60;

    //   const insertedRow = await database.mmrUpdateMMRPlayerChanges(
    //     playerID, match_queue_id, matchID,
    //     newRank.sigma - oldRank.sigma,
    //     newRank.mu - oldRank.mu,
    //     newRank.sigma, newRank.mu,
    //     Math.floor(matchTime.getTime() / 1000) + offSet
    //   );

    //   if (insertedRow === 1) {
    //     database.mmrUpdateMMRPlayer(playerID, match_queue_id, newRank.mu, newRank.sigma);
    //     logger.error(`mmrUpdateMMRPlayer:::success::${matchID}::${playerID}`);
    //   } else {
    //     logger.error(`mmrUpdateMMRPlayer:::error::${matchID}::${playerID}`);
    //   }
    });
    });

    console.log(`realmAddMatchDetails:::${matchID}::RET_MSG:${matchDetails.ret_msg}`);
//   database.realmAddMatchDetails(JSON.stringify(matchDetails));
//   database.realmAddProcessedMatch(matchID, 'SUCCESS');
//   database.realmDeleteMatchToProcess(matchID);
    } catch (error) {
        console.log(`MMR:::Error::${error}:${matchID}`);
    }
}

//   matches.forEach(match => processMatch(match.match_id));
  



setTimeout(async () =>{

    // console.log(await database.callApi('getmatchdetails','getmatchdetails',63968632))

    let total = await database.getCrossPlayPercentageByRegion(3600,474,'NA')
    console.log((total[0]/total[1])*100)


    // processMatch(63700142)
        // let startTime = performance.now()
        // console.log(await database.sameInputPlayersOverTime_v2('1 month','week', '3 days 12 hours',474))
        // let endTime = performance.now()
        // console.log(`Call to doSomething1 took ${endTime - startTime} milliseconds`)
//     var startTime = performance.now()
    // console.log(await database.callApi('GetPlayer',true,'GetPlayer',7572939,'HIREZ'))


        // let string = '123123123123'

        // console.log(((await database.getMatchInformation('1'))[0]).length === 0)
// let startTime = performance.now()
//     let [
//     temp1,temp2,temp3,temp4,temp5,temp6,temp7,temp8,temp9,temp10,temp11,temp12,temp13,temp14,temp15,temp16,temp17,temp18,temp19,temp20
// ] = await Promise.all([

//     database.graphTestingV1('year','month'),
//     database.graphTestingV1('months','weeks'),
//     database.graphTestingV1('weeks','days'),
//     database.graphTestingV1('days','hours'),


// ])
// var endTime = performance.now()
// console.log(`Call to doSomething1 took ${endTime - startTime} milliseconds`)
    // console.log(await database.callApi("getplayer",true,"getplayer",23855569,'hirez'))
    // console.log(await database.callApi('getdataused',true,'getdataused'))
    // for(queueID in queueIDsToGrab ){
    // database.callApi(
    //         'getdataused',
    //         `getdataused`
    //     ).then(async (matches) => {
    //         console.log(matches)


    //     })
    // let players = await database.callApi_v2(
    //     "SearchPlayers",
    //     'SearchPlayers',
    //     '1.'
    // )
    // let players1 = await database.callApi_v2(
    //     "SearchPlayers",
    //     'SearchPlayers',
    //     'asdf'
    // )
    // console.log(players1)
    // console.log(players)
    // for(player in players) {
    //     if(players[player]['name'] === '1.') {
    //         console.log('asdfasdfafghgweafsz')
    //     }
    // }
    // }

    
    // console.log('done')

    //         for (const match in matches) {
    //             if (matches[match]['active_flag'] == 'n') {
    //                 if(matches[match]['ret_msg'] === null) {
    //                     if(Object.keys(await database.realmGetProcessedMatch(matches[match]['match'])).length === 0) {
    //                         database.realmAddMatchToProcess(matches[match]['active_flag'], '', matches[match]['match'])
    //                     }
    //                 } else {
    //                     if(Object.keys(await database.realmGetProcessedMatch(matches[match]['match'])).length === 0) {
    //                         database.realmAddMatchToProcess(matches[match]['active_flag'], matches[match]['ret_msg'], matches[match]['match'])
    //                     }
    //                 }
    //              }
    //         }
    //     })
    //     console.log('done....for now')
    // }
    // console.log('done')
    // console.log(await database.callApi('getdataused',true,'getdataused'))

    // console.log(await database.callApi('GetPlayer',true,'GetPlayer','asdf',-1))
    // console.log(await database.callApi('SearchPlayers',true,'SearchPlayers','Goon SlickyNicky'))
    // console.log(await database.getMatchInformation(62642922))
 
    // console.log((await database.getMatchInformation(62642922))[0])

    // let resultArr = []


    // var readStream = fs.createReadStream('/tmp/tmpfiles_1600k.json')

    // readStream
    // .pipe(split2())
    // .on('data', function (line) {
    //         resultArr.push(line)      
    // }).on('end',async () => {

    //     // everything below is magical and should be looked upon with gratitude

    //     for(match in resultArr) {
    //         try {
    //             resultArr[match] = JSON.parse(resultArr[match])
    //         } catch(err) {
    //                 resultArr[match] = resultArr[match].replaceAll('\\\\"', '');
    //                 try {
    //                     resultArr[match] = JSON.parse(resultArr[match])
    //                 } catch(err) {
    //                     resultArr[match] = resultArr[match].replaceAll('\\\\"', '"');
    //                     resultArr[match] = resultArr[match].replaceAll('\\\\,', '",');

    //                     resultArr[match] = JSON.parse(resultArr[match])
    //                 }
    
    //         }
    //     }
    //     console.log('Formatting Done...')
    //     for(let index = 0; index<resultArr.length;index++) {
    //         insertFormattedGameMatches(resultArr[index])
    //         if(index % 500 === 0) {
    //             console.log(`Game Number Processed: ${index}`)
    //             let apiLimits = await database.callApi("GetDataUsed",true,"GetDataUsed");
    //             console.log(`API Limites: ${JSON.stringify(apiLimits)}`)
    //         }
    //         await sleep(75)
            
    //     }
    // })
    

    // //     console.log(counter)
    


    } // polls every 30 seconds from realm api (2*2*7*60->1680*24->40320 api pulls from this every day at a minimum)
);