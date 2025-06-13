// server.js - Final Bug Fix

// 1. Import Modules
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Pool } = require('pg'); // <-- THIS IS THE MISSING LINE THAT IS NOW FIXED
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// --- CONFIGURATION ---
const ADMIN_USER = 'shresth';
const ADMIN_PASS = 'sheenu2020@';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'modern-chat-uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf'] 
  }
});

const upload = multer({ storage: storage });
// --- END CONFIGURATION ---


// --- APP & SERVER INITIALIZATION ---
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  res.json({
    filePath: req.file.path,
    resourceType: req.file.resource_type 
  });
});
// --- END APP INITIALIZATION ---


// --- SOCKET.IO LOGIC ---
io.on('connection', async (socket) => {
  console.log('A user connected');

  try {
    const result = await pool.query('SELECT username, message_text, is_admin FROM messages ORDER BY created_at ASC LIMIT 150');
    socket.emit('load history', result.rows);
  } catch (err) {
    console.error('Error loading message history', err);
  }

  socket.on('user joined', (data) => {
    const { username, password } = data;
    if (username.toLowerCase() === ADMIN_USER) {
      if (password === ADMIN_PASS) {
        socket.username = `${ADMIN_USER}`;
        socket.isAdmin = true;
        socket.emit('login successful');
        socket.broadcast.emit('chat message', { username: 'System', message: `${socket.username} (Admin) has entered the chat.` });
      } else {
        socket.emit('login failed', 'Invalid admin credentials.');
      }
    } else {
      socket.username = username;
      socket.isAdmin = false;
      socket.emit('login successful');
      socket.broadcast.emit('chat message', { username: 'System', message: `${username} has joined the chat.` });
    }
  });

  socket.on('chat message', async (msg) => {
    if (!socket.username) return;
    try {
      await pool.query('INSERT INTO messages(username, message_text, is_admin) VALUES($1, $2, $3)', [socket.username, msg, socket.isAdmin]);
      io.emit('chat message', { username: socket.username, message: msg, isAdmin: socket.isAdmin });
    } catch (err) {
      console.error('Error saving message', err);
    }
  });

  socket.on('file uploaded', async (data) => {
    if (!socket.username) return;
    
    let messageText;
    if (data.resourceType === 'image') {
      messageText = `<a href="${data.filePath}" target="_blank" title="View full image"><img src="${data.filePath}" alt="${data.fileName}" class="chat-image"/></a>`;
    } else {
      const fileLink = `<a href="${data.filePath}" target="_blank">${data.fileName}</a>`;
      messageText = `uploaded a file: ${fileLink}`;
    }
    
    try {
        await pool.query('INSERT INTO messages(username, message_text, is_admin) VALUES($1, $2, $3)', [socket.username, messageText, socket.isAdmin]);
        io.emit('chat message', { username: socket.username, message: messageText, isAdmin: socket.isAdmin });
    } catch (err) {
        console.error('Error saving file message', err);
    }
  });

  socket.on('disconnect', () => {
    if (socket.username) {
      const displayName = socket.isAdmin ? `${socket.username} (Admin)` : socket.username;
      io.emit('chat message', { username: 'System', message: `${displayName} has left the chat.` });
    }
  });
});
// --- END SOCKET.IO LOGIC ---

// Note: The Global Error Handler has been removed as it was for debugging and is no longer needed.

// --- SERVER START ---
const createTable = async () => {
    const queryText = `
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        message_text TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    try {
      await pool.query(queryText);
      console.log('Messages table is ready.');
    } catch (err) {
      console.error('Error creating messages table', err);
    }
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  await createTable();
});
