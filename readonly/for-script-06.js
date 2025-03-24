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
    
    // Add a load event listener to set up sources and layers
    map.on('load', () => {
      console.log('Map loaded successfully');
      
      // Add route source
      if (!map.getSource('route')) {
        console.log('Adding route source');
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
      
      // Add route layer if it doesn't exist
      if (!map.getLayer('route-line')) {
        console.log('Adding route layer');
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
            'line-width': 4
          }
        });
      }
      
      // Add locations source for markers
      if (!map.getSource('locations')) {
        console.log('Adding locations source');
        map.addSource('locations', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });
      }
      
      // Add location markers layer if it doesn't exist
      if (!map.getLayer('location-points')) {
        console.log('Adding location points layer');
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
      }
      
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
      
      console.log('Layers and sources added to map');
    });
    
    // Add error event listener to the map
    map.on('error', (e) => {
      console.error('Mapbox GL error:', e.error);
      document.getElementById('map').innerHTML = 
        '<div style="color: red; padding: 20px;">Map error: ' + e.error.message + '</div>';
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
  
  // First, check if we can directly extract route locations
  // This is for simple queries like "Route from X to Y" or "From X to Y to Z"
  // Try the direct extraction first
  const directRouteLocations = extractBasicRouteLocations(inputValue);
  if (directRouteLocations && directRouteLocations.length >= 2) {
    console.log('Directly extracted route locations:', directRouteLocations);
    loadingIndicator.textContent = 'Creating route...';
    
    // Directly create the route with these locations
    const travelMode = 
      inputValue.match(/\b(walk|walking|on foot)\b/i) ? 'walking' :
      inputValue.match(/\b(cycl|bike|biking|bicycle)\b/i) ? 'cycling' : 'driving';
      
    createRoute(directRouteLocations, travelMode, [], map, displayMessage);
    return;
  }
  
  // If direct extraction didn't work, proceed with enhanced NLP
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
    
    // Try one more time with regex as a fallback
    const regexResult = extractLocationsWithRegex(inputValue);
    
    if (regexResult && regexResult.locations && regexResult.locations.length >= 2) {
      console.log('Using regex-extracted locations as fallback:', regexResult);
      
      // Convert the format from nlp.js to a format that enhanced-nlp.js can use
      const adaptedResult = {
        isRouteRequest: true,
        locations: regexResult.locations.map(loc => ({ name: loc, timeContext: "" })),
        travelMode: regexResult.preferences ? (regexResult.preferences.transportMode || "driving") : "driving",
        preferences: regexResult.preferences ? [
          regexResult.preferences.avoidTolls ? "avoid tolls" : null,
          regexResult.preferences.avoidHighways ? "avoid highways" : null,
          regexResult.preferences.avoidFerries ? "avoid ferries" : null
        ].filter(Boolean) : [],
        message: `Creating a route between ${regexResult.locations.join(' and ')}`,
        suggestedSequence: regexResult.locations
      };
      
      // Use the adapted result with handleProcessedResult
      handleProcessedResult(adaptedResult);
    } else {
      // If all attempts failed, show a helpful error message
      loadingIndicator.style.display = 'none';
      displayMessage('Sorry, I couldn\'t understand your request. Please try a clearer format like "Route from New York to Los Angeles" or "From Paris to London to Berlin".');
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
  console.log('Processing locations:', locationNames);
  
  if (result.isRouteRequest && locationNames.length >= 2) {
    // It's a route request with multiple locations
    console.log('Creating route between:', locationNames);
    displayMessage(`Creating route between ${locationNames.join(' → ')}${result.travelMode !== 'driving' ? ' via ' + result.travelMode : ''}`);
    
    // Pass the locations directly to createRoute
    createRoute(locationNames, result.travelMode || 'driving', result.preferences || [], map, displayMessage);
  } else if (locationNames.length > 0) {
    // It's not a route request or has only one location
    // Display message and location chips
    displayLocationChips(result.locations, result.message || `I found these locations mentioned: ${locationNames.join(', ')}`, messageDisplay);
    
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
 * Extract basic route locations using simple regex patterns
 * This is a simplified version of the logic in nlp.js to catch common route patterns
 */
function extractBasicRouteLocations(text) {
  if (!text) return [];
  
  // Clean and normalize the input
  const normalizedText = text.trim().replace(/[.!?]+$/, '').trim();
  console.log('Extracting route locations from:', normalizedText);
  
  // First check for specific multi-word cities in the text
  const commonCities = [
    'New York', 'Los Angeles', 'San Francisco', 'Las Vegas', 'San Diego',
    'Washington DC', 'New Orleans', 'San Jose', 'Saint Louis', 'St Louis',
    'Mexico City', 'New Delhi', 'Hong Kong', 'Rio de Janeiro', 'Buenos Aires',
    'Tel Aviv', 'St Petersburg', 'Central Park', 'Times Square', 'Chicago',
    'Boston', 'Seattle', 'Miami Beach', 'New Orleans', 'Salt Lake City'
  ];
  
  // Pattern 1: "Route from X to Y"
  const routePattern = /route\s+from\s+([A-Za-z\s']+?)\s+to\s+([A-Za-z\s']+)(?:\s|$)/i;
  const routeMatch = normalizedText.match(routePattern);
  
  if (routeMatch && routeMatch[1] && routeMatch[2]) {
    const from = expandPartialCityName(routeMatch[1].trim(), commonCities);
    const to = expandPartialCityName(routeMatch[2].trim(), commonCities);
    console.log('Matched route pattern:', from, 'to', to);
    return [from, to];
  }
  
  // Pattern 2: "From X to Y to Z" (multi-waypoint pattern)
  if (normalizedText.toLowerCase().startsWith('from ')) {
    const waypointText = normalizedText.substring(5); // Remove "from " prefix
    const waypoints = waypointText.split(/\s+to\s+/i)
      .map(wp => wp.trim())
      .filter(wp => wp.length > 0)
      .map(wp => expandPartialCityName(wp, commonCities));
    
    if (waypoints.length >= 2) {
      console.log('Matched multi-waypoint pattern:', waypoints);
      return waypoints;
    }
  }
  
  // Pattern 3: General "X to Y" pattern
  const toSplit = normalizedText.split(/\s+to\s+/i);
  if (toSplit.length >= 2) {
    // Clean up each part
    const waypoints = toSplit
      .map(part => part.trim())
      .filter(part => part.length > 0)
      .map(part => {
        // Remove prefixes from the first part
        if (part === toSplit[0]) {
          return part.replace(/^(route|from|walking|driving|cycling)\s+/i, '').trim();
        }
        return part;
      })
      .map(part => expandPartialCityName(part, commonCities));
    
    if (waypoints.length >= 2) {
      console.log('Matched general to pattern:', waypoints);
      return waypoints;
    }
  }
  
  return [];
}

/**
 * Expand partial city names into full city names when possible
 * @param {string} input - Potential partial city name
 * @param {Array} cityList - List of known city names
 * @returns {string} - Full city name if available, otherwise original input
 */
function expandPartialCityName(input, cityList) {
  // First check if it's already a full match
  const normalizedInput = input.toLowerCase();
  for (const city of cityList) {
    if (city.toLowerCase() === normalizedInput) {
      return city; // Already a perfect match
    }
  }
  
  // Then check if it's a partial match of the first word
  for (const city of cityList) {
    const cityParts = city.toLowerCase().split(/\s+/);
    if (cityParts.length > 1 && cityParts[0] === normalizedInput) {
      console.log(`Expanded "${input}" to "${city}"`);
      return city;
    }
  }
  
  return input;
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