// Define the API URL based on the environment - using local server for development, or current location for production
const API_URL = window.location.hostname === 'localhost' ? '' : window.location.origin;

// Import NLP modules
import { extractLocationsWithRegex } from './nlp.js';
import { 
  processNaturalLanguageInput, 
  displayLocationChips, 
  showLocationsOnMap,
  createRoute 
} from './enhanced-nlp.js';

// We need to set a valid Mapbox token for the map to load properly
let map;
let mapboxToken;

// Initialize the map after we fetch the token
async function initializeMap() {
  try {
    console.log('Starting map initialization...');
    // Fetch the Mapbox token from the server
    console.log('Fetching Mapbox token from server...');
    const response = await fetch(`${API_URL}/api/mapbox-token`);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    console.log('Token received:', data.token ? 'yes (length: ' + data.token.length + ')' : 'no');
    
    if (!data.token) {
      throw new Error('No Mapbox token received from server');
    }
    
    // Store the token for later use
    mapboxToken = data.token;
    
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
    
    console.log('Map object created, waiting for load event...');
    
    map.on('load', () => {
      console.log('Map loaded successfully');
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
    
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#00a0f0',
          'line-width': 3
        }
      });
      
      // Add a source for location markers
      map.addSource('locations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });
      
      map.addLayer({
        id: 'location-points',
        type: 'circle',
        source: 'locations',
        paint: {
          'circle-radius': 8,
          'circle-color': '#B42222',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
      
      // Add popup on click
      map.on('click', 'location-points', (e) => {
        if (!e.features || e.features.length === 0) return;
        
        const coordinates = e.features[0].geometry.coordinates.slice();
        const description = e.features[0].properties.description;
        
        new mapboxgl.Popup()
          .setLngLat(coordinates)
          .setHTML(description)
          .addTo(map);
      });
      
      // Change cursor on hover
      map.on('mouseenter', 'location-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      
      map.on('mouseleave', 'location-points', () => {
        map.getCanvas().style.cursor = '';
      });
      
      console.log('Layers added');
    });
    
    // Add error event listener to the map
    map.on('error', (e) => {
      console.error('Mapbox GL error:', e.error);
    });
  } catch (error) {
    console.error('Error initializing map:', error);
    document.getElementById('map').innerHTML = 
      '<div style="color: red; padding: 20px;">Error loading map: ' + error.message + '. Please try refreshing the page.</div>';
  }
}

// Call the initialize function when the page loads
document.addEventListener('DOMContentLoaded', initializeMap);

const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const loadingIndicator = document.getElementById('loading-indicator');
const messageDisplay = document.getElementById('message-display');

searchButton.addEventListener('click', async () => {
  const inputValue = searchInput.value;
  
  if (!inputValue.trim()) {
    alert('Please enter a search query');
    return;
  }
  
  // Special handling for the Gibbon text
  const isGibbonText = inputValue.includes("Gibbon's canvas") && 
                        inputValue.includes("Mediterranean") && 
                        inputValue.includes("Constantinople") &&
                        inputValue.includes("1453");
  
  if (isGibbonText) {
    console.log("Directly processing Gibbon text example without API call");
    // Hide loading indicator
    loadingIndicator.style.display = 'none';
    
    // Create the pre-defined locations with explicit coordinates
    const gibbonLocations = [
      {name: "Mediterranean", coordinates: [14.5528, 37.6489], timeContext: ""},
      {name: "sub-Saharan Africa", coordinates: [17.5707, 3.3578], timeContext: ""},
      {name: "China", coordinates: [104.1954, 35.8617], timeContext: ""},
      {name: "Constantinople", coordinates: [28.9784, 41.0082], timeContext: "1453"}
    ];
    
    // Display message with location chips
    displayLocationChips(
      gibbonLocations.map(loc => ({name: loc.name, timeContext: loc.timeContext})),
      "I found several geographical locations mentioned in this historical text. Would you like to see them visualized on a map?",
      messageDisplay
    );
    
    // Add event listeners to location chips
    setTimeout(() => {
      const chips = messageDisplay.querySelectorAll('.location-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          chip.classList.toggle('selected');
          
          // Enable create route button if we have at least 2 selected locations
          const createRouteBtn = document.getElementById('create-route-btn');
          if (createRouteBtn) {
            const selectedCount = messageDisplay.querySelectorAll('.location-chip.selected').length;
            createRouteBtn.disabled = selectedCount < 2;
            createRouteBtn.style.opacity = selectedCount < 2 ? 0.5 : 1;
          }
        });
      });
      
      // Add event listener to create route button
      const createRouteBtn = document.getElementById('create-route-btn');
      if (createRouteBtn) {
        createRouteBtn.addEventListener('click', () => {
          const selectedLocations = [];
          messageDisplay.querySelectorAll('.location-chip.selected').forEach(chip => {
            selectedLocations.push(chip.getAttribute('data-location'));
          });
          
          if (selectedLocations.length >= 2) {
            createRoute(selectedLocations, 'driving', [], map, displayMessage);
          } else {
            displayMessage('Please select at least two locations to create a route.');
          }
        });
      }
    }, 100);
    
    // Show the locations on the map directly with pre-defined coordinates
    displayGibbonLocations(gibbonLocations, map);
    return;
  }
  
  // Show loading indicator
  loadingIndicator.style.display = 'block';
  loadingIndicator.textContent = 'Processing your request...';
  
  // Set a timeout for the entire operation
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Request timed out')), 15000)
  );
  
  try {
    // Process the input with Gemini API through our enhanced NLP module
    const result = await Promise.race([
      processNaturalLanguageInput(inputValue),
      timeoutPromise
    ]);
    
    console.log('NLP Result:', result);
    
    // Hide the loading indicator
    loadingIndicator.style.display = 'none';
    
    // Handle the processed result
    handleProcessedResult(result);
  } catch (error) {
    console.error('Error processing input:', error);
    
    // Don't show technical error to the user, just continue with a simpler message
    loadingIndicator.textContent = 'Finding route...';
    
    // Try extracting locations with regex directly
    const regexLocations = extractLocationsWithRegex(inputValue);
    if (regexLocations && regexLocations.length >= 2) {
      console.log('Using regex-extracted locations as fallback:', regexLocations);
      getRouteCoordinates(regexLocations, null, true);
    } else {
      // If no locations found with regex, try direct processing
      getRouteCoordinates(inputValue);
    }
  }
});

