const fs = require('fs');
const path = require('path');

// Read .env.local or .env
for (const envFile of ['.env.local', '.env']) {
  const p = path.join(__dirname, '..', envFile);
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const k = trimmed.slice(0, eq).trim();
        const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const products = await prisma.product.findMany();
    console.log('Total products in Supabase:', products.length);
    for (const p of products) {
      console.log(`- [${p.sku}] ${p.name} | Cost: ${p.costPrice} | Sell: ${p.sellingPrice} | Stock: ${p.stock}`);
    }

    // Check columns of products table
    try {
      const cols = await prisma.$queryRawUnsafe(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'products'
      `);
      console.log('Columns in products table:', cols);
    } catch (e) {
      console.log('Failed to query columns:', e.message);
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
