//Node Variables
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var port = process.env.PORT || 8080;

//MTV2 Variables
var userCount = 0;
var drawHistory = [];


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

    io.emit('init', {
        
    });
    //emits usercount to be displayed on page.  May replace with inital start payload
    io.emit('userCount', userCount);

    //on message from chat
    socket.on('chatMessage', function (msg) {
        console.log("Chat Message", msg);
        io.emit('chatMessage', msg);
    });

    //on client disconnect.  Reemit usercount for client side
    socket.on('disconnect', function () {
        userCount -= 1;
        io.emit('userCount', userCount);
    });


    socket.on('drawing', function(data) {
        socket.broadcast.emit('drawing', data);

        drawHistory.push(data);
    });

}); // END IO.ON

//Returns Time in Seconds
function getTime() {
    return Math.floor(Date.now() / 1000);
}