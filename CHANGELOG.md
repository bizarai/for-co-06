# Changelog

All notable changes to this project will be documented in this file.

## [Current] - 2025-03-24

### Code Organization
- Streamlined directory structure by removing redundant "versions" directory
- Created clear separation between main and comparison implementations
- Improved documentation with detailed feature comparison

## [1.1.0] - 2025-03-24

### Optimizations
- Implemented parallel processing of NLP queries and map style updates
- Added geocoding cache to avoid redundant API requests
- Optimized map style and source management
- Improved error handling with timeout and fallback mechanisms
- Added performance timing metrics for monitoring

### Features
- Added sharing functionality to the comparison version
- Created comparison interface for side-by-side performance evaluation

### Deployment
- Successfully deployed to CloudFlare Pages as project "for-co-04"
- Configured CloudFlare Functions for API endpoints
- Set up environment variables for Mapbox and Gemini API keys

## [1.0.0] - 2024-03-20

### Initial Release
- Basic mapping application with NLP-based route visualization
- Integration with Mapbox for map rendering and directions
- Integration with Gemini API for natural language processing
- Basic geocoding functionality
- Sequential processing of queries and map updates 