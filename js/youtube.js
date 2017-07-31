//YT API fires this when loaded
function onYouTubeIframeAPIReady() {
    player = new YT.Player('YTPlayer', {
        height: '390',
        width: '640',
        videoId: 'M7lc1UVf-VE',
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}


//When the YT player is ready
function onPlayerReady(event) {
    if (socket.connected) {
        YTisReady = true;
        YTP = $("#YTPlayer");

        socket.emit("ready");
        console.log("YT and socket ready!");

    } else {
        console.log("Cannot connect to server");
    }
}

//When the YT Player detects state change (play, pause, stop, etc);
function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.ENDED && currentlyPlaying.type == vType.YT) {
        console.log("Video Ended");
        console.log("Requesting Next Video: onPlayerStateChange");
        socket.emit("videoEnded");
    }

}

//When YT Player has an error (invalid params, or other)
function onPlayerError(event) {
    console.log("Requesting Next Video: onPlayerError");
    socket.emit("videoEnded");
}