import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';

const SocketIOServer = Server;

let ioInstance = null;

export const getIO = () => ioInstance;

export const notifyNewMedicineOrder = (order) => {
  if (!ioInstance) return;
  ioInstance.to(`pharmacy-${order.pharmacyId}`).emit('new-medicine-order', { order });
  ioInstance.to('pharmacy-all').emit('new-medicine-order', { order });
  ioInstance.emit('new-medicine-order', { order });
};

export const notifyOrderStatusUpdate = (order) => {
  if (!ioInstance) return;
  ioInstance.to(`patient-${order.patientId}`).emit('order-status-updated', { order });
  ioInstance.emit('order-status-updated', { order });
};

/**
 * Initialize Socket.IO with WebRTC Signaling & Real-Time Chat
 * @param {import('http').Server} httpServer
 * @param {string[]} allowedOrigins
 */
export const initSocketServer = (httpServer, allowedOrigins = []) => {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, origin);
        }
        const isMatched = allowedOrigins.some((allowed) => {
          if (allowed === '*') return true;
          if (allowed.startsWith('*.')) {
            const domain = allowed.slice(2);
            try {
              const url = new URL(origin);
              return url.hostname.endsWith(domain);
            } catch {
              return origin.endsWith(allowed.slice(1));
            }
          }
          return false;
        });
        if (isMatched) return callback(null, origin);
        if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:') || origin.startsWith('http://127.0.0.1:') || origin.startsWith('https://127.0.0.1:')) {
          return callback(null, origin);
        }
        if (config.nodeEnv === 'development') {
          return callback(null, origin);
        }
        callback(new Error(`CORS origin not allowed by policy: ${origin}`));
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    pingTimeout: 20000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6,
  });

  // Socket handshake authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
    if (token) {
      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        socket.user = decoded;
      } catch (err) {
        console.warn(`[Socket] Connection with invalid auth token (${err.message})`);
      }
    }
    next();
  });

  ioInstance = io;

  // Track room participants: roomId -> Map<socketId, userInfo>
  const roomUsers = new Map();

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // Join pharmacy notification room
    socket.on('join-pharmacy', ({ pharmacyId }) => {
      if (pharmacyId) {
        socket.join(`pharmacy-${pharmacyId}`);
      }
      socket.join('pharmacy-all');
      console.log(`[Socket] Joined pharmacy room: ${pharmacyId || 'all'}`);
    });

    // Join patient notification room
    socket.on('join-patient', ({ patientId }) => {
      if (patientId) {
        socket.join(`patient-${patientId}`);
        console.log(`[Socket] Joined patient room: ${patientId}`);
      }
    });

    // Join room for teleconsultation
    socket.on('join-room', ({ roomId, userId, userName, userRole }) => {
      if (!roomId) return;
      socket.join(roomId);

      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Map());
      }
      const currentRoom = roomUsers.get(roomId);

      // Inform other users in this room
      const existingUsers = Array.from(currentRoom.entries()).map(([sockId, info]) => ({
        socketId: sockId,
        ...info,
      }));

      currentRoom.set(socket.id, { userId, userName, userRole, joinedAt: Date.now() });

      console.log(`[Socket] ${userName} (${userRole}) joined room: ${roomId}. Current room size: ${currentRoom.size}`);

      // Send existing participants to the newly joined peer
      socket.emit('existing-participants', {
        participants: existingUsers,
      });

      // Broadcast to existing peers in the room that a new peer joined
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        userId,
        userName,
        userRole,
      });
    });

    // WebRTC Signaling: Offer
    socket.on('webrtc-offer', ({ targetSocketId, sdp, callerInfo }) => {
      io.to(targetSocketId).emit('webrtc-offer', {
        senderSocketId: socket.id,
        sdp,
        callerInfo,
      });
    });

    // WebRTC Signaling: Answer
    socket.on('webrtc-answer', ({ targetSocketId, sdp }) => {
      io.to(targetSocketId).emit('webrtc-answer', {
        senderSocketId: socket.id,
        sdp,
      });
    });

    // WebRTC Signaling: ICE Candidate
    socket.on('webrtc-ice-candidate', ({ targetSocketId, candidate }) => {
      io.to(targetSocketId).emit('webrtc-ice-candidate', {
        senderSocketId: socket.id,
        candidate,
      });
    });

    // Real-Time Chat Message
    socket.on('send-chat-message', ({ roomId, message }) => {
      if (!roomId || !message) return;
      // Broadcast chat message to everyone in the room (including sender)
      io.to(roomId).emit('chat-message', {
        ...message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        socketId: socket.id,
      });
    });

    // Real-Time Live Captions & Speech Translation Broadcast
    socket.on('live-captions', ({ roomId, captionData }) => {
      if (!roomId || !captionData) return;
      // Broadcast to other participants in the room
      socket.to(roomId).emit('live-captions', {
        captionData,
        senderSocketId: socket.id,
      });
    });

    // Real-Time Video Frame Sync (Ensures 100% video visibility across localhost & WebRTC)
    socket.on('video-frame', ({ roomId, frameData }) => {
      if (!roomId || !frameData) return;
      socket.to(roomId).emit('video-frame', {
        frameData,
        senderSocketId: socket.id,
      });
    });

    // Media status toggle broadcast (e.g. Muted audio, video off)
    socket.on('toggle-media-status', ({ roomId, isAudioMuted, isVideoMuted }) => {
      if (!roomId) return;
      socket.to(roomId).emit('peer-media-status-changed', {
        socketId: socket.id,
        isAudioMuted,
        isVideoMuted,
      });
    });

    // Real-Time Prescription Update
    socket.on('update-prescription', ({ roomId, prescription, notes, doctorName }) => {
      if (!roomId) return;
      console.log(`[Socket] Prescription updated in room: ${roomId} by ${doctorName}`);
      io.to(roomId).emit('prescription-updated', {
        prescription: prescription || notes,
        notes: notes || prescription,
        doctorName: doctorName || 'Doctor',
        updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    });

    // Real-Time Call End (Terminates call for ALL room participants)
    socket.on('end-call', ({ roomId, endedBy, notes, prescription }) => {
      if (!roomId) return;
      console.log(`[Socket] Call ended in room: ${roomId} by ${endedBy}`);
      io.to(roomId).emit('call-ended', {
        endedBy: endedBy || 'A participant',
        notes: notes || prescription || '',
        prescription: prescription || notes || '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    });

    // Leave room
    socket.on('leave-room', ({ roomId }) => {
      if (roomId) {
        socket.leave(roomId);
        const currentRoom = roomUsers.get(roomId);
        if (currentRoom) {
          currentRoom.delete(socket.id);
          if (currentRoom.size === 0) {
            roomUsers.delete(roomId);
          }
        }
        socket.to(roomId).emit('user-left', { socketId: socket.id });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      // Clean up rooms
      roomUsers.forEach((usersMap, rId) => {
        if (usersMap.has(socket.id)) {
          usersMap.delete(socket.id);
          socket.to(rId).emit('user-left', { socketId: socket.id });
          if (usersMap.size === 0) {
            roomUsers.delete(rId);
          }
        }
      });
    });
  });

  return io;
};

export default initSocketServer;
