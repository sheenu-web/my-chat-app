// client.js
document.addEventListener('DOMContentLoaded', () => {
    const socket = io({ autoConnect: false });

    // --- Element Selectors ---
    const loginContainer = document.getElementById('login-container');
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    const loginButton = document.getElementById('login-button');
    const loginError = document.getElementById('login-error');
    
    const chatContainer = document.getElementById('chat-container');
    const messages = document.getElementById('messages');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('m');
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');
    const progressBarContainer = document.getElementById('progress-bar-container');
    const progressBar = document.getElementById('progress-bar');
    const adminPanel = document.getElementById('admin-panel');
    const clearChatButton = document.getElementById('clear-chat-button');
    
    let localUsername = '';

    // --- Login Logic ---
    const handleLogin = () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        if (username) {
            localUsername = username;
            loginError.textContent = '';
            socket.connect();
            socket.emit('user joined', { username, password });
        }
    };

    loginButton.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    // UPDATED: Show admin panel on successful admin login
    socket.on('login successful', (data) => {
        loginContainer.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        if (data.isAdmin) {
            adminPanel.classList.remove('hidden');
        }
        messageInput.focus();
    });

    socket.on('login failed', (errorMsg) => {
        loginError.textContent = errorMsg;
        socket.disconnect();
    });

    // --- Message & History Logic ---
    const addMessage = (data) => {
        const item = document.createElement('li');
        if (data.username === localUsername || data.username === 'shresth' && localUsername === 'shresth') {
            item.classList.add('my-message');
        }
        if (data.isAdmin) { item.classList.add('admin-message'); }
        if (data.username === 'System') { item.classList.add('system-message'); }
        item.innerHTML = `<strong>${data.username}:</strong> ${data.message || data.message_text}`;
        messages.appendChild(item);
        messages.scrollTop = messages.scrollHeight;
    };

    socket.on('chat message', addMessage);
    socket.on('load history', (history) => {
        messages.innerHTML = '';
        history.forEach(addMessage);
    });

    // --- Form & File Upload Logic ---
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (messageInput.value) {
            socket.emit('chat message', messageInput.value);
            messageInput.value = '';
        }
    });

    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            uploadStatus.textContent = 'Error: Only image and PDF files are allowed.';
            setTimeout(() => { uploadStatus.textContent = ''; }, 4000);
            fileInput.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const config = {
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                uploadStatus.textContent = '';
                progressBarContainer.classList.remove('hidden');
                progressBar.style.width = `${percentCompleted}%`;
                progressBar.textContent = `${percentCompleted}%`;
            }
        };

        axios.post('/upload', formData, config)
            .then(response => {
                progressBar.textContent = 'Success!';
                // UPDATED: Now sends 'isImage' boolean
                socket.emit('file uploaded', { 
                    fileName: file.name, 
                    filePath: response.data.filePath,
                    isImage: response.data.isImage
                });
            })
            .catch(error => { /* ... */ })
            .finally(() => { /* ... */ });
    });

    // --- NEW: Admin Panel Logic ---
    clearChatButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete ALL messages forever? This cannot be undone.')) {
            socket.emit('admin clear all');
        }
    });

    socket.on('chat cleared', () => {
        messages.innerHTML = '';
        addMessage({ username: 'System', message: 'Chat history has been cleared by an admin.'});
    });
});
