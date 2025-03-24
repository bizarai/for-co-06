/**
 * Visualization Test Script
 * 
 * This script provides functions to test the map visualization pipeline
 * independently of the NLP processing. It can be used to verify if the
 * visualization components are working correctly.
 */

// Sample test data for visualization
const testRoutes = {
    parisToLondon: {
        intentType: "route",
        locations: [
            { name: "Paris", coordinates: [2.3522, 48.8566] },
            { name: "London", coordinates: [-0.1278, 51.5074] }
        ],
        visualizationType: "default",
        travelMode: "driving",
        preferences: [],
        message: "Test route from Paris to London",
        suggestedSequence: ["Paris", "London"]
    },
    
    usaCities: {
        intentType: "route",
        locations: [
            { name: "New York", coordinates: [-74.0060, 40.7128] },
            { name: "Washington DC", coordinates: [-77.0369, 38.9072] },
            { name: "Chicago", coordinates: [-87.6298, 41.8781] },
            { name: "Los Angeles", coordinates: [-118.2437, 34.0522] }
        ],
        visualizationType: "default",
        travelMode: "driving",
        preferences: [],
        message: "Test route through major US cities",
        suggestedSequence: ["New York", "Washington DC", "Chicago", "Los Angeles"]
    },
    
    europeCapitals: {
        intentType: "locations",
        locations: [
            { name: "Paris", coordinates: [2.3522, 48.8566] },
            { name: "Berlin", coordinates: [13.4050, 52.5200] },
            { name: "Rome", coordinates: [12.4964, 41.9028] },
            { name: "Madrid", coordinates: [-3.7038, 40.4168] },
            { name: "London", coordinates: [-0.1278, 51.5074] }
        ],
        visualizationType: "default",
        travelMode: null,
        preferences: [],
        message: "Test showing European capitals",
        suggestedSequence: null
    }
};

/**
 * Initialize a test map
 * @param {string} containerId - The ID of the container element
 * @param {string} mapboxToken - The Mapbox access token
 * @returns {Promise<object>} The initialized map object
 */
export async function initTestMap(containerId, mapboxToken) {
    console.log("Initializing test map...");
    
    try {
        // Verify container exists
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Map container #${containerId} not found`);
        }
        
        // Verify Mapbox GL JS is available
        if (typeof mapboxgl === 'undefined') {
            throw new Error('Mapbox GL JS library not loaded');
        }
        
        // Set token and initialize map
        mapboxgl.accessToken = mapboxToken;
        const map = new mapboxgl.Map({
            container: containerId,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [0, 20],
            zoom: 2
        });
        
        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        // Wait for the map to load
        await new Promise((resolve, reject) => {
            map.on('load', resolve);
            map.on('error', e => reject(new Error(`Map error: ${e.error?.message || 'Unknown error'}`)));
            
            // Set a timeout in case the map never loads
            setTimeout(() => {
                if (!map.loaded()) {
                    reject(new Error('Map load timeout after 10 seconds'));
                }
            }, 10000);
        });
        
        console.log("Map loaded successfully");
        
        return map;
    } catch (error) {
        console.error("Map initialization error:", error);
        throw error;
    }
}

/**
 * Set up map sources and layers for visualization
 * @param {object} map - The Mapbox GL map object
 * @returns {Promise<void>}
 */
