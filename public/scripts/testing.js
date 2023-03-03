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
                        process.exit('-1')
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

setTimeout(async () =>{
    for(const queueID in queueIDsToGrab) {
        database.callApi(
                'GetMatchIDsByQueue',
                true,
                `GetMatchIDsByQueue:::SpecificQ::${queueIDsToGrab[queueID]}`,
                queueIDsToGrab[queueID],
                dayjs.utc().subtract(12, 'hour').format('YYYYMMDD'),
                dayjs.utc().subtract(12, 'hour').format('HH')
            ).then( (matches) => {
            for (const match in matches) {
                if (matches[match]['active_flag'] == 'n') {
                    if(matches[match]['ret_msg'] === null) {
                        database.realmAddMatchToProcess(matches[match]['active_flag'], '', matches[match]['match'])
                    } else {
                        database.realmAddMatchToProcess(matches[match]['active_flag'], matches[match]['ret_msg'], matches[match]['match'])
                    }                    }
            }
        })
    }
    // console.log(await database.getMatchInformation(62642922))

    // console.log((await database.getMatchInformation(62642922))[0])

    // let resultArr = []


    // var readStream = fs.createReadStream('/tmp/tmpfiles_1400k.json')

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