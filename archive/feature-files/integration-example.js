/**
 * Example integration of enhanced-nlp-improved.js with the visualization module
 */

import { processNaturalLanguageInput } from './enhanced-nlp-improved.js';
import { applyVisualization } from './visualization-integration.js';

// Assuming we have a mapbox instance initialized
let map;

// Initialize Mapbox map
function initMap() {
  mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN';
  
  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-74.5, 40], // Default center
    zoom: 2
  });
  
  map.on('load', () => {
    console.log('Map initialized');
    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl());
  });
}

// Process user input and apply visualization
async function processUserInput(inputText) {
  try {
    // Show loading state
    document.getElementById('loading-indicator').style.display = 'block';
    
    // Process the input text using our enhanced NLP module
    const result = await processNaturalLanguageInput(inputText);
    
    // Display the result
    document.getElementById('result-message').textContent = result.message;
    
    // Create chips for locations
    const locationsContainer = document.getElementById('locations-container');
    locationsContainer.innerHTML = '';
    
    if (result.locations && result.locations.length > 0) {
      result.locations.forEach(location => {
        const chip = document.createElement('div');
        chip.className = 'location-chip';
        chip.textContent = location.name + (location.timeContext ? ` (${location.timeContext})` : '');
        locationsContainer.appendChild(chip);
      });
    }
    
    // Apply visualization to the map based on the processed result
    await applyVisualization(result, map);
    
    // Hide loading state
    document.getElementById('loading-indicator').style.display = 'none';
  } catch (error) {
    console.error('Error processing input:', error);
    document.getElementById('result-message').textContent = 'Error processing your request. Please try again.';
    document.getElementById('loading-indicator').style.display = 'none';
  }
}

// Event listener for the input form
document.getElementById('nlp-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const inputText = document.getElementById('nlp-input').value.trim();
  
  if (inputText) {
    await processUserInput(inputText);
  }
});

// Initialize the map when the page loads
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  
  // Add visualization type selector
  const vizSelector = document.getElementById('visualization-type');
  vizSelector.addEventListener('change', (event) => {
    const inputText = document.getElementById('nlp-input').value.trim();
    if (inputText) {
      // Append visualization type to the input if it's not already included
      const vizType = event.target.value;
      if (!inputText.toLowerCase().includes(vizType.toLowerCase())) {
        const enhancedInput = `${inputText} (visualize as ${vizType})`;
        document.getElementById('nlp-input').value = enhancedInput;
      }
      
      // Reprocess with the new visualization type
      processUserInput(document.getElementById('nlp-input').value);
    }
  });
  
  // Example queries for the user
  const exampleQueries = [
    "Show me a route from New York to Los Angeles",
    "Walking directions from Central Park to Times Square",
    "Create a heatmap of major cities in Europe",
    "Show the spread of the Roman Empire from 100 BCE to 100 CE as a timeline",
    "Gibbon's canvas is large geographically and chronologically. One expects a sharp focus on the Mediterranean, but Gibbon ranges from sub-Saharan Africa to China. And although he ostensibly covers the period from the Antonines in the second century after Christ until the final collapse of Constantinople in 1453, even this broad range does not contain our author."
  ];
  
  const examplesContainer = document.getElementById('examples-container');
  exampleQueries.forEach(query => {
    const example = document.createElement('div');
    example.className = 'example-query';
    example.textContent = query;
    example.addEventListener('click', () => {
      document.getElementById('nlp-input').value = query;
      processUserInput(query);
    });
    examplesContainer.appendChild(example);
  });
}); 