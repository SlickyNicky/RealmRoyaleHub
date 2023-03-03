const crypto = require('crypto');

require('util');
let express = require('express'),
    session = require('express-session');
var subdomain = require('express-subdomain');
var router = express.Router();
var routerNonProd = express.Router();

let passport = require('passport');
let passportSteam = require('passport-steam');
let SteamStrategy = passportSteam.Strategy;

const requestIp = require('request-ip');


let databaseConfig = require('./public/scripts/realmRoyaleDatabase_v2.js');

let database = new databaseConfig()

let app = express();
var mcache = require('memory-cache');

// using dayjs vs momentjs due to performance / size impact
const dayjs = require('dayjs')
let utc = require('dayjs/plugin/utc')
dayjs.extend(utc);
const path = require("path");

__dirname = path.resolve();


let queueIDs = {
    'Solo\'s': 474,
    'Trio\'s': 475,
    'Squad\'s': 476,
    customSolo: 10188,
    customDuo: 10189,
    customTrio: 10205,
    customSquad: 10190
}
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

// this function fixes issues related to people being on different teams if they lag out / crash
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

        // console.log(totalGameDetails)
        return totalGameDetails
    } else {
        //todo: implement
        return totalGameDetails
    }
}

function split(string, delimiter, n) {
    const parts = string.split(delimiter);
    return parts.slice(0, n - 1).concat([parts.slice(n - 1).join(delimiter)]);
}

const winston = require('winston');
const fs = require("fs");

const logger = winston.createLogger({
    maxsize: '1000000 ',
    maxFiles: '1000',
    timestamp: true,
    level: 'info',
    format: winston.format.json(),
    defaultMeta: {service: 'express_information'},
    transports: [
        new winston.transports.File({filename: __dirname + '/public/scripts/combined.json'})
    ],
});

const cache = (durationMs) => {
    return (req, res, next) => {

        let key = '__express__' + req.originalUrl || req.url
        let cachedBody = mcache.get(key)
        if (cachedBody) {
            logger.error(`${dayjs.utc().format('YYYYMMDDHH')}::::cache:::found_cache_hit::${req.originalUrl || req.url}`)
            res.send(cachedBody)
            return
        } else {
            logger.error(`${dayjs.utc().format('YYYYMMDDHH')}::::cache:::miss_cache_hit::${req.originalUrl || req.url}`)
            res.sendResponse = res.send
            res.send = (body) => {
                mcache.put(key, body, durationMs);
                res.sendResponse(body)
            }
            next()
        }
    }
};


app.set('views', __dirname + '/public/views/');
app.set('view engine', 'ejs');

app.use(function (req, res, next) {
    res.set('Cache-control', 'public, max-age=15')
    next()
 })
 
app.use(session({
    secret: '4567ighjcvjft7jc5',
    resave: true,
    saveUninitialized: true,
    cookie: {
        maxAge: 3600000
    }
}));
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({extended: true}))
app.use(express.json());
app.use(subdomain('realm', routerNonProd));
// app.use(subdomain('*', router));
app.use(requestIp.mw())

router.get('/auth/steam',
    passport.authenticate('steam', {failureRedirect: '/'}),
    function (req, res) {
        res.redirect('/');
    }
);

router.get('/auth/steam/return',
    passport.authenticate('steam', {failureRedirect: '/'}),
    function (req, res) {
        res.redirect('/');
    }
);

router.get('/logout', function (req, res) {
    req.session.destroy(function (err) {
        res.redirect('/'); //Inside a callback… bulletproof!
    });
});

routerNonProd.get('/', cache(30000), (req, res) => {
    res.render('index', {user: req.user, database: database});
});