export async function setupMapSourcesAndLayers(map) {
    console.log("Setting up map sources and layers...");
    
    try {
        // Check if sources already exist and remove them if they do
        try {
            if (map.getSource('locations')) {
                map.removeLayer('locations-layer');
                map.removeSource('locations');
            }
            
            if (map.getSource('route')) {
                map.removeLayer('route-layer');
                map.removeSource('route');
            }
        } catch (e) {
            // Ignore errors if sources don't exist
        }
        
        // Add sources for locations and routes
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
        
        // Add layers
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
        
        // Add click events for locations
        map.on('click', 'locations-layer', (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const name = e.features[0].properties.name || 'Unknown location';
            
            // Create popup
            new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(`<h3>${name}</h3>`)
                .addTo(map);
        });
        
        // Change cursor on hover
        map.on('mouseenter', 'locations-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        
        map.on('mouseleave', 'locations-layer', () => {
            map.getCanvas().style.cursor = '';
        });
        
        console.log("Map sources and layers set up successfully");
    } catch (error) {
        console.error("Error setting up map sources and layers:", error);
        throw error;
    }
}

/**
 * Visualize locations on the map
 * @param {object} map - The Mapbox GL map object
 * @param {Array} locations - Array of location objects with name and coordinates
 * @returns {Promise<void>}
 */
export async function visualizeLocations(map, locations) {
    console.log("Visualizing locations:", locations);
    
    try {
        if (!map || !map.loaded()) {
            throw new Error("Map not initialized or not loaded");
        }
        
        if (!locations || !Array.isArray(locations) || locations.length === 0) {
            throw new Error("No valid locations provided");
        }
        
        // Create GeoJSON features for locations
        const features = locations.map(location => {
            if (!location.coordinates) {
                console.warn(`Location ${location.name} missing coordinates, will be geocoded`);
                return null;
            }
            
            return {
                type: 'Feature',
                properties: {
                    name: location.name
                },
                geometry: {
                    type: 'Point',
                    coordinates: location.coordinates
                }
            };
        }).filter(feature => feature !== null);
        
        // Update the locations source
        const source = map.getSource('locations');
        if (!source) {
            throw new Error("Locations source not found");
        }
        
        source.setData({
            type: 'FeatureCollection',
            features: features
        });
        
        // Clear any existing route
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
        
        // Fit the map to show all locations
        if (features.length > 0) {
            const coordinates = features.map(feature => feature.geometry.coordinates);
            const bounds = coordinates.reduce((bounds, coord) => {
                return bounds.extend(coord);
            }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));
            
            map.fitBounds(bounds, {
                padding: 50,
                maxZoom: 12
            });
        }
        
        console.log("Locations visualized successfully");
    } catch (error) {
        console.error("Error visualizing locations:", error);
        throw error;
    }
}

/**
 * Visualize a route on the map
 * @param {object} map - The Mapbox GL map object
 * @param {Array} locations - Array of location objects with name and coordinates
 * @returns {Promise<void>}
 */
export async function visualizeRoute(map, locations) {
    console.log("Visualizing route:", locations);
    
    try {
        if (!map || !map.loaded()) {
            throw new Error("Map not initialized or not loaded");
        }
        
        if (!locations || !Array.isArray(locations) || locations.length < 2) {
            throw new Error("At least two valid locations are required for a route");
        }
        
        // Extract coordinates and ensure they exist
        const coordinates = locations.map(location => {
            if (!location.coordinates) {
                console.warn(`Location ${location.name} missing coordinates`);
                return null;
            }
            return location.coordinates;
        }).filter(coords => coords !== null);
        
        if (coordinates.length < 2) {
            throw new Error("Not enough valid coordinates for a route");
        }
        
        // Update the route source
        const routeSource = map.getSource('route');
        if (!routeSource) {
            throw new Error("Route source not found");
        }
        
        routeSource.setData({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: coordinates
            }
        });
        
        // Also visualize the locations
        await visualizeLocations(map, locations);
        
        console.log("Route visualized successfully");
    } catch (error) {
        console.error("Error visualizing route:", error);
        throw error;
    }
}

/**
 * Direct test of visualization system
 * @param {object} map - The Mapbox GL map object
 * @param {string} testName - The name of the test route to visualize
 * @returns {Promise<void>}
 */
export async function runVisualizationTest(map, testName) {
    console.log(`Running visualization test: ${testName}`);
    
    try {
        if (!map || !map.loaded()) {
            throw new Error("Map not initialized or not loaded");
        }
        
        const testData = testRoutes[testName];
        if (!testData) {
            throw new Error(`Test data for "${testName}" not found`);
        }
        
        // Ensure sources and layers are set up
        await setupMapSourcesAndLayers(map);
        
        // Apply visualization based on intent type
        if (testData.intentType === "route") {
            await visualizeRoute(map, testData.locations);
        } else {
            await visualizeLocations(map, testData.locations);
        }
        
        console.log(`Test "${testName}" completed successfully`);
        return testData;
    } catch (error) {
        console.error(`Error in test "${testName}":`, error);
        throw error;
    }
}

/**
 * Get a simplified version of the applyVisualization function for testing
 * @param {object} map - The Mapbox GL map object
 * @returns {Function} A simplified visualization function
 */
