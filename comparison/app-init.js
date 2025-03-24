/**
 * Enhanced NLP Application - Initialization Script
 * This script initializes the application with the enhanced NLP and visualization features.
 */

// Import visualization module only
import { applyVisualization } from './visualization-integration.js';

// Store the map instance and settings
let map;
let mapboxToken;
let selectedVisualizationType = 'default';
// We'll get processNaturalLanguageInput via dynamic import

// Check if map is already initialized in HTML
console.log('app-init.js loading...');

// Flag to indicate if map is initialized in HTML
const mapAlreadyInitialized = window.mapInitializedInHTML || (window.map && window.map instanceof mapboxgl.Map);
console.log('Map already initialized:', mapAlreadyInitialized);

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

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  log('DOM content loaded, initializing application...');
  
  try {
    // Initialize visualization options first - these don't depend on the map
    log('Setting up visualization options...');
    initVisualizationOptions();
    
    // Set up event listeners for the input and process button
    log('Setting up event listeners...');
    setupEventListeners();
    
    // Initialize the map - add try-catch for each step to isolate failures
    log('Starting map initialization...');
    
    // Add a small delay before initializing the map to ensure all DOM elements are fully rendered
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Try normal initialization first
    try {
      await initializeMap();
      log('Map initialized successfully through normal process');
    } catch (mapInitError) {
      log(`Normal map initialization failed: ${mapInitError.message}`);
      console.error('Map initialization error:', mapInitError);
      
      // Immediate emergency fallback - don't wait
      log('Attempting emergency direct map initialization...');
      await tryDirectMapInitialization();
    }
    
    log('Application initialization complete');
  } catch (error) {
    log(`ERROR: Application initialization failed: ${error.message}`);
    console.error('Application initialization error:', error);
    displayMapError(`Failed to initialize the application: ${error.message}`);
  }
});

/**
 * Initialize the Mapbox map
 */
async function initializeMap() {
  try {
    log('Initializing map...');
    
    // Check if map already exists first
    if (mapAlreadyInitialized && window.map) {
      log('Map already initialized in HTML, using existing map');
      try {
        // Check if the map is loaded
        if (window.map.loaded()) {
          log('Existing map is loaded and ready');
          return window.map;
        } else {
          // Wait for map to load if it's not loaded yet
          log('Existing map is loading, waiting for load event');
          return new Promise((resolve) => {
            window.map.once('load', () => {
              log('Existing map finished loading');
              resolve(window.map);
            });
          });
        }
      } catch (e) {
        log('Error checking existing map: ' + e.message);
        // Continue with normal initialization if there's an issue
      }
    }
    
    // Normal map initialization if no map exists
    log('No existing map found, initializing new map');
    
    // Show loading message in map container
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      throw new Error('Map container element not found in the document');
    }
    
    log('Map container found, showing loading message');
    mapContainer.innerHTML = '<div class="map-loading">Loading map...</div>';
    
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
    
    // Clear the loading message
    mapContainer.innerHTML = '';
    
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
          
          // Add popup for location information
          map.on('click', 'locations-layer', (e) => {
            if (!e.features || e.features.length === 0) return;
            
            const coordinates = e.features[0].geometry.coordinates.slice();
            const { name, description } = e.features[0].properties;
            
            new mapboxgl.Popup()
              .setLngLat(coordinates)
              .setHTML(`<h3>${name}</h3><p>${description}</p>`)
              .addTo(map);
          });
          
          // Change cursor when hovering over locations
          map.on('mouseenter', 'locations-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          
          map.on('mouseleave', 'locations-layer', () => {
            map.getCanvas().style.cursor = '';
          });
          
          log('Map setup complete');
          resolve();
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
        if (!map.loaded()) {
          const error = new Error('Map timed out while loading');
          log('ERROR: Map timed out while loading');
          console.error(error);
          reject(error);
        }
      }, 20000); // 20 second timeout
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
  mapContainer.innerHTML = `
    <div class="map-error">
      <h3>Map Error</h3>
      <p>${message}</p>
      <p>Please check your connection and reload the page.</p>
      <button onclick="window.location.reload()">Reload Page</button>
    </div>
  `;
}

