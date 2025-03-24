/**
 * Advanced Visualization Module for map-based displays
 * Implements various visualization types for different data contexts
 */

/**
 * Visualize locations based on the extracted data and visualization type
 * @param {Object} extractedData - Data from NLP processing
 * @param {Object} map - Mapbox map instance
 * @param {Function} displayMessage - Function to display messages to the user
 */
export function visualizeLocations(extractedData, map, displayMessage) {
  const { locations, intentType, visualizationType, suggestedSequence, suggestedBounds, thematicContext } = extractedData;
  
  if (!locations || locations.length === 0) {
    displayMessage('No locations found to visualize.');
    return;
  }
  
  console.log('Visualizing locations with data:', extractedData);
  
  // Geocode all locations first
  geocodeAllLocations(locations, map.getCenter()).then(geocodedFeatures => {
    if (!geocodedFeatures || geocodedFeatures.length === 0) {
      displayMessage('Could not geocode any of the specified locations.');
      return;
    }
    
    // Update markers for all locations
    try {
      map.getSource('locations').setData({
        type: 'FeatureCollection',
        features: geocodedFeatures
      });
    } catch (error) {
      console.error('Error updating locations source:', error);
      displayMessage('Error displaying locations. Please try again.');
      return;
    }
    
    // Determine visualization type based on intent if none specified
    let effectiveVisualizationType = visualizationType;
    if (!effectiveVisualizationType) {
      switch(intentType) {
        case 'ROUTE_REQUEST':
          effectiveVisualizationType = 'ROUTE';
          break;
        case 'HISTORICAL_NARRATIVE':
          effectiveVisualizationType = 'CHRONOLOGICAL_SEQUENCE';
          break;
        case 'GEOGRAPHICAL_EXPLORATION':
          effectiveVisualizationType = 'GEOGRAPHICAL_SCOPE';
          break;
        case 'CONCEPTUAL_JOURNEY':
        default:
          effectiveVisualizationType = 'TEXTUAL_SEQUENCE';
          break;
      }
    }
    
    // Choose visualization based on type
    switch (effectiveVisualizationType) {
      case 'ROUTE':
        visualizeAsRoute(geocodedFeatures, extractedData.travelMode, extractedData.preferences || [], map, displayMessage);
        break;
      
      case 'GEOGRAPHICAL_SCOPE':
        visualizeAsRegion(geocodedFeatures, map, thematicContext, displayMessage);
        break;
      
      case 'CHRONOLOGICAL_SEQUENCE':
        visualizeAsTimeline(geocodedFeatures, map, displayMessage);
        break;
      
      case 'HISTORICAL_CONTEXT':
        visualizeWithHistoricalContext(geocodedFeatures, map, displayMessage);
        break;
      
      case 'TEXTUAL_SEQUENCE':
      default:
        visualizeAsSequence(geocodedFeatures, suggestedSequence, map, displayMessage);
        break;
    }
  }).catch(error => {
    console.error('Error during visualization:', error);
    displayMessage('Error visualizing locations. Please try again with different locations.');
  });
}

/**
 * Geocode all locations and gather features
 * @param {Array} locations - Array of location objects
 * @param {Object} defaultCenter - Default map center to use as fallback
 * @returns {Promise<Array>} - Promise resolving to array of GeoJSON features
 */