routerNonProd.get('/orgTourney*', cache(5000), async (req, res) => {
    let tourneyUrl = (req.originalUrl).split('/orgtourney/')[1];
    if (tourneyUrl !== undefined && tourneyUrl !== '') {
        let tourneyAndHash = tourneyUrl.split('/');
        if (tourneyAndHash.length > 2) {

            if (await database.tourneyHashChecker(tourneyAndHash[0], tourneyAndHash[1], tourneyAndHash[2]) !== '') {
                // means the hash and the tourney name match up

                let tourneyOverview = (await database.getTourneyInfo(tourneyAndHash[0], tourneyAndHash[1], tourneyAndHash[2]))[0]
                let totalGamesOutput = (await database.getTourneyGameTotalInfo(tourneyAndHash[0], tourneyAndHash[1], tourneyAndHash[2]))
                let totalGamesOutputMap = new Map();
                let totalGamesQueueOutputMap = new Map();

                for (const val in totalGamesOutput) {
                    totalGamesOutputMap.set(totalGamesOutput[val]['gamenumber'], totalGamesOutput[val]);
                    totalGamesQueueOutputMap.set(
                        totalGamesOutput[val]['gamenumber'],
                        await database.callApi(
                            "GetMatchDetails",
                            true,
                            'GetMatchDetails',
                            totalGamesOutput[val]['queueid']
                        )
                    );
                }
                totalGamesQueueOutputMap = fixRealmGameOutput(totalGamesQueueOutputMap,true)
                const totalPlacementPoints = new Map();
                let split = tourneyOverview['pointsperplacement'].split(',')
                for (const val in split) {
                    let index = parseInt(val) + 1
                    totalPlacementPoints.set(index, split[val]);
                }

                // structure of win
                // -> team names : points
                // |
                //                  \-> placement + kill point amount from input
                var teamDict = {};
                var highestGames = {}
                let teamNames = []
                for (const [key, value] of totalGamesQueueOutputMap) {
                    for (const overallTeams in value['teams']) {
                        // used to keep track of teams and if someone uses the same name system still works
                        let teamName = []
                        teamName[0] = ['']
                        teamName[0][1] = ''
                        teamName[1] = ['']
                        teamName[1][0] = ''

                        let tempKillsTotalPoints = []

                        let teamKills = 0;
                        let placement;


                        for (const team in value['teams'][overallTeams]) {
                            for (const player in value['teams'][overallTeams][team]) {
                                teamName[0][0] += [value['teams'][overallTeams][team][player]['id']]
                                teamName[0][1] += " |" + value['teams'][overallTeams][team][player]['name'] + "| "
                                tempKillsTotalPoints.push(parseInt(value['teams'][overallTeams][team][player]['kills_player']) * tourneyOverview['pointsperkill'])
                            }
                        }
                        let totalKillPoints = 0
                        for (const killAmount in tempKillsTotalPoints) {
                            totalKillPoints += tempKillsTotalPoints[killAmount]
                        }
                        let teamPlacementPoints = parseInt(totalPlacementPoints.get(value['teams'][overallTeams]['placement']))

                        if (teamPlacementPoints === undefined || isNaN(teamPlacementPoints)) {
                            teamPlacementPoints = 0
                        }
                        if (teamDict[teamName[0][0] + "|" + teamName[0][1]] === undefined) {
                            teamDict[teamName[0][0] + "|" + teamName[0][1]] = 0
                        }
                        if (highestGames[teamName[0][0] + "|" + teamName[0][1]] === undefined) {
                            highestGames[teamName[0][0] + "|" + teamName[0][1]] = []
                        }

                        let totalGamePoints = totalKillPoints + teamPlacementPoints
                        if (highestGames[teamName[0][0] + "|" + teamName[0][1]].length < tourneyOverview['bestofgames']) {
                            highestGames[teamName[0][0] + "|" + teamName[0][1]].push(
                                {
                                    points: totalGamePoints,
                                    queueID: value['match_id']
                                }
                            )

                            highestGames[teamName[0][0] + "|" + teamName[0][1]].sort(function (first, second) {
                                return second.points - first.points;
                            });
                        } else {
                            if (highestGames[teamName[0][0] + "|" + teamName[0][1]][highestGames[teamName[0][0] + "|" + teamName[0][1]].length - 1]['points'] < totalGamePoints) {

                                highestGames[teamName[0][0] + "|" + teamName[0][1]][highestGames[teamName[0][0] + "|" + teamName[0][1]].length - 1] =
                                    {
                                        points: totalGamePoints,
                                        queueID: value['match_id']
                                    }

                                highestGames[teamName[0][0] + "|" + teamName[0][1]].sort(function (first, second) {
                                    return second.points - first.points;
                                });
                            }
                        }

                        // todo: logic here for penalties

                        //

                        // final points value for team
                        // potential future idea: seperate each game out for team to get per game points
                        teamDict[teamName[0][0] + "|" + teamName[0][1]] =
                            parseInt(highestGames[teamName[0][0] + "|" + teamName[0][1]].reduce((partialSum, a) => partialSum + a.points, 0))
                    }
                }


                //sorts teams from highest->lowest or vice versa
                if (tourneyOverview['sortbylowestpoints'] !== 1) {
                    teamDict = Object.fromEntries(
                        Object.entries(teamDict)
                            .sort((a, b) => -a[1] - -b[1]) // don't question it
                    );
                } else {
                    teamDict = Object.fromEntries(
                        Object.entries(teamDict)
                            .sort((a, b) => a[1] - b[1]) // don't question it
                    );
                }

                let publicLinkTemp =
                    "https://realm.slickynicky.com" +
                    req.url.split('/')[0] + "/" +
                    req.url.split('/')[1] + "/" +
                    req.url.split('/')[2] + "/" +
                    tourneyAndHash[1]


                tourneyOverview['sortbylowestpoints'] = (tourneyOverview['sortbylowestpoints'] === 1)

                teamNames = []
                for(const team in teamDict) {
                    let temp = []
                    temp = team.split('| ').slice(1).join('| ').split('|  |')
                    temp[0] = temp[0].slice(1)
                    temp[temp.length-1] = temp[temp.length-1].slice(0,-1)

                    teamNames.push(temp)
                }

                res.render('orgTourney', {
                    tourneySetupOption: false,
                    editor: true,
                    viewer: true,
                    tourneyOverviewInfo: tourneyOverview,
                    totalGamesOutputInfo: totalGamesOutputMap,
                    totalGamesQueueOutputInfo: totalGamesQueueOutputMap,
                    placementTeamAndPoints: teamDict,
                    highestGamesForTeam: highestGames,
                    teamNames: teamNames,
                    privateLinkEnabled: true,
                    publicLinkEnabled: true,
                    privateLink: req.url,
                    publicLink: publicLinkTemp
                });
            } else {

                // means hash and/or tourney name don't match with anything in db
                res.redirect(`/orgtourney/${tourneyAndHash[0]}/${tourneyAndHash[1]}`)
            }
        } else if (tourneyAndHash.length === 2) {

            let tourneyOverview = (await database.getTourneyInfo(tourneyAndHash[0], tourneyAndHash[1]))[0]

            let totalGamesOutput = (await database.getTourneyGameTotalInfo(tourneyAndHash[0], tourneyAndHash[1], tourneyAndHash[2]))
            let totalGamesOutputMap = new Map();
            let totalGamesQueueOutputMap = new Map();

            for (const val in totalGamesOutput) {
                totalGamesOutputMap.set(totalGamesOutput[val]['gameNumber'], totalGamesOutput[val]);
                totalGamesQueueOutputMap.set(
                    totalGamesOutput[val]['gameNumber'],
                    await database.callApi(
                        "GetMatchDetails",
                        true,
                        'GetMatchDetails',
                        totalGamesOutput[val]['queueId']
                    )
                );
            }
            const totalPlacementPoints = new Map();

            let split = tourneyOverview['pointsperplacement'].split(',')
            for (const val in split) {
                let index = parseInt(val) + 1
                totalPlacementPoints.set(index, split[val]);
            }
            totalGamesQueueOutputMap = fixRealmGameOutput(totalGamesQueueOutputMap,true)


            // structure of win
            // -> team names : points
            // |

            //                  \-> placement + kill point amount from input
            var teamDict = {};
            var highestGames = {}
            for (const [key, value] of totalGamesQueueOutputMap) {
                for (const overallTeams in value['teams']) {
                    let teamName = []
                    teamName[0] = ['']
                    teamName[0][1] = ''
                    teamName[1] = ['']
                    teamName[1][0] = ''

                    let tempKillsTotalPoints = []

                    for (const team in value['teams'][overallTeams]) {
                        for (const player in value['teams'][overallTeams][team]) {
                            teamName[0][0] += [value['teams'][overallTeams][team][player]['id']]
                            teamName[0][1] += " |" + value['teams'][overallTeams][team][player]['name'] + "| "
                            tempKillsTotalPoints.push(parseInt(value['teams'][overallTeams][team][player]['kills_player']) * tourneyOverview['pointsperkill'])
                        }
                    }
                    let totalKillPoints = 0
                    for (const killAmount in tempKillsTotalPoints) {
                        totalKillPoints += tempKillsTotalPoints[killAmount]
                    }
                    let teamPlacementPoints = parseInt(totalPlacementPoints.get(value['teams'][overallTeams]['placement']))
                    if (teamPlacementPoints === undefined || isNaN(teamPlacementPoints)) {
                        teamPlacementPoints = 0
                    }
                    if (teamDict[teamName[0][0] + "|" + teamName[0][1]] === undefined) {
                        teamDict[teamName[0][0] + "|" + teamName[0][1]] = 0
                    }
                    if (highestGames[teamName[0][0] + "|" + teamName[0][1]] === undefined) {
                        highestGames[teamName[0][0] + "|" + teamName[0][1]] = []
                    }

                    let totalGamePoints = totalKillPoints + teamPlacementPoints
                    if (highestGames[teamName[0][0] + "|" + teamName[0][1]].length < tourneyOverview['bestofgames']) {
                        highestGames[teamName[0][0] + "|" + teamName[0][1]].push(
                            {
                                points: totalGamePoints,
                                queueID: value['match_id']
                            }
                        )

                        highestGames[teamName[0][0] + "|" + teamName[0][1]].sort(function (first, second) {
                            return second.points - first.points;
                        });
                    } else {
                        if (highestGames[teamName[0][0] + "|" + teamName[0][1]][highestGames[teamName[0][0] + "|" + teamName[0][1]].length - 1]['points'] < totalGamePoints) {

                            highestGames[teamName[0][0] + "|" + teamName[0][1]][highestGames[teamName[0][0] + "|" + teamName[0][1]].length - 1] =
                                {
                                    points: totalGamePoints,
                                    queueID: value['match_id']
                                }

                            highestGames[teamName[0][0] + "|" + teamName[0][1]].sort(function (first, second) {
                                return second.points - first.points;
                            });
                        }
                    }
                    // todo: logic here for penalties

                    //

                    // final points value for team
                    // potential future idea: seperate each game out for team to get per game points
                    teamDict[teamName[0][0] + "|" + teamName[0][1]] =
                        parseInt(highestGames[teamName[0][0] + "|" + teamName[0][1]].reduce((partialSum, a) => partialSum + a.points, 0))


                }
            }
            if (tourneyOverview['sortbylowestpoints'] !== 1) {
                teamDict = Object.fromEntries(
                    Object.entries(teamDict)
                        .sort((a, b) => -a[1] - -b[1]) // don't question it
                );
            } else {
                teamDict = Object.fromEntries(
                    Object.entries(teamDict)
                        .sort((a, b) => a[1] - b[1]) // don't question it
                );
            }


            tourneyOverview['sortbylowestpoints'] = (tourneyOverview['sortbylowestpoints'] === 1)


            // tourney viewer / spectator

            res.render('orgTourney', {
                viewer: true,
                editor: false,
                tourneySetupOption: false,
                tourneyOverviewInfo: tourneyOverview,
                totalGamesOutputInfo: totalGamesOutputMap,
                placementTeamAndPoints: teamDict,
                highestGamesForTeam: highestGames,
                privateLinkEnabled: false,
                publicLinkEnabled: true,
                privateLink: '',
                publicLink: req.url

            });

        } else {

            res.redirect(`/orgtourney`)
        }
    } else {
        // this means you looking at homepage with no tourney in sight
        res.render('orgTourney', {
            tourneySetupOption: true,
            editor: true,
            viewer: false,
            privateLinkEnabled: false,
            publicLinkEnabled: false,
            privateLink: '',
            publicLink: ''
        });
    }
});

routerNonProd.post('/orgtourney', async function (req, res) {
    let tourneyName = encodeURIComponent(req.body.search)
    // sParameter = sParameter.trim())
    let hashedTourney = crypto.randomBytes(64).toString('hex');

    let tourneyNumber = parseInt(await database.tourneyNameChecker(tourneyName)) + 1


    await database.createTourney(
        hashedTourney,
        tourneyName,
        req.body.gameAmount,
        req.body.bestOfAmount,
        req.body.queueType,
        req.body.pointsPerKill,
        req.body.placementPoints,
        tourneyNumber,
        (req.body.lowerPoints === 'lowerPoints')
    )
    res.redirect(303, `/orgtourney/${tourneyName}/${tourneyNumber}/${hashedTourney}`)


});

routerNonProd.post('/orgtourneyAddQueue', async function (req, res) {

    let tourneyUrl = (req.body.urlpath).split('/orgtourney/')[1];
    let splitUrl = tourneyUrl.split('/')

    await database.addGameToTourney(
        splitUrl[2],
        splitUrl[0],
        splitUrl[1],
        req.body.matchNum,
        req.body.queueId
    )

    res.redirect(303, `/orgtourney/${splitUrl[0]}/${splitUrl[1]}/${splitUrl[2]}`)
});

