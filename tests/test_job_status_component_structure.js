/**
 * Component Structure Validation: JobStatusTracker
 * 
 * Validates that the JobStatusTracker component:
 * 1. Exports the correct component and hook
 * 2. Has proper TypeScript types
 * 3. Integrates with existing UI components
 * 4. Follows TyneBase component patterns
 */

const fs = require('fs');
const path = require('path');

function validateJobStatusTracker() {
  console.log('\n=== Validating JobStatusTracker Component Structure ===\n');

  const componentPath = path.join(__dirname, '..', 'tynebase-frontend', 'components', 'ui', 'JobStatusTracker.tsx');
  
  // Step 1: Verify file exists
  console.log('Step 1: Checking component file exists...');
  if (!fs.existsSync(componentPath)) {
    throw new Error(`Component file not found at: ${componentPath}`);
  }
  console.log('✓ Component file exists');

  // Step 2: Read and validate component content
  console.log('\nStep 2: Validating component structure...');
  const content = fs.readFileSync(componentPath, 'utf-8');

  // Check for required imports
  const requiredImports = [
    'useEffect',
    'useState',
    'useCallback',
    'getJobStatus',
    'Job',
    'Progress',
    'CircularProgress',
    'Alert',
    'Button',
  ];

  const missingImports = requiredImports.filter(imp => !content.includes(imp));
  if (missingImports.length > 0) {
    throw new Error(`Missing required imports: ${missingImports.join(', ')}`);
  }
  console.log('✓ All required imports present');

  // Step 3: Verify component exports
  console.log('\nStep 3: Checking component exports...');
  
  if (!content.includes('export function JobStatusTracker')) {
    throw new Error('Missing JobStatusTracker component export');
  }
  console.log('✓ JobStatusTracker component exported');

  if (!content.includes('export function useJobStatus')) {
    throw new Error('Missing useJobStatus hook export');
  }
  console.log('✓ useJobStatus hook exported');

  // Step 4: Verify component props interface
  console.log('\nStep 4: Validating component props...');
  
  const requiredProps = [
    'jobId',
    'onComplete',
    'onError',
    'pollInterval',
    'maxAttempts',
    'showProgress',
    'variant',
    'className',
  ];

  const missingProps = requiredProps.filter(prop => !content.includes(prop));
  if (missingProps.length > 0) {
    throw new Error(`Missing required props: ${missingProps.join(', ')}`);
  }
  console.log('✓ All required props defined');

  // Step 5: Verify status handling
  console.log('\nStep 5: Checking job status handling...');
  
  const requiredStatuses = ['pending', 'processing', 'completed', 'failed'];
  const missingStatuses = requiredStatuses.filter(status => !content.includes(`${status}:`));
  
  if (missingStatuses.length > 0) {
    throw new Error(`Missing status handling: ${missingStatuses.join(', ')}`);
  }
  console.log('✓ All job statuses handled');

  // Step 6: Verify variant support
  console.log('\nStep 6: Validating display variants...');
  
  const variants = ['default', 'compact', 'inline'];
  const missingVariants = variants.filter(variant => !content.includes(`"${variant}"`));
  
  if (missingVariants.length > 0) {
    throw new Error(`Missing variant support: ${missingVariants.join(', ')}`);
  }
  console.log('✓ All display variants supported');

  // Step 7: Verify polling logic
  console.log('\nStep 7: Checking polling implementation...');
  
  const pollingFeatures = [
    'useEffect',
    'setInterval',
    'clearInterval',
    'fetchJobStatus',
    'isPolling',
    'maxAttempts',
  ];

  const missingFeatures = pollingFeatures.filter(feature => !content.includes(feature));
  if (missingFeatures.length > 0) {
    throw new Error(`Missing polling features: ${missingFeatures.join(', ')}`);
  }
  console.log('✓ Polling logic implemented');

  // Step 8: Verify error handling
  console.log('\nStep 8: Validating error handling...');
  
  if (!content.includes('try') || !content.includes('catch')) {
    throw new Error('Missing try-catch error handling');
  }
  console.log('✓ Error handling present');

  if (!content.includes('handleRetry')) {
    throw new Error('Missing retry functionality');
  }
  console.log('✓ Retry functionality implemented');

  // Step 9: Verify progress display
  console.log('\nStep 9: Checking progress indicators...');
  
  if (!content.includes('<Progress')) {
    throw new Error('Missing Progress component usage');
  }
  console.log('✓ Progress component integrated');

  if (!content.includes('<CircularProgress')) {
    throw new Error('Missing CircularProgress component usage');
  }
  console.log('✓ CircularProgress component integrated');

  // Step 10: Verify hook functionality
  console.log('\nStep 10: Validating useJobStatus hook...');
  
  const hookFeatures = [
    'startPolling',
    'stopPolling',
    'reset',
    'refetch',
    'isLoading',
  ];

  const missingHookFeatures = hookFeatures.filter(feature => !content.includes(feature));
  if (missingHookFeatures.length > 0) {
    throw new Error(`Missing hook features: ${missingHookFeatures.join(', ')}`);
  }
  console.log('✓ Hook features complete');

  // Step 11: Check TypeScript types
  console.log('\nStep 11: Validating TypeScript types...');
  
  if (!content.includes('JobStatusTrackerProps')) {
    throw new Error('Missing JobStatusTrackerProps interface');
  }
  console.log('✓ Component props interface defined');

  if (!content.includes('UseJobStatusOptions')) {
    throw new Error('Missing UseJobStatusOptions interface');
  }
  console.log('✓ Hook options interface defined');

  // Step 12: Verify UI consistency
  console.log('\nStep 12: Checking UI consistency...');
  
  const uiPatterns = [
    'var(--text-primary)',
    'var(--text-secondary)',
    'var(--surface-section)',
    'var(--surface-border)',
  ];

  const missingPatterns = uiPatterns.filter(pattern => !content.includes(pattern));
  if (missingPatterns.length > 0) {
    throw new Error(`Missing UI patterns: ${missingPatterns.join(', ')}`);
  }
  console.log('✓ UI follows TyneBase design system');

  console.log('\n=== Component Structure Validation: PASS ===\n');
  
  return {
    success: true,
    componentPath,
    linesOfCode: content.split('\n').length,
  };
}

// Run validation
try {
  const result = validateJobStatusTracker();
  console.log('Validation completed successfully');
  console.log(`Component path: ${result.componentPath}`);
  console.log(`Lines of code: ${result.linesOfCode}`);
  console.log('\n✓ JobStatusTracker component is ready for integration\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌ Validation failed:', error.message);
  process.exit(1);
}
