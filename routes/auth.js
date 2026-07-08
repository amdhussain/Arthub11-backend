 
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('../config/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(payload) {
  if (!JWT_SECRET) {
    throw new Error('Missing environment variable: JWT_SECRET');
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
router.post('/signup', async (req, res) => {
  try {
    console.log('📩 Signup Request Body:', req.body);

    const { email, username, password, avatar } = req.body;

    if (!email || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, username, and password are required',
      });
    }

    console.log('✅ Connecting to MongoDB...');
    const { db } = await connectToDatabase();

    console.log('✅ Connected to MongoDB');

    const users = db.collection('users');

    console.log('🔍 Checking existing user...');
    const existingUser = await users.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists',
      });
    }

    console.log('🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 12);

    console.log('💾 Inserting user...');
    const result = await users.insertOne({
      email,
      username,
      password: hashedPassword,
      role: 'user',
      ...(avatar && { avatar }),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ User inserted:', result.insertedId);

    const userId = result.insertedId.toString();

    console.log('🔑 Creating JWT...');
    const accessToken = signToken({
      userId,
      email,
      role: 'user',
    });

    console.log('🎉 Signup Successful');

    return res.status(201).json({
      success: true,
      accessToken,
      user: {
        id: userId,
        email,
        username,
        role: 'user',
        ...(avatar && { avatar }),
      },
    });

  } catch (error) {
    console.log('\n==============================');
    console.log('❌ SIGNUP ERROR');
    console.log('==============================');
    console.error(error);
    console.log('Message:', error.message);
    console.log('Stack:\n', error.stack);
    console.log('==============================\n');

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});


router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const { db } = await connectToDatabase();
    const users = db.collection('users');

    const user = await users.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const userId = user._id.toString();

    const accessToken = signToken({
      userId,
      email,
      role: user.role,
    });

    return res.json({
      accessToken,
      user: {
        id: userId,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });

  } catch (error) {
    console.error('Login error:', error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

 
router.post('/refresh', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const newToken = signToken({
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    });

    return res.json({
      success: true,
      accessToken: newToken,
    });

  } catch (error) {
    console.error(error);

    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
});

 
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { db } = await connectToDatabase();
    const users = db.collection('users');
    const orders = db.collection('orders');
    const favorites = db.collection('favorites');

    const user = await users.findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const totalOrders = await orders.countDocuments({ userId });
    const totalPurchases = await orders.countDocuments({ userId });

    const totalCollectionItems = await favorites.countDocuments({ userId });

    const categoryAgg = await favorites.aggregate([
      { $match: { userId } },
      { $group: { _id: '$artwork.category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]).toArray();

    const favoriteCategory = categoryAgg.length > 0 ? categoryAgg[0]._id : null;

    const userData = {
      id: user._id.toString(),
      email: user.email,
      username: user.username,
      name: user.name || user.username,
      role: user.role || 'user',
      bio: user.bio || '',
      location: user.location || '',
      phone: user.phone || '',
      avatar: user.avatar || '',
      createdAt: user.createdAt,
      stats: {
        totalOrders,
        totalPurchases,
        totalCollectionItems,
        favoriteCategory,
      },
    };

    return res.json({ success: true, user: userData });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

 
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, username, bio, location, phone, avatar } = req.body;

    const { db } = await connectToDatabase();
    const users = db.collection('users');

    const updateFields = { updatedAt: new Date() };
    if (name !== undefined) updateFields.name = name;
    if (username !== undefined) updateFields.username = username;
    if (bio !== undefined) updateFields.bio = bio;
    if (location !== undefined) updateFields.location = location;
    if (phone !== undefined) updateFields.phone = phone;
    if (avatar !== undefined) updateFields.avatar = avatar;

    await users.updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateFields }
    );

    return res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;