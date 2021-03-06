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
var player = null;

var game = {
    modes: {
        "REGULAR": 1,
        "ENDLESS": 2
    },
    playerStates: {
        "PLAYER": 1,
        "SPECTATOR": 2
    }
};

var messageType = {
    "REG": 1,
    "BOLD": 2,
    "RED": 3
};

socket.on('connect', function () {
    //toggleReady(false);
    var c = getCookieValue("c");
    socket.emit("init", {
        c: c
    });
    AddChatMessage(messageType.BOLD, "Connected!");
});

//Drawing Event
socket.on('drawing', onDrawingEvent);

//listens for initial important data 
socket.on("init", function (data) {
    player = data;

    if(!data.useSQL){
        statusMessage("danger", "SQL Cannot Connect - No Login Available!");
        $("#loginFields").hide();
    }

    if (player.loggedIn) {
        $("#loginFields").hide();
        $("#username").text(player.username);
        $("#profileFields").show();
    }

    username = data.username;
  
    //resetInterface();


    $("#modal-playerList").show();

    if (data.inProgress) {

        $("#joinButtons").show();
        // $(".modal").hide();

        $("#pn").attr("src", data.cursor);
        countDownTimer(data.roundTimeLeft);

        notMyTurn(false);
    } else {

        $("#startButtons").show();
    }
});


//listens if we get disconnected from server
socket.on('disconnect', function () {
    AddChatMessage(messageType.BOLD, "Disconnected From Server!");
});

//listens if we are attempting to reconnect to server
socket.on('reconnecting', function () {
    AddChatMessage(messageType.REG, "Attempting to Connect...");
});

//listens for chat message feedback from server.
socket.on('chatMessage', function (msg) {
    AddChatMessage(messageType.REG, msg.text);
});

//listens for user count updates
socket.on('userCount', function (count) {
    userCount = count;
    // $("#usersOnline").text(userCount + " Users");
});

//listens for when the word was solved
socket.on("wordAnswer", function (data) {
    AddChatMessage(messageType.BOLD, "The word was " + data);
});



//listens for playerlist from server.  updates modal playerlist
socket.on("playerAddedStart", function (data) {
    $("#playersToStart").html("");
    var t = player;
    var players = data.list;
    var playerPlayerCount = data.playerCount;
   
    players.forEach(function (player) {
        var medals = "";
        for (x = 0; x < player.wins; x++) {
            medals += '<img src="css/gold_medal.png">';
        }

        if (player.username == t.username) {
            player.username += " (me)";
        }

        if (player.ready) {
            if (player.state == game.playerStates.PLAYER) {
                $("#playersToStart").append('<li class="list-group-item list-group-item-success">' + player.username + " " + medals + '</li>');
            } else if (player.state == game.playerStates.SPECTATOR) {
                $("#playersToStart").append('<li class="list-group-item list-group-item-warning">' + player.username + " " + medals + '</li>');
            }

        } else {
            $("#playersToStart").append('<li class="list-group-item list-group-item-danger">' + player.username + " " + medals + '</li>');
        }
    });

    if(playerPlayerCount >= 2){
        $("#startGameButtonEndless").prop("disabled", false);
        $("#startGameButton").prop("disabled", false);
    } else {
        $("#startGameButtonEndless").prop("disabled", true);
        $("#startGameButton").prop("disabled", true);
    }

});


socket.on("disableBackgroundChange", function () {
    $("#contextSelector").prop("disabled", true);
});

//listens for when the game is started
socket.on("gameStarted", function () {

    if (player.ready) {
        $(".modal").hide();
        $("#chatInput").focus();
    } else {
        $("#startButtons").hide();
        $("#joinButtons").show();
    }

    AddChatMessage(messageType.BOLD, "Game Starting!");
    $.titleAlert("Game Started!", {
        requireBlur: true,
        stopOnFocus: true
    });
});


//listens for new round
socket.on("newRound", function (data) {
    countDownTimer(data);
    onResize();
    canvas.isDrawing = false;
    notMyTurn(false);
    canvas.context.clearRect(0, 0, canvas.self.width, canvas.self.height);

});


//listens for when round was won
socket.on("roundWin", function (data) {
    clearInterval(timer);
    AddChatMessage(messageType.BOLD, data + " won the round!");
});

//listens for next player update
socket.on("nextTurnPlayer", function (data) {
    AddChatMessage(messageType.RED, "It's " + data.who + "'s turn to draw!");

    $("#pn").attr("src", data.cursor);

    notMyTurn(false);

});

//tells individual user its their turn to draw
socket.on("yourTurn", function (data) {
    $.titleAlert("Your Turn to Draw!", {
        requireBlur: true,
        stopOnFocus: true
    });

    //$('#canvas').css( 'cursor', 'url('+data.cursor+'), auto' );
    notMyTurn(true);
});

//listens and sets the unsolved word, updates infobox
socket.on("wordUpdate", function (data) {
    $("#word").text(data);
});

