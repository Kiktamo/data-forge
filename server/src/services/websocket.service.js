const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { verifyAccessToken } = require('../config/jwt');
const User = require('../models/user.model');

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws'
    });
    
    // Store active connections with user info
    this.connections = new Map();
    // Store dataset viewers: datasetId -> Set of userIds
    this.datasetViewers = new Map();
    // Store dataset editors: datasetId -> Set of userIds  
    this.datasetEditors = new Map();
    
    this.setupWebSocketServer();
    
    console.log('✅ WebSocket server initialized');
  }
  
  setupWebSocketServer() {
    this.wss.on('connection', async (ws, request) => {
      console.log('New WebSocket connection attempt');
      
      try {
        // Extract token from query params or headers
        const url = new URL(request.url, `http://${request.headers.host}`);
        const token = url.searchParams.get('token') || 
                     request.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          ws.close(4001, 'Authentication required');
          return;
        }
        
        // Verify token and get user
        const decoded = verifyAccessToken(token);
        const user = await User.findByPk(decoded.id);
        
        if (!user || !user.isActive) {
          ws.close(4002, 'Invalid user');
          return;
        }
        
        // Store connection with user info
        const connectionId = this.generateConnectionId();
        const connectionInfo = {
          id: connectionId,
          ws,
          user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName
          },
          currentDataset: null,
          isEditing: false,
          lastActivity: new Date()
        };
        
        this.connections.set(connectionId, connectionInfo);
        
        console.log(`✅ User ${user.username} connected via WebSocket`);
        
        // Send welcome message
        this.sendToConnection(connectionId, {
          type: 'connected',
          message: 'Connected to DataForge',
          userId: user.id
        });
        
        // Set up message handlers
        ws.on('message', (data) => {
          this.handleMessage(connectionId, data);
        });
        
        // Handle disconnection
        ws.on('close', () => {
          this.handleDisconnection(connectionId);
        });
        
        // Handle errors
        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
          this.handleDisconnection(connectionId);
        });
        
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        ws.close(4003, 'Authentication failed');
      }
    });
  }
  
  handleMessage(connectionId, data) {
    try {
      const connection = this.connections.get(connectionId);
      if (!connection) return;
      
      const message = JSON.parse(data.toString());
      connection.lastActivity = new Date();
      
      console.log(`📨 Message from ${connection.user.username}:`, message.type);
      
      switch (message.type) {
        case 'join-dataset':
          this.handleJoinDataset(connectionId, message.datasetId);
          break;
          
        case 'leave-dataset':
          this.handleLeaveDataset(connectionId, message.datasetId);
          break;
          
        case 'start-editing':
          this.handleStartEditing(connectionId, message.datasetId);
          break;
          
        case 'stop-editing':
          this.handleStopEditing(connectionId, message.datasetId);
          break;
          
        case 'dataset-update':
          this.handleDatasetUpdate(connectionId, message.datasetId, message.data);
          break;
          
        case 'ping':
          this.sendToConnection(connectionId, { type: 'pong' });
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }
  
  handleJoinDataset(connectionId, datasetId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    // Leave current dataset if any
    if (connection.currentDataset) {
      this.handleLeaveDataset(connectionId, connection.currentDataset);
    }
    
    // Join new dataset
    connection.currentDataset = datasetId;
    
    if (!this.datasetViewers.has(datasetId)) {
      this.datasetViewers.set(datasetId, new Set());
    }
    this.datasetViewers.get(datasetId).add(connection.user.id);
    
    console.log(`👀 ${connection.user.username} is now viewing dataset ${datasetId}`);
    
    // Notify others about new viewer
    this.broadcastToDataset(datasetId, {
      type: 'user-joined',
      user: connection.user,
      datasetId
    }, connectionId);
    
    // Send current viewers to the new user
    const viewers = this.getDatasetViewers(datasetId);
    const editors = this.getDatasetEditors(datasetId);
    
    this.sendToConnection(connectionId, {
      type: 'dataset-status',
      datasetId,
      viewers,
      editors
    });
  }
  
  handleLeaveDataset(connectionId, datasetId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    // Remove from viewers
    if (this.datasetViewers.has(datasetId)) {
      this.datasetViewers.get(datasetId).delete(connection.user.id);
      if (this.datasetViewers.get(datasetId).size === 0) {
        this.datasetViewers.delete(datasetId);
      }
    }
    
    // Remove from editors if editing
    if (connection.isEditing && this.datasetEditors.has(datasetId)) {
      this.datasetEditors.get(datasetId).delete(connection.user.id);
      if (this.datasetEditors.get(datasetId).size === 0) {
        this.datasetEditors.delete(datasetId);
      }
    }
    
    connection.currentDataset = null;
    connection.isEditing = false;
    
    console.log(`👋 ${connection.user.username} left dataset ${datasetId}`);
    
    // Notify others
    this.broadcastToDataset(datasetId, {
      type: 'user-left',
      user: connection.user,
      datasetId
    }, connectionId);
  }
  
  handleStartEditing(connectionId, datasetId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    connection.isEditing = true;
    
    if (!this.datasetEditors.has(datasetId)) {
      this.datasetEditors.set(datasetId, new Set());
    }
    this.datasetEditors.get(datasetId).add(connection.user.id);
    
    console.log(`✏️ ${connection.user.username} started editing dataset ${datasetId}`);
    
    // Notify others
    this.broadcastToDataset(datasetId, {
      type: 'user-started-editing',
      user: connection.user,
      datasetId
    }, connectionId);
  }
  
  handleStopEditing(connectionId, datasetId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    connection.isEditing = false;
    
    if (this.datasetEditors.has(datasetId)) {
      this.datasetEditors.get(datasetId).delete(connection.user.id);
      if (this.datasetEditors.get(datasetId).size === 0) {
        this.datasetEditors.delete(datasetId);
      }
    }
    
    console.log(`✅ ${connection.user.username} stopped editing dataset ${datasetId}`);
    
    // Notify others
    this.broadcastToDataset(datasetId, {
      type: 'user-stopped-editing',
      user: connection.user,
      datasetId
    }, connectionId);
  }
  
  handleDatasetUpdate(connectionId, datasetId, updateData) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    console.log(`🔄 ${connection.user.username} updated dataset ${datasetId}`);
    
    // Broadcast update to all viewers except sender
    this.broadcastToDataset(datasetId, {
      type: 'dataset-updated',
      user: connection.user,
      datasetId,
      updateData
    }, connectionId);
  }
  
  handleDisconnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    console.log(`🔌 ${connection.user.username} disconnected`);
    
    // Clean up dataset presence
    if (connection.currentDataset) {
      this.handleLeaveDataset(connectionId, connection.currentDataset);
    }
    
    // Remove connection
    this.connections.delete(connectionId);
  }
  
  // Utility methods
  sendToConnection(connectionId, message) {
    const connection = this.connections.get(connectionId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  }
  
  broadcastToDataset(datasetId, message, excludeConnectionId = null) {
    this.connections.forEach((connection, connectionId) => {
      if (connection.currentDataset === datasetId && 
          connectionId !== excludeConnectionId &&
          connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(message));
      }
    });
  }
  
  broadcastToAll(message, excludeConnectionId = null) {
    this.connections.forEach((connection, connectionId) => {
      if (connectionId !== excludeConnectionId &&
          connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(JSON.stringify(message));
      }
    });
  }
  
  getDatasetViewers(datasetId) {
    const viewers = [];
    this.connections.forEach(connection => {
      if (connection.currentDataset === datasetId) {
        viewers.push(connection.user);
      }
    });
    return viewers;
  }
  
  getDatasetEditors(datasetId) {
    const editors = [];
    this.connections.forEach(connection => {
      if (connection.currentDataset === datasetId && connection.isEditing) {
        editors.push(connection.user);
      }
    });
    return editors;
  }
  
  generateConnectionId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
  
  // Public API for other parts of the application
  notifyDatasetUpdate(datasetId, updateType, data) {
    this.broadcastToDataset(datasetId, {
      type: 'system-update',
      updateType,
      datasetId,
      data,
      timestamp: new Date()
    });
  }
  
  getConnectionStats() {
    return {
      totalConnections: this.connections.size,
      activeDatasets: this.datasetViewers.size,
      editingSessions: this.datasetEditors.size
    };
  }
}

module.exports = WebSocketService;