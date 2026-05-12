const fs = require('fs');
const path = require('path');

function findTables(dir) {
    let results = [];
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!fullPath.includes('.git') && !fullPath.includes('scratch')) {
                results = results.concat(findTables(fullPath));
            }
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.html')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const matches = content.match(/from\(['"](.*?)['"]\)/g);
            if (matches) {
                results = results.concat(matches.map(m => m.replace(/from\(['"]|['"]\)/g, '')));
            }
        }
    }
    return results;
}

const tables = [...new Set(findTables(__dirname + '/..'))];
console.log(tables);