async function geocodeAllLocations(locations, defaultCenter) {
  const geocodedFeatures = [];
  const failedLocations = [];
  
  // Define API_URL based on environment
  const API_URL = window.location.hostname === 'localhost' ? '' : window.location.origin;
  
  // Process each location
  await Promise.all(locations.map(async (location, index) => {
    try {
      // If coordinates are already provided
      if (location.coordinates) {
        console.log(`Using provided coordinates for ${location.name}:`, location.coordinates);
        
        // Create GeoJSON feature with the provided coordinates
        const feature = {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: location.coordinates
          },
          properties: {
            title: location.name,
            description: createEnhancedPopupHTML(location),
            timeContext: location.timeContext || '',
            historicalContext: location.historicalContext || '',
            descriptiveContext: location.descriptiveContext || '',
            relationshipContext: location.relationshipContext || '',
            originalIndex: index
          }
        };
        
        geocodedFeatures.push(feature);
        return;
      }
      
      // Try server-side geocoding
      const response = await fetch(`${API_URL}/api/mapbox-geocoding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ location: location.name })
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      const coordinates = data.coordinates;
      console.log(`Geocoded ${location.name} to:`, coordinates);
      
      // Create GeoJSON feature with enhanced properties
      const feature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        properties: {
          title: location.name,
          description: createEnhancedPopupHTML(location),
          timeContext: location.timeContext || '',
          historicalContext: location.historicalContext || '',
          descriptiveContext: location.descriptiveContext || '',
          relationshipContext: location.relationshipContext || '',
          originalIndex: index
        }
      };
      
      geocodedFeatures.push(feature);
    } catch (error) {
      console.error(`Error geocoding location "${location.name}":`, error);
      failedLocations.push({...location, originalIndex: index});
    }
  }));
  
  // Try alternative geocoding for failed locations
  if (failedLocations.length > 0) {
    console.log(`Trying alternative geocoding for ${failedLocations.length} failed locations:`, failedLocations);
    const historicalFeatures = getHistoricalLocationFeatures(failedLocations);
    if (historicalFeatures.length > 0) {
      geocodedFeatures.push(...historicalFeatures);
    }
  }
  
  // Sort features by original index to maintain order
  return geocodedFeatures.sort((a, b) => a.properties.originalIndex - b.properties.originalIndex);
}

/**
 * Create enhanced HTML for location popups
 * @param {Object} location - Location object with additional context
 * @returns {string} - HTML content for popup
 */
function createEnhancedPopupHTML(location) {
  const timeInfo = location.timeContext ? 
    `<p><strong>Time period:</strong> <em>${location.timeContext}</em></p>` : '';
  
  const historicalContext = location.historicalContext ? 
    `<p><strong>Historical context:</strong> ${location.historicalContext}</p>` : '';
  
  const descriptiveContext = location.descriptiveContext ? 
    `<p><strong>Description:</strong> ${location.descriptiveContext}</p>` : '';
  
  const relationshipContext = location.relationshipContext ? 
    `<p><strong>Relation:</strong> ${location.relationshipContext}</p>` : '';
  
  return `
    <div class="popup-content">
      <h3>${location.name}</h3>
      ${timeInfo}
      ${historicalContext}
      ${descriptiveContext}
      ${relationshipContext}
    </div>
  `;
}

/**
 * Get coordinates for historical locations that failed standard geocoding
 * @param {Array} locations - Array of location objects that failed geocoding
 * @returns {Array} - Array of GeoJSON features for historical locations
 */
function getHistoricalLocationFeatures(locations) {
  // Historical and regional locations with approximate coordinates
  const historicalLocations = {
    'Mediterranean': [14.5528, 37.6489],
    'sub-Saharan Africa': [17.5707, 3.3578],
    'Constantinople': [28.9784, 41.0082],
    'Rome': [12.4964, 41.9028],
    'Italy': [12.5674, 41.8719],
    'Italian Peninsula': [12.5674, 41.8719],
    'Egypt': [30.8025, 26.8206],
    'Mesopotamia': [44.4009, 33.2232],
    'Byzantine Empire': [29.9792, 40.7313],
    'Ottoman Empire': [35.2433, 38.9637],
    'Ancient Greece': [23.7275, 37.9838],
    'Greece': [23.7275, 37.9838],
    'Persia': [53.6880, 32.4279],
    'Carthage': [10.3236, 36.8585],
    'Gaul': [2.2137, 46.2276],
    'Dacia': [24.9668, 45.9443],
    'Britain': [-1.5491, 52.3555],
    'Western Europe': [3.9, 47.0],
    'Eastern Europe': [25.0, 50.0],
    'North Africa': [20.0, 28.0],
    'Middle East': [40.0, 32.0],
    'Asia Minor': [32.8597, 39.9334],
    'Far East': [100.0, 35.0],
    'New World': [-80.0, 40.0],
    'Silk Road': [80.0, 40.0],
    'Red Sea': [36.0, 20.0],
    'Black Sea': [34.0, 43.0],
    'Caspian Sea': [50.0, 42.0],
    'Persian Gulf': [52.0, 27.0],
    'American Heartland': [-98.5795, 39.8283],
    'The Great Lakes': [-84.5068, 44.2513],
    'Great Plains': [-100.0000, 40.0000],
    'Rocky Mountains': [-106.0000, 42.0000],
    'Appalachian Mountains': [-80.0000, 38.0000],
    'Atlantic Ocean': [-30.0000, 40.0000],
    'Pacific Ocean': [-150.0000, 25.0000],
    'Indian Ocean': [75.0000, 0.0000]
  };
  
  const features = [];
  
  // Create features for historical locations
  locations.forEach(location => {
    let coordinates = null;
    let matchedName = null;
    
    // Try exact match first
    if (historicalLocations[location.name]) {
      coordinates = historicalLocations[location.name];
      matchedName = location.name;
    } else {
      // Try fuzzy matching
      for (const [knownLocation, coords] of Object.entries(historicalLocations)) {
        if (location.name.includes(knownLocation) || knownLocation.includes(location.name)) {
          coordinates = coords;
          matchedName = knownLocation;
          break;
        }
      }
    }
    
    if (coordinates) {
      console.log(`Using predefined coordinates for ${location.name} (matched to ${matchedName})`);
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        properties: {
          title: location.name,
          description: createEnhancedPopupHTML(location),
          timeContext: location.timeContext || '',
          historicalContext: location.historicalContext || '',
          descriptiveContext: location.descriptiveContext || '',
          relationshipContext: location.relationshipContext || '',
          originalIndex: location.originalIndex || 0
        }
      });
    }
  });
  
  return features;
}

/**
 * Visualize locations as a standard route
 * @param {Array} features - Array of GeoJSON features
 * @param {string} travelMode - Mode of transportation 
 * @param {Array} preferences - Route preferences
 * @param {Object} map - Mapbox map instance
 * @param {Function} displayMessage - Function to display messages
 */
function visualizeAsRoute(features, travelMode, preferences, map, displayMessage) {
  if (features.length < 2) {
    displayMessage('Need at least two locations to visualize a route.');
    fitMapToFeatures(map, features);
    return;
  }
  
  // Display loading message
  displayMessage('<div style="text-align: center; padding: 20px;"><p>Calculating route...</p><div class="loading-spinner"></div></div>');
  
  // Extract coordinates for route calculation
  const coordinates = features.map(feature => feature.geometry.coordinates);
  const validMode = ['driving', 'walking', 'cycling', 'transit'].includes(travelMode) ? travelMode : 'driving';
  
  // Build options for the directions request
  const requestOptions = {
    coordinates: coordinates,
    profile: validMode,
    annotations: ['duration', 'distance'],
    geometries: 'geojson',
    overview: 'full'
  };
  
  // Extract preferences from input
  const hasAvoidHighways = preferences.some(pref => 
    typeof pref === 'string' && pref.toLowerCase().includes('highway') && 
    (pref.toLowerCase().includes('avoid') || pref.toLowerCase().includes('no')));
    
  const hasAvoidTolls = preferences.some(pref => 
    typeof pref === 'string' && pref.toLowerCase().includes('toll') && 
    (pref.toLowerCase().includes('avoid') || pref.toLowerCase().includes('no')));
    
  const hasAvoidFerries = preferences.some(pref => 
    typeof pref === 'string' && pref.toLowerCase().includes('ferr') && 
    (pref.toLowerCase().includes('avoid') || pref.toLowerCase().includes('no')));
  
  // Add avoid preferences if specified
  if (hasAvoidHighways || hasAvoidTolls || hasAvoidFerries) {
    requestOptions.exclude = [];
    if (hasAvoidHighways) requestOptions.exclude.push('motorway');
    if (hasAvoidTolls) requestOptions.exclude.push('toll');
    if (hasAvoidFerries) requestOptions.exclude.push('ferry');
  }
  
  // Define API_URL based on environment
  const API_URL = window.location.hostname === 'localhost' ? '' : window.location.origin;
  
  // Request directions via API
  fetch(`${API_URL}/api/mapbox-directions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestOptions)
  })
  .then(response => {
    if (!response.ok) throw new Error('Directions API error');
    return response.json();
  })
  .then(data => {
    // Determine which response format we have - could be either:
    // 1. Original Mapbox format: data.routes[0]
    // 2. Our custom format: data.route
    let route;
    if (data.routes && data.routes.length > 0) {
      console.log('Using routes array response format');
      route = data.routes[0];
    } else if (data.route) {
      console.log('Using route object response format');
      route = data.route;
    } else {
      console.error('No valid route data found in response:', data);
      throw new Error('No valid route data in API response');
    }
    
    if (route && route.geometry) {
      // Display route on map
      map.getSource('route').setData({
        type: 'Feature',
        geometry: route.geometry
      });
      
      // Calculate route stats
      const routeDistance = (route.distance / 1000).toFixed(1); // km
      const routeDuration = Math.round(route.duration / 60); // minutes
      
      // Build a message about via points for multi-point routes
      let viaPointsMessage = '';
      if (features.length > 2) {
        const viaPoints = features.slice(1, -1).map(f => f.properties.title);
        viaPointsMessage = `<p><strong>Via:</strong> ${viaPoints.join(', ')}</p>`;
      }
      
      // Format preferences for display
      const preferencesMessage = preferences && preferences.length > 0 ? 
        `<p><strong>Preferences:</strong> ${preferences.join(', ')}</p>` : '';
      
      // Display route information
      displayMessage(`
        <h3>Route Visualization</h3>
        <p><strong>From:</strong> ${features[0].properties.title} <strong>To:</strong> ${features[features.length-1].properties.title}</p>
        ${viaPointsMessage}
        <p><strong>Distance:</strong> ${routeDistance} km</p>
        <p><strong>Duration:</strong> ${routeDuration} min by ${validMode}</p>
        ${preferencesMessage}
      `);
      
      // Fit map to route
      fitMapToRoute(map, route.geometry.coordinates);
    } else {
      displayMessage('Could not calculate a valid route between these locations.');
      fitMapToFeatures(map, features);
    }
  })
  .catch(error => {
    console.error('Error creating route:', error);
    displayMessage(`
      <h3>Route Not Available</h3>
      <p>Couldn't find a valid ${validMode} route between these locations. This may be because:</p>
      <ul>
        <li>The locations are not accessible by ${validMode} transportation</li>
        <li>The locations are separated by water or other impassable terrain</li>
        <li>The routing service doesn't have data for this area</li>
      </ul>
      <p>I've displayed the locations on the map, but cannot show a route between them.</p>
    `);
    
    // Show points even if route can't be calculated
    fitMapToFeatures(map, features);
    
    // Clear any existing route
    try {
      map.getSource('route').setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: []
        }
      });
    } catch (e) {
      console.error('Error clearing route:', e);
    }
  });
}

