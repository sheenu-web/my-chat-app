// server.js

// 1. Import Modules
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { Pool } = require('pg'); // <-- NEW: Import the pg library

// --- NEW: DATABASE SETUP ---
// Render provides the DATABASE_URL environment variable.
// The 'pg' library automatically uses it to connect.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render database connections
  }
});

// Function to create the messages table if it doesn't exist
const createTable = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) NOT NULL,
      message_text TEXT NOT NULL,
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
// --- END DATABASE SETUP ---


// --- CLOUDINARY FILE UPLOAD SETUP ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chat-app-uploads',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt']
  }
});

const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } });
// --- END CLOUDINARY SETUP ---


// --- APP & SERVER INITIALIZATION ---
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  res.json({ filePath: req.file.path });
});
// --- END APP INITIALIZATION ---


// --- SOCKET.IO LOGIC ---
io.on('connection', async (socket) => {
  console.log('A user connected');

  // NEW: Load message history when a user connects
  try {
    const result = await pool.query('SELECT username, message_text FROM messages ORDER BY created_at ASC LIMIT 100');
    // Send message history to the newly connected client ONLY
    socket.emit('load history', result.rows);
  } catch (err) {
    console.error('Error loading message history', err);
  }

  socket.on('user joined', (username) => {
    socket.username = username;
    socket.broadcast.emit('chat message', {
      username: 'System',
      message: `${username} has joined the chat.`
    });
  });

  // UPDATED: Save message to database before sending to clients
  socket.on('chat message', async (msg) => {
    try {
      // Save the new message to the database
      await pool.query('INSERT INTO messages(username, message_text) VALUES($1, $2)', [socket.username, msg]);

      // Broadcast the message to all clients
      io.emit('chat message', {
        username: socket.username,
        message: msg
      });
    } catch (err) {
      console.error('Error saving message', err);
    }
  });

  socket.on('file uploaded', (data) => {
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
// --- END SOCKET.IO LOGIC ---


// --- SERVER START ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  // NEW: Create the database table when the server starts
  await createTable();
});
