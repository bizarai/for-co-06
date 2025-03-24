/**
 * NLP Utilities
 * Provides utility functions for natural language processing.
 */

/**
 * Extract location names from text using regular expressions
 * @param {string} text - The input text to process
 * @returns {Array<string>} - Array of extracted location names
 */
export function extractLocationsWithRegex(text) {
  if (!text) return [];
  
  console.log('Extracting locations with regex from:', text);
  
  // Normalize text: trim and remove extra spaces
  const normalizedText = text.trim().replace(/\s+/g, ' ');
  console.log('Normalized text:', normalizedText);
  
  // Extract transport mode preferences
  const transportMode = 
    normalizedText.match(/\b(walk|walking|on foot)\b/i) ? 'walking' :
    normalizedText.match(/\b(cycl|bike|biking|bicycle)\b/i) ? 'cycling' : 'driving';
  
  const avoidTolls = !!normalizedText.match(/\b(no toll|avoid toll|without toll)\b/i);
  const avoidHighways = !!normalizedText.match(/\b(no highway|avoid highway|without highway)\b/i);
  const avoidFerries = !!normalizedText.match(/\b(no ferr|avoid ferr|without ferr)\b/i);
  
  console.log('Extracted preferences:', { transportMode, avoidTolls, avoidHighways, avoidFerries });
  
  // Direct pattern match for "From X to Y" format
  if (normalizedText.toLowerCase().startsWith('from ')) {
    const waypointText = normalizedText.substring(4).trim(); // Remove "from " prefix
    const waypoints = waypointText.split(/\s+to\s+/i)
      .map(wp => wp.trim().replace(/\.$/, '')) // Remove trailing periods
      .filter(wp => wp.length > 0);
    
    if (waypoints.length >= 2) {
      console.log('Matched "From X to Y" pattern:', waypoints);
      return waypoints;
    }
  }
  
  // Specific pattern for "route from X to Y"
  const routePattern = /route\s+from\s+([A-Za-z\s]+?)\s+to\s+([A-Za-z\s]+)(?:\s|$)/i;
  const routeMatch = normalizedText.match(routePattern);
  
  if (routeMatch && routeMatch[1] && routeMatch[2]) {
    const locations = [routeMatch[1].trim(), routeMatch[2].trim()];
    console.log('Extracted locations from route pattern:', locations);
    return locations;
  }
  
  // Common separators that might indicate different locations
  const separators = [
    /\s+to\s+/i,           // "New York to Los Angeles"
    /\s+and\s+/i,          // "New York and Los Angeles"
    /\s*,\s*/,             // "New York, Los Angeles"
    /\s+through\s+/i,      // "New York through Chicago"
    /\s+via\s+/i,          // "New York via Chicago"
    /\s+between\s+/i,      // "between New York and Los Angeles"
  ];
  
  // Try each separator pattern
  for (const separator of separators) {
    if (separator.test(normalizedText)) {
      // Special handling for "between X and Y"
      if (separator.toString() === /\s+between\s+/i.toString()) {
        const betweenMatch = normalizedText.match(/between\s+([A-Za-z\s]+)\s+and\s+([A-Za-z\s]+)/i);
        if (betweenMatch) {
          const locations = [betweenMatch[1].trim(), betweenMatch[2].trim()];
          console.log('Extracted locations from between pattern:', locations);
          return locations;
        }
      } else {
        // For other separators, split the text
        let parts = normalizedText.split(separator);
        
        // Clean up the parts
        parts = parts
          .map(part => {
            // Remove common prepositions at the start
            return part.replace(/^(from|to|in|at|starting|ending|beginning|route)\s+/i, '').trim();
          })
          .filter(part => part.length > 0);
        
        if (parts.length >= 2) {
          console.log('Extracted locations using separator:', parts);
          return parts;
        }
      }
    }
  }
  
  // List of common location indicators
  const locationIndicators = [
    'in', 'at', 'to', 'from', 'near', 'around', 'through', 'across', 'between', 'visit'
  ];
  
  // Match patterns like "in New York" or "from Paris to London"
  const patterns = [
    // Match locations after location indicators - improved pattern
    new RegExp(`(${locationIndicators.join('|')})\\s+([A-Z][a-zA-Z\\s]+?)(?=[,\\.;!?]|\\s+(${locationIndicators.join('|')})\\s+|$)`, 'gi'),
    
    // Match locations between quotes
    /"([A-Z][a-zA-Z\s]+?)"/g,
    
    // Match capitalized words that might be locations
    /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*)\b/g,
    
    // Specific pattern for "From X to Y" format
    /[Ff]rom\s+([A-Z][a-zA-Z\s]+?)\s+to\s+([A-Z][a-zA-Z\s]+?)(?=[,\.;!?]|$)/g
  ];
  
  const locationMatches = new Set();
  
  // Apply each pattern and collect matches
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // The location is usually in the second capture group, but could be in the third for "from X to Y"
      const location1 = match[2] || match[1];
      const location2 = match[3]; // This will capture the destination in "from X to Y" pattern
      
      if (location1 && isLikelyLocation(location1)) {
        locationMatches.add(location1.trim());
      }
      
      if (location2 && isLikelyLocation(location2)) {
        locationMatches.add(location2.trim());
      }
    }
  }
  
  // Convert set to array and filter out common non-location capitalized words
  return Array.from(locationMatches).filter(loc => 
    !['I', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
      'October', 'November', 'December'].includes(loc)
  );
}

