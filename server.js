const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

/* QUEUE SYSTEM */
let queue = [];

io.on("connection", (socket) => {

  console.log("User:", socket.id);

  io.emit("online", io.engine.clientsCount);

  /* FIND MATCH */
  socket.on("find", () => {

    // remove if already in queue
    queue = queue.filter(s => s.id !== socket.id);

    if (queue.length > 0) {

      let partner = queue.shift();

      socket.partner = partner.id;
      partner.partner = socket.id;

      socket.emit("matched", { initiator: true });
      partner.emit("matched", { initiator: false });

      console.log("MATCH:", socket.id, partner.id);

    } else {
      queue.push(socket);
    }

  });

  /* SIGNAL */
  socket.on("signal", (data) => {
    if (socket.partner) {
      io.to(socket.partner).emit("signal", data);
    }
  });

  /* NEXT */
  socket.on("next", () => {

    if (socket.partner) {
      io.to(socket.partner).emit("partner-left");

      let partnerSocket = io.sockets.sockets.get(socket.partner);
      if (partnerSocket) partnerSocket.partner = null;
    }

    socket.partner = null;

    // re-add to queue
    queue.push(socket);

    // try match immediately
    tryMatch();
  });

  /* DISCONNECT */
  socket.on("disconnect", () => {

    // remove from queue
    queue = queue.filter(s => s.id !== socket.id);

    if (socket.partner) {
      io.to(socket.partner).emit("partner-left");

      let partnerSocket = io.sockets.sockets.get(socket.partner);
      if (partnerSocket) partnerSocket.partner = null;
    }

    io.emit("online", io.engine.clientsCount);
  });

});

/* MATCH FUNCTION */
function tryMatch() {

  while (queue.length >= 2) {

    let user1 = queue.shift();
    let user2 = queue.shift();

    user1.partner = user2.id;
    user2.partner = user1.id;

    user1.emit("matched", { initiator: true });
    user2.emit("matched", { initiator: false });

    console.log("MATCH:", user1.id, user2.id);
  }
}

app.get("/", (req,res)=>res.send("Server Running"));

server.listen(process.env.PORT || 3000, () => {
  console.log("Server running 🚀");
});
