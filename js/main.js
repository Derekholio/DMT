var player;
var socket = io("http://localhost:8080");
var username = "Anonymous";
var usernameSet = false;
var YTisReady = false;
var currentlyPlaying;
var FRAME, YTP, VOICE, NONE, DRAW;
var userCount;

//videoType ENUM
var vType = {
    NONE: 0,
    YT: 1,
    VOICE: 2,
    FRAME: 3,
    DRAW: 4
};
 

//This is used for reconnection testing.  YTAPI not likely to be ready yet.  See onPlayerReady() for bootup
socket.on('connect', function () {
    if (YTisReady) {
        socket.emit("ready");
        AddChatMessage("Connected!");
    }
});

//Drawing Event
socket.on('drawing', onDrawingEvent);

//listens for initial important data 
socket.on("init", function (data) {
    vType = data.vType;
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

//Handles Returned Skip Count from server
socket.on('skipCount', function (count) {
    AddChatMessage("Skips: " + count + "/" + Math.ceil(userCount / 2));
});

//Handles when a skip is passed
socket.on('skip', function (count) {
    AddChatMessage("Skip Vote Passed! Skipping Current Video");
});

//listens for content updates from server
socket.on('contentUpdate', function (content) {
    console.log(content);
    currentlyPlaying = content;

    player.stopVideo();
    responsiveVoice.cancel();
    $("#iframe").attr('src', "");

    //Sets the screen HTML
    screenSwitcher(content.type);

    //Handles Specific content type actions
    if (content.type == vType.YT) {
        player.loadVideoById(content.value, content.startTime);
        console.log("YT");

    } else if (content.type == vType.VOICE) {
        responsiveVoice.speak(content.value, "US English Male", RSVParameters);
        console.log("TTS");

    } else if (content.type == vType.FRAME) {
        console.log("iFrame", content.value);
        $("#iframe").attr('src', content.value);

    } else if (content.type == vType.DRAW) {

        //sets mouse0 to canvas0, due to margins
        canvas.mouseXOffset = DRAW[0].getBoundingClientRect().left;
        canvas.mouseYOffset = DRAW[0].getBoundingClientRect().top;
        canvas.history = content.history;


        //make image object to pass to canvas
        var myimage = new Image();
        myimage.src = content.value;

        //set timeout because the resource has a load delay. if image error then erase.
        setTimeout(function () {
            try {
                canvas.context.drawImage(myimage, 0, 0, canvas.self.width, canvas.self.height);
            } catch (e) {
                canvas.context.clearRect(0, 0, canvas.self.width, canvas.self.height);
            }

            canvas.history.forEach(function (item) {
                console.log("Drawing line");
                canvas.drawLine(item.x0, item.y0, item.x1, item.y1, item.color);
            });

        }, 1000);

        console.log("DRAWING");
    }

});


//on local page load
$(document).ready(function () {
    FRAME = $("#FRAME");
    //YTP = $("#YTPlayer"); THIS IS SET IN THE YTAPI ONREADY FUNCTION DUE TO DIV TO IFRAME CONVERSION
    VOICE = $("#VOICE");
    NONE = $("#NONE");
    DRAW = $("#DRAW");

    //Load Canvas Variables
    canvas.self = document.getElementById("CANVAS");
    canvas.context = canvas.self.getContext('2d');

    //Loads All Canvas Variables and EVents (DRAWING)
    loadCanvas();

    $(".screen").hide();

    // $("#chatContainer").draggable();
    // $("#remote").draggable();
    $("#nana").draggable();

    //handles chat input
    $('#chatInputForm').submit(function () {
        var chatVal = $("#chatInput").val();
        $("#chatInput").val("");

        if (usernameSet) {
            socket.emit('chatMessage', {
                username: username,
                text: username + ": " + chatVal
            });
        } else {
            username = chatVal;
            usernameSet = true;

            socket.emit('chatMessage', {
                username: username,
                text: username + " has entered the chat!"
            });
        }
        return false;
    });

    //handles video submittions
    $('#videoInputForm').submit(function (e) {
        e.preventDefault();

        var videoVal = $("#videoInput").val();
        var type = vType.YT;

        //checks if valid YT video by ID or full length URL
        if (videoVal.length == 11 || videoVal.length == 43) {

            if (videoVal.length == 43) {
                videoVal = videoVal.slice(-11);
            }
            socket.emit('addContent', {
                type: type,
                value: videoVal
            });

            $("#videoInput").val("");
        } else {
            console.log("Not a YT Video!");
        }

        return false;
    });


    //Handles Voice submittions
    $('#voiceInputForm').submit(function (e) {
        e.preventDefault();

        var voiceVal = $("#voiceInput").val();
        var type = vType.VOICE;

        //checks if valid voice input
        if (voiceVal.length > 0) {

            socket.emit('addContent', {
                type: type,
                value: voiceVal
            });

            $("#voiceInput").val("");
        } else {
            console.log("Something went wrong with voice input!");
        }

        return false;
    });


    //Handles iFrame submittions
    $('#frameInputForm').submit(function (e) {
        e.preventDefault();

        var frameVal = $("#frameInput").val();
        var type = vType.FRAME;

        //checks if valid voice input
        if (frameVal.length > 0) {

            socket.emit('addContent', {
                type: type,
                value: frameVal
            });

            $("#frameInput").val("");
        } else {
            console.log("Something went wrong with frame input!");
        }

        return false;
    });



    //Handles Drawing submittions
    $('#drawInputForm').submit(function (e) {
        e.preventDefault();

        var drawVal = $("#drawInput").val();
        var type = vType.DRAW;

        //checks if valid voice input
        if (drawVal.length >= 0) {

            socket.emit('addContent', {
                type: type,
                value: drawVal
            });

            $("#drawInput").val("");
        } else {
            console.log("Something went wrong with draw input!");
        }

        return false;
    });

    //handles skip button click
    $("#btn-skip").click(function () {
        console.log("Skip Button Clicked");
        socket.emit('chatMessage', {
            text: username + " has voted to skip"
        });
        socket.emit("skip");
    });


    //HAndles nanas button
    $("#nanasbutton").click(function () {

        var nanasColorValue = $("#nanascolor").val();

        if (nanasColorValue == "#000000") {
            alert(nanasColorValue);
        } else {
            alert("ur naughty!");
        }

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

    if (screen == vType.YT) {
        YTP.show();
    }
    if (screen == vType.VOICE) {
        VOICE.show();
    }
    if (screen == vType.NONE) {
        NONE.show();
    }
    if (screen == vType.FRAME) {
        FRAME.show();
    }
    if (screen == vType.DRAW) {
        DRAW.show();
    }
}