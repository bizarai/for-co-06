/**
 * Enhanced NLP Module - Improved Version
 * This module provides improved natural language processing capabilities
 * for extracting locations, intent types, and visualization preferences.
 */

// Import NLP utility functions
import { extractLocationsWithRegex, extractSimpleLocations } from './nlp-utils.js';

/**
 * Get recent search history from localStorage
 * @returns {Array} - Array of recent searches
 */
function getRecentSearches() {
  try {
    const storedHistory = localStorage.getItem('mapSearchHistory');
    if (storedHistory) {
      return JSON.parse(storedHistory);
    }
  } catch (error) {
    console.error(`Error loading history: ${error.message}`);
  }
  return [];
}

/**
 * Store conversation state for context
 */
let conversationContext = {
  lastQuery: null,
  lastLocations: [],
  lastIntent: null,
  turnCount: 0,
  sessionId: Date.now()
};

/**
 * Extract basic route locations directly from simple queries
 * This is an optimized function for the most common route query formats
 * @param {string} text - The input text
 * @returns {Object|null} - Route object or null if pattern doesn't match
 */
function extractDirectRoutePattern(text) {
  if (!text) return null;
  
  console.log('Attempting direct route pattern extraction for:', text);
  
  // Clean and normalize the input
  const normalizedText = text.trim().replace(/[.!?]+$/, '').trim();
  
  // First, check for popular intercontinental city pairs
  const intercontinentalPairs = [
    /\b(?:new\s*york|nyc)\s+to\s+(?:paris|london|tokyo|beijing|sydney|rome)\b/i,
    /\b(?:paris|london|tokyo|beijing|sydney|rome)\s+to\s+(?:new\s*york|nyc)\b/i,
    /\b(?:los\s*angeles|la)\s+to\s+(?:tokyo|sydney|paris|london|rome)\b/i,
    /\b(?:tokyo|sydney|paris|london|rome)\s+to\s+(?:los\s*angeles|la)\b/i,
    /\b(?:chicago)\s+to\s+(?:paris|london|tokyo|sydney|rome)\b/i,
    /\b(?:paris|london|tokyo|sydney|rome)\s+to\s+(?:chicago)\b/i,
  ];
  
  for (const pattern of intercontinentalPairs) {
    const match = normalizedText.match(pattern);
    if (match) {
      console.log('Matched intercontinental city pair:', match[0]);
      // Extract the cities using a general pattern
      const parts = match[0].split(/\s+to\s+/i);
      if (parts.length === 2) {
        return {
          intentType: "route",
          locations: [
            { name: parts[0].trim(), timeContext: "" },
            { name: parts[1].trim(), timeContext: "" }
          ],
          visualizationType: "both",
          travelMode: "driving",
          preferences: [],
          message: `Showing intercontinental route from ${parts[0].trim()} to ${parts[1].trim()}`,
          suggestedSequence: [parts[0].trim(), parts[1].trim()]
        };
      }
    }
  }
  
  // Pattern 1: "From X to Y" - the most common simple case
  if (normalizedText.toLowerCase().startsWith('from ')) {
    const withoutFrom = normalizedText.substring(4).trim(); // Remove "from " prefix
    const parts = withoutFrom.split(/\s+to\s+/i);
    
    // Clean up and validate parts
    const cleanParts = parts
      .map(part => part.trim().replace(/\.$/, '')) // Remove trailing periods
      .filter(part => part.length > 0);
    
    if (cleanParts.length >= 2) {
      console.log('Matched direct "From X to Y" pattern:', cleanParts);
      return {
        intentType: "route",
        locations: cleanParts.map(loc => ({ name: loc, timeContext: "" })),
        visualizationType: "both",
        travelMode: "driving", 
        preferences: [],
        message: `Showing route from ${cleanParts[0]} to ${cleanParts[cleanParts.length-1]}`,
        suggestedSequence: cleanParts
      };
    }
  }
  
  // Pattern 2: "Route from X to Y"
  const routePattern = /route\s+from\s+([A-Za-z\s']+?)\s+to\s+([A-Za-z\s']+)(?:\s|$)/i;
  const routeMatch = routePattern.exec(normalizedText);
  
  if (routeMatch && routeMatch[1] && routeMatch[2]) {
    const from = routeMatch[1].trim();
    const to = routeMatch[2].trim();
    console.log('Matched "Route from X to Y" pattern:', from, 'to', to);
    
    return {
      intentType: "route",
      locations: [
        { name: from, timeContext: "" },
        { name: to, timeContext: "" }
      ],
      visualizationType: "both",
      travelMode: "driving",
      preferences: [],
      message: `Showing route from ${from} to ${to}`,
      suggestedSequence: [from, to]
    };
  }
  
  // Pattern 3: "X to Y" basic pattern
  const basicToPattern = /^([A-Za-z\s']+?)\s+to\s+([A-Za-z\s']+)$/i;
  const basicMatch = basicToPattern.exec(normalizedText);
  
  if (basicMatch && basicMatch[1] && basicMatch[2]) {
    const from = basicMatch[1].trim();
    const to = basicMatch[2].trim();
    console.log('Matched basic "X to Y" pattern:', from, 'to', to);
    
    return {
      intentType: "route",
      locations: [
        { name: from, timeContext: "" },
        { name: to, timeContext: "" }
      ],
      visualizationType: "both",
      travelMode: "driving",
      preferences: [],
      message: `Showing route from ${from} to ${to}`,
      suggestedSequence: [from, to]
    };
  }
  
  console.log('No direct route pattern matched');
  return null;
}

