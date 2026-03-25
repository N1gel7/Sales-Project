# Serverless Deployment Guide (Vercel)

Converting to serverless means your backend and frontend are built and deployed together as a single unit on Vercel.

---

## 1. Project Structure for Vercel
Vercel expects your `api/` folder to be at the root of your project. 
- **Backend**: Each file in `/api/*.js` becomes an independent endpoint (e.g., `/api/login` comes from `/api/login.js`).
- **Frontend**: Since your React app is in `/sales-mgmt`, we use a `vercel.json` file to tell Vercel how to build it.

## 2. Configuration: `vercel.json`
Create a `vercel.json` in the root directory:

```json
{
  "builds": [
    { "src": "sales-mgmt/package.json", "use": "@vercel/static-build" },
    { "src": "api/**/*.js", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "api/$1.js" },
    { "src": "/(.*)", "dest": "sales-mgmt/$1" }
  ]
}
```

## 3. Deployment Steps
1.  **Push to GitHub**: Push your root folder (containing `api/` and `sales-mgmt/`) to a new repository.
2.  **Import to Vercel**: Connect your GitHub account and select the repository.
3.  **Override Settings**:
    - **Build Command**: `npm run build` (inside `sales-mgmt`)
    - **Output Directory**: `dist`
4.  **Environment Variables**: Add your `DATABASE_URL`, `JWT_SECRET`, etc., in the Vercel Dashboard.

---

## 4. Local Development
Instead of `node server.js`, use the **Vercel CLI**:
1.  Install: `npm i -g vercel`
2.  Run: `vercel dev`
This will emulate the serverless environment perfectly on your machine.
