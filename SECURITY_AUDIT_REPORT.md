# Security Audit Report

**Project:** Student Attendance Management System
**Audit type:** Read-only source, configuration, and locally accessible Git-history review
**Status:** **HIGH — serious vulnerabilities requiring urgent attention**
**Audit date:** 2026-11-04

## Executive summary

The audit found a high-risk authentication/account-linking weakness that is conditional on account state, a medium-risk Firestore authorization weakness, and an unsafe local provisioning script containing roster-like personal data and a predictable student-password scheme. The provisioning script is ignored by `.gitignore` and was not present in the locally accessible Git tree/history; this does not establish whether copies exist elsewhere or whether it has been run against real accounts. No real student or staff records were accessed, and no live service was contacted.

The presence of local environment files with nonempty credential fields is confirmed, but their values are not included here. The files are ignored locally; the inspected, locally reachable Git history did not show a high-confidence live service credential for the patterns checked. This does not establish that no credential was ever exposed on GitHub: remote-only refs, remote copies, uninspected systems, and validity of local values could not be verified.

The audit did not establish that the conditional authentication paths have been exercised in production, that the provisioning script has been run against real accounts, or that the Firestore rules have been deployed. Do not interpret absence of such verification as evidence that the risks are absent.

## Overall status

**HIGH: Serious vulnerability requiring urgent attention.**

This classification reflects the email-based identity-linking path, which could enable account compromise if its stated preconditions apply. The Firestore rules also did not match the documented policy of denying direct attendance writes. Review the affected account population, Firebase settings, deployed rules, and script usage before treating any issue as resolved.

## Findings

### High — Firebase identity may be linked to an existing account by email alone

- **Location:** `backend/middleware/auth.js:21-35`; optional `firebaseUid` in `backend/models/User.js:25-30`; public legacy registration in `backend/controllers/authController.js:101-137` and `backend/routes/authRoutes.js:8`; migration notes in `docs/FIREBASE_SETUP.md:34`.
- **What:** After verifying a Firebase ID token, middleware can fall back to looking up an active MongoDB user by email when the token UID is not linked. The fallback does not require the token's email to be verified.
- **Why dangerous / potential misuse:** If an active legacy profile has no Firebase UID and an attacker can create a Firebase identity for that profile's email, the attacker may be authorized as that existing profile, inheriting its role and access. This could expose or alter records available to the profile.
- **Exposure:** The code path is present. Whether vulnerable profiles exist, whether Firebase permits the relevant signup, and whether this path is reachable in production were not verified.
- **Recommended fix:** Do not grant access based on email matching alone. Require a pre-established UID link or a controlled account-linking workflow that verifies ownership and binds the UID before role-bearing access is granted. Require verified email if email-based linking remains. Inventory legacy profiles without a Firebase UID and investigate potentially affected accounts.

### Medium — Local provisioning script uses predictable passwords and contains roster-like data

- **Location:** `backend/scripts/local-seed/provisionCollegeData.js:19-27, 38-39, 82-94`.
- **What:** The local script contains 37 roster-like name/identifier entries, derives student usernames from identifiers, and uses each username as the Firebase account password. Its reconciliation flow also deletes matching attendance records and user documents.
- **Why dangerous / potential misuse:** If the roster corresponds to real people and the script was run against an accessible Firebase project, someone with access to the script could derive provisioned passwords and access those accounts. The roster itself may disclose personal information. Running the reconciliation script can delete matching data.
- **Exposure:** The script and roster-like entries were present in the local working tree, but the path is ignored by `.gitignore` and was absent from the locally accessible Git tree/history. Their provenance is unknown; the audit did not reproduce personal values, run the script, or determine whether it has been run against real accounts. No exposure on the public GitHub repository was established from the available local refs.
- **Recommended fix:** Remove real roster data from source control and use synthetic fixtures for development. Do not derive passwords from usernames, names, or identifiers. Use unique, high-entropy credentials with a secure enrollment/password-reset flow. Determine whether affected accounts exist and rotate credentials/reset sessions if necessary. Review the deletion behavior and ensure the script cannot target production unintentionally.

### Medium — Firestore rules permit out-of-assignment attendance writes

