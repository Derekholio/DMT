//Node Variables
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var Sentencer = require("sentencer");

var port = process.env.PORT || 8080;

//DMT Variables
var userCount = 0;
var drawHistory = [];

var game = {
    inProgress: false,
    players: [],
    //currentTurn: -1,
    currentPlayer: null,
    currentWord: "",
    currentWordSolved: "",
    roundTimeout: 120,
    canGuess: false,
};

var timers = {
    roundTimer: null,
    letterTimer: null
};

//HAndles Node server web page serving.  Currently Not used.
app.get('/', function (req, res) {
    //res.sendFile(__dirname + '/index.html');
});

//Starts local node webserver to listen on 3000
http.listen(port, function () {
    console.log('listening on *:' + port);
});



//Listens for socket connection event.  Once connected we attach our logic listeners
io.on('connection', function (socket) {
    console.log("connection established");
    userCount += 1;

    var player = {
        username: Sentencer.make("{{adjective}} {{noun}}"),
        socket: socket.id,
        isPlaying: false,
        hasDrawn: false,
        drawing: false,
        points: 0,
        wins: 0
    };

    if (!game.inProgress) {
        player.isPlaying = true;
    }

    game.players.push(player);

    var initPayload = {
        username: player.username,
        inProgress: game.inProgress
    };

    if (game.inProgress) {
        sendWordToClient();
    }

    socket.emit('init', initPayload);
    //sendWinnersList();
    //io.emit("playerAddedStart", game.players);
    sendPlayersList();

    if (game.inProgress) {
        var msg = {
            text: player.username + " joined the game! (SPECTATING)"
        };
        io.emit("chatMessage", msg);
    }

    //emits usercount to be displayed on page.  May replace with inital start payload
    io.emit('userCount', userCount);

    socket.on("clearScreen", function () {
        io.emit("clearScreen");
    });

    //on message from chat
    socket.on('chatMessage', function (msg) {
        console.log("Chat Message", msg);

        if (msg.text.length > 0) {
            var g = msg.text;
            var status = "";

            if (!findPlayerByUsername(msg.username).isPlaying) {
                status = "(SPECTATING) ";
            }

            msg.text = status + msg.username + ": " + msg.text;
            io.emit('chatMessage', msg);

            if (game.inProgress && findPlayerByUsername(msg.username).isPlaying) {
                doGuess(g, msg.username);
            }

        }
    });

    //on client disconnect.  Reemit usercount for client side
    socket.on('disconnect', function () {
        userCount -= 1;

        game.players.forEach(function (item, i) {
            if (item.socket == socket.id) {
                if (item == game.currentPlayer) {
                    roundWin("Nobody");
                }
                game.players.splice(i, 1);
            }
        });

        //io.emit("playerAddedStart", game.players);
        sendPlayersList();
    });


    socket.on("backgroundColorUpdate", function (color) {
        io.emit("backgroundColorUpdate", color);
        io.emit("drawHistory", drawHistory);

    });

    socket.on('drawing', function (data) {
        socket.broadcast.emit('drawing', data);

        drawHistory.push(data);
    });

    socket.on("startGame", startGame);

}); // END IO.ON


function startGame(event) {
    console.log("starting Game!");
    game.inProgress = true;
    clearTimers();

  //  game.currentTurn = -1;
    game.currentPlayer = null;

    game.players.forEach(function (player) {
        player.points = 0;
        player.isPlaying = true;
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

function updatePlayerTurn() {
    //game.currentTurn += 1;
    if (game.currentPlayer != null) {
        game.currentPlayer.drawing = false;
        game.currentPlayer.hasDrawn = true;
    }

    game.currentPlayer = null;

    game.players.forEach(function (player) {
        if (player.hasDrawn == false && player.isPlaying) {
            game.currentPlayer = player;
        }
    });

    if (game.currentPlayer == null) {
        console.log("game ended");
        endGame();
    } else {
        game.currentPlayer.drawing = true;
        io.emit("nextTurnPlayer", {
            who: game.currentPlayer.username
        });
        io.sockets.connected[game.currentPlayer.socket].emit('yourTurn', true);
    }

/*
    if (game.currentTurn >= game.players.length) {
        console.log(game.currentTurn, game.players.length);
        console.log("game ended");
        endGame();
    } else if (!game.players[game.currentTurn].isPlaying) {
        updatePlayerTurn();
    } else {
        if (game.currentTurn > 0) {
            game.players[game.currentTurn - 1].drawing = false;
        }

        game.currentPlayer = game.players[game.currentTurn];
        game.currentPlayer.drawing = true;

        io.emit("nextTurnPlayer", {
            who: game.currentPlayer.username
        });
        io.sockets.connected[game.currentPlayer.socket].emit('yourTurn', true);
    }*/
}

function doGuess(guess, username) {
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
            sendWordToClient();
            roundWin(username);
        }
    }
}


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

function sendWordToClient() {
    io.emit("wordUpdate", game.currentWord.toUpperCase());
}

function endGame() {
    clearTimers();
    game.inProgress = false;
    game.canGuess = false;

    var winner = {
        player: null,
        score: -1
    };

    game.players.forEach(function (player) {
        player.isPlaying = true;

        if (player.points > winner.score) {
            winner.player = player;
            winner.score = player.points;
        }
    });

    if (winner.player) {
        winner.player.wins += 1;
        io.emit("winner", winner);
    }

    //sendWinnersList();
    sendPlayersList();
    setTimeout(function () {
        io.emit("gameEnded");
    }, 8000);

    //game.currentTurn = -1;
    game.currentPlayer = null;
}

function getNewWord() {
    game.currentWordSolved = Sentencer.make("{{noun}}");

    for (x = 0; x <= game.currentWordSolved.length - 1; x++) {
        game.currentWord += "_";
    }
}

function roundWin(username) {
    var winner = {};

    if (username != "Nobody") {
        winner = findPlayerByUsername(username);
        winner.points += 10;

        game.currentPlayer.points += 5;

    } else {
        winner = {
            username: "Nobody"
        };
    }


    io.emit("wordAnswer", game.currentWordSolved);
    sendplayersnpoints();
    io.emit("roundWin", winner.username);

    setTimeout(function () {
        newRound();
    }, 3000);

}

function clearTimers() {
    clearTimeout(timers.roundTimer);
    clearTimeout(timers.letterTimer);
}

function sendPlayersList() {
    var list = [];

    game.players.forEach(function (player) {
        list.push({
            username: player.username,
            wins: player.wins
        });
    });

    io.emit("playerAddedStart", list);
}


function newRound() {
    clearTimers();

    if (game.inProgress) {
        sendplayersnpoints();

        timers.roundTimer = setTimeout(function () {
            roundWin("Nobody");
            //newRound();
        }, game.roundTimeout * 1000);

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

function guessLetter() {
    var guess = game.currentWordSolved.charAt(Math.floor(Math.random() * game.currentWordSolved.length));

    for (var x = 0; x <= game.currentWordSolved.length; x++) {
        var c = game.currentWordSolved.charAt(x);

        if (c == guess.toLowerCase()) {

            if (game.currentWord.charAt(x) == "_") {
                game.currentWord = game.currentWord.setCharAt(x, guess.toLowerCase());
                sendWordToClient();
            } else {
                guessLetter();
                break;
            }
        }
    }
}

function findPlayerByUsername(username) {
    var player;

    game.players.forEach(function (item) {
        if (username == item.username) {
            player = item;
        }
    });

    return player;
}

String.prototype.setCharAt = function (index, chr) {
    if (index > this.length - 1) return str;
    return this.substr(0, index) + chr + this.substr(index + 1);
};