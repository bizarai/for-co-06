/**
 * Visualization Integration Module
 * Handles the integration between the NLP results and map visualization.
 */

// Helper debug function
function visualLog(message) {
  console.log(`[VIZ: ${new Date().toISOString()}] ${message}`);
  const debugInfo = document.getElementById('debug-info');
  if (debugInfo) {
    debugInfo.textContent += `\n[VIZ] ${message}`;
    // Auto-scroll to bottom
    debugInfo.scrollTop = debugInfo.scrollHeight;
  }
}

/**
 * Apply visualization to the map based on NLP results
 * @param {Object} result - The processed NLP result
 * @param {Object} map - The Mapbox map instance
 */
export async function applyVisualization(result, map) {
  const startTime = performance.now();
  visualLog('applyVisualization called');
  
  if (!map) {
    visualLog('ERROR: Map is null or undefined');
    throw new Error('Map is not available');
  }
  
  if (!result) {
    visualLog('ERROR: Result is null or undefined');
    throw new Error('Result is not available');
  }
  
  if (!result.locations || result.locations.length === 0) {
    visualLog('ERROR: No locations in result');
    throw new Error('No locations found in the result');
  }
  
  visualLog(`Applying visualization for ${result.locations.length} locations: ${result.locations.map(l => l.name).join(', ')}`);
  visualLog(`Intent type: ${result.intentType}, Visualization type: ${result.visualizationType}`);
  
  try {
    // Minimal check that map is ready - avoid waiting for load if already loaded
    if (map.loaded && !map.loaded() && !map.getSource) {
      visualLog('Map not fully loaded, waiting briefly for initialization...');
      await new Promise((resolve) => {
        const checkMap = () => {
          if (map.loaded && map.loaded()) {
            visualLog('Map is now loaded');
            resolve();
          } else if (map.getSource) {
            visualLog('Map has required methods');
            resolve();
          } else {
            setTimeout(checkMap, 100); // Check more frequently
          }
        };
        checkMap();
        // Add shorter timeout to prevent hanging
        setTimeout(resolve, 1000);
      });
    }
    
    // Check if sources exist and create them if needed - do this only once
    const sourcesStartTime = performance.now();
    try {
      if (!map.getSource('locations')) {
        visualLog('Creating locations source');
        map.addSource('locations', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });
        
        // Add layer if it doesn't exist
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
      }
      
      if (!map.getSource('route')) {
        visualLog('Creating route source');
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
        
        // Add layer if it doesn't exist
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
      }
      visualLog(`Source setup completed in ${(performance.now() - sourcesStartTime).toFixed(1)}ms`);
    } catch (err) {
      visualLog(`WARNING: Error setting up sources: ${err.message}`);
      // Continue - we'll try to use the sources directly below
    }
    
    // Clear existing data first - this gives immediate visual feedback
    try {
      // Reset source data to empty to clear the map immediately
      if (map.getSource('locations')) {
        map.getSource('locations').setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      
      if (map.getSource('route')) {
        map.getSource('route').setData({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        });
      }
    } catch (err) {
      visualLog(`WARNING: Error clearing existing data: ${err.message}`);
    }
    
    // Determine the type of visualization to apply - with performance timing
    if (result.intentType === 'route') {
      visualLog('Visualizing route...');
      const routeStartTime = performance.now();
      await visualizeRoute(result, map);
      visualLog(`Route visualization completed in ${(performance.now() - routeStartTime).toFixed(1)}ms`);
    } else {
      visualLog('Visualizing locations...');
      const locationsStartTime = performance.now();
      await visualizeLocations(result, map);
      visualLog(`Locations visualization completed in ${(performance.now() - locationsStartTime).toFixed(1)}ms`);
    }
    
    const totalTime = performance.now() - startTime;
    visualLog(`Total visualization time: ${totalTime.toFixed(1)}ms`);
    
  } catch (error) {
    visualLog(`Error in visualization: ${error.message}`);
    console.error('Visualization error:', error);
    throw error;
  }
}

/**
 * Visualize multiple locations on the map
 * @param {Object} result - The processed NLP result
 * @param {Object} map - The Mapbox map instance
 */
