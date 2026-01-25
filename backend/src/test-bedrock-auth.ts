/**
 * Test AWS Bedrock authentication and decode API key
 */

import dotenv from 'dotenv';

dotenv.config();

const AWS_BEDROCK_API_KEY = process.env.AWS_BEDROCK_API_KEY;

console.log('='.repeat(60));
console.log('🔐 AWS Bedrock API Key Analysis');
console.log('='.repeat(60));
console.log('');

if (!AWS_BEDROCK_API_KEY) {
  console.error('❌ AWS_BEDROCK_API_KEY not set');
  process.exit(1);
}

console.log('API Key Format Analysis:');
console.log('  Length:', AWS_BEDROCK_API_KEY.length);
console.log('  First 20 chars:', AWS_BEDROCK_API_KEY.substring(0, 20));
console.log('  Starts with:', AWS_BEDROCK_API_KEY.substring(0, 4));
console.log('');

// Check if it's base64 encoded
const isBase64 = /^[A-Za-z0-9+/]+=*$/.test(AWS_BEDROCK_API_KEY);
console.log('  Appears to be Base64:', isBase64);
console.log('');

if (isBase64) {
  console.log('Attempting to decode Base64...');
  try {
    const decoded = Buffer.from(AWS_BEDROCK_API_KEY, 'base64').toString('utf-8');
    console.log('  ✅ Decoded successfully');
    console.log('  Decoded length:', decoded.length);
    console.log('  Decoded content (first 50 chars):', decoded.substring(0, 50));
    
    // Check if it contains AWS access key pattern
    if (decoded.includes('AKIA') || decoded.includes('ASIA')) {
      console.log('  ✅ Contains AWS access key pattern');
      
      // Try to parse as JSON
      try {
        const parsed = JSON.parse(decoded);
        console.log('  ✅ Valid JSON structure');
        console.log('  Keys:', Object.keys(parsed));
      } catch {
        console.log('  ℹ️  Not JSON format');
        
        // Try to parse as key:value format
        if (decoded.includes(':')) {
          const parts = decoded.split(':');
          console.log('  Colon-separated format detected');
          console.log('  Parts:', parts.length);
          if (parts.length >= 2) {
            console.log('  Part 1 (first 20 chars):', parts[0].substring(0, 20));
            console.log('  Part 2 (first 20 chars):', parts[1].substring(0, 20));
          }
        }
      }
    } else {
      console.log('  ⚠️  Does not contain standard AWS access key pattern');
    }
    
    console.log('');
    console.log('Full decoded content:');
    console.log('  ' + decoded);
    
  } catch (error: any) {
    console.error('  ❌ Failed to decode:', error.message);
  }
} else {
  console.log('⚠️  Not standard Base64 format');
  console.log('This might be a direct AWS access key or a different format');
}

console.log('');
console.log('='.repeat(60));
console.log('💡 Next Steps:');
console.log('='.repeat(60));
console.log('');
console.log('If the key is Base64-encoded AWS credentials:');
console.log('  1. Decode the key to get access key ID and secret');
console.log('  2. Update bedrock.ts to properly parse credentials');
console.log('  3. Use separate AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
console.log('');
console.log('If the key is a Bedrock-specific API key:');
console.log('  1. Check AWS Bedrock documentation for auth format');
console.log('  2. Verify model access is enabled in AWS console');
console.log('  3. Ensure region is correct (eu-west-2)');
console.log('');
