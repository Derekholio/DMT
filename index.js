//Node Variables
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var mysql = require('mysql');
var port = process.env.PORT || 8080;
/*
var con = mysql.createConnection({
  host: "localhost",
  user: "",
  password: "",
  database: ""
});*/

 
//MTV2 Variables
var userCount = 0;
var videoList = Array(); // = Array({type: 1, value: "v-RE7RUzjf8"}, {type: 1, value:"YpC1KWe9dp8"}, {type: 1, value:"JbepN4dKLbU"});
var skipCount = 0;
var lastUpdate = getTime();
var timer;
var iFrameTimeout = 30000;
var drawHistory = [];

var currentlyPlaying = {
    type: 4,
    value: "https://scontent-lhr3-1.xx.fbcdn.net/v/t1.0-9/13133232_10205163268195167_5300749367639802407_n.jpg?oh=1b559cc7c6ce0916000cbcfd9a3c0fef&oe=5A01D048",
    startTime: getTime()
};

//Video Type ENUM
var vType = {
    NONE: 0,
    YT: 1,
    VOICE: 2,
    FRAME: 3,
    DRAW: 4
};


/*
con.connect(function(err) {
  if (err) throw err;
  con.query("SELECT * FROM dataset", function (err, result, fields) {
    if (err) throw err;
    result.forEach(function(item){
        if(item.status == 1 || item.status == 2 || item.status == 3){
            videoList.push({type: item.status, value: item.data.hexDecode()})
        }
    });
  });
});*/


//HAndles Node server web page serving.  Currently Not used.
app.get('/', function (req, res) {
    //res.sendFile(__dirname + '/index.html');
});


//Listens for socket connection event.  Once connected we attach our logic listeners
io.on('connection', function (socket) {
    console.log("connection established");
    userCount += 1;

    io.emit('init', {
        vType: vType
    });
    //emits usercount to be displayed on page.  May replace with inital start payload
    io.emit('userCount', userCount);

    //on message from chat
    socket.on('chatMessage', function (msg) {
        console.log("Chat Message", msg);
        io.emit('chatMessage', msg);
    });

    //on ready emit from client.  Indicates YT and Socket ready, client side.
    socket.on('ready', function () {
        socket.emit('contentUpdate', getVideoData());
    });

    //on client disconnect.  Reemit usercount for client side
    socket.on('disconnect', function () {
        userCount -= 1;
        io.emit('userCount', userCount);
    });

    //on addcontent from client.  Adds content, based on type, to videoList queue. If type 0 (none), it will play instantly.
    socket.on('addContent', function (content) {
        var newVideo = {
            type: content.type,
            value: content.value
        };

        videoList.push(newVideo);
        console.log("Adding Video", newVideo);

        if (currentlyPlaying.type == vType.NONE) {
            nextVideo();
        }
    });

    //on YT video end event
    socket.on('videoEnded', function () {
        console.log(socket.request.connection.remoteAddress);
        nextVideo();
    });

    socket.on('drawing', function(data) {
        socket.broadcast.emit('drawing', data);

        drawHistory.push(data);
    });

    //on skip button press.
    socket.on('skip', function () {
        skipCount++;
        io.emit('skipCount', skipCount);

        if (skipCount >= (userCount / 3)) {
            console.log(socket.request.connection.remoteAddress);
            io.emit('skip');
            nextVideo();
            skipCount = 0;
        }
    });

}); // END IO.ON



//Handles the logic of loading the next video.  
//Attempts to remove the oldest (first) item in the videoList queue.
//If queue item, then set it to currentlyPlaying and emit  
//If no queue, then undefined is returned and we show type 0 (none)

function nextVideo() {

    console.log("nextVideo Requested!");

    //Deters multiple next commands
    if (getTime() - lastUpdate >= 2) {
        console.log("nextVideo Approved!");

        //If iFrame timer then clear it out;
        clearTimeout(timer);
        drawHistory = [];

        var next = videoList.shift();
        console.log("Next Video: ", next);

        if (next == undefined) {
            currentlyPlaying = {
                type: vType.NONE
            };

        } else {
            currentlyPlaying = next;
            currentlyPlaying.startTime = getTime();

            //If iFrame set 30s timeout
            if (currentlyPlaying.type == vType.FRAME) {
                console.log("Starting iFrame Timer");
                timer = setTimeout(function () {
                    if (currentlyPlaying.type == vType.FRAME) {
                        console.log("iFrame Timer Expired!  Requesting next video");
                        nextVideo();
                    }
                }, iFrameTimeout);
            }
            
        }


        io.emit('contentUpdate', getVideoData());
        lastUpdate = getTime();
    } else {
        console.log("Next View Request Denied!  Timeout");
    }


}

function iFrameIntervalChecker() {
    if (currentlyPlaying.type == vType.FRAME) {

    }
}

//Returns currentlyPlaying data string for client transmission
//Type 0 : none
//Type 1 : YT
function getVideoData() {
    var data = {
            type: currentlyPlaying.type,
            value: currentlyPlaying.value,
            //startTime: (getTime() - currentlyPlaying.startTime)
        };

    if (currentlyPlaying.type == vType.YT) {
        data.startTime = (getTime() - currentlyPlaying.startTime);
        /*
        data = {
            type: currentlyPlaying.type,
            value: currentlyPlaying.value,
            startTime: (getTime() - currentlyPlaying.startTime)
        };*/
    } else if (currentlyPlaying.type == vType.NONE) {
        data = currentlyPlaying;
    } else if (currentlyPlaying.type == vType.VOICE) {
        data = currentlyPlaying;
    } else if (currentlyPlaying.type == vType.FRAME) {
        data = currentlyPlaying;
    } else if (currentlyPlaying.type == vType.DRAW) {
        data.history = drawHistory;
        //data = currentlyPlaying;
    } else {
        data = currentlyPlaying;
    }

    console.log("getVideoData(): ", data);

    return data;

}

//Returns Time in Seconds
function getTime() {
    return Math.floor(Date.now() / 1000);
}

//Starts local node webserver to listen on 3000
http.listen(port, function () {
    console.log('listening on *:' + port);
});






String.prototype.hexEncode = function () {
    var hex, i;

    var result = "";
    for (i = 0; i < this.length; i++) {
        hex = this.charCodeAt(i).toString(16);
        result += ("000" + hex).slice(-4);
    }

    return result;
};

String.prototype.hexDecode = function () {
    var j;
    var hexes = this.match(/.{1,4}/g) || [];
    var back = "";
    for (j = 0; j < hexes.length; j++) {
        back += String.fromCharCode(parseInt(hexes[j], 16));
    }

    return back;
};