const axios = require('axios');
require('dotenv').config({ path: '../backend/.env' });

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const TEST_TOKEN = process.env.TEST_JWT_TOKEN;

async function testScrapeEndpoint() {
  console.log('='.repeat(60));
  console.log('Testing URL Scrape Endpoint - Task 6.9');
  console.log('='.repeat(60));
  console.log();

  if (!TEST_TOKEN) {
    console.error('❌ TEST_JWT_TOKEN not found in .env');
    console.log('Please set TEST_JWT_TOKEN in backend/.env');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json',
  };

  console.log('Test 1: Valid URL scraping');
  console.log('-'.repeat(60));
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/ai/scrape`,
      { url: 'https://example.com' },
      { headers }
    );
    
    console.log('✅ Status:', response.status);
    console.log('✅ Response:', {
      url: response.data.url,
      title: response.data.title,
      content_length: response.data.content_length,
      markdown_preview: response.data.markdown.substring(0, 100) + '...',
    });
  } catch (error) {
    if (error.response) {
      console.log('❌ Status:', error.response.status);
      console.log('❌ Error:', error.response.data);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
  console.log();

  console.log('Test 2: Invalid URL format');
  console.log('-'.repeat(60));
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/ai/scrape`,
      { url: 'not-a-valid-url' },
      { headers }
    );
    console.log('❌ Should have failed but got:', response.status);
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Correctly rejected with 400');
      console.log('✅ Error:', error.response.data.error.message);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  console.log();

  console.log('Test 3: SSRF protection - localhost');
  console.log('-'.repeat(60));
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/ai/scrape`,
      { url: 'http://localhost:8080' },
      { headers }
    );
    console.log('❌ Should have failed but got:', response.status);
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Correctly blocked with 400');
      console.log('✅ Error:', error.response.data.error.message);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  console.log();

  console.log('Test 4: SSRF protection - private IP');
  console.log('-'.repeat(60));
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/ai/scrape`,
      { url: 'http://192.168.1.1' },
      { headers }
    );
    console.log('❌ Should have failed but got:', response.status);
  } catch (error) {
    if (error.response && error.response.status === 400) {
      console.log('✅ Correctly blocked with 400');
      console.log('✅ Error:', error.response.data.error.message);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  console.log();

  console.log('Test 5: Missing authentication');
  console.log('-'.repeat(60));
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/ai/scrape`,
      { url: 'https://example.com' },
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log('❌ Should have failed but got:', response.status);
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Correctly rejected with 401');
      console.log('✅ Error:', error.response.data.error.message);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  console.log();

  console.log('='.repeat(60));
  console.log('Test suite completed');
  console.log('='.repeat(60));
}

testScrapeEndpoint().catch(console.error);
