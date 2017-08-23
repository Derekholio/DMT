//Node Variables
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http, {
    'pingInterval': 1000,
    'pingTimeout': 5000
});
var Sentencer = require("sentencer");
var fs = require("fs");
var mysql = require("mysql");
var crypto = require('crypto');
var port = process.env.PORT || 8080;

var fileName = "./config.json";

try {
    var config = require(fileName);
} catch (err) {
    console.log("Missing configuration file! (config.json)");
    throw err;
}

var con = mysql.createConnection({
    host: config.host,
    user: config.username,
    password: config.password,
    database: config.db
});

con.connect(function (err) {
    if (err) throw err;
});

var algorithm = config.algo;
var algorithmPassword = config.algoPassword;


//DMT Variables
var userCount = 0;
var drawHistory = [];

//Game Object
var game = {
    inProgress: false,
    players: [],
    //currentTurn: -1,
    currentPlayer: null,
    currentWord: "",
    currentWordSolved: "",
    roundTimeout: 150,
    canGuess: false,
    mode: null,
    modes: {
        "REGULAR": 1,
        "ENDLESS": 2
    },
    playerStates: {
        "PLAYER": 1,
        "SPECTATOR": 2
    }
};

//timers object
var timers = {
    roundTimer: null,
    letterTimer: null,
    roundTimeLeft: 0
};

var cursorsDirectory = "css/cursors/";
var cursors = ["skeleton.gif", "spinner.gif", "horse.gif", "court.png", "pencil.cur"];

//HAndles Node server web page serving.  Currently Not used.
app.get('/', function (req, res) {
    //res.sendFile(__dirname + '/index.html');
});

//Starts local node webserver to listen on 3000
http.listen(port, function () {
    console.log('listening on *:' + port);
});