/**
 * Check if a string is likely to be a location name
 * @param {string} str - The string to check
 * @returns {boolean} - True if the string is likely to be a location name
 */
function isLikelyLocation(str) {
  // Common words that are capitalized but not locations
  const nonLocationWords = [
    'I', 'Me', 'My', 'Mine', 'You', 'Your', 'He', 'She', 'His', 'Her', 'We', 'They',
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December'
  ];
  
  // Check if it's a non-location word
  if (nonLocationWords.includes(str.trim())) {
    return false;
  }
  
  // Check length - single letter is probably not a location
  if (str.trim().length < 2) {
    return false;
  }
  
  // Check if all words are capitalized (more likely to be a location)
  const words = str.trim().split(/\s+/);
  const allCapitalized = words.every(word => word.charAt(0) === word.charAt(0).toUpperCase());
  
  return allCapitalized;
}

/**
 * Extract simple locations from text using a list of known locations
 * @param {string} text - The input text to process
 * @returns {Array<string>} - Array of extracted location names
 */
export function extractSimpleLocations(text) {
  if (!text) return [];
  
  // List of common major cities and landmarks to check for
  const commonLocations = [
    "New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", 
    "San Antonio", "San Diego", "Dallas", "San Jose", "Austin", "Jacksonville",
    "Fort Worth", "Columbus", "San Francisco", "Charlotte", "Indianapolis", "Seattle",
    "Denver", "Washington", "Boston", "El Paso", "Nashville", "Detroit", "Oklahoma City",
    "Portland", "Las Vegas", "Memphis", "Louisville", "Baltimore", "Milwaukee", "Albuquerque",
    "London", "Paris", "Tokyo", "Beijing", "Sydney", "Berlin", "Rome", "Madrid",
    "Moscow", "Cairo", "Dubai", "Mumbai", "Delhi", "Singapore", "Hong Kong",
    "Eiffel Tower", "Statue of Liberty", "Golden Gate Bridge", "Grand Canyon",
    "Mount Everest", "Mount Rushmore", "Great Wall"
  ];
  
  // Find all mentions of locations in the text
  const foundLocations = [];
  const lowerText = text.toLowerCase();
  
  for (const location of commonLocations) {
    if (lowerText.includes(location.toLowerCase())) {
      foundLocations.push(location);
    }
  }
  
  return foundLocations;
} 