/**
 * Initialize event listeners for visualization options
 */
function initVisualizationOptions() {
  const vizOptions = document.querySelectorAll('.viz-option');
  log(`Found ${vizOptions.length} visualization options`);
  
  vizOptions.forEach(option => {
    option.addEventListener('click', () => {
      // Remove selected class from all options
      vizOptions.forEach(opt => opt.classList.remove('selected'));
      
      // Add selected class to clicked option
      option.classList.add('selected');
      
      // Update selected visualization type
      selectedVisualizationType = option.getAttribute('data-type');
      log(`Visualization type changed to: ${selectedVisualizationType}`);
      
      // If we have results displayed, update the visualization
      const messageContainer = document.getElementById('message-display');
      if (messageContainer.textContent && !messageContainer.textContent.includes('No locations were found')) {
        // Get the current input text
        const inputValue = document.getElementById('nlp-input').value;
        if (inputValue) {
          // Re-process the input with the new visualization type
          log(`Re-processing input with new visualization type: ${selectedVisualizationType}`);
          processInputWithVisualization(inputValue, selectedVisualizationType);
        }
      }
    });
  });
}

/**
 * Set up event listeners for the input and process button
 */
function setupEventListeners() {
  const nlpInput = document.getElementById('nlp-input');
  const processBtn = document.getElementById('process-btn');
  
  if (!nlpInput) {
    log('ERROR: NLP input element not found');
    console.error('NLP input element not found');
    return;
  }
  
  if (!processBtn) {
    log('ERROR: Process button element not found');
    console.error('Process button element not found');
    return;
  }
  
  log('Setting up event listener for process button...');
  // Process button click event
  processBtn.addEventListener('click', function() {
    log('CLICK: Process button clicked - event firing correctly');
    console.log('Process button clicked');
    
    const inputValue = nlpInput.value;
    log(`CLICK: Input value is: "${inputValue}"`);
    
    if (!inputValue.trim()) {
      log('CLICK: Empty input detected');
      alert('Please enter a search query');
      return;
    }
    
    log(`CLICK: About to call processInputWithVisualization("${inputValue}", "${selectedVisualizationType}")`);
    console.log(`Calling process with: ${inputValue}`);
    
    // Debug timeout to make sure we're not stuck in the click handler
    setTimeout(() => {
      log('CLICK: 100ms timeout after clicking - if you see this but not the next log, the click handler completed but processInputWithVisualization may have failed');
    }, 100);
    
    // Process the input with the selected visualization type
    try {
    processInputWithVisualization(inputValue, selectedVisualizationType);
      log('CLICK: processInputWithVisualization call completed');
    } catch (error) {
      log(`CLICK ERROR: ${error.message}`);
      console.error('Error in click handler:', error);
    }
  });
  
  // Process input on Enter key press
  nlpInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
      log('Enter key pressed');
      event.preventDefault();
      processBtn.click();
    }
  });
  
  // Set up event listeners for example queries
  const examples = document.querySelectorAll('.example');
  log(`Found ${examples.length} example queries`);
  
  examples.forEach(example => {
    example.addEventListener('click', (event) => {
      event.preventDefault();
      const query = example.getAttribute('data-query');
      nlpInput.value = query;
      log(`Example clicked: "${query}"`);
      processInputWithVisualization(query, selectedVisualizationType);
    });
  });
  
  log('Event listeners setup complete');
}

/**
 * Process input with specified visualization type
 */
