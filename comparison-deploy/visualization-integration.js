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
    
    // Hide route type indicator since we're just showing locations
    const routeTypeIndicator = document.getElementById('route-type-indicator');
    if (routeTypeIndicator) {
      routeTypeIndicator.style.display = 'none';
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
 * Visualize a route connecting multiple locations
 * @param {Object} result - The processed NLP result
 * @param {Object} map - The Mapbox map instance
 */
async function visualizeRoute(result, map) {
  const messageDisplay = document.getElementById('message-display');
  
  try {
    if (!result.locations || result.locations.length < 2) {
      throw new Error('Need at least 2 locations for a route');
    }
    
    visualLog(`Visualizing route with ${result.locations.length} locations`);
    
    // Get suggested sequence (if available)
    const sequence = result.suggestedSequence || result.locations.map(l => l.name);
    visualLog(`Using sequence: ${sequence.join(' → ')}`);
    
    // Geocode all locations to get coordinates
    const geocodeResults = await Promise.all(
      sequence.map(async (name, index) => {
        const coords = await geocodeLocation(name);
        return { name, coord: coords, index };
      })
    );
    
    // Filter to only valid coordinates
    const validCoordinatesWithIndex = geocodeResults.filter(result => result.coord);
    const validCoordinates = validCoordinatesWithIndex.map(item => item.coord);
    const validLocationNames = validCoordinatesWithIndex.map(item => item.name);
    
    if (validCoordinates.length < 2) {
      throw new Error('Could not geocode enough locations for a route. Need at least 2 valid locations.');
    }
    
    visualLog(`Got ${validCoordinates.length} valid coordinates out of ${sequence.length} locations`);
    
    // Create GeoJSON features for each location
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
    
    let routeCoordinates;
    let routeType = 'driving'; // Default route type
    let routeColor = '#3887be'; // Default blue color for driving routes
    
    try {
      // Check if this might be an intercontinental route before trying to get directions
      const isLikelyIntercontinental = checkIfIntercontinental(validCoordinates);
      
      if (isLikelyIntercontinental) {
        // Determine if this should be an air or sea route
        const isAirRoute = determineTravelType(validCoordinates);
        
        if (isAirRoute) {
          // Create an air route with a curved path
          routeCoordinates = createAirRoute(validCoordinates);
          routeType = 'air';
          routeColor = '#e91e63'; // Pink color for air routes
        } else {
          // Create a geodesic line for sea routes
          routeCoordinates = createGeodesicLine(validCoordinates);
          routeType = 'sea';
          routeColor = '#009688'; // Teal color for sea routes
        }
        
        visualLog(`Created ${routeType} route with ${routeCoordinates.length} points for intercontinental travel`);
      } else {
        // For regular routes, try to get driving directions
        routeCoordinates = await getRoute(validCoordinates, result.travelMode || 'driving');
        visualLog(`Created driving route with ${routeCoordinates.length} points`);
      }
      
      // Update the route line on the map with appropriate styling
      map.getSource('route').setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates
        }
      });
      
      // Update the route color based on route type
      if (map.getLayer('route-layer')) {
        map.setPaintProperty('route-layer', 'line-color', routeColor);
        
        // For air routes, make the line dashed
        if (routeType === 'air') {
          map.setPaintProperty('route-layer', 'line-dasharray', [2, 1]);
        } else {
          map.setPaintProperty('route-layer', 'line-dasharray', [1]);
        }
      }
      
      // Update route type indicator
      const routeTypeIndicator = document.getElementById('route-type-indicator');
      if (routeTypeIndicator) {
        // Remove all type classes
        routeTypeIndicator.classList.remove('driving', 'air', 'sea');
        // Add the current type class
        routeTypeIndicator.classList.add(routeType);
        
        // Update text based on route type
        switch(routeType) {
          case 'air':
            routeTypeIndicator.textContent = 'Flight Route';
            break;
          case 'sea':
            routeTypeIndicator.textContent = 'Sea Route';
            break;
          default:
            routeTypeIndicator.textContent = 'Driving Route';
        }
        
        // Show the indicator
        routeTypeIndicator.style.display = 'flex';
      }
      
      // Compute the bounding box for all coordinates in the route
      const bounds = new mapboxgl.LngLatBounds();
      routeCoordinates.forEach(coord => bounds.extend(coord));
      
      // Fit the map to the bounds
      map.fitBounds(bounds, {
        padding: 50
      });
      
      // Update success message with route type information
      if (messageDisplay) {
        let routeTypeText = '';
        switch(routeType) {
          case 'air':
            routeTypeText = 'flight route';
            break;
          case 'sea':
            routeTypeText = 'sea route';
            break;
          default:
            routeTypeText = 'driving route';
        }
        
        messageDisplay.textContent = result.message 
          ? `${result.message} (${routeTypeText})`
          : `Showing ${routeTypeText} from ${validLocationNames[0]} to ${validLocationNames[validLocationNames.length - 1]}`;
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
      
      // Hide route type indicator
      const routeTypeIndicator = document.getElementById('route-type-indicator');
      if (routeTypeIndicator) {
        routeTypeIndicator.style.display = 'none';
      }
      
      // Update the message
      if (messageDisplay) {
        messageDisplay.textContent = `Couldn't create a route between these locations (${error.message}). Showing locations only.`;
        messageDisplay.style.color = '#FFA500'; // Orange to indicate partial success
      }
    }
  } catch (error) {
    console.error('Error visualizing route:', error);
    visualLog(`Error in visualizeRoute: ${error.message}`);
    
    // Hide route type indicator
    const routeTypeIndicator = document.getElementById('route-type-indicator');
    if (routeTypeIndicator) {
      routeTypeIndicator.style.display = 'none';
    }
    
    if (messageDisplay) {
      messageDisplay.textContent = `Error: ${error.message}`;
      messageDisplay.style.color = '#d9534f';
    }
  }
}

