const fs = require('fs');

const inputFile = 'js/app_backup.js';
const outputFile = 'js/app.js';

try {
    console.log('Reading backup...');
    let content = fs.readFileSync(inputFile, 'utf8');
    
    // Normalize and remove EVERYTHING non-ASCII
    // This is the "Nuclear" part: we don't want any Ã³ or ðŸšŒ
    content = content.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^\x00-\x7F]/g, ' ');   // Replace remaining non-ASCII with space
        
    // Clean up double spaces created by the replacement
    content = content.replace(/  +/g, ' ');

    fs.writeFileSync(outputFile, content, 'utf8');
    console.log('Successfully reconstructed app.js');
} catch (e) {
    console.error('Error:', e.message);
}
