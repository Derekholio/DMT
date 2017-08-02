var socket = io("http://ryanpeterson.me:8080");
var username = "Anonymous";
var myTurn = false;
var userCount;
var timer;

socket.on('connect', function () {
    AddChatMessage(2, "Connected!");
});

//Drawing Event
socket.on('drawing', onDrawingEvent);

//listens for initial important data 
socket.on("init", function (data) {
    username = data.username;
    console.log(username);
    if (data.inProgress) {
        $(".modal").hide();
    } else {
        $("#modal-playerList").show();
    }
});


//listens if we get disconnected from server
socket.on('disconnect', function () {
    AddChatMessage(2, "Disconnected From Server!");
});

//listens if we are attempting to reconnect to server
socket.on('reconnecting', function () {
    AddChatMessage(1, "Attempting to Connect...");
});
  
//listens for chat message feedback from server.
socket.on('chatMessage', function (msg) {
    AddChatMessage(1, msg.text);
});

//listens for user count updates
socket.on('userCount', function (count) {
    userCount = count;
    $("#usersOnline").text(userCount + " Users");
});

socket.on("wordAnswer", function(data){
    AddChatMessage(2, "The guessed word was "+data);
});

//listens for content updates from server
socket.on('contentUpdate', function (content) {
    // screenSwitcher(content.type);
    //sets mouse0 to canvas0, due to margins

    canvas.history = content.history;

    //set timeout because the resource has a load delay. if image error then erase.
    canvas.context.clearRect(0, 0, canvas.self.width, canvas.self.height);

    canvas.history.forEach(function (item) {
        console.log("Drawing line");
        canvas.drawLine(item.x0, item.y0, item.x1, item.y1, item.color);
    });
});


socket.on("playerAddedStart", function (players) {
    $("#playersToStart").html("");

    players.forEach(function (player) {
        if (username == player.username) {
            $("#playersToStart").append('<li class="list-group-item list-group-item-success">' + player.username + '</li>');
        } else {
            $("#playersToStart").append('<li class="list-group-item">' + player.username + '</li>');
        }
    });
});

socket.on("gameStarted", function () {
    $(".modal").hide();
    AddChatMessage(2, "Game Starting!");
});

socket.on("newRound", function (data) {
    notMyTurn(false);
    canvas.context.clearRect(0, 0, canvas.self.width, canvas.self.height);
    countDownTimer(data);
});

socket.on("roundWin", function (data) {
    AddChatMessage(2, data + " won the round!");
});

socket.on("nextTurnPlayer", function (data) {
    AddChatMessage(3, "It's " + data.who + "'s turn to draw!");

    notMyTurn(false);
});

socket.on("yourTurn", function (data) {
    notMyTurn(true);
});

socket.on("wordUpdate", function (data) {
    $("#word").text(data);
});

socket.on("wordUpdateSolved", function (data) {
    $("#wordSolved").text(data);

});

socket.on("gameEnded", function () {
    $("#modal-winner").hide();
    $("#modal-playerList").show();
    $(".modal").show();
});

socket.on("winner", function (winner) {
    $("#modal-winner").text(winner.player.username + " won with " + winner.player.points + " points!");
    $("#modal-playerList").hide();
    $("#modal-winner").show();
    $(".modal").show();
});

//on local page load
$(document).ready(function () {

    //Loads All Canvas Variables and EVents (DRAWING)
    loadCanvas(document.getElementById("canvas"));

    //handles chat input
    $('#chatInputForm').submit(function (event) {
        event.preventDefault();
        var chatVal = $("#chatInput").val();
        $("#chatInput").val("");

        if (chatVal.length > 0) {
            chatMessage(chatVal);
        }

        return false;
    });


    $('#modal-chatInputForm').submit(function (event) {
        event.preventDefault();
        var chatVal = $("#modal-chatInput").val();
        $("#modal-chatInput").val("");

        if (chatVal.length > 0) {
            chatMessage(chatVal);
        }

        return false;
    });

    $("#startGameButton").click(function () {
        socket.emit("startGame");
    });

});

function chatMessage(message) {
    socket.emit('chatMessage', {
        username: username,
        text: message
    });
}

//Adds parameter message to the chat scroller
function AddChatMessage(type, message) {

    if(type == 1){
        $(".chatScroller").append($('<li>').text(message));
    } else if (type == 2){
        $(".chatScroller").append($('<li class="b">').text(message));
    } else if (type == 3){
        $(".chatScroller").append($('<li class="red">').text(message));
    }

    $("#chat").animate({
        scrollTop: 9000
    }, "slow");

    $(".modal-chat").animate({
        scrollTop: 9000
    }, "slow");
}


//Sets the HTML Screen to be displayed, based on content Type.
function screenSwitcher(screen) {
    $(".screen").hide();
}

function notMyTurn(turn) {
    myTurn = turn;

    if (turn) {
        $(".turn").show();
    } else {
        $(".turn").hide();
    }
}


function countDownTimer(time) {
    clearInterval(timer);

    var timeleft = 60;
    timer = setInterval(function () {
        timeleft--;
        $("#timer").text(timeleft);
        if (timeleft <= 0)
            clearInterval(timer);
    }, 1000);
}