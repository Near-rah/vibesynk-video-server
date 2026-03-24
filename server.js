const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

/* QUEUE */
let queue = [];

/* CLEAN QUEUE */
function cleanQueue() {
  queue = queue.filter(s => s && s.connected && !s.partner);
}

/* MATCH USERS */
function tryMatch() {

  cleanQueue();

  while (queue.length >= 2) {

    let user1 = queue.shift();
    let user2 = queue.shift();

    if (!user1 || !user2) continue;
    if (!user1.connected || !user2.connected) continue;

    user1.partner = user2.id;
    user2.partner = user1.id;

    user1.emit("matched", { initiator: true });
    user2.emit("matched", { initiator: false });

    console.log("MATCH:", user1.id, user2.id);
  }
}

io.on("connection", (socket) => {

  console.log("User:", socket.id);

  io.emit("online", io.engine.clientsCount);

  /* FIND */
  socket.on("find", () => {

    cleanQueue();

    // prevent duplicate entry
    if (!queue.find(s => s.id === socket.id)) {
      queue.push(socket);
    }

    tryMatch();
  });

  /* SIGNAL */
  socket.on("signal", (data) => {

    if (!socket.partner) return;

    let partnerSocket = io.sockets.sockets.get(socket.partner);

    if (partnerSocket) {
      partnerSocket.emit("signal", data);
    }
  });

  /* NEXT */
  socket.on("next", () => {

    if (socket.partner) {

      let partnerSocket = io.sockets.sockets.get(socket.partner);

      if (partnerSocket) {
        partnerSocket.partner = null;
        partnerSocket.emit("partner-left");

        // requeue partner safely
        if (!queue.find(s => s.id === partnerSocket.id)) {
          queue.push(partnerSocket);
        }
      }
    }

    socket.partner = null;

    // remove self from queue first
    queue = queue.filter(s => s.id !== socket.id);

    // re-add self
    queue.push(socket);

    tryMatch();
  });

  /* DISCONNECT */
  socket.on("disconnect", () => {

    // remove from queue
    queue = queue.filter(s => s.id !== socket.id);

    if (socket.partner) {

      let partnerSocket = io.sockets.sockets.get(socket.partner);

      if (partnerSocket) {
        partnerSocket.partner = null;
        partnerSocket.emit("partner-left");

        // requeue partner
        if (!queue.find(s => s.id === partnerSocket.id)) {
          queue.push(partnerSocket);
        }
      }
    }

    io.emit("online", io.engine.clientsCount);
  });

});

app.get("/", (req,res)=>res.send("Server Running 🚀"));

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running 🚀");
});