async function visualizeLocations(result, map) {
  const locations = result.locations;
  visualLog(`Starting visualization of ${locations.length} locations: ${locations.map(l => l.name).join(', ')}`);
  
  try {
    // Clear any existing markers to prevent duplicates
    const existingMarkers = document.querySelectorAll('.marker');
    existingMarkers.forEach(marker => marker.parentNode.removeChild(marker));
  
  // Clear existing data
  if (map.getSource('locations')) {
    map.getSource('locations').setData({
      type: 'FeatureCollection',
      features: []
    });
  }
  
  if (map.getSource('route')) {
    map.getSource('route').setData({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: []
      }
    });
  }
  
    // Check if we have predefined coordinates (like for Gibbon's text)
    const hasPreDefinedCoordinates = locations.some(loc => loc.coordinates && Array.isArray(loc.coordinates) && loc.coordinates.length === 2);
    
    let validCoordinatesWithLocations = [];
    
    if (hasPreDefinedCoordinates) {
      // Use predefined coordinates directly from the locations
      visualLog(`Using predefined coordinates for ${locations.length} locations`);
      console.log('Using predefined coordinates:', locations);
      
      validCoordinatesWithLocations = locations
        .filter(loc => loc.coordinates && Array.isArray(loc.coordinates) && loc.coordinates.length === 2)
        .map(loc => ({ coord: loc.coordinates, location: loc }));
    } else {
  // Wait for all geocoding to complete
      visualLog(`Geocoding ${locations.length} locations...`);
  const coordinatesPromises = locations.map(location => geocodeLocation(location.name));
  
  try {
    const coordinates = await Promise.all(coordinatesPromises);
    
    // Filter out any invalid coordinates
        validCoordinatesWithLocations = coordinates
      .map((coord, index) => ({ coord, location: locations[index] }))
      .filter(item => item.coord && Array.isArray(item.coord) && item.coord.length === 2);
      } catch (error) {
        console.error('Error geocoding locations:', error);
        visualLog(`Error in geocoding: ${error.message}`);
        throw new Error(`Could not geocode locations: ${error.message}`);
      }
    }
    
    visualLog(`Found ${validCoordinatesWithLocations.length} valid coordinates out of ${locations.length} locations`);
    
    if (validCoordinatesWithLocations.length === 0) {
      console.error('No valid coordinates found for any locations');
      const messageDisplay = document.getElementById('message-display');
      if (messageDisplay) {
        messageDisplay.textContent = 'Error: Could not find any of the specified locations on the map';
      }
      return;
    }
    
    // Create GeoJSON features for each location
    const features = validCoordinatesWithLocations.map(item => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: item.coord
      },
      properties: {
        name: item.location.name,
        description: item.location.timeContext 
          ? `${item.location.name} (${item.location.timeContext})`
          : item.location.name
      }
    }));
    
    // Update the map with the new locations
    map.getSource('locations').setData({
      type: 'FeatureCollection',
      features: features
    });
    
    // Get the bounding box for all locations
    const bounds = getBoundingBox(validCoordinatesWithLocations.map(item => item.coord));
    
    // Fit the map to the bounds with padding
    map.fitBounds(bounds, {
      padding: 100,
      maxZoom: 13
    });
    
    // Add markers for each location
    validCoordinatesWithLocations.forEach(item => {
      // Create a DOM element for the marker
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.backgroundColor = '#3887BE';
      el.style.width = '15px';
      el.style.height = '15px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      
      // Add the marker to the map
      new mapboxgl.Marker(el)
        .setLngLat(item.coord)
        .setPopup(new mapboxgl.Popup({ offset: 25 })
          .setHTML(`<h3>${item.location.name}</h3>`))
        .addTo(map);
    });
    
    // Update success message
    const messageDisplay = document.getElementById('message-display');
    if (messageDisplay) {
      const displayNames = validCoordinatesWithLocations.map(item => item.location.name);
      messageDisplay.textContent = result.message || `Showing locations: ${displayNames.join(', ')}`;
      messageDisplay.style.color = '#4CAF50';
    }
    
    visualLog('Location visualization completed successfully');
  } catch (error) {
    console.error('Error visualizing locations:', error);
    visualLog(`Error in visualizeLocations: ${error.message}`);
    throw new Error(`Could not visualize locations: ${error.message}`);
  }
}

/**
 * Visualize a route between locations on the map
 * @param {Object} result - The processed NLP result
 * @param {Object} map - The Mapbox map instance
 */