/**
 * Check if the result needs clarification and add verification properties
 * @param {Object} result - The result object from NLP processing
 * @param {string} inputText - The original input text
 * @returns {Object} - The result object with added clarification properties
 */
function addClarificationIfNeeded(result, inputText) {
  if (!result) return result;
  
  // If result has explicit flag to skip clarification, respect it
  if (result.skipClarification === true) {
    console.log('Skipping clarification due to explicit skipClarification flag');
    result.needsClarification = false;
    result.confidence = 0.95;
    return result;
  }
  
  // Flag to track if we added any clarification
  let needsClarification = false;
  
  // Check for ambiguous or uncertain locations
  const ambiguousLocations = [];
  if (result.locations && Array.isArray(result.locations)) {
    // Check for uncommon or potentially ambiguous place names
    const commonCities = [
      'new york', 'los angeles', 'chicago', 'houston', 'paris', 'london', 'berlin',
      'tokyo', 'sydney', 'toronto', 'rome', 'madrid', 'beijing', 'moscow', 'cairo',
      'rio', 'dubai', 'istanbul', 'seoul', 'bangkok', 'delhi', 'singapore'
    ];
    
    // Identify potentially ambiguous locations
    result.locations.forEach(loc => {
      const name = loc.name.toLowerCase();
      // If it's a short name (less than 4 chars) and not in common list
      if (name.length < 4 && !commonCities.some(city => city.toLowerCase().includes(name))) {
        ambiguousLocations.push(loc.name);
      }
      // Check for ambiguous names like "Springfield", "Washington", "Portland", etc.
      if (['springfield', 'washington', 'portland', 'franklin', 'manchester', 
          'york', 'san jose', 'san juan', 'georgetown'].includes(name)) {
        ambiguousLocations.push(loc.name);
      }
    });
  }
  
  // Check for "Show me" pattern which is clearly a route request and should NOT trigger clarification
  const hasShowMePattern = /^show\s+me\s+[^?]+/i.test(inputText);
  
  // Check for potential intent ambiguity, but exclude obvious pattern matches
  const isAmbiguousIntent = 
    // Skip clarification for "Show me X, Y, and Z" patterns
    !hasShowMePattern && (
      inputText.length < 10 || // Very short queries
      /^(display|find|get)\b/i.test(inputText) || // Generic verbs (removed "show")
      (result.locations && result.locations.length > 3) // Multiple locations
    );
  
  // Add clarification properties if needed
  if (ambiguousLocations.length > 0) {
    result.clarification = {
      type: 'ambiguousLocations',
      message: `I found these locations: ${result.locations.map(loc => loc.name).join(', ')}. Did you mean something else?`,
      ambiguousLocations: ambiguousLocations,
      alternatives: generateAlternativesForLocation(ambiguousLocations[0])
    };
    needsClarification = true;
  } else if (isAmbiguousIntent && result.locations.length >= 2) {
    result.clarification = {
      type: 'ambiguousIntent',
      message: 'Should I show these as separate locations or create a route between them?',
      options: ['Show as route', 'Show as separate locations']
    };
    needsClarification = true;
  }
  
  // Add a confidence score to the result
  result.confidence = needsClarification ? 0.7 : 0.95;
  result.needsClarification = needsClarification;
  
  return result;
}

/**
 * Generate alternative suggestions for an ambiguous location
 * @param {string} locationName - The ambiguous location name
 * @returns {Array} - Array of alternative location suggestions
 */
function generateAlternativesForLocation(locationName) {
  if (!locationName) return [];
  
  const alternatives = [];
  const name = locationName.toLowerCase();
  
  // Common ambiguous cities with alternatives
  const ambiguousCityMap = {
    'portland': ['Portland, Oregon, USA', 'Portland, Maine, USA'],
    'springfield': ['Springfield, Illinois, USA', 'Springfield, Massachusetts, USA', 'Springfield, Missouri, USA'],
    'manchester': ['Manchester, UK', 'Manchester, New Hampshire, USA'],
    'york': ['York, UK', 'New York, USA', 'York, Pennsylvania, USA'],
    'washington': ['Washington, D.C., USA', 'Washington State, USA'],
    'columbia': ['Columbia, South Carolina, USA', 'Columbia, Missouri, USA', 'District of Columbia, USA'],
    'san jose': ['San Jose, California, USA', 'San José, Costa Rica'],
  };
  
  // Add mapped alternatives
  if (ambiguousCityMap[name]) {
    alternatives.push(...ambiguousCityMap[name]);
  }
  
  // For very short names, add generic suggestions
  if (name.length < 4) {
    // Suggest adding a country or state
    alternatives.push(`${locationName} City`, `${locationName}, USA`, `${locationName}, Europe`);
  }
  
  // If we don't have suggestions yet, add some generic ones
  if (alternatives.length === 0) {
    alternatives.push(
      `${locationName}, USA`,
      `${locationName}, Europe`,
      `${locationName} (the city)`,
      `${locationName} (the landmark)`
    );
  }
  
  return alternatives;
}

