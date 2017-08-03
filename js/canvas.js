//This is the canvas object. 
var canvas = {
    self: null,
    context: null,
    isDrawing: false,

    current: {
        color: 'black',
        lineWidth: 4
    },

    drawLine: function (x0, y0, x1, y1, color, lineWidth, emit = false) {
        console.log(x0, y0, x1, y1, color);
        this.context.beginPath();
        this.context.moveTo(x0, y0);
        this.context.lineTo(x1, y1);
        this.context.strokeStyle = color;
        this.context.lineWidth = lineWidth;
        this.context.stroke();
        this.context.closePath();

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
}

function onColorUpdate(e) {
    var tar = e.target.className.split(' ')[2];
    console.log(tar);
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
    canvas.self.addEventListener('mousemove', throttle(onMouseMove, 50), false);
    //window.addEventListener("resize", onResize);


}