routerNonProd.get('/orgLeague*', cache(5000), async (req, res) => {
    let tourneyUrl = (req.originalUrl).split('/orgLeague/')[1];
    if (tourneyUrl !== undefined && tourneyUrl !== '') {
        let tourneyAndHash = tourneyUrl.split('/');
        if (tourneyAndHash.length > 2) {

            if (await database.leagueHashChecker(tourneyAndHash[0], tourneyAndHash[1], tourneyAndHash[2]) !== '') {

                // means the hash and the tourney name match up
                let tourneyOverview = (await database.getLeagueInfo(tourneyAndHash[0], tourneyAndHash[1], tourneyAndHash[2]))[0]
                let totalGamesOutput = (await database.getLeagueGameTotalInfo(tourneyAndHash[0], tourneyAndHash[1], tourneyAndHash[2]))
                let totalAmountOfGames = (await database.getLeagueTotalGamesEntered(tourneyAndHash[0], tourneyAndHash[1]))
                let totalGamesOutputMap = new Map();
                let totalGamesQueueOutputMap = new Map();


                for (const val in totalGamesOutput) {
                    totalGamesOutputMap.set(totalGamesOutput[val]['gameNumber'], totalGamesOutput[val]);
                    totalGamesQueueOutputMap.set(
                        totalGamesOutput[val]['gameNumber'],
                        await database.callApi(
                            "GetMatchDetails",
                            true,
                            'GetMatchDetails',
                            totalGamesOutput[val]['queueId']
                        )
                    );
                }

                totalGamesQueueOutputMap = fixRealmGameOutput(totalGamesQueueOutputMap,true)



                const totalPlacementPoints = new Map();
                let split = tourneyOverview['pointsperplacement'].split(',')
                for (const val in split) {
                    let index = parseInt(val) + 1
                    totalPlacementPoints.set(index, split[val]);
                }

                // structure of win
                // -> team names : points
                // |
                //                  \-> placement + kill point amount from input
                let teamDict = {};
                let highestGames = {};
                for (const [key, value] of totalGamesQueueOutputMap) {
                    for (const overallTeams in value['teams']) {
                        // used to keep track of teams and if someone uses the same name system still works
                        let teamName = []
                        teamName[0] = ['']
                        teamName[0][1] = ''
                        teamName[1] = ['']
                        teamName[1][0] = ''

                        let tempKillsTotalPoints = []

                        let teamKills = 0;
                        let placement;


                        for (const team in value['teams'][overallTeams]) {
                            for (const player in value['teams'][overallTeams][team]) {
                                teamName[0][0] += [value['teams'][overallTeams][team][player]['id']]
                                teamName[0][1] += " |" + value['teams'][overallTeams][team][player]['name'] + "| "
                                tempKillsTotalPoints.push(parseInt(value['teams'][overallTeams][team][player]['kills_player']) * tourneyOverview['pointsperkill'])
                            }
                        }
                        let totalKillPoints = 0
                        for (const killAmount in tempKillsTotalPoints) {
                            totalKillPoints += tempKillsTotalPoints[killAmount]
                        }
                        let teamPlacementPoints = parseInt(totalPlacementPoints.get(value['teams'][overallTeams]['placement']))
                        if (teamPlacementPoints === undefined || isNaN(teamPlacementPoints)) {
                            teamPlacementPoints = 0
                        }
                        if (teamDict[teamName[0][0] + "|" + teamName[0][1]] === undefined) {
                            teamDict[teamName[0][0] + "|" + teamName[0][1]] = 0
                        }
                        if (highestGames[teamName[0][0] + "|" + teamName[0][1]] === undefined) {
                            highestGames[teamName[0][0] + "|" + teamName[0][1]] = []
                        }


                        let totalGamePoints = totalKillPoints + teamPlacementPoints
                        if (highestGames[teamName[0][0] + "|" + teamName[0][1]].length < tourneyOverview['bestofgames']) {
                            highestGames[teamName[0][0] + "|" + teamName[0][1]].push(
                                {
                                    points: totalGamePoints,
                                    queueID: value['match_id']
                                }
                            )

                            highestGames[teamName[0][0] + "|" + teamName[0][1]].sort(function (first, second) {
                                return second.points - first.points;
                            });
                        } else {
                            if (highestGames[teamName[0][0] + "|" + teamName[0][1]][highestGames[teamName[0][0] + "|" + teamName[0][1]].length - 1]['points'] < totalGamePoints) {

                                highestGames[teamName[0][0] + "|" + teamName[0][1]][highestGames[teamName[0][0] + "|" + teamName[0][1]].length - 1] =
                                    {
                                        points: totalGamePoints,
                                        queueID: value['match_id']
                                    }

                                highestGames[teamName[0][0] + "|" + teamName[0][1]].sort(function (first, second) {
                                    return second.points - first.points;
                                });
                            }
                        }
                        // todo: logic here for penalties

                        //

                        // final points value for team
                        // potential future idea: seperate each game out for team to get per game points
                        teamDict[teamName[0][0] + "|" + teamName[0][1]] =
                            parseInt(highestGames[teamName[0][0] + "|" + teamName[0][1]].reduce((partialSum, a) => partialSum + a.points, 0))
                    }

                }


                //sorts teams from highest->lowest or vice versa
                if (tourneyOverview['sortbylowestpoints'] !== 1) {
                    teamDict = Object.fromEntries(
                        Object.entries(teamDict)
                            .sort((a, b) => -a[1] - -b[1]) // don't question it
                    );
                } else {
                    teamDict = Object.fromEntries(
                        Object.entries(teamDict)
                            .sort((a, b) => a[1] - b[1]) // don't question it
                    );
                }

                let publicLinkTemp =
                    "https://realm.slickynicky.com" +
                    req.url.split('/')[0] + "/" +
                    req.url.split('/')[1] + "/" +
                    req.url.split('/')[2] + "/" +
                    tourneyAndHash[1]


                tourneyOverview['sortbylowestpoints'] = (tourneyOverview['sortbylowestpoints'] === 1)

                res.render('orgLeague', {
                    tourneySetupOption: false,
                    editor: true,
                    viewer: true,
                    tourneyOverviewInfo: tourneyOverview,
                    totalGamesOutputInfo: totalGamesOutputMap,
                    totalGamesQueueOutputInfo: totalGamesQueueOutputMap,
                    placementTeamAndPoints: teamDict,
                    highestGamesForTeam: highestGames,
                    privateLinkEnabled: true,
                    publicLinkEnabled: true,
                    privateLink: req.url,
                    publicLink: publicLinkTemp,
                    totalGamesEntered: totalAmountOfGames
                });
            } else {

                // means hash and/or tourney name don't match with anything in db
                res.redirect(`/orgLeague/${tourneyAndHash[0]}/${tourneyAndHash[1]}`)
            }
        } else if (tourneyAndHash.length === 2) {

            let tourneyOverview = (await database.getLeagueInfo(tourneyAndHash[0], tourneyAndHash[1], tourneyAndHash[2]))[0]

            let totalGamesOutput = (await database.getLeagueGameTotalInfo(tourneyAndHash[0], tourneyAndHash[1], tourneyAndHash[2]))
            let totalGamesOutputMap = new Map();
            let totalGamesQueueOutputMap = new Map();

            for (const val in totalGamesOutput) {
                totalGamesOutputMap.set(totalGamesOutput[val]['gameNumber'], totalGamesOutput[val]);
                totalGamesQueueOutputMap.set(
                    totalGamesOutput[val]['gameNumber'],
                    await database.callApi(
                        "GetMatchDetails",
                        true,
                        'GetMatchDetails',
                        totalGamesOutput[val]['queueId']
                    )
                );
            }

            totalGamesQueueOutputMap = fixRealmGameOutput(totalGamesQueueOutputMap,true)


            const totalPlacementPoints = new Map();
            let split = tourneyOverview['pointsperplacement'].split(',')
            for (const val in split) {
                let index = parseInt(val) + 1
                totalPlacementPoints.set(index, split[val]);
            }

            // structure of win
            // -> team names : points
            // |
            //                  \-> placement + kill point amount from input
            var teamDict = {};
            highestGames = {};
            for (const [key, value] of totalGamesQueueOutputMap) {
                for (const overallTeams in value['teams']) {
                    let teamName = []
                    teamName[0] = ['']
                    teamName[0][1] = ''
                    teamName[1] = ['']
                    teamName[1][0] = ''

                    let tempKillsTotalPoints = []

                    let teamKills = 0;
                    let placement
                    for (const team in value['teams'][overallTeams]) {
                        for (const player in value['teams'][overallTeams][team]) {
                            teamName[0][0] += [value['teams'][overallTeams][team][player]['id']]
                            teamName[0][1] += " |" + value['teams'][overallTeams][team][player]['name'] + "| "
                            tempKillsTotalPoints.push(parseInt(value['teams'][overallTeams][team][player]['kills_player']) * tourneyOverview['pointsperkill'])
                        }
                    }
                    let totalKillPoints = 0
                    for (const killAmount in tempKillsTotalPoints) {
                        totalKillPoints += tempKillsTotalPoints[killAmount]
                    }
                    let teamPlacementPoints = parseInt(totalPlacementPoints.get(value['teams'][overallTeams]['placement']))
                    if (teamPlacementPoints === undefined || isNaN(teamPlacementPoints)) {
                        teamPlacementPoints = 0
                    }
                    if (teamDict[teamName[0][0] + "|" + teamName[0][1]] === undefined) {
                        teamDict[teamName[0][0] + "|" + teamName[0][1]] = 0
                    }
                    if (highestGames[teamName[0][0] + "|" + teamName[0][1]] === undefined) {
                        highestGames[teamName[0][0] + "|" + teamName[0][1]] = []
                    }

                    let totalGamePoints = totalKillPoints + teamPlacementPoints
                    if (highestGames[teamName[0][0] + "|" + teamName[0][1]].length < tourneyOverview['bestofgames']) {
                        highestGames[teamName[0][0] + "|" + teamName[0][1]].push(
                            {
                                points: totalGamePoints,
                                queueID: value['match_id']
                            }
                        )

                        highestGames[teamName[0][0] + "|" + teamName[0][1]].sort(function (first, second) {
                            return second.points - first.points;
                        });
                    } else {
                        if (highestGames[teamName[0][0] + "|" + teamName[0][1]][highestGames[teamName[0][0] + "|" + teamName[0][1]].length - 1]['points'] < totalGamePoints) {

                            highestGames[teamName[0][0] + "|" + teamName[0][1]][highestGames[teamName[0][0] + "|" + teamName[0][1]].length - 1] =
                                {
                                    points: totalGamePoints,
                                    queueID: value['match_id']
                                }

                            highestGames[teamName[0][0] + "|" + teamName[0][1]].sort(function (first, second) {
                                return second.points - first.points;
                            });
                        }
                    }
                    // todo: logic here for penalties

                    //

                    // final points value for team
                    // potential future idea: seperate each game out for team to get per game points
                    teamDict[teamName[0][0] + "|" + teamName[0][1]] =
                        parseInt(highestGames[teamName[0][0] + "|" + teamName[0][1]].reduce((partialSum, a) => partialSum + a.points, 0))

                }
            }
            if (tourneyOverview['sortbylowestpoints'] !== 1) {
                teamDict = Object.fromEntries(
                    Object.entries(teamDict)
                        .sort((a, b) => -a[1] - -b[1]) // don't question it
                );
            } else {
                teamDict = Object.fromEntries(
                    Object.entries(teamDict)
                        .sort((a, b) => a[1] - b[1]) // don't question it
                );
            }


            tourneyOverview['sortbylowestpoints'] = (tourneyOverview['sortbylowestpoints'] === 1)

            let totalAmountOfGames = (await database.getLeagueTotalGamesEntered(tourneyAndHash[0], tourneyAndHash[1]))


            // tourney viewer / spectator
            res.render('orgLeague', {
                viewer: true,
                editor: false,
                tourneySetupOption: false,
                tourneyOverviewInfo: tourneyOverview,
                totalGamesOutputInfo: totalGamesOutputMap,
                placementTeamAndPoints: teamDict,
                highestGamesForTeam: highestGames,
                privateLinkEnabled: false,
                publicLinkEnabled: true,
                privateLink: '',
                publicLink: req.url,
                totalGamesEntered: totalAmountOfGames

            });
        } else {

            res.redirect(`/orgLeague`)
        }
    } else {
        // this means you looking at homepage with no tourney in sight
        res.render('orgLeague', {
            tourneySetupOption: true,
            editor: true,
            viewer: false,
            privateLinkEnabled: false,
            publicLinkEnabled: false,
            privateLink: '',
            publicLink: ''
        });
    }
});

