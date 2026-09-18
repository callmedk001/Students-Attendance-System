# Firebase Migration Plan

## Audit Scope and Status

This is an audit and migration plan only. No source code, database, Firebase project, credentials, packages, or deployment settings were changed by this audit. The current repository was inspected as it exists on 2026-09-12.

The application has exactly two roles: `TEACHER` and `STUDENT`. This plan does not introduce an `ADMIN` role.

## 1. Current Architecture

The current system is a split full-stack application:

- React 18 and Vite frontend.
- Node.js and Express backend using ES modules.
- MongoDB accessed through Mongoose.
- JWT bearer authentication issued by the Express API.
- bcrypt password hashing in the backend.
- Render configuration for a free-tier Node web service and static site.
- No Firebase packages or Firebase configuration are currently present.

The frontend communicates with the backend through Axios. The API base URL is `VITE_API_URL`, defaulting to the local backend during development. The backend allows configured `CLIENT_URL` origins and listens on the provider-supplied `PORT`.

Current deployment documentation describes Render plus MongoDB Atlas, not Firebase. No deployment has been performed from this workspace.

## 2. Current Technology Stack

### Authentication

Authentication is implemented by `backend/controllers/authController.js`:

- Registration accepts `TEACHER` or `STUDENT`.
- Passwords are hashed with bcrypt and stored as `User.passwordHash` in MongoDB.
- Login verifies the bcrypt hash and returns a JWT valid for one day.
- The JWT contains the Mongo user ID and role.
- Requests send `Authorization: Bearer <token>`.
- Logout is stateless and returns success; the frontend removes its local token.

The frontend stores the JWT in local storage under `student-attendance-token`, restores the user through `/api/auth/me`, and redirects based on the returned role. There is one login page and no role selector.

### Database

The database is MongoDB with Mongoose. Connection is required before the server starts and is read from `MONGODB_URI`.

### Backend

The backend is Express. It provides JSON parsing, CORS, a health endpoint, authentication middleware, role middleware, route handlers, validation, Mongoose queries, and centralized error responses.

### Frontend

The frontend is a React/Vite single-page application using React Router and Axios. It has teacher and student protected routes and separate service modules for auth, attendance, teacher, and student calls.

## 3. Current Backend API Surface

All protected routes require a JWT. Teacher routes also require the `TEACHER` role; student routes require the `STUDENT` role.

### Authentication routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/auth/test-teacher` (development authorization check)
- `GET /api/auth/test-student` (development authorization check)

Registration currently creates only a `User` document. It does not create the related Student or Teacher profile in the inspected controller.

### Teacher routes

- `GET /api/teacher/dashboard`
- `GET /api/teacher/profile`
- `GET /api/teacher/assignments`
- `GET /api/teacher/classes`
- `GET /api/teacher/classes/:classId/students`
- `GET /api/teacher/classes/:classId/subjects`
- `GET /api/teacher/attendance-history`

### Attendance routes

- `POST /api/attendance/sessions`
- `GET /api/attendance/sessions`
- `GET /api/attendance/sessions/:id`
- `PUT /api/attendance/sessions/:id`
- `POST /api/attendance/sessions/:id/records`
- `PUT /api/attendance/records/:id`

### Student routes

- `GET /api/student/profile`
- `GET /api/student/attendance`
- `GET /api/student/attendance/summary`
- `GET /api/student/attendance/monthly`
- `GET /api/student/attendance/subjects`
- `GET /api/student/attendance/periods`

## 4. Current Frontend API Callers and Routes

The API callers are:

- `frontend/src/services/api.js`: Axios instance, bearer token interceptor, 401 redirect.
- `frontend/src/services/authApi.js`: authentication calls.
- `frontend/src/services/attendanceApi.js`: attendance session and record writes/reads.
- `frontend/src/services/studentApi.js`: student profile and reports.
- `frontend/src/services/teacherApi.js`: teacher dashboard, assignments, classes, students, subjects, and history.
- `frontend/src/services/tokenStorage.js`: local-storage JWT handling.

Relevant UI and route files include:

