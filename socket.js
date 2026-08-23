const crypto = require('crypto');
const geoip = require('geoip-lite');

const WAITING_QUEUE_KEY = 'waiting_users';

module.exports = function (io, redisClient) {
  io.on('connection', async (socket) => {
    console.log(`User connected: ${socket.id}`);

    // IP Geolocation
    const rawIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    let ip = rawIp;
    if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();

    let countryData = { country: 'Unknown', code: 'UN', flag: '🏳️' };

    // Check for local loopback or private networks
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      const code = 'IN';
      const flagOffset = 127397;
      const flag = code.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + flagOffset));
      countryData = { country: 'India', code: code, flag: flag };
    } else {
      const geo = geoip.lookup(ip);
      if (geo && geo.country) {
        const code = geo.country;
        const flagOffset = 127397;
        const flag = code.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + flagOffset));

        let countryName = code;
        try {
          const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
          countryName = regionNames.of(code) || code;
        } catch (e) { }

        countryData = { country: countryName, code: code, flag: flag };
      }
    }

    socket.country = countryData;
    socket.emit('your_country', countryData);

    // Request to find a match
    socket.on('join-queue', async (data) => {
      const group = data?.group || 'General';
      const gender = data?.gender || 'unknown';
      const mediaType = data?.mediaType || 'text';
      let sortedInterests = '';
      if (data?.interests && Array.isArray(data.interests) && data.interests.length > 0) {
        sortedInterests = ':' + data.interests.map(i => i.toLowerCase().trim()).sort().join(',');
      }

      const queueKey = `queue:${group}:${gender}:${mediaType}${sortedInterests}`;
      socket.queueKey = queueKey; // Save queue key for disconnect cleanup

      console.log(`User ${socket.id} looking for a match in ${queueKey}`);

      try {
        // Check lengths (LLEN) on individual filter keys and execute RPOP pairing
        const queueLen = await redisClient.lLen(queueKey);

        if (queueLen > 0) {
          const matchedUserId = await redisClient.rPop(queueKey);
          // If we popped ourselves by some accident, push back
          if (matchedUserId === socket.id) {
            await redisClient.rPush(queueKey, socket.id);
            socket.emit('waiting_for_match');
            return;
          }

          // We found a match! Check if the other user is still connected locally
          const matchedSocket = io.sockets.sockets.get(matchedUserId);

          if (matchedSocket) {
            // Both are connected. Create a unique room for them
            const roomId = `room_${crypto.randomUUID()}`;

            socket.join(roomId);
            matchedSocket.join(roomId);

            // Store room ID on the sockets for easy access later
            socket.roomId = roomId;
            matchedSocket.roomId = roomId;

            console.log(`Matched ${socket.id} and ${matchedUserId} in ${roomId}`);

            // Notify both users that they've been matched and their role
            // One will be the 'initiator' who will send the WebRTC offer
            matchedSocket.emit('match_found', { role: 'initiator', roomId, peerId: socket.id, peerCountry: socket.country });
            socket.emit('match_found', { role: 'receiver', roomId, peerId: matchedUserId, peerCountry: matchedSocket.country });
          } else {
            // The waiting user disconnected before a match was found.
            // Put the current user in the queue
            await redisClient.rPush(queueKey, socket.id);
            socket.emit('waiting_for_match');
          }
        } else {
          // Queue length is 0. Add current user to the queue
          await redisClient.rPush(queueKey, socket.id);
          socket.emit('waiting_for_match');
        }
      } catch (err) {
        console.error('Error during matchmaking:', err);
      }
    });

    // WebRTC Signaling
    socket.on('webrtc_offer', (data) => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('webrtc_offer', data);
      }
    });

    socket.on('webrtc_answer', (data) => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('webrtc_answer', data);
      }
    });

    socket.on('ice_candidate', (data) => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('ice_candidate', data);
      }
    });

    socket.on('send-chat-message', (message) => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('receive-chat-message', message);
      }
    });

    socket.on('send-chat-image', (base64Data) => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('receive-chat-image', base64Data);
      }
    });

    // When a user decides to leave a match
    socket.on('leave_match', async () => {
      if (socket.roomId) {
        socket.to(socket.roomId).emit('stranger-disconnected');
        socket.leave(socket.roomId);
        socket.roomId = null;
      }
      if (socket.queueKey) {
        try {
          await redisClient.lRem(socket.queueKey, 0, socket.id);
        } catch (err) {
          console.error('Error removing user from queue on leave_match:', err);
        }
      }
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`);

      // If they were in a room, notify the peer
      if (socket.roomId) {
        socket.to(socket.roomId).emit('stranger-disconnected');
      }

      try {
        // Remove from the waiting queue if they were in it
        if (socket.queueKey) {
          await redisClient.lRem(socket.queueKey, 0, socket.id);
        } else {
          await redisClient.lRem(WAITING_QUEUE_KEY, 0, socket.id);
        }
      } catch (err) {
        console.error('Error removing user from queue on disconnect:', err);
      }
    });
  });
};