export async function dbConnect(uri) {
  console.log('Database connection ignored (Mock Mode Active)');
  return { 
    connection: { 
      readyState: 1, // Connected
      db: { collection: () => ({ find: () => ({ lean: () => [] }) }) }
    } 
  };
}


