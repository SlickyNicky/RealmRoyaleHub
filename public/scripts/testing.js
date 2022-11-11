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


function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min); // The maximum is inclusive and the minimum is inclusive
}
const queueIDsToGrab = ['474', '475', '476', '10188', '10189', '10205', '10190']

playerId = {}

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


setInterval(async function () {

        database.callApi(
            'GetMatchIDsByQueue', 
            true,
            'GetMatchIDsByQueue',
            474,
            dayjs.utc().format('YYYYMMDD'),
            dayjs.utc().format('HH')
        ).then(async matches => {
            let count = 0;

            for (const match in matches) {
                let matchID = matches[match]['match'];

                let result = await fixRealmGameOutput(
                    database.callApi(
                        'GetMatchDetails',
                        true,
                        'GetMatchDetails',
                        matchID
                    ), false)
                for (const team in result['teams']) {
                    count += result['teams'][team]['players'].length

                }
            }
            console.log(count)
        })
    }, 10000 // polls every 1/2 seconds )
);

