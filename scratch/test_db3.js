
const SUPABASE_URL = 'https://irjwxegepkznqrisbrys.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlyand4ZWdlcGt6bnFyaXNicnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjk0NDIsImV4cCI6MjA5MTc0NTQ0Mn0.TZOhsy0ghfmjK8rd4GWcgbtOLpERKRJ62mjqc5gaYOM';

async function test() {
  // Try inserting a dummy falta to see if there's any RLS or table missing error
  const res = await fetch(`${SUPABASE_URL}/rest/v1/faltas`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      usuario_id: 'test-user-id',
      voto_id: 999999,
      nombre: 'Test User',
      matricula: '123456',
      email: 'test@test.com',
      horario: '1:00 PM',
      fecha: '2026-05-15'
    })
  });
  const data = await res.json();
  console.log('Insert Result:', data);
  console.log('Status:', res.status);
}

test();
