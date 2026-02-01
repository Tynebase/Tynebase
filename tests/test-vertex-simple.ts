/**
 * Simple Vertex AI permission test
 */

import { VertexAI } from '@google-cloud/vertexai';
import * as dotenv from 'dotenv';

dotenv.config();

function getServiceAccountCredentials(): any {
  const gcpJson = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!gcpJson) throw new Error('GCP_SERVICE_ACCOUNT_JSON not set');
  
  try {
    const decoded = Buffer.from(gcpJson, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (e) {
    return JSON.parse(gcpJson);
  }
}

async function test() {
  console.log('Testing Vertex AI with detailed error info...\n');
  
  const credentials = getServiceAccountCredentials();
  const projectId = credentials.project_id;
  
  console.log(`Project: ${projectId}`);
  console.log(`Service Account: ${credentials.client_email}\n`);
  
  const vertexAI = new VertexAI({
    project: projectId,
    location: 'us-central1',
    googleAuthOptions: { credentials },
  });

  console.log('Attempting to call Gemini API...\n');
  
  try {
    const model = vertexAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
    });
    
    console.log('✅ SUCCESS!');
    console.log('Response:', result.response.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (error: any) {
    console.log('❌ ERROR:\n');
    console.log('Status:', error.status || 'N/A');
    console.log('Code:', error.code || 'N/A');
    console.log('Message:', error.message);
    
    if (error.message?.includes('403') || error.message?.includes('PERMISSION_DENIED')) {
      console.log('\n⚠️  PERMISSION ISSUE DETECTED');
      console.log('\nYour service account needs these IAM roles:');
      console.log('  • Vertex AI User (roles/aiplatform.user)');
      console.log('\nAdd the role here:');
      console.log(`  https://console.cloud.google.com/iam-admin/iam?project=${projectId}`);
      console.log('\nFind your service account:');
      console.log(`  ${credentials.client_email}`);
    } else if (error.message?.includes('404')) {
      console.log('\n⚠️  MODEL NOT FOUND');
      console.log('\nThis could mean:');
      console.log('  1. The model name is incorrect');
      console.log('  2. The model is not available in us-central1');
      console.log('  3. Your project needs to be allowlisted for this model');
      console.log('\nTry enabling Generative AI in Vertex AI Studio:');
      console.log(`  https://console.cloud.google.com/vertex-ai/generative?project=${projectId}`);
    }
  }
}

test();
