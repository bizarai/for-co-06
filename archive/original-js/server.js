// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const app = express();
const PORT = process.env.PORT || 3000;

// Increase the default fetch timeout
const fetchWithTimeout = (url, options, timeout = 15000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Network request timed out')), timeout)
    )
  ]);
};

// Environment variables
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || 'YOUR_GOOGLE_API_KEY';

// Enable mock mode for Gemini API
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === 'true' || false;

// Check if tokens are configured
if (MAPBOX_TOKEN === 'YOUR_MAPBOX_TOKEN') {
  console.error('❌ MAPBOX_TOKEN is not set. Please configure it in the .env file.');
} else {
  // Basic validation: Mapbox tokens typically start with 'pk.' for public tokens
  if (!MAPBOX_TOKEN.startsWith('pk.')) {
    console.warn('⚠️ MAPBOX_TOKEN doesn\'t start with "pk.". Make sure it\'s a valid public token.');
  } else {
    console.log('✅ MAPBOX_TOKEN is configured.');
    // Log just enough of the token to confirm it's there without exposing it fully
    console.log(`   Token prefix: ${MAPBOX_TOKEN.substring(0, 8)}...`);
  }
}

if (GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY') {
  console.warn('⚠️ GOOGLE_API_KEY is not set. The Gemini API will return mock data.');
}

if (USE_MOCK_DATA) {
  console.log('✅ MOCK DATA mode is enabled for Gemini API. Will return synthetic results.');
}

// Middleware
app.use(express.json());
app.use(express.static('./'));  // Serve static files from current directory

// API endpoint to get Mapbox token
app.get('/api/mapbox-token', (req, res) => {
  if (MAPBOX_TOKEN === 'YOUR_MAPBOX_TOKEN') {
    return res.status(500).json({ 
      error: 'Mapbox token not configured',
      message: 'Please set a valid MAPBOX_TOKEN in the .env file'
    });
  }
  
  res.json({ token: MAPBOX_TOKEN });
});

// API endpoint for directions
app.get('/api/directions', async (req, res) => {
    const { coordinates, profile = 'mapbox/driving' } = req.query;
    
    if (!coordinates) {
    return res.status(400).json({ error: 'Missing coordinates parameter' });
  }
  
  try {
    // Validate coordinates
    const coordPairs = coordinates.split(';').map(pair => pair.split(',').map(Number));
    
    // Check if we have valid coordinate pairs
    const invalidPairs = coordPairs.filter(pair => pair.length !== 2 || isNaN(pair[0]) || isNaN(pair[1]));
    if (invalidPairs.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid coordinates format',
        details: 'Each coordinate must be a pair of numbers (longitude,latitude)'
      });
    }
    
    // Check if we're trying to create an intercontinental route
    if (coordPairs.length >= 2) {
      const maxDistance = calculateMaxDistance(coordPairs);
      // If the maximum distance between any two points is over 2000km, it might be problematic
      if (maxDistance > 2000) {
        console.log(`Warning: Large distance detected between coordinates: ${maxDistance.toFixed(2)}km`);
      }
    }
    
    const url = `https://api.mapbox.com/directions/v5/${profile}/${coordinates}?geometries=geojson&access_token=${MAPBOX_TOKEN}`;
    console.log('Fetching directions from:', url.replace(MAPBOX_TOKEN, 'REDACTED'));
    
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      // Handle 422 Unprocessable Entity specially - usually means no route possible
      if (response.status === 422) {
        console.log('Mapbox returned 422 - Unable to create route');
        return res.status(400).json({ 
          error: 'Unable to create route between these locations',
          code: 'NO_ROUTE',
          message: 'The locations may be too far apart, on different continents, or not accessible by the selected travel mode.'
        });
      }
      
      throw new Error(`Mapbox API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Check for no routes or empty geometry
    if (!data.routes || data.routes.length === 0) {
      return res.status(400).json({ 
        error: 'No route found between these locations',
        code: 'NO_ROUTE',
        message: 'Try different locations or a different travel mode.'
      });
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching directions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Calculate the maximum distance between any two coordinates in kilometers
 * @param {Array} coordinates - Array of coordinate pairs [lng, lat]
 * @returns {number} - Maximum distance in kilometers
 */
function calculateMaxDistance(coordinates) {
  let maxDistance = 0;
  
  for (let i = 0; i < coordinates.length; i++) {
    for (let j = i + 1; j < coordinates.length; j++) {
      const distance = haversineDistance(
        coordinates[i][1], coordinates[i][0], // lat1, lon1
        coordinates[j][1], coordinates[j][0]  // lat2, lon2
      );
      maxDistance = Math.max(maxDistance, distance);
    }
  }
  
  return maxDistance;
}

/**
 * Calculate the haversine distance between two points in kilometers
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} - Distance in kilometers
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// NEW: API endpoint for Mapbox geocoding
app.get('/api/mapbox-geocoding', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Query parameter (q) is required' });
    }
    
    // Build the Mapbox Geocoding API URL
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    
    console.log(`Geocoding: ${q} (URL: ${url.replace(MAPBOX_TOKEN, 'REDACTED')})`);
    
    const response = await fetchWithTimeout(url, {}, 5000);
    
    if (!response.ok) {
      throw new Error(`Mapbox Geocoding API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error geocoding:', error);
    res.status(500).json({ error: 'Failed to geocode location', message: error.message });
  }
});

