var socket = null;
if (window.location.hostname === "localhost") {
    socket = io("http://localhost:8080");
} else {
    socket = io(window.location.protocol + "//" + window.location.hostname);
}

var username = "Anonymous";
var myTurn = false;
var userCount;
var timer;
var scrollerHeight = 900;

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

socket.on("wordAnswer", function (data) {
    AddChatMessage(2, "The guessed word was " + data);
});

//listens for content updates from server
socket.on('contentUpdate', function (content) {
    // screenSwitcher(content.type);
    //sets mouse0 to canvas0, due to margins

    canvas.history = content.history;

    //set timeout because the resource has a load delay. if image error then erase.
    //canvas.context.clearRect(0, 0, canvas.self.width, canvas.self.height);
    canvas.clearScreen();

    canvas.history.forEach(function (item) {
        console.log("Drawing line");
        canvas.drawLine(item.x0, item.y0, item.x1, item.y1, item.color, item.lineWidth, false);
    });
});


socket.on("playerAddedStart", function (players) {
    $("#playersToStart").html("");

    players.forEach(function (player) {
        var medals = "";
        for (x = 0; x < player.wins; x++) {
            medals += '<img src="css/gold_medal.png">';
        }
        if (username == player.username) {
            $("#playersToStart").append('<li class="list-group-item list-group-item-success">' + player.username + " " + medals + '</li>');
        } else {
            $("#playersToStart").append('<li class="list-group-item">' + player.username + " " + medals + '</li>');
        }
    });
});
socket.on("gameStarted", function () {
    $(".modal").hide();
   
    $("#chatInput").focus();
    AddChatMessage(2, "Game Starting!");
    $.titleAlert("Game Started!", {
        requireBlur: true,
        stopOnFocus: true
    });
});

socket.on("newRound", function (data) {
    countDownTimer(data);
    onResize();
    canvas.isDrawing = false;
    notMyTurn(false);
    canvas.context.clearRect(0, 0, canvas.self.width, canvas.self.height);

});

socket.on("roundWin", function (data) {
    clearInterval(timer);
    AddChatMessage(2, data + " won the round!");
});

socket.on("nextTurnPlayer", function (data) {
    AddChatMessage(3, "It's " + data.who + "'s turn to draw!");

    notMyTurn(false);
});

socket.on("yourTurn", function (data) {
    $.titleAlert("Your Turn to Draw!", {
        requireBlur: true,
        stopOnFocus: true
    });
    notMyTurn(true);
});

socket.on("wordUpdate", function (data) {
    $("#word").text(data);
});

socket.on("wordUpdateSolved", function (data) {
    $("#wordSolved").html('<a target="_blank" href="http://www.urbandictionary.com/define.php?term=' + data + '">' + data + '</a>');

});

socket.on("playersnpoints", function (data) {
    $(".playersnpoints").html("");
    data.forEach(function (player) {
        $(".playersnpoints").append(player.username + ": " + player.points + " points<BR>");
    });
});

socket.on("winnersList", function (data) {
    $("#winnersList").html("");

    data.forEach(function (item) {
        $("#winnersList").append($('<li>').text(item.username + ": " + item.wins));
    });
});

socket.on("gameEnded", function () {

    $("#modal-winner").hide();
    $("#modal-playerList").show();
    $(".modal").show();
});

socket.on("clearScreen", function () {
    canvas.clearScreen();
});

socket.on("backgroundColorUpdate", function (color) {
    canvas.fillScreen(color);
});

socket.on("drawHistory", function (history) {
    var w = canvas.self.width;
    var h = canvas.self.height;
    history.forEach(function (item) {
        console.log("Drawing line");
        canvas.drawLine(item.x0 * w, item.y0 * h, item.x1 * w, item.y1 * h, item.color, item.lineWidth, false);
    });
});

socket.on("winner", function (winner) {
    clearInterval(timer);
    AddChatMessage(2, winner.player.username + " won with " + winner.player.points + " points!");
    $("#modal-winner-winner").text(winner.player.username + " won with " + winner.player.points + " points!");
    $("#modal-playerList").hide();
    $("#modal-winner").show();
    $(".modal").show();

    $("#modal-chatInput").focus();
});

function colorCallback(color) {
    canvas.current.color = color;

    if (canvas.current.context == "background") {
        //canvas.fillScreen();
        socket.emit("backgroundColorUpdate", color);
    }
}

//on local page load
$(document).ready(function () {

    //Loads All Canvas Variables and EVents (DRAWING)
    loadCanvas(document.getElementById("canvas"));

    $("#colorWheel").farbtastic(colorCallback);

    $('#penSize').on('change', function () {
        canvas.current.lineWidth = this.value;
    });

    $('#contextSelector').on('change', function () {
        canvas.current.context = this.value;
    });

    $("#cls").click(function () {
        canvas.clearScreen();
        socket.emit("clearScreen");
    });

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

    if (type == 1) {
        $(".chatScroller").append($('<li>').text(message));
    } else if (type == 2) {
        $(".chatScroller").append($('<li class="b">').text(message));
    } else if (type == 3) {
        $(".chatScroller").append($('<li class="red">').text(message));
    }

    scrollerHeight += 400;
    $("#chat").animate({
        scrollTop: scrollerHeight
    }, "slow");

    $(".modal-chat").animate({
        scrollTop: scrollerHeight
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
        $("#canvas").addClass("pencil");
    } else {
        $(".turn").hide();
        $("#canvas").removeClass("pencil");
    }
}


function countDownTimer(time) {
    clearInterval(timer);

    var timeleft = time;
    timer = setInterval(function () {
        timeleft--;

        $("#timer").text(timeleft);

        if (timeleft <= 15) {
            $("#timer").effect("shake", {
                distance: 5 + (15-timeleft)
            });
        }

        if (timeleft <= 0) {
            clearInterval(timer);
        }
    }, 1000);
}