routerNonProd.post('/orgLeague', async function (req, res) {
    let tourneyName = encodeURIComponent(req.body.search)
    // sParameter = sParameter.trim())
    let hashedTourney = crypto.randomBytes(64).toString('hex');

    let tourneyNumber = parseInt(await database.leagueNameChecker(tourneyName)) + 1
    await database.createLeague(
        hashedTourney,
        tourneyName,
        req.body.bestOfAmount,
        req.body.queueType,
        req.body.pointsPerKill,
        req.body.placementPoints,
        parseInt(tourneyNumber),
        (req.body.lowerPoints === 'lowerPoints')
    )
    res.redirect(303, `/orgLeague/${tourneyName}/${tourneyNumber}/${hashedTourney}`)

});

routerNonProd.post('/orgLeagueAddQueue', async function (req, res) {

    let tourneyUrl = (req.body.urlpath).split('/orgLeague/')[1];
    let splitUrl = tourneyUrl.split('/')

    await database.addGameToLeague(
        splitUrl[2],
        splitUrl[0],
        splitUrl[1],
        req.body.matchNum,
        req.body.queueId
    )

    res.redirect(303, `/orgLeague/${splitUrl[0]}/${splitUrl[1]}/${splitUrl[2]}`)
});

routerNonProd.get('/mmr*', cache(5000), async (req, res) => {

    let playerUrl = (req.originalUrl).split('/mmr/')[1]
    if (playerUrl !== undefined && playerUrl !== '') {

        if (playerUrl !== undefined && playerUrl !== '') {
            
            playerUrl = decodeURI(playerUrl)
            let playerId = await getPlayerID(playerUrl.trimEnd())


            let [temp1, temp2,temp3,temp4] = await Promise.all([
                database.callApi("GetPlayer", true, 'GetPlayer', playerId, 'hirez'),
                database.getMMRChanges(playerId),
                database.mmrPlayerGetStats(playerId),
                database.mmrGetTopPlayersTemp_v2()
            ]);

            req.session.getPlayerProfileStats = temp1

            req.session.mmrChanges = temp2

            req.session.findPlayerStatsOverall = formatPlayerMMR(temp3)

            req.session.bestPlayers = sortTopPlayers(temp4)


            res.render('mmr', {
                displayStats: true,
                mmrChanges:  req.session.mmrChanges,
                queueStats: req.session.findPlayerStatsOverall,
                bestPlayers: req.session.bestPlayers,
                playerStats: req.session.getPlayerProfileStats
            });
        } else {
            let topPlayerMMRStats = await database.mmrGetTopPlayersTemp_v2()
            req.session.bestPlayers = sortTopPlayers(topPlayerMMRStats)

            res.render('mmr', {
                displayStats: false,
                queueStats: '',
                bestPlayers: req.session.bestPlayers,
                playerStats: ''
            });
        }

        req.session.destroy(); //might need this in the future?

    } else {
        let topPlayerMMRStats = await database.mmrGetTopPlayersTemp_v2()
        req.session.bestPlayers = sortTopPlayers(topPlayerMMRStats)


        res.render('mmr', {
            displayStats: false,
            queueStats: '',
            bestPlayers: req.session.bestPlayers,
            playerStats: ''
        });
    }
});
routerNonProd.post('/mmr', async function (req, res) {
    res.redirect(303, `/mmr/${req.body.search}`)
});

routerNonProd.get('/stats*',cache(5000), async (req, res) => {

    let playerUrl = (req.originalUrl).split('/stats/')[1]
    if (playerUrl !== undefined && playerUrl !== '') {

        if (playerUrl !== undefined && playerUrl !== '') {

            // handles cases with %20 spaces in them :) and other special characters
            playerUrl = decodeURI(playerUrl)

            let playerId = await getPlayerID(playerUrl.trimEnd())



            req.session.getPlayerProfileStats = await database.callApi("GetPlayer", true, 'GetPlayer', playerId, 'hirez')
            let playerStats = await database.callApi("GetPlayerStats", true, 'GetPlayerStats', playerId)
            if(playerStats['ret_msg'] === 'No Player Stats:0') {
                res.redirect('/404');
            } else {

                let output = {}
                let agStats = playerStats["aggregate_stats"]
                delete agStats['placements']
                delete agStats['placement_list']
                delete agStats['wards_mines_placed']
                delete agStats['kills_bot']
                delete agStats['killing_spree_max']
                delete agStats['damage_mitigated']
                delete agStats['damage_done_in_hand']
                delete agStats['earned_tokens']
                delete agStats['earned_xp']
                delete agStats['average_placement']
                delete agStats['assists']

                let queueStats = playerStats["queue_class_stats"]

                for (const queue in queueStats) {
                    let match_queue_id = queueStats[queue]['match_queue_id'];

                    for (const stats in queueStats[queue]['stats']) {
                        if (stats === 'placement_list' ||
                            stats === 'placements' ||
                            stats === 'assists' ||
                            stats === 'class_id' ||
                            stats === 'average_placement' ||
                            stats === 'damage_mitigated' ||
                            stats === 'earned_tokens' ||
                            stats === 'earned_xp' ||
                            stats === 'killing_spree_max' ||
                            stats === 'kills_bot' ||
                            stats === 'damage_done_in_hand' ||
                            stats === 'wards_mines_placed'
                        ) {
                            // I'd rather die than go through this
                            continue
                        }

                        if (output[match_queue_id] === undefined) {
                            output[match_queue_id] = {}
                        }
                        let before = output[match_queue_id][stats];
                        if (before === undefined) {
                            before = 0
                        }

                        output[match_queue_id][stats] = before + queueStats[queue]['stats'][stats]
                    }
                }


                req.session.findPlayerStatsOverall = agStats

                req.session.getLastFifty = await database.getPlayerMatchHistory(playerId)



                res.render('stats', {
                    displayStats: true,
                    playerInfo: req.session.getPlayerProfileStats,
                    playerOverallStats: req.session.findPlayerStatsOverall,
                    playerAggStats: output,
                    playerLastFifty: req.session.getLastFifty
                });
            }
        } else {

            res.render('stats', {
                displayStats: false,
                playerStats: ''
            });
        }

        req.session.destroy(); //might need this in the future?

    } else {
        res.render('stats', {
            displayStats: false,
            playerStats: ''
        });
    }

});

routerNonProd.post('/stats', async function (req, res) {
    res.redirect(303, `/stats/${req.body.search}`)
});

