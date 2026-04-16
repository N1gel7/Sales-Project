# Application Refactoring & Fixes To-Do List

> [!IMPORTANT]
> **Vercel Serverless Architecture Constraint**
> The total number of serverless functions inside the `api/` directory MUST remain at **10 (or fewer)**. Due to the Vercel Hobby tier limitations, your deployed app has a hard limit of 12 serverless functions. To stay safely under this limit, do not create any new `.js` files in the `api/` root. If a new feature is needed, put the logic inside `api/_lib/` and route it through one of the 10 existing endpoints using query parameters (e.g. `?action=new_feature`).

---

## Track A: Frontend & React Architecture (Team Member 1)
*These tasks are entirely scoped to the UI and React folder (`sales-mgmt/`). They do not depend on any backend changes.*

### A1. Consolidate Split-Brain API Calls
- **Details:** `Billing.tsx` bypasses the central `api.ts` file and writes its own raw `fetch()` calls. This scatters authentication token logic across multiple files, making maintenance difficult.
- **Steps:** Add the missing endpoints (e.g., `markAsPaid`) to `api.ts`. Replace the raw `fetch` commands in `Billing.tsx` with clean API calls.

### A2. Fix Redundant Routing (`/billing` vs `/invoices`)
- **Details:** The `<Billing />` component mounts on `/billing` and the `<Invoices />` component mounts on `/invoices`. However, `Invoices.tsx` is an empty file that just imports `Billing.tsx`. 
- **Steps:** Delete `Invoices.tsx`, delete the `<Route path="/invoices" />` in `App.tsx`, and ensure the navigation uses only `/billing`.

### A3. Eliminate "Magic String" Roles
- **Details:** The frontend uses hardcoded strings like `<RequireAuth roles={['sales', 'manager', 'admin']}>`. A typo in these strings causes the system to fail silently.
- **Steps:** Create an exported enum in `sales-mgmt/src/constants/roles.ts`, and update all protected React routes to use `UserRole.ADMIN` instead of string literals.

### A4. Fix Dangerous Optimistic Updates in Billing
- **Details:** In `Billing.tsx`, the `markAsPaid` function optimistically updates the screen to show "Paid" *before* the database actually confirms it.
- **Steps:** Move the React state update `setInvoices(...)` inside the `if (response.ok)` success block, so the UI only turns green if the backend successfully saves the transaction.

### A5. Setup Automated Testing Frameworks
- **Details:** Add Unit Testing to the project to establish a baseline quality control standard locally.
- **Steps:** Install testing dependencies (`vitest @testing-library/react`); create a basic component test (e.g., `StatusBadge.test.tsx`); and add a `"test": "vitest run"` script to `package.json`. *(Note: Do not add this to the Jenkinsfile yet to keep the MVP deployment pipeline fast).*

### A6. Delete "Demo Login" UI Logic
- **Details:** The `Login.tsx` file has a row of Developer "Demo" buttons that autofill user email addresses.
- **Steps:** Delete the `const DEMO` object and the role buttons from `Login.tsx` so the production login screen looks professional and secure.

---

## Track B: Backend Dead-Code & Cleanup (Team Member 2)
*These tasks involve deleting legacy code and fixing simple logic bugs in the API. They will not break the frontend.*

### B1. Delete Legacy Database Models
- **Details:** The backend was transitioned to use Supabase (PostgreSQL), but the `models/` folder contains old code written for Mongoose (MongoDB). This is entirely dead code.
- **Steps:** Delete the entire `/models` directory and remove MongoDB references from `SCHEMAS.md`.

### B2. Remove "Dead Code" in `general.js`
- **Details:** Delete the block of code inside `api/general.js` that checks for `type === 'chats'`. All chat logic was already moved to `api/chats.js` during the serverless refactor.

### B3. Fix Incompatible Typing Indicator
- **Details:** The current typing indicator uses `const typingState = new Map()` to hold data in memory. Serverless functions on Vercel are ephemeral—they spin up and die, making memory non-persistent.
- **Steps:** You must delete this memory-based logic from `api/chats.js` and instead implement Supabase Realtime/Presence for typing indicators, or simply remove the typing feature entirely.

### B4. Remove Fake "Active Sessions" Feature
- **Details:** The app uses stateless JSON Web Tokens (JWTs) for auth, meaning the database has no record of who is actively logged in. The "Active Sessions" UI provides a fake list of sessions and a "Revoke" button that does not actually blacklist the token on the server.
- **Steps:** Remove the SessionManager UI component and the backend endpoints related to active sessions.

---

