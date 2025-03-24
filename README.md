# Mapping Application with NLP-based Route Visualization

This repository contains a mapping application with NLP-based route visualization optimized for performance.

## Repository Structure

- `main/`: Main application files for running locally (http://localhost:3000)
  - Original implementation of the mapping application
  - Standard route visualization performance
  - Sequential processing of NLP queries and map operations
  - Focused on core mapping functionality
  - Includes API functions in the `functions/api/` directory

- `comparison/`: Optimized comparison version (http://localhost:3000/comparison/)
  - Enhanced implementation with significant performance improvements
  - Parallel processing of NLP queries and map style updates
  - Advanced geocoding with caching and optimized location matching
  - Improved error handling and fallback mechanisms
  - Contains additional features like sharing functionality
  - Optimized map style and source management

- `comparison-deploy/`: Files for CloudFlare Pages deployment
  - Configured for direct deployment to the "for-co-04" project
  - Includes necessary API functions as Cloudflare Functions
  - Ready-to-deploy optimized version

- `readonly/`: Documentation and reference files (read-only)
  - Contains UI improvement suggestions and technical specifications

- `archive/`: Files not actively used in the current versions
  - `deployment-files/`: Files from previous deployment attempts
  - `feature-files/`: Experimental features not applied in current versions
  - `documentation-files/`: Additional documentation
  - `original-js/`: Original JavaScript files

## Performance Improvements in Comparison Version

The `comparison/` version includes several key optimizations:

1. **Parallel Processing**: Executes NLP query processing concurrently with map style updates
2. **Geocoding Cache**: Implements caching to avoid redundant geocoding requests
3. **Optimized Map Management**: Better handling of map sources and style updates
4. **Enhanced Error Handling**: Robust timeout and fallback mechanisms
5. **Performance Metrics**: Detailed timing logs for performance monitoring

## Feature Differences

| Feature | Main Version | Comparison Version |
|---------|-------------|-------------------|
| Route Visualization | Standard | Optimized |
| Processing | Sequential | Parallel |
| Share Functionality | No | Yes |
| Geocoding | Basic | Enhanced with cache |
| Error Handling | Basic | Advanced with fallbacks |
| Performance Metrics | No | Yes |

## Environment Configuration

The application requires the following environment variables, which should be set in a `.env` file in the root directory:

```
# Mapbox API token (required)
MAPBOX_TOKEN=your_mapbox_token

# Google API key for Gemini API (required)
GOOGLE_API_KEY=your_google_api_key
GEMINI_API_KEY=your_google_api_key  # Duplicate for Cloudflare compatibility

# Optional settings
USE_MOCK_DATA=false  # Set to 'true' to use mock data instead of calling Gemini API
PORT=3000  # Server port
```

These environment variables are used by both the main application and the comparison version.

## Running the Application

Start the application with:

```bash
# Install dependencies first
npm install

# Run the server from the root directory
node server.js
```

Access the application at http://localhost:3000 and the comparison version at http://localhost:3000/comparison/

## Deployed Version

The application is deployed to CloudFlare Pages at: https://for-co-04.pages.dev 