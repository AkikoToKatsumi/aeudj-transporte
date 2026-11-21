// supabase-config.js - Configuracion de Supabase

const SUPABASE_URL = 'https://irjwxegepkznqrisbrys.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlyand4ZWdlcGt6bnFyaXNicnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjk0NDIsImV4cCI6MjA5MTc0NTQ0Mn0.TZOhsy0ghfmjK8rd4GWcgbtOLpERKRJ62mjqc5gaYOM';

let supabaseClient;

try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase configurado');
} catch (error) {
    console.error('❌ Error configurando Supabase:', error);
}

window.supabase = supabaseClient;
// Nota: SUPABASE_URL y SUPABASE_KEY NO se exponen en window.
// La anon key es pública por diseño, pero no necesitamos facilitarla.

const transportSchedules = [
  { time: "7:00 AM",  route: "Jarabacoa -> La Vega", fullText: "7:00 AM Jarabacoa -> La Vega", group: "manana" },
  { time: "9:00 AM",  route: "Jarabacoa -> La Vega", fullText: "9:00 AM Jarabacoa -> La Vega", group: "manana" },
  { time: "12:10 PM", route: "La Vega -> Jarabacoa", fullText: "12:10 PM La Vega -> Jarabacoa", group: "manana" },
  { time: "12:10 PM", route: "La Vega -> Jarabacoa", fullText: "12:10 PM La Vega -> Jarabacoa", group: "tarde" },
  { time: "1:00 PM",  route: "Jarabacoa -> La Vega", fullText: "1:00 PM Jarabacoa -> La Vega", group: "tarde" },
  { time: "2:15 PM",  route: "La Vega -> Jarabacoa", fullText: "2:15 PM La Vega -> Jarabacoa", group: "tarde" },
  { time: "3:00 PM",  route: "Jarabacoa -> La Vega", fullText: "3:00 PM Jarabacoa -> La Vega", group: "tarde" },
  { time: "4:10 PM",  route: "La Vega -> Jarabacoa", fullText: "4:10 PM La Vega -> Jarabacoa", group: "tarde" },
  { time: "5:00 PM",  route: "Jarabacoa -> La Vega", fullText: "5:00 PM Jarabacoa -> La Vega", group: "tarde" },
  { time: "6:00 PM",  route: "La Vega -> Jarabacoa", fullText: "6:00 PM La Vega -> Jarabacoa", group: "tarde" },
  { time: "8:00 PM",  route: "La Vega -> Jarabacoa", fullText: "8:00 PM La Vega -> Jarabacoa", group: "tarde" },
  { time: "10:00 PM", route: "La Vega -> Jarabacoa", fullText: "10:00 PM La Vega -> Jarabacoa", group: "tarde" }
];

function getCycleDate() {
  const ahora = new Date();
  const hora = ahora.getHours();
  let targetDate = ahora;
  if (hora >= 22) {
    targetDate = new Date(ahora);
    targetDate.setDate(targetDate.getDate() + 1);
  }
  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Parsea la hora de un horario (ej. "7:00 AM Jarabacoa -> La Vega") y fecha ("YYYY-MM-DD")
 * en un Date usando la zona horaria de República Dominicana (UTC-4).
 */
function getScheduledDateTime(horario, fecha) {
  if (!horario || !fecha) return null;
  const match = String(horario).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  const iso = `${fecha}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-04:00`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Retorna true si ya pasó la hora del horario (con un margen de gracia en minutos, por defecto 60 min).
 */
function isScheduleExpired(horario, fecha, graceMinutes = 60) {
  const scheduled = getScheduledDateTime(horario, fecha);
  if (!scheduled) return false;
  return Date.now() >= (scheduled.getTime() + graceMinutes * 60 * 1000);
}

/**
 * Marca automáticamente como se_monto = 1 ("Sí subió") los votos pendientes (se_monto IS NULL)
 * cuyo horario ya pasó, evitando faltas o bloqueos cuando un voluntario no pasa la lista.
 * No crea faltas, penalidades ni otorga puntos de voluntario.
 */
async function autoMarkExpiredUnpassedVotes(votosList = null, onlyUserId = null) {
  if (!supabaseClient) return 0;
  try {
    let candidates = votosList;
    if (!Array.isArray(candidates)) {
      let query = supabaseClient
        .from('votos')
        .select('id, horario, fecha, se_monto, usuario_id')
        .is('se_monto', null)
        .lte('fecha', getCycleDate())
        .limit(1000);
      if (onlyUserId) query = query.eq('usuario_id', onlyUserId);
      const { data, error } = await query;
      if (error || !data) return 0;
      candidates = data;
    }

    const expired = candidates.filter(v => {
      if (v.se_monto !== null && v.se_monto !== undefined) return false;
      if (onlyUserId && v.usuario_id !== onlyUserId) return false;
      return isScheduleExpired(v.horario, v.fecha, 60);
    });

    if (expired.length === 0) return 0;

    const expiredIds = expired.map(v => v.id).filter(Boolean);
    let updatedCount = 0;

    for (let i = 0; i < expiredIds.length; i += 100) {
      const chunk = expiredIds.slice(i, i + 100);
      const { error } = await supabaseClient
        .from('votos')
        .update({ se_monto: 1 })
        .in('id', chunk)
        .is('se_monto', null);

      if (!error) {
        updatedCount += chunk.length;
        expired.forEach(v => {
          if (chunk.includes(v.id)) v.se_monto = 1;
        });
      } else {
        console.warn('autoMarkExpiredUnpassedVotes error:', error.message);
      }
    }

    return updatedCount;
  } catch (err) {
    console.warn('autoMarkExpiredUnpassedVotes exception:', err);
    return 0;
  }
}

window.transportSchedules = transportSchedules;
window.getCycleDate = getCycleDate;
window.formatDate = formatDate;
window.getScheduledDateTime = getScheduledDateTime;
window.isScheduleExpired = isScheduleExpired;
window.autoMarkExpiredUnpassedVotes = autoMarkExpiredUnpassedVotes;
