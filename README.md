🍉 FruityMeet

A high-performance, real-time random video and text chat platform built with WebRTC, Node.js, and Redis. Inspired by classic platforms, FruityMeet modernizes the random chat experience with responsive design, collapsible UI elements, and strict security protocols.

Live Demo: fruitymeet.onrender.com

Core Features
Intelligent Matchmaking: Utilizes a bipartite cross-queueing algorithm in Redis to instantly pair users based on exact seeking preferences.

WebRTC Streaming: Low-latency, peer-to-peer audio and video data channels with STUN/TURN fallback for robust NAT traversal.

Ephemeral Media Sharing: Real-time Base64 image sharing via WebSockets with a full-screen lightbox modal, ensuring zero database storage liability.

Server-Side Geolocation: Secure IP verification using proxy-aware headers to accurately display regional country badges.

Tech Stack
Frontend: Vanilla JavaScript (ES6+), HTML5, CSS3 with a custom dark-mode glassmorphism aesthetic.

Backend: Node.js runtime environment utilizing Express.js for web serving and API routing.

Real-Time & State: Socket.io for continuous WebRTC signaling, paired with a Redis in-memory datastore for the queueing engine.

Infrastructure: Production-ready deployment hosted on Render with secure HTTPS and dynamically provisioned ports.

Local Installation
Clone this repository to your local machine and execute npm install to download required dependencies.

Create a .env file in the root directory containing your specific PORT and local or cloud REDIS_URL.

Ensure a local Redis server instance is actively running on port 6379.

Execute node index.js (or npm start) and navigate to localhost:3000 in your secure browser.

Architecture Note
FruityMeet is meticulously designed with ephemeral data handling in mind. Absolutely no chat logs, video stream packets, or shared images are written to a persistent database. When a user disconnects, the WebSocket immediately triggers a comprehensive teardown event, clearing the remote video frame, resetting the UI, and purging their session ID from the active Redis matchmaking pools.

Created by Sujal.
