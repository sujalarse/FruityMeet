const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const nextBtn = document.getElementById('nextBtn');
const statusText = document.getElementById('statusText');
const statusIndicator = document.getElementById('statusIndicator');
const loadingOverlay = document.getElementById('loadingOverlay');
const overlayText = document.getElementById('overlayText');
const groupSelect = document.getElementById('groupSelect');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const localCameraOff = document.getElementById('localCameraOff');
const remoteCameraOff = document.getElementById('remoteCameraOff');
const textOnlyCheckbox = document.getElementById('textOnlyCheckbox');
const splashScreen = document.getElementById('splashScreen');
const genderSelect = document.getElementById('genderSelect');
const interestInput = document.getElementById('interestInput');
const tagsWrapper = document.getElementById('tagsWrapper');
const startChattingBtn = document.getElementById('startChattingBtn');
const localCountryBadge = document.getElementById('localCountryBadge');
const remoteCountryBadge = document.getElementById('remoteCountryBadge');
const chatToggleBtn = document.getElementById('chatToggleBtn');
const chatOverlay = document.getElementById('chatOverlay');
const unreadDot = document.getElementById('unreadDot');
const imageInput = document.getElementById('imageInput');
const imageUploadBtn = document.getElementById('imageUploadBtn');
const imageModal = document.getElementById('imageModal');
const closeImageModal = document.getElementById('closeImageModal');
const modalImage = document.getElementById('modalImage');

let socket;
let localStream;
let peerConnection;

let interests = [];
let mediaType = 'text';

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

// Request Media Permissions
async function initMedia() {
    if (textOnlyCheckbox.checked) {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        localStream = null;
        mediaType = 'text';
        setupMediaSuccess();
        return true;
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        mediaType = 'video';
        setupMediaSuccess();
        return true;
    } catch (err) {
        console.error('Media Access Error:', err);
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError' || err.name === 'NotFoundError') {
            console.log("Proceeding with text-only mode due to missing permissions/hardware.");
            localStream = null;
            mediaType = 'text';
            setupMediaSuccess();
            return true;
        } else {
            alert("An error occurred while accessing media devices: " + err.message);
            updateStatus('Media Access Failed', 'error');
            overlayText.innerText = 'Click Start to retry camera/mic permissions.';

            // Reset the UI to allow clicking 'Start' to retry
            nextBtn.disabled = false;
            nextBtn.innerText = 'Start';
            return false;
        }
    }
}

function setupMediaSuccess() {
    if (localStream) {
        localVideo.srcObject = localStream;
        localCameraOff.style.display = 'none';
        localVideo.style.display = 'block';
    } else {
        localVideo.srcObject = null;
        localCameraOff.style.display = 'flex';
        localVideo.style.display = 'none';
    }

    // Initialize Socket connection only if not already connected
    if (!socket) initSocket();

    nextBtn.disabled = false;
    updateStatus('Connected to Server', 'connected');
}

function updateStatus(text, stateClass) {
    statusText.innerText = text;
    statusIndicator.className = 'status-indicator ' + stateClass;
}

function initSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to socket server');
    });

    socket.on('your_country', (data) => {
        if (data) {
            localCountryBadge.innerHTML = `<span class="flag-icon-${data.code.toLowerCase()}">${data.flag}</span> <span>${data.country}</span>`;
            localCountryBadge.style.display = 'flex';
        }
    });

    socket.on('waiting_for_match', () => {
        console.log('Waiting for a match...');
        updateStatus('Searching...', 'waiting');
        loadingOverlay.classList.add('active', 'searching');
        overlayText.innerText = 'Looking for a stranger...';
        nextBtn.innerText = 'Stop';
    });

    socket.on('match_found', async (data) => {
        console.log('Match found!', data);
        updateStatus('Matched', 'connected');
        loadingOverlay.classList.remove('active', 'searching');
        nextBtn.innerText = 'Next';

        if (data.peerCountry) {
            remoteCountryBadge.innerHTML = `<span class="flag-icon-${data.peerCountry.code.toLowerCase()}">${data.peerCountry.flag}</span> <span>${data.peerCountry.country}</span>`;
            remoteCountryBadge.style.display = 'flex';
        }

        currentRoomId = data.roomId;
        setupPeerConnection();

        if (data.role === 'initiator') {
            try {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                socket.emit('webrtc_offer', offer);
            } catch (err) {
                console.error('Error creating offer', err);
            }
        }
    });

    socket.on('webrtc_offer', async (offer) => {
        console.log('Received WebRTC Offer');
        if (!peerConnection) setupPeerConnection();

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('webrtc_answer', answer);
        } catch (err) {
            console.error('Error handling offer', err);
        }
    });

    socket.on('webrtc_answer', async (answer) => {
        console.log('Received WebRTC Answer');
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
            console.error('Error handling answer', err);
        }
    });

    socket.on('ice_candidate', async (candidate) => {
        console.log('Received ICE Candidate');
        try {
            if (peerConnection) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        } catch (err) {
            console.error('Error adding ICE candidate', err);
        }
    });

    socket.on('receive-chat-message', (message) => {
        appendMessage('Stranger', message, 'remote');
        if (chatOverlay.classList.contains('collapsed')) {
            unreadDot.style.display = 'block';
        }
    });

    socket.on('receive-chat-image', (base64Data) => {
        appendImageMessage('Stranger', base64Data, 'remote');
        if (chatOverlay.classList.contains('collapsed')) {
            unreadDot.style.display = 'block';
        }
    });

    socket.on('stranger-disconnected', () => {
        handleStrangerDisconnect();
    });
}

function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(configuration);

    // Add local tracks to the connection if available
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // Handle incoming remote stream
    peerConnection.ontrack = (event) => {
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            remoteCameraOff.style.display = 'none';
            remoteVideo.style.display = 'block';
            console.log('Received remote stream');
        }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice_candidate', event.candidate);
        }
    };

    peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection && (peerConnection.iceConnectionState === 'disconnected' || peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'closed')) {
            handleStrangerDisconnect();
        }
    };
}

function handleStrangerDisconnect() {
    console.log('Stranger disconnected');
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    remoteVideo.srcObject = null;
    remoteCameraOff.style.display = 'flex';
    remoteVideo.style.display = 'none';
    remoteCountryBadge.style.display = 'none';
    currentRoomId = null;
    updateStatus('Disconnected', 'disconnected');
    appendMessage('System', 'Stranger has disconnected.', 'system');
    nextBtn.innerText = 'Next';
}

function cleanupMatch() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    remoteVideo.srcObject = null;
    remoteCameraOff.style.display = 'flex';
    remoteVideo.style.display = 'none';
    remoteCountryBadge.style.display = 'none';
    currentRoomId = null;
    if (chatMessages) chatMessages.innerHTML = '';
}

function handleNext() {
    // If initialization failed previously, retry it
    if (!socket) {
        return initMedia();
    }

    if (nextBtn.innerText === 'Stop') {
        // Cancel finding a match
        socket.emit('leave_match');
        cleanupMatch();
        loadingOverlay.classList.add('active');
        loadingOverlay.classList.remove('searching');
        overlayText.innerText = 'Click Start to find a match';
        nextBtn.innerText = 'Start';
        updateStatus('Connected to Server', 'connected');
        return;
    }

    // We want to find a match
    cleanupMatch();
    if (currentRoomId) {
        socket.emit('leave_match');
    }
    const selectedGroup = groupSelect.value;
    socket.emit('join-queue', { group: selectedGroup, gender: selectedGender, interests: interests, mediaType: mediaType });
}

chatToggleBtn.addEventListener('click', () => {
    chatOverlay.classList.toggle('collapsed');
    if (chatOverlay.classList.contains('collapsed')) {
        chatToggleBtn.firstChild.textContent = '💬';
    } else {
        chatToggleBtn.firstChild.textContent = '✖';
        unreadDot.style.display = 'none';
    }
});

chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (message && socket && currentRoomId) {
        socket.emit('send-chat-message', message);
        appendMessage('You', message, 'local');
        chatInput.value = '';
    }
});

