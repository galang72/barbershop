const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../lib/db.ts');
let content = fs.readFileSync(dbPath, 'utf-8');

// Replace any residual git conflict markers
// We want to keep the feature logic while ensuring CASH_OUT does NOT write to expenses!
const regex = /<<<<<<< HEAD[\r\n]+([\s\S]*?)=======[\r\n]+([\s\S]*?)>>>>>>> [^\r\n]+/g;
let count = 0;
content = content.replace(regex, (match, head, incoming) => {
  count++;
  if (incoming.includes('// Jika CASH_OUT dan bukan dari EXPENSE, simpan juga ke expenses')) {
    // Drop the sync to expenses
    return '';
  }
  return incoming;
});

// Also remove any remaining markers if mismatched
content = content.replace(/<<<<<<< HEAD[\r\n]*/g, '');
content = content.replace(/=======[\r\n]*/g, '');
content = content.replace(/>>>>>>> [^\r\n]+[\r\n]*/g, '');

fs.writeFileSync(dbPath, content, 'utf-8');
console.log('Fixed lib/db.ts conflicts, count:', count);
