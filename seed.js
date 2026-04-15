import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function main() {
  console.log('Seeding categories...');
  const catRes = await supabase.from('categories').insert([
    { name: 'Beverages', fields: [{ key: 'size_ml', type: 'number' }] },
    { name: 'Electronics', fields: [{ key: 'warranty_years', type: 'number' }] },
    { name: 'Office Supplies', fields: [] }
  ]).select('*');
  
  if (catRes.error) console.error(catRes.error);
  else console.log('Categories seeded:', catRes.data.map(c => c.name));

  console.log('Seeding products...');
  const prodRes = await supabase.from('products').insert([
    { name: 'Coca-Cola 500ml', category: 'Beverages', price: 5.50 },
    { name: 'Fanta Orange 500ml', category: 'Beverages', price: 5.50 },
    { name: 'Sprite 500ml', category: 'Beverages', price: 5.50 },
    { name: 'A4 Printer Paper 500p', category: 'Office Supplies', price: 45.00 },
    { name: 'Blue Bic Pens 10p', category: 'Office Supplies', price: 12.50 },
    { name: 'Dell Latitude', category: 'Electronics', price: 8500.00 }
  ]).select('*');

  if (prodRes.error) console.error(prodRes.error);
  else console.log('Products seeded:', prodRes.data.map(p => p.name));
}

main().catch(console.error);
