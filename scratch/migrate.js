
const SUPABASE_URL = 'https://irjwxegepkznqrisbrys.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlyand4ZWdlcGt6bnFyaXNicnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjk0NDIsImV4cCI6MjA5MTc0NTQ0Mn0.TZOhsy0ghfmjK8rd4GWcgbtOLpERKRJ62mjqc5gaYOM';

async function migrate() {
  console.log('Fetching votos with se_monto = 0...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/votos?se_monto=eq.0&select=*`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const votos = await res.json();
  console.log('Total votos que no subieron:', votos.length);

  for (const v of votos) {
    if (!v.usuario_id) continue;
    
    // Check if falta exists
    const resCheck = await fetch(`${SUPABASE_URL}/rest/v1/faltas?voto_id=eq.${v.id}&select=id`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    const check = await resCheck.json();
    
    if (check.length === 0) {
      // Insert falta
      await fetch(`${SUPABASE_URL}/rest/v1/faltas`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          usuario_id: v.usuario_id,
          voto_id: v.id,
          nombre: v.nombre,
          matricula: v.matricula,
          email: v.email || '',
          horario: v.horario,
          fecha: v.fecha
        })
      });
      console.log('Inserted falta for voto_id:', v.id);
    }
  }

  // Now aggregate and update penalidades
  console.log('Fetching all faltas to aggregate...');
  const resAll = await fetch(`${SUPABASE_URL}/rest/v1/faltas?select=*`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const allFaltas = await resAll.json();
  
  const userStats = {};
  for (const f of allFaltas) {
    if (!userStats[f.usuario_id]) {
      userStats[f.usuario_id] = {
        usuario_id: f.usuario_id,
        nombre: f.nombre,
        matricula: f.matricula,
        email: f.email,
        count: 0
      };
    }
    userStats[f.usuario_id].count++;
  }

  console.log('Upserting penalidades...');
  for (const uid in userStats) {
    const stats = userStats[uid];
    const penalizado = stats.count >= 3;
    
    // UPSERT directly using POST with Prefer: resolution=merge-duplicates
    await fetch(`${SUPABASE_URL}/rest/v1/penalidades`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        usuario_id: stats.usuario_id,
        nombre: stats.nombre,
        matricula: stats.matricula,
        email: stats.email,
        total_faltas: stats.count,
        penalizado: penalizado,
        fecha_penalidad: penalizado ? '2026-05-15' : null,
        updated_at: new Date().toISOString()
      })
    });
  }
  
  console.log('Migration completed successfully!');
}

migrate();
