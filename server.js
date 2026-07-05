 
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
const orderRoutes = require('./routes/orders');
const collectionRoutes = require('./routes/collection');
const artworkRoutes = require('./routes/artworks');
const commentRoutes = require('./routes/comments');
const { connectToDatabase } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:3001',
  process.env.FRONTEND_URL,
].filter(Boolean);

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Test Route
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'ArtHub API is running'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api/artworks', artworkRoutes);
app.use('/api/artworks', commentRoutes);
app.use('/api/comments', commentRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Start Server
async function startServer() {
  try {
    await connectToDatabase();
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    console.error('Server will start, but database features will not work until the connection is fixed.');
  }

  app.listen(PORT, () => {
    console.log(`ArtHub backend running on http://localhost:${PORT}`);
  });
}

startServer();

 

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('exit', (code) => {
  console.log(`⚠️ Process exited with code ${code}`);
});