//Listens for socket connection event.  Once connected we attach our logic listeners.  Also handles initial connection stuff
io.on('connection', function (socket) {
    console.log("[" + socket.id + "] NEW CONNECTION: " + socket.request.connection.remoteAddress);
    userCount += 1;

    socket.on("init", function (data) {
        //setsup temporary player object

        var player = {
            username: Sentencer.make("{{adjective}} {{noun}}"),
            socket: socket.id,
            isPlaying: false,
            hasDrawn: false,
            drawing: false,
            points: 0,
            wins: 0,
            cursor: getRandomCursor(),
            ready: false,
            state: game.playerStates.PLAYER,
            loggedIn: false
        };

        if (data.c != null) {
            var sql = "SELECT * FROM users WHERE SECRET = ?";
            con.query(sql, [data.c], function (err, result) {
                if (err) throw err;
                if (result.length > 0) {
                    console.log(result);
                    player.loggedIn = true;

                    player.username = result[0].USERNAME;
                    player.wins = result[0].WINS;
                    player.cursor = result[0].CURSORS;
                }
            });


        }

        setTimeout(function () {
            //asynch gods forgive me

            var initPayload = {
                username: player.username,
                inProgress: game.inProgress,
                ready: player.ready,
                loggedIn: player.loggedIn,
                cursor: player.cursor
            };

            var msg = {
                text: player.username + " joined the game!"
            };

            if (game.inProgress) {
                if (game.mode == game.modes.ENDLESS) {
                    //player.isPlaying = true;
                } else {
                    msg = {
                        text: player.username + " joined the game! (SPECTATING)"
                    };
                }

                initPayload.roundTimeLeft = timers.roundTimeLeft;
                initPayload.cursor = game.currentPlayer.cursor;

                socket.emit('init', initPayload);
                sendWordToClient();
                sendGameMode();

            } else {
                //player.isPlaying = true;
                socket.emit('init', initPayload);
            }

            io.emit("chatMessage", msg);
            game.players.push(player);
            sendPlayersList();

            //emits usercount to be displayed on page.  May replace with inital start payload
            io.emit('userCount', userCount);


            //forgive me father for I have sinned 
        }, 500);

    });

    //clears canvas event (cls button)
    socket.on("clearScreen", function () {
        io.emit("clearScreen");
    });

    //forces end game
    socket.on("endGame", function () {
        endGame();
    });

    socket.on("joinGame", function () {
        if (game.inProgress) {
            if (game.mode == game.modes.ENDLESS) {
                var p = findPlayerBySocket(socket);

                if (p.state == game.playerStates.PLAYER) {
                    p.isPlaying = true;
                }
            }
        }
    });

    //on message from chat
    socket.on('chatMessage', function (msg) {

        console.log("[" + socket.id + "] [CHAT MESSAGE]: ", msg);

        if (msg.text.length > 0) {
            var g = msg.text;
            var status = "";
            var p = findPlayerBySocket(socket);

            /* if (!findPlayerByUsername(msg.username).isPlaying && game.inProgress) {
                 status = "(SPECTATING) ";
             }*/

            if (p.state == game.playerStates.SPECTATOR && game.inProgress) {
                status = "(SPECTATOR)";
            } else if (p.state == game.playerStates.SPECTATOR && game.inProgress && !p.isPlaying) {
                status = "(SPECTATOR)";
            }

            msg.text = status + p.username + ": " + msg.text;
            io.emit('chatMessage', msg);

            if (game.inProgress && p.isPlaying) {
                doGuess(g, p);
            }

        }
    });

    //on client disconnect.  removes player and updates player list
    socket.on('disconnect', function () {
        console.log("[" + socket.id + "] DISCONNECTED");
        userCount -= 1;

        //removes player from games player queue
        game.players.forEach(function (item, i) {
            if (item.socket == socket.id) {
                if (item == game.currentPlayer) {
                    roundWin("Nobody");
                }
                game.players.splice(i, 1);
            }
        });

        if (game.players.length == 0 && game.inProgress) {
            endGame();
        }

        //io.emit("playerAddedStart", game.players);
        sendPlayersList();
    });


    //on background color updates.  sends background color, then drawing points to keep drawing intact
    socket.on("backgroundColorUpdate", function (color) {
        io.emit("backgroundColorUpdate", color);
        io.emit("drawHistory", drawHistory);

    });

    //
    //on drawing event
    socket.on('drawing', function (data) {
        socket.broadcast.emit('drawing', data);
        drawHistory.push(data);


        if (drawHistory.length > 200) {
            io.emit("disableBackgroundChange");
        }
    });

    socket.on("drawerMouseMove", function (mouse) {
        io.emit("drawerMouseMove", mouse);
    });

    socket.on("playerReady", function (status) {
        findPlayerBySocket(socket).ready = status;
        sendPlayersList();
    });

    socket.on("playerPlayer", function (status) {
        var p = findPlayerBySocket(socket);

        if (status) {
            p.state = game.playerStates.PLAYER;
        } else {
            p.state = game.playerStates.SPECTATOR;
        }

        sendPlayersList();
    });

    socket.on("registerPlayer", function (data) {
        var username = data.username;
        var password = encrypt(data.password);
        var cursor = data.cursor;

        //var values = [username, password, cursor];
        var values = {
            USERNAME: username,
            PASSWORD: password,
            CURSORS: cursor
        };

        var sql;

        sql = "SELECT * FROM users WHERE USERNAME = ?";

        con.query(sql, [username], function (err, result) {
            if (err) throw err;

            if (result.length == 0) {
                sql = "INSERT INTO users SET ?";

                con.query(sql, values, function (err, result) {
                    if (err) throw err;
                    io.sockets.connected[socket.id].emit("registerSuccess", {
                        result: true
                    });
                });
            } else {
                io.sockets.connected[socket.id].emit("registerSuccess", {
                    result: false
                });
            }
        });

    });

    socket.on("updatePlayerSettings", function (data) {
        var cursor = data.cursor;
        var p = findPlayerBySocket(socket);

        var sql = "UPDATE users SET CURSORS = ? WHERE USERNAME = ?";
        con.query(sql, [cursor, p.username], function (err, result) {
            if (err) throw err;

            findPlayerBySocket(socket).cursor = cursor;

            io.sockets.connected[socket.id].emit("registerSuccess", {
                result: true
            });
        });

    });

    socket.on("login", function (data) {
        var username = data.username;
        var password = encrypt(data.password);

        var result = false;
        var secret = "";

        var sql = 'SELECT * FROM users WHERE USERNAME = ? AND PASSWORD = ?';
        con.query(sql, [username, password], function (err, result) {
            if (err) throw err;

            if (result.length > 0) {
                result = true;
                secret = encrypt("" + Math.random() * 100000 + "" + Math.random() * 100000 + "" + Math.random() * 100000);
                console.log("OK1");

                if (result) {
                    sql = "UPDATE users SET SECRET = ? WHERE USERNAME = ? AND PASSWORD = ?";
                    con.query(sql, [secret, username, password], function (err, rows, fields) {});
                    io.sockets.connected[socket.id].emit("login", {
                        result: result,
                        secret: secret
                    });
                    console.log("OK2");
                }
            } else {
                io.sockets.connected[socket.id].emit("login", {
                    result: false,
                    secret: ""
                });
            }
        });
    });

    //on game start request (button clicked)
    socket.on("startGame", startGame);

}); // END IO.ON




