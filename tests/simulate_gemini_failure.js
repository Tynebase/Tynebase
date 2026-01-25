/**
 * Simulate Gemini Failure for Fallback Testing
 * 
 * This script temporarily modifies vertex.ts to throw an error,
 * allowing us to test the fallback mechanism.
 * 
 * Usage:
 *   node tests/simulate_gemini_failure.js enable   # Enable simulation
 *   node tests/simulate_gemini_failure.js disable  # Restore normal behavior
 */

const fs = require('fs');
const path = require('path');

const vertexPath = path.join(__dirname, '../backend/src/services/ai/vertex.ts');
const backupPath = path.join(__dirname, '../backend/src/services/ai/vertex.ts.backup');

const FAILURE_CODE = `
  // SIMULATED FAILURE FOR TESTING - REMOVE THIS
  if (true) {
    throw new Error('Simulated Gemini API failure for fallback testing');
  }
`;

function enableSimulation() {
  console.log('🔧 Enabling Gemini failure simulation...\n');

  // Backup original file
  const originalContent = fs.readFileSync(vertexPath, 'utf8');
  fs.writeFileSync(backupPath, originalContent, 'utf8');
  console.log('✅ Backed up original vertex.ts');

  // Find the transcribeVideo function and inject failure
  const modifiedContent = originalContent.replace(
    /export async function transcribeVideo\([^)]+\)[^{]*{/,
    match => match + FAILURE_CODE
  );

  if (modifiedContent === originalContent) {
    console.error('❌ Failed to inject simulation code');
    process.exit(1);
  }

  fs.writeFileSync(vertexPath, modifiedContent, 'utf8');
  console.log('✅ Injected failure simulation into vertex.ts');
  console.log('\n⚠️  Gemini will now fail - fallback should trigger');
  console.log('   Run: node tests/test_video_fallback.js');
  console.log('   Then run: node tests/simulate_gemini_failure.js disable\n');
}

function disableSimulation() {
  console.log('🔧 Disabling Gemini failure simulation...\n');

  if (!fs.existsSync(backupPath)) {
    console.error('❌ No backup found. Cannot restore.');
    process.exit(1);
  }

  // Restore from backup
  const backupContent = fs.readFileSync(backupPath, 'utf8');
  fs.writeFileSync(vertexPath, backupContent, 'utf8');
  fs.unlinkSync(backupPath);

  console.log('✅ Restored original vertex.ts');
  console.log('✅ Removed backup file');
  console.log('\n✅ Gemini is back to normal operation\n');
}

// Main
const command = process.argv[2];

if (command === 'enable') {
  enableSimulation();
} else if (command === 'disable') {
  disableSimulation();
} else {
  console.log('Usage:');
  console.log('  node tests/simulate_gemini_failure.js enable   # Enable simulation');
  console.log('  node tests/simulate_gemini_failure.js disable  # Restore normal');
}
