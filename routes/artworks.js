const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', '..', 'frontend', 'public', 'data');
const ARTWORKS_FILE = path.join(DATA_DIR, 'artworks.json');

function readArtworks() {
  const raw = fs.readFileSync(ARTWORKS_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeArtworks(artworks) {
  fs.writeFileSync(ARTWORKS_FILE, JSON.stringify(artworks, null, 2), 'utf8');
}

function mapArtwork(a) {
  return {
    ...a,
    _id: String(a.id),
    image: a.imageUrl,
    artistName: a.artist,
    images: a.imageUrl ? [{ url: a.imageUrl }] : [],
    stock: a.stock != null ? a.stock : (a.isSold || a.availability === false ? 0 : 100),
  };
}

router.get('/', (req, res) => {
  try {
    const { page = 1, limit = 12, search, category, sort } = req.query;
    let artworks = readArtworks();

    if (search) {
      const q = search.toLowerCase();
      artworks = artworks.filter(
        (a) =>
          a.title?.toLowerCase().includes(q) ||
          a.artist?.toLowerCase().includes(q) ||
          a.description?.toLowerCase().includes(q)
      );
    }

    if (category) {
      artworks = artworks.filter((a) => a.category === category);
    }

    if (sort === 'price_asc') {
      artworks.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sort === 'price_desc') {
      artworks.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sort === 'rating') {
      artworks.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === 'newest') {
      artworks.sort((a, b) => (b.year || 0) - (a.year || 0));
    } else if (sort === 'oldest') {
      artworks.sort((a, b) => (a.year || 0) - (b.year || 0));
    }

    const total = artworks.length;
    const pages = Math.ceil(total / Number(limit));
    const start = (Number(page) - 1) * Number(limit);
    const paged = artworks.slice(start, start + Number(limit));

    return res.json({
      success: true,
      artworks: paged.map(mapArtwork),
      page: Number(page),
      pages,
      total,
    });
  } catch (error) {
    console.error('Fetch artworks error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/featured', (req, res) => {
  try {
    const artworks = readArtworks();
    const featured = artworks
      .filter((a) => a.rating)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 8);

    return res.json({ success: true, artworks: featured.map(mapArtwork) });
  } catch (error) {
    console.error('Fetch featured error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const artworks = readArtworks();
    const artwork = artworks.find(
      (a) => String(a.id) === id || a.id === Number(id)
    );

    if (!artwork) {
      return res.status(404).json({ success: false, error: 'Artwork not found' });
    }

    return res.json({ success: true, artwork: mapArtwork(artwork) });
  } catch (error) {
    console.error('Fetch artwork error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const artworks = readArtworks();
    const index = artworks.findIndex(
      (a) => String(a.id) === id || a.id === Number(id)
    );

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Artwork not found' });
    }

    artworks[index] = { ...artworks[index], ...body };
    writeArtworks(artworks);

    return res.json({ success: true, artwork: mapArtwork(artworks[index]) });
  } catch (error) {
    console.error('Update artwork error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const artworks = readArtworks();
    const index = artworks.findIndex(
      (a) => String(a.id) === id || a.id === Number(id)
    );

    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Artwork not found' });
    }

    artworks.splice(index, 1);
    writeArtworks(artworks);

    return res.json({ success: true });
  } catch (error) {
    console.error('Delete artwork error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
