// Cloudflare Pages Function to handle geocoding requests securely

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
    const { location } = body;
    
    if (!location) {
      return new Response(
        JSON.stringify({ error: 'Location is required' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
    
    // Geocode the location using Mapbox API
    const encodedLocation = encodeURIComponent(location);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mapbox API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      return new Response(
        JSON.stringify({ error: `Location "${location}" not found` }),
        {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      );
    }
    
    const feature = data.features[0];
    
    // Return the geocoded location
    return new Response(
      JSON.stringify({
        coordinates: feature.center, // [longitude, latitude]
        placeName: feature.place_name,
        id: feature.id
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
    console.error('Geocoding error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Error geocoding location' }),
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