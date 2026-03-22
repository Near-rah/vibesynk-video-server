const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

let waitingUser = null;

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("find-partner", () => {
    if (waitingUser) {
      let partner = waitingUser;

      waitingUser = null;

      socket.partner = partner.id;
      partner.partner = socket.id;

      socket.emit("partner-found", partner.id);
      partner.emit("partner-found", socket.id);
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

    console.log("User disconnected:", socket.id);
  });
});

app.get("/", (req, res) => {
  res.send("VibeSynk Server Running");
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
