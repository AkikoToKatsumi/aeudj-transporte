const fs = require('fs');

const files = ['js/supabase-config.js', 'js/app.js', 'index.html'];

files.forEach(f => {
    try {
        console.log(`Processing ${f}...`);
        let content = fs.readFileSync(f, 'utf8');
        
        // Normalize and remove accents/non-ASCII
        content = content.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove accents
            .replace(/[^\x00-\x7F]/g, ' ');   // Replace remaining non-ASCII with space
            
        fs.writeFileSync(f, content, 'utf8');
        console.log(`Successfully sanitized ${f}`);
    } catch (e) {
        console.error(`Error processing ${f}:`, e.message);
    }
});
