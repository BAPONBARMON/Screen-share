const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// In-memory code store (free + simple)
const activeCodes = new Map();

// Helper: 4-digit code
function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

app.get("/", (req, res) => {
  res.send("✅ Live View Backend Running");
});

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // Client asks for its own code
  socket.on("request-code", () => {
    let code;
    do {
      code = generateCode();
    } while (activeCodes.has(code));

    activeCodes.set(code, socket.id);
    socket.join(code);

    socket.emit("your-code", code);
  });

  // Client wants to connect to another code
  socket.on("join-code", (code) => {
    if (activeCodes.has(code)) {
      socket.join(code);
      socket.emit("join-success", code);
      socket.to(code).emit("peer-joined");
    } else {
      socket.emit("join-failed", "Invalid or expired code");
    }
  });

  // WebRTC signaling
  socket.on("offer", (data) => {
    socket.to(data.room).emit("offer", data.offer);
  });

  socket.on("answer", (data) => {
    socket.to(data.room).emit("answer", data.answer);
  });

  socket.on("ice-candidate", (data) => {
    socket.to(data.room).emit("ice-candidate", data.candidate);
  });

  // Drawing / marking sync
  socket.on("draw", (data) => {
    socket.to(data.room).emit("draw", data);
  });

  socket.on("clear-canvas", (room) => {
    socket.to(room).emit("clear-canvas");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    // Remove code if owner disconnects
    for (let [code, id] of activeCodes.entries()) {
      if (id === socket.id) {
        activeCodes.delete(code);
        io.to(code).emit("session-ended");
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