- `frontend/src/context/AuthContext.jsx`: JWT session restore, login, logout.
- `frontend/src/pages/Login.jsx`: single email/password login page.
- `frontend/src/components/ProtectedRoute.jsx`: client-side role route guard.
- `frontend/src/App.jsx`: teacher and student route registration.
- `frontend/src/pages/teacher/TakeAttendance.jsx`: attendance creation UI.
- `frontend/src/pages/teacher/EditAttendance.jsx`: attendance editing UI.
- `frontend/src/pages/student/Dashboard.jsx`, `Attendance.jsx`, and `Summary.jsx`: student reporting UI.

The teacher attendance UI already limits period choices to 1 through 8, but it currently includes start and end time fields. Those fields must be removed in the migration; they are not part of the target model.

## 5. Current Data Models

### User

`User` contains:

- `name`
- unique normalized `email`
- `passwordHash`
- `role`: `TEACHER` or `STUDENT`
- `status`: `ACTIVE` or `INACTIVE`
- Mongoose timestamps

Passwords must not be copied to Firestore. The migration must not create `password` or `passwordHash` fields in any Firebase profile document.

### Student

`Student` contains:

- unique `userId` reference
- unique `studentId`
- `rollNumber`
- `name`
- `department`
- `year`
- `section`
- `semester`
- required `classId` reference
- timestamps

### Teacher

`Teacher` contains:

- unique `userId` reference
- unique `employeeId`
- `name`
- `department`
- optional `designation`
- timestamps

### Class

`Class` contains:

- `className`
- `department`
- `year`
- `section`
- `semester`
- timestamps

The existing class representation is richer than only a display name. The migration should preserve these fields rather than collapsing them into a single string.

### Subject

`Subject` contains:

- `subjectCode`
- `subjectName`
- required `classId`
- timestamps

The existing model directly attaches a subject to one class. This should remain the initial Firestore design unless the college later requires one subject definition shared by multiple classes.

### TeachingAssignment

`TeachingAssignment` relates:

- `teacherId`
- `classId`
- `subjectId`
- timestamps

A compound unique index prevents duplicate teacher/class/subject assignments. Teacher access is assignment-scoped in the backend.

### AttendanceSession

`AttendanceSession` currently contains:

- `date`
- `classId`
- `subjectId`
- `periodNumber`
- `startTime`
- `endTime`
- `teacherId`
- `status`: `ACTIVE`, `COMPLETED`, or `CANCELLED`
- timestamps

The compound unique index is `(date, classId, subjectId, periodNumber)`, which already excludes time from uniqueness. However, the current schema and controller require time values. The target migration must remove both time fields and their validation entirely.

### AttendanceRecord

`AttendanceRecord` contains:

- `sessionId`
- `studentId`
- `status`: `PRESENT`, `ABSENT`, or `OD`
- `markedAt`
- `updatedAt`

A compound unique index prevents two records for the same session and student.

## 6. Current Attendance and Authorization Behavior

Teacher authorization is enforced in the API, not only in React:

1. JWT authentication identifies the Mongo `userId` and role.
2. The teacher profile is resolved from `Teacher.userId`.
3. `TeachingAssignment` is checked for the authenticated teacher and selected class/subject.
4. Class and subject ownership is validated.
5. Attendance records are restricted to students in the selected class.
6. Session reads and edits are restricted to the teacher who owns the session.

Student queries resolve the student from the authenticated JWT user through `Student.userId`; no frontend-supplied student ID controls the query. Student routes are read-only.

Attendance statuses are validated as exactly `PRESENT`, `ABSENT`, and `OD`.

Attendance percentage is calculated, not stored:

`(PRESENT + OD) / TOTAL CONDUCTED PERIODS * 100`

A zero total returns `0`, and results are rounded to two decimal places. This rule is used for overall, monthly, subject, and period summaries.

## 7. Recommended Google/Firebase Architecture

The recommended target is:

- Existing React/Vite frontend hosted by Firebase Hosting.
- Firebase Authentication with Email/Password.
- Cloud Firestore for profile, academic, assignment, session, and record data.
- Firebase Security Rules for baseline data ownership and role restrictions.
- A small trusted server-side layer, preferably Firebase Cloud Functions, for privileged account provisioning and any operation whose authorization cannot be expressed safely and maintainably in Rules.
- No Firebase Admin SDK or service-account key in React, Vite variables, public assets, GitHub, or Firestore.