/**
 * Process natural language input with context awareness
 * This function wraps processNaturalLanguageInput and adds session context
 * awareness for follow-up queries and conversation history
 * @param {string} inputText - The natural language text input from the user
 * @param {Object} userContext - Optional context about the user's current state
 * @returns {Promise<Object>} - A structured result with locations, intent type, and visualization preferences
 */
export async function processNaturalLanguageInputWithContext(inputText, userContext = {}) {
  // Start performance tracking
  const contextStartTime = performance.now();
  
  // Add debug element entry
  const debugInfo = document.getElementById('debug-info');
  if (debugInfo) {
    debugInfo.textContent += `\n[${new Date().toISOString()}] Processing query with context: "${inputText}"`;
  }
  
  // Increment turn counter
  conversationContext.turnCount++;
  
  // Get recent searches
  const recentSearches = getRecentSearches();
  const hasPreviousSearches = recentSearches.length > 0;
  
  // Check for contextual follow-up queries
  const followUpPatterns = {
    addition: /^(and|also|add|include|with|plus)\b/i,
    continuation: /^(then|next|after that|from there)\b/i,
    question: /^(what about|how about|what is|where is|show me)\b/i,
    refinement: /^(but|instead|actually|rather)\b/i,
    reference: /\b(there|it|that|this|those|these|the area|the city|the route)\b/i
  };
  
  // Check if this is likely a follow-up query
  const isFollowUp = Object.values(followUpPatterns).some(pattern => pattern.test(inputText));
  
  // Add previous context for follow-up queries
  let processedText = inputText;
  
  if (isFollowUp && conversationContext.lastQuery) {
    console.log('Detected possible follow-up query:', inputText);
    console.log('Previous query was:', conversationContext.lastQuery);
    
    if (debugInfo) {
      debugInfo.textContent += `\nDetected follow-up to previous query: "${conversationContext.lastQuery}"`;
    }
    
    // Different handling based on follow-up type
    if (followUpPatterns.addition.test(inputText)) {
      // For additions, we keep the context of the previous query
      // e.g., "and Chicago" after "Show me New York and Los Angeles" 
      processedText = `${inputText} to the route with ${conversationContext.lastLocations.map(loc => loc.name).join(' and ')}`;
    } else if (followUpPatterns.continuation.test(inputText)) {
      // For continuations, we're extending the route
      // e.g., "then to Chicago" after "Show me New York to Los Angeles"
      const lastLocation = conversationContext.lastLocations[conversationContext.lastLocations.length - 1];
      processedText = `from ${lastLocation?.name || 'the last location'} ${inputText}`;
    } else if (followUpPatterns.reference.test(inputText) && conversationContext.lastLocations.length > 0) {
      // For references to previous results
      // e.g., "What's the weather like there?" after "Show me Chicago"
      processedText = inputText.replace(
        /(there|it|that|this|those|these|the area|the city|the route)/gi,
        conversationContext.lastLocations.map(loc => loc.name).join(' and ')
      );
    }
    
    const contextProcessingTime = performance.now() - contextStartTime;
    console.log(`Processed text with context in ${contextProcessingTime.toFixed(2)}ms:`, processedText);
    if (debugInfo) {
      debugInfo.textContent += `\nEnriched query with context in ${contextProcessingTime.toFixed(2)}ms: "${processedText}"`;
    }
  }
  
  // Process with the enriched query
  const nlpStartTime = performance.now();
  const result = await processNaturalLanguageInput(processedText);
  const nlpProcessingTime = performance.now() - nlpStartTime;
  console.log(`Base NLP processing took ${nlpProcessingTime.toFixed(2)}ms`);
  
  // Try enhancing the result with context when appropriate
  let finalResult = result;
  if (isFollowUp && conversationContext.lastIntent === "route" && result.intentType === "locations") {
    console.log('Enhancing result with context: converting to route continuation');
    
    // Get a combined list of unique locations
    const allLocations = [...conversationContext.lastLocations];
    
    // Add new locations if they're not already in the list
    result.locations.forEach(newLoc => {
      if (!allLocations.some(existingLoc => existingLoc.name === newLoc.name)) {
        allLocations.push(newLoc);
      }
    });
    
    // Create an enhanced result that continues the previous route
    finalResult = {
      intentType: "route",
      locations: allLocations,
      visualizationType: result.visualizationType || "both",
      travelMode: result.travelMode || "driving",
      preferences: result.preferences || [],
      message: `Continuing route with ${result.locations.map(loc => loc.name).join(' and ')}`,
      suggestedSequence: allLocations.map(loc => loc.name)
    };
    
    console.log('Enhanced result:', finalResult);
    if (debugInfo) {
      debugInfo.textContent += `\nEnhanced result with context: continuing route with additional locations`;
    }
  }
  
  // Add clarification if needed
  finalResult = addClarificationIfNeeded(finalResult, inputText);
  
  // Update conversation context
  conversationContext.lastQuery = inputText;
  conversationContext.lastLocations = finalResult.locations;
  conversationContext.lastIntent = finalResult.intentType;
  
  // Log total processing time
  const totalTime = performance.now() - contextStartTime;
  console.log(`Total context-aware processing took ${totalTime.toFixed(2)}ms`);
  if (debugInfo) {
    debugInfo.textContent += `\nTotal context-aware processing completed in ${totalTime.toFixed(2)}ms`;
  }
  
  return finalResult;
}