// Function to generate mock Gemini response
function getMockGeminiResponse() {
  const mockResponses = [
    {
      intentType: "route",
      locations: [
        {"name": "New York", "timeContext": ""},
        {"name": "Boston", "timeContext": ""}
      ],
      visualizationType: "default",
      travelMode: "driving",
      preferences: ["avoid highways"],
      message: "Creating a driving route from New York to Boston avoiding highways",
      suggestedSequence: ["New York", "Boston"]
    },
    {
      intentType: "locations",
      locations: [
        {"name": "Paris", "timeContext": "19th century"},
        {"name": "London", "timeContext": "Victorian era"},
        {"name": "Rome", "timeContext": "Ancient times"}
      ],
      visualizationType: "historical",
      message: "Displaying historical locations across Europe",
      preferences: ["historical context"]
    },
    {
      intentType: "locations",
      locations: [
        {"name": "Mount Everest", "timeContext": ""},
        {"name": "K2", "timeContext": ""},
        {"name": "Kilimanjaro", "timeContext": ""}
      ],
      visualizationType: "terrain",
      message: "Showing the world's most famous mountains",
      preferences: ["elevation data"]
    }
  ];
  
  // Return a random mock response
  return mockResponses[Math.floor(Math.random() * mockResponses.length)];
}

// API endpoint for Gemini API
app.post('/api/gemini', async (req, res) => {
  try {
    const { contents } = req.body;
    
    if (!contents) {
      return res.status(400).json({ error: 'Contents are required' });
    }
    
    // Check if we should use mock data
    if (USE_MOCK_DATA || GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY') {
      console.log('Using mock data for Gemini API response');
      const mockResponse = getMockGeminiResponse();
      
      // Simulate a small delay for realism
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return res.json({
        candidates: [
          {
            content: {
              parts: [
                { text: JSON.stringify(mockResponse) }
              ]
            }
          }
        ]
      });
    }
    
    // Make a request to Google's Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}`;
    
    console.log('Calling Gemini API...');
    
    try {
      const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ contents })
      }, 20000); // 20 second timeout for Gemini specifically
    
    if (!response.ok) {
      throw new Error(`Gemini API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json(data);
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      
      // Fall back to mock data if the API call fails
      console.log('Falling back to mock data due to API error');
      const mockResponse = getMockGeminiResponse();
      
      return res.json({
        candidates: [
          {
            content: {
              parts: [
                { text: JSON.stringify(mockResponse) }
              ]
            }
          }
        ],
        _note: "This is mock data provided due to an API error",
        _error: error.message
      });
    }
  } catch (error) {
    console.error('Error in Gemini API handler:', error);
    res.status(500).json({ error: 'Failed to process with Gemini API', message: error.message });
  }
});

// Debug endpoint to check API status
app.get('/api/debug', (req, res) => {
  res.json({
    status: 'ok',
    server: {
      version: process.version,
      platform: process.platform,
      env: process.env.NODE_ENV || 'development'
    },
    apis: {
      mapbox: {
        configured: MAPBOX_TOKEN !== 'YOUR_MAPBOX_TOKEN',
        tokenPrefix: MAPBOX_TOKEN !== 'YOUR_MAPBOX_TOKEN' ? MAPBOX_TOKEN.substring(0, 5) + '...' : 'Not set'
      },
      gemini: {
        configured: GOOGLE_API_KEY !== 'YOUR_GOOGLE_API_KEY',
        mockMode: USE_MOCK_DATA || GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Serve the debug page
app.get('/debug.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'debug.html'));
});

// Add new routes for comparison version
app.get('/comparison', (req, res) => {
  res.sendFile(path.join(__dirname, 'comparison/index.html'));
});

app.get('/comparison/:filename', (req, res) => {
  const filename = req.params.filename;
  res.sendFile(path.join(__dirname, 'comparison', filename));
});

// Catch-all route to serve index.html for all other requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('Map visualization available at http://localhost:3000');
  console.log('API endpoints:');
  console.log('- GET /api/mapbox-token');
  console.log('- GET /api/directions?coordinates=lng,lat;lng,lat&profile=mapbox/driving');
  console.log('- POST /api/gemini');
  console.log('- GET /api/mapbox-geocoding');
  console.log('\nDebug tools:');
  console.log(`- Debug page: http://localhost:${PORT}/debug.html`);
  console.log(`- API status: http://localhost:${PORT}/api/debug`);
}); 