/**
 * Visualize locations as a geographical region/scope
 * @param {Array} features - Array of GeoJSON features
 * @param {Object} map - Mapbox map instance
 * @param {string} thematicContext - Optional thematic context
 * @param {Function} displayMessage - Function to display messages
 */
function visualizeAsRegion(features, map, thematicContext, displayMessage) {
  if (features.length < 3) {
    // Not enough points for polygon, just show points
    fitMapToFeatures(map, features);
    displayMessage(`Showing the geographical scope with ${features.length} locations${thematicContext ? ` related to ${thematicContext}` : ''}.`);
    return;
  }
  
  // Create a convex hull around the locations to show geographical scope
  const points = features.map(f => f.geometry.coordinates);
  const hull = calculateConvexHull(points);
  
  // Add buffer to create a more generous region
  const bufferedHull = bufferPolygon(hull, 0.5); // 0.5 degree buffer
  
  // Create or update region polygon
  try {
    // Check if region source exists
    if (!map.getSource('region')) {
      // Create new source and layers
      map.addSource('region', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [bufferedHull]
          }
        }
      });
      
      map.addLayer({
        id: 'region-fill',
        type: 'fill',
        source: 'region',
        layout: {},
        paint: {
          'fill-color': '#3bb2d0',
          'fill-opacity': 0.2
        }
      });
      
      map.addLayer({
        id: 'region-outline',
        type: 'line',
        source: 'region',
        layout: {},
        paint: {
          'line-color': '#3bb2d0',
          'line-width': 2
        }
      });
    } else {
      // Update existing region
      map.getSource('region').setData({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [bufferedHull]
        }
      });
    }
  } catch (error) {
    console.error('Error creating region visualization:', error);
  }
  
  // Fit map to show the region
  const bounds = new mapboxgl.LngLatBounds();
  bufferedHull.forEach(coord => bounds.extend(coord));
  map.fitBounds(bounds, { padding: 50 });
  
  // Display information about the geographical scope
  const locationNames = features.map(f => f.properties.title).join(', ');
  displayMessage(`
    <h3>Geographical Scope${thematicContext ? `: ${thematicContext}` : ''}</h3>
    <p>This visualization shows the region encompassing: ${locationNames}</p>
    <p>The highlighted area represents the approximate geographical scope mentioned in the text.</p>
  `);
}

