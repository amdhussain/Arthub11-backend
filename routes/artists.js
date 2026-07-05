const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const DATA_DIR = path.join(__dirname, '..', 'data');
const ARTWORKS_FILE = path.join(DATA_DIR, 'artworks.json');

function readArtworks() {
  const raw = fs.readFileSync(ARTWORKS_FILE, 'utf8');
  return JSON.parse(raw);
}

function getArtistSlug(name) {
  return name.toLowerCase().replace(/\s+/g, '-');
}

router.get('/top', (req, res) => {
  try {
    const artworks = readArtworks();
    const artistMap = new Map();
    artworks.forEach((a) => {
      if (a.artist && !artistMap.has(a.artist)) {
        artistMap.set(a.artist, {
          _id: getArtistSlug(a.artist),
          id: getArtistSlug(a.artist),
          name: a.artist,
          specialty: a.category || 'Artist',
          artworkCount: 0,
        });
      }
      if (artistMap.has(a.artist)) {
        artistMap.get(a.artist).artworkCount++;
      }
    });
    const artists = Array.from(artistMap.values()).sort(
      (a, b) => b.artworkCount - a.artworkCount
    );
    return res.json({ artists });
  } catch (error) {
    console.error('Fetch top artists error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const artworks = readArtworks();
    const matched = artworks.find((a) => getArtistSlug(a.artist || '') === id.toLowerCase());
    if (!matched) {
      return res.status(404).json({ success: false, error: 'Artist not found' });
    }
    const artistName = matched.artist;
    const artistArtworks = artworks.filter((a) => a.artist === artistName);
    const artist = {
      _id: id,
      id,
      name: artistName,
      specialty: matched.category || 'Artist',
      artworkCount: artistArtworks.length,
      bio: matched.artistBio || '',
    };
    return res.json({ artist, artworks: artistArtworks });
  } catch (error) {
    console.error('Fetch artist error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
