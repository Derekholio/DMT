//This is the canvas object. 
var canvas = {
    self: null,
    context: null,
    isDrawing: false,

    current: {
        color: 'black',
        lineWidth: 4,
        context: "foreground"
    },

    drawLine: function (x0, y0, x1, y1, color, lineWidth, emit = false) {
        this.context.beginPath();
        this.context.moveTo(x0, y0);
        this.context.lineTo(x1, y1);
        this.context.strokeStyle = color;
        this.context.lineWidth = lineWidth;
        this.context.stroke();
        this.context.closePath();
        this.context.lineJoin = 'round';
        this.context.lineCap = 'round';

        if (!emit) {
            return;
        }
        var w = this.self.width;
        var h = this.self.height;

        socket.emit('drawing', {
            x0: x0 / w,
            y0: y0 / h,
            x1: x1 / w,
            y1: y1 / h,
            color: color,
            lineWidth: lineWidth
        });
    },

    clearScreen: function(){
        this.context.clearRect(0, 0, this.self.width, this.self.height);
        //socket.emit("clearScreen");
    },

    fillScreen:function(color){
        this.context.fillStyle = color;
        this.context.fillRect(0,0, this.self.width, this.self.height);
    }


};


function throttle(callback, delay) {
    var previousCall = new Date().getTime();
    return function () {
        var time = new Date().getTime();

        if ((time - previousCall) >= delay) {
            previousCall = time;
            callback.apply(null, arguments);
        }
    };
}



function onMouseDown(e) {
    if (!myTurn) {
        AddChatMessage("Its not your Turn!");
        return;
    }
    canvas.isDrawing = true;
    canvas.current.x = e.clientX;
    canvas.current.y = e.clientY;
}

function onMouseUp(e) {
    if (!myTurn) {
        return;
    }

    if (!canvas.isDrawing) {
        return;
    }
    canvas.isDrawing = false;
    //canvas.drawLine(canvas.current.x, canvas.current.y, e.clientX, e.clientY, canvas.current.color, canvas.current.lineWidth, true);
}

function onMouseMove(e) {
    if (!myTurn) {
        return;
    }

    var w = canvas.self.width;
    var h = canvas.self.height;
    socket.emit("drawerMouseMove", {"x": (e.clientX - canvas.mouseXOffset)/w, "y":(e.clientY - canvas.mouseYOffset)/h});
    if (!canvas.isDrawing) {
        return;
    }
    canvas.drawLine(canvas.current.x - canvas.mouseXOffset, canvas.current.y - canvas.mouseYOffset, e.clientX - canvas.mouseXOffset, e.clientY - canvas.mouseYOffset, canvas.current.color, canvas.current.lineWidth, true);
    canvas.current.x = e.clientX;
    canvas.current.y = e.clientY;
}

function onDrawingEvent(data) {
    var w = canvas.self.width;
    var h = canvas.self.height;
    canvas.drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, data.lineWidth, false);
    
    //moveCursor(data.x1*w, data.y1*h);
}

function onColorUpdate(e) {
    var tar = e.target.className.split(' ')[2];
  
    if (tar == "plus") {
        canvas.current.lineWidth += 2;
    } else if (tar == "minus") {
        canvas.current.lineWidth -= 2;
    } else {
        canvas.current.color = tar;
    }
}

function onResize() {
    canvas.self.height = canvas.self.offsetHeight;
    canvas.self.width = canvas.self.offsetWidth;
    canvas.mouseXOffset = canvas.self.getBoundingClientRect().left;
    canvas.mouseYOffset = canvas.self.getBoundingClientRect().top;
}

function loadCanvas(el) {

    canvas.self = el;
    canvas.context = canvas.self.getContext('2d');

    var colors = document.getElementsByClassName('color');

    for (var i = 0; i < colors.length; i++) {
        colors[i].addEventListener('click', onColorUpdate, false);
    }


    canvas.mouseXOffset = canvas.self.getBoundingClientRect().left;
    canvas.mouseYOffset = canvas.self.getBoundingClientRect().top;
    canvas.self.height = canvas.self.offsetHeight;
    canvas.self.width = canvas.self.offsetWidth;

    canvas.current.lineWidth = 4;

    canvas.self.addEventListener('mousedown', onMouseDown, false);
    canvas.self.addEventListener('mouseup', onMouseUp, false);
    canvas.self.addEventListener('mouseout', onMouseUp, false);
    canvas.self.addEventListener('mousemove', throttle(onMouseMove, 0), false);
    //window.addEventListener("resize", onResize);


} 

function moveCursor(x, y){
    console.log(x,y);
    var h = $("#pn").height();
    $("#pn").css({top: y+h, left: x});
}