/**
 * Visualize locations as a chronological timeline/sequence
 * @param {Array} features - Array of GeoJSON features
 * @param {Object} map - Mapbox map instance
 * @param {Function} displayMessage - Function to display messages
 */
function visualizeAsTimeline(features, map, displayMessage) {
  // Sort features chronologically if they have time context
  const featuresWithTime = features.filter(f => f.properties.timeContext);
  
  if (featuresWithTime.length < 2) {
    // Not enough time data, just show sequence
    visualizeAsSequence(features, null, map, displayMessage);
    return;
  }
  
  // Sort chronologically
  featuresWithTime.sort((a, b) => {
    const timeA = parseTimeContext(a.properties.timeContext);
    const timeB = parseTimeContext(b.properties.timeContext);
    return timeA - timeB;
  });
  
  // Create a sequential path connecting the chronological points
  const coordinateSequence = featuresWithTime.map(f => f.geometry.coordinates);
  
  // Update the route source to show the chronological path
  try {
    map.getSource('route').setData({
      type: 'Feature',
      properties: {
        isChronological: true
      },
      geometry: {
        type: 'LineString',
        coordinates: coordinateSequence
      }
    });
    
    // Set specific styling for chronological path
    map.setPaintProperty('route', 'line-color', '#fbb03b'); // Use orange for chronological paths
    map.setPaintProperty('route', 'line-dasharray', [2, 1]); // Dashed line for chronological
  } catch (error) {
    console.error('Error creating timeline visualization:', error);
  }
  
  // Fit map to timeline
  fitMapToFeatures(map, featuresWithTime);
  
  // Display timeline information
  const timelinePoints = featuresWithTime.map(f => 
    `${f.properties.title} (${f.properties.timeContext})`
  ).join(' → ');
  
  displayMessage(`
    <h3>Chronological Sequence</h3>
    <p>Locations shown in time order: ${timelinePoints}</p>
    <p>The orange dashed line connects locations in chronological sequence.</p>
  `);
}