async function visualizeRoute(result, map) {
  // Show message that we're processing
  const messageDisplay = document.getElementById('message-display');
  if (messageDisplay) {
    messageDisplay.textContent = 'Finding route...';
  }

  // Determine the sequence of locations
  const locationSequence = result.suggestedSequence && result.suggestedSequence.length >= 2
    ? result.suggestedSequence
    : result.locations.map(loc => loc.name);
  
  if (locationSequence.length < 2) {
    console.error('Need at least 2 locations for a route');
    return;
  }
  
  console.log('Visualizing route between:', locationSequence.join(' → '));
  visualLog(`Route will follow sequence: ${locationSequence.join(' → ')}`);
  
  try {
    // Check if we have predefined coordinates (like for Gibbon's text)
    const hasPreDefinedCoordinates = result.locations.some(loc => loc.coordinates && Array.isArray(loc.coordinates) && loc.coordinates.length === 2);
    
    let validCoordinatesWithIndex = [];
    
    if (hasPreDefinedCoordinates) {
      // Use predefined coordinates from the locations
      visualLog('Using predefined coordinates for locations');
      console.log('Using predefined coordinates:', result.locations);
      
      // Map location names to their coordinates from the result
      const coordinateMap = {};
      result.locations.forEach(loc => {
        if (loc.coordinates && Array.isArray(loc.coordinates) && loc.coordinates.length === 2) {
          coordinateMap[loc.name] = loc.coordinates;
        }
      });
      
      // Create the sequence with coordinates
      validCoordinatesWithIndex = locationSequence
        .map((name, index) => ({
          name,
          index,
          coord: coordinateMap[name]
        }))
        .filter(item => item.coord); // Filter out any without coordinates
    } else {
      // Geocode all locations in the sequence, strictly preserving order
    const coordinatePromises = locationSequence.map(locationName => geocodeLocation(locationName));
      const coordinatesResults = await Promise.all(coordinatePromises);
      
      // Keep track of which locations were successfully geocoded while preserving original index
      validCoordinatesWithIndex = coordinatesResults
        .map((coord, index) => ({ coord, index, name: locationSequence[index] }))
        .filter(item => item.coord && Array.isArray(item.coord) && item.coord.length === 2);
    }
    
    // Extract just the coordinates while maintaining the sequence
    const validCoordinates = validCoordinatesWithIndex.map(item => item.coord);
    // Get names in the same order as coordinates
    const validLocationNames = validCoordinatesWithIndex.map(item => item.name);
    
    console.log('Coordinates in sequence:', validCoordinates);
    visualLog(`Found ${validCoordinates.length} valid coordinates for ${locationSequence.length} locations`);
    
    if (validCoordinates.length < 2) {
      console.error('Not enough valid coordinates for a route');
      if (messageDisplay) {
        messageDisplay.textContent = 'Error: Could not find enough locations for a route';
      }
      return;
    }
    
    // Create features for each location - for the markers
    const features = validCoordinatesWithIndex.map(item => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: item.coord
      },
      properties: {
        name: item.name,
        description: `${item.name} (Stop #${item.index + 1})` // Add sequence information
      }
    }));
    
    // Update locations source
    map.getSource('locations').setData({
      type: 'FeatureCollection',
      features: features
    });
    
    // Add visible markers for all waypoints
    // First clear any existing markers
    const existingMarkers = document.querySelectorAll('.marker');
    existingMarkers.forEach(marker => marker.remove());
    
    // Add numbered markers for all waypoints to show the sequence clearly
    validCoordinatesWithIndex.forEach((item, i) => {
      // Create a DOM element for the marker
      const el = document.createElement('div');
      el.className = 'marker';
      
      // Special styling for start and end points
      if (i === 0) {
        el.style.backgroundColor = '#12830e'; // green for start
      } else if (i === validCoordinatesWithIndex.length - 1) {
        el.style.backgroundColor = '#B42222'; // red for end
      } else {
        el.style.backgroundColor = '#3887BE'; // blue for intermediate points
      }
      
      // Style the marker with sequence number
      el.style.width = '22px';
      el.style.height = '22px';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.color = 'white';
      el.style.textAlign = 'center';
      el.style.fontWeight = 'bold';
      el.style.fontSize = '14px';
      el.style.lineHeight = '22px';
      el.textContent = (i + 1).toString(); // Show sequence number
      
      // Add the marker to the map
      new mapboxgl.Marker(el)
        .setLngLat(item.coord)
        .setPopup(new mapboxgl.Popup({ offset: 25 })
          .setHTML(`<h3>${item.name}</h3><p>Stop #${i+1}</p>`))
        .addTo(map);
    });
    
    try {
      // Try to get the route between these points
      const routeCoordinates = await getRoute(validCoordinates, result.travelMode || 'driving');
      
      // Update the route line on the map
      map.getSource('route').setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates
        }
      });
      
      // Compute the bounding box for all coordinates in the route
      const bounds = new mapboxgl.LngLatBounds();
      routeCoordinates.forEach(coord => bounds.extend(coord));
      
      // Fit the map to the bounds
      map.fitBounds(bounds, {
        padding: 50
      });
      
      // Update success message
      if (messageDisplay) {
        messageDisplay.textContent = result.message || `Showing route from ${validLocationNames[0]} to ${validLocationNames[validLocationNames.length - 1]}`;
        messageDisplay.style.color = '#4CAF50';
      }
      
      console.log('Route visualization completed successfully');
    } catch (error) {
      // If route creation fails, still show the locations but inform the user
      console.error('Error getting route, falling back to showing just locations:', error);
      visualLog(`Route creation failed: ${error.message}, showing locations only`);
      
      // Get the bounding box for all locations
      const bounds = new mapboxgl.LngLatBounds();
      validCoordinates.forEach(coord => bounds.extend(coord));
      
      // Fit the map to show all locations
      map.fitBounds(bounds, {
        padding: 50
      });
      
      // Update the message
      if (messageDisplay) {
        messageDisplay.textContent = `Couldn't create a route between these locations (${error.message}). Showing locations only.`;
        messageDisplay.style.color = '#FFA500'; // Orange to indicate partial success
      }
    }
  } catch (error) {
    console.error('Error visualizing route:', error);
    visualLog(`Error in visualizeRoute: ${error.message}`);
    if (messageDisplay) {
      messageDisplay.textContent = `Error: ${error.message}`;
      messageDisplay.style.color = '#d9534f';
    }
  }
}

