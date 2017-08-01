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
    currentTurn: -1,
    currentPlayer: null,
    currentWord: "",
    currentWordSolved: ""
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
        drawing: false,
        points: 0
    };

    if (!game.inProgress) {
        player.isPlaying = true;
    }

    game.players.push(player);

    var initPayload = {
        username: player.username,
        inProgress: game.inProgress
    };

    if(game.inProgress){
        sendWordToClient();
    }

    socket.emit('init', initPayload);

    io.emit("playerAddedStart", game.players);

    //emits usercount to be displayed on page.  May replace with inital start payload
    io.emit('userCount', userCount);

    //on message from chat
    socket.on('chatMessage', function (msg) {
        console.log("Chat Message", msg);

        if (msg.text.length > 0) {
            doGuess(msg.text, msg.username);
            msg.text = msg.username + ": " + msg.text;
            io.emit('chatMessage', msg);

            
        }
    });

    //on client disconnect.  Reemit usercount for client side
    socket.on('disconnect', function () {
        userCount -= 1;

        game.players.forEach(function (item, i) {
            if (item.socket == socket.id) {
                game.players.splice(i, 1);
            }
        });

        io.emit("playerAddedStart", game.players);
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

    io.emit("gameStarted");
    updatePlayerTurn();
    getNewWord();

    sendWordToClient();
    io.sockets.connected[game.currentPlayer.socket].emit('wordUpdateSolved', game.currentWordSolved);
}

//Returns Time in Seconds
function getTime() {
    return Math.floor(Date.now() / 1000);
}

function updatePlayerTurn() {
    game.currentTurn += 1;


    if (game.currentTurn >= game.players.length) {
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
    }
}

function doGuess(guess, username){
    if(guess.length == 1){

        for(var x = 0; x <= game.currentWordSolved.length; x++){
            var c = game.currentWordSolved.charAt(x);

            if(c == guess.toLowerCase()){

                game.currentWord = game.currentWord.setCharAt(x, guess.toLowerCase());
                sendWordToClient();
            }
        }



    } else if(guess.length == game.currentWordSolved.length){
        if(guess == game.currentWordSolved){
            RoundWin(username);
        }
    }
}

function sendWordToClient(){
    io.emit("wordUpdate", game.currentWord.toUpperCase());
}

function endGame() {
    game.inProgress = false;
    io.emit("gameEnded");
}

function getNewWord() {
    game.currentWordSolved = Sentencer.make("{{noun}}");

    for (x = 0; x <= game.currentWordSolved.length - 1; x++) {
        game.currentWord += "_";
    }
}


String.prototype.setCharAt = function(index,chr) {
	if(index > this.length-1) return str;
	return this.substr(0,index) + chr + this.substr(index+1);
};