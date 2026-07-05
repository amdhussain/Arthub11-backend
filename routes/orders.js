const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticateToken } = require('../middleware/auth');
const { connectToDatabase } = require('../config/db');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { artworkId, artwork, buyerInfo, totalPrice } = req.body;
    const userId = req.user.userId;

    if (!artworkId || !artwork || !buyerInfo) {
      return res.status(400).json({
        success: false,
        message: 'artworkId, artwork, and buyerInfo are required',
      });
    }

    const { db } = await connectToDatabase();
    const orders = db.collection('orders');

    const order = {
      userId,
      artworkId: String(artworkId),
      artwork: {
        title: artwork.title || 'Untitled',
        price: artwork.price || 0,
        imageUrl: artwork.imageUrl || '',
        artistName: artwork.artistName || artwork.artist || 'Unknown Artist',
      },
      buyerInfo: {
        name: buyerInfo.name || '',
        email: buyerInfo.email || '',
      },
      totalPrice: totalPrice || artwork.price || 0,
      status: 'completed',
      purchasedAt: new Date(),
    };

    const result = await orders.insertOne(order);

    return res.status(201).json({
      success: true,
      order: { ...order, _id: result.insertedId },
    });
  } catch (error) {
    console.error('Order creation error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { db } = await connectToDatabase();
    const orders = db.collection('orders');

    const userOrders = await orders
      .find({ userId })
      .sort({ purchasedAt: -1 })
      .toArray();

    return res.json({ success: true, orders: userOrders });
  } catch (error) {
    console.error('Fetch orders error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.userId;
    const { db } = await connectToDatabase();
    const orders = db.collection('orders');

    const order = await orders.findOne({
      _id: new ObjectId(orderId),
      userId,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or unauthorized',
      });
    }

    await orders.deleteOne({ _id: new ObjectId(orderId) });

    return res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Delete order error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
