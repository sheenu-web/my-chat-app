// server.js

// 1. Import necessary modules
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// 2. Configure Cloudinary using environment variables from Render
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 3. Configure file storage with Cloudinary instead of local disk
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chat-app-uploads', // A folder name in your Cloudinary account
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt']
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB limit still applies
  }
});

// 4. Initialize the app and create a server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 5. Serve static files (HTML, CSS, client-side JS) from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// 6. Update the route to handle file uploads to Cloudinary
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  // Send back the secure URL from Cloudinary
  res.json({
    filePath: req.file.path 
  });
});

// 7. Handle Socket.IO connections (no changes here)
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
    // The filePath is now a full URL from Cloudinary
    io.emit('chat message', {
        username: socket.username,
        message: `uploaded a file: <a href="<span class="math-inline">\{data\.filePath\}" target\="\_blank"\></span>{data.fileName}</a>`
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

// 8. Start the server (no changes here)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
