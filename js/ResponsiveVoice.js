
//Response Voice Parameters
var RSVParameters = {
    onend: RSVend,
    onstart: RSVStart,
    rate: 0.8
};

//Repsonsive Voice End Handler
function RSVend() {
    console.log("Voice Ended");
    if (currentlyPlaying.type == vType.VOICE) {
        console.log("requesting next video: RSVEnd");
        socket.emit("videoEnded");
    }
}

//Repsonsive Voice Start Handler
function RSVStart() {
    console.log("Voice Started");
}

