const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const { connectToDatabase } = require('../config/db');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', '..', 'frontend', 'public', 'data');
const ARTWORKS_FILE = path.join(DATA_DIR, 'artworks.json');

router.get('/:artworkId/comments', async (req, res) => {
  try {
    const { artworkId } = req.params;
    const { db } = await connectToDatabase();
    const commentsCollection = db.collection('comments');

    const results = await commentsCollection
      .find({ artworkId: String(artworkId) })
      .sort({ createdAt: -1 })
      .toArray();

    return res.json({ success: true, comments: results });
  } catch (error) {
    console.error('Fetch comments error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:artworkId/comments', authenticateToken, async (req, res) => {
  try {
    const { artworkId } = req.params;
    const { text } = req.body;
    const userId = req.user.userId;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required' });
    }

    const { db } = await connectToDatabase();
    const orders = db.collection('orders');

    const purchase = await orders.findOne({ userId, artworkId: String(artworkId) });
    if (!purchase) {
      return res.status(403).json({ success: false, message: 'You must purchase this artwork before commenting' });
    }

    let artworkTitle = `Artwork #${artworkId}`;
    let artworkImage = '';
    try {
      const raw = fs.readFileSync(ARTWORKS_FILE, 'utf8');
      const artworks = JSON.parse(raw);
      const found = artworks.find(
        (a) => String(a.id) === artworkId || a.id === Number(artworkId)
      );
      if (found) {
        artworkTitle = found.title || artworkTitle;
        artworkImage = found.imageUrl || '';
      }
    } catch (_) { }

    const commentsCollection = db.collection('comments');
    const comment = {
      artworkId: String(artworkId),
      artworkTitle,
      artworkImage,
      userId,
      text: text.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        name: req.user.username || req.user.email || 'Anonymous',
        avatar: req.user.avatar || '',
      },
    };

    const result = await commentsCollection.insertOne(comment);

    return res.status(201).json({
      success: true,
      comment: { ...comment, _id: result.insertedId },
    });
  } catch (error) {
    console.error('Add comment error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { db } = await connectToDatabase();
    const commentsCollection = db.collection('comments');
    const userComments = await commentsCollection
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();
    return res.json({ success: true, comments: userComments });
  } catch (error) {
    console.error('Fetch my comments error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
