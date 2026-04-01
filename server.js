const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, { 
    cors: { origin: "*" },
    pingTimeout: 30000,
    pingInterval: 10000
});

// ✅ Use Set (no duplicates)
let queue = new Set();
let matching = false;

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// ✅ Clean invalid users
function cleanQueue() {
    for (let id of queue) {
        const s = io.sockets.sockets.get(id);
        if (!s || !s.connected || s.partner) {
            queue.delete(id);
        }
    }
}

// ✅ Safe matching
function tryMatch() {
    if (matching) return;
    matching = true;

    cleanQueue();

    let arr = Array.from(queue);
    shuffle(arr);

    while (arr.length >= 2) {
        const idA = arr.shift();
        const idB = arr.shift();

        const a = io.sockets.sockets.get(idA);
        const b = io.sockets.sockets.get(idB);

        if (!a || !b || !a.connected || !b.connected || a.partner || b.partner) continue;

        // Remove from queue
        queue.delete(idA);
        queue.delete(idB);

        a.partner = idB;
        b.partner = idA;

        a.emit("matched", { initiator: true });
        b.emit("matched", { initiator: false });

        console.log(`MATCHED: ${idA} <-> ${idB}`);
    }

    matching = false;
}

io.on("connection", (socket) => {
    console.log("🔌 Connected:", socket.id);
    io.emit("online", io.engine.clientsCount);

    socket.partner = null;

    socket.on("find", () => {
        cleanQueue();

        if (!socket.partner && !queue.has(socket.id)) {
            queue.add(socket.id);
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

                if (partner.connected) queue.add(partner.id);
            }
        }

        socket.partner = null;
        queue.delete(socket.id);

        if (socket.connected) queue.add(socket.id);

        tryMatch();
    });

    socket.on("disconnect", () => {
        console.log("❌ Disconnected:", socket.id);

        queue.delete(socket.id);

        if (socket.partner) {
            const partner = io.sockets.sockets.get(socket.partner);

            if (partner) {
                partner.partner = null;
                partner.emit("partner-left");

                if (partner.connected) queue.add(partner.id);
            }
        }

        io.emit("online", io.engine.clientsCount);
    });
});

app.get("/", (req, res) => res.send("VibeSynk Server Running 🚀"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