async function processInputWithVisualization(inputText, visualizationType) {
  log(`PROCESS START: Processing "${inputText}" with visualization type: ${visualizationType}`);
  console.log(`Processing started: ${inputText}`);
  
  if (!inputText) {
    log('PROCESS: Empty input text received');
    return;
  }
  
  // Show loading indicator
  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) {
  loadingIndicator.style.display = 'block';
    log('PROCESS: Loading indicator shown');
  }
  
  // Clear previous results
  const messageDisplay = document.getElementById('message-display');
  if (messageDisplay) {
    messageDisplay.textContent = '';
    log('PROCESS: Message display cleared');
  }
  
  // Check if we're already processing
  if (window.isProcessing) {
    log('PROCESS WARNING: Already processing a query, skipping');
    return;
  }
  
  window.isProcessing = true;
  log('PROCESS: Set isProcessing flag to true');
  
  try {
    // First check if map is available
    if (!map) {
      log('PROCESS ERROR: Map is not initialized - reinitializing now');
      
      // Try to reinitialize the map
      try {
        await initializeMap();
        log('PROCESS: Map reinitialized successfully');
      } catch (mapError) {
        log(`PROCESS ERROR: Failed to reinitialize map: ${mapError.message}`);
        throw new Error(`Map not available: ${mapError.message}`);
      }
    }
    
    log('PROCESS: Map available, checking if loaded');
    if (!map.loaded()) {
      log('PROCESS: Map not loaded yet, waiting for load event');
      await new Promise((resolve) => {
        map.once('load', () => {
          log('PROCESS: Map loaded');
          resolve();
        });
        
        // Add a timeout in case map never loads
  setTimeout(() => {
          log('PROCESS: Map load timeout reached');
          resolve();
  }, 5000);
      });
    }
    
    // Process the input with NLP module using a direct import
    log('PROCESS: Importing NLP module directly');
    
    try {
      const enhancedNlpModule = await import('./enhanced-nlp-improved.js');
      log('PROCESS: Import successful, calling processNaturalLanguageInput');
      
      const result = await enhancedNlpModule.processNaturalLanguageInput(inputText);
      log(`PROCESS: NLP processing result: ${JSON.stringify(result)}`);
      
      // Set visualization type
    result.visualizationType = visualizationType;
      log(`PROCESS: Set visualization type to ${visualizationType}`);
    
      // Hide loading indicator
      if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
        log('PROCESS: Loading indicator hidden');
      }
      
      // Display message
      if (messageDisplay) {
        messageDisplay.textContent = result.message || 'Processing your query...';
        log(`PROCESS: Message displayed: ${result.message || 'Processing your query...'}`);
      }
      
      // Apply visualization directly with safety checks
      log('PROCESS: Verifying map is still available');
      if (!map) {
        throw new Error('Map became unavailable during processing');
      }
      
      log('PROCESS: Importing visualization module');
      const { applyVisualization } = await import('./visualization-integration.js');
      log('PROCESS: Visualization module imported successfully');
      
      log('PROCESS: Calling applyVisualization with result and map');
      await applyVisualization(result, map);
      log('PROCESS: Visualization applied successfully');
      
      // Update success message
      if (messageDisplay) {
        messageDisplay.textContent = result.message || 'Visualization complete';
        log(`PROCESS: Final message displayed: ${result.message || 'Visualization complete'}`);
    }
  } catch (error) {
      log(`PROCESS ERROR: ${error.message}`);
    console.error('Error processing input:', error);
      
      if (messageDisplay) {
        messageDisplay.textContent = `Error: ${error.message}`;
        messageDisplay.style.color = '#d9534f';
      }
    }
  } catch (error) {
    log(`PROCESS OUTER ERROR: ${error.message}`);
    console.error('Outer error in processInputWithVisualization:', error);
    
    if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
    }
    
    if (messageDisplay) {
      messageDisplay.textContent = `Error: ${error.message}`;
    }
  } finally {
    window.isProcessing = false;
    log('PROCESS: Processing complete, isProcessing flag reset');
  }
}

