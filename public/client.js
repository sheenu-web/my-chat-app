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
    const themeToggle = document.getElementById('theme-toggle');
    
    let localUsername = '';

    // --- THEME SWITCHER LOGIC ---
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', currentTheme);
    themeToggle.checked = currentTheme === 'dark';

    themeToggle.addEventListener('change', (e) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        document.body.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // --- LOGIN LOGIC ---
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
    passwordInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleLogin(); });
    usernameInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleLogin(); });

    socket.on('login successful', (data) => {
        loginContainer.classList.remove('active-panel');
        loginContainer.classList.add('hidden-panel');
        chatContainer.classList.remove('hidden-panel');
        chatContainer.classList.add('active-panel');
        if (data.isAdmin) {
            adminPanel.classList.remove('hidden');
        }
        messageInput.focus();
    });

    socket.on('login failed', (errorMsg) => {
        loginError.textContent = `// ${errorMsg}`;
        socket.disconnect();
    });

    // --- MESSAGE & HISTORY LOGIC ---
    const addMessage = (data) => {
        const item = document.createElement('li');
        const isMyMessage = (data.username === localUsername) || (data.username === 'shresth' && localUsername === 'shresth');
        
        if (isMyMessage) item.classList.add('my-message');
        if (data.isAdmin) item.classList.add('admin-message');
        if (data.username === 'System') item.classList.add('system-message');

        // UPDATED AND CORRECTED: This logic is now safer.
        let timeString = '';
        if (data.created_at) { // Only format time if created_at exists
            try {
                const messageDate = new Date(data.created_at);
                const today = new Date();
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                if (dateFns.isSameDay(messageDate, today)) {
                    timeString = dateFns.format(messageDate, 'h:mm a');
                } else if (dateFns.isSameDay(messageDate, yesterday)) {
                    timeString = 'Yesterday';
                } else {
                    timeString = dateFns.format(messageDate, 'dd/MM/yyyy');
                }
            } catch (e) {
                console.error("Could not parse date:", data.created_at, e);
            }
        }
        
        // This handles system messages that have no header/timestamp
        const headerHTML = data.username !== 'System' ? `
            <div class="message-header">
                <strong>${data.username}</strong>
                <span class="timestamp">${timeString}</span>
            </div>` : '';

        item.innerHTML = `
            ${headerHTML}
            <div class="message-content">${data.message || data.message_text}</div>
        `;

        messages.appendChild(item);
        messages.scrollTop = messages.scrollHeight;
    };

    socket.on('chat message', addMessage);
    socket.on('load history', (history) => {
        messages.innerHTML = '';
        history.forEach(addMessage);
    });

    // --- FORM & FILE UPLOAD LOGIC ---
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
                progressBar.textContent = (percentCompleted < 100) ? `${percentCompleted}%` : 'Processing...';
            }
        };

        axios.post('/upload', formData, config)
            .then(response => {
                progressBar.textContent = 'Success!';
                socket.emit('file uploaded', { 
                    fileName: file.name, 
                    filePath: response.data.filePath,
                    isImage: response.data.isImage
                });
            })
            .catch(error => {
                console.error('Error:', error);
                uploadStatus.textContent = 'Upload failed.';
                progressBarContainer.classList.add('hidden');
            })
            .finally(() => {
                setTimeout(() => {
                    progressBarContainer.classList.add('hidden');
                    uploadStatus.textContent = '';
                }, 2000);
                fileInput.value = '';
            });
    });

    // --- ADMIN PANEL LOGIC ---
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