/**
 * Get route coordinates between points
 * @param {Array} coordinates - Array of coordinate pairs
 * @param {string} profile - The routing profile to use
 * @returns {Promise<Array>} - Array of route coordinates
 */
async function getRoute(coordinates, profile = 'driving') {
  const routeStartTime = performance.now();
  visualLog(`Getting route for ${coordinates.length} points with profile: ${profile}`);
  
  if (!coordinates || coordinates.length < 2) {
    throw new Error('Need at least 2 coordinates for a route');
  }
  
  // Check if this might be an intercontinental route
  const isLikelyIntercontinental = checkIfIntercontinental(coordinates);
  
  // Convert profile to Mapbox format
  const mapboxProfile = profile === 'driving' ? 'mapbox/driving' :
                      profile === 'walking' ? 'mapbox/walking' :
                      profile === 'cycling' ? 'mapbox/cycling' : 'mapbox/driving';
  
  // Format coordinates for Mapbox Directions API
  const coordinatesString = coordinates
    .map(coord => coord.join(','))
    .join(';');
  
  // Build the API URL using a clean URL structure
  const API_URL = window.location.hostname === 'localhost' ? '' : window.location.origin;
  
  // If it's likely intercontinental, don't try to get normal directions
  // Instead, create a direct geodesic line between points
  if (isLikelyIntercontinental) {
    visualLog('Detected likely intercontinental route - creating geodesic line');
    
    // For intercontinental routes, we'll create a simple line with intermediate points
    const geodesicLine = createGeodesicLine(coordinates);
    visualLog(`Created geodesic line with ${geodesicLine.length} points in ${(performance.now() - routeStartTime).toFixed(1)}ms`);
    return geodesicLine;
  }
  
  try {
    // Use the directions API
    const url = `${API_URL}/api/directions?coordinates=${coordinatesString}&profile=${mapboxProfile}`;
    visualLog(`Fetching route from API: ${url.substring(0, 100)}...`);
    
    // Set a timeout for the fetch to avoid hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    const fetchStartTime = performance.now();
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    visualLog(`API response received in ${(performance.now() - fetchStartTime).toFixed(1)}ms`);
    
    if (!response.ok) {
      // Try to get more detailed error info
      let errorDetail = '';
      try {
        const errorData = await response.json();
        errorDetail = errorData.message || errorData.error || '';
      } catch (e) {
        // Ignore JSON parsing errors
      }
      
      throw new Error(`API returned ${response.status}: ${errorDetail || response.statusText}`);
    }
    
    const data = await response.json();
    const parseTime = performance.now();
    visualLog(`JSON parsed in ${(parseTime - fetchStartTime).toFixed(1)}ms`);
    
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found between these locations');
    }
    
    // Extract the route coordinates
    const routeCoordinates = data.routes[0].geometry.coordinates;
    visualLog(`Route found with ${routeCoordinates.length} points`);
    visualLog(`Total route processing time: ${(performance.now() - routeStartTime).toFixed(1)}ms`);
    
    return routeCoordinates;
  } catch (error) {
    visualLog(`Error getting route: ${error.message}`);
    
    // If the error was a timeout or network error, fall back to geodesic line
    if (error.name === 'AbortError' || 
        error.message.includes('network') || 
        error.message.includes('timeout')) {
      visualLog('Falling back to geodesic line due to network error');
      const geodesicLine = createGeodesicLine(coordinates);
      return geodesicLine;
    }
    
    // If the API rejected the route specifically, fall back to geodesic
    if (error.message.includes('422') || 
        error.message.includes('No route') || 
        error.message.includes('distance too large')) {
      visualLog('Falling back to geodesic line due to routing constraints');
      const geodesicLine = createGeodesicLine(coordinates);
      return geodesicLine;
    }
    
    // Otherwise rethrow the error
    throw error;
  }
}