routerNonProd.get('/match*', cache(5000), async (req, res) => {
    let tourneyUrl = (req.originalUrl).split('/match/')[1];
    if (tourneyUrl !== undefined && tourneyUrl !== '') {
        let tourneyAndHash = tourneyUrl.split('/');
        if (tourneyAndHash.length === 1) {
            // let match = await database.callApi(
            //     "GetMatchDetails",
            //     true,
            //     'GetMatchDetails',
            //     tourneyAndHash[0]
            // )
            // if (match['ret_msg'] === `No Match Details:${tourneyAndHash[0]}`) {
            //     res.render('match', {
            //         renderDetails: false
            //     });
            // } else {
                let match = (await database.getMatchInformation(tourneyAndHash[0]))[0]
                let matchOverview = (await database.getMatchInformation(tourneyAndHash[0]))[1]

                res.render('match', {
                    renderDetails: true,
                    matchDetails: match,
                    matchOverview:matchOverview
                });
            // }
        }
    } else {
        res.render('match', {
            renderDetails: false
        });
    }
});


async function writeFileWithDictData(dict,fileName) {
    return new Promise(async (resolve, reject) => {

        let flatten = "Player IDs:\n"
        for (const temp in dict) {
            flatten += 'https://realm.slickynicky.com/stats/' + (dict[temp]['players'] + "\n")
        }

        fs.writeFileSync(`${fileName}.txt`, flatten, function (err) {
            if (err) {
                return console.log(err);
            }
        });
        return resolve(true)
    })
}


//482
routerNonProd.get('/admin*', cache(15000), async (req, res) => {
    let [
        classWinrateSoloLastWeek,
        classWinrateDuoLastWeek,
        classWinrateTrioLastWeek,
        classWinrateSquadLastWeek,
        classWinrateSoloLastDay,
        classWinrateDuoLastDay,
        classWinrateTrioLastDay,
        classWinrateSquadLastDay,
        classWinrateSoloLastHour,
        classWinrateDuoLastHour,
        classWinrateTrioLastHour,
        classWinrateSquadLastHour,
        getPlayersWeek,
        getPlayersDay,
        getPlayersHour,
        delay,
        lastWeekStats,
        lastWeekStatsSolo,
        lastWeekStatsDuo,
        lastWeekStatsTrio,
        lastWeekStatsSquad,
        lastDayStats,
        lastDayStatsSolo,
        lastDayStatsDuo,
        lastDayStatsTrio,
        lastDayStatsSquad,
        lastHourStats,
        lastHourStatsSolo,
        lastHourStatsDuo,
        lastHourStatsTrio,
        lastHourStatsSquad,
        lastWeekCrossplayStatsSolo,
        lastWeekCrossplayStatsDuo,
        lastWeekCrossplayStatsTrio,
        lastWeekCrossplayStatsSquad,
        lastDayCrossplayStatsSolo,
        lastDayCrossplayStatsDuo,
        lastDayCrossplayStatsTrio,
        lastDayCrossplayStatsSquad,
        lastHourCrossplayStatsSolo,
        lastHourCrossplayStatsDuo,
        lastHourCrossplayStatsTrio,
        lastHourCrossplayStatsSquad,
        lastWeekMatchStatsSolo,
        lastWeekMatchStatsDuo,
        lastWeekMatchStatsTrio,
        lastWeekMatchStatsSquad,
        lastDayMatchStatsSolo,
        lastDayMatchStatsDuo,
        lastDayMatchStatsTrio,
        lastDayMatchStatsSquad,
        lastHourMatchStatsSolo,
        lastHourMatchStatsDuo,
        lastHourMatchStatsTrio,
        lastHourMatchStatsSquad
    ] = await Promise.all([
        database.getClassWinRate_v2(604800,'474'),
        database.getClassWinRate_v2(604800,'482'),
        database.getClassWinRate_v2(604800,'475'),
        database.getClassWinRate_v2(604800,'476'),
        database.getClassWinRate_v2(86400,'474'),
        database.getClassWinRate_v2(86400,'482'),
        database.getClassWinRate_v2(86400,'475'),
        database.getClassWinRate_v2(86400,'476'),
        database.getClassWinRate_v2(3600,'474'),
        database.getClassWinRate_v2(3600,'482'),
        database.getClassWinRate_v2(3600,'475'),
        database.getClassWinRate_v2(3600,'476'),
        database.getPlayers_v2(604800),
        database.getPlayers_v2(86400),
        database.getPlayers_v2(3600),
        database.getTotalDelay(),
        database.getRealmStats_v2(604800),
        database.getRealmStats_v2(604800,'474'),
        database.getRealmStats_v2(604800,'482'),
        database.getRealmStats_v2(604800,'475'),
        database.getRealmStats_v2(604800,'476'),
        database.getRealmStats_v2(86400),
        database.getRealmStats_v2(86400,'474'),
        database.getRealmStats_v2(86400,'482'),
        database.getRealmStats_v2(86400,'475'),
        database.getRealmStats_v2(86400,'476'),
        database.getRealmStats_v2(3600),
        database.getRealmStats_v2(3600,'474'),
        database.getRealmStats_v2(3600,'482'),
        database.getRealmStats_v2(3600,'475'),
        database.getRealmStats_v2(3600,'476'),
        database.getCrossPlayPercentage(604800,'474'),
        database.getCrossPlayPercentage(604800,'482'),
        database.getCrossPlayPercentage(604800,'475'),
        database.getCrossPlayPercentage(604800,'476'),
        database.getCrossPlayPercentage(86400,'474'),
        database.getCrossPlayPercentage(86400,'482'),
        database.getCrossPlayPercentage(86400,'475'),
        database.getCrossPlayPercentage(86400,'476'),
        database.getCrossPlayPercentage(3600,'474'),
        database.getCrossPlayPercentage(3600,'482'),
        database.getCrossPlayPercentage(3600,'475'),
        database.getCrossPlayPercentage(3600,'476'),
        database.getAveragePlayersPerGamePerRegion(604800,'474'),
        database.getAveragePlayersPerGamePerRegion(604800,'482'),
        database.getAveragePlayersPerGamePerRegion(604800,'475'),
        database.getAveragePlayersPerGamePerRegion(604800,'476'),
        database.getAveragePlayersPerGamePerRegion(86400,'474'),
        database.getAveragePlayersPerGamePerRegion(86400,'482'),
        database.getAveragePlayersPerGamePerRegion(86400,'475'),
        database.getAveragePlayersPerGamePerRegion(86400,'476'),
        database.getAveragePlayersPerGamePerRegion(3600,'474'),
        database.getAveragePlayersPerGamePerRegion(3600,'482'),
        database.getAveragePlayersPerGamePerRegion(3600,'475'),
        database.getAveragePlayersPerGamePerRegion(3600,'476')
        ]);


    var startTime = performance.now()

    let [
        getPlayersWeekFile,
        getPlayersDayFile,
        getPlayersHourFile
    ] = await Promise.all([
        writeFileWithDictData(getPlayersWeek,'public/views/files/playersLastWeek'),
        writeFileWithDictData(getPlayersDay,'public/views/files/playersLastDay'),
        writeFileWithDictData(getPlayersHour,'public/views/files/playersLastHour')
    ]);

        
var endTime = performance.now()

console.log(`Call to doSomething_files took ${endTime - startTime} milliseconds`)
    res.render('admin', {
        classWinrateSoloLastWeek:classWinrateSoloLastWeek,
        classWinrateDuoLastWeek:classWinrateDuoLastWeek,
        classWinrateTrioLastWeek:classWinrateTrioLastWeek,
        classWinrateSquadLastWeek:classWinrateSquadLastWeek,
        classWinrateSoloLastDay:classWinrateSoloLastDay,
        classWinrateDuoLastDay:classWinrateDuoLastDay,
        classWinrateTrioLastDay:classWinrateTrioLastDay,
        classWinrateSquadLastDay:classWinrateSquadLastDay,
        classWinrateSoloLastHour:classWinrateSoloLastHour,
        classWinrateDuoLastHour:classWinrateDuoLastHour,
        classWinrateTrioLastHour:classWinrateTrioLastHour,
        classWinrateSquadLastHour:classWinrateSquadLastHour,
        totalDelay:             delay,
        lastWeekStats:          lastWeekStats,
        lastWeekStatsSolo:      lastWeekStatsSolo,
        lastWeekStatsDuo:       lastWeekStatsDuo,
        lastWeekStatsTrio:      lastWeekStatsTrio,
        lastWeekStatsSquad:     lastWeekStatsSquad,
        lastDayStats:           lastDayStats,
        lastDayStatsSolo:       lastDayStatsSolo,
        lastDayStatsDuo:       lastDayStatsDuo,
        lastDayStatsTrio:       lastDayStatsTrio,
        lastDayStatsSquad:      lastDayStatsSquad,
        lastHourStats:          lastHourStats,
        lastHourStatsSolo:      lastHourStatsSolo,
        lastHourStatsDuo:      lastHourStatsDuo,
        lastHourStatsTrio:      lastHourStatsTrio,
        lastHourStatsSquad:     lastHourStatsSquad,
        lastWeekCrossplayStatsSolo : lastWeekCrossplayStatsSolo,
        lastWeekCrossplayStatsDuo : lastWeekCrossplayStatsDuo,
        lastWeekCrossplayStatsTrio : lastWeekCrossplayStatsTrio,
        lastWeekCrossplayStatsSquad : lastWeekCrossplayStatsSquad,
        lastDayCrossplayStatsSolo : lastDayCrossplayStatsSolo,
        lastDayCrossplayStatsDuo : lastDayCrossplayStatsDuo,
        lastDayCrossplayStatsTrio : lastDayCrossplayStatsTrio,
        lastDayCrossplayStatsSquad : lastDayCrossplayStatsSquad,
        lastHourCrossplayStatsSolo : lastHourCrossplayStatsSolo,
        lastHourCrossplayStatsDuo : lastHourCrossplayStatsDuo,
        lastHourCrossplayStatsTrio : lastHourCrossplayStatsTrio,
        lastHourCrossplayStatsSquad : lastHourCrossplayStatsSquad,
        lastWeekMatchStatsSolo	: lastWeekMatchStatsSolo	,
        lastWeekMatchStatsDuo   : lastWeekMatchStatsDuo  ,
        lastWeekMatchStatsTrio  : lastWeekMatchStatsTrio ,
        lastWeekMatchStatsSquad : lastWeekMatchStatsSquad,
        lastDayMatchStatsSolo   : lastDayMatchStatsSolo  ,
        lastDayMatchStatsDuo    : lastDayMatchStatsDuo   ,
        lastDayMatchStatsTrio   : lastDayMatchStatsTrio  ,
        lastDayMatchStatsSquad  : lastDayMatchStatsSquad ,
        lastHourMatchStatsSolo  : lastHourMatchStatsSolo ,
        lastHourMatchStatsDuo   : lastHourMatchStatsDuo  ,
        lastHourMatchStatsTrio  : lastHourMatchStatsTrio ,
        lastHourMatchStatsSquad : lastHourMatchStatsSquad
    });
});