// Helper function to handle the processing result
function handleProcessResult(result, visualizationType) {
  log('HANDLE RESULT: Function called');
  window.isProcessing = false;
  log('HANDLE RESULT: Set isProcessing flag to false');
  
  // Force the visualization type to match the selected option
  result.visualizationType = visualizationType;
  log(`HANDLE RESULT: Set visualization type to ${visualizationType}`);
  
  // Hide the loading indicator
  const loadingIndicator = document.getElementById('loading-indicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = 'none';
    log('HANDLE RESULT: Loading indicator hidden');
  }
  
  // Handle the processed result
  if (map && result && result.locations && result.locations.length > 0) {
    log(`HANDLE RESULT: Found ${result.locations.length} locations to display: ${result.locations.map(l => l.name).join(', ')}`);
    displayMessage(result.message || 'Visualizing your query results');
    log('HANDLE RESULT: About to apply visualization to map');
    
    try {
      log('HANDLE RESULT: Map object present: ' + (map ? 'YES' : 'NO'));
      log('HANDLE RESULT: Map initialized: ' + (map.loaded ? (map.loaded() ? 'YES' : 'NO') : 'Cannot determine'));
      log('HANDLE RESULT: Map has sources: ' + (map.getSource ? 'YES' : 'NO'));
      if (map.getSource) {
        try {
          log('HANDLE RESULT: Map has locations source: ' + (map.getSource('locations') ? 'YES' : 'NO'));
          log('HANDLE RESULT: Map has route source: ' + (map.getSource('route') ? 'YES' : 'NO'));
        } catch (e) {
          log('HANDLE RESULT: Error checking sources: ' + e.message);
        }
      }
      
      applyVisualization(result, map);
      log('HANDLE RESULT: Visualization applied successfully');
    } catch (vizError) {
      log(`HANDLE RESULT ERROR in visualization: ${vizError.message}`);
      console.error('Visualization error:', vizError);
      displayMessage(`Error applying visualization: ${vizError.message}`);
    }
  } else {
    log('HANDLE RESULT: No locations found in the result or map not available');
    log('HANDLE RESULT: map exists: ' + (map ? 'YES' : 'NO'));
    log('HANDLE RESULT: result exists: ' + (result ? 'YES' : 'NO'));
    log('HANDLE RESULT: locations exist: ' + (result && result.locations ? 'YES' : 'NO'));
    log('HANDLE RESULT: locations length: ' + (result && result.locations ? result.locations.length : 'N/A'));
    
    displayMessage('No locations were found in your text. Please try a different query.');
  }
}

/**
 * Simple fallback function to extract locations directly from text
 * This is used as a fallback when the NLP processing fails
 */
function extractSimpleLocationsDirectly(text) {
  log(`Using simple location extraction for: "${text}"`);
  
  // Common locations to extract - expand this list as needed
  const commonLocations = [
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia",
    "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
    "Fort Worth", "Columbus", "San Francisco", "Charlotte", "Indianapolis", "Seattle",
    "Denver", "Washington", "Boston", "El Paso", "Nashville", "Detroit", "Portland",
    "Memphis", "Oklahoma City", "Las Vegas", "Louisville", "Baltimore", "Milwaukee",
    "Albuquerque", "Tucson", "Fresno", "Sacramento", "Long Beach", "Kansas City",
    "Mesa", "Atlanta", "Colorado Springs", "Raleigh", "Omaha", "Miami", "Oakland",
    "Minneapolis", "Tulsa", "Cleveland", "Wichita", "Arlington", "New Orleans",
    "London", "Paris", "Tokyo", "Rome", "Berlin", "Madrid", "Moscow", "Beijing",
    "Sydney", "Toronto", "Cairo", "Dubai", "Istanbul", "Mexico City", "Rio de Janeiro",
    "Amsterdam", "Bangkok", "Singapore", "Seoul", "Barcelona", "Mumbai", "Shanghai",
    "Hong Kong", "Cape Town", "Vienna", "Athens", "Prague", "Dublin", "Brussels"
  ];
  
  // Look for any of these locations in the text
  const foundLocations = [];
  for (const location of commonLocations) {
    if (text.toLowerCase().includes(location.toLowerCase())) {
      foundLocations.push(location);
    }
  }
  
  log(`Found ${foundLocations.length} locations in text: ${foundLocations.join(', ') || 'none'}`);
  
  // If we didn't find any locations, try to extract cities and countries using regex
  if (foundLocations.length === 0) {
    // Look for capitalized words that might be cities or countries
    const capitalized = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    log(`Found ${capitalized.length} capitalized terms that might be locations`);
    
    // Filter out common non-location capitalized words
    const commonNonLocations = ["I", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", 
                               "Saturday", "Sunday", "January", "February", "March", "April", 
                               "May", "June", "July", "August", "September", "October", 
                               "November", "December"];
    
    for (const word of capitalized) {
      if (!commonNonLocations.includes(word)) {
        foundLocations.push(word);
      }
    }
  }
  
  // Return unique locations (no duplicates)
  return [...new Set(foundLocations)];
}

