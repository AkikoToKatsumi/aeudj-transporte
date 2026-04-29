const fs = require('fs');

const content = fs.readFileSync('app.js', 'utf8');
const lines = content.split(/\r?\n/);

let start = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('async function loadLista()') && i > 700) {
        start = i;
        break;
    }
}

if (start !== -1) {
    for (let i = start; i < start + 10; i++) {
        if (lines[i].includes(".from('votos')")) {
            let q_start = i - 1;
            let q_end = -1;
            for (let j = i; j < i + 10; j++) {
                if (lines[j].includes(';')) {
                    q_end = j;
                    break;
                }
            }
            if (q_end !== -1) {
                lines.splice(q_start, q_end - q_start + 1, "  const { data: votos, error } = await supabase.functions.invoke('obtener-lista-segura');");
                fs.writeFileSync('app.js', lines.join('\n'), 'utf8');
                console.log('Successfully updated app.js');
                process.exit(0);
            }
        }
    }
}
console.log('Could not find the query in app.js');
process.exit(1);