//482
routerNonProd.get('/v2_admin*', cache(3600000), async (req, res) => {
        var startTime = performance.now()
    let [
        testingMonth,
        testingWeek,
        testingDay,
        testingHour,
        averagePlayersPerMonthNASolo          	,
        averagePlayersPerMonthNADuo          	,
        averagePlayersPerMonthNATrio          	,
        averagePlayersPerMonthNASquad        	,
        averagePlayersPerMonthBrazilSolo      	,
        averagePlayersPerMonthBrazilDuo       	,
        averagePlayersPerMonthBrazilTrio      	,
        averagePlayersPerMonthBrazilSquad     	,
        averagePlayersPerMonthAustraliaSolo   	,
        averagePlayersPerMonthAustraliaDuo    	,
        averagePlayersPerMonthAustraliaTrio   	,
        averagePlayersPerMonthAustraliaSquad  	,
        averagePlayersPerMonthEUSolo          	,
        averagePlayersPerMonthEUDuo           	,
        averagePlayersPerMonthEUTrio          	,
        averagePlayersPerMonthEUSquad         	,
        averagePlayersPerMonthSoutheastAsiaSolo	,
        averagePlayersPerMonthSoutheastAsiaDuo 	,
        averagePlayersPerMonthSoutheastAsiaTrio	,
        averagePlayersPerMonthSoutheastAsiaSquad,	

        averagePlayersPerWeekNASolo          	,
        averagePlayersPerWeekNADuo          	,
        averagePlayersPerWeekNATrio          	,
        averagePlayersPerWeekNASquad        	,
        averagePlayersPerWeekBrazilSolo      	,
        averagePlayersPerWeekBrazilDuo       	,
        averagePlayersPerWeekBrazilTrio      	,
        averagePlayersPerWeekBrazilSquad     	,
        averagePlayersPerWeekAustraliaSolo   	,
        averagePlayersPerWeekAustraliaDuo    	,
        averagePlayersPerWeekAustraliaTrio   	,
        averagePlayersPerWeekAustraliaSquad  	,
        averagePlayersPerWeekEUSolo          	,
        averagePlayersPerWeekEUDuo           	,
        averagePlayersPerWeekEUTrio          	,
        averagePlayersPerWeekEUSquad         	,
        averagePlayersPerWeekSoutheastAsiaSolo	,
        averagePlayersPerWeekSoutheastAsiaDuo 	,
        averagePlayersPerWeekSoutheastAsiaTrio	,
        averagePlayersPerWeekSoutheastAsiaSquad,	

        averagePlayersPerDayNASolo          	,
        averagePlayersPerDayNADuo          	,
        averagePlayersPerDayNATrio          	,
        averagePlayersPerDayNASquad        	,
        averagePlayersPerDayBrazilSolo      	,
        averagePlayersPerDayBrazilDuo       	,
        averagePlayersPerDayBrazilTrio      	,
        averagePlayersPerDayBrazilSquad     	,
        averagePlayersPerDayAustraliaSolo   	,
        averagePlayersPerDayAustraliaDuo    	,
        averagePlayersPerDayAustraliaTrio   	,
        averagePlayersPerDayAustraliaSquad  	,
        averagePlayersPerDayEUSolo          	,
        averagePlayersPerDayEUDuo           	,
        averagePlayersPerDayEUTrio          	,
        averagePlayersPerDayEUSquad         	,
        averagePlayersPerDaySoutheastAsiaSolo	,
        averagePlayersPerDaySoutheastAsiaDuo 	,
        averagePlayersPerDaySoutheastAsiaTrio	,
        averagePlayersPerDaySoutheastAsiaSquad,	

        averagePlayersPerHourNASolo          	,
        averagePlayersPerHourNADuo          	,
        averagePlayersPerHourNATrio          	,
        averagePlayersPerHourNASquad        	,
        averagePlayersPerHourBrazilSolo      	,
        averagePlayersPerHourBrazilDuo       	,
        averagePlayersPerHourBrazilTrio      	,
        averagePlayersPerHourBrazilSquad     	,
        averagePlayersPerHourAustraliaSolo   	,
        averagePlayersPerHourAustraliaDuo    	,
        averagePlayersPerHourAustraliaTrio   	,
        averagePlayersPerHourAustraliaSquad  	,
        averagePlayersPerHourEUSolo          	,
        averagePlayersPerHourEUDuo           	,
        averagePlayersPerHourEUTrio          	,
        averagePlayersPerHourEUSquad         	,
        averagePlayersPerHourSoutheastAsiaSolo	,
        averagePlayersPerHourSoutheastAsiaDuo 	,
        averagePlayersPerHourSoutheastAsiaTrio	,
        averagePlayersPerHourSoutheastAsiaSquad , 

		sameInputOverTimeMonthSolo ,
		sameInputOverTimeMonthDuo  ,
		sameInputOverTimeMonthTrio ,
		sameInputOverTimeMonthSquad,
		
		sameInputOverTimeWeekSolo  ,
		sameInputOverTimeWeekDuo   ,
		sameInputOverTimeWeekTrio  ,
		sameInputOverTimeWeekSquad ,
								   
		sameInputOverTimeDaySolo   ,
		sameInputOverTimeDayDuo    ,
		sameInputOverTimeDayTrio   ,
		sameInputOverTimeDaySquad  ,
		
		sameInputOverTimeHourSolo  ,
		sameInputOverTimeHourDuo   ,
		sameInputOverTimeHourTrio  ,
		sameInputOverTimeHourSquad 
	
        
    ] = await Promise.all([
        database.graphTestingV1(2630000*12,2630000),
        database.graphTestingV1(604800*5,604800),
        database.graphTestingV1(86400*21,86400),
        database.graphTestingV1(129600,3600),
        
        database.averagePlayersOverTime(2630000*12,2630000,474,'NA'),
        database.averagePlayersOverTime(2630000*12,2630000,483,'NA'),
        database.averagePlayersOverTime(2630000*12,2630000,475,'NA'),
        database.averagePlayersOverTime(2630000*12,2630000,476,'NA'),
        database.averagePlayersOverTime(2630000*12,2630000,474,'Brazil'),
        database.averagePlayersOverTime(2630000*12,2630000,483,'Brazil'),
        database.averagePlayersOverTime(2630000*12,2630000,475,'Brazil'),
        database.averagePlayersOverTime(2630000*12,2630000,476,'Brazil'),
        database.averagePlayersOverTime(2630000*12,2630000,474,'Australia'),
        database.averagePlayersOverTime(2630000*12,2630000,483,'Australia'),
        database.averagePlayersOverTime(2630000*12,2630000,475,'Australia'),
        database.averagePlayersOverTime(2630000*12,2630000,476,'Australia'),
        database.averagePlayersOverTime(2630000*12,2630000,474,'EU'),
        database.averagePlayersOverTime(2630000*12,2630000,483,'EU'),
        database.averagePlayersOverTime(2630000*12,2630000,475,'EU'),
        database.averagePlayersOverTime(2630000*12,2630000,476,'EU'),
        database.averagePlayersOverTime(2630000*12,2630000,474,'Southeast Asia'),
        database.averagePlayersOverTime(2630000*12,2630000,483,'Southeast Asia'),
        database.averagePlayersOverTime(2630000*12,2630000,475,'Southeast Asia'),
        database.averagePlayersOverTime(2630000*12,2630000,476,'Southeast Asia'),

        database.averagePlayersOverTime(604800*14,604800,474,'NA'),
        database.averagePlayersOverTime(604800*14,604800,483,'NA'),
        database.averagePlayersOverTime(604800*14,604800,475,'NA'),
        database.averagePlayersOverTime(604800*14,604800,476,'NA'),
        database.averagePlayersOverTime(604800*14,604800,474,'Brazil'),
        database.averagePlayersOverTime(604800*14,604800,483,'Brazil'),
        database.averagePlayersOverTime(604800*14,604800,475,'Brazil'),
        database.averagePlayersOverTime(604800*14,604800,476,'Brazil'),
        database.averagePlayersOverTime(604800*14,604800,474,'Australia'),
        database.averagePlayersOverTime(604800*14,604800,483,'Australia'),
        database.averagePlayersOverTime(604800*14,604800,475,'Australia'),
        database.averagePlayersOverTime(604800*14,604800,476,'Australia'),
        database.averagePlayersOverTime(604800*14,604800,474,'EU'),
        database.averagePlayersOverTime(604800*14,604800,483,'EU'),
        database.averagePlayersOverTime(604800*14,604800,475,'EU'),
        database.averagePlayersOverTime(604800*14,604800,476,'EU'),
        database.averagePlayersOverTime(604800*14,604800,474,'Southeast Asia'),
        database.averagePlayersOverTime(604800*14,604800,483,'Southeast Asia'),
        database.averagePlayersOverTime(604800*14,604800,475,'Southeast Asia'),
        database.averagePlayersOverTime(604800*14,604800,476,'Southeast Asia'),
		
		database.averagePlayersOverTime(86400*14,86400,474,'NA'),
        database.averagePlayersOverTime(86400*14,86400,483,'NA'),
        database.averagePlayersOverTime(86400*14,86400,475,'NA'),
        database.averagePlayersOverTime(86400*14,86400,476,'NA'),
        database.averagePlayersOverTime(86400*14,86400,474,'Brazil'),
        database.averagePlayersOverTime(86400*14,86400,483,'Brazil'),
        database.averagePlayersOverTime(86400*14,86400,475,'Brazil'),
        database.averagePlayersOverTime(86400*14,86400,476,'Brazil'),
        database.averagePlayersOverTime(86400*14,86400,474,'Australia'),
        database.averagePlayersOverTime(86400*14,86400,483,'Australia'),
        database.averagePlayersOverTime(86400*14,86400,475,'Australia'),
        database.averagePlayersOverTime(86400*14,86400,476,'Australia'),
        database.averagePlayersOverTime(86400*14,86400,474,'EU'),
        database.averagePlayersOverTime(86400*14,86400,483,'EU'),
        database.averagePlayersOverTime(86400*14,86400,475,'EU'),
        database.averagePlayersOverTime(86400*14,86400,476,'EU'),
        database.averagePlayersOverTime(86400*14,86400,474,'Southeast Asia'),
        database.averagePlayersOverTime(86400*14,86400,483,'Southeast Asia'),
        database.averagePlayersOverTime(86400*14,86400,475,'Southeast Asia'),
        database.averagePlayersOverTime(86400*14,86400,476,'Southeast Asia'),

        database.averagePlayersOverTime(3600*24,3600 ,474,'NA'),
        database.averagePlayersOverTime(3600*24,3600 ,483,'NA'),
        database.averagePlayersOverTime(3600*24,3600 ,475,'NA'),
        database.averagePlayersOverTime(3600*24,3600 ,476,'NA'),
        database.averagePlayersOverTime(3600*24,3600 ,474,'Brazil'),
        database.averagePlayersOverTime(3600*24,3600 ,483,'Brazil'),
        database.averagePlayersOverTime(3600*24,3600 ,475,'Brazil'),
        database.averagePlayersOverTime(3600*24,3600 ,476,'Brazil'),
        database.averagePlayersOverTime(3600*24,3600 ,474,'Australia'),
        database.averagePlayersOverTime(3600*24,3600 ,483,'Australia'),
        database.averagePlayersOverTime(3600*24,3600 ,475,'Australia'),
        database.averagePlayersOverTime(3600*24,3600 ,476,'Australia'),
        database.averagePlayersOverTime(3600*24,3600 ,474,'EU'),
        database.averagePlayersOverTime(3600*24,3600 ,483,'EU'),
        database.averagePlayersOverTime(3600*24,3600 ,475,'EU'),
        database.averagePlayersOverTime(3600*24,3600 ,476,'EU'),
        database.averagePlayersOverTime(3600*24,3600 ,474,'Southeast Asia'),
        database.averagePlayersOverTime(3600*24,3600 ,483,'Southeast Asia'),
        database.averagePlayersOverTime(3600*24,3600 ,475,'Southeast Asia'),
        database.averagePlayersOverTime(3600*24,3600 ,476,'Southeast Asia'),

        database.sameInputPlayersOverTime(2630000*12,2630000,474),
        database.sameInputPlayersOverTime(2630000*12,2630000,483),
        database.sameInputPlayersOverTime(2630000*12,2630000,475),
        database.sameInputPlayersOverTime(2630000*12,2630000,476),
        

        database.sameInputPlayersOverTime(604800*14,604800,474),
        database.sameInputPlayersOverTime(604800*14,604800,483),
        database.sameInputPlayersOverTime(604800*14,604800,475),
        database.sameInputPlayersOverTime(604800*14,604800,476),
        
		
		database.sameInputPlayersOverTime(86400*14,86400,474),
        database.sameInputPlayersOverTime(86400*14,86400,483),
        database.sameInputPlayersOverTime(86400*14,86400,475),
        database.sameInputPlayersOverTime(86400*14,86400,476),
        

        database.sameInputPlayersOverTime(3600*24,3600 ,474),
        database.sameInputPlayersOverTime(3600*24,3600 ,483),
        database.sameInputPlayersOverTime(3600*24,3600 ,475),
        database.sameInputPlayersOverTime(3600*24,3600 ,476)
    
        ]);
       var endTime = performance.now()
        console.log(`Call to doSomething1 took ${endTime - startTime} milliseconds`)
    res.render('v2_admin', {
        testingMonth:testingMonth,
        testingWeek:testingWeek,
        testingDay:testingDay,
        testingHour:testingHour,

        averagePlayersPerMonthNASolo          	: averagePlayersPerMonthNASolo,
        averagePlayersPerMonthNADuo          		: averagePlayersPerMonthNADuo,
        averagePlayersPerMonthNATrio          	: averagePlayersPerMonthNATrio,
        averagePlayersPerMonthNASquad        		: averagePlayersPerMonthNASquad,
        averagePlayersPerMonthBrazilSolo      	: averagePlayersPerMonthBrazilSolo,
        averagePlayersPerMonthBrazilDuo       	: averagePlayersPerMonthBrazilDuo,
        averagePlayersPerMonthBrazilTrio      	: averagePlayersPerMonthBrazilTrio,
        averagePlayersPerMonthBrazilSquad     	: averagePlayersPerMonthBrazilSquad,
        averagePlayersPerMonthAustraliaSolo   	: averagePlayersPerMonthAustraliaSolo,
        averagePlayersPerMonthAustraliaDuo    	: averagePlayersPerMonthAustraliaDuo,
        averagePlayersPerMonthAustraliaTrio   	: averagePlayersPerMonthAustraliaTrio,
        averagePlayersPerMonthAustraliaSquad  	: averagePlayersPerMonthAustraliaSquad,
        averagePlayersPerMonthEUSolo          	: averagePlayersPerMonthEUSolo,
        averagePlayersPerMonthEUDuo           	: averagePlayersPerMonthEUDuo,
        averagePlayersPerMonthEUTrio          	: averagePlayersPerMonthEUTrio,
        averagePlayersPerMonthEUSquad         	: averagePlayersPerMonthEUSquad,
        averagePlayersPerMonthSoutheastAsiaSolo	: averagePlayersPerMonthSoutheastAsiaSolo,
        averagePlayersPerMonthSoutheastAsiaDuo 	: averagePlayersPerMonthSoutheastAsiaDuo,
        averagePlayersPerMonthSoutheastAsiaTrio	: averagePlayersPerMonthSoutheastAsiaTrio,
        averagePlayersPerMonthSoutheastAsiaSquad	: averagePlayersPerMonthSoutheastAsiaSquad,

        averagePlayersPerWeekNASolo          	: averagePlayersPerWeekNASolo,
        averagePlayersPerWeekNADuo          		: averagePlayersPerWeekNADuo,
        averagePlayersPerWeekNATrio          	: averagePlayersPerWeekNATrio,
        averagePlayersPerWeekNASquad        		: averagePlayersPerWeekNASquad,
        averagePlayersPerWeekBrazilSolo      	: averagePlayersPerWeekBrazilSolo,
        averagePlayersPerWeekBrazilDuo       	: averagePlayersPerWeekBrazilDuo,
        averagePlayersPerWeekBrazilTrio      	: averagePlayersPerWeekBrazilTrio,
        averagePlayersPerWeekBrazilSquad     	: averagePlayersPerWeekBrazilSquad,
        averagePlayersPerWeekAustraliaSolo   	: averagePlayersPerWeekAustraliaSolo,
        averagePlayersPerWeekAustraliaDuo    	: averagePlayersPerWeekAustraliaDuo,
        averagePlayersPerWeekAustraliaTrio   	: averagePlayersPerWeekAustraliaTrio,
        averagePlayersPerWeekAustraliaSquad  	: averagePlayersPerWeekAustraliaSquad,
        averagePlayersPerWeekEUSolo          	: averagePlayersPerWeekEUSolo,
        averagePlayersPerWeekEUDuo           	: averagePlayersPerWeekEUDuo,
        averagePlayersPerWeekEUTrio          	: averagePlayersPerWeekEUTrio,
        averagePlayersPerWeekEUSquad         	: averagePlayersPerWeekEUSquad,
        averagePlayersPerWeekSoutheastAsiaSolo	: averagePlayersPerWeekSoutheastAsiaSolo,
        averagePlayersPerWeekSoutheastAsiaDuo 	: averagePlayersPerWeekSoutheastAsiaDuo,
        averagePlayersPerWeekSoutheastAsiaTrio	: averagePlayersPerWeekSoutheastAsiaTrio,
        averagePlayersPerWeekSoutheastAsiaSquad	: averagePlayersPerWeekSoutheastAsiaSquad,

        averagePlayersPerDayNASolo          	: averagePlayersPerDayNASolo,
        averagePlayersPerDayNADuo          		: averagePlayersPerDayNADuo,
        averagePlayersPerDayNATrio          	: averagePlayersPerDayNATrio,
        averagePlayersPerDayNASquad        		: averagePlayersPerDayNASquad,
        averagePlayersPerDayBrazilSolo      	: averagePlayersPerDayBrazilSolo,
        averagePlayersPerDayBrazilDuo       	: averagePlayersPerDayBrazilDuo,
        averagePlayersPerDayBrazilTrio      	: averagePlayersPerDayBrazilTrio,
        averagePlayersPerDayBrazilSquad     	: averagePlayersPerDayBrazilSquad,
        averagePlayersPerDayAustraliaSolo   	: averagePlayersPerDayAustraliaSolo,
        averagePlayersPerDayAustraliaDuo    	: averagePlayersPerDayAustraliaDuo,
        averagePlayersPerDayAustraliaTrio   	: averagePlayersPerDayAustraliaTrio,
        averagePlayersPerDayAustraliaSquad  	: averagePlayersPerDayAustraliaSquad,
        averagePlayersPerDayEUSolo          	: averagePlayersPerDayEUSolo,
        averagePlayersPerDayEUDuo           	: averagePlayersPerDayEUDuo,
        averagePlayersPerDayEUTrio          	: averagePlayersPerDayEUTrio,
        averagePlayersPerDayEUSquad         	: averagePlayersPerDayEUSquad,
        averagePlayersPerDaySoutheastAsiaSolo	: averagePlayersPerDaySoutheastAsiaSolo,
        averagePlayersPerDaySoutheastAsiaDuo 	: averagePlayersPerDaySoutheastAsiaDuo,
        averagePlayersPerDaySoutheastAsiaTrio	: averagePlayersPerDaySoutheastAsiaTrio,
        averagePlayersPerDaySoutheastAsiaSquad	: averagePlayersPerDaySoutheastAsiaSquad,

        averagePlayersPerHourNASolo          	: averagePlayersPerHourNASolo,
        averagePlayersPerHourNADuo          		: averagePlayersPerHourNADuo,
        averagePlayersPerHourNATrio          	: averagePlayersPerHourNATrio,
        averagePlayersPerHourNASquad        		: averagePlayersPerHourNASquad,
        averagePlayersPerHourBrazilSolo      	: averagePlayersPerHourBrazilSolo,
        averagePlayersPerHourBrazilDuo       	: averagePlayersPerHourBrazilDuo,
        averagePlayersPerHourBrazilTrio      	: averagePlayersPerHourBrazilTrio,
        averagePlayersPerHourBrazilSquad     	: averagePlayersPerHourBrazilSquad,
        averagePlayersPerHourAustraliaSolo   	: averagePlayersPerHourAustraliaSolo,
        averagePlayersPerHourAustraliaDuo    	: averagePlayersPerHourAustraliaDuo,
        averagePlayersPerHourAustraliaTrio   	: averagePlayersPerHourAustraliaTrio,
        averagePlayersPerHourAustraliaSquad  	: averagePlayersPerHourAustraliaSquad,
        averagePlayersPerHourEUSolo          	: averagePlayersPerHourEUSolo,
        averagePlayersPerHourEUDuo           	: averagePlayersPerHourEUDuo,
        averagePlayersPerHourEUTrio          	: averagePlayersPerHourEUTrio,
        averagePlayersPerHourEUSquad         	: averagePlayersPerHourEUSquad,
        averagePlayersPerHourSoutheastAsiaSolo	: averagePlayersPerHourSoutheastAsiaSolo,
        averagePlayersPerHourSoutheastAsiaDuo 	: averagePlayersPerHourSoutheastAsiaDuo,
        averagePlayersPerHourSoutheastAsiaTrio	: averagePlayersPerHourSoutheastAsiaTrio,
        averagePlayersPerHourSoutheastAsiaSquad	: averagePlayersPerHourSoutheastAsiaSquad,
        
		sameInputOverTimeMonthSolo :sameInputOverTimeMonthSolo ,
		sameInputOverTimeMonthDuo  :sameInputOverTimeMonthDuo  ,
		sameInputOverTimeMonthTrio :sameInputOverTimeMonthTrio ,
		sameInputOverTimeMonthSquad:sameInputOverTimeMonthSquad,
															   
		sameInputOverTimeWeekSolo  :sameInputOverTimeWeekSolo  ,
		sameInputOverTimeWeekDuo   :sameInputOverTimeWeekDuo   ,
		sameInputOverTimeWeekTrio  :sameInputOverTimeWeekTrio  ,
		sameInputOverTimeWeekSquad :sameInputOverTimeWeekSquad ,
															   
		sameInputOverTimeDaySolo   :sameInputOverTimeDaySolo   ,
		sameInputOverTimeDayDuo    :sameInputOverTimeDayDuo    ,
		sameInputOverTimeDayTrio   :sameInputOverTimeDayTrio   ,
		sameInputOverTimeDaySquad  :sameInputOverTimeDaySquad  ,
															   
		sameInputOverTimeHourSolo  :sameInputOverTimeHourSolo  ,
		sameInputOverTimeHourDuo   :sameInputOverTimeHourDuo   ,
		sameInputOverTimeHourTrio  :sameInputOverTimeHourTrio  ,
		sameInputOverTimeHourSquad :sameInputOverTimeHourSquad ,
    });
});



