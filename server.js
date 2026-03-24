const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

let queue = [];   // waiting users

// Clean invalid sockets from queue
function cleanQueue() {
  queue = queue.filter(s => s && s.connected && !s.partner);
}

function tryMatch() {
  cleanQueue();
  while (queue.length >= 2) {
    let a = queue.shift();
    let b = queue.shift();

    if (!a || !a.connected || !b || !b.connected) continue;

    // Pair them
    a.partner = b.id;
    b.partner = a.id;

    a.emit("matched", { initiator: true });
    b.emit("matched", { initiator: false });

    console.log(`MATCHED: ${a.id} <-> ${b.id}`);
  }
}

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  io.emit("online", io.engine.clientsCount);

  socket.on("find", () => {
    cleanQueue();
    if (!queue.find(s => s.id === socket.id) && !socket.partner) {
      queue.push(socket);
      console.log("Added to queue:", socket.id);
    }
    tryMatch();
  });

  socket.on("signal", (data) => {
    if (!socket.partner) return;
    const partner = io.sockets.sockets.get(socket.partner);
    if (partner) {
      partner.emit("signal", data);
    }
  });

  socket.on("next", () => {
    if (socket.partner) {
      const partner = io.sockets.sockets.get(socket.partner);
      if (partner) {
        partner.partner = null;
        partner.emit("partner-left");
        // Add partner back to queue if not already there
        if (!queue.find(s => s.id === partner.id) && !partner.partner) {
          queue.push(partner);
        }
      }
    }

    socket.partner = null;
    // Remove current user from queue and add again for new match
    queue = queue.filter(s => s.id !== socket.id);
    if (socket.connected) {
      queue.push(socket);
    }
    tryMatch();
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    queue = queue.filter(s => s.id !== socket.id);

    if (socket.partner) {
      const partner = io.sockets.sockets.get(socket.partner);
      if (partner) {
        partner.partner = null;
        partner.emit("partner-left");
        if (!queue.find(s => s.id === partner.id) && partner.connected) {
          queue.push(partner);
        }
      }
    }
    io.emit("online", io.engine.clientsCount);
  });
});

app.get("/", (req, res) => res.send("VibeSynk Server Running 🚀"));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