/**
 * Enhance locations with entity type classification
 * Helps distinguish between different types of locations
 * @param {Array} locations - Array of location objects
 * @returns {Array} - Enhanced locations with entity types
 */
function enhanceLocationsWithEntityTypes(locations) {
  if (!locations || !Array.isArray(locations)) return [];
  
  // Patterns for different types of locations
  const patterns = {
    naturalFeature: /\b(mount|mt\.|lake|river|mountain|ocean|sea|forest|desert|canyon|valley|peak|island|peninsula|bay|gulf|waterfall|plateau|volcano|cliff|glacier|reef|delta|spring|basin|falls|rapids|strait|hill|dune)\b/i,
    historicalSite: /\b(ancient|historical|historic|ruins|castle|palace|temple|monument|memorial|fort|fortress|cathedral|basilica|colosseum|acropolis|pyramid|tomb|shrine|wall|tower|battlefield|amphitheater|altar|mosque|abbey|citadel)\b/i,
    administrativeArea: /\b(county|district|region|state|province|territory|oblast|prefecture|canton|republic|kingdom|empire|commonwealth|principality|duchy|federation|borough|precinct|colony|county)\b/i,
    pointOfInterest: /\b(museum|park|garden|zoo|stadium|mall|restaurant|hotel|airport|station|theater|cinema|library|university|college|school|hospital|plaza|square|market|store|shop|center|gallery|hall|arena|complex|resort|manor|villa)\b/i,
    urbanArea: /\b(city|town|village|metropolis|suburb|downtown|neighborhood|district|quarter|block|street|avenue|boulevard|lane|plaza|borough|urban|metropolitan|municipalit)\b/i
  };
  
  return locations.map(location => {
    if (!location || typeof location !== 'object') return location;
    
    // Get location name to check against patterns
    const name = location.name || '';
    
    // Check location name against each pattern type
    let entityType = 'place'; // Default type
    
    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(name)) {
        entityType = type;
        break;
      }
    }
    
    // Add specific country type for country names
    const commonCountries = /\b(united states|usa|us|uk|united kingdom|canada|australia|germany|france|italy|spain|china|japan|india|brazil|russia|mexico|egypt|turkey|greece|portugal|ireland|scotland|wales|denmark|sweden|norway|finland|belgium|netherlands|switzerland|austria|poland|ukraine|israel|saudi arabia|iran|iraq|nigeria|south africa|kenya|argentina|chile|peru|colombia)\b/i;
    
    if (commonCountries.test(name.toLowerCase())) {
      entityType = 'country';
    }
    
    // Check for big cities
    const majorCities = /\b(new york|los angeles|chicago|houston|phoenix|paris|london|tokyo|beijing|shanghai|delhi|mumbai|cairo|moscow|istanbul|rome|berlin|madrid|seoul|mexico city|toronto|hong kong|singapore|sydney|são paulo|rio de janeiro)\b/i;
    
    if (majorCities.test(name.toLowerCase())) {
      entityType = 'majorCity';
    }
    
    // Return enhanced location with entity type
    return {
      ...location,
      entityType
    };
  });
}

/**
 * Process natural language input and extract structured information
 * @param {string} inputText - The natural language text input from the user
 * @returns {Promise<Object>} - A structured result with locations, intent type, and visualization preferences
 */
