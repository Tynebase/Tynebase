const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://fsybthuvikyetueizado.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function validatePgVector() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
    });
    
    if (error) {
      // Try direct query instead
      const { data: result, error: queryError } = await supabase
        .from('pg_extension')
        .select('*')
        .eq('extname', 'vector');
      
      if (queryError) {
        console.log('Using raw SQL query...');
        const { data: rawData, error: rawError } = await supabase.rpc('exec', {
          query: "SELECT * FROM pg_extension WHERE extname = 'vector';"
        });
        
        if (rawError) {
          console.error('Error:', rawError);
          process.exit(1);
        }
        console.log('✅ pgvector extension validation:');
        console.log(JSON.stringify(rawData, null, 2));
      } else {
        console.log('✅ pgvector extension validation:');
        console.log(JSON.stringify(result, null, 2));
      }
    } else {
      console.log('✅ pgvector extension validation:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

validatePgVector();
