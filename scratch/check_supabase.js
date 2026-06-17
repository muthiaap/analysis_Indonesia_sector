const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gwen-supa-rinjani.digi46.id/';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYyNDQ4NDAwLCJleHAiOjE5MjAyMTQ4MDB9.2rAwm_i0PqGR-ohmyI7mNM1xrNLRf7R1m1EbvnSetAY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const possibleTableNames = ['poi_bank_comparison', 'pois', 'poi_data', 'db_pois', 'tbl_pois', 'poi'];
  for (const name of possibleTableNames) {
    const { count, error } = await supabase
      .from(name)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`Table ${name} error: ${error.message}`);
    } else {
      console.log(`Table ${name} exists with ${count} records!`);
      
      // Let's query a sample of 5 records
      const { data, error: dataError } = await supabase
        .from(name)
        .select('*')
        .limit(5);
      
      if (dataError) {
        console.log(`Failed to fetch data from ${name}: ${dataError.message}`);
      } else {
        console.log(`Sample from ${name}:`, JSON.stringify(data, null, 2));
      }
    }
  }
}

check().catch(console.error);
