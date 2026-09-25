# Backend

The backend preserves the database foundation, authentication, teacher workflow, student reporting, and validation while keeping classes and subjects independent.

## Run

```bash
npm install
npm run dev
```

The server runs on `http://localhost:5000` and exposes `GET /api/health`.

## MongoDB Setup

Set `MONGODB_URI` and a private `JWT_SECRET` in `backend/.env`. The values are read from environment variables and are never logged. The server connects to MongoDB before it starts listening.

Production also supports `NODE_ENV`, `HOST`, `PORT`, and comma-separated `CLIENT_URL` origins. The default cloud host is `0.0.0.0`; the deployment provider supplies `PORT`.

Start the backend with:

```bash
npm install
npm run dev
```

Successful startup logs `MongoDB connected successfully`. Verify the server with:

```text
GET http://localhost:5000/api/health
```

## One-time teacher bootstrap

For the first development teacher, add these values temporarily to `backend/.env` or provide them only in the shell environment:

```text
BOOTSTRAP_TEACHER_USERNAME=your-development-username
BOOTSTRAP_TEACHER_PASSWORD=your-development-password
BOOTSTRAP_TEACHER_NAME=Your Name
BOOTSTRAP_TEACHER_DEPARTMENT=Your Department
```

Run the provisioning command once:

```bash
npm run bootstrap:teacher
```

It creates the Firebase Authentication account, Firestore profiles and username mapping, and linked MongoDB `User` and `Teacher` records. It never stores the password in MongoDB or Firestore and never prints the password or Firebase private key. Running it again with the same username is safe; it reports that the teacher already exists and does not create a duplicate. Remove the four `BOOTSTRAP_TEACHER_*` values from `backend/.env` after successful provisioning.

The command requires `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `MONGODB_URI` in the backend environment. After it succeeds, use the bootstrap username and password on the existing frontend Login page.

## Models

The Phase 2 models are `User`, `Student`, `Teacher`, `Class`, `Subject`, `AttendanceSession`, and `AttendanceRecord`.

Attendance records use exactly `PRESENT`, `ABSENT`, and `OD`. `OD` remains separately stored and counts as attended.

Attendance percentage is calculated from records and is not stored:

```text
(PRESENT + OD) / Total Conducted Periods * 100
```

## Authentication

The current application login accepts a normalized username and password. The frontend asks the Express backend to resolve the username through Firebase Admin and then signs in with the returned Firebase Email/Password identifier. The identifier is an internal value, not a mailbox, and is never displayed to users. Firebase returns the UID; the frontend then reads `users/{uid}` and accepts only an active `TEACHER` or `STUDENT` profile.

The backend verifies Firebase ID tokens when its Firebase Admin variables are configured, then links the verified UID or normalized username to an active MongoDB user profile. The `User.username` field has a sparse unique index and the same validation rules as the frontend, so a trusted provisioning process cannot create a duplicate username across roles. The verified Firebase UID, not a browser-supplied role, controls backend authorization.

The backend exposes `/api/auth/resolve-username` for the Firebase username flow. It returns only a Firebase email identifier after checking the server-side `usernames/{username}` mapping and Firebase account state; it never handles or stores a password. The older `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, and `/api/auth/logout` routes remain for the staged legacy Mongo/JWT migration and are not used by the Firebase login. New accounts require a trusted server-side operation that creates the Firebase Auth user, Firestore `users/{uid}` and role profile, and linked Mongo profile. No public signup route or automatic test account is created here.

There is no username password-reset flow. Because the Firebase identifier is not a real mailbox, the UI does not claim that username accounts can receive recovery email. Password changes must be handled by an approved operator process through Firebase Authentication.

### Teacher student management

