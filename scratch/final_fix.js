const fs = require('fs');

const header = fs.readFileSync('scratch/app_header.js', 'utf8');
const corrupted = fs.readFileSync('app.js', 'utf8');

function extractLastBlock(content, pattern) {
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
    
    // Clean up indentation during extraction
    const block = content.substring(startIdx, endIdx);
    const lines = block.split('\n');
    const firstLineMatch = lines[0].match(/^(\s*)/);
    const indentPrefix = firstLineMatch ? firstLineMatch[1] : '';
    
    return lines.map(line => {
        if (line.startsWith(indentPrefix)) return line.substring(indentPrefix.length);
        return line.trimStart();
    }).join('\n');
}

const functions = [
    'function initIndexPage()',
    'function initVotarPage()',
    'async function initListaPage()',
    'function initAdminPage()',
    'function initVoluntarioPage()',
    'function initCambiosPage()',
    'function initNoSubieronPage()',
    'function validateEmail(email)',
    'function escapeHtml(text)',
    'function formatTime(date)',
    'function horarioAMinutos(horario)',
    'function hashString(str)',
    'window.notificarAccion = async function(tipo)',
    'window.promoverDeEspera = async function(fecha, horario)',
    'window.abrirModalEspera = function()',
    'window.cerrarModalEspera = function()'
];

let finalOutput = header + '\n\n';

functions.forEach(f => {
    const code = extractLastBlock(corrupted, f);
    if (code) {
        finalOutput += '\n\n' + code;
    } else {
        console.log('MISSING:', f);
    }
});

fs.writeFileSync('app.js', finalOutput);
console.log('Emergency Repair COMPLETE.');
