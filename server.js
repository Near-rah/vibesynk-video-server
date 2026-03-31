const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    pingTimeout: 25000,
    pingInterval: 10000
});

let queue = [];

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function cleanQueue() {
    queue = queue.filter(s => s && s.connected && !s.partner);
}

function tryMatch() {
    cleanQueue();
    shuffle(queue);                    // ← This removes any device priority
    while (queue.length >= 2) {
        let a = queue.shift();
        let b = queue.shift();
        if (!a?.connected || !b?.connected) continue;

        a.partner = b.id;
        b.partner = a.id;

        a.emit("matched", { initiator: true });
        b.emit("matched", { initiator: false });

        console.log(`MATCHED: ${a.id} <-> ${b.id}`);
    }
}

io.on("connection", (socket) => {
    console.log("🔌 Connected:", socket.id);
    io.emit("online", io.engine.clientsCount);

    socket.on("find", () => {
        cleanQueue();
        if (!queue.some(s => s.id === socket.id) && !socket.partner) {
            queue.push(socket);
        }
        tryMatch();
    });

    socket.on("signal", (data) => {
        if (!socket.partner) return;
        const partner = io.sockets.sockets.get(socket.partner);
        if (partner && partner.connected) {
            partner.emit("signal", data);
        }
    });

    socket.on("next", () => {
        if (socket.partner) {
            const partner = io.sockets.sockets.get(socket.partner);
            if (partner) {
                partner.partner = null;
                partner.emit("partner-left");
                if (!queue.some(s => s.id === partner.id) && partner.connected) {
                    queue.push(partner);
                }
            }
        }
        socket.partner = null;
        queue = queue.filter(s => s.id !== socket.id);
        if (socket.connected) queue.push(socket);
        tryMatch();
    });

    socket.on("disconnect", () => {
        console.log("❌ Disconnected:", socket.id);
        queue = queue.filter(s => s.id !== socket.id);

        if (socket.partner) {
            const partner = io.sockets.sockets.get(socket.partner);
            if (partner) {
                partner.partner = null;
                partner.emit("partner-left");
                if (!queue.some(s => s.id === partner.id) && partner.connected) {
                    queue.push(partner);
                }
            }
        }
        io.emit("online", io.engine.clientsCount);
    });
});

app.get("/", (req, res) => res.send("VibeSynk Server Running 🚀"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
