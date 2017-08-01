var socket = io("http://localhost:8080");
var username = "Anonymous";
var myTurn = false;
var userCount;


socket.on('connect', function () {
    AddChatMessage("Connected!");
});

//Drawing Event
socket.on('drawing', onDrawingEvent);

//listens for initial important data 
socket.on("init", function (data) {
    username = data.username;
    console.log(username);
    if(data.inProgress){
        $(".modal").hide();
    }
});


//listens if we get disconnected from server
socket.on('disconnect', function () {
    AddChatMessage("Disconnected From Server!");
});

//listens if we are attempting to reconnect to server
socket.on('reconnecting', function () {
    AddChatMessage("Attempting to Reconnect...");
});

//listens for chat message feedback from server.
socket.on('chatMessage', function (msg) {
    AddChatMessage(msg.text);
});

//listens for user count updates
socket.on('userCount', function (count) {
    userCount = count;
    $("#usersOnline").text(userCount + " Users");
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
    AddChatMessage("Game Starting!");
});

socket.on("nextTurnPlayer", function (data) {
    AddChatMessage("It's " + data.who + "'s turn to draw!");

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
            socket.emit('chatMessage', {
                username: username,
                text: chatVal
            });
        }


        return false;
    });

    $("#startGameButton").click(function () {
        socket.emit("startGame");
    });

});

//Adds parameter message to the chat scroller
function AddChatMessage(message) {
    $("#chatScroller").append($('<li>').text(message));
    $("#chat").animate({
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