/**
 * Check if coordinates are likely to be an intercontinental route (large distance)
 * @param {Array} coordinates - Array of coordinate pairs
 * @returns {boolean} - True if likely intercontinental
 */
function checkIfIntercontinental(coordinates) {
  if (coordinates.length < 2) return false;
  
  // Calculate distance between each consecutive pair
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[i+1];
    
    const distance = calculateDistance(lat1, lon1, lat2, lon2);
    
    // If any segment is greater than 2000km, consider it intercontinental
    if (distance > 2000) {
      console.log(`Long distance detected: ${distance.toFixed(0)}km between [${lat1.toFixed(2)},${lon1.toFixed(2)}] and [${lat2.toFixed(2)},${lon2.toFixed(2)}]`);
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} - Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Create a geodesic line between points by interpolating
 * @param {Array} coordinates - Array of coordinate pairs
 * @returns {Array} - Array of interpolated coordinates forming a geodesic line
 */
function createGeodesicLine(coordinates) {
  if (coordinates.length < 2) return coordinates;
  
  const result = [];
  
  // For each segment, create intermediate points
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[i+1];
    
    // Add the start point
    result.push([lon1, lat1]);
    
    // For long distances, add intermediate points
    const distance = calculateDistance(lat1, lon1, lat2, lon2);
    
    // Add more intermediate points for longer distances
    const numIntermediatePoints = Math.min(Math.ceil(distance / 500), 20);
    
    if (numIntermediatePoints > 0) {
      for (let j = 1; j <= numIntermediatePoints; j++) {
        const fraction = j / (numIntermediatePoints + 1);
        
        // Simple linear interpolation - not perfect for geodesic lines
        // but good enough for visualization purposes
        const lat = lat1 + fraction * (lat2 - lat1);
        const lon = lon1 + fraction * (lon2 - lon1);
        
        result.push([lon, lat]);
      }
    }
  }
  
  // Add the final point
  result.push(coordinates[coordinates.length - 1]);
  
  return result;
}

/**
 * Geocode a location string to coordinates
 * Uses a cache to avoid redundant API calls
 * @param {string} location - The location name to geocode
 * @returns {Promise<Array|null>} - The coordinates [lng, lat] or null if not found
 */
// Create a module-level cache for geocoded locations
const geocodeCache = {};

