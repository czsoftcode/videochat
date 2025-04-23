/**
 * Simple WebSocket Signaling Server for VideoChat
 *
 * This is a simplified alternative to Mercure Hub
 * Run with: node simple-signaling-server.js
 */

const WebSocket = require('ws');

// Configuration
const PORT = process.env.SIGNALING_PORT || 3000;
const HOST = process.env.SIGNALING_HOST || '127.0.0.1'; // Bind to all network interfaces

// Create WebSocket server with increased verbosity
const wss = new WebSocket.Server({
  host: HOST,
  port: PORT,
  clientTracking: true // Tracking clients for debugging
});

// Get server public hostname
const os = require('os');
const networkInterfaces = os.networkInterfaces();
const addresses = [];

// Find all network interfaces
for (const ifaceName in networkInterfaces) {
  for (const iface of networkInterfaces[ifaceName]) {
    // Skip internal and non-IPv4 addresses
    if (iface.family !== 'IPv4' || iface.internal !== false) {
      continue;
    }
    addresses.push(iface.address);
  }
}

const publicAddress = addresses.length ? addresses[0] : 'localhost';

console.log(`
================================================
  VideoChat - Simple Signaling Server
================================================
Server is running on:
- Local: ws://localhost:${PORT}
- Network: ws://${publicAddress}:${PORT}
This server is required for real-time communication
Press Ctrl+C to stop the server
================================================
`);

// Store connected clients
const clients = new Map();
const rooms = new Map();
const usernames = new Map(); // Nová mapa pro ukládání uživatelských jmen

// Handle connections
wss.on('connection', (ws, req) => {
  let userId = null;
  let roomId = null;
  let username = null; // Přidáno pro ukládání uživatelského jména
  const clientIp = req.socket.remoteAddress;

  console.log(`New client connected from ${clientIp}`);

  // Handle messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Handle different message types
      switch (data.type) {
        case 'join':
          // User joins a room
          userId = data.userId;
          roomId = data.roomId;
          username = data.username || `User-${userId}`; // Získání uživatelského jména z dat

          console.log(`User ${userId} (${username}) joined room ${roomId}`);

          // Store client connection
          clients.set(userId, ws);

          // Store username
          usernames.set(userId, username);

          // Create room if it doesn't exist
          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map()); // Změněno na mapu pro ukládání více informací
            console.log(`Created new room: ${roomId}`);
          }

          // Add user to room with additional metadata
          rooms.get(roomId).set(userId, {
            username,
            joinedAt: Date.now()
          });

          console.log(`User ${userId} (${username}) joined room ${roomId}. Room now has ${rooms.get(roomId).size} users.`);

          // Notify everyone in the room that a new user joined
          broadcastToRoom(roomId, {
            type: 'user_joined',
            userId: userId,
            username: username, // Přidáno jméno do zprávy
            timestamp: Date.now()
          }, userId);

          // Send the list of existing users to the new client
          const existingUsers = [];
          const existingUsernames = {};

          // Sestavení seznamu uživatelů a jejich jmen
          rooms.get(roomId).forEach((userData, id) => {
            if (id !== userId) {
              existingUsers.push(id);
              existingUsernames[id] = userData.username;
            }
          });

          const roomUsersMessage = {
            type: 'room_users',
            users: existingUsers,
            usernames: existingUsernames, // Přidáno mapování ID na jména
            timestamp: Date.now()
          };

          console.log(`Sending room users to ${userId} (${username}):`, roomUsersMessage);
          ws.send(JSON.stringify(roomUsersMessage));
          break;

        case 'signal':
          // Forward WebRTC signaling data to the target client
          if (data.target && clients.has(data.target)) {
            console.log(`Forwarding signal from ${userId} to ${data.target}`);
            clients.get(data.target).send(JSON.stringify({
              type: 'signal',
              signal: data.signal,
              from: userId,
              fromUsername: username, // Přidáno jméno odesílatele
              timestamp: Date.now()
            }));
          }
          break;

        case 'leave':
          // User leaves a room
          console.log(`User ${userId} (${username}) left room ${roomId}`);

          // Notify everyone in the room that a user left
          if (roomId && rooms.has(roomId)) {
            broadcastToRoom(roomId, {
              type: 'user_left',
              userId: userId,
              username: username, // Přidáno jméno do zprávy
              timestamp: Date.now()
            }, userId);

            // Remove user from room
            rooms.get(roomId).delete(userId);

            // Remove room if empty
            if (rooms.get(roomId).size === 0) {
              rooms.delete(roomId);
              console.log(`Room ${roomId} is now empty and has been removed`);
            }
          }
          break;

        case 'announce':
          // Update username if available
          if (data.username && userId) {
            username = data.username;
            usernames.set(userId, username);

            // Update in room data if user is in a room
            if (roomId && rooms.has(roomId) && rooms.get(roomId).has(userId)) {
              const userData = rooms.get(roomId).get(userId);
              userData.username = username;
              rooms.get(roomId).set(userId, userData);

              // Notify others about the username update
              broadcastToRoom(roomId, {
                type: 'user_updated',
                userId: userId,
                username: username,
                timestamp: Date.now()
              }, userId);
            }
          }
          break;

        default:
          console.log(`Unknown message type: ${data.type}`);
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  // Handle disconnects
  ws.on('close', () => {
    console.log(`Client disconnected: ${userId} (${username})`);

    // Remove client from list
    if (userId) {
      clients.delete(userId);
      usernames.delete(userId);

      // Remove user from room and notify others
      if (roomId && rooms.has(roomId)) {
        rooms.get(roomId).delete(userId);

        broadcastToRoom(roomId, {
          type: 'user_left',
          userId: userId,
          username: username,
          timestamp: Date.now()
        });

        // Remove room if empty
        if (rooms.get(roomId).size === 0) {
          rooms.delete(roomId);
          console.log(`Room ${roomId} is now empty and has been removed`);
        }
      }
    }
  });
});

// Broadcast a message to all clients in a room except the sender
function broadcastToRoom(roomId, message, excludeUserId = null) {
  if (!rooms.has(roomId)) {
    console.log(`Cannot broadcast to non-existent room: ${roomId}`);
    return;
  }

  let sentCount = 0;
  for (const userId of rooms.get(roomId).keys()) {
    if (userId !== excludeUserId && clients.has(userId)) {
      clients.get(userId).send(JSON.stringify(message));
      sentCount++;
    }
  }

  console.log(`Broadcast message to room ${roomId}: type=${message.type}, recipients=${sentCount}, excluded=${excludeUserId}`);
}

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  wss.close(() => {
    console.log('Server has been shut down');
    process.exit(0);
  });
});