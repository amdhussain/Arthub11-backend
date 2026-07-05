const express = require('express');
const { ObjectId } = require('mongodb');
const { authenticateToken } = require('../middleware/auth');
const { connectToDatabase } = require('../config/db');

const router = express.Router();

router.post('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { artworkId, artwork } = req.body;

    if (!artworkId || !artwork) {
      return res.status(400).json({
        success: false,
        message: 'artworkId and artwork data are required',
      });
    }

    const { db } = await connectToDatabase();
    const collection = db.collection('favorites');

    const existing = await collection.findOne({
      userId,
      artworkId: String(artworkId),
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Artwork is already in your collection',
      });
    }

    const doc = {
      userId,
      artworkId: String(artworkId),
      artwork: {
        title: artwork.title || 'Untitled',
        artist: artwork.artist || artwork.artistName || 'Unknown Artist',
        price: artwork.price || 0,
        imageUrl: artwork.imageUrl || artwork.image || '',
        category: artwork.category || '',
      },
      addedAt: new Date(),
    };

    const result = await collection.insertOne(doc);

    return res.status(201).json({
      success: true,
      item: { ...doc, _id: result.insertedId },
    });
  } catch (error) {
    console.error('Add to collection error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { db } = await connectToDatabase();
    const collection = db.collection('favorites');

    const items = await collection
      .find({ userId })
      .sort({ addedAt: -1 })
      .toArray();

    return res.json({ success: true, items });
  } catch (error) {
    console.error('Fetch collection error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:artworkId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { artworkId } = req.params;
    const { db } = await connectToDatabase();
    const collection = db.collection('favorites');

    const result = await collection.deleteOne({
      userId,
      artworkId: String(artworkId),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Artwork not found in your collection',
      });
    }

    return res.json({ success: true, message: 'Removed from collection' });
  } catch (error) {
    console.error('Remove from collection error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