async function geocodeLocation(location) {
  const geocodeStartTime = performance.now();
  
  if (!location) {
    visualLog('Invalid location name (null/empty)');
    return null;
  }
  
  // Check cache first (case-insensitive)
  const normalizedLocation = location.toLowerCase().trim();
  
  // If we have this exact location in cache, return it immediately
  if (geocodeCache[normalizedLocation]) {
    visualLog(`Cache hit for "${location}"`);
    return geocodeCache[normalizedLocation];
  }
  
  visualLog(`Geocoding "${location}"...`);
  
  // Hard-coded coordinates for common cities as fallback
  const commonCities = {
    'paris': [2.3522, 48.8566],
    'london': [-0.1278, 51.5074],
    'rome': [12.4964, 41.9028],
    'ancient rome': [12.4964, 41.9028],
    'new york': [-74.0060, 40.7128],
    'los angeles': [-118.2437, 34.0522],
    'chicago': [-87.6298, 41.8781],
    'seattle': [-122.3321, 47.6062],
    'boston': [-71.0589, 42.3601],
    'miami': [-80.1918, 25.7617],
    'san francisco': [-122.4194, 37.7749],
    'washington dc': [-77.0369, 38.9072],
    'tokyo': [139.6917, 35.6895],
    'berlin': [13.4050, 52.5200],
    'madrid': [-3.7038, 40.4168],
    'sydney': [151.2093, -33.8688],
    'beijing': [116.4074, 39.9042],
    'toronto': [-79.3832, 43.6532],
    'dubai': [55.2708, 25.2048],
    'amsterdam': [4.9041, 52.3676],
    'bangkok': [100.5018, 13.7563],
    'singapore': [103.8198, 1.3521]
  };
  
  // First check for exact match in common cities
  if (commonCities[normalizedLocation]) {
    const coords = commonCities[normalizedLocation];
    visualLog(`Using hard-coded coordinates for "${location}"`);
    // Cache the result
    geocodeCache[normalizedLocation] = coords;
    return coords;
  }
  
  // Then check for partial match in common cities (only if exact word matches)
  const locationWords = normalizedLocation.split(/\s+/);
  for (const [city, coords] of Object.entries(commonCities)) {
    const cityWords = city.split(/\s+/);
    // Check if any word matches exactly
    if (locationWords.some(word => cityWords.includes(word) && word.length > 3)) {
      visualLog(`Using partial word match for "${location}" → "${city}"`);
      // Cache the result
      geocodeCache[normalizedLocation] = coords;
      return coords;
    }
  }
  
  try {
    // Use the Mapbox geocoding API through our server proxy
    const API_URL = window.location.hostname === 'localhost' ? '' : window.location.origin;
    
    // Set a timeout for the fetch to avoid hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 second timeout
    
    const apiStartTime = performance.now();
    const response = await fetch(
      `${API_URL}/api/mapbox-geocoding?q=${encodeURIComponent(location)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    
    visualLog(`API response received in ${(performance.now() - apiStartTime).toFixed(1)}ms`);
    
    if (!response.ok) {
      throw new Error(`Geocoding API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.features || data.features.length === 0) {
      visualLog(`No geocoding results for: ${location}, checking fallbacks...`);
      
      // Try fallback to fuzzy matching with common cities
      for (const [city, coords] of Object.entries(commonCities)) {
        if (city.includes(normalizedLocation.substring(0, 5)) || 
            normalizedLocation.includes(city.substring(0, 5))) {
          visualLog(`Using fuzzy match coordinates for "${location}" → "${city}"`);
          // Cache the result
          geocodeCache[normalizedLocation] = coords;
          return coords;
        }
      }
      
      return null;
    }
    
    const coordinates = data.features[0].geometry.coordinates;
    visualLog(`Geocoded "${location}" to: [${coordinates[0].toFixed(4)}, ${coordinates[1].toFixed(4)}] in ${(performance.now() - geocodeStartTime).toFixed(1)}ms`);
    
    // Cache the result
    geocodeCache[normalizedLocation] = coordinates;
    return coordinates;
  } catch (error) {
    visualLog(`Error geocoding "${location}": ${error.message}`);
    
    if (error.name === 'AbortError') {
      visualLog('Geocoding request timed out, using fallbacks');
    }
    
    // Try fallback to similar city names (only first 5 chars for fuzzy matching)
    for (const [city, coords] of Object.entries(commonCities)) {
      // For timeouts and network errors, use a more generous fuzzy match
      if (city.includes(normalizedLocation.substring(0, 5)) || 
          normalizedLocation.includes(city.substring(0, 5))) {
        visualLog(`Using fallback coordinates for "${location}" → "${city}"`);
        // Cache the result
        geocodeCache[normalizedLocation] = coords;
        return coords;
      }
    }
    
    return null;
  }
}

/**
 * Calculate the bounding box for an array of coordinates
 * @param {Array} coordinates - Array of coordinate pairs
 * @returns {Object} - mapboxgl.LngLatBounds object
 */
function getBoundingBox(coordinates) {
  if (!coordinates || coordinates.length === 0) {
    // Default to San Francisco area as fallback
    return new mapboxgl.LngLatBounds(
      [-122.5, 37.7],
      [-122.3, 37.9]
    );
  }
  
  // Create a bounds object and extend it with each coordinate
  const bounds = new mapboxgl.LngLatBounds();
  coordinates.forEach(coord => {
    if (coord && Array.isArray(coord) && coord.length >= 2) {
      bounds.extend(coord);
    }
  });
  
  return bounds;
} 