`GET /api/teacher/students` and `POST /api/teacher/students` are teacher-only account-management endpoints. They require a verified Firebase ID token and an active `TEACHER` profile in Firestore `users/{uid}`. Creation uses Firebase Admin on the backend, writes `users/{uid}`, `students/{uid}`, and the unique `usernames/{normalizedUsername}` mapping in Firestore, and links a Mongo `User` and `Student` so existing attendance APIs continue to work. Passwords are sent only to Firebase Authentication and are never written to Firestore, Mongo, logs, or API responses.

The endpoint does not accept a browser-supplied role and does not create teachers. Firebase Admin credentials must be configured only through the backend variables in `.env`; the frontend receives no service-account values. A partial failure is cleaned up across the created Firebase Auth and Mongo records.

## Phase 15 college data management

While Firebase credentials are absent, local development exposes the existing Mongo data layer through a development-only management gate. In production, these endpoints require authenticated teacher access. The endpoints are:

- `GET/POST/PUT/DELETE /api/classes`
- `GET/POST/PUT/DELETE /api/subjects`
- `GET/POST/PUT/DELETE /api/teachers`
- `GET/POST/PUT/DELETE /api/students`
  Management uses IDs and relationships for classes, subjects, teachers, and students. Duplicate class/section combinations, subject codes, usernames, and roll numbers are rejected. Classes and subjects are independent, and attendance selects from both current active lists. Delete operations deactivate records rather than removing attendance-related history. Demo teacher and student records contain no password field; authentication provisioning remains a later Firebase phase.

The frontend uses Firebase Auth state persistence, loads the role from Firestore `users/{uid}`, attaches Firebase ID tokens to existing API calls, protects role-specific routes, and signs out through Firebase Auth.

## Teacher Attendance APIs

All endpoints below require a valid JWT and the `TEACHER` role:

- `GET /api/teacher/dashboard`
- `GET /api/teacher/classes`
- `GET /api/teacher/classes/:classId/students`
- `GET /api/teacher/classes/:classId/subjects`
- `GET /api/teacher/attendance-history`
- `POST /api/attendance/sessions`
- `GET /api/attendance/sessions`
- `GET /api/attendance/sessions/:id`
- `PUT /api/attendance/sessions/:id`
- `POST /api/attendance/sessions/:id/records`
- `PUT /api/attendance/records/:id`

Attendance sessions use a date, class, subject, and one of exactly eight periods. No timing fields are stored or accepted. Duplicate sessions are rejected for the same date, class, subject, and period. Attendance records use exactly `PRESENT`, `ABSENT`, and `OD`; `OD` remains separate for percentage calculations.

Attendance history accepts `classId`, `subjectId`, `date`, `periodNumber`, `startDate`, and `endDate` query filters and returns newest sessions first. Session view responses include the session details and populated student records; edit requests remain limited to the authenticated teacher who owns the session.

The server verifies the authenticated teacher profile and session ownership. Students receive `403` from teacher-only APIs. Attendance uses the selected period without a fixed schedule.

## Student Attendance APIs

All endpoints below require a valid JWT and the `STUDENT` role. The student is always resolved from the authenticated JWT user through `Student.userId`; no frontend-supplied student ID controls access.

- `GET /api/student/profile`
- `GET /api/student/attendance`
- `GET /api/student/attendance/summary`
- `GET /api/student/attendance/monthly`
- `GET /api/student/attendance/subjects`
- `GET /api/student/attendance/periods`

Attendance history supports `startDate`, `endDate`, `month`, `year`, `subjectId`, `periodNumber`, and `status` filters. Reports calculate Present, Absent, OD, total, and percentage from `AttendanceRecord` data. The percentage is `(PRESENT + OD) / TOTAL CONDUCTED PERIODS * 100`, and a zero total safely returns `0`.

Student endpoints are read-only. Students cannot create, edit, or delete attendance, and teacher tokens receive `403` from student-only endpoints.

## Production Deployment

The root `render.yaml` defines a free Render web service for this backend. Configure these backend variables in the provider dashboard: `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_URL`. `HOST`, `PORT`, and `NODE_ENV` are supplied by the blueprint/provider. Do not copy backend secrets into the frontend or commit them.
