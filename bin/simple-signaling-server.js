/**
 * Simple WebSocket Signaling Server for VideoChat
 * 
 * This is a simplified alternative to Mercure Hub
 * Run with: node simple-signaling-server.js
 */

const WebSocket = require('ws');

// Configuration
const PORT = process.env.SIGNALING_PORT || 3000;
const HOST = process.env.SIGNALING_HOST || '0.0.0.0'; // Bind to all network interfaces

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

// Set interval to print stats every 30 seconds
setInterval(() => {
  const roomsInfo = Array.from(rooms.entries()).map(([roomId, userSet]) => {
    return `Room ${roomId}: ${userSet.size} users (${Array.from(userSet).join(', ')})`;
  });
  
  console.log(`
========== SERVER STATS ==========
Time: ${new Date().toLocaleTimeString()}
Connected clients: ${clients.size}
Active rooms: ${rooms.size}
${roomsInfo.join('\n')}
================================
`);
}, 30000);

// Store connected clients
const clients = new Map();
const rooms = new Map();

// Handle connections
wss.on('connection', (ws, req) => {
  let userId = null;
  let roomId = null;
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
          
          console.log(`User ${userId} joined room ${roomId}`);
          
          // Store client connection
          clients.set(userId, ws);
          
          // Create room if it doesn't exist
          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
            console.log(`Created new room: ${roomId}`);
          }
          
          // Add user to room
          rooms.get(roomId).add(userId);
          console.log(`User ${userId} joined room ${roomId}. Room now has ${rooms.get(roomId).size} users.`);
          
          // Notify everyone in the room that a new user joined
          broadcastToRoom(roomId, {
            type: 'user_joined',
            userId: userId,
            timestamp: Date.now()
          }, userId);
          
          // Send the list of existing users to the new client
          const existingUsers = Array.from(rooms.get(roomId)).filter(id => id !== userId);
          const roomUsersMessage = {
            type: 'room_users',
            users: existingUsers,
            timestamp: Date.now()
          };
          
          console.log(`Sending room users to ${userId}:`, roomUsersMessage);
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
              timestamp: Date.now()
            }));
          }
          break;
          
        case 'leave':
          // User leaves a room
          console.log(`User ${userId} left room ${roomId}`);
          
          // Notify everyone in the room that a user left
          if (roomId && rooms.has(roomId)) {
            broadcastToRoom(roomId, {
              type: 'user_left',
              userId: userId,
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
          
        default:
          console.log(`Unknown message type: ${data.type}`);
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });

  // Handle disconnects
  ws.on('close', () => {
    console.log(`Client disconnected: ${userId}`);
    
    // Remove client from list
    if (userId) {
      clients.delete(userId);
      
      // Remove user from room and notify others
      if (roomId && rooms.has(roomId)) {
        rooms.get(roomId).delete(userId);
        
        broadcastToRoom(roomId, {
          type: 'user_left',
          userId: userId,
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

// Handle new custom message types
wss.on('message', (message) => {
  if (typeof message === 'string' && message === 'STATS') {
    const stats = {
      clients: clients.size,
      rooms: Array.from(rooms.entries()).map(([roomId, users]) => ({
        roomId,
        users: Array.from(users)
      }))
    };
    console.log('Current server stats:', stats);
  }
});

// Broadcast a message to all clients in a room except the sender
function broadcastToRoom(roomId, message, excludeUserId = null) {
  if (!rooms.has(roomId)) {
    console.log(`Cannot broadcast to non-existent room: ${roomId}`);
    return;
  }
  
  let sentCount = 0;
  for (const userId of rooms.get(roomId)) {
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