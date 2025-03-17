import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check for required environment variables
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!MAPBOX_TOKEN) {
  console.error('ERROR: MAPBOX_TOKEN is required. Please set it in a .env file.');
  process.exit(1);
}

if (!GEMINI_API_KEY) {
  console.warn('WARNING: GEMINI_API_KEY is not set. NLP features will use fallback mechanisms.');
}

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serve static files from current directory

// API endpoints
// 1. Mapbox token endpoint
app.get('/api/mapbox-token', (req, res) => {
  res.json({ token: MAPBOX_TOKEN });
});

// 2. Geocoding endpoint
app.post('/api/mapbox-geocoding', async (req, res) => {
  try {
    const { location } = req.body;
    
    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }
    
    console.log(`Geocoding location: "${location}"`);
    console.log(`Using Mapbox token: ${MAPBOX_TOKEN.substring(0, 10)}...`);
    
    const encodedLocation = encodeURIComponent(location);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    
    console.log(`Fetching from URL: ${url.replace(MAPBOX_TOKEN, 'REDACTED')}`);
    
    const response = await fetch(url);
    
    console.log(`Mapbox API response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      throw new Error(`Mapbox API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`Received data: ${JSON.stringify(data).substring(0, 200)}...`);
    
    if (!data.features || data.features.length === 0) {
      return res.status(404).json({ error: `Location "${location}" not found` });
    }
    
    const feature = data.features[0];
    
    res.json({
      coordinates: feature.center, // [longitude, latitude]
      placeName: feature.place_name,
      id: feature.id
    });
    
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ error: 'Error geocoding location' });
  }
});

// 3. Directions endpoint
app.post('/api/mapbox-directions', async (req, res) => {
  try {
    const { coordinates, profile = 'driving' } = req.body;
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ error: 'At least two coordinates are required' });
    }
    
    // Format coordinates for Mapbox API: lon,lat;lon,lat;...
    const coordinatesStr = coordinates
      .map(coord => Array.isArray(coord) ? coord.join(',') : coord)
      .join(';');
    
    // Add query parameters for route preferences
    const queryParams = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      geometries: 'geojson',
      overview: 'full'
    });
    
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinatesStr}?${queryParams}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mapbox API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      return res.status(404).json({ error: 'No route found' });
    }
    
    res.json({
      route: {
        geometry: data.routes[0].geometry,
        distance: data.routes[0].distance,
        duration: data.routes[0].duration
      }
    });
    
  } catch (error) {
    console.error('Directions error:', error);
    res.status(500).json({ error: 'Error getting directions' });
  }
});

// 4. Gemini API endpoint
app.post('/api/gemini', async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(501).json({ error: 'Gemini API key not configured' });
    }
    
    const { contents } = req.body;
    
    if (!contents) {
      return res.status(400).json({ error: 'Contents is required' });
    }
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contents })
    });
    
    if (!response.ok) {
      throw new Error(`Gemini API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    console.error('Gemini API error:', error);
    res.status(500).json({ error: 'Error processing NLP request' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Map visualization available at http://localhost:${PORT}/index.html`);
}); 