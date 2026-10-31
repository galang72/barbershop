const fs = require('fs');
const path = require('path');

function cleanFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace git conflict blocks:
  // <<<<<<< HEAD
  // ... (A)
  // =======
  // ... (B)
  // >>>>>>> ...
  // In our case, we want (B) for logic improvements except when specifically choosing,
  // or we can analyze which blocks exist.
  console.log('Processing:', filePath);
  
  const regex = /<<<<<<< HEAD[\r\n]+([\s\S]*?)=======[\r\n]+([\s\S]*?)>>>>>>> [^\r\n]+/g;
  let count = 0;
  content = content.replace(regex, (match, head, incoming) => {
    count++;
    // In lib/db.ts:
    // If incoming contains expenses sync into cashEntry, remove that sync:
    if (incoming.includes('// Jika CASH_OUT dan bukan dari EXPENSE, simpan juga ke expenses')) {
      return ''; // Keep nothing from that sync!
    }
    return incoming;
  });
  
  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Replaced ${count} conflict markers in ${filePath}`);
}

const files = [
  path.join(__dirname, '../app/(dashboard)/cash/page.tsx'),
  path.join(__dirname, '../app/(dashboard)/laporan/harian/page.tsx'),
  path.join(__dirname, '../app/(dashboard)/laporan/tahunan/page.tsx'),
  path.join(__dirname, '../app/(dashboard)/page.tsx'),
  path.join(__dirname, '../app/api/branch-reports/route.ts'),
  path.join(__dirname, '../lib/db.ts'),
];

files.forEach(cleanFile);
console.log('Done resolving conflict markers.');
