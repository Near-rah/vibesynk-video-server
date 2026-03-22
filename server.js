const express = require("express");
const http = require("http");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
    transports: ["websocket","polling"]
});

/* ================= STATE ================= */

let users = {};
let waitingQueue = [];

/* ================= HELPERS ================= */

function removeFromQueue(socket){
    waitingQueue = waitingQueue.filter(s => s.id !== socket.id);
}

function tryMatch(){

    while(waitingQueue.length >= 2){

        let a = waitingQueue.shift();
        let b = waitingQueue.shift();

        if(!a || !b) return;

        a.partner = b;
        b.partner = a;

        // ✅ ONE initiator, ONE receiver
        a.emit("connected", { initiator:true });
        b.emit("connected", { initiator:false });
    }
}

/* ================= SOCKET ================= */

io.on("connection",(socket)=>{

    users[socket.id] = socket;
    io.emit("onlineCount", Object.keys(users).length);

    socket.partner = null;

    /* JOIN */
    socket.on("join",()=>{

        if(socket.partner) return;

        removeFromQueue(socket);
        waitingQueue.push(socket);

        socket.emit("waiting");

        tryMatch();
    });

    /* NEXT */
    socket.on("next",()=>{

        if(socket.partner){
            socket.partner.emit("strangerLeft");
            socket.partner.partner = null;
        }

        socket.partner = null;

        removeFromQueue(socket);
        waitingQueue.push(socket);

        socket.emit("waiting");

        tryMatch();
    });

    /* SIGNAL (FIXED) */
    socket.on("signal",(payload)=>{

        if(socket.partner){
            socket.partner.emit("signal", {
                from: socket.id,
                data: payload
            });
        }

    });

    /* MESSAGE (fallback if datachannel fails) */
    socket.on("message",(msg)=>{
        if(socket.partner){
            socket.partner.emit("message", msg);
        }
    });

    /* DISCONNECT */
    socket.on("disconnect",()=>{

        delete users[socket.id];
        io.emit("onlineCount", Object.keys(users).length);

        removeFromQueue(socket);

        if(socket.partner){
            socket.partner.emit("strangerLeft");
            socket.partner.partner = null;
        }
    });

});

/* START */
server.listen(3000,()=>console.log("Server running 🚀"));