/**
 * Get route coordinates from Mapbox Directions API
 * @param {Array} coordinates - Array of coordinates
 * @param {string} profileName - The routing profile to use
 * @returns {Promise<Array>} - Array of coordinates forming the route
 */
async function getRoute(coordinates, profileName = 'driving') {
  const startTime = performance.now();
  let profile = 'mapbox/driving';
  
  // Map profile name to Mapbox profile
  if (profileName === 'walking') {
    profile = 'mapbox/walking';
  } else if (profileName === 'cycling') {
    profile = 'mapbox/cycling';
  } else if (profileName === 'driving') {
    profile = 'mapbox/driving';
  }
  
  // Format coordinates for the API
  const coordString = coordinates.map(coord => coord.join(',')).join(';');
  visualLog(`Getting ${profile} route for: ${coordString}`);
  
  // Check if we're in a static deployment environment and use Mapbox API directly
  const isStaticDeployment = window.location.hostname.includes('pages.dev') || 
                            window.location.hostname.includes('cloudflare') ||
                            !window.location.hostname.includes('localhost');

  try {
    let url;
    if (isStaticDeployment) {
      // Use Mapbox API directly with the token in static deployment
      url = `https://api.mapbox.com/directions/v5/${profile}/${coordString}?geometries=geojson&access_token=${mapboxgl.accessToken}`;
      visualLog('Using direct Mapbox API for static deployment');
    } else {
      // Use our server-side API in local development
      url = `/api/directions?coordinates=${coordString}&profile=${profile}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Directions API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found');
    }
    
    const route = data.routes[0];
    const routeCoordinates = route.geometry.coordinates;
    
    visualLog(`Got route with ${routeCoordinates.length} points in ${(performance.now() - startTime).toFixed(1)}ms`);
    
    return routeCoordinates;
  } catch (error) {
    visualLog(`Error getting route: ${error.message}`);
    
    // If the request failed, try an alternative method based on error type
    if (error.message.includes('422') || 
        error.message.includes('No route found') || 
        error.message.includes('coordinates exceeded')) {
      visualLog('Could not create a viable route, checking if intercontinental...');
      
      // Check if this is likely an intercontinental route
      const isIntercontinental = checkIfIntercontinental(coordinates);
      
      if (isIntercontinental) {
        // For intercontinental routes, determine if air or sea is more appropriate
        const isAirRoute = determineTravelType(coordinates);
        
        if (isAirRoute) {
          visualLog('Creating air route for intercontinental travel');
          return createAirRoute(coordinates);
        } else {
          visualLog('Creating sea route for intercontinental travel');
          return createGeodesicLine(coordinates);
        }
      }
    }
    
    // For other errors or non-intercontinental routes that still fail,
    // fall back to a simple straight line
    visualLog('Falling back to straight line route');
    return coordinates;
  }
}

/**
 * Check if coordinates are likely to be an intercontinental route (large distance)
 * @param {Array} coordinates - Array of coordinate pairs
 * @returns {boolean} - True if likely intercontinental
 */
function checkIfIntercontinental(coordinates) {
  if (coordinates.length < 2) return false;
  
  // First check if they're on different continents - that's the most important check
  const [lon1, lat1] = coordinates[0];
  const [lon2, lat2] = coordinates[coordinates.length - 1];
  
  // North America (simplified)
  const isNorthAmerica = (lon, lat) => 
    lon >= -170 && lon <= -50 && lat >= 15 && lat <= 85;
  
  // South America (simplified)
  const isSouthAmerica = (lon, lat) => 
    lon >= -85 && lon <= -30 && lat >= -60 && lat <= 15;
    
  // Europe (simplified)
  const isEurope = (lon, lat) => 
    lon >= -25 && lon <= 40 && lat >= 35 && lat <= 75;
    
  // Africa (simplified)
  const isAfrica = (lon, lat) => 
    lon >= -20 && lon <= 55 && lat >= -40 && lat <= 40;
    
  // Asia (simplified)
  const isAsia = (lon, lat) => 
    lon >= 25 && lon <= 180 && lat >= 0 && lat <= 80;
    
  // Australia (simplified)
  const isAustralia = (lon, lat) => 
    lon >= 110 && lon <= 155 && lat >= -45 && lat <= -10;
    
  // Check if the start and end are on different continents
  const isCrossContinent = 
    (isNorthAmerica(lon1, lat1) && !isNorthAmerica(lon2, lat2)) ||
    (isSouthAmerica(lon1, lat1) && !isSouthAmerica(lon2, lat2)) ||
    (isEurope(lon1, lat1) && !isEurope(lon2, lat2)) ||
    (isAfrica(lon1, lat1) && !isAfrica(lon2, lat2)) ||
    (isAsia(lon1, lat1) && !isAsia(lon2, lat2)) ||
    (isAustralia(lon1, lat1) && !isAustralia(lon2, lat2));
    
  // If they're on different continents, it's definitely intercontinental
  if (isCrossContinent) {
    console.log(`Intercontinental route detected between [${lat1.toFixed(2)},${lon1.toFixed(2)}] and [${lat2.toFixed(2)},${lon2.toFixed(2)}]`);
    return true;
  }
  
  // If they're on the same continent, only consider it "intercontinental" if extremely long
  // This is for cases where driving isn't practical, like Alaska to Panama
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [segLon1, segLat1] = coordinates[i];
    const [segLon2, segLat2] = coordinates[i+1];
    
    const distance = calculateDistance(segLat1, segLon1, segLat2, segLon2);
    
    // For same-continent routes, use a much higher threshold (5000km)
    if (distance > 5000) {
      console.log(`Extremely long same-continent distance detected: ${distance.toFixed(0)}km between [${segLat1.toFixed(2)},${segLon1.toFixed(2)}] and [${segLat2.toFixed(2)},${segLon2.toFixed(2)}]`);
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
 * Determine if a route should be visualized as air travel or ocean travel
 * @param {Array} coordinates - Array of coordinate pairs [lng, lat]
 * @returns {boolean} - True if it should be an air route, false for ocean route
 */
function determineTravelType(coordinates) {
  if (coordinates.length < 2) return true; // Default to air for single point
  
  // Get the coordinates of the first and last points
  const [lon1, lat1] = coordinates[0];
  const [lon2, lat2] = coordinates[coordinates.length - 1];
  
  // Simple heuristic: Check if both points are on land masses
  // This is a simplified approach - for real applications you would use more
  // sophisticated geographic data to determine land/water
  
  // Check if the points are likely on known continents
  // Based on very rough continental bounding boxes
  
  // North America (simplified)
  const isNorthAmerica = (lon, lat) => 
    lon >= -170 && lon <= -50 && lat >= 15 && lat <= 85;
  
  // South America (simplified)
  const isSouthAmerica = (lon, lat) => 
    lon >= -85 && lon <= -30 && lat >= -60 && lat <= 15;
    
  // Europe (simplified)
  const isEurope = (lon, lat) => 
    lon >= -25 && lon <= 40 && lat >= 35 && lat <= 75;
    
  // Africa (simplified)
  const isAfrica = (lon, lat) => 
    lon >= -20 && lon <= 55 && lat >= -40 && lat <= 40;
    
  // Asia (simplified)
  const isAsia = (lon, lat) => 
    lon >= 25 && lon <= 180 && lat >= 0 && lat <= 80;
    
  // Australia (simplified)
  const isAustralia = (lon, lat) => 
    lon >= 110 && lon <= 155 && lat >= -45 && lat <= -10;
  
  // Check if first point is on a continent
  const firstIsOnContinent = isNorthAmerica(lon1, lat1) || isSouthAmerica(lon1, lat1) || 
                          isEurope(lon1, lat1) || isAfrica(lon1, lat1) || 
                          isAsia(lon1, lat1) || isAustralia(lon1, lat1);
                          
  // Check if second point is on a continent                        
  const secondIsOnContinent = isNorthAmerica(lon2, lat2) || isSouthAmerica(lon2, lat2) || 
                           isEurope(lon2, lat2) || isAfrica(lon2, lat2) || 
                           isAsia(lon2, lat2) || isAustralia(lon2, lat2);
  
  // Check if both are in North America (special case for US domestic routes)
  if (isNorthAmerica(lon1, lat1) && isNorthAmerica(lon2, lat2)) {
    // Calculate distance to determine if it's a very long domestic route
    const distance = calculateDistance(lat1, lon1, lat2, lon2);
    // For extremely long routes (e.g. Alaska to Panama), still use air travel
    if (distance > 5000) {
      return true; // Air route
    }
    // For shorter North American routes, prefer to show a sea route if needed
    return false; // Sea route (but the main getRoute function should try driving first)
  }
  
  // Check if points are on different continents
  const isCrossContinent = 
    (isNorthAmerica(lon1, lat1) && !isNorthAmerica(lon2, lat2)) ||
    (isSouthAmerica(lon1, lat1) && !isSouthAmerica(lon2, lat2)) ||
    (isEurope(lon1, lat1) && !isEurope(lon2, lat2)) ||
    (isAfrica(lon1, lat1) && !isAfrica(lon2, lat2)) ||
    (isAsia(lon1, lat1) && !isAsia(lon2, lat2)) ||
    (isAustralia(lon1, lat1) && !isAustralia(lon2, lat2));
  
  // If both points are on land and on different continents, it's likely an air route
  // If one or both points are not clearly on land, default to air route
  return (firstIsOnContinent && secondIsOnContinent && isCrossContinent) || 
         !firstIsOnContinent || !secondIsOnContinent;
}

/**
 * Create a curved flight path for air travel
 * @param {Array} coordinates - Array of coordinate pairs
 * @returns {Array} - Array of coordinates forming a curved flight path
 */
function createAirRoute(coordinates) {
  if (coordinates.length < 2) return coordinates;
  
  const result = [];
  
  // For each segment, create a curved path
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[i+1];
    
    // Add the start point
    result.push([lon1, lat1]);
    
    // Calculate distance for determining number of points
    const distance = calculateDistance(lat1, lon1, lat2, lon2);
    
    // More points for longer distances
    const numPoints = Math.min(Math.ceil(distance / 300), 30);
    
    // Calculate the midpoint between the two locations
    const midLon = (lon1 + lon2) / 2;
    const midLat = (lat1 + lat2) / 2;
    
    // Calculate the distance from start to end (in degrees)
    const lonDist = lon2 - lon1;
    const latDist = lat2 - lat1;
    
    // Calculate a control point for the curve
    // Move it slightly north to create an arc
    const controlLat = midLat + (Math.abs(latDist) * 0.5 + 0.1);
    const controlLon = midLon;
    
    // Generate points along the quadratic Bézier curve
    for (let j = 1; j < numPoints; j++) {
      const t = j / numPoints;
      
      // Quadratic Bézier curve formula:
      // B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
      // where P₀ is start point, P₁ is control point, P₂ is end point
      
      const lon = Math.pow(1-t, 2) * lon1 + 2 * (1-t) * t * controlLon + Math.pow(t, 2) * lon2;
      const lat = Math.pow(1-t, 2) * lat1 + 2 * (1-t) * t * controlLat + Math.pow(t, 2) * lat2;
      
      result.push([lon, lat]);
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

/**
 * Update the map style based on visualization type
 * @param {string} visualizationType - The type of visualization to apply
 * @param {Object} map - The Mapbox map instance
 */
export function updateMapStyle(visualizationType, map) {
    visualLog(`Updating map style to ${visualizationType}`);
    
    if (!map) {
        visualLog('ERROR: Map is not available');
        return;
    }
    
    // Remove transparent mode class first (will add back if needed)
    document.body.classList.remove('transparent-mode-active');
    
    // For transparent mode, we need a special approach
    if (visualizationType === 'transparent') {
        applyTransparentMode(map);
        return; // Exit early, special handling done
    }
    
    // For other standard styles, use the normal approach
    try {
        // Save the current data from sources before changing style
        let locationsData = null;
        let routeData = null;
        
        try {
            if (map.getSource('locations')) {
                const locationsSource = map.getSource('locations');
                if (locationsSource._data) {
                    locationsData = locationsSource._data;
                }
            }
            
            if (map.getSource('route')) {
                const routeSource = map.getSource('route');
                if (routeSource._data) {
                    routeData = routeSource._data;
                }
            }
        } catch (e) {
            visualLog(`Warning: Error preserving source data during style change: ${e.message}`);
        }
        
        // Default empty data structures if we couldn't retrieve the data
        if (!locationsData) {
            locationsData = {
                type: 'FeatureCollection',
                features: []
            };
        }
        
        if (!routeData) {
            routeData = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: []
                }
            };
        }
        
        // Determine the style URL based on visualization type
        let styleUrl = 'mapbox://styles/mapbox/streets-v12'; // default
        
        switch (visualizationType) {
            case 'satellite':
                styleUrl = 'mapbox://styles/mapbox/satellite-streets-v12';
                break;
            case 'terrain':
                styleUrl = 'mapbox://styles/mapbox/outdoors-v12';
                break;
            case 'historical':
                styleUrl = 'mapbox://styles/mapbox/light-v11';
                break;
            default:
                styleUrl = 'mapbox://styles/mapbox/streets-v12';
        }
        
        // Set the map style - this operation is expensive
        const styleStartTime = performance.now();
        map.setStyle(styleUrl);
        
        // Add event listener to re-add sources and layers once the style is loaded
        map.once('style.load', () => {
            const styleLoadTime = performance.now() - styleStartTime;
            visualLog(`Map style loaded in ${styleLoadTime.toFixed(2)}ms, re-adding sources and layers...`);
            
            readdSourcesAndLayers(map, locationsData, routeData);
        });
    } catch (error) {
        visualLog(`Error updating map style: ${error.message}`);
        console.error('Error updating map style:', error);
    }
}

/**
 * Apply transparent mode to the map
 * @param {Object} map - The Mapbox map instance
 */
function applyTransparentMode(map) {
    visualLog('Applying transparent mode to map');
    
    try {
        // Save the current data from sources before changing style
        let locationsData = null;
        let routeData = null;
        
        try {
            if (map.getSource('locations')) {
                const locationsSource = map.getSource('locations');
                if (locationsSource._data) {
                    locationsData = locationsSource._data;
                }
            }
            
            if (map.getSource('route')) {
                const routeSource = map.getSource('route');
                if (routeSource._data) {
                    routeData = routeSource._data;
                }
            }
        } catch (e) {
            visualLog(`Warning: Error preserving source data during style change: ${e.message}`);
        }
        
        // Default empty data structures if we couldn't retrieve the data
        if (!locationsData) {
            locationsData = {
                type: 'FeatureCollection',
                features: []
            };
        }
        
        if (!routeData) {
            routeData = {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: []
                }
            };
        }
        
        // Get the current center as an array [lng, lat]
        const center = map.getCenter();
        const centerArray = [center.lng, center.lat];
        
        // Create a completely custom style with transparent background
        const transparentStyle = {
            version: 8,
            name: 'Transparent',
            metadata: {
                'mapbox:autocomposite': true
            },
            sources: {
                // Add a single empty source since Mapbox requires at least one source
                'empty-source': {
                    type: 'geojson',
                    data: {
                        type: 'FeatureCollection',
                        features: []
                    }
                }
            },
            layers: [
                // Add a transparent background layer
                {
                    id: 'background',
                    type: 'background',
                    paint: {
                        'background-color': 'rgba(255, 255, 255, 0)',
                        'background-opacity': 0
                    }
                }
            ],
            // Keep these default settings for the map controls but use proper array format
            center: centerArray,
            zoom: map.getZoom(),
            bearing: map.getBearing(),
            pitch: map.getPitch()
        };
        
        // Apply the transparent style
        const styleStartTime = performance.now();
        map.setStyle(transparentStyle);
        
        // Add visual indicator class to the body
        document.body.classList.add('transparent-mode-active');
        
        // Re-add our data sources and layers when the style is loaded
        map.once('style.load', () => {
            const styleLoadTime = performance.now() - styleStartTime;
            visualLog(`Transparent style loaded in ${styleLoadTime.toFixed(2)}ms, re-adding sources and layers...`);
            
            readdSourcesAndLayers(map, locationsData, routeData);
            
            // Update layer colors for better visibility on transparent background
            if (map.getLayer('route-layer')) {
                map.setPaintProperty('route-layer', 'line-color', '#1a73e8');
                map.setPaintProperty('route-layer', 'line-width', 5);
                map.setPaintProperty('route-layer', 'line-opacity', 1);
            }
            
            if (map.getLayer('locations-layer')) {
                map.setPaintProperty('locations-layer', 'circle-color', '#e91e63');
                map.setPaintProperty('locations-layer', 'circle-stroke-width', 3);
                map.setPaintProperty('locations-layer', 'circle-radius', 10);
            }
            
            visualLog('Transparent mode applied successfully');
        });
        
    } catch (error) {
        visualLog(`Error applying transparent mode: ${error.message}`);
        console.error('Error applying transparent mode:', error);
    }
}

/**
 * Re-add sources and layers to the map after a style change
 * Helper function used by both standard styles and transparent mode
 */
function readdSourcesAndLayers(map, locationsData, routeData) {
    try {
        // Re-add sources and layers in a more optimal way
        const sourcesStartTime = performance.now();
        
        // Add sources only if they don't exist
        if (!map.getSource('locations')) {
            map.addSource('locations', {
                type: 'geojson',
                data: locationsData
            });
        } else {
            // If the source exists, just update the data
            map.getSource('locations').setData(locationsData);
        }
        
        if (!map.getSource('route')) {
            map.addSource('route', {
                type: 'geojson',
                data: routeData
            });
        } else {
            // If the source exists, just update the data
            map.getSource('route').setData(routeData);
        }
        
        // Add layers only if they don't exist
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
        
        visualLog(`Sources and layers re-added in ${(performance.now() - sourcesStartTime).toFixed(2)}ms`);
    } catch (error) {
        visualLog(`Error re-adding sources and layers: ${error.message}`);
        console.error('Error re-adding sources and layers:', error);
    }
} 