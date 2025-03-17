// Simplified Cloudflare Worker for testing

export default {
  async fetch(request, env, ctx) {
    // Add CORS headers to all responses
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
    
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Log the request for debugging
    console.log(`Request: ${request.method} ${path}`);
    
    // API Routes
    if (path === '/api/mapbox-token') {
      // 1. Mapbox token endpoint
      const MAPBOX_TOKEN = env.MAPBOX_TOKEN || "pk.eyJ1IjoidHVmZmNyZWF0ZSIsImEiOiJjbHU5YXJxeXQwN2J6MmpsMDRvMGJ0dGhsIn0.neijgnnqzQ0aCHzOPrE_MQ";
      
      if (!MAPBOX_TOKEN) {
        return new Response(JSON.stringify({ error: 'Mapbox token not configured' }), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          }
        });
      }
      
      return new Response(JSON.stringify({ token: MAPBOX_TOKEN }), {
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Serve static files for all other requests
    try {
      // This will be handled by Cloudflare Pages' static file serving
      const response = await env.ASSETS.fetch(request);
      
      // Clone the response to add CORS headers
      const newResponse = new Response(response.body, response);
      
      // Add CORS headers
      Object.keys(corsHeaders).forEach(key => {
        newResponse.headers.set(key, corsHeaders[key]);
      });
      
      return newResponse;
    } catch (e) {
      return new Response(`Not found: ${path}`, {
        status: 404,
        headers: corsHeaders
      });
    }
  }
}; 