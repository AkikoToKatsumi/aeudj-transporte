// supabase-config.js - Configuracion de Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://irjwxegepkznqrisbrys.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlyand4ZWdlcGt6bnFyaXNicnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxNjk0NDIsImV4cCI6MjA5MTc0NTQ0Mn0.TZOhsy0ghfmjK8rd4GWcgbtOLpERKRJ62mjqc5gaYOM';

let supabase;

try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Supabase configurado');
} catch (error) {
    console.error('❌ Error configurando Supabase:', error);
}

const transportSchedules = [
  { time: "7:00 AM",  route: "Jarabacoa -> La Vega", fullText: "7:00 AM Jarabacoa -> La Vega", group: "mañana" },
  { time: "9:00 AM",  route: "Jarabacoa -> La Vega", fullText: "9:00 AM Jarabacoa -> La Vega", group: "mañana" },
  { time: "12:10 PM", route: "La Vega -> Jarabacoa", fullText: "12:10 PM La Vega -> Jarabacoa", group: "mañana" },
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
  if (hora >= 22) {
    const manana = new Date(ahora);
    manana.setDate(manana.getDate() + 1);
    return manana.toISOString().split('T')[0];
  }
  return ahora.toISOString().split('T')[0];
}

function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

export { supabase, transportSchedules, getCycleDate, formatDate, SUPABASE_URL, SUPABASE_KEY };