Do not migrate only for branding. The migration is beneficial if the goal is Google-managed authentication, static hosting, and a serverless database with low operational overhead. It is not a zero-work change: attendance authorization, account provisioning, migration tooling, indexes, rules, and testing must be rebuilt.

### Backend decision

Do not delete the Express/MongoDB backend during the audit or during the first migration step.

Recommended approach:

1. Keep the current backend and MongoDB as the rollback source of truth.
2. Build a separate migration/import tool and validate Firestore data.
3. Move the frontend to Firebase Auth and Firestore only after rules and flows pass tests.
4. Use Cloud Functions for privileged account creation and, if necessary, trusted attendance writes.
5. Retire or archive the Express API only after production cutover and rollback retention are complete.

A temporary Express adapter is possible, but it adds another deployed service and must verify Firebase ID tokens rather than trusting old JWTs. Cloud Functions is the more natural long-term Google-native option, but its billing requirements must be checked before choosing it for production.

## 8. Firebase Authentication Strategy

Use one login screen with email and password. Do not ask users to select Student or Teacher.

Login flow:

1. The frontend calls Firebase Auth `signInWithEmailAndPassword`.
2. Firebase returns an authenticated user and ID token.
3. The app reads `users/{uid}` from Firestore.
4. The role is accepted only from trusted Firestore data protected by Rules and server-side provisioning.
5. The app routes to the teacher or student dashboard.

Use Firebase Auth for:

- Email identity
- Password handling
- Login and logout
- Password reset
- Firebase UID
- Account disabled state where appropriate

Use Firestore only for profile and authorization metadata. Never migrate `passwordHash` into Firestore.

The migration must also decide how to handle existing users. A bcrypt hash cannot simply be imported as a Firebase password credential. Existing users will need a controlled password reset or re-enrollment flow unless a separate Firebase-compatible migration mechanism is proved and tested. Do not reset production users automatically.

## 9. User, Student, and Teacher Documents

Recommended documents:

### `users/{uid}`