/**
 * Display location chips
 */
function displayLocationChips(locations, message, container) {
  if (!locations || !container) return;
  
  log(`Displaying ${locations.length} location chips`);
  
  // Create container for chips if it doesn't exist
  let chipsContainer = container.querySelector('.location-chips-container');
  if (!chipsContainer) {
    chipsContainer = document.createElement('div');
    chipsContainer.className = 'location-chips-container';
    container.appendChild(chipsContainer);
  } else {
    chipsContainer.innerHTML = ''; // Clear existing chips
  }
  
  // Display message
  const messageElement = document.createElement('div');
  messageElement.className = 'result-message';
  messageElement.textContent = message;
  container.innerHTML = '';
  container.appendChild(messageElement);
  container.appendChild(chipsContainer);
  
  // Display chips for each location
  locations.forEach((location) => {
    const chip = document.createElement('div');
    chip.className = 'location-chip';
    chip.setAttribute('data-location', location.name);
    
    // Display location name and time context if available
    chip.textContent = location.name;
    if (location.timeContext) {
      const timeContext = document.createElement('span');
      timeContext.className = 'time-context';
      timeContext.textContent = location.timeContext;
      chip.appendChild(timeContext);
    }
    
    chipsContainer.appendChild(chip);
  });
  
  // Add "Create Route" button if there are multiple locations
  if (locations.length >= 2) {
    const createRouteContainer = document.createElement('div');
    createRouteContainer.className = 'create-route-container';
    
    const createRouteBtn = document.createElement('button');
    createRouteBtn.id = 'create-route-btn';
    createRouteBtn.className = 'create-route-btn';
    createRouteBtn.disabled = true;
    createRouteBtn.style.opacity = 0.5;
    createRouteBtn.textContent = 'Create Route';
    
    createRouteContainer.appendChild(createRouteBtn);
    container.appendChild(createRouteContainer);
    
    // Add help text
    const helpText = document.createElement('div');
    helpText.className = 'help-text';
    helpText.textContent = 'Select at least 2 locations and click "Create Route" to generate a route between them.';
    container.appendChild(helpText);
  }
  
  // Show the container
  container.style.display = 'block';
}

/**
 * Display a message in the message container
 */
function displayMessage(message) {
  log(`Displaying message: ${message}`);
  const messageDisplay = document.getElementById('message-display');
  messageDisplay.textContent = message;
}

/**
 * Handle the processed result from NLP
 */
