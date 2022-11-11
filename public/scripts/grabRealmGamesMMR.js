// first of many "microservice" type files
var Promise = require("bluebird");

let mysql = require('mysql2');
let dayjs = require('dayjs')
let utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

// solo duo(trio in reality) squad custom solo, duo, trio, squad

let databaseConfig = require('./realmRoyaleDatabase.js');
let database = new databaseConfig()

let {rate, ordinal, rating} = require('openskill')

const winston = require('winston');

const logger = winston.createLogger({
    maxsize:'10000000',
    maxFiles:'1000',
    timestamp:true,
    level: 'info',
    format: winston.format.json(),
    defaultMeta: { service: 'grabRealmGames' },
    transports: [
        new winston.transports.File({ filename: __dirname+'/combined.json' })
    ],
});


setInterval(async function () {
        const queueIDsToGrab = ['474', '475', '476', '10188', '10189', '10205', '10190']

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
                    let active_flag = matches[match]['active_flag']
                    let matchid = matches[match]['match']
                    let ret_msg = matches[match]['ret_msg']
                    if (active_flag == 'n') {
                        database.realmAddMatchToProcess(active_flag, ret_msg, matchid)
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
            ).then(async (matches) => {
                for (const match in matches) {
                    let active_flag = matches[match]['active_flag']
                    let matchid = matches[match]['match']
                    let ret_msg = matches[match]['ret_msg']
                    if (active_flag == 'n') {
                        database.realmAddMatchToProcess(active_flag, ret_msg, matchid)
                    }
                }
            })
        }

    }, 30000 // polls every 30 seconds from realm api (2*2*7*60->1680*24->40320 api pulls from this every day at a minimum)
);


