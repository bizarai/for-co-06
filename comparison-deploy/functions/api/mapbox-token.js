// Cloudflare Pages Function to serve the Mapbox token securely

export async function onRequest(context) {
  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
  
  // Return the token as JSON
  return new Response(
    JSON.stringify({ token: MAPBOX_TOKEN }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
} 