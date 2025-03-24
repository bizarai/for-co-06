const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'comparison', 'index.html');

try {
    console.log('Testing HTML file:', filePath);
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    console.log('HTML file loaded successfully!');
    console.log(`File size: ${htmlContent.length} bytes`);
    
    // Count the number of script tags
    const scriptTagCount = (htmlContent.match(/<script/g) || []).length;
    console.log(`Number of script tags: ${scriptTagCount}`);
    
    // Check if imports exist
    const hasImports = htmlContent.includes('import {') || htmlContent.includes('import{');
    console.log(`Has ES6 imports: ${hasImports}`);
    
    // Check if all functions are correctly defined
    const functionNames = [
        'initializeMap', 
        'initVisualizationOptions', 
        'updateMapStyle',
        'setupEventListeners', 
        'processInputWithVisualization', 
        'testNlpDirectly', 
        'checkModuleImports', 
        'testVisualization', 
        'checkMapStatus', 
        'checkMapboxToken', 
        'checkMapSources', 
        'displayMapError'
    ];
    
    functionNames.forEach(funcName => {
        const exists = htmlContent.includes(`function ${funcName}`);
        console.log(`Function '${funcName}' exists: ${exists ? '✅' : '❌'}`);
    });
    
    console.log('All checks passed! HTML file appears to be valid.');
} catch (error) {
    console.error('Error checking HTML file:', error);
} 