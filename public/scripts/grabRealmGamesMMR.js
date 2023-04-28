// first of many "microservice" type files
var Promise = require("bluebird");

let mysql = require('mysql2');
let dayjs = require('dayjs')
let utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

let databaseConfig = require('./realmRoyaleDatabase_v2.js');
let database = new databaseConfig()

// solo duo(trio in reality) squad custom solo, duo, trio, squad
const queueIDsToGrab = ['474', '475', '476', '482','477', '10188', '10189', '10205', '10190']

const winston = require('winston');
const logger = winston.createLogger({
    maxsize: '10000000',
    maxFiles: '1000',
    timestamp: true,
    level: 'info',
    format: winston.format.json(),
    defaultMeta: {service: 'grabbingMatches'},
    transports: [
        new winston.transports.File({filename: __dirname + '/logging/matchesToProcess_grabbing.json'})
    ],
})
const logger_early = winston.createLogger({
    maxsize: '10000000',
    maxFiles: '1000',
    timestamp: true,
    level: 'info',
    format: winston.format.json(),
    defaultMeta: {service: 'grabbingMatches'},
    transports: [
        new winston.transports.File({filename: __dirname + '/logging/matchesToProcess_grabbing_early.json'})
    ],
})

const processMatches = (matches) => {
    for (const match in matches) {
        const matchId = matches[match]['match'];
        const retMsg = matches[match]['ret_msg'] || ''
        if(retMsg === `No Match Details:${matchId}`) {
            continue
        } else {
            database.realmGetProcessedMatch(matchId).then((processedMatch) => {

                if (Object.keys(processedMatch).length === 0) {
                    if (matches[match]['active_flag'] === 'n') {
                        logger.error(`${matchId} added to finished_matches to process at ${new Date().toLocaleString()}`);
                        database.realmAddMatchToProcess(matches[match]['active_flag'], retMsg, matchId);

                    } else {     
                        logger_early.error(`${matchId} wtih active_flat of: ${matches[match]['active_flag']} added to finished_matches to process at ${new Date().toLocaleString()}`);
                        database.realmAddEarlyMatchToProcess(matches[match]['active_flag'], retMsg, matchId);
                    }
                } else {
                    logger.error(`${matchId} is already processed ${new Date().toLocaleString()}`);
                }
            })
        }
    }
}


setInterval(async function () {
    for (const queueID in queueIDsToGrab) {
        const currentDate = dayjs.utc().format('YYYYMMDD');
        const currentHour = dayjs.utc().format('HH');
        const previousDate = dayjs.utc().subtract(1, 'hour').format('YYYYMMDD');
        const previousHour = dayjs.utc().subtract(1, 'hour').format('HH');

        const apiParams = [
            { date: currentDate, hour: currentHour },
            { date: previousDate, hour: previousHour },
        ];

        for (const { date, hour } of apiParams) {
            const matches = await database.callApi(
                'GetMatchIDsByQueue',
                `GetMatchIDsByQueue:::SpecificQ::${queueIDsToGrab[queueID]}`,
                queueIDsToGrab[queueID],
                date,
                hour
            );
            
            processMatches(matches);
        }
    }


}, 30000);