- **Location:** `firestore.rules:75-90, 94-103`; deployed rules are selected by `firebase.json`.
- **What:** Active teachers can create attendance sessions without a class/subject assignment check and can write attendance records for arbitrary student IDs without verifying membership in the session's class. Update checks do not sufficiently validate the prior record's ownership.
- **Why dangerous / potential misuse:** A teacher with a valid Firebase identity could forge or mis-scope attendance records through direct Firestore access, potentially affecting students outside their assigned classes.
- **Exposure:** This is a confirmed rules-source weakness if these rules are deployed. `docs/FIREBASE_SETUP.md:100` says direct Firestore attendance writes should remain denied; the frontend inspection found no attendance write path. The active deployed rules and direct client access were not verified.
- **Recommended fix:** Keep direct client attendance writes denied until needed, or route writes through trusted server code. If direct writes are required, enforce teacher assignment, student-to-class membership, session ownership, and both existing and resulting record ownership on updates. Add Firestore Rules emulator tests for cross-class and cross-session cases.

### Low — Username resolution may disclose account state

- **Location:** `backend/routes/authRoutes.js:8-10` (public auth routes) and the username-resolution implementation in `backend/controllers/authController.js`.
- **What:** The public username-resolution endpoint may reveal whether a username exists and return an internal Firebase identifier/email for known usernames.
- **Why dangerous / potential misuse:** This information can support account enumeration or targeted phishing and can expose identifiers that should not be returned to unauthenticated callers.
- **Exposure:** The endpoint is public. The audit did not demonstrate a direct privilege bypass or verify the exact production response.
- **Recommended fix:** Return only the minimum information required by the login UX, use a uniform response for unknown and known users where feasible, and add rate limiting/abuse monitoring.

## Credential and secret scan

- **Local ignored files:** `backend/.env` contains nonempty values for a MongoDB URI, JWT secret, Firebase private key, and admin password. `frontend/.env` contains a nonempty `VITE_FIREBASE_API_KEY`. Values are redacted and not reproduced. Their validity, ownership, environment, and production use are unknown.
- **Git status:** The auditor found these files ignored locally. The current tracked examples use empty fields/placeholders. No high-confidence live credential was found in the tracked current source or reachable history using the credential-pattern checks performed.
- **Firebase web configuration:** A Firebase web API key is normally client-visible configuration, unlike a service-account private key. The frontend's `VITE_FIREBASE_*` configuration is public to browser users by design; check API-key restrictions, authorized domains, Firebase rules, and App Check in the Firebase Console. Never place service-account keys, database passwords, JWT signing secrets, or other server secrets in `VITE_` variables.
- **Actions:** Determine whether any local values were ever pushed or shared. If a credential was exposed, revoke/rotate it in its issuing service; removing it from the latest commit is not sufficient. Do not paste values into issue trackers or reports.

## Git history findings

- The nested project repository was reported clean on `main`; `main` and `origin/main` were locally available. No tags were found, and 11 commits were reachable in the checked local history.
- The auditor performed read-only inspection of locally accessible refs/history and found only example/placeholder matches for the credential patterns checked. No high-confidence live service credential was identified in the checked reachable objects.
- The local ignored provisioning script contained roster-like entries, but the auditor verified that the file is absent from the current `main` tree and found no matching path in locally accessible Git history. Remote-only refs and other copies remain outside scope.
- No fetch or history modification was performed. The audit does not cover remote-only branches/refs, GitHub caches/forks, other repositories, developer machines, CI logs/artifacts, or whether the repository's earlier private state contained material not available in this local checkout.

## Student/staff data exposure

- No live database, Firebase project, production service, or real student/staff records were accessed or downloaded.
- The ignored local provisioning script contained roster-like entries whose provenance cannot be established from the local inspection. Treat them as potentially sensitive until the data owner confirms they are synthetic. The file was not found in the checked local Git history, so public exposure from this repository was not established.
- Heuristic contact-pattern matches occurred in some documents, generated/cache content, tests, documentation, and source. Those matches did not establish that the content was real personal information; no values are included in this report. Binary PDFs and generated assets were not fully semantically reviewed.
- No other high-confidence exposed record dataset was established in the inspected text/configuration files.

## Authentication and authorization

