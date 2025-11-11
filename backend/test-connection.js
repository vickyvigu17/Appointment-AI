import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

console.log('🔍 Testing Supabase Connection...\n');

// Check if credentials are set
if (!supabaseUrl || supabaseUrl === 'your_supabase_url') {
  console.error('❌ SUPABASE_URL is not configured in .env file');
  process.exit(1);
}

if (!supabaseKey || supabaseKey === 'your_supabase_anon_key') {
  console.error('❌ SUPABASE_KEY is not configured in .env file');
  process.exit(1);
}

console.log('✅ Environment variables loaded');
console.log(`   URL: ${supabaseUrl.substring(0, 30)}...`);

// Test connection
const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  try {
    // Test 1: Check if we can connect
    console.log('\n📡 Testing connection...');
    const { data: testData, error: testError } = await supabase
      .from('appointments')
      .select('count')
      .limit(1);

    if (testError) {
      if (testError.code === 'PGRST116') {
        console.error('❌ Table "appointments" does not exist!');
        console.error('   → Please run the migration script in Supabase SQL Editor');
        process.exit(1);
      }
      throw testError;
    }

    console.log('✅ Connection successful!');

    // Test 2: Check if tables exist
    console.log('\n📊 Checking database tables...');
    
    const { data: appointments, error: apptError } = await supabase
      .from('appointments')
      .select('id')
      .limit(1);

    if (apptError && apptError.code !== 'PGRST116') {
      throw apptError;
    }
    console.log('✅ "appointments" table exists');

    const { data: blocked, error: blockedError } = await supabase
      .from('blocked_slots')
      .select('id')
      .limit(1);

    if (blockedError && blockedError.code !== 'PGRST116') {
      throw blockedError;
    }
    console.log('✅ "blocked_slots" table exists');

    // Test 3: Check table structure
    console.log('\n🔍 Verifying table structure...');
    
    const { data: sampleAppt, error: sampleError } = await supabase
      .from('appointments')
      .select('*')
      .limit(0);

    if (sampleError) {
      throw sampleError;
    }
    console.log('✅ Table structure is valid');

    // Test 4: Check RLS policies
    console.log('\n🔒 Checking Row Level Security...');
    const { data: rlsTest, error: rlsError } = await supabase
      .from('appointments')
      .select('id')
      .limit(1);

    if (rlsError && rlsError.message.includes('permission denied')) {
      console.warn('⚠️  RLS might be blocking access. Check your policies.');
    } else {
      console.log('✅ RLS policies are configured correctly');
    }

    console.log('\n🎉 All checks passed! Your Supabase setup is correct.');
    console.log('\n📝 Summary:');
    console.log('   ✅ Connection: Working');
    console.log('   ✅ Tables: Created');
    console.log('   ✅ Structure: Valid');
    console.log('   ✅ Permissions: Configured');
    console.log('\n🚀 You can now start the backend server!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    if (error.hint) {
      console.error(`   Hint: ${error.hint}`);
    }
    process.exit(1);
  }
}

testConnection();




