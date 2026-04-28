import 'dotenv/config';
import fs from 'fs';
import { v2 as cloudinary } from 'cloudinary';
import { supabase } from '../api/_lib/db.js';
import { uploadBufferToCloudinary } from '../api/_lib/cloudinary.js';

async function main() {
  console.log('Starting seed process...');

  const folder = process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || 'sales-project';

  try {
    console.log(`Deleting all Cloudinary resources in folder: ${folder}...`);
    let next_cursor = null;
    do {
      const result = await cloudinary.api.resources({
        type: 'upload',
        prefix: folder,
        max_results: 100,
        next_cursor
      });
      const publicIds = result.resources.map(r => r.public_id);
      if (publicIds.length > 0) {
        await cloudinary.api.delete_resources(publicIds);
        console.log(`Deleted ${publicIds.length} resources from Cloudinary.`);
      }
      next_cursor = result.next_cursor;
    } while (next_cursor);
    console.log('Cloudinary resources deleted.');
  } catch (error) {
    console.error('Error deleting Cloudinary resources:', error);
  }

  console.log('Deleting all rows from "uploads" table in Supabase...');
  const { error: deleteError } = await supabase.from('uploads').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteError) {
    console.error('Error clearing uploads table:', deleteError);
  } else {
    console.log('Uploads table cleared.');
  }

  console.log('Fetching users from Supabase...');
  const { data: users, error: userError } = await supabase.from('users').select('*');
  if (userError || !users || users.length === 0) {
    console.error('Error fetching users or no users found:', userError);
    return;
  }
  
  // Pick some users for variety
  const salesUsers = users.filter(u => u.role === 'sales');
  const otherUsers = users.filter(u => u.role !== 'sales');
  
  const user1 = salesUsers[0] || users[0];
  const user2 = salesUsers[1] || otherUsers[0] || users[0];

  const imagesToUpload = [
    {
      path: 'C:\\Users\\Appeadu\\.gemini\\antigravity\\brain\\779fd419-d100-402b-ab7b-2b4215551e5d\\perfume_product_1777404847741.png',
      filename: 'perfume_product.png',
      note: 'Customer was highly pleased with the luxury perfume packaging and scent. Recommends increasing stock.',
      user_id: user1.id,
      coords: { lat: 5.6037, lng: -0.1870 }
    },
    {
      path: 'C:\\Users\\Appeadu\\.gemini\\antigravity\\brain\\779fd419-d100-402b-ab7b-2b4215551e5d\\laptop_product_1777404898534.png',
      filename: 'laptop_product.png',
      note: 'New laptop model display set up at the flagship store. Store manager approved the placement.',
      user_id: user2.id,
      coords: { lat: 5.6145, lng: -0.2052 }
    },
    {
      path: 'C:\\Users\\Appeadu\\.gemini\\antigravity\\brain\\779fd419-d100-402b-ab7b-2b4215551e5d\\drink_product_1777405123545.png',
      filename: 'drink_product.png',
      note: 'Energy drink promotion endcap fully stocked. High visibility area.',
      user_id: user1.id,
      coords: { lat: 5.6500, lng: -0.1800 }
    },
    {
      path: 'C:\\Users\\Appeadu\\.gemini\\antigravity\\brain\\779fd419-d100-402b-ab7b-2b4215551e5d\\skincare_product_1777406062065.png',
      filename: 'skincare_product.png',
      note: 'Skincare line is performing exceptionally well. Captured product shot for the Q2 sales report.',
      user_id: user2.id,
      coords: { lat: 5.5560, lng: -0.1969 }
    },
    {
      path: 'C:\\Users\\Appeadu\\.gemini\\antigravity\\brain\\779fd419-d100-402b-ab7b-2b4215551e5d\\sales_visit_1777406117783.png',
      filename: 'sales_visit.png',
      note: 'Successfully closed the deal with the regional distributor. Attached proof of meeting.',
      user_id: user1.id,
      coords: { lat: 5.6321, lng: -0.2105 }
    }
  ];

  console.log('Uploading new images and inserting records...');
  
  const inserts = [];
  
  for (const img of imagesToUpload) {
    if (!fs.existsSync(img.path)) {
      console.warn(`File not found, skipping: ${img.path}`);
      continue;
    }
    
    console.log(`Uploading ${img.filename}...`);
    const buffer = fs.readFileSync(img.path);
    
    try {
      const result = await uploadBufferToCloudinary(buffer, {
        originalname: img.filename,
        mimetype: 'image/png'
      });
      
      inserts.push({
        filename: img.filename,
        type: 'image/png',
        note: img.note,
        file_url: result.optimized_url || result.secure_url,
        coords: img.coords,
        user_id: img.user_id,
        transcription: null,
        translation: null
      });
      
      console.log(`Successfully uploaded ${img.filename}`);
    } catch (err) {
      console.error(`Failed to upload ${img.filename}:`, err);
    }
  }
  
  if (inserts.length > 0) {
    console.log('Inserting records into Supabase...');
    const { error: insertError } = await supabase.from('uploads').insert(inserts);
    if (insertError) {
      console.error('Error inserting records:', insertError);
    } else {
      console.log(`Successfully inserted ${inserts.length} upload records.`);
    }
  }

  console.log('Seed process complete!');
}

main().catch(console.error);