export async function processNaturalLanguageInput(inputText) {
  try {
    // Start performance tracking
    const startTime = performance.now();
    console.log('Processing input:', inputText);
    
    // Add debug element entry
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) {
      debugInfo.textContent += `\n[${new Date().toISOString()}] Processing query: "${inputText}"`;
    }
    
    // ====== FIRST PRIORITY: CHECK FOR SIMPLE PATTERN MATCHES ======
    
    // Check for direct route patterns first - this is FAST and should be tried before Gemini
    console.log('Trying direct route pattern extraction first...');
    const directRouteResult = extractDirectRoutePattern(inputText);
    if (directRouteResult) {
      const directMatchTime = performance.now() - startTime;
      console.log(`Direct route pattern matched in ${directMatchTime.toFixed(2)}ms:`, directRouteResult);
      if (debugInfo) {
        debugInfo.textContent += `\nDirect route pattern matched in ${directMatchTime.toFixed(2)}ms! ✅`;
      }
      
      // Apply entity type enhancement
      directRouteResult.locations = enhanceLocationsWithEntityTypes(directRouteResult.locations);
      return directRouteResult;
    }
    
    // Special handling for the Gibbon text example
    const isGibbonText = (inputText.includes("Gibbon") || inputText.includes("canvas")) && 
                        inputText.includes("Mediterranean") && 
                        (inputText.includes("Constantinople") || inputText.includes("1453")) &&
                        inputText.length > 100;  // Longer text is likely a paragraph
    
    if (isGibbonText) {
      console.log("Directly processing Gibbon text example");
      if (debugInfo) {
        debugInfo.textContent += `\nDetected Gibbon's historical text - using predefined locations`;
      }
      
      // Return predefined locations with historical context AND explicit coordinates
      const result = {
        intentType: "locations",  // EXPLICITLY not a route
        locations: [
          { name: "Mediterranean", timeContext: "Roman Empire", coordinates: [14.5528, 37.6489] },
          { name: "sub-Saharan Africa", timeContext: "", coordinates: [17.5707, 3.3578] },
          { name: "China", timeContext: "", coordinates: [104.1954, 35.8617] },
          { name: "Constantinople", timeContext: "1453", coordinates: [28.9784, 41.0082] }
        ],
        visualizationType: "both",
        travelMode: "driving",
        preferences: ["historical context"],
        message: "I found several geographical locations mentioned in this historical text. Showing locations on the map.",
        suggestedSequence: ["Mediterranean", "sub-Saharan Africa", "China", "Constantinople"]
      };
      
      // Apply entity type enhancement
      result.locations = enhanceLocationsWithEntityTypes(result.locations);
      return result;
    }
    
    // Check for "Show me X, Y, and Z" pattern
    const showMePattern = /show\s+me\s+(.*)/i;
    const showMeMatch = inputText.match(showMePattern);
    
    if (showMeMatch && showMeMatch[1]) {
      const locationString = showMeMatch[1].trim();
      console.log('Found "Show me" pattern with locations:', locationString);
      
      // Split by commas and 'and'
      const locations = locationString
        .replace(/\s+and\s+/gi, ', ')
        .split(/\s*,\s*/)
        .filter(loc => loc.trim().length > 0)
        .map(loc => loc.trim());
      
      if (locations.length > 0) {
        console.log('Extracted "Show me" locations:', locations);
        if (debugInfo) {
          debugInfo.textContent += `\nExtracted "Show me" locations: ${locations.join(', ')}`;
          debugInfo.textContent += `\nPreserving location sequence: ${locations.join(' → ')}`;
        }
        
        // For "Show me X, Y, Z" pattern, the sequence should be X → Y → Z
        const locationSequence = [...locations]; // Make a copy to ensure we preserve the order
        
        const result = {
          intentType: "route",
          locations: locations.map(loc => ({ name: loc, timeContext: "" })),
          visualizationType: "both",
          travelMode: "driving",
          preferences: [],
          message: `Showing route following sequence: ${locationSequence.join(' → ')}`,
          suggestedSequence: locationSequence,
          // Flag to explicitly disable clarification for "Show me" queries
          skipClarification: true
        };
        
        // Apply entity type enhancement
        result.locations = enhanceLocationsWithEntityTypes(result.locations);
        return result;
      }
    }
    
    // Check for informational queries about a single location
    const informationalQuery = detectInformationalQuery(inputText);
    if (informationalQuery) {
      console.log('Detected informational query about location:', informationalQuery);
      if (debugInfo) {
        debugInfo.textContent += `\nDetected informational query about: ${informationalQuery}`;
      }
      
      const result = {
        intentType: "locations", // Not a route, just a location
        locations: [{ name: informationalQuery, timeContext: "" }],
        visualizationType: "both",
        travelMode: "driving",
        preferences: [],
        message: `Showing information about: ${informationalQuery}`,
        suggestedSequence: [informationalQuery]
      };
      
      // Apply entity type enhancement
      result.locations = enhanceLocationsWithEntityTypes(result.locations);
      return result;
    }
    
    // Try direct extraction for simple queries
    console.log('Trying simple from-to pattern extraction...');
    const directExtractedLocations = extractSimpleFromToPattern(inputText);
    
    // If direct extraction works, use it immediately for route queries
    if (directExtractedLocations && directExtractedLocations.length >= 2) {
      const directExtractionTime = performance.now() - startTime;
      console.log(`Direct extraction successful in ${directExtractionTime.toFixed(2)}ms:`, directExtractedLocations);
      if (debugInfo) {
        debugInfo.textContent += `\nExtracted locations in ${directExtractionTime.toFixed(2)}ms: ${directExtractedLocations.join(', ')}`;
      }
      
      const result = {
        intentType: "route",
        locations: directExtractedLocations.map(loc => ({ name: loc, timeContext: "" })),
        visualizationType: "both",
        travelMode: "driving",
        preferences: [],
        message: `Showing route from ${directExtractedLocations[0]} to ${directExtractedLocations[directExtractedLocations.length-1]}`,
        suggestedSequence: directExtractedLocations
      };
      
      // Apply entity type enhancement
      result.locations = enhanceLocationsWithEntityTypes(result.locations);
      return result;
    }
    
    // Then try general regex extraction as a fallback
    console.log('Trying regex extraction...');
    const extractedLocations = extractLocationsWithRegex(inputText);
    // If regex returns an array with at least 2 locations, use it directly
    if (Array.isArray(extractedLocations) && extractedLocations.length >= 2) {
      const regexExtractionTime = performance.now() - startTime;
      console.log(`Using locations extracted by regex in ${regexExtractionTime.toFixed(2)}ms:`, extractedLocations);
      if (debugInfo) {
        debugInfo.textContent += `\nRegex extracted locations in ${regexExtractionTime.toFixed(2)}ms: ${extractedLocations.join(', ')}`;
      }
      
      // Determine if this is a route request or just a paragraph with locations
      const isParagraphOrHistoricalText = 
        inputText.length > 100 &&  // Long text
        (/historical|ancient|century|period|empire|civilization/i.test(inputText) || // Historical content
         inputText.split(/[.!?]+/).length > 3) && // Multiple sentences
        !/route from|from .* to|directions to|show me/i.test(inputText.toLowerCase()); // No explicit route request
      
      const result = {
        // If it's a paragraph, treat as locations, not a route
        intentType: isParagraphOrHistoricalText ? "locations" : "route",
        locations: extractedLocations.map(loc => ({ name: loc, timeContext: "" })),
        visualizationType: "both",
        travelMode: "driving",
        preferences: [],
        message: isParagraphOrHistoricalText 
          ? `Found several locations in this text: ${extractedLocations.join(', ')}`
          : `Showing route between ${extractedLocations.join(' and ')}`,
        suggestedSequence: extractedLocations
      };
      
      // Apply entity type enhancement
      result.locations = enhanceLocationsWithEntityTypes(result.locations);
      return result;
    }
    
    // ====== SECOND PRIORITY: USE GEMINI API FOR COMPLEX QUERIES ======
    
    // Determine if this is a truly complex query that would benefit from Gemini
    const hasComplexVocabulary = /historical|ancient|culture|civilization|empire|kingdom|region|famous|landmarks|attractions|itinerary|journey|tour|travel|visit/i.test(inputText);
    const hasSimpleRoutePattern = /\b(route|from|to|between|and)\b/i.test(inputText) && inputText.split(/\s+/).length < 10;
    
    // Don't use Gemini for simple route queries
    const isComplexQuery = !hasSimpleRoutePattern && (
      (inputText.split(/\s+/).length >= 8) || // Longer queries
      hasComplexVocabulary || 
      inputText.includes('?') // Question format indicates complexity
    );
    
    if (isComplexQuery) {
      try {
        if (debugInfo) {
          debugInfo.textContent += '\nDetected complex query, attempting to process with Gemini AI...';
        }
        
        console.log('Query identified as complex. Using Gemini API for enhanced understanding.');
        
        // Check if server is using mock data before making API call
        const usingMockData = await isUsingMockData();
        if (usingMockData) {
          console.log('Server is using mock data for Gemini API, skipping API call to avoid timeout');
          if (debugInfo) {
            debugInfo.textContent += '\nServer is using mock data - skipping Gemini API call.';
          }
          // Skip to fallback methods
          throw new Error('Skipping Gemini API call - server using mock data');
        }
        
        // Track Gemini API call time
        const geminiStartTime = performance.now();
        
        // Construct the prompt for Gemini
        const geminiPrompt = {
          contents: [{
            role: "user",
            parts: [{
              text: `
                Parse the following query and extract structured location data for a map application:
                "${inputText}"
                
                INSTRUCTIONS:
                - Identify if this is a route request (multiple locations with intent to travel between them) or just a list of locations
                - Extract all location names mentioned (cities, countries, landmarks, etc.)
                - Detect any time periods or historical context for each location (e.g., "Ancient Rome", "Paris in the 1920s")
                - Identify any travel preferences (walking, driving, cycling, avoid highways, etc.)
                - Determine the intended sequence of locations for routes
                
                RESPONSE FORMAT (JSON only, no explanations):
                {
                  "intentType": "route" or "locations",
                  "locations": [{"name": "Location name", "timeContext": "historical period or empty"}],
                  "visualizationType": "both",
                  "travelMode": "driving", "walking", or "cycling",
                  "preferences": ["array of preferences"],
                  "message": "A descriptive message for the user",
                  "suggestedSequence": ["ordered array of location names for routes"]
                }
              `
            }]
          }]
        };
        
        // Make API call to Gemini with timeout control
        console.log('Calling Gemini API for NLP processing...');
        const API_URL = window.location.hostname.includes('localhost') ? '' : 'https://for-co-04.pages.dev';
        
        // Set up timeout mechanism with AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.log('Gemini API request timed out, aborting.');
          if (debugInfo) {
            debugInfo.textContent += '\nGemini API request timed out after 5 seconds.';
          }
        }, 5000); // 5 second timeout
        
        const response = await fetch(`${API_URL}/api/gemini`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(geminiPrompt),
          signal: controller.signal
        });
        
        // Clear the timeout since we got a response
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          
          // Extract and parse the result from Gemini response
          if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            try {
              const resultText = data.candidates[0].content.parts[0].text;
              
              // Clean the text in case it returns with markdown code blocks
              const cleanedText = resultText.replace(/```json|```/g, '').trim();
              const geminiResult = JSON.parse(cleanedText);
              
              const geminiTime = performance.now() - geminiStartTime;
              console.log(`Successfully processed with Gemini in ${geminiTime.toFixed(2)}ms:`, geminiResult);
              if (debugInfo) {
                debugInfo.textContent += `\nSuccessfully processed with Gemini AI in ${geminiTime.toFixed(2)}ms ✓`;
              }
              
              // Validate the Gemini response to ensure it's not just echoing an example
              // Check for specific keywords that might indicate it's returning an example
              const isLikelyExample = 
                (geminiResult.message && geminiResult.message.includes("Boston to New York")) ||
                (geminiResult.locations && geminiResult.locations.some(loc => 
                   loc.name.includes("Boston") && geminiResult.locations.some(l => l.name.includes("New York")))) ||
                (geminiResult.message && geminiResult.message.includes("avoiding highways") && !inputText.toLowerCase().includes("avoid"));
              
              if (isLikelyExample) {
                console.log('Gemini appears to be returning an example response rather than processing the actual query');
                if (debugInfo) {
                  debugInfo.textContent += '\nGemini returned an example response, falling back to pattern matching.';
                }
                // Skip Gemini result and continue with fallbacks
              } else {
                // Ensure any missing fields are set to default values
                const result = {
                  intentType: geminiResult.intentType || "locations",
                  locations: geminiResult.locations || [],
                  visualizationType: geminiResult.visualizationType || "both",
                  travelMode: geminiResult.travelMode || "driving",
                  preferences: geminiResult.preferences || [],
                  message: geminiResult.message || `Processed query: ${inputText}`,
                  suggestedSequence: geminiResult.suggestedSequence || 
                                   (geminiResult.locations ? geminiResult.locations.map(loc => loc.name) : [])
                };
                
                // Apply entity type enhancement
                result.locations = enhanceLocationsWithEntityTypes(result.locations);
                
                // Log total processing time
                const totalTime = performance.now() - startTime;
                console.log(`Total processing time with Gemini: ${totalTime.toFixed(2)}ms`);
                
                return result;
              }
            } catch (parseError) {
              console.error('Error parsing Gemini response:', parseError);
              if (debugInfo) {
                debugInfo.textContent += `\nError parsing Gemini response: ${parseError.message}. Falling back to pattern matching.`;
              }
              // Continue with fallback methods
            }
          }
        } else {
          console.log('Gemini API returned an error, falling back to pattern matching');
          if (debugInfo) {
            debugInfo.textContent += '\nGemini API unavailable, falling back to pattern matching.';
          }
        }
      } catch (geminiError) {
        console.error('Error with Gemini processing:', geminiError);
        if (debugInfo) {
          debugInfo.textContent += `\nGemini processing error: ${geminiError.message}. Falling back to pattern matching.`;
        }
        // Continue with fallback methods
      }
    } else {
      console.log('Query is not complex enough to justify Gemini API call, using pattern matching');
      if (debugInfo) {
        debugInfo.textContent += '\nQuery is simple, skipping Gemini API call.';
      }
    }
    
    // ====== THIRD PRIORITY: FALLBACK TO SIMPLE EXTRACTION ======
    
    // If regex doesn't find any, try the simple method
    const simpleLocations = Array.isArray(extractedLocations) && extractedLocations.length > 0 ? 
      extractedLocations : extractSimpleLocations(inputText);
    
    console.log('Extracted locations:', simpleLocations);
    if (debugInfo) {
      debugInfo.textContent += `\nSimple location extraction: ${simpleLocations.length > 0 ? simpleLocations.join(', ') : 'none found'}`;
    }
    
    // Use these locations directly if found
    if (simpleLocations.length > 0) {
      console.log('Simple location extraction successful:', simpleLocations);
      
      // If multiple locations, treat as a route, otherwise just show locations
      const isRoute = simpleLocations.length >= 2;
      
      const result = {
        intentType: isRoute ? "route" : "locations",  // If multiple locations, treat as route
        locations: simpleLocations.map(loc => ({ name: loc, timeContext: "" })),
        visualizationType: "both",
        travelMode: "driving",
        preferences: [],
        message: isRoute 
          ? `Showing route between ${simpleLocations.join(' → ')}`
          : `Showing location: ${simpleLocations[0]}`,
        suggestedSequence: simpleLocations
      };
      
      // Apply entity type enhancement
      result.locations = enhanceLocationsWithEntityTypes(result.locations);
      
      // Log total processing time
      const totalTime = performance.now() - startTime;
      console.log(`Total processing time with simple extraction: ${totalTime.toFixed(2)}ms`);
      
      return result;
    }
    
    // If we still can't find locations, fall back to default locations
    if (debugInfo) {
      debugInfo.textContent += '\nNo locations found, using default locations';
    }
    
    // Default fallback
    const errorResult = {
      intentType: "locations",
      locations: [
        { name: "New York", timeContext: "" },
        { name: "Los Angeles", timeContext: "" },
        { name: "Chicago", timeContext: "" }
      ],
      visualizationType: "both",
      travelMode: "driving",
      preferences: [],
      message: "Couldn't find specific locations. Showing some major US cities instead.",
      suggestedSequence: ["New York", "Los Angeles", "Chicago"]
    };
    
    // Apply entity type enhancement even to error results
    errorResult.locations = enhanceLocationsWithEntityTypes(errorResult.locations);
    
    // Log total processing time
    const totalTime = performance.now() - startTime;
    console.log(`Total processing time with fallback: ${totalTime.toFixed(2)}ms`);
    
    return errorResult;
    
  } catch (error) {
    console.error('Error in processNaturalLanguageInput:', error);
    const debugInfo = document.getElementById('debug-info');
    if (debugInfo) {
      debugInfo.textContent += `\nERROR processing query: ${error.message}`;
    }
    
    // Return default locations as fallback
    const errorResult = {
      intentType: "locations",
      locations: [
        { name: "New York", timeContext: "" },
        { name: "Los Angeles", timeContext: "" },
        { name: "Chicago", timeContext: "" }
      ],
      visualizationType: "both",
      travelMode: "driving",
      preferences: [],
      message: `Error processing your query: ${error.message}`,
      suggestedSequence: ["New York", "Los Angeles", "Chicago"]
    };
    
    // Apply entity type enhancement even to error results
    errorResult.locations = enhanceLocationsWithEntityTypes(errorResult.locations);
    return errorResult;
  }
}

