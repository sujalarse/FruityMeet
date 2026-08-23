require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createClient } = require('redis');

const setupSocket = require('./socket');

const app = express();
app.set('trust proxy', 1);
app.use(cors());

// Serve static frontend files
app.use(express.static('public'));

app.get('/api/get-turn-credentials', async (req, res) => {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID) {
      // Fallback to Google STUN if Twilio isn't configured
      return res.json({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] });
    }
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const token = await client.tokens.create({ ttl: 3600 });
    res.json({ iceServers: token.iceServers });
  } catch (error) {
    console.error("Twilio Token Error:", error);
    res.status(500).json({ error: "Failed to generate credentials" });
  }
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Initialize Redis Client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err.message));

async function startServer() {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (err) {
    console.error('Failed to connect to Redis on startup. Matchmaking will be unavailable:', err.message);
  }

  // Setup Socket.io logic
  setupSocket(io, redisClient);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer().catch(console.error);
