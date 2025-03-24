// Cloudflare Pages Function to proxy requests to the Gemini API

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
  
  // Get the Gemini API key from environment variables
  const GEMINI_API_KEY = context.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Gemini API key not configured in environment variables' }), 
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
    
    // Forward the request to Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API returned ${geminiResponse.status}: ${errorText}`);
    }
    
    const data = await geminiResponse.json();
    
    // Return the Gemini API response
    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
    
  } catch (error) {
    console.error('Error proxying to Gemini API:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Error processing request',
        message: error.message
      }),
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