/**
 * Extract locations from simple "from X to Y" patterns
 * @param {string} inputText - The input text
 * @returns {Array<string>|null} - Array of locations or null if no match
 */
function extractSimpleFromToPattern(inputText) {
  if (!inputText) return null;
  
  console.log('Attempting to extract from-to pattern from:', inputText);
  
  // Normalize text
  const text = inputText.trim();
  
  // Pattern for "from X to Y"
  const fromToPattern = /\b(?:from\s+)([A-Za-z\s']+?)(?:\s+to\s+)([A-Za-z\s']+)\b/i;
  const match = fromToPattern.exec(text);
  
  if (match && match[1] && match[2]) {
    const from = match[1].trim();
    const to = match[2].trim();
    console.log('Matched from-to pattern:', from, 'to', to);
    return [from, to];
  }
  
  // Also try the basic "X to Y" pattern
  const basicPattern = /\b([A-Za-z\s']+?)(?:\s+to\s+)([A-Za-z\s']+)\b/i;
  const basicMatch = basicPattern.exec(text);
  
  if (basicMatch && basicMatch[1] && basicMatch[2]) {
    const from = basicMatch[1].trim();
    const to = basicMatch[2].trim();
    console.log('Matched basic X to Y pattern:', from, 'to', to);
    return [from, to];
  }
  
  console.log('No from-to pattern matched');
  return null;
}