/**
 * Visualize locations with historical context
 * @param {Array} features - Array of GeoJSON features
 * @param {Object} map - Mapbox map instance
 * @param {Function} displayMessage - Function to display messages
 */
function visualizeWithHistoricalContext(features, map, displayMessage) {
  // Similar to sequence but with enhanced historical information
  visualizeAsSequence(features, null, map, displayMessage);
  
  // Get periods represented in the data
  const periods = new Set();
  features.forEach(f => {
    if (f.properties.timeContext) {
      periods.add(f.properties.timeContext);
    }
  });
  
  // Create historical context message
  let historicalMessage = `<h3>Historical Context Visualization</h3>`;
  
  if (periods.size > 0) {
    historicalMessage += `<p>Historical periods represented: ${Array.from(periods).join(', ')}</p>`;
  }
  
  historicalMessage += `<p>Explore each location marker for specific historical context.</p>`;
  historicalMessage += `<p>The visualization shows ${features.length} locations with their historical significance.</p>`;
  
  displayMessage(historicalMessage);
}

/**
 * Visualize locations as a sequence (textual or custom order)
 * @param {Array} features - Array of GeoJSON features
 * @param {Array} suggestedSequence - Suggested order of location names
 * @param {Object} map - Mapbox map instance
 * @param {Function} displayMessage - Function to display messages
 */
