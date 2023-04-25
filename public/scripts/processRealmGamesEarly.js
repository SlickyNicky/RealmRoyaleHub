
let databaseConfig = require('./realmRoyaleDatabase_v2.js');
let database = new databaseConfig()

const winston = require('winston');
const logger_early = winston.createLogger({
    maxsize: '10000000',
    maxFiles: '1000',
    timestamp: true,
    level: 'info',
    format: winston.format.json(),
    defaultMeta: {service: 'processRealmGames'},
    transports: [
        new winston.transports.File({filename: __dirname + '/logging/matchesToProcess_processing_early.json'})
    ],
});

async function insertEarlyFormattedGameMatches(gameMatch) {


    database.insertEarlyNewMatchInformationOverview(gameMatch);

    for(const team in gameMatch['teams']) {
        for(const players in gameMatch['teams'][team]) {
            for(const player in gameMatch['teams'][team][players]) {

                if((Object.keys(await database.getStoredPlayerInformation(gameMatch['teams'][team][players][player]['id']))).length === 0) {
                    let playerInfo = await database.callApi_v2(
                        'GetPlayer',
                        `GetPlayer::${gameMatch['teams'][team][players][player]['id']}`,
                        gameMatch['teams'][team][players][player]['id'],
                        'hirez'
                    )
                    database.insertNewPlayerInformation(playerInfo)
                }



                database.insertEarlyNewMatchInformationPerPerson(
                    gameMatch['teams'][team][players][player],
                    gameMatch['match_id'],
                    gameMatch['teams'][team][players][player]['id'],
                    gameMatch['teams'][team]
                );
            }

        }
    }
}


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
                            totalGameDetails[gameVals][teams]['players'][player]['duration_secs']= totalGameDetails[gameVals][idStored[totalGameDetails[gameVals][teams]['id']]['index']]['players'][0]['duration_secs']
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

    database.realmGetEarlyMatchesToProcess().then(async matches => {
        const flattenedArray = matches.map(obj => obj.match_id)
        if(flattenedArray.length < 15) {

        } else {
            for(seperatedFifteenMatches in flattenedArray){
                database.callApi_v2(
                    'getmatchdetailsbatch',
                    `getmatchdetailsbatch::batch_processing:${JSON.stringify(matches)}`,
                    flattenedArray
                ).then(async matches => {
                    for(match in matches) {

                        logger_early.error(`starting_early_processing:::${matches[match]['match_id']}::${new Date().toLocaleString()}:RET_MSG:${matches[match]['ret_msg']}`)
                        if (matches[match]['ret_msg'] === null) {
                            matches[match] = fixRealmGameOutput(matches[match])
                            insertEarlyFormattedGameMatches(matches[match])
                        } else {
                            if (matches[match]['ret_msg'] === `No Match Details:${matches[match]['match_id']}`) {
                                logger_early.error(`Match:::RET_MSG_ERROR_01::${matches[match]['match_id']}::${JSON.stringify(matches[match])}`)
                            } else {
                                logger_early.error(`Match:::RET_MSG_ERROR_02::${matches[match]['match_id']}::${JSON.stringify(matches[match])}`)
                            }
                        }
                        let match_id = null
                        if(matches[match]['ret_msg'] !== null) {
                            match_id = matches[match]['ret_msg'].split('No Match Details:')[1]
                        } else {
                            match_id = matches[match]['match_id']
                        }

                        await database.realmDeleteEarlyMatchToProcess(match_id)
                        logger_early.error(`Finished_Early_Processing::::${match_id}:::${matches[match]['match_id']}::${new Date().toLocaleString()}:RET_MSG:${matches[match]['ret_msg']}`)

                    }
                })
            }
            flattenedArray.length = 0
        }
    })
},2000 // polls every 3 seconds )
);
