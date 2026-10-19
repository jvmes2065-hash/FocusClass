# FocusClass Web (teacher + class president dashboard)

Static website (no build step) backed by Firebase. Works on any device, including iPhones.

## Setup (10 minutes)
1. Go to https://console.firebase.google.com and create a project.
2. **Build > Authentication > Sign-in method:** enable **Email/Password** and **Anonymous** (Anonymous is for the Android app later).
3. **Build > Firestore Database:** create a database, then open the **Rules** tab and paste the contents of `firestore.rules`. Publish.
4. **Project settings > Your apps > Web (</>):** register an app and copy the config into `firebase-config.js`.
5. Test locally: `python3 -m http.server 8000` then open http://localhost:8000 (modules need a server; double-clicking the file won't work).

## Host free on GitHub Pages
1. Push this folder to a GitHub repo.
2. Repo **Settings > Pages > Deploy from branch > main / root**.
3. In Firebase **Authentication > Settings > Authorized domains**, add `<your-username>.github.io`.

## How it works
- **Teacher:** creates a class (gets a 6-letter code), sets schedule, allowlist, quick pause, approves/denies requests, assigns the president.
- **Class president:** logs in, sends their ID to the teacher, enters the class code, then requests apps or pauses.
- **Android app (next step):** signs in anonymously, reads `classes/<CODE>` and follows the teacher's settings.

Data model: `classes/{CODE}` { name, teacherUid, presidentUid, enabled, startMin, endMin, pauseUntil, allowed[{pkg,name}] } with subcollections `requests` and `log`.
