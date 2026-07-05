const express = require('express');
const path = require('path');
const fs = require('fs');
const { ObjectId } = require('mongodb');
const { authenticateToken } = require('../middleware/auth');
const { connectToDatabase } = require('../config/db');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const ARTWORKS_FILE = path.join(DATA_DIR, 'artworks.json');

function readArtworks() {
  const raw = fs.readFileSync(ARTWORKS_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeArtworks(artworks) {
  fs.writeFileSync(ARTWORKS_FILE, JSON.stringify(artworks, null, 2), 'utf8');
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const ordersCollection = db.collection('orders');

    const totalUsers = await usersCollection.countDocuments();
    const totalOrders = await ordersCollection.countDocuments();
    const orders = await ordersCollection.find({}).toArray();
    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);

    const artworks = readArtworks();
    const totalArtworks = artworks.length;
    const uniqueArtists = new Set(artworks.map((a) => a.artist).filter(Boolean));
    const totalArtists = uniqueArtists.size;

    const salesByMonth = {};
    orders.forEach((o) => {
      if (o.purchasedAt) {
        const d = new Date(o.purchasedAt);
        const key = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
        if (!salesByMonth[key]) salesByMonth[key] = { revenue: 0, orders: 0 };
        salesByMonth[key].revenue += o.totalPrice || 0;
        salesByMonth[key].orders += 1;
      }
    });
    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const salesData = monthOrder
      .filter((m) => salesByMonth[m])
      .map((m) => ({ month: m, ...salesByMonth[m] }));

    return res.json({
      totalUsers,
      totalArtists,
      totalRevenue,
      totalArtworks,
      salesData,
      userChange: '+0%',
      artistChange: '+0%',
      revenueChange: '+0%',
      artworkChange: '+0%',
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    const query = {};
    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ username: regex }, { email: regex }];
    }

    const total = await usersCollection.countDocuments(query);
    const pages = Math.ceil(total / Number(limit));
    const users = await usersCollection
      .find(query, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .toArray();

    const mapped = users.map((u) => ({
      _id: u._id.toString(),
      id: u._id.toString(),
      name: u.username || u.name || '',
      email: u.email || '',
      role: u.role || 'user',
      createdAt: u.createdAt,
    }));

    return res.json({ users: mapped, pages, total });
  } catch (error) {
    console.error('Admin users error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/users/:userId/role', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['user', 'artist', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    const result = await usersCollection.findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { role, updatedAt: new Date() } },
      { projection: { password: 0 }, returnDocument: 'after' }
    );

    if (!result) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, user: result });
  } catch (error) {
    console.error('Update user role error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/artworks', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const artworks = readArtworks();

    const mapped = artworks.map((a) => ({
      ...a,
      _id: String(a.id),
      image: a.imageUrl,
      artistName: a.artist,
      images: a.imageUrl ? [{ url: a.imageUrl }] : [],
      stock: a.stock != null ? a.stock : (a.isSold || a.availability === false ? 0 : 100),
    }));

    const total = mapped.length;
    const pages = Math.ceil(total / Number(limit));
    const start = (Number(page) - 1) * Number(limit);
    const paged = mapped.slice(start, start + Number(limit));

    return res.json({ artworks: paged, pages, total });
  } catch (error) {
    console.error('Admin artworks error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/artworks/:artworkId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { artworkId } = req.params;
    const artworks = readArtworks();
    const index = artworks.findIndex(
      (a) => String(a.id) === artworkId || a.id === Number(artworkId)
    );

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Artwork not found' });
    }

    artworks.splice(index, 1);
    writeArtworks(artworks);

    return res.json({ success: true, message: 'Artwork deleted successfully' });
  } catch (error) {
    console.error('Delete artwork error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
