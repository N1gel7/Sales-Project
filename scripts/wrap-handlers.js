import fs from 'fs';
import path from 'path';

const apiDir = path.resolve('api');
const ignoredFiles = ['login.js', 'auth.js', 'health.js'];
const ignoredDirs = ['_lib', 'auth']; // auth contains the new login and me

function applyWrapper(dirPath, relativeLevel = 0) {
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!ignoredDirs.includes(item)) {
        applyWrapper(fullPath, relativeLevel + 1);
      }
    } else if (stat.isFile() && item.endsWith('.js')) {
      if (ignoredFiles.includes(item) && relativeLevel === 0) continue;

      let content = fs.readFileSync(fullPath, 'utf8');

      if (!content.includes('export default async function handler') || content.includes('withAuth(')) {
        continue;
      }

      const importPath = relativeLevel === 0 ? './_lib/authMiddleware.js' : '../'.repeat(relativeLevel) + '_lib/authMiddleware.js';
      
      const newImport = `import { withAuth } from '${importPath}';\n\n`;
      content = newImport + content;
      content = content.replace('export default async function handler', 'async function handler');
      content += `\n\nexport default withAuth(handler);\n`;

      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`Wrapped ${path.relative(apiDir, fullPath)}`);
    }
  }
}

applyWrapper(apiDir);