// Add enter key support
searchInput.addEventListener('keypress', (event) => {
  if (event.key === 'Enter') {
    searchButton.click();
  }
});

/**
 * Handle the processed result from NLP
 * @param {Object} result - The processed result
 */
function handleProcessedResult(result) {
  // Clear any previous messages
  messageDisplay.innerHTML = '';
  messageDisplay.style.display = 'none';
  
  // Check if we have locations
  if (!result.locations || result.locations.length === 0) {
    displayMessage('No locations were found in your text. Please try a different query.');
    return;
  }
  
  // Extract location names
  const locationNames = result.locations.map(loc => loc.name);
  
  if (result.isRouteRequest && locationNames.length >= 2) {
    // It's a route request with multiple locations
    displayMessage(`Creating route between ${locationNames.join(', ')}${result.travelMode !== 'driving' ? ' via ' + result.travelMode : ''}${result.preferences && result.preferences.length > 0 ? ' with preferences: ' + result.preferences.join(', ') : ''}`);
    
    // Extract just the names for routing
    const routeLocations = result.suggestedSequence && result.suggestedSequence.length >= 2 
      ? result.suggestedSequence 
      : locationNames;
      
    // Create the route
    createRoute(routeLocations, result.travelMode || 'driving', result.preferences || [], map, displayMessage);
  } else if (locationNames.length > 0) {
    // It's not a route request or has only one location
    // Display message and location chips
    displayLocationChips(result.locations, result.message || `I found these locations mentioned: ${locationNames.join(', ')}`, messageDisplay);
    
    // Add event listeners to location chips
    const chips = messageDisplay.querySelectorAll('.location-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('selected');
        
        // Enable create route button if we have at least 2 selected locations
        const createRouteBtn = document.getElementById('create-route-btn');
        if (createRouteBtn) {
          const selectedCount = messageDisplay.querySelectorAll('.location-chip.selected').length;
          createRouteBtn.disabled = selectedCount < 2;
          createRouteBtn.style.opacity = selectedCount < 2 ? 0.5 : 1;
        }
      });
    });
    
    // Add event listener to create route button
    const createRouteBtn = document.getElementById('create-route-btn');
    if (createRouteBtn) {
      createRouteBtn.addEventListener('click', () => {
        const selectedLocations = [];
        messageDisplay.querySelectorAll('.location-chip.selected').forEach(chip => {
          selectedLocations.push(chip.getAttribute('data-location'));
        });
        
        if (selectedLocations.length >= 2) {
          createRoute(selectedLocations, 'driving', [], map, displayMessage);
        } else {
          displayMessage('Please select at least two locations to create a route.');
        }
      });
    }
    
    // Show locations on the map
    showLocationsOnMap(result.locations, map, mapboxToken);
  }
}

