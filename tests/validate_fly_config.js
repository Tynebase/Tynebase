const fs = require('fs');
const path = require('path');

console.log('\n🧪 Validating Fly.io Configuration\n');

try {
  // Check if fly.toml exists
  const flyTomlPath = path.join(__dirname, '../fly.toml');
  if (!fs.existsSync(flyTomlPath)) {
    console.error('❌ fly.toml not found');
    process.exit(1);
  }
  console.log('✅ fly.toml exists');

  // Read and parse fly.toml
  const flyTomlContent = fs.readFileSync(flyTomlPath, 'utf8');
  
  // Validate required sections
  const requiredSections = [
    { pattern: /app\s*=\s*"[^"]+"/, name: 'app name' },
    { pattern: /primary_region\s*=\s*"lhr"/, name: 'primary_region (lhr)' },
    { pattern: /\[build\]/, name: '[build] section' },
    { pattern: /\[processes\]/, name: '[processes] section' },
    { pattern: /api\s*=\s*"node dist\/server\.js"/, name: 'api process' },
    { pattern: /worker\s*=\s*"node dist\/worker\.js"/, name: 'worker process' },
    { pattern: /\[\[services\]\]/, name: '[[services]] section' },
    { pattern: /internal_port\s*=\s*8080/, name: 'internal_port 8080' },
    { pattern: /port\s*=\s*80/, name: 'HTTP port 80' },
    { pattern: /port\s*=\s*443/, name: 'HTTPS port 443' }
  ];

  let allValid = true;
  for (const check of requiredSections) {
    if (check.pattern.test(flyTomlContent)) {
      console.log(`✅ ${check.name} configured`);
    } else {
      console.error(`❌ Missing or invalid: ${check.name}`);
      allValid = false;
    }
  }

  // Check for secrets documentation
  if (flyTomlContent.includes('SUPABASE_URL') && 
      flyTomlContent.includes('SUPABASE_SERVICE_ROLE_KEY')) {
    console.log('✅ Secrets documented in comments');
  } else {
    console.warn('⚠️  Secrets not documented in comments');
  }

  // Verify no hardcoded secrets
  const secretPatterns = [
    /SUPABASE_URL\s*=\s*"https?:\/\//,
    /SUPABASE_SERVICE_ROLE_KEY\s*=\s*"ey[A-Za-z0-9]/,
    /password\s*=\s*"[^"]+"/i,
    /api_key\s*=\s*"[^"]+"/i
  ];

  let hasHardcodedSecrets = false;
  for (const pattern of secretPatterns) {
    if (pattern.test(flyTomlContent)) {
      console.error('❌ SECURITY ISSUE: Hardcoded secret detected!');
      hasHardcodedSecrets = true;
      allValid = false;
    }
  }

  if (!hasHardcodedSecrets) {
    console.log('✅ No hardcoded secrets found');
  }

  // Check .dockerignore exists
  const dockerignorePath = path.join(__dirname, '../.dockerignore');
  if (fs.existsSync(dockerignorePath)) {
    console.log('✅ .dockerignore exists');
    
    const dockerignoreContent = fs.readFileSync(dockerignorePath, 'utf8');
    if (dockerignoreContent.includes('node_modules') && 
        dockerignoreContent.includes('.env')) {
      console.log('✅ .dockerignore properly configured');
    }
  } else {
    console.warn('⚠️  .dockerignore not found');
  }

  if (allValid) {
    console.log('\n✅ All validation checks passed!\n');
    console.log('📋 Next steps:');
    console.log('   1. Create Dockerfile (task 3.6)');
    console.log('   2. Set secrets: fly secrets set SUPABASE_URL=...');
    console.log('   3. Deploy: fly deploy\n');
  } else {
    console.error('\n❌ Validation failed. Please fix the issues above.\n');
    process.exit(1);
  }

} catch (error) {
  console.error('\n❌ Validation error:', error.message);
  process.exit(1);
}
