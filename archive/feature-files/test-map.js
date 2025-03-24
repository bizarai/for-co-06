// Simple standalone script to test map initialization

// Define the API URL based on the environment
const API_URL = window.location.hostname === 'localhost' ? '' : window.location.origin;
console.log('Using API_URL:', API_URL);

// Initialize map variables
let map;
let mapboxToken;

// Function to initialize the map
async function initializeMap() {
  try {
    console.log('Starting map initialization...');
    
    // Fetch the Mapbox token from the server
    console.log('Fetching Mapbox token from:', `${API_URL}/api/mapbox-token`);
    const response = await fetch(`${API_URL}/api/mapbox-token`);
    
    console.log('Response status:', response.status);
    console.log('Response headers:', [...response.headers].map(h => `${h[0]}: ${h[1]}`).join(', '));
    
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Token response data:', JSON.stringify(data));
    
    if (!data.token) {
      throw new Error('No Mapbox token received from server');
    }
    
    // Store the token for later use
    mapboxToken = data.token;
    console.log('Token received successfully');
    
    // Set the token for Mapbox GL
    mapboxgl.accessToken = mapboxToken;
    console.log('Mapbox token set, initializing map...');
    
    // Initialize the map
    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-122.42136449, 37.80176523], // Center the map on San Francisco
      zoom: 8
    });
    
    console.log('Map object created');
    
    // Add load event listener
    map.on('load', () => {
      console.log('Map loaded successfully');
      
      // Add a marker to show that the map is working
      new mapboxgl.Marker()
        .setLngLat([-122.42136449, 37.80176523])
        .addTo(map);
      
      document.getElementById('status').textContent = 'Map loaded successfully!';
      document.getElementById('status').style.color = 'green';
    });
    
    // Add error event listener
    map.on('error', (e) => {
      console.error('Mapbox GL error:', e.error);
      document.getElementById('status').textContent = 'Map error: ' + e.error;
      document.getElementById('status').style.color = 'red';
    });
    
  } catch (error) {
    console.error('Error initializing map:', error);
    document.getElementById('status').textContent = 'Error loading map: ' + error.message;
    document.getElementById('status').style.color = 'red';
    document.getElementById('raw-error').textContent = error.stack;
  }
}

// Wait for DOM content to be loaded
document.addEventListener('DOMContentLoaded', initializeMap); 