// first of many "microservice" type files
var Promise = require("bluebird");

let mysql = require('mysql2');
let dayjs = require('dayjs')
let utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

// solo duo(trio in reality) squad custom solo, duo, trio, squad

let databaseConfig = require('./realmRoyaleDatabase_v2.js');
let database = new databaseConfig()

const queueIDsToGrab = ['474', '475', '476','482', '10188', '10189', '10205', '10190']

setInterval(async function () {

        for (const queueID in queueIDsToGrab) {
            database.callApi(
                'GetMatchIDsByQueue',
                true,
                `GetMatchIDsByQueue:::SpecificQ::${queueIDsToGrab[queueID]}`,
                queueIDsToGrab[queueID],
                dayjs.utc().format('YYYYMMDD'),
                dayjs.utc().format('HH')
            ).then(async (matches) => {
                for (const match in matches) {
                    if (matches[match]['active_flag'] == 'n') {
                        if(matches[match]['ret_msg'] === null) {
                            if(Object.keys(await database.realmGetProcessedMatch(matches[match]['match'])).length === 0) {
                                database.realmAddMatchToProcess(matches[match]['active_flag'], '', matches[match]['match'])
                            }
                        } else {
                            if(Object.keys(await database.realmGetProcessedMatch(matches[match]['match'])).length === 0) {
                                database.realmAddMatchToProcess(matches[match]['active_flag'], matches[match]['ret_msg'], matches[match]['match'])
                            }
                        }
                    }
                }
            })
            database.callApi(
                'GetMatchIDsByQueue',
                true,
                `GetMatchIDsByQueue:::SpecificQ::${queueIDsToGrab[queueID]}`,
                queueIDsToGrab[queueID],
                dayjs.utc().subtract(1, 'hour').format('YYYYMMDD'),
                dayjs.utc().subtract(1, 'hour').format('HH')
            ).then(async  (matches) => {
                for (const match in matches) {
                    if (matches[match]['active_flag'] == 'n') {
                        if(matches[match]['ret_msg'] === null) {
                            if(Object.keys(await database.realmGetProcessedMatch(matches[match]['match'])).length === 0) {
                                database.realmAddMatchToProcess(matches[match]['active_flag'], '', matches[match]['match'])
                            }
                        } else {
                            if(Object.keys(await database.realmGetProcessedMatch(matches[match]['match'])).length === 0) {
                                database.realmAddMatchToProcess(matches[match]['active_flag'], matches[match]['ret_msg'], matches[match]['match'])
                            }
                        }
                    }
                }
            })
        }
    }, 30000 // polls every 30 seconds from realm api (2*2*7*60->1680*24->40320 api pulls from this every day at a minimum)
);


