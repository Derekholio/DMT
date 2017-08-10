//Node Variables
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http, {'pingInterval':1000, 'pingTimeout':5000});
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
    endlessMode: false
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



//Listens for socket connection event.  Once connected we attach our logic listeners.  Also handles initial connection stuff
io.on('connection', function (socket) {
    console.log("connection established");
    userCount += 1;

    //setsup temporary player object
    var player = {
        username: Sentencer.make("{{adjective}} {{noun}}"),
        socket: socket.id,
        isPlaying: false,
        hasDrawn: false,
        drawing: false,
        points: 0,
        wins: 0
    };

    //forces players who join mid game to spectate
    if (!game.inProgress) {
        player.isPlaying = true;
    } else if (game.inProgress && game.endlessMode) {
        player.isPlaying = true;
    }

    //adds temp player object to games player queue
    game.players.push(player);

    //inits inital client information
    var initPayload = {
        username: player.username,
        inProgress: game.inProgress
    };

    //if the game is in progress we also send the word to client
    if (game.inProgress) {
        sendWordToClient();
    }
    //sends username and progress to client
    socket.emit('init', initPayload);


    //sendWinnersList();
    //io.emit("playerAddedStart", game.players);

    //sends player list to client, for modal
    sendPlayersList();

    //if the game is in progress let everyone know someone joined and spectating
    if (game.inProgress) {
        var msg = {};
        if (game.endlessMode) {
            msg = {
                text: player.username + " joined the game!"
            };
        } else {
            msg = {
                text: player.username + " joined the game! (SPECTATING)"
            };
        }
        io.emit("chatMessage", msg);
    }

    //emits usercount to be displayed on page.  May replace with inital start payload
    io.emit('userCount', userCount);

    //clears canvas event (cls button)
    socket.on("clearScreen", function () {
        io.emit("clearScreen");
    });

    //forces end game
    socket.on("endGame", function () {
        endGame();
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

    //on client disconnect.  removes player and updates player list
    socket.on('disconnect', function () {
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

        if(game.players.length == 0 && game.inProgress){
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
    });


    //on game start request (button clicked)
    socket.on("startGame", startGame);

}); // END IO.ON




/////////////////////////////////////////////////
///////////GAME FUNCTIONS///////////////////////
///////////////////////////////////////////////



//handles starting of the game and setting of initial variabes
function startGame(event) {

    if (event.gameMode == "endless") {
        game.endlessMode = true;
        io.emit("endlessMode");
    }

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


//updates the players turn
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
        if (game.endlessMode) {

            game.players.forEach(function(player){
                player.hasDrawn = false;
            });

            updatePlayerTurn();
        } else {
            console.log("game ended");
            endGame();
        }
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


//handles the guessing from chat
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
            game.canGuess = false;

            sendWordToClient();
            roundWin(username);
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
    clearTimers();
    game.inProgress = false;
    game.canGuess = false;
    game.endlessMode = false;

    var winner = {
        player: null,
        score: -1
    };

    game.players.forEach(function (player) {
        if (player.points > winner.score && player.isPlaying) {
            winner.player = player;
            winner.score = player.points;
        }

        player.isPlaying = true;
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


//gets a new word to be guessed
function getNewWord() {
    game.currentWordSolved = Sentencer.make("{{noun}}");

    for (x = 0; x <= game.currentWordSolved.length - 1; x++) {
        game.currentWord += "_";
    }
}


//handles when a round is won.  Sends winner stuff to client
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
            wins: player.wins
        });
    });

    io.emit("playerAddedStart", list);
}


//handles a new round
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

                if(game.currentWord == game.currentWordSolved) {
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


//third party setcharat function
String.prototype.setCharAt = function (index, chr) {
    if (index > this.length - 1) return str;
    return this.substr(0, index) + chr + this.substr(index + 1);
};