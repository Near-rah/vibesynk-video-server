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

  socket.on("find-partner", () => {
    if (waitingUser) {
      let partner = waitingUser;
      waitingUser = null;

      socket.partner = partner.id;
      partner.partner = socket.id;

      // ✅ FIXED (initiator logic)
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

  socket.on("signal", (data) => {
    io.to(data.to).emit("signal", {
      from: socket.id,
      data: data.data
    });
  });

  socket.on("disconnect", () => {
    if (socket.partner) {
      io.to(socket.partner).emit("partner-disconnected");
    }

    if (waitingUser === socket) {
      waitingUser = null;
    }
  });
});

app.get("/", (req, res) => {
  res.send("Server Running");
});

server.listen(process.env.PORT || 3000);
