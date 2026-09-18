# Firebase Setup

This project now supports Firebase Email/Password authentication and Firebase client initialization while retaining the existing Express/MongoDB API during the staged migration. No Firebase project, account, or production data is created by the repository.

## 1. Firebase project

Use the Firebase project and Web App already created for this application. Do not create a second project or Web App.

In Firebase Console:

1. Open Authentication and enable the Email/Password provider.
2. Open Firestore Database and confirm the existing database is available.
3. Add the local development domain to Authentication authorized domains if Firebase requires it.
4. Create profile documents for real test users through a trusted process. The client does not create accounts or roles automatically.

## 2. Frontend configuration

Copy `frontend/.env.example` to `frontend/.env` and fill the `VITE_FIREBASE_*` values from Firebase Console > Project settings > Your apps > Web app configuration. Keep `VITE_API_URL` pointed at the existing backend while the Express API remains active.

The Firebase web configuration is client configuration, not an Admin credential. Do not put service-account JSON, private keys, or Firebase Admin values in the frontend.

## 3. Backend configuration

The backend accepts Firebase ID tokens when all of these server-only variables are configured in `backend/.env`:

```text
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

Use the service-account values from a secure server deployment mechanism. If `FIREBASE_PRIVATE_KEY` is stored as an environment variable, preserve escaped newlines as `\\n`. Never commit these values or place them in Vite variables.

The backend links a verified Firebase token to the existing MongoDB `User` by `firebaseUid` when provisioned, with normalized Firebase identifier fallback for staged migration, and requires an active profile. The legacy JWT path remains available during staged migration. The backend still requires `MONGODB_URI` and existing application configuration until the data migration is deliberately completed.

## 4. Firestore profile structure

After creating a real Firebase Auth user through an approved server-side provisioning process, create `users/{uid}` with only profile/authorization metadata:

```text
{
  uid: "...",
  username: "student01",
  role: "TEACHER" or "STUDENT",
  active: true,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

Use `students/{uid}` or `teachers/{uid}` for the matching profile. Do not store passwords or password hashes. Do not set a role from the login page.

Usernames are normalized to lowercase and must match the local part of the deterministic Firebase Auth identifier `username@auth.student-attendance.app`. This is an application-specific identifier, not a real mailbox, and must not be displayed as a user email address. The `User` Mongo model now has sparse `username` and `firebaseUid` linkage fields for the existing API.

The deterministic Firebase identifier provides the authentication-side uniqueness constraint. The trusted provisioning process must also reserve the normalized username in MongoDB with the unique `User.username` index and write the same username to `users/{uid}` and the matching `students/{uid}` or `teachers/{uid}` profile. Client-side Firestore writes remain denied, so users cannot alter their own role or username.

The current repository has no safe teacher/student account-creation flow. Do not call Firebase account creation from a logged-in teacher's browser, because it would replace the current Firebase session. A trusted server-side provisioning operation must create the Auth account, Firestore profiles, and Mongo linkage while enforcing username uniqueness across both roles.

Phase 14 adds that trusted operation as the teacher-only backend endpoint `POST /api/teacher/students`. It requires the Firebase Admin variables above, verifies the caller's Firebase UID against an active Firestore `TEACHER` profile, verifies class authorization from the existing teaching assignment, then creates the student in Firebase Authentication, Firestore, and the existing Mongo attendance identity. The frontend never receives Admin credentials and the teacher session remains active.

## 5. Local run

```text
cd frontend
npm install
npm run dev
```

Run the existing backend separately when using the current API:

```text
cd backend
npm install
npm run dev
```

If the frontend reports that Firebase is not configured, check that `frontend/.env` contains all six `VITE_FIREBASE_*` values and restart Vite.

## 6. Login and access checks

Use a real Firebase Auth account whose matching `users/{uid}` document has either `TEACHER` or `STUDENT` and `active: true`.

Verify:

- One login page accepts only username and password.
- A teacher reaches teacher routes and cannot reach student routes.
- A student reaches student routes and cannot reach teacher routes.
- Missing, inactive, or unsupported profiles are rejected.
- Password reset is intentionally not exposed because synthetic identifiers cannot receive recovery email.
- Logout removes the Firebase session and protected pages redirect to login.

No test account or sample Firestore data is created automatically.

The existing Express/Mongo email and JWT endpoints are retained only for staged migration and are not the Firebase username login path. They must not be used to create new Firebase accounts or treated as a password-reset mechanism.

## 7. Security files

`firestore.rules` denies profile and authorization writes from clients. Attendance reads and writes remain denied directly in Firestore until trusted Functions are implemented; the current attendance API continues to enforce MongoDB authorization. `firestore.indexes.json` is intentionally empty because the current Firebase client integration performs only a direct `users/{uid}` profile lookup.

Before allowing direct Firestore attendance access, implement and test assignment-scoped Rules or trusted Cloud Functions using the final document IDs and ownership model. Never replace the denied rules with `allow read, write: if true`.

## 8. Deployment later

Deployment is intentionally not configured in this phase. Before deploying:

1. Configure production Firebase web values in the hosting environment.
2. Configure server-only Admin credentials through the backend/Functions secret mechanism.
3. Decide whether attendance remains behind Express or moves to tested Cloud Functions.
4. Run Firestore Rules emulator tests and application regression tests.
5. Configure Firebase Hosting for the Vite `frontend/dist` output and SPA fallback.
6. Keep MongoDB and the current deployment available for rollback until migration is reconciled.
