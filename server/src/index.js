require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const path = require('path');

// Import database connection
const sequelize = require('./config/database');

// Import models to establish associations
require('./models');

// Import routes
const authRoutes = require('./routes/auth.routes');
const datasetRoutes = require('./routes/dataset.routes');
const contributionRoutes = require('./routes/contribution.routes');
const fileRoutes = require('./routes/file.routes');

// Import WebSocket service
const WebSocketService = require('./services/websocket.service');

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server (needed for WebSocket)
const server = http.createServer(app);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration for network access
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost in various forms
    if (origin.includes('localhost:4200') || origin.includes('127.0.0.1:4200')) {
      return callback(null, true);
    }
    
    // Allow network access (192.168.x.x, 10.x.x.x, etc.)
    const networkRegex = /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):4200$/;
    if (networkRegex.test(origin)) {
      return callback(null, true);
    }
    
    // Allow environment specified CLIENT_URL
    if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) {
      return callback(null, true);
    }
    
    // For file serving, be more permissive
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Type', 'Cache-Control']
};

app.use(cors(corsOptions));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files with basic static serving (fallback)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'DataForge API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes - IMPORTANT: Order matters!
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes); // File serving with access control - put this BEFORE datasets
app.use('/api/datasets', datasetRoutes);
app.use('/api', contributionRoutes); // This registers /api/datasets/:id/contributions

// Debug: Log all registered routes (remove in production)
console.log('🛣️ Registered API routes:');
console.log('  /api/auth/* - Authentication routes');
console.log('  /api/files/* - File serving routes');
console.log('  /api/datasets/* - Dataset routes');
console.log('  /api/datasets/:id/contributions - Contribution routes');
console.log('  /api/contributions/* - Individual contribution routes');
console.log('  /api/validations/* - Validation routes');

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Initialize WebSocket service
let wsService;

// Database connection and server startup
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    // Sync models (use { force: false } in production)
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('✅ Database models synchronized.');

    // Initialize WebSocket service
    wsService = new WebSocketService(server);

    // Start server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 DataForge API server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
      console.log(`📊 Datasets API: http://localhost:${PORT}/api/datasets`);
      console.log(`📁 Files API: http://localhost:${PORT}/api/files`);
      console.log(`📤 Contributions API: http://localhost:${PORT}/api/datasets/:id/contributions`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
      console.log(`🌍 Server accessible on network at: http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (wsService) {
    wsService.wss.close();
  }
  server.close(() => {
    sequelize.close();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (wsService) {
    wsService.wss.close();
  }
  server.close(() => {
    sequelize.close();
    process.exit(0);
  });
});

// Export WebSocket service for use in other parts of the application
module.exports = { app, server, wsService: () => wsService };

startServer();