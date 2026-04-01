import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Enable CORS for frontend development testing
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));

// Simulate the serverless environment parsing
app.use(express.json());
app.use(cookieParser());

const apiDir = path.join(__dirname, 'api');

// Recursively load all your Serverless Handler files
async function loadRoutes(dir, basePath = '/api') {
  if (!fs.existsSync(dir)) return;
  
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    // Ignore internal helper folders (like `_lib`)
    if (stat.isDirectory()) {
      if (!file.startsWith('_')) {
        await loadRoutes(fullPath, `${basePath}/${file}`);
      }
    } else if (file.endsWith('.js') && !file.startsWith('_')) {
      const routeName = file.replace('.js', '');
      const routePath = `${basePath}/${routeName === 'index' ? '' : routeName}`;
      
      try {
        const moduleUrl = `file://${fullPath.replace(/\\/g, '/')}`;
        const module = await import(moduleUrl);
        const serverlessHandler = module.default;
        
        if (serverlessHandler) {
          app.all(routePath, async (req, res) => {
            try {
              req.query = req.query || {}; 
              // Route incoming HTTP traffic dynamically into your purely serverless functions
              await serverlessHandler(req, res);
            } catch (err) {
              console.error(`Error in Server Emulator [${routePath}]:`, err);
              if (!res.headersSent) {
                res.status(500).json({ error: 'Internal Server Error' });
              }
            }
          });
          console.log(`✅ Emulated Serverless Route: ${routePath}`);
        }
      } catch (err) {
         console.error(`❌ Failed to mount route ${routePath}:`, err.message);
      }
    }
  }
}

// Start your Local Developer Server emulator
loadRoutes(apiDir).then(() => {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 LOCAL SERVERLESS EMULATOR RUNNING`);
    console.log(`📡 Backend Listening: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
});
