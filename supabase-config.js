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

window.transportSchedules = transportSchedules;
window.getCycleDate = getCycleDate;
window.formatDate = formatDate;
