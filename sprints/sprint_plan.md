# Project Sprint Plan: Sales & Marketing Team Management System
**Team Members**: Nana Kwaku, Paul, Nana Kwame, Nigel

## Member Technical Roles
- **Nana Kwaku (Backend Lead)**: **PostgreSQL Database Architect**, **Serverless API Design**, Server Security (RBAC).
- **Paul (Integration Lead)**: **Sequelize/Prisma ORM**, **Vercel Serverless Integration**, **Cloudinary** (Media Store), **Nodemailer**.
- **Nana Kwame (Frontend Lead)**: **React ApexCharts** (Dashboard), **Tailwind CSS** (Responsive UI), Component Architecture.
- **Nigel (Feature Lead)**: **Web Speech API** (Transcription), **Leaflet.js** (Mapping), **Frontend Chat Services** (Polling).

---

## Sprint 1: Data & Security (Foundation)
**Goal**: Transition to **PostgreSQL** and secure the API with **JWT**.
- **Nana Kwaku**: 
  - Set up **PostgreSQL** (local or Cloud instance).
  - Implement the `Users` table (hashed passwords using `bcrypt`).
  - Create `/api/auth/login` and `/api/auth/me` endpoints.
  - **Refactor all API handlers in `api/` into standalone Serverless Functions.**
  - Build the **Serverless Auth Middleware** to protect private routes.
- **Paul**: 
  - Define `Product` and `Category` schemas.
  - Ensure `Category` schema supports custom fields (dropdowns, inputs).
  - Implement CRUD endpoints for Products linked to Categories.
- **Nana Kwame**: 
  - Redesign `Login.tsx` to handle JWT storage (`localStorage`).
  - Configure **Axios Interceptors** to attach `Authorization: Bearer <token>` to every request automatically.
- **Nigel**: 
  - Build the Admin-only "User Management" dashboard for onboarding new Managers/Sales staff.

## Sprint 2: Media & Voice Insight (Real-world Data)
**Goal**: Implement real media uploads and the **from-scratch transcription**.
- **Nigel**: 
  - **[SCRATCH FEATURE]** Integrate `window.SpeechRecognition` in `Uploads.tsx`.
  - Handle real-time speech-to-text conversion for voice notes.
  - Fix **Geolocation API** capture logic to include precision error handling.
- **Paul**: 
  - Configure **Multer** for image/video/audio storage.
  - Integrate **Cloudinary SDK** to store media and return optimized CDN URLs.
- **Nana Kwaku**: 
  - Define the `Upload` schema (User ID, Metadata, Transcription text, Coordinates).
  - Create the backend routes for processing uploaded media.
- **Nana Kwame**: 
  - Build a recording UI with visual feedback (mic status, text-preview window).

## Sprint 3: Managerial Dashboard & Geospatial Mapping
**Goal**: Visualise team activity and sales performance.
- **Nana Kwaku**: 
  - Implement **SQL Aggregation Queries** (JOINs) to calculate daily/monthly sales and task completion rates.
  - Create the `ActivityLogs` table to track global system events.
- **Paul**: 
  - Develop the `Tasks` table (Assignee, Assigner, Priority, Status, Deadline).
  - Build notification triggers for new task assignments.
- **Nigel**: 
  - Integrate **Leaflet.js** or **Google Maps React** for the `/map` view.
  - Plot all salesperson uploads as pins with thumbnails and transcriptions in popups.
- **Nana Kwame**: 
  - Implement **ApexCharts** for the Admin Dashboard (Revenue trends, Category distributions).

## Sprint 4: Automation & Real-time Communication
**Goal**: Automated billing and instant messaging.
- **Paul**: 
  - Implement **PDF generation logic** to create invoices from `Invoice` records.
  - Setup **Nodemailer** service with SMTP to send PDFs to client emails in one click.
- **Nigel**: 
  - Set up a **Polling system** for the **Group/Direct Chat** (Serverless compatibility).
  - Handle real-time "typing..." indicators via state synchronization.
- **Nana Kwaku**: 
  - Build the `Message`, `Report`, and `MoodBoard` schemas.
- **Nana Kwame**: 
  - Finalize the **Mood Board** UI and the **Interactive Chat** window.

## Sprint 5: Hardening & Final Presentation
**Goal**: Launch-ready system and polish.
- **All Members**: Rigorous end-to-end testing (Sale -> Upload -> Dashboard -> Invoice).
- **Nana Kwaku**: Finalize **Role-Based Access Control (RBAC)** to ensure Sales cannot see Admin analytics.
- **Nana Kwame**: Optimise CSS for mobile (ensuring the sidebar and maps work flawlessly on small screens).
- **Nigel & Paul**: Finalize technical documentation and User Manual.

---

## [IMPORTANT] Feature Being Coded from Scratch
As discussed, we are opting to build the **Speech-to-Text Transcription** using the native **Web Speech API** instead of using a third-party paid API like Google Cloud. This fulfills the "advanced feature" requirement while keeping the project self-contained and cost-effective.
