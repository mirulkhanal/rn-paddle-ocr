/**
 * Test script to run after installing the package
 * 
 * Usage:
 *   1. Install the package: npm install ocr-receipt-scanner
 *   2. Copy this file to your project
 *   3. Update the paths below to point to your models and test image
 *   4. Run: node test-after-install.js
 */

const Ocr = require('ocr-receipt-scanner');
const path = require('path');
const fs = require('fs');

async function test() {
  try {
    console.log('Testing OCR Receipt Scanner...\n');
    
    // Update these paths to match your setup
    const detModelPath = path.join(__dirname, 'models/exported_det/inference.onnx');
    const recModelPath = path.join(__dirname, 'models/exported_rec/inference.onnx');
    const characterDictPath = path.join(__dirname, 'models/character_dict.json');
    const imagePath = path.join(__dirname, 'test-image.jpg'); // Change to your test image

    // Verify files exist
    console.log('Checking required files...');
    const files = [
      { path: detModelPath, name: 'Detection model' },
      { path: recModelPath, name: 'Recognition model' },
      { path: characterDictPath, name: 'Character dictionary' },
      { path: imagePath, name: 'Test image' }
    ];

    for (const file of files) {
      if (!fs.existsSync(file.path)) {
        console.error(`❌ ${file.name} not found: ${file.path}`);
        console.error('Please update the paths in this test file to match your setup.');
        process.exit(1);
      }
      console.log(`✓ ${file.name} found`);
    }
    
    console.log('\nInitializing OCR...');
    await Ocr.init({
      detModelPath,
      recModelPath,
      characterDictPath
    });

    console.log('✓ OCR initialized successfully!\n');
    console.log('Scanning image:', imagePath);
    
    const startTime = Date.now();
    const results = await Ocr.scan(imagePath);
    const duration = Date.now() - startTime;

    console.log(`\n✓ Scan completed in ${duration}ms`);
    console.log(`Found ${results.length} text regions:\n`);
    
    if (results.length === 0) {
      console.log('No text detected in the image.');
    } else {
      results.forEach((result, index) => {
        console.log(`[${index + 1}] "${result.text}"`);
        console.log(`    Confidence: ${(result.confidence * 100).toFixed(2)}%`);
        console.log(`    Box Score: ${result.box.score.toFixed(4)}`);
      });
    }

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

test();

