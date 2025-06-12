// client.js
document.addEventListener('DOMContentLoaded', () => {
    const socket = io({ autoConnect: false });

    // --- DOM Elements ---
    const usernameContainer = document.getElementById('username-container');
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input'); // New
    const loginButton = document.getElementById('login-button');
    const loginError = document.getElementById('login-error'); // New
    
    const chatContainer = document.getElementById('chat-container');
    const messages = document.getElementById('messages');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('m');
    
    // --- Login Handling ---
    const handleLogin = () => {
        const name = usernameInput.value.trim();
        const pass = passwordInput.value; // Get password value

        if (name) {
            loginError.textContent = '';
            // Send username AND password to the server
            socket.connect();
            socket.emit('user joined', { username: name, password: pass });
        }
    };

    loginButton.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    // Handle successful login from server
    socket.on('login successful', () => {
        usernameContainer.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        messageInput.focus();
    });

    // Handle failed login from server
    socket.on('login failed', (errorMsg) => {
        loginError.textContent = `// ${errorMsg}`;
        socket.disconnect();
    });

    // --- Chat Message Handling ---
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (messageInput.value) {
            socket.emit('chat message', messageInput.value);
            messageInput.value = '';
        }
    });

    const addMessage = (data) => {
        const item = document.createElement('li');
        // Check for admin status to apply a different style
        if (data.isAdmin) {
            item.classList.add('admin-message');
        }
        item.innerHTML = `<strong>${data.username}:</strong> ${data.message || data.message_text}`;
        messages.appendChild(item);
        messages.scrollTop = messages.scrollHeight; // Advanced scrolling
    };

    socket.on('chat message', (data) => {
        addMessage(data);
    });

    // --- Load Message History ---
    socket.on('load history', (history) => {
        history.forEach(data => {
            addMessage(data);
        });
    });

    // --- File Upload Logic is now REMOVED ---
});
