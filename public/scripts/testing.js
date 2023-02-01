let dayjs = require('dayjs')
let utc = require('dayjs/plugin/utc');
dayjs.extend(utc);


// solo duo(trio in reality) squad custom solo, duo, trio, squad

let databaseConfig = require('./realmRoyaleDatabase.js');
let database = new databaseConfig()
const queueIDsToGrab = ['474', '475', '476', '10188', '10189', '10205', '10190']
setTimeout(async function () {
    playerId = (await database.callApi("SearchPlayers", true, 'SearchPlayers', 'Milkybarcheesecake'))
    console.log(playerId)
    playerId = playerId[0]

    console.log(playerId)
    try {
        // this solves the case of id: 123412 name: 123412414151 and the name profile being pulled back....design decision


        if (playerId['name'] !== `${playerUrl}` && playerId['name'] !== `${playerUrl.toLowerCase()}`) {
            playerId = playerUrl
        } else {
            playerId = playerId['id']
        }
    } catch (e) {
        playerId = playerUrl
    }
    console.log(playerId)
    // for (const queueID in queueIDsToGrab) {
    //     database.callApi(
    //         'GetMatchIDsByQueue',
    //         true,
    //         `GetMatchIDsByQueue:::SpecificQ::${queueIDsToGrab[queueID]}`,
    //         queueIDsToGrab[queueID],
    //         dayjs.utc().format('YYYYMMDD'),
    //         -1
    //     ).then(async (matches) => {
    //         console.log(matches)
    //         for (const match in matches) {
    //             if (matches[match]['active_flag'] == 'n') {
    //                 await database.realmAddMatchToProcess(matches[match]['active_flag'], matches[match]['ret_msg'], matches[match]['match'])
    //             }
    //         }
    //     })
    // }


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