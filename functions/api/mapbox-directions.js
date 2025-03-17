// Cloudflare Pages Function to handle directions requests securely

export async function onRequest(context) {
  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  // Handle OPTIONS request for CORS preflight
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  
  // Get the Mapbox token from environment variables
  const MAPBOX_TOKEN = context.env.MAPBOX_TOKEN;
  
  if (!MAPBOX_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'Mapbox token not configured in environment variables' }), 
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
  
  try {
    // Parse request body
    const request = context.request;
    const contentType = request.headers.get('content-type') || '';
    
    if (!contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
    
    const body = await request.json();
    const { coordinates, profile = 'driving' } = body;
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least two coordinates are required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
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
      throw new Error(`Mapbox API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No route found' }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
    
    // Return the route information
    return new Response(
      JSON.stringify({
        route: {
          geometry: data.routes[0].geometry,
          distance: data.routes[0].distance,
          duration: data.routes[0].duration
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
    
  } catch (error) {
    console.error('Directions error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Error getting directions' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
} 