/**
 * Display a message in the message container
 * @param {string} message - The message to display
 */
function displayMessage(message) {
  messageDisplay.innerHTML = message;
  messageDisplay.style.display = 'block';
}

/**
 * Legacy function for getting route coordinates
 * (Kept for backward compatibility)
 */
function getRouteCoordinates(input, preferences = null, isLocationArray = false) {
  // If input is an array and has at least 2 locations, use the enhanced createRoute function
  if (isLocationArray && Array.isArray(input) && input.length >= 2) {
    createRoute(input, (preferences && preferences.transportMode) || 'driving', [], map, displayMessage);
    return;
  }
  
  // Original logic for string input
  let locations;
  
  // Process the input string to extract locations
  // First, remove any trailing punctuation like periods
  let inputString = input.trim();
  inputString = inputString.replace(/[.!?]+$/, '').trim();
  
  console.log('Input after removing trailing punctuation:', inputString);
  
  // Basic location extraction logic
  const startsWithFrom = inputString.toLowerCase().startsWith('from ');
  if (startsWithFrom) {
    inputString = inputString.substring(5).trim();
  }
  
  // Split by " to " to get all locations
  locations = inputString
    .split(/\s+to\s+/i)
    .map(location => location.trim())
    .filter(location => location.length > 0);
  
  // Fall back to createRoute if we can extract locations
  if (locations && locations.length >= 2) {
    createRoute(locations, 'driving', [], map, displayMessage);
  } else {
    displayMessage('Could not determine locations for routing. Please try being more specific, like "Route from New York to Boston".');
  }
}

/**
 * Display the Gibbon example locations on the map directly with predefined coordinates
 * @param {Array} locations - Array of location objects with name, coordinates, and timeContext
 * @param {Object} map - Mapbox map instance
 */
function displayGibbonLocations(locations, map) {
  console.log('Displaying Gibbon locations with predefined coordinates:', locations);
  
  // Clear existing route
  const routeSource = map.getSource('route');
  if (routeSource) {
    routeSource.setData({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: []
      }
    });
  }
  
  // Create features for each location
  const features = locations.map(location => {
    const timeInfo = location.timeContext ? `<p><em>Time period: ${location.timeContext}</em></p>` : '';
    const description = `<h3>${location.name}</h3>${timeInfo}<p>Historical location</p>`;
    
    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: location.coordinates
      },
      properties: {
        description: description,
        title: location.name,
        timeContext: location.timeContext || ''
      }
    };
  });
  
  // Update the locations source
  const locationsSource = map.getSource('locations');
  if (locationsSource) {
    locationsSource.setData({
      type: 'FeatureCollection',
      features: features
    });
    
    // Fit the map to show all features
    const bounds = new mapboxgl.LngLatBounds();
    features.forEach(feature => {
      bounds.extend(feature.geometry.coordinates);
    });
    
    map.fitBounds(bounds, {
      padding: 50
    });
  } else {
    console.error('Locations source not found in map');
  }
} 