# Enhanced NLP Module with Advanced Visualization

This project provides an improved natural language processing (NLP) module for map visualization, with support for multiple intent types and visualization modes. The enhanced module can understand a wider range of user inputs, extract locations from complex texts, handle routing requests with multiple waypoints, and provide different visualization types for geographic data.

## Components

- **enhanced-nlp-improved.js**: The core NLP module with improved location extraction and intent recognition.
- **visualization-integration.js**: Integration module providing various visualization types (heatmap, timeline, clusters, animation).
- **integration-example.js**: Example implementation showing how to integrate the NLP module with visualizations.
- **nlp-demo.html**: Demo page to test the enhanced NLP capabilities.

## Features

### Enhanced NLP Capabilities

- **Multiple Intent Types**: Recognizes different types of user intents:
  - **Route**: Creating routes between locations
  - **Location**: Displaying locations mentioned in text
  - **Visualization**: Specific visualization requests
  - **Query**: Questions about locations

- **Advanced Location Extraction**:
  - Extracts locations from complex texts like paragraphs or historical descriptions
  - Identifies time contexts associated with locations
  - Handles multi-word and compound locations
  - Recognizes location names in various formats

- **Improved Route Processing**:
  - Supports multi-waypoint routes
  - Recognizes travel modes (walking, cycling, driving)
  - Extracts route preferences (avoid highways, scenic route, etc.)

- **Fallback to Gemini API**: For complex inputs that can't be processed by the built-in rules

### Visualization Types

- **Default**: Standard markers on a map
- **Heatmap**: Density visualization of locations
- **Timeline**: Chronological visualization of locations with time contexts
- **Clusters**: Grouped visualization for many locations
- **Animation**: Animated display of locations

## How to Use

### 1. Including the Modules

```javascript
// Import the NLP module
import { processNaturalLanguageInput } from './enhanced-nlp-improved.js';

// Import visualization functions
import { applyVisualization } from './visualization-integration.js';
```

### 2. Processing User Input

```javascript
// Process natural language input
const result = await processNaturalLanguageInput("Show me a route from New York to Los Angeles");

// The result will contain:
// - intentType: "route", "location", "visualization", or "query"
// - locations: Array of extracted locations with time contexts
// - visualizationType: "default", "heatmap", "timeline", "cluster", or "animation"
// - travelMode: "driving", "walking", or "cycling"
// - preferences: Array of route preferences
// - message: User-friendly message
// - suggestedSequence: Suggested sequence for displaying locations
```

### 3. Applying Visualization

```javascript
// Apply visualization to a Mapbox map instance based on processed result
await applyVisualization(result, mapInstance);
```

## Example Queries

- **Simple Route**: "Show me a route from New York to Los Angeles"
- **Multi-waypoint Route**: "Route from New York to Chicago to Los Angeles"
- **Route with Preferences**: "Walking directions from Central Park to Times Square avoiding busy streets"
- **Visualization Request**: "Create a heatmap of major cities in Europe"
- **Timeline Visualization**: "Show the spread of the Roman Empire from 100 BCE to 100 CE as a timeline"
- **Complex Text**: "Gibbon's canvas is large geographically and chronologically. One expects a sharp focus on the Mediterranean, but Gibbon ranges from sub-Saharan Africa to China. And although he ostensibly covers the period from the Antonines in the second century after Christ until the final collapse of Constantinople in 1453, even this broad range does not contain our author."

## Running the Demo

1. Make sure you have a valid Mapbox API token
2. Open `nlp-demo.html` in your browser
3. Enter a query or select one of the example queries
4. Choose a visualization type from the dropdown
5. Click "Process" to see the results

## Integration with Existing Project

To integrate these modules with your existing project:

1. Copy the `enhanced-nlp-improved.js` and `visualization-integration.js` files to your project
2. Import the modules in your JavaScript file
3. Call `processNaturalLanguageInput()` with user input
4. Apply the visualization using `applyVisualization()`
5. Update your UI to display the results

## Dependencies

- Mapbox GL JS for map visualization
- A backend endpoint for Gemini API calls (for advanced processing)

## License

This project is licensed under the MIT License - see the LICENSE file for details. 