- Firebase ID-token verification and active-profile/role checks exist in `backend/middleware/auth.js:21-35`; the email-only fallback described above is the main identified account-linking weakness.
- Student routes require the `STUDENT` role (`backend/routes/studentRoutes.js:7-14`), and inspected student handlers derive the profile from the authenticated user rather than a caller-supplied student ID (`backend/controllers/studentController.js:144-190`).
- Teacher routes require the `TEACHER` role (`backend/routes/teacherRoutes.js:7-18`). Inspected teacher class/subject checks use `TeacherAccess` (`backend/controllers/teacherController.js:106-116`); attendance session ownership is checked (`backend/controllers/attendanceController.js:38-43`); attendance submission checks that students belong to the session class (`backend/controllers/attendanceController.js:143-146`).
- Admin and management routes use `adminManagementAccess` (`backend/routes/adminRoutes.js:6-7`, `backend/routes/managementRoutes.js:6-27`).
- Frontend route protection is a UX control, not the authorization boundary. The inspected backend performs role and ownership checks on the Mongo-backed API paths. Firebase ID tokens are obtained for API requests in `frontend/src/services/api.js`; the audit found no indication that local storage is the authentication mechanism.
- Public registration, login, and username resolution routes exist (`backend/routes/authRoutes.js:8-10`). Legacy registration restricts roles to teacher/student in the inspected implementation. The legacy login's JWT is not the token verified by the current Firebase middleware. No additional demonstrated route-level privilege bypass was identified in the inspected code.

## Backend API and application security

- Express JSON parsing is limited to 100 KB, and CORS uses an explicit origin allowlist plus configured `CLIENT_URL` (`backend/server.js:35-51`).
- Inspected Mongo-backed API handlers use Mongoose filters and application-derived identity/ownership constraints; the teacher/student checks described above reduce IDOR risk in those API paths.
- Focused searches did not identify an unsafe shell execution or `eval` sink. This is not a proof that all injection or input-validation issues are absent.
- Rate limiting/brute-force protections should be reviewed for public authentication and username-resolution endpoints. No comprehensive dynamic or adversarial test was performed.

## Firebase and MongoDB security

- Firebase Admin credentials are loaded server-side from environment variables (`backend/config/firebaseAdmin.js:10-33`). Rules deny client writes to user/profile collections, while attendance writes have the gap described above.
- MongoDB connection configuration reads the URI from the environment and sanitizes URI errors (`backend/config/database.js:31-57`).
- Local source review cannot establish whether the Firebase rules file is deployed, which Firebase Auth providers/settings are enabled, whether service-account permissions are least-privilege, or whether API-key restrictions/App Check are configured.
- Atlas network allowlists, TLS, database roles/privileges, backups, audit logs, actual database contents, and credential validity were not checked. Verify these in the Firebase Console and MongoDB Atlas dashboard without exposing production records.

## Frontend security

- Firebase browser configuration is sourced from `VITE_FIREBASE_*` variables in `frontend/src/lib/firebase.js`. These values are visible to users after build and must not contain private credentials.
- The inspected frontend reads user profiles from Firestore. No frontend write path to attendance data was found in inspected source.
- The audit found no indication that Firebase ID tokens are stored in local storage as the authentication mechanism. Review browser storage and built deployment artifacts in the deployed application to confirm production behavior.
- No confirmed XSS finding was identified in the focused source inspection. This does not replace a complete sink/source review or runtime testing.

## Dependencies

- `npm audit --offline` reported zero vulnerabilities for both frontend and backend.
- The offline advisory database may be stale; current advisory status was not verified. No packages were installed, updated, or removed.

## Deployment and hosting

- `render.yaml` declares backend secrets as externally supplied values and generates `JWT_SECRET` (`render.yaml:17-28`); frontend configuration is separately supplied (`render.yaml:38-52`).
- `firebase.json` publishes `frontend/dist` and references `firestore.rules`; it does not configure the backend deployment.
- The audit could not verify actual Render environment values, deployed origins, HTTPS, logs, service configuration, deployed artifacts, or which Firestore rules version is active. Review production logging and ensure secrets are not logged.

## Prioritized remediation checklist

