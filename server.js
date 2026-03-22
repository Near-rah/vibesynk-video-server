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

  console.log("User connected:", socket.id);

  // ✅ SEND ONLINE COUNT
  io.emit("online-count", io.engine.clientsCount);

  // 🔍 FIND PARTNER
  socket.on("find-partner", () => {

    if (waitingUser && waitingUser.id !== socket.id) {

      let partner = waitingUser;
      waitingUser = null;

      socket.partner = partner.id;
      partner.partner = socket.id;

      // ✅ ONE INITIATOR, ONE RECEIVER
      socket.emit("partner-found", {
        id: partner.id,
        initiator: true
      });

      partner.emit("partner-found", {
        id: socket.id,
        initiator: false
      });

    } else {
      waitingUser = socket;
    }

  });

  // 🔁 SIGNAL EXCHANGE
  socket.on("signal", (data) => {
    io.to(data.to).emit("signal", {
      from: socket.id,
      data: data.data
    });
  });

  // ❌ DISCONNECT
  socket.on("disconnect", () => {

    if (socket.partner) {
      io.to(socket.partner).emit("partner-disconnected");
    }

    if (waitingUser === socket) {
      waitingUser = null;
    }

    // ✅ UPDATE ONLINE COUNT
    io.emit("online-count", io.engine.clientsCount);

    console.log("User disconnected:", socket.id);
  });

});

app.get("/", (req, res) => {
  res.send("VibeSynk Server Running");
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Server started");
});
