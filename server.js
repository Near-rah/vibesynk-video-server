const express = require("express");
const http = require("http");
const fs = require("fs");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
    transports: ["polling","websocket"]
});

/* FILE */
const BAN_FILE = "banned.json";

function loadBans(){
    try { return JSON.parse(fs.readFileSync(BAN_FILE)); }
    catch { return {}; }
}

function saveBans(){
    fs.writeFileSync(BAN_FILE, JSON.stringify(bannedUsers,null,2));
}

/* STATE */
let users = {};
let waitingQueue = [];
let reportCounts = {};
let bannedUsers = loadBans();
let sessionReported = {};

/* HELPERS */
function generateUID(){
    return "U_" + Math.random().toString(36).substr(2,9);
}

function removeFromQueue(socket){
    waitingQueue = waitingQueue.filter(u => u.id !== socket.id);
}

/* MATCH */
function tryMatch(){
    while(waitingQueue.length >= 2){

        let u1 = waitingQueue.shift();
        let u2 = waitingQueue.shift();

        if(!u1 || !u2) return;

        u1.partner = u2;
        u2.partner = u1;

        sessionReported[u1.uid] = false;
        sessionReported[u2.uid] = false;

        u1.emit("connected");
        u2.emit("connected");
    }
}

/* SOCKET */
io.on("connection",(socket)=>{

    socket.uid = generateUID();
    socket.partner = null;

    if(bannedUsers[socket.uid]){
        socket.emit("banned");
        return;
    }

    users[socket.uid] = socket;
    io.emit("onlineCount", Object.keys(users).length);

    /* JOIN */
    socket.on("join",()=>{
        if(socket.partner) return;
        removeFromQueue(socket);
        waitingQueue.push(socket);
        socket.emit("waiting");
        tryMatch();
    });

    /* MESSAGE */
    socket.on("message",(msg)=>{
        if(socket.partner){
            socket.partner.emit("message", msg);
        }
    });

    /* TYPING */
    socket.on("typing",()=>{
        if(socket.partner){
            socket.partner.emit("typing");
        }
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

    /* ===== WEBRTC SIGNAL ===== */
    socket.on("signal",(data)=>{
        if(socket.partner){
            socket.partner.emit("signal", data);
        }
    });

    /* DISCONNECT */
    socket.on("disconnect",()=>{

        delete users[socket.uid];
        removeFromQueue(socket);

        io.emit("onlineCount", Object.keys(users).length);

        if(socket.partner){
            socket.partner.emit("strangerLeft");
            socket.partner.partner = null;
        }
    });

});

/* START */
server.listen(3000,()=>console.log("Server running 🚀"));