/////////////////////////////////////////////////
///////////GAME FUNCTIONS///////////////////////
///////////////////////////////////////////////



//handles starting of the game and setting of initial variabes
function startGame(event) {

    game.mode = event.gameMode;
    sendGameMode();

    console.log("[GAME EVENT] GAME STARTING");
    game.inProgress = true;
    clearTimers();

    //  game.currentTurn = -1;
    game.currentPlayer = null;

    game.players.forEach(function (player) {
        player.points = 0;
        if (player.ready && player.state == game.playerStates.PLAYER) {
            player.isPlaying = true;
        }
        player.hasDrawn = false;
        player.drawing = false;
    });

    io.emit("gameStarted");
    newRound();
    //updatePlayerTurn();
    // getNewWord();

    //sendWordToClient();
    //io.sockets.connected[game.currentPlayer.socket].emit('wordUpdateSolved', game.currentWordSolved.toUpperCase());
}

//Returns Time in Seconds
function getTime() {
    return Math.floor(Date.now() / 1000);
}


//updates the players turn
function updatePlayerTurn() {
    console.log("[GAME EVENT] UPDATING PLAYER TURN");
    //game.currentTurn += 1;
    if (game.currentPlayer != null) {
        game.currentPlayer.drawing = false;
        game.currentPlayer.hasDrawn = true;
    }

    game.currentPlayer = null;

    game.players.forEach(function (player) {
        if (player.hasDrawn == false && player.isPlaying && game.currentPlayer == null) {
            game.currentPlayer = player;
        }

    });

    if (game.currentPlayer == null) {
        if (game.mode == game.modes.ENDLESS) {
            var count = 0;

            game.players.forEach(function (player) {
                player.hasDrawn = false;

                if (player.isPlaying) {
                    count++;
                }
            });

            if (count > 0) {
                updatePlayerTurn();
            } else {
                endGame();
            }

        } else {
            endGame();
        }
    } else {
        game.currentPlayer.drawing = true;

        io.emit("nextTurnPlayer", {
            who: game.currentPlayer.username,
            cursor: game.currentPlayer.cursor
        });

        io.sockets.connected[game.currentPlayer.socket].emit('yourTurn', {
            cursor: game.currentPlayer.cursor
        });
    }

}


//handles the guessing from chat
function doGuess(guess, user) {
    /* if (guess.length == 1) {
         for (var x = 0; x <= game.currentWordSolved.length; x++) {
             var c = game.currentWordSolved.charAt(x);

             if (c == guess.toLowerCase()) {
                 game.currentWord = game.currentWord.setCharAt(x, guess.toLowerCase());
                 sendWordToClient();
             }
         }

     } else */
    if (guess.length == game.currentWordSolved.length && game.canGuess) {
        if (guess.toLowerCase() == game.currentWordSolved) {
            game.currentWord = game.currentWordSolved;
            game.canGuess = false;

            clearTimers();
            sendWordToClient();
            roundWin(user);
        }
    }
}



//sends the players n points section
function sendplayersnpoints() {
    var playersnpoints = [];

    game.players.forEach(function (item) {
        if (item.isPlaying) {
            var t = {
                username: item.username,
                points: item.points
            };

            playersnpoints.push(t);
        }
    });

    io.emit("playersnpoints", playersnpoints);
}


//sends unsolved word to client
function sendWordToClient() {
    io.emit("wordUpdate", game.currentWord.toUpperCase());
}


//handles the ending of the game.  resets variables
function endGame() {
    console.log("[GAME EVENT] GAME ENDED");
    clearTimers();
    game.inProgress = false;
    game.canGuess = false;
    game.mode = null;

    var winner = {
        player: null,
        score: -1
    };

    game.players.forEach(function (player) {
        if (player.points > winner.score && player.isPlaying) {
            winner.player = player;
            winner.score = player.points;
        }

        player.isPlaying = false;
    });

    if (winner.player) {
        winner.player.wins += 1;
        io.emit("winner", winner);
        setTimeout(function () {
            io.emit("gameEnded");
        }, 8000);
    } else {
        io.emit("gameEnded");
    }

    //sendWinnersList();
    sendPlayersList();


    //game.currentTurn = -1;
    game.currentPlayer = null;
}