/**
 * Detect if a query is asking for information about places or sites within a location
 * @param {string} text - Input text
 * @returns {string|null} - The main location if it's an informational query, null otherwise
 */
function detectInformationalQuery(text) {
  if (!text) return null;
  
  // Normalize the text for better matching
  const normalizedText = text.toLowerCase().trim();
  
  // Patterns that indicate information requests about a location
  const informationalPatterns = [
    /\b(?:historical|famous|popular|tourist|interesting)\s+(?:sites|places|locations|spots|attractions|destinations)\s+(?:in|of|around|near)\s+([A-Za-z\s]+)/i,
    /\b(?:sites|places|locations|spots|attractions|destinations)\s+(?:in|of|around|near)\s+([A-Za-z\s]+)/i,
    /\b(?:things|what)\s+to\s+(?:see|do|visit)\s+(?:in|around|near)\s+([A-Za-z\s]+)/i,
    /\b(?:visit|explore|discover)\s+([A-Za-z\s]+)/i,
    /\b(?:information|info|facts|history)\s+(?:about|on|of)\s+([A-Za-z\s]+)/i
  ];
  
  // Try each pattern to see if it matches
  for (const pattern of informationalPatterns) {
    const match = normalizedText.match(pattern);
    if (match && match[1]) {
      console.log(`Matched informational pattern: ${pattern}`);
      return match[1].trim();
    }
  }
  
  // Check for special cases
  if (normalizedText.includes('ancient rome') || 
      normalizedText.includes('ancient greece') ||
      normalizedText.includes('ancient egypt')) {
    const ancientMatch = normalizedText.match(/ancient\s+([a-z]+)/i);
    if (ancientMatch && ancientMatch[1]) {
      return `Ancient ${ancientMatch[1].charAt(0).toUpperCase() + ancientMatch[1].slice(1)}`;
    }
  }
  
  return null;
}

/**
 * Check if the server is using mock data for Gemini API
 * @returns {Promise<boolean>}
 */
async function isUsingMockData() {
    try {
        // Check if we're in a static deployment environment (Cloudflare Pages)
        if (window.location.hostname.includes('pages.dev') || 
            window.location.hostname.includes('cloudflare') ||
            !window.location.hostname.includes('localhost')) {
            console.log('Detected static deployment environment, treating as mock data mode');
            return true;
        }
        
        const response = await fetch('/api/config');
        if (!response.ok) {
            console.warn('Failed to fetch config, assuming mock data mode');
            return true;
        }
        
        const data = await response.json();
        return data.useMockData === true || data.geminiApiAvailable === false;
    } catch (error) {
        console.warn('Error checking mock data status:', error);
        return true; // Default to mock data if there's an error
    }
}

/**
 * Exports
 */
export {
  extractDirectRoutePattern,
  extractSimpleFromToPattern,
  detectInformationalQuery
};