## Track C: Security & Database Engineering (Team Member 3)
*These tasks involve securing the application logic and modifying the database scripts. They are safe to run concurrently with the UI work.*

### C1. Fix Backend Role Authorization (Broken Access Control)
- **Details:** The API endpoints (`api/invoices.js`, `api/users.js`) use the Supabase Service Role Key (bypassing the database's RLS permissions), but the routes fail to check if `req.user.role === 'admin'`. Any user can theoretically mark an invoice as paid.
- **Steps:** You already have a `withRole` middleware in `api/_lib/authMiddleware.js`. Wrap your sensitive `handler` exports in `api/users.js` and `api/invoices.js` with `withRole('admin', 'manager')`.

### C2. Remove Production Database Backdoor
- **Details:** Inside `scripts/init-db.js`, the code automatically seeds the database with the `admin@example.com` account and password `Admin#123`. If you run this script against your live Supabase, your company acts with a publicly known admin backdoor.
- **Steps:** Delete the "Seed Initial Users" chunk from `init-db.js`.

### C3. Fix Hardcoded JWT Fallback
- **Details:** In `api/_lib/jwtConfig.js`, the code falls back to `'fallback-secret-key-for-dev'`.
- **Steps:** Change this so that if `process.env.JWT_SECRET` is missing, the code inherently throws a fatal Error. You never want to deploy a server that accidentally mints tokens using a fallback string.

### C4. Install Database Analytics Functions (SQL RPCs)
- **Details:** The terminal logs showed errors like `[analytics] RPC get_product_performance not available`. 
- **Steps:** Run `node scripts/setup-analytics-rpc.js` locally to push these performance SQL functions to your Supabase instance, preventing massive bandwidth issues on analytics.

---

## Track D: Core Features Restructuring (Pair Programming recommended)
*These are larger features that require both frontend and backend communication. Have two group members pair up to complete these AFTER the other tracks are done.*

### D1. Unified Login & Routing
- **Details:** Remove the separate role-based login portals in the UI. 
- **Steps:** Ensure `/login` is one single unified form. When the user successfully authenticates, read their `user.role` from the API response and programmatically route them (using React Router) to their correct role-specific dashboard.

### D2. Admin User Creation & Onboarding Flow
- **Details:** Complete the user onboarding flow so admins can securely invite users.
- **Steps:** Instead of an Admin guessing a password for the employee, have the `api/users.js` backend generate a secure 16-character random token. Automatically email the new employee the token via Resend, and upon their first login, force them to change it before they can view their dashboard.

---

## Track E: Project Management & Git Workflow (All Group Members)
*These tasks do not require any coding. They prioritize optimizing presentation, documentation, and grading criteria for lecturers.*

### E1. Retroactively Update GitHub Pull Requests
- **Details:** Lecturer grading heavily relies on visible Git history, but current Pull Requests (PRs) lack detailed descriptions.
- **Steps:** Go to the "Closed" Pull Requests tab on GitHub. Edit past PR titles to reflect the actual feature built, and add 3-bullet-point descriptions explaining *what* was changed, *why* it was changed, and *where* the change happened. 

---

## Track F: System Design Documentation (All Group Members)
*Lecturers expect visual representations of system architecture. Divide these diagrams among the team to include in the final report/presentation.*

### F1. Database Entity-Relationship (ER) Diagram
- **Details:** Visualize the Supabase schema and table relationships.
- **Steps:** Map out the connections between `users`, `invoices`, `tasks`, `uploads`, and `activity_logs`. Clearly label the Primary Keys (PK) and Foreign Keys (e.g., `tasks.assignee_id -> users.id`).

### F2. UML Class Diagram
- **Details:** Show the object-oriented structure of the React frontend state and Data Models.
- **Steps:** Map out the core React interface structures (e.g., `User`, `Invoice`, `Task`) and the `api.ts` service structure showing how the client interacts with the backend.

### F3. Use Case Diagram
- **Details:** Demonstrate user roles and permissions visually.
- **Steps:** Draw 'Actors' (Admin, Manager, Sales Rep) and map lines to 'Use Cases' (e.g., "Admin creates a user", "Sales Rep uploads media", "Manager views analytics"). This is the easiest way to visually explain your Role-Based Access Control logic to the lecturer!

### F4. Sequence Diagram (Login & JWT Flow)
- **Details:** Explain the authentication lifecycle, which is usually the most complex architectural component of a web app.
- **Steps:** Draw a step-by-step timeline tracing: 1) User submits credentials -> 2) Node API verifies via bcrypt -> 3) Node API generates JWT -> 4) React saves token and routes user -> 5) React automatically attaches the token to future `api.ts` requests.

