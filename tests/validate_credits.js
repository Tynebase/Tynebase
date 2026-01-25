const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://fsybthuvikyetueizado.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found in environment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runValidation() {
    console.log('🔍 Starting validation for Task 1.10: Credit Tracking Tables\n');
    
    try {
        // Read and execute the validation SQL
        const sql = fs.readFileSync(path.join(__dirname, 'test_validation_1_10.sql'), 'utf8');
        
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        
        if (error) {
            console.error('❌ Validation failed:', error);
            process.exit(1);
        }
        
        console.log('✅ Validation completed successfully');
        console.log(data);
        
    } catch (err) {
        console.error('❌ Error running validation:', err.message);
        process.exit(1);
    }
}

runValidation();
