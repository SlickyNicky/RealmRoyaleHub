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

let databaseConfig = require('./public/scripts/realmRoyaleDatabase.js');

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

function sortTopPlayers(players) {
    let result = {};
    for (const player in players) {
        if (result[queueValues[players[player]['queueTypeID']]] === undefined) {
            result[queueValues[players[player]['queueTypeID']]] = []
        }
        result[queueValues[players[player]['queueTypeID']]].push([
            {'score': convertMMRToRank(players[player]['mmrRankingNumber'])},
            {'profileLink': `https://realm.slickynicky.com/stats/${players[player]['playerID']}`}
        ])
    }
    return result
}

function formatPlayerMMR(player) {
    for (const playerDetails in player) {
        player[playerDetails]['queueTypeID'] = queueValues[player[playerDetails]['queueTypeID']]
        player[playerDetails]['mmrRankingNumber'] = convertMMRToRank(player[playerDetails]['mmrRankingNumber'])
    }
    return player
}

const winston = require('winston');

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
            logger.error(`cache:::found_cache_hit::${req.originalUrl || req.url}`)
            res.send(cachedBody)
            return
        } else {
            logger.error(`cache:::miss_cache_hit::${req.originalUrl || req.url}`)
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

routerNonProd.get('/orgTourney*', async (req, res) => {
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
                let split = tourneyOverview['pointsPerPlacement'].split(',')
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
                                tempKillsTotalPoints.push(parseInt(value['teams'][overallTeams][team][player]['kills_player']) * tourneyOverview['pointsPerKill'])
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
                        if (highestGames[teamName[0][0] + "|" + teamName[0][1]].length < tourneyOverview['bestOfGames']) {
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
                if (tourneyOverview['sortByLowestPoints'] !== 1) {
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


                tourneyOverview['sortByLowestPoints'] = (tourneyOverview['sortByLowestPoints'] === 1)

                res.render('orgTourney', {
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
                    publicLink: publicLinkTemp
                });
            } else {

                // means hash and/or tourney name don't match with anything in db
                res.redirect(`/orgtourney/${tourneyAndHash[0]}/${tourneyAndHash[1]}`)
            }
        } else if (tourneyAndHash.length === 2) {

            let tourneyOverview = (await database.getTourneyInfo(tourneyAndHash[0], tourneyAndHash[1]))[0]

            let totalGamesOutput = (await database.getTourneyGameTotalInfo(tourneyAndHash[0], tourneyAndHash[1], tourneyAndHash[2]))
            const totalGamesOutputMap = new Map();
            const totalGamesQueueOutputMap = new Map();

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

            let split = tourneyOverview['pointsPerPlacement'].split(',')
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
                            tempKillsTotalPoints.push(parseInt(value['teams'][overallTeams][team][player]['kills_player']) * tourneyOverview['pointsPerKill'])
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
                    if (highestGames[teamName[0][0] + "|" + teamName[0][1]].length < tourneyOverview['bestOfGames']) {
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
            if (tourneyOverview['sortByLowestPoints'] !== 1) {
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


            tourneyOverview['sortByLowestPoints'] = (tourneyOverview['sortByLowestPoints'] === 1)


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
        parseInt(tourneyNumber),
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

routerNonProd.get('/orgLeague*', cache(15000), async (req, res) => {
    let tourneyUrl = (req.originalUrl).split('/orgLeague/')[1];
    if (tourneyUrl !== undefined && tourneyUrl !== '') {
        let tourneyAndHash = tourneyUrl.split('/');
        if (tourneyAndHash.length > 2) {

            if (await database.leagueHashChecker(tourneyAndHash[0], tourneyAndHash[1], tourneyAndHash[2]) !== '') {

                // means the hash and the tourney name match up
                let tourneyOverview = (await database.getLeagueInfo(tourneyAndHash[0], tourneyAndHash[1], tourneyAndHash[2]))[0]
                let totalGamesOutput = (await database.getLeagueGameTotalInfo(tourneyAndHash[0], tourneyAndHash[1], tourneyAndHash[2]))
                let totalAmountOfGames = (await database.getLeagueTotalGamesEntered(tourneyAndHash[0], tourneyAndHash[1]))
                const totalGamesOutputMap = new Map();
                const totalGamesQueueOutputMap = new Map();

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
                let split = tourneyOverview['pointsPerPlacement'].split(',')
                for (const val in split) {
                    let index = parseInt(val) + 1
                    totalPlacementPoints.set(index, split[val]);
                }

                // structure of win
                // -> team names : points
                // |
                //                  \-> placement + kill point amount from input
                var teamDict = {};
                var highestGames = {};
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
                                tempKillsTotalPoints.push(parseInt(value['teams'][overallTeams][team][player]['kills_player']) * tourneyOverview['pointsPerKill'])
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
                        if (highestGames[teamName[0][0] + "|" + teamName[0][1]].length < tourneyOverview['bestOfGames']) {
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
                if (tourneyOverview['sortByLowestPoints'] !== 1) {
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


                tourneyOverview['sortByLowestPoints'] = (tourneyOverview['sortByLowestPoints'] === 1)

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
            const totalPlacementPoints = new Map();
            let split = tourneyOverview['pointsPerPlacement'].split(',')
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
                            tempKillsTotalPoints.push(parseInt(value['teams'][overallTeams][team][player]['kills_player']) * tourneyOverview['pointsPerKill'])
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
                    if (highestGames[teamName[0][0] + "|" + teamName[0][1]].length < tourneyOverview['bestOfGames']) {
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
            if (tourneyOverview['sortByLowestPoints'] !== 1) {
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


            tourneyOverview['sortByLowestPoints'] = (tourneyOverview['sortByLowestPoints'] === 1)

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

routerNonProd.get('/mmr*', cache(15000), async (req, res) => {

    let playerUrl = (req.originalUrl).split('/mmr/')[1]
    if (playerUrl !== undefined && playerUrl !== '') {

        if (playerUrl !== undefined && playerUrl !== '') {
            let playerId;

            playerId = (await database.callApi("SearchPlayers", true, 'SearchPlayers', playerUrl))[0]
            try {
                // this solves the case of id: 123412 name: 123412414151 and the name profile being pulled back....design decision
                if (playerId['name'] !== `${playerUrl}`) {
                    playerId = playerUrl
                } else {
                    playerId = playerId['id']
                }
            } catch (e) {
                playerId = playerUrl
            }

            req.session.getPlayerProfileStats = await database.callApi("GetPlayer", true, 'GetPlayer', playerId, 'hirez')

            req.session.findPlayerStatsOverall = formatPlayerMMR(await database.mmrPlayerGetStats(playerId))

            req.session.bestPlayers = sortTopPlayers(await database.mmrGetTopPlayersTemp())

            res.render('mmr', {
                displayStats: true,
                queueStats: req.session.findPlayerStatsOverall,
                bestPlayers: req.session.bestPlayers,
                playerStats: req.session.getPlayerProfileStats
            });
        } else {
            let topPlayerMMRStats = await database.mmrGetTopPlayersTemp()
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
        let topPlayerMMRStats = await database.mmrGetTopPlayersTemp()
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

routerNonProd.get('/stats*',cache(15000), async (req, res) => {

    let playerUrl = (req.originalUrl).split('/stats/')[1]
    if (playerUrl !== undefined && playerUrl !== '') {

        if (playerUrl !== undefined && playerUrl !== '') {
            let playerId;

            playerId = (await database.callApi("SearchPlayers", true, 'SearchPlayers', playerUrl))[0]
            try {
                // this solves the case of id: 123412 name: 123412414151 and the name profile being pulled back....design decision


                if (playerId['name'] !== `${playerUrl}`) {
                    playerId = playerUrl
                } else {
                    playerId = playerId['id']
                }
            } catch (e) {
                playerId = playerUrl
            }

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


                // req.session.getAggStats = await database.callApi("GetPlayerStats", true, 'GetPlayerStats', playerId)
                req.session.findPlayerStatsOverall = agStats
                req.session.getLastFifty = await database.callApi("GetPlayerMatchHistory", true, 'GetPlayerMatchHistory', playerId)

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

routerNonProd.get('/match*', cache(30000), async (req, res) => {
    let tourneyUrl = (req.originalUrl).split('/match/')[1];
    if (tourneyUrl !== undefined && tourneyUrl !== '') {
        let tourneyAndHash = tourneyUrl.split('/');
        if (tourneyAndHash.length === 1) {
            let match = await database.callApi(
                "GetMatchDetails",
                true,
                'GetMatchDetails',
                tourneyAndHash[0]
            )
            if (match['ret_msg'] === `No Match Details:${tourneyAndHash[0]}`) {
                res.render('match', {
                    renderDetails: false
                });
            } else {
                res.render('match', {
                    renderDetails: true,
                    matchDetails: match
                });
            }
        }
    } else {
        res.render('match', {
            renderDetails: false
        });
    }
});

routerNonProd.post('/match', async function (req, res) {
    res.redirect(303, `/match/${req.body.search}`)
});

routerNonProd.get('*', cache(1500000), (req, res) => {
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