function visualizeAsSequence(features, suggestedSequence, map, displayMessage) {
  // If we have a suggested sequence and it doesn't match current order
  if (suggestedSequence && suggestedSequence.length > 0) {
    // Reorder features based on suggested sequence
    const reorderedFeatures = [];
    
    for (const locationName of suggestedSequence) {
      const feature = features.find(f => f.properties.title === locationName);
      if (feature) {
        reorderedFeatures.push(feature);
      }
    }
    
    // Add any features not in suggested sequence at the end
    features.forEach(feature => {
      if (!suggestedSequence.includes(feature.properties.title)) {
        reorderedFeatures.push(feature);
      }
    });
    
    // Use reordered features if we found matches
    if (reorderedFeatures.length > 0) {
      features = reorderedFeatures;
    }
  }
  
  // Create line connecting points in sequence
  if (features.length >= 2) {
    const coordinates = features.map(f => f.geometry.coordinates);
    
    try {
      map.getSource('route').setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      });
      
      // Set specific styling for sequence line
      map.setPaintProperty('route', 'line-color', '#33aa33'); // Green for sequences
      map.setPaintProperty('route', 'line-dasharray', [1, 0]); // Solid line
    } catch (error) {
      console.error('Error creating sequence visualization:', error);
    }
  }
  
  // Fit map to show all features
  fitMapToFeatures(map, features);
  
  // Display message about the sequence
  const sequenceList = features.map(f => f.properties.title).join(' → ');
  displayMessage(`
    <h3>Location Sequence</h3>
    <p>Locations shown in sequence: ${sequenceList}</p>
    <p>Green lines connect locations in the order they appear in the text or suggested visualization.</p>
  `);
}

/**
 * Fit map to show all features
 * @param {Object} map - Mapbox map instance
 * @param {Array} features - Array of GeoJSON features
 */
function fitMapToFeatures(map, features) {
  if (!features || features.length === 0) return;
  
  const bounds = new mapboxgl.LngLatBounds();
  features.forEach(feature => {
    bounds.extend(feature.geometry.coordinates);
  });
  
  map.fitBounds(bounds, {
    padding: 50
  });
}

/**
 * Fit map to route coordinates
 * @param {Object} map - Mapbox map instance
 * @param {Array} coordinates - Array of route coordinates
 */
function fitMapToRoute(map, coordinates) {
  if (!coordinates || coordinates.length === 0) return;
  
  const bounds = new mapboxgl.LngLatBounds();
  coordinates.forEach(coord => {
    bounds.extend(coord);
  });
  
  map.fitBounds(bounds, {
    padding: 50
  });
}

/**
 * Parse time context string to numeric value for sorting
 * @param {string} timeContext - Time context string (e.g., "1453", "2nd century", "100 BCE")
 * @returns {number} - Numeric value for sorting
 */
