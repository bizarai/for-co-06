# Route Visualization App

This is a deployment of the route visualization application that uses Mapbox for maps and route visualization.

## Live Demo
Visit the live deployment at: [Cloudflare Pages](https://for-co-06.pages.dev)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure API keys:
   - Get a Mapbox access token from [Mapbox](https://www.mapbox.com/)
   - (Optional) Get a Gemini API key from [Google AI Studio](https://ai.google.dev/)
   - Edit the `.env` file and add your API keys:
     ```
     MAPBOX_TOKEN=your_mapbox_token_here
     GEMINI_API_KEY=your_gemini_api_key_here
     ```

3. Start the server:
```bash
npm start
```

4. Open your browser and go to:
```
http://localhost:3000
```

## Features

- Natural language processing for route requests
- Multiple routing options (driving, walking, cycling)
- Avoidance preferences (tolls, highways, ferries)
- Visual map display with route visualization
- Historical location visualization with time context
- Support for complex text analysis (like the Gibbon example)

## How to Use

1. Enter a natural language query like:
   - "Show me a route from London to Paris"
   - "Walking path from Central Park to Times Square"
   - "Cycling route from San Francisco to Oakland avoiding highways"
   - Historical text: "Gibbon's canvas is large geographically and chronologically..."

2. Click the "Search" button to process your request

3. View the route or locations displayed on the map

## Deployment

### GitHub

To push changes to GitHub:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

### Cloudflare Pages

This project is configured for deployment on Cloudflare Pages:

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Deploy to Cloudflare Pages:
```bash
wrangler pages publish . --project-name map-visualizer
```

4. Set environment variables in the Cloudflare dashboard:
   - `MAPBOX_TOKEN`: Your Mapbox access token
   - `GEMINI_API_KEY`: Your Gemini API key (optional) 