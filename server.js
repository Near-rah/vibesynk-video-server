const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

let queue = [];

function cleanQueue(){
  queue = queue.filter(s => s && s.connected && !s.partner);
}

function tryMatch(){

  cleanQueue();

  while(queue.length >= 2){

    let a = queue.shift();
    let b = queue.shift();

    if(!a || !b) continue;

    a.partner = b.id;
    b.partner = a.id;

    a.emit("matched",{initiator:true});
    b.emit("matched",{initiator:false});

    console.log("MATCH:",a.id,b.id);
  }
}

io.on("connection",(socket)=>{

  io.emit("online",io.engine.clientsCount);

  socket.on("find",()=>{

    cleanQueue();

    if(!queue.find(s=>s.id===socket.id)){
      queue.push(socket);
    }

    tryMatch();
  });

  socket.on("signal",(data)=>{

    if(!socket.partner) return;

    let p = io.sockets.sockets.get(socket.partner);

    if(p){
      p.emit("signal",data);
    }
  });

  socket.on("next",()=>{

    if(socket.partner){

      let p = io.sockets.sockets.get(socket.partner);

      if(p){
        p.partner = null;
        p.emit("partner-left");

        if(!queue.find(s=>s.id===p.id)){
          queue.push(p);
        }
      }
    }

    socket.partner = null;

    queue = queue.filter(s=>s.id!==socket.id);
    queue.push(socket);

    tryMatch();
  });

  socket.on("disconnect",()=>{

    queue = queue.filter(s=>s.id!==socket.id);

    if(socket.partner){

      let p = io.sockets.sockets.get(socket.partner);

      if(p){
        p.partner = null;
        p.emit("partner-left");

        if(!queue.find(s=>s.id===p.id)){
          queue.push(p);
        }
      }
    }

    io.emit("online",io.engine.clientsCount);
  });

});

app.get("/",(req,res)=>res.send("Server Running"));

server.listen(process.env.PORT || 3000,()=>{
  console.log("Server running 🚀");
});
