// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configure file storage with Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB
  }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Create a route to handle file uploads
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  res.json({
    filePath: `/uploads/${req.file.filename}`
  });
});

// Handle Socket.IO connections for the chat
io.on('connection', (socket) => {
  socket.on('user joined', (username) => {
    socket.username = username;
    socket.broadcast.emit('chat message', {
      username: 'System',
      message: `${username} has joined the chat.`
    });
  });

  socket.on('chat message', (msg) => {
    io.emit('chat message', {
      username: socket.username,
      message: msg
    });
  });
  
  socket.on('file uploaded', (data) => {
    io.emit('chat message', {
        username: socket.username,
        message: `uploaded a file: <a href="${data.filePath}" target="_blank">${data.fileName}</a>`
    });
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      io.emit('chat message', {
        username: 'System',
        message: `${socket.username} has left the chat.`
      });
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});