```text
{
  uid: string,
  role: "TEACHER" | "STUDENT",
  active: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

Only trusted provisioning code should create or update `role`, `uid`, and `active`. There is no `ADMIN` value.

### `students/{uid}`

Using the Firebase UID as the student document ID makes the one-user-to-one-student relationship explicit:

```text
{
  uid: string,
  name: string,
  studentId: string,
  registerNumber: string,
  rollNumber: string,
  department: string,
  year: number,
  section: string,
  semester: number,
  email: string,
  classId: string,
  active: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

The existing `studentId` and `rollNumber` meanings must be confirmed during migration. Do not duplicate them under both names unless the source data genuinely has both concepts.

### `teachers/{uid}`

```text
{
  uid: string,
  name: string,
  employeeId: string,
  department: string,
  designation: string,
  email: string,
  active: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

No password field belongs in either profile.

## 10. Classes, Subjects, and Assignments

### `classes/{classId}`

Preserve the current model:

```text
{
  name: string,
  className: string,
  department: string,
  year: number,
  section: string,
  semester: number,
  active: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

Choose one canonical display field during implementation; do not create redundant fields without a compatibility reason.

### `subjects/{subjectId}`

```text
{
  subjectCode: string,
  subjectName: string,
  classId: string,
  active: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### `teachingAssignments/{assignmentId}`

```text
{
  teacherId: string,
  classId: string,
  subjectId: string,
  active: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

Use a deterministic assignment ID such as `teacherId_classId_subjectId`, or enforce uniqueness in trusted code. Firestore Rules alone do not provide a general-purpose unique compound index.

Classes, subjects, and assignments have no current management API. Any future management interface must use trusted server-side operations or carefully designed Rules; it must not allow a student to alter authorization data.

## 11. Fixed Eight-Period Design

There are exactly eight periods and no timing system.

If a collection is useful for display/configuration, create exactly these documents in `periods`:

```text
periods/1 through periods/8
{
  periodNumber: 1,
  label: "Period 1",
  active: true
}
```

Only `periodNumber`, `label`, and `active` belong in the period document. Do not add `startTime`, `endTime`, schedule, timetable, clock, or override fields.

The teacher selects only the period number. The source schema, controller, `TakeAttendance.jsx`, `EditAttendance.jsx`, README text, and any response formatter that exposes times must be updated in the implementation phase.

## 12. Attendance Sessions and Records

### `attendanceSessions/{sessionId}`

```text
{
  date: "YYYY-MM-DD",
  classId: string,
  subjectId: string,
  periodNumber: number,
  teacherId: string,
  status: "ACTIVE" | "COMPLETED" | "CANCELLED",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

There must be no time fields. `periodNumber` must be an integer from 1 through 8.

The uniqueness key is exactly:

`date + classId + subjectId + periodNumber`

A deterministic document ID based on that key is recommended because Firestore does not provide Mongo-style unique compound indexes. The chosen date normalization and timezone must be documented and tested.

### `attendanceRecords/{recordId}`

A flat collection is compatible with the current API shape:

```text
{
  sessionId: string,
  studentId: string,
  status: "PRESENT" | "ABSENT" | "OD",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

Use a deterministic record ID such as `sessionId_studentId`, or use a session subcollection such as `attendanceSessions/{sessionId}/records/{studentId}`. Choose one canonical structure before writing Rules and indexes. The subcollection makes session ownership checks more local; the flat collection is closer to the current model. Either must enforce one record per student per session through trusted writes and Rules.

## 13. Attendance Percentage

Retain the existing rule everywhere:

```text
attended = PRESENT + OD
percentage = attended / totalConducted * 100
```

`ABSENT` does not count as attended. `OD` remains a distinct stored status but counts toward attended periods.

The same calculation must be used by:

- Student dashboard
- Subject summary
- Monthly summary
- Period summary
- Attendance history summary
- Any Cloud Function or server-side report

Prefer calculating reports from authoritative records rather than storing mutable percentages. If denormalized counters are later introduced for performance, they must be updated transactionally and periodically reconciled.

## 14. Student Account Creation Strategy

A teacher must not create an arbitrary Firebase account directly from browser code with Admin privileges.

Recommended flow:

1. An authenticated teacher submits name, register number, email, class, and required academic fields.
2. A callable HTTPS Cloud Function verifies the Firebase ID token, checks the user role is `TEACHER`, validates the input, and checks that the operation is allowed by the deployment policy.
3. The function uses Firebase Admin SDK on the server to create the Auth user, preferably with a generated temporary credential or a password-reset/setup flow.
4. The function creates `users/{uid}` with role `STUDENT` and `students/{uid}` in a transaction or compensating cleanup flow.
5. The function returns only safe profile metadata. It never returns or stores an Admin credential.
6. The student completes password setup through Firebase Auth.

The exact teacher permission to provision students must be decided before implementation. The current application has no student-management route, so this is a new privileged operation, not an existing behavior to preserve automatically. A safer initial production choice is controlled batch provisioning by a trusted operator rather than unrestricted teacher self-service.

## 15. Teacher Account Creation Strategy

There is no Admin role and there should be no Admin dashboard.

Recommended initial setup:

- Provision the first teacher through a one-time trusted server-side script or Cloud Function deployment process.
- Create the Firebase Auth account with Admin SDK outside the browser.
- Create the matching `users/{uid}` and `teachers/{uid}` documents.
- Send a password setup/reset link, or provide a controlled first-login setup flow.
- Disable or remove the bootstrap operation after initial setup, or protect it with deployment-only credentials and an explicit one-time flag.

Additional teachers should be provisioned through the same trusted operator process or a narrowly scoped server-side invitation function. A teacher must not be able to assign themselves a role by writing `users/{uid}` from the client.

## 16. Teacher Access Flow

1. Firebase Auth authenticates the user.
2. The app loads the profile by Firebase UID.
3. The role must be `TEACHER` and the account active.
4. Teacher queries return only active assignments for the authenticated UID.
5. Attendance creation checks authenticated UID, class, subject, and assignment together.
6. The session's `teacherId` is derived from the verified token, never from trusted frontend request data.
7. Session edits follow the existing authorization policy: initially restrict edits to the teacher who created/owns the session, unless a documented institution-wide policy changes it.

Firestore Rules and trusted server-side functions must enforce these conditions even if the React UI is bypassed.

## 17. Student Access Flow

1. Firebase Auth authenticates the user.
2. The app loads `users/{uid}` and requires `STUDENT` plus active status.
3. The app reads only `students/{uid}` and records linked to that UID.
4. Student queries must not accept an arbitrary student ID from the browser as an ownership selector.
5. Students can read their own profile and attendance reports.
6. Students cannot create, edit, or delete attendance; change their class, role, UID, active state, or assignments; or access teacher operations.

The existing server-side ownership pattern should be preserved in Rules and any Cloud Functions implementation.

## 18. Firestore Security Rules Strategy

Rules must be designed and tested before production data is written. The exact syntax should be implemented only after the final document shape is selected.

Baseline requirements:

- Unauthenticated users cannot read or write private data.
- A user can read their own `users/{uid}` document, but cannot change `role`, `uid`, or authorization fields.
- A student can read only their own student document and their own attendance records.
- A student cannot create, update, or delete attendance.
- A teacher can read only data needed for active assignments.
- A teacher can create an attendance session only when the authenticated UID matches `teacherId`, the period is 1-8, and the assignment document proves the teacher/class/subject relationship.
- A teacher can write records only for students in the session class and only for allowed statuses.
- A teacher can edit only sessions and records permitted by the documented ownership policy.
- Client writes cannot create a `users` document with a chosen role or change a role later.
- Class, subject, assignment, and profile authorization fields are server-managed unless a narrowly tested rule explicitly permits the operation.

Use the Firebase Emulator Suite and Rules unit tests for positive and negative cases. Do not treat React route guards as security controls.

## 19. Environment Variables and Secrets

Current templates contain:

- Backend: `PORT`, `HOST`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`.
- Frontend: `VITE_API_URL`.

The current root `.gitignore` excludes `.env` and `.env.*` while allowing `.env.example`, which is appropriate as a starting point.

For a Firebase client-only frontend, Firebase web configuration values such as API key, auth domain, project ID, storage bucket, messaging sender ID, and app ID are identifiers intended for browser configuration, but they are not authorization secrets. They still belong in the deployment configuration and should not be confused with Admin credentials.

A future frontend `.env.example` should contain names only, for example:

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Only server-side configuration may contain Firebase Admin credentials. Prefer the Cloud Functions runtime service identity or Secret Manager rather than a checked-in JSON service-account file. Never put `MONGODB_URI`, `JWT_SECRET`, private keys, or Admin credentials in Vite variables, React source, public assets, GitHub, README files, or Firestore documents.

## 20. Firebase Hosting Deployment Strategy

The Vite build output is `frontend/dist`. Firebase Hosting should serve that directory with an SPA rewrite from all application paths to `/index.html`.

Deployment steps, after implementation and manual Firebase project creation:

1. Build the frontend with production Firebase client configuration.
2. Configure Hosting to publish `frontend/dist`.
3. Add an SPA rewrite for React Router paths.
4. Configure authorized Firebase Auth domains for the Hosting domain and any approved custom domain.
5. Deploy Functions separately if used.
6. Verify direct refreshes on teacher and student routes.
7. Verify unauthenticated redirects and Firebase Auth persistence after refresh.

No project ID, credentials, or deployment URL has been invented or configured in this audit.

If an Express API remains temporarily, its HTTPS URL must be supplied through a public `VITE_API_URL`, and the backend must verify Firebase ID tokens. A long-term Firebase-native frontend should not depend on the old API URL.

## 21. Free and Low-Cost Strategy

Targeting zero monthly cost may be realistic for a small prototype, but it is not guaranteed at production scale.

- Firebase Authentication email/password is generally suitable for a small user base without storing passwords in the database. Check current Firebase pricing and any email delivery limits before launch.
- Firestore has a no-cost quota on eligible plans, but reads, writes, deletes, storage, network egress, and indexes can exceed it. Dashboard queries should remain bounded and avoid repeatedly reading entire collections.
- Firebase Hosting has no-cost quotas on eligible plans, with limits for storage and data transfer. Large assets or heavy traffic can create charges.
- Cloud Functions may require the Blaze billing plan for deployment or for some runtime integrations. Invoking Functions also consumes compute, networking, and related quotas. Use Functions only for operations that genuinely require trusted server code.
- Secret Manager, logging retention, outbound email, custom domains, and other Google Cloud services may introduce charges or plan requirements.
- Keep MongoDB during migration for rollback, but running both MongoDB hosting and Firebase in steady state increases cost and operational complexity.

Before production, set a budget alert, billing export if appropriate, quota monitoring, and a documented disablement plan. Confirm current pricing in the official Firebase and Google Cloud pricing pages; this document intentionally does not claim permanent quota values.

## 22. Data Migration Strategy

Do not delete MongoDB data or reset users.

Recommended sequence:

1. Freeze and back up MongoDB, including users, profiles, assignments, sessions, and records.
2. Export source data with stable source IDs and a migration manifest.
3. Map Mongo IDs to Firestore IDs, preferably preserving IDs where collision-free and keeping an explicit mapping table.
4. Normalize dates, statuses, active flags, and timestamps.
5. Drop `startTime` and `endTime` from the target attendance model. Do not invent replacement times.
6. Validate every student has one source user and one class, every teacher has one user, and every assignment points to valid entities.
7. Import classes, subjects, users, teachers, students, assignments, periods, sessions, and records in dependency order.
8. Recompute summaries from records and compare them with MongoDB reports.
9. Validate the fixed period range and reject sessions outside 1-8.
10. Run application, Rules emulator, and security tests against a staging Firebase project.
11. Perform a read-only reconciliation after import.
12. Cut over reads and writes only after a signed validation checklist.
13. Keep MongoDB read-only for the rollback window.

Existing bcrypt passwords cannot be copied into Firebase Auth as Firestore data. Plan a password reset or controlled re-enrollment for existing users and communicate it before cutover.

## 23. Files Expected to Change During Implementation

These are future migration targets, not files changed by this audit:

- `frontend/package.json`: Firebase client dependency and scripts if needed.
- `frontend/src/context/AuthContext.jsx`: Firebase Auth session and profile loading.
- `frontend/src/services/authApi.js` and `tokenStorage.js`: replace JWT API login/storage.
- `frontend/src/services/api.js`, `attendanceApi.js`, `studentApi.js`, and `teacherApi.js`: Firestore/Functions calls or a Firebase-token API adapter.
- `frontend/src/pages/Login.jsx`: Firebase login and password reset.
- `frontend/src/pages/teacher/TakeAttendance.jsx` and `EditAttendance.jsx`: remove all time fields; retain only date, class, subject, period 1-8, and statuses.
- Teacher/student pages and components as required by the chosen data access API.
- `backend/models/*`, controllers, routes, and middleware if Express is replaced or retained as a Firebase-token adapter.
- New `functions/` source if Cloud Functions are selected.
- Firestore Rules, indexes, emulator tests, and Firebase Hosting configuration.
- `frontend/.env.example` and any root documentation.
- `README.md`, `backend/README.md`, and `render.yaml` after the deployment decision is implemented.
- A migration script and validation reports, kept separate from runtime application code.

Do not edit these files as part of the audit-only phase.

## 24. Security Review Checklist

Before production cutover, verify:

- Firebase Auth is the only password authority.
- No password or password hash exists in Firestore profiles.
- No Admin SDK credential is client-visible.
- Only `TEACHER` and `STUDENT` roles exist.
- Roles and active flags cannot be client-modified.
- Student reads are UID-scoped.
- Student writes to attendance and authorization data are denied.
- Teacher assignment checks use the verified Firebase UID.
- Teacher session ownership/edit rules are explicit and tested.
- Class membership is checked before record writes.
- Statuses are limited to `PRESENT`, `ABSENT`, and `OD`.
- Periods are limited to exactly 1 through 8.
- No time fields exist in the target session or period documents.
- Input validation handles dates, IDs, duplicate records, inactive profiles, and malformed requests.
- Firestore Rules are tested in the emulator, including attempted bypasses.
- Authentication errors do not disclose whether an email exists unnecessarily.
- Rate limits, logging, CORS, and HTTPS are configured for any remaining API.
- Secrets are absent from Git history and deployment artifacts.
- Backups, audit logs, monitoring, budget alerts, and rollback procedures exist.

## 25. Testing Plan

### Current behavior baseline

Record current API and UI behavior before migration, including:

- Login, logout, token expiry, and inactive users.
- Teacher assignment filtering.
- Duplicate session rejection.
- Teacher session ownership on read/edit.
- Student own-data-only reads.
- Student denial of all teacher/write operations.
- Status validation and percentage calculations.

### Firebase unit and integration tests

Test:

- Email/password login, logout, reset, and inactive account behavior.
- Role routing with one login page.
- Profile lookup by Firebase UID.
- Teacher access to assigned versus unassigned class/subject pairs.
- Student access to own versus another student's records.
- Denied client attempts to change role, class, UID, assignments, or attendance.
- Session uniqueness by date/class/subject/period.
- Exactly eight valid period values and rejection of 0, 9, and time fields.
- One record per student per session.
- All three statuses and the `PRESENT + OD` formula.
- Cloud Function account provisioning rollback if profile creation fails.
- SPA refresh on every protected route.
- Hosting, Auth domain, production environment, and API/Function URLs.

Use staging data and the Firebase Emulator Suite before any production write.

## 26. Rollback Plan

1. Keep the MongoDB backup and original application deployment intact.
2. During the cutover window, stop writes or use a documented dual-write policy; do not improvise dual writes.
3. Monitor authentication failures, Rules denials, missing profiles, duplicate sessions, and report mismatches.
4. If rollback criteria are met, route the frontend back to the existing backend build and MongoDB.
5. Preserve any Firebase-created records in an export; do not overwrite MongoDB automatically.
6. Reconcile changes manually or with a reviewed reverse migration tool.
7. Retain MongoDB and the last known-good application until the agreed rollback window closes.

Rollback criteria should include incorrect role resolution, cross-student data visibility, unauthorized attendance writes, loss of attendance records, percentage mismatches, or inability to authenticate a material portion of users.

## 27. Step-by-Step Implementation Order

1. Approve the architecture and decide whether account provisioning and attendance writes need Cloud Functions.
2. Define the final Firestore document IDs, ownership model, Rules, and indexes.
3. Decide the existing-user password reset/re-enrollment process.
4. Create a non-production Firebase project manually; do not use invented IDs or credentials.
5. Add Firebase client configuration through environment variables and install only required packages.
6. Implement Firebase Auth login, logout, reset, profile loading, and two-role routing.
7. Implement trusted teacher and student provisioning without an Admin role.
8. Implement Firestore Rules and emulator tests before exposing data to the UI.
9. Implement classes, subjects, assignments, and fixed periods.
10. Implement attendance sessions and records without any time fields.
11. Implement student reports and teacher workflows while preserving the existing percentage rule.
12. Import a staging copy of MongoDB data and reconcile counts and reports.
13. Run security, regression, performance, hosting, and mobile tests.
14. Configure Firebase Hosting and Functions only with real project settings.
15. Perform a controlled production migration with MongoDB retained for rollback.
16. Monitor and reconcile before retiring the old Express/MongoDB deployment.

## 28. Audit Findings and Open Decisions

Confirmed findings:

- The current system uses MongoDB/Mongoose, Express, JWT, bcrypt, React, Vite, and Axios.
- The current role enum already excludes `ADMIN`.
- The current backend enforces assignment-scoped teacher access and authenticated-student ownership.
- The current frontend has one login page and protected teacher/student routes.
- The current percentage rule already counts `OD` as attended.
- The current source still requires and stores attendance start/end times, contrary to the target requirement.
- Student and teacher account management APIs are not currently implemented.
- The repository currently documents Render deployment, not Firebase deployment.
- No Firebase project, credentials, packages, or deployment URLs are configured.

Open decisions before implementation:

- Whether the institution accepts Cloud Functions billing-plan requirements.
- Whether trusted Functions should handle all attendance writes or only provisioning.
- Whether teachers may provision students or whether provisioning remains operator-controlled.
- The exact Firestore record nesting/document-ID strategy.
- The policy for editing attendance after completion.
- The existing-user password reset and communication process.
- The authoritative meaning of `studentId` versus `registerNumber`.
- The migration timezone for date-only attendance sessions.

This document is a migration plan, not a claim that the application is Firebase-configured, deployed, or production-ready.
