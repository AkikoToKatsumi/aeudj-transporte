const fs = require('fs');
const path = 'app.js';
const content = fs.readFileSync(path, 'utf8');

function getBlock(name, startPattern) {
    const startIdx = content.indexOf(startPattern);
    if (startIdx === -1) return null;
    
    let b = 0;
    let endIdx = -1;
    let foundOpen = false;
    
    for (let i = startIdx; i < content.length; i++) {
        if (content[i] === '{') {
            b++;
            foundOpen = true;
        } else if (content[i] === '}') {
            b--;
        }
        
        if (foundOpen && b === 0) {
            endIdx = i + 1;
            break;
        }
    }
    
    if (endIdx === -1) return null;
    let block = content.substring(startIdx, endIdx);
    
    // Normalize indentation: remove leading spaces from each line based on the first line's indentation
    const lines = block.split('\n');
    const firstLineMatch = lines[0].match(/^(\s*)/);
    const indent = firstLineMatch ? firstLineMatch[1] : '';
    
    return lines.map(l => {
        if (l.startsWith(indent)) return l.substring(indent.length);
        return l.trimStart();
    }).join('\n');
}

const header = content.substring(0, content.indexOf('// ============================================\n// PGINA INDEX'));

const blocks = [
    { name: 'Index', pattern: 'function initIndexPage() {' },
    { name: 'Votar', pattern: 'function initVotarPage() {' },
    { name: 'Lista', pattern: 'async function initListaPage() {' },
    { name: 'Admin', pattern: 'function initAdminPage() {' },
    { name: 'Voluntario', pattern: 'function initVoluntarioPage() {' },
    { name: 'Cambios', pattern: 'function initCambiosPage() {' },
    { name: 'NoSubieron', pattern: 'function initNoSubieronPage() {' },
    { name: 'UtilitiesHeader', pattern: '// ============================================\n// UTILIDADES' },
    { name: 'ValidateEmail', pattern: 'function validateEmail(email) {' },
    { name: 'EscapeHtml', pattern: 'function escapeHtml(text) {' },
    { name: 'FormatTime', pattern: 'function formatTime(date) {' },
    { name: 'HorarioAMinutos', pattern: 'function horarioAMinutos(horario)' },
    { name: 'HashString', pattern: 'function hashString(str) {' },
    { name: 'NotificarAccion', pattern: 'window.notificarAccion = async function(tipo) {' },
    { name: 'PromoverDeEspera', pattern: 'window.promoverDeEspera = async function(fecha, horario) {' },
    { name: 'AbrirModalEspera', pattern: 'window.abrirModalEspera = function() {' },
    { name: 'CerrarModalEspera', pattern: 'window.cerrarModalEspera = function() {' }
];

let newContent = header;

blocks.forEach(b => {
    const code = getBlock(b.name, b.pattern);
    if (code) {
        newContent += '\n' + code + '\n';
    } else {
        console.log('Skipping missing block:', b.name);
    }
});

// Final cleanup: ensure 2 spaces indentation
const finalLines = newContent.split('\n').map(line => {
    // Simple indentation fix for the rebuilt blocks
    // (Actual block extraction already normalized them to 0, so we might need a bit of re-indenting for nested if/function)
    // Actually, the getBlock normalize logic was a bit naive. Let's just write and check.
    return line;
});

fs.writeFileSync(path, newContent);
console.log('Reconstruction complete.');
