const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const mongoose = require("mongoose");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

server.on("upgrade", function (request, socket, head) {
  if (request.url === "/ws") {
    wss.handleUpgrade(request, socket, head, function done(ws) {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

mongoose.connect(
  "mongodb+srv://vairamuthu:vairamuthu@cluster0.2qcddvx.mongodb.net/C-Dash",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);
app.use(express.json());
const projRoutes = require("./routes/data");
app.use("/auth", projRoutes);
app.use("/api", userRoutes);

const ChatSchema = new mongoose.Schema({
  username: String,
  message: String,
  timestamp: Date,
});

const Chat = mongoose.model("Chat", ChatSchema);
let users = {}; // user ID -> socket mapping

wss.on("connection", (ws) => {
  console.log("a user connected");

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "user joined") {
      const userID = data.userID;
      users[userID] = ws;
    } else if (data.type === "private message") {
      const chat = new Chat({
        username: data.from,
        message: data.message,
        timestamp: data.timestamp,
      });

      chat
        .save()
        .then(() => {
          const toSocket = users[data.to];
          if (toSocket && toSocket.readyState === WebSocket.OPEN) {
            toSocket.send(JSON.stringify(data));
          } else {
            console.warn(`User ${data.to} is not connected.`);
          }
        })
        .catch((err) => {
          console.error("Failed to save chat:", err);
        });
    }
  });

  ws.on("close", () => {
    console.log("user disconnected");
    Object.keys(users).forEach((userID) => {
      if (users[userID] === ws) {
        delete users[userID];
      }
    });
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "🦄🌈✨👋🌎🌍🌏✨🌈🦄",
  });
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