function appendMessage(sender, text, type) {
    const msgElement = document.createElement('div');
    msgElement.className = `chat-message ${type}`;
    // Using textContent to prevent XSS
    const strong = document.createElement('strong');
    strong.textContent = sender + ': ';
    const span = document.createElement('span');
    span.textContent = text;
    msgElement.appendChild(strong);
    msgElement.appendChild(span);

    chatMessages.appendChild(msgElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

imageUploadBtn.addEventListener('click', () => {
    imageInput.click();
});

imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const base64Data = event.target.result;
        if (file.size > 1024 * 1024) { // Compress if > 1MB
            compressImage(base64Data, (compressedBase64) => {
                sendImage(compressedBase64);
            });
        } else {
            sendImage(base64Data);
        }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});

function sendImage(base64Data) {
    if (socket && currentRoomId) {
        socket.emit('send-chat-image', base64Data);
        appendImageMessage('You', base64Data, 'local');
    }
}

function compressImage(base64Str, callback) {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }
        } else {
            if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
            }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.7));
    };
}

function appendImageMessage(sender, base64Data, type) {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${type}`;

    const strong = document.createElement('strong');
    strong.textContent = sender + ': ';

    const imgElement = document.createElement('img');
    imgElement.src = base64Data;
    imgElement.className = 'chat-image';
    imgElement.alt = 'User Image';

    messageElement.appendChild(strong);
    messageElement.appendChild(imgElement);

    chatMessages.appendChild(messageElement);

    imgElement.onload = () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    imgElement.addEventListener('click', () => {
        modalImage.src = base64Data;
        imageModal.style.display = 'flex';
    });
}

// Image Modal Listeners
if (closeImageModal) {
    closeImageModal.addEventListener('click', () => {
        imageModal.style.display = 'none';
    });
}
if (imageModal) {
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) {
            imageModal.style.display = 'none';
        }
    });
}

// Splash Screen Logic

function addInterestTag(tagText) {
    if (tagText && !interests.includes(tagText)) {
        interests.push(tagText);

        const tagEl = document.createElement('div');
        tagEl.className = 'interest-tag';
        tagEl.innerHTML = `${tagText} <span class="tag-remove" data-tag="${tagText}">&times;</span>`;

        tagEl.querySelector('.tag-remove').addEventListener('click', function () {
            interests = interests.filter(i => i !== tagText);
            tagEl.remove();
        });

        tagsWrapper.insertBefore(tagEl, interestInput);
    }
}

interestInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const text = interestInput.value.trim().replace(/,/g, '');
        if (text) {
            addInterestTag(text);
            interestInput.value = '';
        }
    }
});

startChattingBtn.addEventListener('click', async () => {
    selectedGender = genderSelect.value;
    if (!selectedGender) {
        alert("Please select how you identify before continuing.");
        return;
    }

    splashScreen.classList.add('fade-out');
    setTimeout(() => {
        splashScreen.style.display = 'none';
    }, 500);

    // Initialize media and socket
    await initMedia();

    // Automatically trigger the match finding UI flow
    if (socket && socket.connected) {
        handleNext(); // this will emit 'join-queue'
    } else if (socket) {
        socket.on('connect', () => {
            handleNext();
        });
    }
});

// Start everything
window.addEventListener('load', () => {
    nextBtn.addEventListener('click', handleNext);
    textOnlyCheckbox.addEventListener('change', initMedia);

    // Set initial remote camera off state
    remoteCameraOff.style.display = 'flex';
    remoteVideo.style.display = 'none';

    // initMedia() is now called when startChattingBtn is clicked
});

// client.js
async function initializeWebRTC() {
    try {
        // 1. Fetch the temporary Twilio credentials from YOUR backend
        const response = await fetch('/api/get-turn-credentials');
        const data = await response.json();

        // 2. Pass the Twilio iceServers directly into your WebRTC configuration
        const configuration = {
            iceServers: data.iceServers
        };

        // 3. Initialize the peer connection with global traversal support
        const peerConnection = new RTCPeerConnection(configuration);

        // ... continue with your signaling logic (adding tracks, creating offers)

    } catch (error) {
        console.error("Error fetching TURN credentials:", error);
    }
}