routerNonProd.post('/match', async function (req, res) {
    res.redirect(303, `/match/${req.body.search}`)
});

routerNonProd.get('/leaderboard*', cache(30000), async (req, res) => {


    let [highestSoloKills, HighestTeamKills,monthlyLeaderboard] = await Promise.all([
        database.getHighestIndivKills(),
        database.getHighestTeamKills(),
        database.getMonthlyRealmLeaderboardStats()
    ]);

    res.render('leaderboard', {
        highestSoloKills:highestSoloKills,
        HighestTeamKills:HighestTeamKills,
        monthlyLeaderboard:monthlyLeaderboard
    });
});

routerNonProd.get('*', cache(5000), (req, res) => {
    res.render('404');
});

app.listen(80);

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
}

// below if for future steam login things potentially
var req = exports = module.exports = {};

req.login = req.logIn = function (user, options, done) {
    if (typeof options == 'function') {
        done = options;
        options = {};
    }
    options = options || {};

    var property = 'user';
    if (this._passport && this._passport.instance) {
        property = this._passport.instance._userProperty || 'user';
    }
    var session = (options.session === undefined) ? true : options.session;

    this[property] = user;
    if (session) {
        if (!this._passport) {
            throw new Error('passport.initialize() middleware not in use');
        }
        if (typeof done != 'function') {
            throw new Error('req#login requires a callback function');
        }

        var self = this;
        this._passport.instance.serializeUser(user, this, function (err, obj) {
            if (err) {
                self[property] = null;
                return done(err);
            }
            if (!self._passport.session) {
                self._passport.session = {};
            }
            self._passport.session.user = obj;
            if (!self.session) {
                self.session = {};
            }
            self.session[self._passport.instance._key] = self._passport.session;
            done();
        });
    } else {
        done && done();
    }
};

req.logout = req.logOut = function () {
    var property = 'user';
    if (this._passport && this._passport.instance) {
        property = this._passport.instance._userProperty || 'user';
    }

    this[property] = null;
    if (this._passport && this._passport.session) {
        delete this._passport.session.user;
    }
};

req.isAuthenticated = function () {
    var property = 'user';
    if (this._passport && this._passport.instance) {
        property = this._passport.instance._userProperty || 'user';
    }

    return (this[property]) ? true : false;
};

req.isUnauthenticated = function () {
    return !this.isAuthenticated();
};