function handleProcessedResult(result) {
  log(`Handling processed result: ${JSON.stringify(result)}`);
  
  const messageDisplay = document.getElementById('message-display');
  
  // Clear any previous messages
  messageDisplay.textContent = '';
  
  // Check if we have locations
  if (!result.locations || result.locations.length === 0) {
    log('No locations found in result');
    displayMessage('No locations were found in your text. Please try a different query.');
    return;
  }
  
  // Extract location names
  const locationNames = result.locations.map(loc => loc.name);
  log(`Processing locations: ${locationNames.join(', ')}`);
  
  // Display message about found locations
  displayLocationChips(result.locations, result.message || `I found these locations mentioned: ${locationNames.join(', ')}`, messageDisplay);
  
  // Apply appropriate visualization based on intent type and visualization type
  if (map) {
    log('Applying visualization to map');
    applyVisualization(result, map);
  } else {
    log('ERROR: Cannot apply visualization, map is not initialized');
    displayMessage('Cannot display map visualization. Please reload the page.');
  }
  
  // Add event listeners to location chips
  setTimeout(() => {
    const chips = messageDisplay.querySelectorAll('.location-chip');
    log(`Adding event listeners to ${chips.length} location chips`);
    
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
          log(`Creating route between selected locations: ${selectedLocations.join(' → ')}`);
          
          // Create a route result object and pass it to applyVisualization
          const routeResult = {
            intentType: "route",
            locations: selectedLocations.map(location => ({ name: location, timeContext: "" })),
            travelMode: "driving",
            preferences: [],
            visualizationType: "default",
            suggestedSequence: selectedLocations
          };
          
          if (map) {
            applyVisualization(routeResult, map);
          } else {
            log('ERROR: Cannot apply visualization, map is not initialized');
            displayMessage('Cannot display map visualization. Please reload the page.');
          }
        } else {
          log('Not enough locations selected for route');
          displayMessage('Please select at least two locations to create a route.');
        }
      });
    }
  }, 100);
}

/**
 * Emergency fallback function to initialize the map directly without API calls
 */
async function tryDirectMapInitialization() {
  try {
    // Set token directly
    const directToken = 'pk.eyJ1IjoidHVmZmNyZWF0ZSIsImEiOiJjbHU5YXJxeXQwN2J6MmpsMDRvMGJ0dGhsIn0.neijgnnqzQ0aCHzOPrE_MQ';
    mapboxgl.accessToken = directToken;
    mapboxToken = directToken; // Store for later use
    
    log('Emergency: Using direct token for map initialization');
    
    // Create map element and replace existing container
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      throw new Error('Map container element not found');
    }
    
    mapContainer.innerHTML = ''; // Clear any error messages
    log('Emergency: Map container cleared');
    
    // Initialize map directly
    log('Emergency: Creating map instance...');
    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-122.42136449, 37.80176523],
      zoom: 8,
      minZoom: 1,
      attributionControl: true
    });
    
    log('Emergency: Map instance created');
    
    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    log('Emergency: Added navigation controls');
    
    // Wait for the map to load
    return new Promise((resolve, reject) => {
      map.on('load', () => {
        log('Emergency map initialized successfully');
        try {
          // Add a marker at the center to verify it's working
          new mapboxgl.Marker()
            .setLngLat([-122.42136449, 37.80176523])
            .addTo(map);
          log('Emergency: Added verification marker');
          
          // Add minimal required sources
          log('Emergency: Adding map sources and layers...');
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
          
          log('Emergency: Map setup complete');
          displayMessage('Map loaded in emergency mode. All features should work normally.');
          resolve();
        } catch (error) {
          log(`ERROR during emergency map setup: ${error.message}`);
          console.error('Error during emergency map setup:', error);
          reject(error);
        }
      });
      
      // Handle map load errors
      map.on('error', (e) => {
        log(`Emergency map load error: ${e.error ? e.error.message : 'Unknown error'}`);
        console.error('Emergency map load error:', e);
        reject(new Error(`Emergency map failed to load: ${e.error ? e.error.message : 'Unknown error'}`));
      });
      
      // Set a timeout in case the map never loads
      setTimeout(() => {
        if (map && !map.loaded()) {
          const error = new Error('Emergency map timed out while loading');
          log('ERROR: Emergency map timed out while loading');
          console.error(error);
          reject(error);
        }
      }, 10000); // 10 second timeout
    });
  } catch (error) {
    log(`Emergency initialization failed: ${error.message}`);
    console.error('Emergency initialization error:', error);
    displayMapError('Failed to initialize map in emergency mode. Please try reloading the page.');
    throw error;
  }
}

// Export functions and variables for use in other modules
export { 
  map, 
  mapboxToken, 
  processInputWithVisualization, 
  displayMessage, 
  displayLocationChips,
  handleProcessedResult
}; 