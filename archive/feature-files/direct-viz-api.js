/**
 * Direct Visualization API Client
 * 
 * This module provides functions to directly test the server's geocoding
 * and visualization APIs without going through the NLP processing flow.
 */

/**
 * Directly geocode a location name using the server's API
 * @param {string} locationName - The name of the location to geocode
 * @returns {Promise<object>} - The geocoded location with coordinates
 */
export async function geocodeLocation(locationName) {
    console.log(`Geocoding location: "${locationName}"...`);
    
    try {
        const response = await fetch(`/api/geocode?location=${encodeURIComponent(locationName)}`);
        
        if (!response.ok) {
            throw new Error(`Geocoding failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`Geocoding result for "${locationName}":`, data);
        
        return data;
    } catch (error) {
        console.error(`Geocoding error for "${locationName}":`, error);
        throw error;
    }
}

/**
 * Directly get route data between two locations using the server's API
 * @param {Array} locations - Array of location objects with coordinates
 * @param {string} mode - The travel mode (driving, walking, cycling, etc.)
 * @returns {Promise<object>} - The route data
 */
export async function getRoute(locations, mode = 'driving') {
    if (!locations || locations.length < 2) {
        throw new Error('At least two locations are required for routing');
    }
    
    const start = locations[0];
    const end = locations[locations.length - 1];
    let waypoints = [];
    
    if (locations.length > 2) {
        waypoints = locations.slice(1, -1);
    }
    
    console.log(`Getting route from ${start.name} to ${end.name} with mode: ${mode}...`);
    
    try {
        // Prepare coordinates for the API
        const startCoords = start.coordinates.join(',');
        const endCoords = end.coordinates.join(',');
        const waypointCoords = waypoints.map(wp => wp.coordinates.join(',')).join(';');
        
        const url = new URL('/api/route', window.location.origin);
        url.searchParams.append('start', startCoords);
        url.searchParams.append('end', endCoords);
        
        if (waypointCoords) {
            url.searchParams.append('waypoints', waypointCoords);
        }
        
        url.searchParams.append('mode', mode);
        
        const response = await fetch(url.toString());
        
        if (!response.ok) {
            throw new Error(`Routing failed: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Route data:', data);
        
        return data;
    } catch (error) {
        console.error('Routing error:', error);
        throw error;
    }
}

/**
 * Create a synthetic test result that matches the format expected by applyVisualization
 * @param {string} intentType - The type of intent (route or locations)
 * @param {Array} locations - Array of location objects with names
 * @param {string} visualizationType - The type of visualization to apply
 * @param {string} travelMode - The travel mode for routes
 * @returns {Promise<object>} - A synthetic result object ready for visualization
 */
export async function createTestResult(intentType, locations, visualizationType = 'default', travelMode = 'driving') {
    console.log(`Creating test result with intent: ${intentType}, locations: ${locations.map(l => l.name).join(', ')}...`);
    
    try {
        // Geocode any locations without coordinates
        const geocodedLocations = await Promise.all(locations.map(async (location) => {
            if (!location.coordinates) {
                const geocoded = await geocodeLocation(location.name);
                return {
                    ...location,
                    coordinates: [geocoded.longitude, geocoded.latitude]
                };
            }
            return location;
        }));
        
        // Create the result object
        const result = {
            intentType,
            locations: geocodedLocations,
            visualizationType,
            travelMode: intentType === 'route' ? travelMode : null,
            preferences: [],
            message: intentType === 'route' 
                ? `Test route with ${geocodedLocations.length} locations` 
                : `Test showing ${geocodedLocations.length} locations`,
            suggestedSequence: intentType === 'route' 
                ? geocodedLocations.map(loc => loc.name) 
                : null
        };
        
        // For routes, fetch the actual route data
        if (intentType === 'route' && geocodedLocations.length >= 2) {
            try {
                const routeData = await getRoute(geocodedLocations, travelMode);
                result.routeData = routeData;
            } catch (error) {
                console.warn('Could not get route data, will use direct lines:', error);
            }
        }
        
        console.log('Created test result:', result);
        return result;
    } catch (error) {
        console.error('Error creating test result:', error);
        throw error;
    }
}

/**
 * Test the visualization pipeline with direct input
 * @param {Function} applyVisualization - The visualization function to test
 * @param {object} map - The map object
 * @param {Array} locationNames - Array of location names to visualize
 * @param {string} intentType - The type of intent (route or locations)
 * @param {string} visualizationType - The type of visualization
 * @param {string} travelMode - The travel mode for routes
 * @returns {Promise<object>} - The result of the visualization
 */
export async function testVisualizationWithLocations(
    applyVisualization,
    map,
    locationNames,
    intentType = 'locations',
    visualizationType = 'default',
    travelMode = 'driving'
) {
    console.log(`Testing visualization with locations: ${locationNames.join(', ')}...`);
    
    try {
        // Create location objects from names
        const locations = locationNames.map(name => ({ name, timeContext: '' }));
        
        // Create a test result
        const result = await createTestResult(intentType, locations, visualizationType, travelMode);
        
        // Apply visualization
        console.log('Applying visualization...');
        const vizResult = await applyVisualization(result, map);
        console.log('Visualization applied:', vizResult);
        
        return {
            success: true,
            data: result,
            visualization: vizResult
        };
    } catch (error) {
        console.error('Visualization test error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Test the entire visualization pipeline by creating a route from text
 * @param {object} dependencies - Object containing necessary functions (processNLPInput, applyVisualization)
 * @param {object} map - The map object
 * @param {string} input - The text input (e.g., "Route from Paris to London")
 * @returns {Promise<object>} - The result of the test
 */
export async function testEntirePipeline(dependencies, map, input) {
    console.log(`Testing entire pipeline with input: "${input}"...`);
    
    const { processNaturalLanguageInput, applyVisualization } = dependencies;
    
    if (!processNaturalLanguageInput || !applyVisualization) {
        throw new Error('Required functions not provided');
    }
    
    try {
        // Process the natural language input
        console.log('Processing natural language input...');
        const result = await processNaturalLanguageInput(input);
        console.log('NLP result:', result);
        
        // Apply visualization
        console.log('Applying visualization...');
        const vizResult = await applyVisualization(result, map);
        console.log('Visualization applied:', vizResult);
        
        return {
            success: true,
            nlpResult: result,
            visualizationResult: vizResult
        };
    } catch (error) {
        console.error('Pipeline test error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Get presets for common test cases
 * @returns {Array} - Array of preset test cases
 */
export function getTestPresets() {
    return [
        {
            name: 'Paris to London',
            type: 'route',
            locations: ['Paris', 'London'],
            travelMode: 'driving',
            visualizationType: 'default'
        },
        {
            name: 'European Capitals',
            type: 'locations',
            locations: ['Paris', 'Berlin', 'Rome', 'Madrid', 'London'],
            visualizationType: 'default'
        },
        {
            name: 'US Road Trip',
            type: 'route',
            locations: ['New York', 'Washington DC', 'Chicago', 'Denver', 'Las Vegas', 'Los Angeles'],
            travelMode: 'driving',
            visualizationType: 'terrain'
        },
        {
            name: 'Tokyo to Kyoto',
            type: 'route',
            locations: ['Tokyo', 'Kyoto'],
            travelMode: 'driving',
            visualizationType: 'satellite'
        },
        {
            name: 'Global Cities',
            type: 'locations',
            locations: ['New York', 'London', 'Tokyo', 'Sydney', 'Rio de Janeiro'],
            visualizationType: 'default'
        }
    ];
} 