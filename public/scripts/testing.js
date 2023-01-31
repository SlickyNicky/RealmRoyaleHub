let dayjs = require('dayjs')
let utc = require('dayjs/plugin/utc');
dayjs.extend(utc);


// solo duo(trio in reality) squad custom solo, duo, trio, squad

let databaseConfig = require('./realmRoyaleDatabase.js');
let database = new databaseConfig()
// const queueIDsToGrab = ['474', '475', '476', '10188', '10189', '10205', '10190']

setTimeout(async function () {
    console.log('--------------------------')
    let matches = await database.getHighestKills()
    let highestKills = 0
    let queueID = ''
    for(let match in matches) {
        for(let team in matches[match]['matchData']['teams']) {
            let teamKills = 0
            for(const player in  matches[match]['matchData']['teams'][team]['players']) {
                teamKills += matches[match]['matchData']['teams'][team]['players'][player]['kills_player']
            }
            if(teamKills > highestKills) {
                highestKills = teamKills
                queueID = matches[match]['matchData']['match_id']
            }
        }
    }
    console.log(highestKills)
    console.log(queueID)
    console.log('--------------------------')


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
    }, 1000 // polls every 30 seconds from realm api (2*2*7*60->1680*24->40320 api pulls from this every day at a minimum)
);