//gets a new word to be guessed
function getNewWord() {
    game.currentWordSolved = Sentencer.make("{{noun}}");

    for (x = 0; x <= game.currentWordSolved.length - 1; x++) {
        game.currentWord += "_";
    }
}


//handles when a round is won.  Sends winner stuff to client
function roundWin(user) {

    var winner = {};

    if (user != "Nobody") {
        //winner = findPlayerByUsername(username);
        winner = user;
        winner.points += 10;

        game.currentPlayer.points += 5;

    } else {
        winner = {
            username: "Nobody"
        };
    }

    console.log("[GAME EVENT] ROUND WON - " + winner.username);
    io.emit("wordAnswer", game.currentWordSolved);
    sendplayersnpoints();
    io.emit("roundWin", winner.username);

    setTimeout(function () {
        newRound();
    }, 3000);

}


//resets game timers
function clearTimers() {
    clearTimeout(timers.roundTimer);
    clearTimeout(timers.letterTimer);
}


//sends player list (modal) to client
function sendPlayersList() {
    var list = [];

    game.players.forEach(function (player) {
        list.push({
            username: player.username,
            wins: player.wins,
            ready: player.ready,
            state: player.state
        });
    });

    io.emit("playerAddedStart", list);
}


//handles a new round
function newRound() {
    console.log("[GAME EVENT] NEW ROUND");
    clearTimers();

    if (game.inProgress) {
        sendplayersnpoints();

        /*timers.roundTimer = setTimeout(function () {
            roundWin("Nobody");
            //newRound();
        }, game.roundTimeout * 1000);*/

        roundTimer(game.roundTimeout);

        timers.letterTimer = setTimeout(function () {
            guessLetter();

            timers.letterTimer = setTimeout(function () {
                guessLetter();

                timers.letterTimer = setTimeout(function () {
                    guessLetter();

                }, (game.roundTimeout / 8) * 1000);
            }, (game.roundTimeout / 4) * 1000);
        }, (game.roundTimeout / 2) * 1000);

        io.emit("newRound", game.roundTimeout);
        game.canGuess = true;

    }

    game.currentWord = "";
    game.currentWordSolved = "";
    drawHistory = [];

    updatePlayerTurn();

    if (game.inProgress) {
        getNewWord();

        sendWordToClient();
        io.sockets.connected[game.currentPlayer.socket].emit('wordUpdateSolved', game.currentWordSolved.toUpperCase());
    }
}


//handles the single letter guessing by th game
function guessLetter() {
    var guess = game.currentWordSolved.charAt(Math.floor(Math.random() * game.currentWordSolved.length));

    for (var x = 0; x <= game.currentWordSolved.length; x++) {
        var c = game.currentWordSolved.charAt(x);

        if (c == guess.toLowerCase()) {

            if (game.currentWord.charAt(x) == "_") {
                game.currentWord = game.currentWord.setCharAt(x, guess.toLowerCase());
                sendWordToClient();
            } else {

                if (game.currentWord == game.currentWordSolved) {
                    break;
                } else {
                    guessLetter();
                    break;
                }
            }
        }
    }
}


//finds players by their username
function findPlayerByUsername(username) {
    var player;

    game.players.forEach(function (item) {
        if (username == item.username) {
            player = item;
        }
    });

    return player;
}

//finds players by their socket id
function findPlayerBySocket(socket) {
    var player;

    game.players.forEach(function (item) {
        if (socket.id == item.socket) {
            player = item;
        }
    });

    return player;
}

function sendGameMode() {
    io.emit("gameMode", game.mode);
}

function roundTimer(time) {
    clearInterval(timers.roundTimer);

    timers.roundTimeLeft = time;

    timers.roundTimer = setInterval(function () {
        timers.roundTimeLeft--;

        if (timers.roundTimeLeft <= 0) {
            clearInterval(timers.roundTimer);
            roundWin("Nobody");
        }
    }, 1000);

}

function getRandomCursor() {
    var cursor = null;

    cursor = cursorsDirectory + cursors[Math.floor(Math.random() * cursors.length)];
    console.log(cursor);
    return cursor;
}

function encrypt(text) {
    var hash = crypto.createHmac('sha512', algorithmPassword);
    hash.update(text);
    var value = hash.digest('hex');
    return value;
}

function decrypt(text) {
    var decipher = crypto.createDecipher(algorithm, algorithmPassword);
    var dec = decipher.update(text, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
}


//third party setcharat function
String.prototype.setCharAt = function (index, chr) {
    if (index > this.length - 1) return str;
    return this.substr(0, index) + chr + this.substr(index + 1);
};