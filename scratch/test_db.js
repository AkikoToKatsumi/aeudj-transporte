

const SUPABASE_URL = 'https://irjwxegepkznqrisbrys.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlyand4ZWdlcGt6bnFyaXNicnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjk0NDIsImV4cCI6MjA5MTc0NTQ0Mn0.TZOhsy0ghfmjK8rd4GWcgbtOLpERKRJ62mjqc5gaYOM';

async function test() {
  const resPens = await fetch(`${SUPABASE_URL}/rest/v1/penalidades?select=*`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  console.log('Penalidades status:', resPens.status);
  const pens = await resPens.json();
  console.log('Penalidades:', pens);

  const resFaltas = await fetch(`${SUPABASE_URL}/rest/v1/faltas?select=*`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  console.log('Faltas status:', resFaltas.status);
  const faltas = await resFaltas.json();
  console.log('Faltas:', faltas);
}

test();
