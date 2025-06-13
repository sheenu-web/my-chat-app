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
    
    let localUsername = '';

    // --- Login Logic ---
    const handleLogin = () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        if (username) {
            localUsername = username; // Store for personal message check
            loginError.textContent = '';
            socket.connect();
            socket.emit('user joined', { username, password });
        }
    };

    loginButton.addEventListener('click', handleLogin);
    passwordInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    socket.on('login successful', () => {
        loginContainer.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        messageInput.focus();
    });

    socket.on('login failed', (errorMsg) => {
        loginError.textContent = errorMsg;
        socket.disconnect();
    });

    // --- Message & History Logic ---
    const addMessage = (data) => {
        const item = document.createElement('li');
        
        // Check if message is from the current user to align it right
        if (data.username === localUsername || data.username === 'shresth' && localUsername === 'shresth') {
            item.classList.add('my-message');
        }
        
        // Check for admin status to apply special styling
        if (data.isAdmin) {
            item.classList.add('admin-message');
        }

        // Check for system messages
        if (data.username === 'System') {
            item.classList.add('system-message');
        }

        item.innerHTML = `<strong>${data.username}:</strong> ${data.message || data.message_text}`;
        messages.appendChild(item);
        messages.scrollTop = messages.scrollHeight;
    };

    socket.on('chat message', (data) => {
        addMessage(data);
    });

    socket.on('load history', (history) => {
        messages.innerHTML = ''; // Clear chat on load
        history.forEach(data => {
            addMessage(data);
        });
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

        uploadStatus.textContent = `Uploading ${file.name}...`;
        const formData = new FormData();
        formData.append('file', file);

        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.filePath) {
                uploadStatus.textContent = 'Upload successful!';
                socket.emit('file uploaded', { fileName: file.name, filePath: data.filePath });
            } else {
                throw new Error('Upload failed on server.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            uploadStatus.textContent = 'Upload failed.';
        })
        .finally(() => {
            setTimeout(() => { uploadStatus.textContent = ''; }, 4000);
            fileInput.value = ''; // Reset file input
        });
    });
});
