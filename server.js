const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

let waitingUser = null;

io.on("connection", (socket) => {

  console.log("User:", socket.id);

  io.emit("online", io.engine.clientsCount);

  socket.on("find", () => {

    if (waitingUser && waitingUser.id !== socket.id) {

      let partner = waitingUser;
      waitingUser = null;

      socket.partner = partner.id;
      partner.partner = socket.id;

      socket.emit("matched", {
        id: partner.id,
        initiator: true
      });

      partner.emit("matched", {
        id: socket.id,
        initiator: false
      });

    } else {
      waitingUser = socket;
    }

  });

  socket.on("signal", (data) => {
    if (socket.partner) {
      io.to(socket.partner).emit("signal", data);
    }
  });

  socket.on("disconnect", () => {

    if (waitingUser === socket) waitingUser = null;

    if (socket.partner) {
      io.to(socket.partner).emit("leave");
    }

    io.emit("online", io.engine.clientsCount);
  });

});

server.listen(3000, () => {
  console.log("Server running 🚀");
});
