const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDocument() {
  const docId = 'dc8c536d-1aa9-4998-b5e4-1e2231597dba';
  
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, content, yjs_state, updated_at')
    .eq('id', docId)
    .single();
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Document ID:', data.id);
  console.log('Title:', data.title);
  console.log('Content:', data.content ? data.content.substring(0, 200) : '(empty)');
  console.log('Has yjs_state:', !!data.yjs_state);
  if (data.yjs_state) {
    const stateSize = typeof data.yjs_state === 'string' 
      ? data.yjs_state.length 
      : data.yjs_state.length || 0;
    console.log('yjs_state size:', stateSize);
  }
  console.log('Updated at:', data.updated_at);
}

checkDocument().catch(console.error);
