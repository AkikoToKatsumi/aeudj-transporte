// firebase-config.js - Versión CDN ES modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyCEExKRz5L31LwzUZ9Aae6tyorxJ4ERyFk",
  authDomain: "aeudj-94bc2.firebaseapp.com",
  projectId: "aeudj-94bc2",
  storageBucket: "aeudj-94bc2.firebasestorage.app",
  messagingSenderId: "466789232026",
  appId: "1:466789232026:web:a066439702cc908ac05e23",
  measurementId: "G-XB9YS85CN0"
};

let app;
let db;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log('✅ Firebase conectado correctamente');
} catch (error) {
  console.error('❌ Error al conectar Firebase:', error);
  alert('Error de conexión a la base de datos. Verifica tu configuración.');
}

// Configuración de horarios
const transportSchedules = [
  { time: "7:00 AM",  route: "Jarabacoa → La Vega", fullText: "7:00 AM Jarabacoa → La Vega" },
  { time: "9:00 AM",  route: "Jarabacoa → La Vega", fullText: "9:00 AM Jarabacoa → La Vega" },
  { time: "12:10 PM", route: "La Vega → Jarabacoa", fullText: "12:10 PM La Vega → Jarabacoa" },
  { time: "1:00 PM",  route: "Jarabacoa → La Vega", fullText: "1:00 PM Jarabacoa → La Vega" },
  { time: "2:15 PM",  route: "La Vega → Jarabacoa", fullText: "2:15 PM La Vega → Jarabacoa" },
  { time: "3:00 PM",  route: "Jarabacoa → La Vega", fullText: "3:00 PM Jarabacoa → La Vega" },
  { time: "4:10 PM",  route: "La Vega → Jarabacoa", fullText: "4:10 PM La Vega → Jarabacoa" },
  { time: "5:00 PM",  route: "Jarabacoa → La Vega", fullText: "5:00 PM Jarabacoa → La Vega" },
  { time: "6:00 PM",  route: "La Vega → Jarabacoa", fullText: "6:00 PM La Vega → Jarabacoa" },
  { time: "8:00 PM",  route: "La Vega → Jarabacoa", fullText: "8:00 PM La Vega → Jarabacoa" },
  { time: "10:00 PM", route: "La Vega → Jarabacoa", fullText: "10:00 PM La Vega → Jarabacoa" }
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

export { db, transportSchedules, getCycleDate, formatDate };