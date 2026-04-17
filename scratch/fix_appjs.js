const fs = require('fs');
const path = 'app.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Add closing brace for if(loginForm)
// We look for the end of the submit listener and insert the brace
const loginEndRegex = /(  btn\.textContent = 'Entrar';\s+ }\);)/;
if (content.match(loginEndRegex)) {
    console.log('Found login form end. Inserting brace...');
    content = content.replace(loginEndRegex, '$1\n  }');
} else {
    console.error('Could not find login form end pattern!');
}

// 2. Wrap registerForm logic in if(registerForm) { ... }
// We look for where it starts
const registerStartRegex = /(  registerForm\.addEventListener\('submit')/;
if (content.match(registerStartRegex)) {
    console.log('Found register form start. Wrapping...');
    content = content.replace(registerStartRegex, '  if (registerForm) {\n  $1');
}

// And where it ends (before validateEmail)
const registerEndRegex = /(  btn\.textContent = 'Registrar';\s+  }\);)(\s+function validateEmail)/;
if (content.match(registerEndRegex)) {
    console.log('Found register form end. Closing wrap...');
    content = content.replace(registerEndRegex, '$1\n  }$2');
}

// 3. Remove the orphaned brace at 1492 (approx)
// It's the one between isHorarioActivo and initCambiosPage boundary
const orphanedBraceRegex = /}\s+}\s+(\/\/ =+ \n\/\/ PGINA CAMBIOS)/;
if (content.match(orphanedBraceRegex)) {
    console.log('Found orphaned brace at 1492. Removing...');
    content = content.replace(orphanedBraceRegex, '}\n\n$1');
}

fs.writeFileSync(path, content);
console.log('Update complete.');
