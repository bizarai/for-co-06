/**
 * Enhanced NLP Application - Fixed Initialization Script
 * This script initializes the application with the enhanced NLP and visualization features.
 */

// Import visualization module
import { applyVisualization } from './visualization-integration.js';

// Store the map instance and settings
let map;
let mapboxToken;
let selectedVisualizationType = 'default';

// Debug logging function
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  const debugInfo = document.getElementById('debug-info');
  if (debugInfo) {
    debugInfo.textContent += `\n${message}`;
    // Auto-scroll to bottom
    debugInfo.scrollTop = debugInfo.scrollHeight;
  }
}

log('App initialization script loaded');

/**
 * Initialize the Mapbox map
 * @returns {Promise<mapboxgl.Map>} The initialized map
 */
export async function initializeMap() {
  try {
    log('Initializing map...');
    
    // Show loading message in map container
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      throw new Error('Map container element not found in the document');
    }
    
    log('Map container found, showing loading message');
    const loadingElement = document.getElementById('map-loading');
    if (loadingElement) {
      loadingElement.style.display = 'flex';
    }
    
    // Fetch the Mapbox token from the server
    log('Fetching Mapbox token from server...');
    const API_URL = window.location.hostname === 'localhost' ? '' : window.location.origin;
    
    try {
      const response = await fetch(`${API_URL}/api/mapbox-token`);
      
      if (!response.ok) {
        throw new Error(`Failed to get Mapbox token: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      mapboxToken = data.token;
      
      if (!mapboxToken) {
        throw new Error('No Mapbox token received from server');
      }
      
      log(`Mapbox token received: ${mapboxToken.substring(0, 8)}...`);
    } catch (error) {
      log(`ERROR fetching token: ${error.message}`);
      throw error;
    }
    
    // Verify the mapboxgl object is available
    if (typeof mapboxgl === 'undefined') {
      log('ERROR: mapboxgl is not defined! Map library not loaded.');
      throw new Error('Mapbox GL JS library not loaded. Check your network connection and try again.');
    }
    
    log('Mapbox GL JS is available, version: ' + mapboxgl.version);
    
    // Set the token
    mapboxgl.accessToken = mapboxToken;
    log('Access token set to mapboxgl');
    
    // Try initializing the map
    log('Creating map instance...');
    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-122.42136449, 37.80176523],
      zoom: 8,
      minZoom: 1,
      attributionControl: true
    });
    
    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Set up error handling for the map
    map.on('error', (e) => {
      log(`Mapbox map error: ${e.error ? e.error.message : 'Unknown error'}`);
      console.error('Mapbox map error:', e);
      displayMapError(`Map error: ${e.error ? e.error.message : 'Unknown error'}`);
    });
    
    // Wait for the map to load
    log('Waiting for map to load...');
    return new Promise((resolve, reject) => {
      map.on('load', () => {
        log('Map loaded successfully');
        try {
          // Add sources for locations and routes
          log('Adding map sources and layers...');
          map.addSource('locations', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          });
          
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: []
              }
            }
          });
          
          // Add layers for locations and routes
          map.addLayer({
            id: 'locations-layer',
            type: 'circle',
            source: 'locations',
            paint: {
              'circle-radius': 8,
              'circle-color': '#3887be',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
            }
          });
          
          map.addLayer({
            id: 'route-layer',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3887be',
              'line-width': 4,
              'line-opacity': 0.8
            }
          });
          
          // Hide loading indicator
          if (loadingElement) {
            loadingElement.style.display = 'none';
          }
          
          log('Map setup complete');
          resolve(map);
        } catch (error) {
          log(`ERROR during map setup: ${error.message}`);
          console.error('Error during map setup:', error);
          reject(error);
        }
      });
      
      // Handle map load errors
      map.on('error', (e) => {
        log(`Map load error: ${e.error ? e.error.message : 'Unknown error'}`);
        console.error('Map load error:', e);
        reject(new Error(`Map failed to load: ${e.error ? e.error.message : 'Unknown error'}`));
      });
      
      // Set a timeout in case the map never loads
      setTimeout(() => {
        if (!map || (map.loaded && !map.loaded())) {
          const error = new Error('Map timed out while loading');
          log('ERROR: Map timed out while loading');
          console.error(error);
          reject(error);
        }
      }, 15000); // 15 second timeout
    });
  } catch (error) {
    log(`ERROR initializing map: ${error.message}`);
    console.error('Error initializing map:', error);
    displayMapError(`Error initializing map: ${error.message}`);
    throw error;
  }
}

/**
 * Display an error message in the map container
 */
function displayMapError(message) {
  log(`Displaying map error: ${message}`);
  const mapContainer = document.getElementById('map');
  const mapLoading = document.getElementById('map-loading');
  
  if (mapLoading) {
    mapLoading.innerHTML = `
      <div class="error-message">
        <h3>Map Error</h3>
        <p>${message}</p>
        <p>Please check your connection and reload the page.</p>
        <button onclick="window.location.reload()">Reload Page</button>
      </div>
    `;
    mapLoading.style.display = 'flex';
  }
}

/**
 * Update the map style based on the selected visualization type
 * @param {Object} map - The Mapbox map instance
 * @param {string} type - The visualization type
 */
export function updateMapStyle(map, type) {
  if (!map) {
    log('ERROR: Cannot update map style, map is not initialized');
    return;
  }
  
  try {
    let styleUrl = 'mapbox://styles/mapbox/streets-v12'; // default
    
    switch (type) {
      case 'satellite':
        styleUrl = 'mapbox://styles/mapbox/satellite-streets-v12';
        break;
      case 'terrain':
        styleUrl = 'mapbox://styles/mapbox/outdoors-v12';
        break;
      case 'historical':
        styleUrl = 'mapbox://styles/mapbox/light-v11';
        break;
      case 'dark':
        styleUrl = 'mapbox://styles/mapbox/dark-v11';
        break;
      default:
        styleUrl = 'mapbox://styles/mapbox/streets-v12';
    }
    
    selectedVisualizationType = type;
    log(`Updating map style to: ${type} (${styleUrl})`);
    
    map.setStyle(styleUrl);
    
    // Add event listener to re-add sources and layers once the style is loaded
    map.once('style.load', () => {
      log('Map style loaded, re-adding sources and layers...');
      try {
        // Re-add sources for locations and routes
        if (!map.getSource('locations')) {
          map.addSource('locations', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: []
            }
          });
        }
        
        if (!map.getSource('route')) {
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: []
              }
            }
          });
        }
        
        // Re-add layers for locations and routes
        if (!map.getLayer('locations-layer')) {
          map.addLayer({
            id: 'locations-layer',
            type: 'circle',
            source: 'locations',
            paint: {
              'circle-radius': 8,
              'circle-color': '#3887be',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
            }
          });
        }
        
        if (!map.getLayer('route-layer')) {
          map.addLayer({
            id: 'route-layer',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3887be',
              'line-width': 4,
              'line-opacity': 0.8
            }
          });
        }
        
        log('Sources and layers re-added successfully');
      } catch (error) {
        log(`ERROR re-adding sources and layers: ${error.message}`);
        console.error('Error re-adding sources and layers:', error);
      }
    });
  } catch (error) {
    log(`ERROR updating map style: ${error.message}`);
    console.error('Error updating map style:', error);
  }
} 