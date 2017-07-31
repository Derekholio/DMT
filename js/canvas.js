//This is the canvas object. 
var canvas = {
    self: null,
    context: null,
    isDrawing: false,

    current: {
        color: 'yellow'
    },

    drawLine: function (x0, y0, x1, y1, color, emit) {
        this.context.beginPath();
        this.context.moveTo(x0, y0);
        this.context.lineTo(x1, y1);
        this.context.strokeStyle = color;
        this.context.lineWidth = 4;
        this.context.stroke();
        this.context.closePath();

        if (!emit) {
            return;
        }
        var w = 1;//this.self.width;
        var h = 1;//this.self.height;

        socket.emit('drawing', {
            x0: x0 / w,
            y0: y0 / h,
            x1: x1 / w,
            y1: y1 / h,
            color: color
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
    canvas.isDrawing = true;
    canvas.current.x = e.clientX;
    canvas.current.y = e.clientY;
}

function onMouseUp(e) {
    if (!canvas.isDrawing) {
        return;
    }
    canvas.isDrawing = false;
    canvas.drawLine(canvas.current.x, canvas.current.y, e.clientX, e.clientY, canvas.current.color, true);
}

function onMouseMove(e) {
    if (!canvas.isDrawing) {
        return;
    }
    canvas.drawLine(canvas.current.x - canvas.mouseXOffset, canvas.current.y - canvas.mouseYOffset, e.clientX - canvas.mouseXOffset, e.clientY - canvas.mouseYOffset, canvas.current.color, true);
    canvas.current.x = e.clientX;
    canvas.current.y = e.clientY;
}

function onDrawingEvent(data) {
    var w = 1;//canvas.self.width;
    var h = 1;//canvas.self.height;
    canvas.drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color);
}

function onColorUpdate(e) {
    canvas.current.color = e.target.className.split(' ')[1];
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

    canvas.self.addEventListener('mousedown', onMouseDown, false);
    canvas.self.addEventListener('mouseup', onMouseUp, false);
    canvas.self.addEventListener('mouseout', onMouseUp, false);
    canvas.self.addEventListener('mousemove', throttle(onMouseMove, 10), false);


}