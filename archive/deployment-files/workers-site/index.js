// Cloudflare Workers version of server.js
import { Router } from 'itty-router';

// Create a new router
const router = Router();

// Define environment variables to be set in Cloudflare dashboard
// MAPBOX_TOKEN
// GEMINI_API_KEY (optional)

// Helper function to get an environment variable
const getEnv = (env, key) => {
  const value = env[key];
  if (!value) {
    console.error(`Warning: ${key} is not set in environment variables`);
  }
  return value;
};

// 1. Mapbox token endpoint
router.get('/api/mapbox-token', async (request, env) => {
  const MAPBOX_TOKEN = getEnv(env, 'MAPBOX_TOKEN');
  if (!MAPBOX_TOKEN) {
    return new Response(JSON.stringify({ error: 'Mapbox token not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({ token: MAPBOX_TOKEN }), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// 2. Geocoding endpoint
router.post('/api/mapbox-geocoding', async (request, env) => {
  const MAPBOX_TOKEN = getEnv(env, 'MAPBOX_TOKEN');
  if (!MAPBOX_TOKEN) {
    return new Response(JSON.stringify({ error: 'Mapbox token not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { location } = await request.json();
    
    if (!location) {
      return new Response(JSON.stringify({ error: 'Location is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`Geocoding location: "${location}"`);
    
    const encodedLocation = encodeURIComponent(location);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mapbox API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return new Response(JSON.stringify({ error: `Location "${location}" not found` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const feature = data.features[0];
    
    return new Response(JSON.stringify({
      coordinates: feature.center, // [longitude, latitude]
      placeName: feature.place_name,
      id: feature.id
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Geocoding error:', error);
    return new Response(JSON.stringify({ error: 'Error geocoding location' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// 3. Directions endpoint
router.post('/api/mapbox-directions', async (request, env) => {
  const MAPBOX_TOKEN = getEnv(env, 'MAPBOX_TOKEN');
  if (!MAPBOX_TOKEN) {
    return new Response(JSON.stringify({ error: 'Mapbox token not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { coordinates, profile = 'driving' } = await request.json();
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return new Response(JSON.stringify({ error: 'At least two coordinates are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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
      return new Response(JSON.stringify({ error: 'No route found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      route: {
        geometry: data.routes[0].geometry,
        distance: data.routes[0].distance,
        duration: data.routes[0].duration
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Directions error:', error);
    return new Response(JSON.stringify({ error: 'Error getting directions' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// 4. Gemini API endpoint
router.post('/api/gemini', async (request, env) => {
  const GEMINI_API_KEY = getEnv(env, 'GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'Gemini API key not configured' }), {
      status: 501,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { contents } = await request.json();
    
    if (!contents) {
      return new Response(JSON.stringify({ error: 'Contents is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
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
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Gemini API error:', error);
    return new Response(JSON.stringify({ error: 'Error processing NLP request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// 5. Catch-all route to serve static files
router.all('*', async (request) => {
  // This will be handled by Cloudflare Pages' static file serving
  return fetch(request);
});

// Main entry point for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders
      });
    }
    
    // Route the request
    let response = await router.handle(request, env, ctx);
    
    // Add CORS headers to all responses
    Object.keys(corsHeaders).forEach(key => {
      response.headers.append(key, corsHeaders[key]);
    });
    
    return response;
  }
}; 