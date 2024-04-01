const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
      origin: "http://localhost:3000", // Adjust the origin to your frontend's URL
      methods: ["GET", "POST"]
    }
  });
const PORT = 3001;
const path = require('path');
const cors = require('cors');

app.use(cors());

let socketList = {};

app.use(express.static(path.join(__dirname, 'public')));

// if (process.env.NODE_ENV === 'production') {
//   app.use(express.static(path.join(__dirname, '../client/build')));

//   app.get('/*', function (req, res) {
//     res.sendFile(path.join(__dirname, '../client/build/index.html'));
//   });
// }

// Route
app.get('/ping', (req, res) => {
  res
    .send({
      success: true,
    })
    .status(200);
});

// Socket
io.on('connection', (socket) => {
  console.log(`New User connected: ${socket.id}`);

  socket.on('disconnect', () => {
    socket.disconnect();
    console.log('User disconnected!');
  });

  socket.on('BE-check-user', ({ roomId, userName }) => {
    console.log("I am called");
    console.log("socket list is:",socketList);
    let error = false;
    io.of('/').in(roomId).fetchSockets().then((sockets) => {
      const clients = sockets.map((socket) => socket.id);
      clients.forEach((client) => {
        if (socketList[client] === userName) {
          error = true;
          console.log("socket list is: ",socketList);
          socket.emit('FE-error-user-exist', { error });
        }
      });
      socket.emit('FE-error-user-exist', { error });
    });
  });

  /**
   * Join Room
   */
  socket.on('BE-join-room', ({ roomId, userName }) => {
    console.log("meri bari bhi aa gyi")
    // Socket Join RoomName
    socket.join(roomId);
    socketList[socket.id] = { userName, video: true, audio: true };

    // Set User List
    io.of('/').in(roomId).fetchSockets().then((sockets) => {
        try {
            const clients = sockets.map((socket) => socket.id);
            const users = [];
            clients.forEach((client) => {
              // Add User List
              users.push({ userId: client, info: socketList[client] });
            });
            socket.broadcast.to(roomId).emit('FE-user-join', users);
            // io.sockets.in(roomId).emit('FE-user-join', users);
          } catch (e) {
            io.sockets.in(roomId).emit('FE-error-user-exist', { err: true });
          }
    })
  });

  socket.on('BE-call-user', ({ userToCall, from, signal }) => {
    io.to(userToCall).emit('FE-receive-call', {
      signal,
      from,
      info: socketList[socket.id],
    });
  });

  socket.on('BE-accept-call', ({ signal, to }) => {
    io.to(to).emit('FE-call-accepted', {
      signal,
      answerId: socket.id,
    });
  });

  socket.on('BE-send-message', ({ roomId, msg, sender }) => {
    io.sockets.in(roomId).emit('FE-receive-message', { msg, sender });
  });

  socket.on('BE-leave-room', ({ roomId, leaver }) => {
    delete socketList[socket.id];
    socket.broadcast
      .to(roomId)
      .emit('FE-user-leave', { userId: socket.id, userName: [socket.id] });
    // io.sockets.sockets[socket.id].leave(roomId);
    socket.leave(roomId);
  });

  socket.on('BE-toggle-camera-audio', ({ roomId, switchTarget }) => {
    if (switchTarget === 'video') {
      socketList[socket.id].video = !socketList[socket.id].video;
    } else {
      socketList[socket.id].audio = !socketList[socket.id].audio;
    }
    socket.broadcast
      .to(roomId)
      .emit('FE-toggle-camera', { userId: socket.id, switchTarget });
  });
});

http.listen(PORT, () => {
  console.log('Connected : 3001');
});
