const fs = require('fs');
global.window = {};
require('./data.js');

const questions = global.window.data.questions || [];
const translations = global.window.data.translations || [];

console.log(`Questions count: ${questions.length}`);
console.log(`Translations count: ${translations.length}`);

fs.writeFileSync('questions.json', JSON.stringify(questions, null, 2), 'utf-8');
fs.writeFileSync('translations.json', JSON.stringify(translations, null, 2), 'utf-8');

console.log('Saved questions.json and translations.json');