function parseTimeContext(timeContext) {
  if (!timeContext) return 0;
  
  // Clean and normalize the string
  const tc = timeContext.toLowerCase().trim();
  
  // Handle year numbers
  const yearMatch = tc.match(/(\d+)\s*(bce|bc|ce|ad)?/i);
  if (yearMatch) {
    const year = parseInt(yearMatch[1]);
    const era = (yearMatch[2] || '').toLowerCase();
    return era === 'bce' || era === 'bc' ? -year : year;
  }
  
  // Handle centuries
  const centuryMatch = tc.match(/(\d+)(?:st|nd|rd|th)?\s*century(?:\s*(bce|bc|ce|ad)?)?/i);
  if (centuryMatch) {
    const century = parseInt(centuryMatch[1]);
    const era = (centuryMatch[2] || '').toLowerCase();
    // Convert century to approximate mid-point year
    const year = (century - 1) * 100 + 50; // mid-point of century
    return era === 'bce' || era === 'bc' ? -year : year;
  }
  
  // Default sorting for unknown formats
  return 0;
}

/**
 * Calculate simple convex hull for points
 * @param {Array} points - Array of [lng, lat] coordinates
 * @returns {Array} - Array of coordinates forming convex hull
 */
function calculateConvexHull(points) {
  // Simple implementation - more advanced libraries would be better for production
  if (points.length <= 3) {
    return points;
  }
  
  // Find point with lowest y-coordinate (and leftmost if tied)
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i][1] < points[start][1] || 
        (points[i][1] === points[start][1] && points[i][0] < points[start][0])) {
      start = i;
    }
  }
  
  // Swap start point to first position
  [points[0], points[start]] = [points[start], points[0]];
  
  // Sort points by polar angle with respect to start point
  const startPoint = points[0];
  const sortedPoints = points.slice(1).sort((a, b) => {
    const angleA = Math.atan2(a[1] - startPoint[1], a[0] - startPoint[0]);
    const angleB = Math.atan2(b[1] - startPoint[1], b[0] - startPoint[0]);
    return angleA - angleB;
  });
  
  // Add start point back
  sortedPoints.unshift(startPoint);
  
  // Graham scan algorithm
  const hull = [sortedPoints[0], sortedPoints[1]];
  
  for (let i = 2; i < sortedPoints.length; i++) {
    while (hull.length >= 2 && !isLeftTurn(hull[hull.length - 2], hull[hull.length - 1], sortedPoints[i])) {
      hull.pop();
    }
    hull.push(sortedPoints[i]);
  }
  
  return hull;
}

/**
 * Check if three points make a left turn
 * @param {Array} p1 - First point [lng, lat]
 * @param {Array} p2 - Second point [lng, lat]
 * @param {Array} p3 - Third point [lng, lat]
 * @returns {boolean} - True if the points make a left turn
 */
function isLeftTurn(p1, p2, p3) {
  // Cross product to determine if points make a left turn
  return (p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]) > 0;
}

/**
 * Add buffer to polygon to create a more generous region
 * @param {Array} points - Array of [lng, lat] coordinates forming polygon
 * @param {number} bufferSize - Buffer size in degrees
 * @returns {Array} - Array of buffered coordinates
 */
function bufferPolygon(points, bufferSize) {
  if (!points || points.length < 3) return points;
  
  // Find center of points
  let sumLng = 0, sumLat = 0;
  points.forEach(point => {
    sumLng += point[0];
    sumLat += point[1];
  });
  
  const centerLng = sumLng / points.length;
  const centerLat = sumLat / points.length;
  
  // Create buffered polygon by moving points outward from center
  return points.map(point => {
    const distLng = point[0] - centerLng;
    const distLat = point[1] - centerLat;
    const dist = Math.sqrt(distLng * distLng + distLat * distLat);
    
    if (dist === 0) return point; // Avoid division by zero
    
    // Add buffer, scaling by distance from center
    const bufferFactor = bufferSize / dist;
    return [
      point[0] + distLng * bufferFactor,
      point[1] + distLat * bufferFactor
    ];
  });
} 