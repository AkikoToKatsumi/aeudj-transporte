const SUPABASE_URL = 'https://irjwxegepkznqrisbrys.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlyand4ZWdlcGt6bnFyaXNicnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjk0NDIsImV4cCI6MjA5MTc0NTQ0Mn0.TZOhsy0ghfmjK8rd4GWcgbtOLpERKRJ62mjqc5gaYOM';

const headers = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

async function testOtherTables() {
  console.log('Testing INSERT on votos...');
  const resVoto = await fetch(`${SUPABASE_URL}/rest/v1/votos`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      usuario_id: '9d7cf4a3-282b-47a4-9e51-62aa6f223d60',
      nombre: 'Test User',
      matricula: '20269999',
      horario: '7:00 AM Jarabacoa -> La Vega',
      fecha: '2026-09-28',
      se_monto: 1
    })
  });
  console.log('INSERT votos status:', resVoto.status, await resVoto.text());
}

testOtherTables().catch(console.error);