1. **Urgent:** Remove email-only authorization fallback or replace it with controlled, verified account linking; inventory active profiles without Firebase UIDs and investigate potential account exposure.
2. **Urgent:** Determine whether the provisioning script has been run against real Firebase accounts. If so, reset affected credentials/sessions. Remove any real roster information from ongoing source distribution and use synthetic fixtures.
3. **Urgent:** Keep direct Firestore attendance writes denied until assignment and student-membership checks are implemented. Verify deployed rules and add emulator tests before enabling writes.
4. **High:** Check whether any non-placeholder credentials were ever pushed, shared, or logged. Revoke/rotate exposed credentials, including values from ignored local files if their secrecy or ownership is uncertain.
5. **High:** Review Firebase signup and email-verification settings, Firebase UID links, service-account permissions, API-key restrictions, and App Check in the Firebase Console.
6. **High:** Review MongoDB Atlas network access, database-user least privilege, TLS, backups, and audit logging without querying or exporting personal records.
7. **Medium:** Minimize public username-resolution responses and add rate limits/abuse monitoring to public auth endpoints.
8. **Medium:** Confirm Render environment variables and production origins/logging; ensure only intended frontend build artifacts are publicly hosted.
9. **Medium:** Re-run dependency audit with current advisory data in a trusted environment and review results without automatically updating packages.
10. **Ongoing:** Re-scan all branches/tags/remote history and CI artifacts available in GitHub, and follow the repository's secret-incident process if any credential or real personal data is found.

## Remediation follow-up

The user approved remediation after reviewing the findings. The code changes were committed and pushed to `main`:

- Firebase API authentication now requires an exact MongoDB `firebaseUid` match; email and username fallbacks were removed.
- Admin startup bootstrap now repairs missing MongoDB/Firestore admin linkage for an existing Firebase account only when the UID, expected email, role, and active state agree. Conflicting or inactive records fail closed. The bootstrap password is required only when creating a new Firebase user and does not update the password of an existing account.
- Render's blueprint now declares `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_NAME` as externally supplied values, without embedding any values in source control. Ensure those variables are configured in the Render dashboard and correspond to the same Firebase project used by the frontend.
- Username resolution now returns only the email required by the existing Firebase sign-in flow, uses the same generic authentication error for missing/inactive/disabled accounts, and no longer returns the Firebase UID, role, username, or active status. The Firebase Admin configuration error is also generic. Because the client must resolve a username to a Firebase email for this flow, the endpoint still has a distinguishable success response; eliminating that remaining enumeration signal would require changing the login flow.
- Direct client writes to Firestore attendance sessions and records are denied.
- The ignored local college provisioning script no longer contains roster entries, no longer uses a username-derived password, and now fails closed before any provisioning work. It must not be re-enabled without an approved workflow using synthetic data, safe account enrollment, and explicit safeguards against production data deletion.
- The Firebase setup documentation now describes UID-only linking and denied Firestore attendance writes.

Firebase Hosting and Firestore rules were deployed to the configured Firebase project. The hosted login page and Render backend health endpoint responded. The live username-resolution request still returned HTTP 401 after earlier commits. The user confirmed the latest Render deployment and matching Firebase configuration. Do not share deployment secrets in logs or support messages.

The follow-up code review identified the direct cause: username resolution reused the self-registration role allowlist, which excludes `ADMIN`. The resolver therefore rejected valid admin mappings even when the Firebase account and profile were active. The allowlists are now separated so admins may log in while public self-registration remains limited to teachers and students. A regression test covers this distinction. The fix was pushed in commit `60241fe`; after Render rollout, the live username-resolution endpoint returned HTTP 200. This confirms username resolution only; no password was submitted during the check, so a full credentialed login was not tested.

The local Git history scan did not find the ignored provisioning script, so exposure of its roster/password pattern on the checked public-repository history was not established. If the script was run against real accounts, investigate and reset affected credentials using the trusted Firebase administration process; source changes alone do not rotate credentials already provisioned.

The provisioning script is ignored by `.gitignore`; its local safety change will not appear in normal Git status/diffs and was not force-added. The user should keep the local copy disabled or remove it through their own reviewed repository-cleanup process rather than accidentally publishing its prior contents.

No live credentials or existing Firebase account passwords were rotated. No production student/staff records were accessed.

## Audit scope and limitations

This was a read-only source/configuration and locally accessible Git-history review. No files, code, Git history, or database configuration were changed. No destructive testing was performed. The audit did not access GitHub remotely, Firebase Console, MongoDB Atlas, Render, production endpoints, or real student/staff records. The workspace-level `docs/PROJECT_PLAN.md` is outside the nested project repository. Binary PDFs and generated artifacts were not fully semantically reviewed. Negative findings are limited to the inspected material and searches; they are not a guarantee of security.
