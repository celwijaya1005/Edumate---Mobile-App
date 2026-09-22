// Inspeksi kolom 13 tabel yang ada di database Edumate
const SUPABASE_URL = 'https://zcvxwnwgxyadxkxmhzqg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpjdnh3bndneHlhZHhreG1oenFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNDc5MjIsImV4cCI6MjEwMDcyMzkyMn0.PUwST2KzE1lNVUAfUTV0TL9XACQQTUxHRpew2ojz5ic';
const HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
};

const TABLES = [
  'profiles', 'categories', 'modules', 'module_contents',
  'quizzes', 'quiz_questions', 'quiz_attempts',
  'vouchers', 'user_vouchers',
  'mentor_profiles', 'mentor_verification_documents',
  'mentor_bookings', 'payments'
];

async function main() {
  // Coba ambil swagger/openapi dulu untuk kolom lengkap
  const openApi = await fetch(`${SUPABASE_URL}/rest/v1/`, { headers: HEADERS });
  const spec = await openApi.json();
  
  if (spec && spec.definitions) {
    console.log('=== Kolom Tabel dari OpenAPI Schema ===\n');
    for (const table of TABLES) {
      const def = spec.definitions[table];
      if (def && def.properties) {
        const cols = Object.entries(def.properties).map(([k, v]) => `${k}(${v.type || v.format || 'ref'})`);
        console.log(`TABLE: ${table}`);
        console.log(`  ${cols.join(', ')}\n`);
      } else {
        console.log(`TABLE: ${table} - tidak ditemukan di schema\n`);
      }
    }
  } else {
    // fallback: query 1 row tiap tabel
    console.log('OpenAPI tidak tersedia, query 1 row per tabel...\n');
    for (const table of TABLES) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, { headers: HEADERS });
      const body = await r.text();
      let parsed;
      try { parsed = JSON.parse(body); } catch { parsed = null; }
      
      if (r.status === 200 && Array.isArray(parsed)) {
        if (parsed.length > 0) {
          console.log(`TABLE: ${table}`);
          console.log(`  Columns: ${Object.keys(parsed[0]).join(', ')}`);
          console.log(`  Row: ${JSON.stringify(parsed[0]).substring(0, 250)}\n`);
        } else {
          console.log(`TABLE: ${table} - kosong (tabel ada, tidak ada data)\n`);
        }
      } else {
        console.log(`TABLE: ${table} - ${r.status}: ${body.substring(0, 120)}\n`);
      }
    }
  }
}
main().catch(console.error);
