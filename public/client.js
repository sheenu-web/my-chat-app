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

    // UPDATED: File upload logic with validation and progress bar
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (!file) return;

        // NEW: Client-side file type validation
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            uploadStatus.textContent = 'Error: Only image and PDF files are allowed.';
            setTimeout(() => { uploadStatus.textContent = ''; }, 4000);
            fileInput.value = ''; // Reset file input
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        // NEW: Axios config with progress tracking
        const config = {
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                uploadStatus.textContent = ''; // Clear status text
                progressBarContainer.classList.remove('hidden');
                progressBar.style.width = `${percentCompleted}%`;
                progressBar.textContent = `${percentCompleted}%`;
            }
        };

        // NEW: Using Axios instead of Fetch
        axios.post('/upload', formData, config)
            .then(response => {
                progressBar.textContent = 'Success!';
                socket.emit('file uploaded', { 
                    fileName: file.name, 
                    filePath: response.data.filePath,
                    resourceType: response.data.resourceType 
                });
            })
            .catch(error => {
                console.error('Error:', error);
                uploadStatus.textContent = 'Upload failed.';
                progressBar.classList.add('hidden'); // Hide bar on error
            })
            .finally(() => {
                setTimeout(() => {
                    progressBarContainer.classList.add('hidden');
                    uploadStatus.textContent = '';
                }, 2000);
                fileInput.value = '';
            });
    });
});