//listens for when the word was solved, updates infobox
socket.on("wordUpdateSolved", function (data) {
    $("#wordSolved").html('<a target="_blank" href="http://www.urbandictionary.com/define.php?term=' + data + '">' + data + '</a>');

});

//updates playersnpoints above chat
socket.on("playersnpoints", function (data) {
    $(".playersnpoints").html("");
    data.forEach(function (player) {
        $(".playersnpoints").append(player.username + ": " + player.points + " points<BR>");
    });
});


//listens for winners list and sets it in modal
socket.on("winnersList", function (data) {
    $("#winnersList").html("");

    data.forEach(function (item) {
        $("#winnersList").append($('<li>').text(item.username + ": " + item.wins));
    });
});


//listens for when the game has ended
socket.on("gameEnded", function () {
    notMyTurn(false);
    clearInterval(timer);
    $("#pn").hide();
    $("#endGameButtonEndless").hide();
    $("#joinButtons").hide();
    $("#startButtons").show();

    $("#modal-winner").hide();
    $("#modal-playerList").show();
    $(".modal").show();


});

//clears the canvas
socket.on("clearScreen", function () {
    canvas.clearScreen();
});


//changes the canvas background color
socket.on("backgroundColorUpdate", function (color) {
    canvas.fillScreen(color);
});


//listens for drawhistory from server, to redraw lines after canvas background updates
socket.on("drawHistory", function (history) {
    var w = canvas.self.width;
    var h = canvas.self.height;
    history.forEach(function (item) {
        canvas.drawLine(item.x0 * w, item.y0 * h, item.x1 * w, item.y1 * h, item.color, item.lineWidth, false);
    });
});

socket.on("drawerMouseMove", function (mouse) {
    var w = canvas.self.width;
    var h = canvas.self.height;


    moveCursor(mouse.x * w, mouse.y * h);
});

socket.on("gameMode", function (mode) {
    if (mode == game.modes.ENDLESS) {
        $("#endGameButtonEndless").show();
    }
});

socket.on("login", function (data) {
   
    if (data.result) {
        var c = data.secret;
        document.cookie = "c=" + c;
        location.reload();
    }

});

socket.on("registerSuccess", function (data) {
    var result = data.result;

    if (result) {
        $("#registerFields").toggle();
        //$('#statusMessage').removeClass("alert alert-success").removeClass("alert alert-danger");
        if (player.loggedIn) {
            //$('#statusMessage').text("Settings Updated").addClass( "alert alert-success" ).show().delay(5000).fadeOut('slow');
            statusMessage("success", "Settings Updated");
        } else {
            statusMessage("success", "Success -- Please login");
             //$('#statusMessage').text("Success -- Please login").addClass( "alert alert-success" ).show().delay(5000).fadeOut('slow');
        }
    } else {
        if (player.loggedIn) {
            statusMessage("danger", "Error! Settings Not Saved!");
             //$('#statusMessage').text("Settings not Saved").addClass( "alert alert-danger" ).show().delay(5000).fadeOut('slow');
        } else {
            statusMessage("danger", "Use a different Username!");
             //$('#statusMessage').text("Use a different Username").addClass( "alert alert-danger" ).show().delay(5000).fadeOut('slow');
        }
    }
});


//listens for game winner, shows modal again
socket.on("winner", function (winner) {
    clearInterval(timer);
    AddChatMessage(messageType.BOLD, winner.player.username + " won with " + winner.player.points + " points!");
    $("#pn").hide();

    if (player.ready) {
        $("#modal-winner-winner").text(winner.player.username + " won with " + winner.player.points + " points!");
        $("#modal-playerList").hide();
        $("#modal-winner").show();
        $(".modal").show();

        $("#modal-chatInput").focus();
    }
});



