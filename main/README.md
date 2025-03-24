# Map Visualization with Enhanced NLP

This application provides an interactive map visualization with enhanced natural language processing capabilities. Users can input natural language queries like "Route from New York to Boston avoiding highways" or "Major cities in Europe as a heatmap" and see the results displayed on a map.

## Features

- Natural language processing for location and route queries
- Multiple visualization modes (default, heatmap, timeline, cluster, animation)
- Support for route preferences (avoiding highways, tolls, etc.)
- Interactive map with location markers and routes

## Requirements

- Node.js (14.x or higher)
- A Mapbox account and API token
- (Optional) A Google API key for Gemini Pro

## Installation and Setup

1. Clone this repository
   ```
   git clone https://github.com/your-username/map-visualization-nlp.git
   cd map-visualization-nlp
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Configure environment variables

   Create a `.env` file in the root directory with the following variables:
   ```
   # Required: Mapbox API token
   MAPBOX_TOKEN=your_mapbox_token_here
   
   # Optional: Google API key for Gemini API
   GOOGLE_API_KEY=your_google_api_key_here
   
   # Optional: Port for the server (defaults to 3000)
   PORT=3000
   ```

   - Get a Mapbox token from: https://account.mapbox.com/
   - Get a Google API key from: https://makersuite.google.com/app/apikey

## Running the Application

1. Start the server
   ```
   npm start
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Use the application by entering natural language queries in the input field

## Example Queries

- "Route from New York to Los Angeles"
- "Walking route from Central Park to Times Square avoiding busy streets"
- "Major cities in Europe as a heatmap"
- "Historical sites in Rome with timeline visualization"

## API Endpoints

The application provides several API endpoints that can be used by other applications:

- `GET /api/mapbox-token` - Get the Mapbox token
- `GET /api/directions?coordinates=lng,lat;lng,lat&profile=mapbox/driving` - Get directions between coordinates
- `POST /api/gemini` - Process text with the Gemini API

## Development

For development with automatic server restarts, use:
```
npm run dev
```

## License

This project is licensed under the MIT License. 