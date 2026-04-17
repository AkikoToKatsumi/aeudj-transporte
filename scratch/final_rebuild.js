const fs = require('fs');
const path = 'app.js';
const content = fs.readFileSync(path, 'utf8');

function extractLastBlock(pattern) {
    const indices = [];
    let idx = content.indexOf(pattern);
    while (idx !== -1) {
        indices.push(idx);
        idx = content.indexOf(pattern, idx + 1);
    }
    
    if (indices.length === 0) return null;
    const startIdx = indices[indices.length - 1];
    
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
    return content.substring(startIdx, endIdx).split('\n').map(l => l.trimEnd()).join('\n');
}

const headerPart = content.substring(0, content.indexOf('function initIndexPage'));

const parts = [
    extractLastBlock('function initIndexPage()'),
    extractLastBlock('function initVotarPage()'),
    extractLastBlock('async function initListaPage()'),
    extractLastBlock('function initAdminPage()'),
    extractLastBlock('function initVoluntarioPage()'),
    extractLastBlock('function initCambiosPage()'),
    extractLastBlock('function initNoSubieronPage()'),
    '// ============================================\n// UTILIDADES\n// ============================================',
    extractLastBlock('function validateEmail(email)'),
    extractLastBlock('function escapeHtml(text)'),
    extractLastBlock('function formatTime(date)'),
    extractLastBlock('function horarioAMinutos(horario)'), // The latest one uses (horario)
    extractLastBlock('function hashString(str)'),
    extractLastBlock('window.notificarAccion = async function(tipo)'),
    extractLastBlock('window.promoverDeEspera = async function(fecha, horario)'),
    extractLastBlock('window.abrirModalEspera = function()'),
    extractLastBlock('window.cerrarModalEspera = function()')
];

const cleanedHeader = headerPart.split('\n').map(l => l.trimRight()).join('\n').trim() + '\n\n';
const finalContent = cleanedHeader + parts.filter(p => p).join('\n\n') + '\n';

fs.writeFileSync(path, finalContent);
console.log('Final reconstruction finished.');