export function getTestVisualizer(map) {
    return async function testVisualizer(result) {
        console.log("Test visualizer called with:", result);
        
        try {
            if (!map || !map.loaded()) {
                throw new Error("Map not initialized or not loaded");
            }
            
            // Ensure sources and layers are set up
            await setupMapSourcesAndLayers(map);
            
            // First, geocode any locations without coordinates
            const locationsWithCoordinates = await Promise.all(result.locations.map(async (location) => {
                if (!location.coordinates) {
                    // For testing purposes, we'll use a simple lookup
                    const knownLocations = {
                        "paris": [2.3522, 48.8566],
                        "london": [-0.1278, 51.5074],
                        "new york": [-74.0060, 40.7128],
                        "los angeles": [-118.2437, 34.0522],
                        "berlin": [13.4050, 52.5200],
                        "rome": [12.4964, 41.9028],
                        "madrid": [-3.7038, 40.4168],
                        "washington dc": [-77.0369, 38.9072],
                        "chicago": [-87.6298, 41.8781]
                    };
                    
                    const key = location.name.toLowerCase();
                    if (knownLocations[key]) {
                        return {
                            ...location,
                            coordinates: knownLocations[key]
                        };
                    } else {
                        console.warn(`No coordinates found for ${location.name}`);
                        // Use a default coordinate for testing
                        return {
                            ...location,
                            coordinates: [0, 0]
                        };
                    }
                }
                return location;
            }));
            
            // Apply visualization based on intent type
            if (result.intentType === "route") {
                await visualizeRoute(map, locationsWithCoordinates);
            } else {
                await visualizeLocations(map, locationsWithCoordinates);
            }
            
            return { success: true, message: "Visualization applied" };
        } catch (error) {
            console.error("Test visualizer error:", error);
            return { success: false, message: error.message };
        }
    };
}

/**
 * Create a debug report with visualization system information
 * @param {object} map - The Mapbox GL map object
 * @returns {string} HTML string with debug information
 */
export function createVisualizationDebugReport(map) {
    const report = [];
    
    try {
        // Check map status
        const mapStatus = map ? (map.loaded ? map.loaded() : false) : false;
        report.push(`<h4>Map Status</h4>`);
        report.push(`<div>Map object: ${map ? '✓' : '✗'}</div>`);
        report.push(`<div>Map loaded: ${mapStatus ? '✓' : '✗'}</div>`);
        
        if (map) {
            // Check token status
            report.push(`<h4>Mapbox Token</h4>`);
            report.push(`<div>Token set: ${mapboxgl.accessToken ? '✓' : '✗'}</div>`);
            
            // Check sources
            report.push(`<h4>Map Sources</h4>`);
            let locationsSource = false;
            let routeSource = false;
            
            try {
                locationsSource = !!map.getSource('locations');
            } catch (e) {
                // Source doesn't exist
            }
            
            try {
                routeSource = !!map.getSource('route');
            } catch (e) {
                // Source doesn't exist
            }
            
            report.push(`<div>Locations source: ${locationsSource ? '✓' : '✗'}</div>`);
            report.push(`<div>Route source: ${routeSource ? '✓' : '✗'}</div>`);
            
            // Check layers
            report.push(`<h4>Map Layers</h4>`);
            let locationsLayer = false;
            let routeLayer = false;
            
            try {
                locationsLayer = !!map.getLayer('locations-layer');
            } catch (e) {
                // Layer doesn't exist
            }
            
            try {
                routeLayer = !!map.getLayer('route-layer');
            } catch (e) {
                // Layer doesn't exist
            }
            
            report.push(`<div>Locations layer: ${locationsLayer ? '✓' : '✗'}</div>`);
            report.push(`<div>Route layer: ${routeLayer ? '✓' : '✗'}</div>`);
            
            // Map style information
            report.push(`<h4>Map Style</h4>`);
            const style = map.getStyle ? map.getStyle() : null;
            report.push(`<div>Style loaded: ${style ? '✓' : '✗'}</div>`);
            if (style) {
                report.push(`<div>Style name: ${style.name || 'Unknown'}</div>`);
                report.push(`<div>Style sources: ${Object.keys(style.sources || {}).length}</div>`);
                report.push(`<div>Style layers: ${(style.layers || []).length}</div>`);
            }
        }
    } catch (error) {
        report.push(`<div class="error">Error creating debug report: ${error.message}</div>`);
    }
    
    return report.join('');
} 