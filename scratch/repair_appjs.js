const fs = require('fs');
const path = 'app.js';
let content = fs.readFileSync(path, 'utf8');
let lines = content.split(/\r?\n/);

let changed = false;

// Fix 1: Closing if(loginForm) and opening if(registerForm)
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("btn.textContent = 'Entrar';") && lines[i+1] && lines[i+1].includes("});")) {
        console.log("Found login form end at line", i+2);
        // Add the closing brace and the next if
        lines.splice(i + 2, 0, '  }');
        lines.splice(i + 3, 0, '');
        lines.splice(i + 4, 0, '  if (registerForm) {');
        changed = true;
        break; // Only once
    }
}

// Fix 2: Closing if(registerForm)
// We need to find the one after the first fix.
if (changed) {
    for (let i = 0; i < lines.length; i++) {
        // Find "Registrar" after index 400 approx
        if (i > 300 && lines[i].includes("btn.textContent = 'Registrar';") && lines[i+1] && lines[i+1].includes("});")) {
            console.log("Found register form end at line", i+2);
            lines.splice(i + 2, 0, '  }');
            break;
        }
    }
}

if (changed) {
    fs.writeFileSync(path, lines.join('\n'));
    console.log("File updated successfully.");
} else {
    console.error("Pattern not found!");
}
