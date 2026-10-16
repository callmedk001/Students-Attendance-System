# Student Attendance Management System

## Project

A full-stack student attendance application with secure teacher/student workflows, reporting, and production deployment preparation.

## Current Phase

Phase 16 - Firebase Authentication and Firestore Integration

Database models, authentication, teacher attendance management, student read-only reporting, teacher access controls, validation hardening, responsive UI polish, and deployment preparation are complete.

## Technology

Frontend:
React + Vite

Backend:
Node.js + Express

Database:
MongoDB with Mongoose for the existing Express attendance API, with Firebase Firestore for authentication profiles and Firebase-managed application data.

## How to Run

Backend:

```bash
cd backend
npm install
npm run dev
```

Run the backend contract tests without connecting to MongoDB:

```bash
cd backend
npm test
```

Frontend, in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173/login` in a browser and sign in with a provisioned Firebase teacher or student account.

## Environment Variables

Create `backend/.env` with local backend settings based on `backend/.env.example`. Set `MONGODB_URI` and the Firebase Admin credentials before using authenticated endpoints. Never commit `.env` files or real secrets.

Create `frontend/.env` from `frontend/.env.example` when a different API URL is needed. Never commit `.env` files or real secrets.

Production variable names:

- Backend: `NODE_ENV`, `HOST`, `PORT`, `MONGODB_URI`, `CLIENT_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- Frontend: `VITE_API_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`

`VITE_API_URL` is public frontend configuration and must point to the deployed backend API URL. `CLIENT_URL` may contain one or more comma-separated frontend origins. Do not put `MONGODB_URI`, `JWT_SECRET`, or Firebase Admin credentials in frontend variables. Firebase web values and backend Admin values are required for real login.

## Verification

```bash
cd frontend
npm run build
```

The lightweight process health endpoint is `GET http://localhost:5000/health`. The existing diagnostic endpoint remains available at `GET http://localhost:5000/api/health`. Authentication and teacher attendance endpoints are documented in `backend/README.md`.

## Teacher Attendance Workflow

Teachers sign in, open the dashboard, choose `Take Attendance`, select the date, class, subject, and one of the eight periods, then mark each class student as `PRESENT`, `ABSENT`, or `OD`. Saving creates an attendance session and marks it completed after records are saved. Periods have no timing fields.

Attendance sessions are unique by date, class, subject, and period. Existing sessions can be reviewed in Attendance History, viewed read-only, and edited by the teacher who created them. Teachers can calculate an individual student's attendance percentage from existing records, and students can view their own attendance and summaries.

## Student Attendance Viewing

Students can view only records connected to their authenticated `User` through the `Student.userId` relationship. The student dashboard shows profile information, overall totals, Present, Absent, OD, percentage, monthly attendance, subject-wise attendance, period-wise attendance, and recent records.

Student history is available at `/student/attendance`, with date, month, year, subject, period, and status filters. Student summary views are available at `/student/attendance/summary`. Students have no attendance write controls or teacher-management access.

Attendance percentages use `(PRESENT + OD) / ELIGIBLE ATTENDANCE RECORDS * 100`. Eligible records are the unique stored records for the selected student and the selected class, subject, period, and date filters. `PRESENT` and `OD` count as attended; `ABSENT` counts only in the denominator. Empty or unmarked sets return `0%`, and OD remains a separate stored status.

Teacher class and subject choices are backed by teacher access records. A teacher can only create attendance for authorized class and subject combinations.

## Deployment

The repository includes `render.yaml` for a free-tier Render blueprint:

- Backend: Render Node web service rooted at `backend/`, using `npm ci` and `npm start`, with `/health` as its lightweight process health check.
- Frontend: Render static site rooted at `frontend/`, built with `npm ci && npm run build`, published from `dist/`, with SPA fallback to `index.html`.
- Database: provide a MongoDB connection string through the backend `MONGODB_URI` variable, such as a free MongoDB Atlas tier connection.

The backend is deployed as a Render Node web service; Docker is not required for the Render deployment. Set these Render variables:

- Backend: `MONGODB_URI`, `CLIENT_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. `JWT_SECRET` is retained for the legacy auth routes.
- Frontend: `VITE_API_URL` plus all `VITE_FIREBASE_*` web configuration values.

Deploy the backend first, set the frontend `VITE_API_URL` to the backend `/api` URL, then set the backend `CLIENT_URL` to the final Render frontend URL and redeploy if necessary. Deployment is not claimed from this workspace because provider accounts, database credentials, and final public URLs are external manual configuration. Never commit these values.

## Project Structure

```text
frontend/  React/Vite application, pages, components, services, and styles
backend/   Express server, Mongoose models, controllers, routes, and middleware
docs/      Project planning and phase documentation
render.yaml Free-tier Render service blueprint
```