//on local page load
$(document).ready(function () {

    //Loads All Canvas Variables and EVents (DRAWING)
    loadCanvas(document.getElementById("canvas"));

    $('#ready').bootstrapToggle('off');
    $('#spectate').bootstrapToggle('on');

    $("#colorWheel").farbtastic(colorCallback);

    $('#penSize').on('change', function () {
        canvas.current.lineWidth = this.value;
    });

    $('#contextSelector').on('change', function () {
        canvas.current.context = this.value;
    });

    //handles clear screen button click
    $("#cls").click(function () {
        canvas.clearScreen();
        socket.emit("clearScreen");
    });

    //handles chat input, non modal
    $('#chatInputForm').submit(function (event) {
        event.preventDefault();
        var chatVal = $("#chatInput").val();
        $("#chatInput").val("");

        if (chatVal.length > 0) {
            chatMessage(chatVal);
        }

        return false;
    });

    //modal chat input handler
    $('#modal-chatInputForm').submit(function (event) {
        event.preventDefault();
        var chatVal = $("#modal-chatInput").val();
        $("#modal-chatInput").val("");

        if (chatVal.length > 0) {
            chatMessage(chatVal);
        }

        return false;
    });


    $("#endGameButtonEndless").click(function () {
        socket.emit("endGame");
    });

    //start game button handler
    $("#startGameButton").click(function () {
        socket.emit("startGame", {
            gameMode: game.modes.REGULAR
        });
    });

    //start game button handler for endless
    $("#startGameButtonEndless").click(function () {
        socket.emit("startGame", {
            gameMode: game.modes.ENDLESS
        });
    });

    $("#joinGame").click(function () {
        socket.emit("joinGame");
        $(".modal").hide();
        player.ready = true;
    });


    $('#ready').change(function () {
        socket.emit("playerReady", $(this).prop('checked'));
        player.ready = $(this).prop('checked');
    });

    $('#spectate').change(function () {
        socket.emit("playerPlayer", $(this).prop('checked'));

        if ($(this).prop('checked')) {
            player.state = "player";
        } else {
            player.state = "spectator";
        }
    });

    $("#editProfile, #registerButton").click(function (e) {
        e.preventDefault();

        toggleReady(false);

        if (player.loggedIn) {
            $("#registerOnly").hide();
            $("#modal-register-cursor").val(player.cursor);
            $("#cursorPreview").attr("src", player.cursor);
        } else {
            $("#registerOnly").show();
        }

        $("#registerFields").toggle();
    });

    $("#logoutProfile").click(function () {
        document.cookie = "c=-1";
        location.reload();
    });


    $("#registerSubmitButton").click(function (e) {
        e.preventDefault();


        if (player.loggedIn) {
            socket.emit("updatePlayerSettings", {
                cursor: $("#modal-register-cursor").val()
            });
        } else {
            if ($("#modal-register-username").length > 0 && $("#modal-register-password").length > 0) {
                socket.emit("registerPlayer", {
                    username: $("#modal-register-username").val(),
                    password: $("#modal-register-password").val(),
                    cursor: $("#modal-register-cursor").val()
                });
            }
        }
    });

    $("#modal-register-cursor").change(function () {
        $("#cursorPreview").attr("src", $(this).val());
    });

    $("#loginButton").click(function (e) {
        e.preventDefault();
        toggleReady(false);

        if ($("#modal-login-username").val() != "" && $("#modal-login-password").val() != "") {
            socket.emit("login", {
                username: $("#modal-login-username").val(),
                password: $("#modal-login-password").val()
            });

            $("#modal-login-username").val("");
            $("#modal-login-password").val("");
        }

    });

});

//handles color picker changes
function colorCallback(color) {
    canvas.current.color = color;

    if (canvas.current.context == "background") {
        //canvas.fillScreen();
        socket.emit("backgroundColorUpdate", color);
    }
}


//handles chat message
function chatMessage(message) {
    socket.emit('chatMessage', {
        username: username,
        text: message
    });
}

//Adds parameter message to the chat scroller
function AddChatMessage(type, message) {

    if (type == messageType.REG) {
        $(".chatScroller").append($('<li>').text(message));
    } else if (type == messageType.BOLD) {
        $(".chatScroller").append($('<li class="b">').text(message));
    } else if (type == messageType.RED) {
        $(".chatScroller").append($('<li class="red">').text(message));
    }

    scrollerHeight += 400;
    $("#chat").animate({
        scrollTop: scrollerHeight
    }, "slow");

    $("#modal-chat-chatWrapper").animate({
        scrollTop: scrollerHeight
    }, "slow");
}



//handles enabling/disabling turn elements (drawing or not)
function notMyTurn(turn) {
    myTurn = turn;

    if (turn) {
        $("#contextSelector").prop("disabled", false);
        $(".turn").show();
        //$("#canvas").addClass("pencil");
        //$("#pn").hide();
        $("#pn").show();
    } else {
        $("#pn").show();
        $("#contextSelector").prop("disabled", true);
        $(".turn").hide();
        $("#canvas").css('cursor', 'default');
        // $("#canvas").removeClass("pencil");
    }
}

//handles the clock
function countDownTimer(time) {
    clearInterval(timer);

    var timeleft = time;
    timer = setInterval(function () {
        timeleft--;

        $("#timer").text(timeleft);

        if (timeleft <= 15) {
            $("#timer").effect("shake", {
                distance: 5 + (15 - timeleft)
            });
        }

        if (timeleft <= 0) {
            clearInterval(timer);
        }
    }, 1000);
}


function resetInterface() {
    $("#canvas").removeClass("pencil");
    notMyTurn(false);
    $("#pn").hide();
    $(".turn").hide();
    $("#endGameButtonEndless").hide();
    $("#modal-winner").hide();
    $("#modal-playerList").show();
    $(".modal").show();
    //$("#canvas").css('cursor', 'default');
}

function getCookieValue(a) {
    var b = document.cookie.match('(^|;)\\s*' + a + '\\s*=\\s*([^;]+)');
    return b ? b.pop() : null;
}


function toggleReady(ready) {
    if (ready) $('#ready').bootstrapToggle('on');
    else $('#ready').bootstrapToggle('off');
}

function statusMessage(status, text){
    $('#statusMessage').removeClass("alert alert-success").removeClass("alert alert-danger").addClass("alert alert-"+status).text(text).show().delay(5000).fadeOut('slow');
}