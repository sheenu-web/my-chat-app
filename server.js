// server.js

// 1. Import Modules
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Pool } = require('pg'); // Database library

// --- NEW: Admin Credentials (INSECURE - FOR DEMO ONLY) ---
const ADMIN_USER = 'shresth';
const ADMIN_PASS = 'sheenu2020@';
// ---------------------------------------------------------

// --- DATABASE SETUP ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

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

// --- APP & SERVER INITIALIZATION ---
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));
// --- END APP INITIALIZATION ---

// --- SOCKET.IO LOGIC ---
io.on('connection', async (socket) => {
  console.log('A user connected');

  try {
    const result = await pool.query('SELECT username, message_text FROM messages ORDER BY created_at DESC LIMIT 100');
    // Reverse the order to display correctly on the client
    socket.emit('load history', result.rows.reverse());
  } catch (err) {
    console.error('Error loading message history', err);
  }
  
  // UPDATED: Handle login with admin check
  socket.on('user joined', (data) => {
    const { username, password } = data;

    // Admin Login Check
    if (username.toLowerCase() === ADMIN_USER) {
      if (password === ADMIN_PASS) {
        socket.username = `${ADMIN_USER} [ADMIN]`;
        socket.isAdmin = true;
        socket.emit('login successful'); // Let the client know they are in
        socket.broadcast.emit('chat message', {
          username: 'System',
          message: `${socket.username} has entered the network.`
        });
      } else {
        // Failed admin login
        socket.emit('login failed', 'Invalid admin credentials.');
        return;
      }
    } else {
      // Regular User Login
      socket.username = username;
      socket.isAdmin = false;
      socket.emit('login successful'); // Let the client know they are in
      socket.broadcast.emit('chat message', {
        username: 'System',
        message: `${username} has joined the chat.`
      });
    }
  });

  // UPDATED: Save message to database
  socket.on('chat message', async (msg) => {
    // Only process message if user has a username (is logged in)
    if (!socket.username) return;

    try {
      await pool.query('INSERT INTO messages(username, message_text) VALUES($1, $2)', [socket.username, msg]);
      io.emit('chat message', {
        username: socket.username,
        message: msg,
        isAdmin: socket.isAdmin // Pass admin status to the client
      });
    } catch (err) {
      console.error('Error saving message', err);
    }
  });
  
  // REMOVED: 'file uploaded' event listener is gone.

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
  await createTable();
});
