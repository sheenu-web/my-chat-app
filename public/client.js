document.addEventListener('DOMContentLoaded', () => {
    const socket = io({ autoConnect: false });

    // --- DOM Elements ---
    const usernameContainer = document.getElementById('username-container');
    const usernameInput = document.getElementById('username-input');
    const usernameButton = document.getElementById('username-button');
    const chatContainer = document.getElementById('chat-container');
    const messages = document.getElementById('messages');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('m');
    const uploadForm = document.getElementById('upload-form');
    const fileInput = document.getElementById('file-input');
    const uploadStatus = document.getElementById('upload-status');
    
    let username = '';

    // --- Username Handling ---
    usernameButton.addEventListener('click', () => {
        const name = usernameInput.value.trim();
        if (name) {
            username = name;
            usernameContainer.classList.add('hidden');
            chatContainer.classList.remove('hidden');
            
            socket.connect();
            socket.emit('user joined', username);
        }
    });

    // --- Chat Message Handling ---
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (messageInput.value) {
            socket.emit('chat message', messageInput.value);
            messageInput.value = '';
        }
    });

    socket.on('chat message', (data) => {
        const item = document.createElement('li');
        item.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
        messages.appendChild(item);
        window.scrollTo(0, document.body.scrollHeight);
    });

    // --- NEW: Load Message History ---
    // This block listens for the 'load history' event from the server
    socket.on('load history', (history) => {
        history.forEach(data => {
            const item = document.createElement('li');
            // Note: The server sends 'message_text' from the database
            item.innerHTML = `<strong>${data.username}:</strong> ${data.message_text}`;
            messages.appendChild(item);
        });
        // Scroll to the bottom after loading the old messages
        window.scrollTo(0, document.body.scrollHeight);
    });

    // --- File Upload Handling ---
    uploadForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const file = fileInput.files[0];
        if (!file) {
            uploadStatus.textContent = 'Please select a file to upload.';
            return;
        }
        
        if (file.size > 50 * 1024 * 1024) { // 50 MB
             uploadStatus.textContent = 'File is too large. Max size is 50 MB.';
             return;
        }

        const formData = new FormData();
        formData.append('file', file);

        uploadStatus.textContent = 'Uploading...';
        
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
            uploadStatus.textContent = 'Upload failed. Please try again.';
        })
        .finally(() => {
            setTimeout(() => { uploadStatus.textContent = ''; }, 5000);
        });
    });
});
