# 🍉 FruityMeet

![NodeJS](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white)

> A high-performance, real-time random video and text chat platform built with WebRTC, Node.js, and Redis. Inspired by classic platforms, FruityMeet modernizes the random chat experience with responsive design, collapsible UI elements, and strict security protocols.

🔴 **Live Demo:** [fruitymeet.onrender.com](https://fruitymeet.onrender.com)

---

## ✨ Core Features

* **🧠 Intelligent Matchmaking:** Utilizes a bipartite cross-queueing algorithm in Redis to instantly pair users based on exact seeking preferences (e.g., matching Female seeking Male strictly with Male seeking Female).
* **📹 WebRTC Streaming:** Low-latency, peer-to-peer audio and video data channels with STUN/TURN fallback for robust NAT traversal.
* **🖼️ Ephemeral Media Sharing:** Real-time Base64 image sharing via WebSockets featuring a full-screen lightbox modal, ensuring zero database storage liability.
* **🌍 Server-Side Geolocation:** Secure IP verification using proxy-aware headers to accurately dynamically resolve and display regional country badges.

---

## 🛠️ Technology Stack

| Category | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5, CSS3, Vanilla JS | Glassmorphism dark-mode UI, Flexbox/Grid layouts, DOM manipulation. |
| **Media Streaming** | WebRTC API | Direct P2P audio/video data channels (`RTCPeerConnection`). |
| **Backend API** | Node.js / Express.js | Event-driven server runtime, static asset serving, and proxy handling. |
| **Real-Time** | Socket.io | WebRTC signaling handshakes, room creation, and Base64 image transfers. |
| **Database** | Redis | High-speed, in-memory datastore managing dynamic matchmaking queues. |

---

## 🚀 Local Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/sujalarse/fruitymeet.git](https://github.com/sujalarse/fruitymeet.git)
   cd fruitymeet

# 🔒 Architecture & Security Note
FruityMeet is meticulously designed with ephemeral data handling in mind. Absolutely no chat logs, video stream packets, or shared images are written to a persistent database.

When a user disconnects, the WebSocket immediately triggers a comprehensive teardown event, clearing the remote video frame, resetting the UI, and purging their session ID from the active Redis matchmaking pools.

Created by Sujal
