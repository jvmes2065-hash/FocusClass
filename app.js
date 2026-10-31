import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendPasswordResetEmail }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, addDoc, collection, onSnapshot, query, where, orderBy, limit, arrayUnion, arrayRemove, deleteDoc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const fb = initializeApp(firebaseConfig), auth = getAuth(fb), db = getFirestore(fb);
const $ = id => document.getElementById(id), app = $("app");
const fmt = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const toMin = s => { const [h, m] = s.split(":"); return +h * 60 + +m; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const daysText = d => (d && d.length ? d : [2, 3, 4, 5, 6]).map(x => DN[x - 1]).join(", ");
const QUICK = [
  { pkg: "com.google.android.apps.classroom", name: "Google Classroom" }, { pkg: "com.google.android.apps.meetings", name: "Google Meet" },
  { pkg: "us.zoom.videomeetings", name: "Zoom" }, { pkg: "com.microsoft.teams", name: "Microsoft Teams" },
  { pkg: "com.google.android.apps.docs.editors.docs", name: "Google Docs" }, { pkg: "com.google.android.apps.docs.editors.sheets", name: "Google Sheets" },
  { pkg: "com.google.android.apps.docs.editors.slides", name: "Google Slides" }, { pkg: "com.google.android.apps.docs", name: "Google Drive" },
  { pkg: "com.google.android.apps.translate", name: "Google Translate" }, { pkg: "com.duolingo", name: "Duolingo" },
  { pkg: "org.khanacademy.android", name: "Khan Academy" }, { pkg: "com.android.chrome", name: "Chrome" }
];
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
const MINS = [5, 10, 15, 20, 30, 45, 60, 90];
const pausePicker = pfx => `<select id="${pfx}m">${MINS.map(m => `<option value="${m}">${m} minutes</option>`).join("")}<option value="custom">Custom...</option></select><input id="${pfx}c" type="number" min="1" max="600" placeholder="Minutes (1 to 600)" style="display:none">`;
const bindPicker = pfx => { const sel = $(pfx + "m"); if (sel) sel.onchange = () => { $(pfx + "c").style.display = sel.value === "custom" ? "" : "none"; }; };
const readMin = pfx => { const sel = $(pfx + "m"); return sel.value === "custom" ? +$(pfx + "c").value : +sel.value; };
const dkey = ms => { const x = new Date(ms); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
const today = () => dkey(Date.now());
const GH_APK = "https://github.com/jvmes2065-hash/FocusClass-App/releases/latest/download/FocusClass.apk";
// On a short site address (Netlify or Cloudflare) the link is clean: yoursite/FocusClass.apk, which redirects to the latest build.
const APK_URL = location.hostname.endsWith("github.io") || location.protocol === "file:" ? GH_APK : location.origin + "/FocusClass.apk";
const downloadCard = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
  ? `<div class="card"><h3>FocusClass app</h3><p class="mut">The blocking app is for Android phones. On iPhone, use this website. To keep it like an app: tap Share, then Add to Home Screen.</p></div>`
  : `<div class="card"><h3>Download the Android app</h3><p class="mut">For students. It follows the class schedule and allowed apps set by the teacher.</p>
    <a class="btn" href="${APK_URL}">Download app</a><button class="alt" onclick="navigator.clipboard.writeText('${APK_URL}');this.textContent='Link copied'">Copy link</button>
    <p class="mut">1. Open the downloaded file and allow "Install unknown apps" if asked.<br>2. If a switch is greyed out: Settings, Apps, FocusClass, menu, Allow restricted settings.<br>3. Log in or sign up, then join your class with the code.</p></div>`;
const LOGO = n => `<svg viewBox="0 0 100 100" width="${n}" height="${n}" aria-hidden="true"><rect width="100" height="100" rx="22" fill="#fff"/><circle cx="50" cy="50" r="31" fill="none" stroke="#2563EB" stroke-width="5"/><circle cx="50" cy="50" r="19" fill="none" stroke="#93C5FD" stroke-width="5"/><circle cx="50" cy="50" r="7" fill="#2563EB"/></svg>`;
const PRESETS = [{ pkg: "com.facebook.orca", name: "Messenger" }, { pkg: "com.google.android.calculator", name: "Calculator" }];
let subs = [], cl = [];
const stop = a => { a.forEach(f => f()); a.length = 0; };
const header = u => `<header>${LOGO(34)}<b>FocusClass</b><span>${esc(u.email)}</span><button id="out">Log out</button></header>`;
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { alert(e.message); } };

const t0 = performance.now(); let splashGone = false;
const hideSplash = () => {
  if (splashGone) return; splashGone = true; const el = $("splash"); if (!el) return;
  setTimeout(() => { el.classList.add("hide"); setTimeout(() => el.remove(), 400); }, Math.max(0, 1000 - (performance.now() - t0)));
};
setTimeout(hideSplash, 6000);

onAuthStateChanged(auth, u => {
  stop(subs); stop(cl);
  if (!u) authView(); else if (localStorage.role === "president") president(u); else teacher(u);
  hideSplash();
});

function authView() {
  app.innerHTML = `<div class="hero">${LOGO(76)}<h1>FocusClass</h1><p>Stay focused. Learn better.</p></div><div class="wrap pull"><div class="card"><h2>Welcome</h2>
  <label class="mut">I am a</label><select id="role"><option value="teacher">Teacher</option><option value="president">Class president</option></select>
  <input id="em" type="email" placeholder="Email"><input id="pw" type="password" placeholder="Password (6+ characters)">
  <label class="mut" style="display:flex;gap:8px;align-items:flex-start;margin:6px 0"><input id="agree" type="checkbox" style="width:auto;margin-top:4px"><span>I agree to the <a href="#" id="pv">privacy notice</a> (needed to create an account).</span></label>
  <button id="login">Log in</button><button id="reg" class="alt">Create account</button><button id="forgot" class="alt">Forgot password?</button><p id="err" class="err"></p></div>${downloadCard()}</div>`;
  const go = fn => async () => { localStorage.role = $("role").value;
    try { await fn(auth, $("em").value.trim(), $("pw").value); } catch (e) { $("err").textContent = e.message; } };
  $("login").onclick = go(signInWithEmailAndPassword); $("reg").onclick = () => {
    if (!$("agree").checked) { $("err").style.color = ""; $("err").textContent = "Please tick the privacy notice to create an account."; return; }
    go(createUserWithEmailAndPassword)();
  };
  $("pv").onclick = ev => { ev.preventDefault(); alert("FocusClass stores your email, the classes you join, attendance, the names of apps students tried to open during class, device model, and security alerts in Firebase. Teachers of your class can see this. It is used for class management and this study, and it is not sold. Ask your teacher to remove you if you want your class data removed."); };
  $("forgot").onclick = async () => {
    const e = $("em").value.trim(); if (!e) { $("err").style.color = ""; $("err").textContent = "Type your email first."; return; }
    try { await sendPasswordResetEmail(auth, e); $("err").style.color = "var(--ok)"; $("err").textContent = "Reset link sent. Check your email (and spam)."; }
    catch (x) { $("err").style.color = ""; $("err").textContent = x.message; }
  };
}

/* ---------------- TEACHER ---------------- */
function teacher(u) {
  app.innerHTML = header(u) + `<main id="main"></main>`; $("out").onclick = () => signOut(auth);
  let own = [], co = [], reg = null; // reg: has this teacher entered the invite code?
  const render = () => {
    const seen = new Set();
    const list = [...own, ...co].filter(c => !c.archived && !seen.has(c.id) && seen.add(c.id));
    const cur = localStorage.cur && list.find(c => c.id === localStorage.cur) ? localStorage.cur : list[0]?.id;
    $("main").innerHTML = `${downloadCard()}<div class="card"><h3>My classes</h3>
      ${list.length ? `<select id="pick">${list.map(c => `<option value="${c.id}" ${c.id === cur ? "selected" : ""}>${esc(c.name)} (${c.id})${c.teacherUid === u.uid ? "" : " - co-teacher"}</option>`).join("")}</select>` : `<p class="mut">No class yet. Create your first one.</p>`}
      ${reg === false ? `<p class="mut">To create classes, enter the teacher invite code from the project owner (only once).</p><input id="invite" placeholder="Teacher invite code"><button id="regbtn">Verify</button>`
        : reg === true ? `<input id="cname" placeholder="New class name (e.g. Grade 10 - Math)"><button id="mk">Create class</button>` : ""}</div>
      <div class="card"><h3>Your teacher ID</h3><p class="mut">Give this to a teacher who will co-manage one of your classes.</p><input readonly value="${u.uid}" onclick="this.select()"></div><div id="cls"></div>`;
    if ($("regbtn")) $("regbtn").onclick = async () => {
      try { await setDoc(doc(db, "teachers", u.uid), { invite: $("invite").value.trim(), email: u.email }); reg = true; render(); }
      catch (e) { alert("Could not verify. Check the invite code, and that the Firestore rules are published.\n\nDetails: " + e.message); }
    };
    if ($("mk")) $("mk").onclick = guard(async () => {
      const name = $("cname").value.trim(); if (!name) return;
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      await setDoc(doc(db, "classes", code), { name, teacherUid: u.uid, coTeachers: [], presidentUid: "", enabled: true,
        startMin: 480, endMin: 900, pauseUntil: 0, allowed: PRESETS });
      localStorage.cur = code;
    });
    if ($("pick")) $("pick").onchange = e => { localStorage.cur = e.target.value; render(); };
    if (cur) openClass(u, cur, list.find(c => c.id === cur).teacherUid === u.uid); else stop(cl);
  };
  subs.push(onSnapshot(query(collection(db, "classes"), where("teacherUid", "==", u.uid)), s => { own = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }));
  subs.push(onSnapshot(query(collection(db, "classes"), where("coTeachers", "array-contains", u.uid)), s => { co = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, () => {}));
  getDoc(doc(db, "teachers", u.uid)).then(d => { reg = d.exists(); render(); }).catch(() => { reg = true; render(); });
}

function openClass(u, id, isOwner = true) {
  stop(cl); let C = null, reqs = [], logs = [], studs = [], recs = [], pinDoc = "", day = today(), sel = null, tab = "over", pday = "", surveys = [], appsSeen = [];
  const ref = doc(db, "classes", id);
  const log = text => addDoc(collection(db, "classes", id, "log"), { by: u.email, text, at: Date.now() });

  const hash = async x => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x)))].map(b => b.toString(16).padStart(2, "0")).join("");
  const pbkdf2 = async (pin, salt) => {
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 60000, hash: "SHA-256" }, k, 256);
    return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
  };
  const setPin = guard(async pin => {
    if (!/^\d{4,8}$/.test(pin)) return alert("The PIN must be 4 to 8 digits.");
    await updateDoc(ref, { pinHash: await pbkdf2(pin, id + ":focusclass"), pinAlgo: "pbkdf2" });
    await setDoc(doc(db, "classes", id, "private", "pin"), { pin });
    await log("Changed the leave PIN");
  });
  const securityCard = () => `<div class="card"><h3>Leave PIN</h3><p class="mut">Students need this PIN to leave the class or log out of the app.</p>
    <div class="code" style="font-size:28px">${pinDoc ? esc(pinDoc) : "Not set"}</div>
    <input id="pinin" inputmode="numeric" maxlength="8" placeholder="Your own PIN (4-8 digits)"><button id="pinsave">Save PIN</button><button id="pinrnd" class="alt">Random PIN</button></div>`;
  const bindSecurity = () => {
    $("pinsave").onclick = () => setPin($("pinin").value.trim());
    $("pinrnd").onclick = () => setPin(String(100000 + crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
  };
  const bToday = id => recs.filter(r => r.uid === id && r.type === "blocked" && dkey(r.at) === today()).length;
  const fmtTime = ms => new Date(ms).toLocaleString();
  const drawStudents = () => {
    const el = $("sx"); if (!el) return; const now = Date.now();
    const st = studs.find(x => x.id === sel);
    if (sel && st) return drawProfile(el, st, now);
    sel = null;
    el.innerHTML = `<div class="card"><h3>Students (${studs.length})</h3>${[...studs].sort((a, b) => (a.email || "").localeCompare(b.email || "")).map(x => {
      const on = now - x.lastSeen < 180000;
      return `<div class="row" data-s="${x.id}" style="cursor:pointer"><div style="display:flex;gap:10px;align-items:center"><div class="avatar">${esc((x.email || "?")[0].toUpperCase())}</div><div><b>${esc(x.email)}</b><div class="mut">Blocked today: ${bToday(x.id)} | Protection: ${x.admin ? "on" : "OFF"}${(C.studentPauses || {})[x.id] > Date.now() ? " | Paused" : ""}</div></div></div><span class="tag" style="${on ? "" : "background:#FEE2E2;color:#991B1B"}">${on ? "Online" : "Offline"}</span></div>`;
    }).join("") || '<p class="mut">No students yet. Share the class code.</p>'}<p class="mut">Tap a student to open their profile.</p></div>`;
    el.querySelectorAll("[data-s]").forEach(r => r.onclick = () => { sel = r.dataset.s; pday = ""; drawStudents(); drawRecords(); });
  };
  const csvDownload = (rows, name) => {
    const q = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(",")).join("\n")], { type: "text/csv" }));
    a.download = name; a.click();
  };
  const drawProfile = (el, st, now) => {
    const mine = recs.filter(r => r.uid === st.id);
    const days = new Set(mine.filter(r => r.type === "checkin").map(r => dkey(r.at)));
    const blockedAll = mine.filter(r => r.type === "blocked");
    const alerts = mine.filter(r => r.type === "tamper").length;
    const counts = {}; blockedAll.forEach(r => { const k = String(r.text).replace("Tried to open ", ""); counts[k] = (counts[k] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const on = now - st.lastSeen < 180000;
    const usageMin = arr => Math.round(arr.filter(r => r.type === "usage").reduce((a, r) => a + (r.value || 0), 0) / 60);
    const minToday = usageMin(mine.filter(r => dkey(r.at) === today())), min7 = usageMin(mine.filter(r => Date.now() - r.at < 7 * 864e5));
    const list = pday ? mine.filter(r => dkey(r.at) === pday) : mine;
    el.innerHTML = `<div class="card"><button id="back" class="alt">All students</button>
      <div style="display:flex;gap:12px;align-items:center;margin:10px 0"><div class="avatar">${esc((st.email || "?")[0].toUpperCase())}</div>
        <div><b>${esc(st.email)}</b><div><span class="tag" style="${on ? "" : "background:#FEE2E2;color:#991B1B"}">${on ? "Online" : "Offline"}</span></div></div></div>
      <div class="stats"><div><b>${days.size}</b><span>Days present</span></div><div><b>${bToday(st.id)}</b><span>Blocked today</span></div><div><b>${blockedAll.length}</b><span>Blocked total</span></div><div><b>${alerts}</b><span>Alerts</span></div></div>
      <p class="mut">Last seen: ${st.lastSeen ? fmtTime(st.lastSeen) : "never"}<br>Time in non-allowed apps: today ${minToday} min, last 7 days ${min7} min<br>Uninstall protection: ${st.admin ? "on" : "OFF"}${st.device ? "<br>Device: " + esc(st.device) + " (Android " + esc(st.android || "?") + ")" : ""}</p>
      ${top.length ? `<p><b>Most blocked apps:</b> ${top.map(t => esc(t[0]) + " (" + t[1] + ")").join(", ")}</p>` : ""}</div>
    <div class="card"><h3>Study group and membership</h3>
      <div class="mut">Control group: the app records what it would block, but does not block this student.</div>
      <select id="grp"><option value="" ${grp(st.id) === "" ? "selected" : ""}>No group</option><option value="experiment" ${grp(st.id) === "experiment" ? "selected" : ""}>Experiment (blocked)</option><option value="control" ${grp(st.id) === "control" ? "selected" : ""}>Control (monitor only)</option></select>
      <button id="mkpres" class="alt">${C.presidentUid === st.id ? "Remove as class president" : "Make class president"}</button><button id="rmst" class="bad">Remove from class</button></div>
    <div class="card"><h3>Pause FocusClass for this student</h3>
      ${(C.studentPauses || {})[st.id] > now ? `<p class="mut">Paused until ${new Date(C.studentPauses[st.id]).toLocaleTimeString()}</p>` : `<p class="mut">This student's phone stops blocking for the time you choose.</p>`}
      ${pausePicker("ps")}<button id="psgo" class="alt">Pause student</button>${(C.studentPauses || {})[st.id] > now ? '<button id="psend">End pause</button>' : ""}</div>
    <div class="card"><h3>Activity log</h3><input id="pday" type="date" value="${pday}"><button id="pall" class="alt">All days</button>
      ${list.slice(0, 100).map(r => `<div class="row"><div>${LBL[r.type] || esc(r.type)}<div class="mut">${esc(r.text)}</div></div><span class="mut">${fmtTime(r.at)}</span></div>`).join("") || '<p class="mut">No activity.</p>'}
      <button id="pcsv" class="alt">Download this student (CSV)</button></div>`;
    $("back").onclick = () => { sel = null; drawStudents(); drawRecords(); };
    bindPicker("ps");
    $("mkpres").onclick = guard(async () => {
      const isP = C.presidentUid === st.id;
      if (!isP && !confirm("Make " + st.email + " the class president? They can send requests for apps and pauses, and you approve them.")) return;
      await updateDoc(ref, { presidentUid: isP ? "" : st.id });
      await log(isP ? "Removed " + st.email + " as class president" : "Made " + st.email + " the class president");
    });
    $("grp").onchange = guard(async e => { await updateDoc(ref, { ["groups." + st.id]: e.target.value }); await log(`Set group of ${st.email}: ${e.target.value || "none"}`); });
    $("rmst").onclick = guard(async () => {
      if (!confirm("Remove " + st.email + " from this class? Their phone leaves the class automatically.")) return;
      await updateDoc(ref, { removedUids: arrayUnion(st.id) }); await deleteDoc(doc(db, "classes", id, "students", st.id));
      await log("Removed " + st.email + " from the class"); sel = null;
    });
    $("psgo").onclick = guard(async () => {
      const m = readMin("ps"); if (!(m >= 1 && m <= 600)) return alert("Enter minutes from 1 to 600.");
      await updateDoc(ref, { ["studentPauses." + st.id]: Date.now() + m * 6e4 }); await log(`Paused ${st.email} for ${m} min`);
    });
    if ($("psend")) $("psend").onclick = guard(async () => { await updateDoc(ref, { ["studentPauses." + st.id]: 0 }); await log(`Ended the pause for ${st.email}`); });
    $("pday").onchange = e => { pday = e.target.value; drawStudents(); };
    $("pall").onclick = () => { pday = ""; drawStudents(); };
    $("pcsv").onclick = () => csvDownload([["Date", "Time", "Type", "Details"], ...mine.map(r => [new Date(r.at).toLocaleDateString(), new Date(r.at).toLocaleTimeString(), r.type, r.text])],
      "focusclass-" + who(st.id, st.email || "student") + ".csv");
  };
  const LBL = { checkin: "Checked in", joined: "Joined", left: "Left", blocked: "Blocked app", tamper: "Security alert", usage: "Time in app", diagnostic: "Diagnostic" };
  const drawRecords = () => {
    const el = $("rx"); if (!el) return; drawExtras(); if (sel) { el.innerHTML = ""; return; }
    const list = recs.filter(r => dkey(r.at) === day);
    const present = new Set(list.filter(r => r.type === "checkin").map(r => r.email));
    const lateSet = new Set(list.filter(r => r.type === "checkin" && String(r.text).startsWith("Late")).map(r => r.email));
    const absent = studs.map(s => s.email).filter(e => !present.has(e));
    el.innerHTML = `<div class="card"><h3>Class record</h3><input id="day" type="date" value="${day}">
      <p><b>Present (${present.size}):</b> ${[...present].map(e => esc(e) + (lateSet.has(e) ? " (late)" : "")).join(", ") || "none"}</p>
      <p><b>Not checked in (${absent.length}):</b> ${absent.map(esc).join(", ") || "none"}</p>
      ${list.slice(0, 50).map(r => `<div class="row"><div>${esc(r.email)}<div class="mut">${LBL[r.type] || esc(r.type)}: ${esc(r.text)}</div></div><span class="mut">${new Date(r.at).toLocaleTimeString()}</span></div>`).join("") || '<p class="mut">No records for this day.</p>'}
      <label class="mut" style="display:block;margin:6px 0"><input id="anon" type="checkbox" style="width:auto"> Anonymize names in downloads</label><button id="csv" class="alt">Download all (CSV)</button><button id="wcsv" class="alt">Download weekly summary (CSV)</button></div>`;
    $("day").onchange = e => { day = e.target.value || today(); drawRecords(); };
    $("wcsv").onclick = () => {
      const wk = recs.filter(r => Date.now() - r.at < 7 * 864e5), mins = m => Math.round(m.filter(r => r.type === "usage").reduce((a, r) => a + (r.value || 0), 0) / 60);
      csvDownload([["Student", "Group", "Days present", "Late check-ins", "Blocked attempts", "Minutes in non-allowed apps", "Security alerts"],
        ...studs.map(st => { const m = wk.filter(r => r.uid === st.id);
          return [who(st.id, st.email), grp(st.id), new Set(m.filter(r => r.type === "checkin").map(r => dkey(r.at))).size,
            m.filter(r => r.type === "checkin" && String(r.text).startsWith("Late")).length, m.filter(r => r.type === "blocked").length, mins(m), m.filter(r => r.type === "tamper").length]; })],
        "focusclass-weekly-" + id + ".csv");
    };
    $("csv").onclick = () => {
      const q = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
      const rows = [["Date", "Time", "Student", "Group", "Type", "Details", "Seconds"], ...recs.map(r => [new Date(r.at).toLocaleDateString(), new Date(r.at).toLocaleTimeString(), who(r.uid, r.email), grp(r.uid), r.type, r.text, r.value || ""])];
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(",")).join("\n")], { type: "text/csv" }));
      a.download = "focusclass-" + id + ".csv"; a.click();
    };
  };
  const subjectsCard = () => `<div class="card"><h3>Subjects</h3><p class="mut">Add class periods. Phones are only restricted during these periods, and a subject can allow extra apps (like a math app). With no subjects, the schedule above is used.</p>
    ${(C.periods || []).map((p, i) => `<div class="row"><div><b>${esc(p.name)}</b> <span class="mut">${fmt(p.start)} - ${fmt(p.end)}${p.days && p.days.length ? " (" + daysText(p.days) + ")" : ""}</span>${p.apps && p.apps.length ? `<div class="mut">Extra apps: ${p.apps.map(esc).join(", ")}</div>` : ""}</div><button class="bad" data-sub="${i}">Remove</button></div>`).join("")}
    <input id="sn" placeholder="Subject (e.g. Math)"><input id="ss" type="time" value="08:00"><input id="se" type="time" value="09:00"><input id="sa" placeholder="Extra apps, comma separated (optional)"><div class="mut">Days for this subject (all ticked = every class day)</div><div class="days">${DN.map((n, i) => `<label class="dchip"><input type="checkbox" class="sdc" value="${i + 1}" checked>${n}</label>`).join("")}</div><button id="sadd">Add subject</button></div>`;
  const bindSubjects = () => {
    $("sadd").onclick = guard(async () => {
      const name = $("sn").value.trim(), start = toMin($("ss").value), end = toMin($("se").value);
      if (!name || !(end > start)) return alert("Enter a subject name, and a start time that is before the end time.");
      const apps = $("sa").value.split(",").map(x => x.trim()).filter(Boolean);
      const sdays = [...document.querySelectorAll(".sdc")].filter(x => x.checked).map(x => +x.value);
      if (!sdays.length) return alert("Pick at least one day for this subject.");
      const list = [...(C.periods || []), { name, start, end, apps, days: sdays.length === 7 ? [] : sdays }].sort((a, b) => a.start - b.start);
      await updateDoc(ref, { periods: list }); await log("Added subject " + name);
    });
    document.querySelectorAll("[data-sub]").forEach(b => b.onclick = guard(async () => {
      await updateDoc(ref, { periods: (C.periods || []).filter((_, i) => i !== +b.dataset.sub) }); await log("Removed a subject");
    }));
  };
  const announceCard = () => `<div class="card"><h3>Announcement</h3><p class="mut">Shows on students' home screens in the app.</p>
    <input id="ann" placeholder="Message to students" value="${esc(C.announcement || "")}"><button id="annpost">Post</button>${C.announcement ? '<button id="annclr" class="alt">Clear</button>' : ""}</div>`;
  const coCard = () => `<div class="card" ${isOwner ? "" : 'style="display:none"'}><h3>Co-teachers</h3><p class="mut">A co-teacher can manage this class too. They send you their teacher ID (shown on their home page).</p>
    ${(C.coTeachers || []).map(t => `<div class="row"><span class="mut" style="word-break:break-all">${esc(t)}</span><button class="bad" data-cot="${esc(t)}">Remove</button></div>`).join("")}
    <input id="cot" placeholder="Co-teacher's ID"><button id="cotadd">Add co-teacher</button></div>`;
  const foundApps = () => {
    const m = new Map(), have = new Set((C.allowed || []).map(x => x.pkg));
    appsSeen.forEach(d => String(d.apps || "").split("\n").forEach(line => {
      const [pkg, name] = line.split("\t"); if (!pkg || have.has(pkg)) return;
      const e = m.get(pkg) || { pkg, name: name || pkg, n: 0 }; e.n++; m.set(pkg, e);
    }));
    return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 40);
  };
  const holidaysCard = () => `<div class="card"><h3>No-class dates</h3><p class="mut">Holidays or suspended classes. Phones are not restricted on these dates.</p>
    ${(C.holidays || []).map(d => `<div class="row"><span>${esc(d)}</span><button class="bad" data-hd="${esc(d)}">Remove</button></div>`).join("")}
    <input id="hd" type="date"><button id="hadd">Add date</button></div>`;
  const inClassNow = () => {
    const d = new Date(), dow = d.getDay() + 1, m = d.getHours() * 60 + d.getMinutes();
    if (!(C.days || [2, 3, 4, 5, 6]).includes(dow) || (C.holidays || []).includes(today())) return false;
    if (!(C.periods && C.periods.length)) return m >= C.startMin && m < C.endMin;
    return C.periods.filter(p => !p.days || !p.days.length || p.days.includes(dow)).some(p => m >= p.start && m < p.end);
  };
  const drawAttention = () => {
    const el = $("att"); if (!el || !C) return; const now = Date.now(), t0 = today(), items = [];
    const live = C.enabled && !(C.pauseUntil > now) && inClassNow();
    studs.forEach(st => {
      const alerts = recs.filter(r => r.uid === st.id && r.type === "tamper" && dkey(r.at) === t0).length;
      if (alerts) items.push([st.email, alerts + " security alert" + (alerts > 1 ? "s" : "") + " today"]);
      if (live && now - st.lastSeen > 180000) items.push([st.email, "Offline during class"]);
    });
    el.innerHTML = items.length ? `<div class="card"><h3>Needs attention (${items.length})</h3>${items.map(i => `<div class="row"><div><b>${esc(i[0])}</b><div class="mut">${i[1]}</div></div></div>`).join("")}</div>` : "";
  };
  const grp = uid => (C.groups || {})[uid] || "";
  const who = (uid, email) => ($("anon") && $("anon").checked) ? "S" + (studs.map(x => x.id).sort().indexOf(uid) + 1) : email;
  const drawExtras = () => {
    const ex = $("ext"); if (!ex) return; if (sel) { ex.innerHTML = ""; return; }
    const days = []; for (let i = 13; i >= 0; i--) days.push(dkey(Date.now() - i * 864e5));
    const blk = days.map(d => recs.filter(r => r.type === "blocked" && dkey(r.at) === d).length);
    const att = days.map(d => new Set(recs.filter(r => r.type === "checkin" && dkey(r.at) === d).map(r => r.uid)).size);
    const bars = (arr, color) => { const mx = Math.max(1, ...arr); return `<div style="display:flex;align-items:flex-end;gap:3px;height:70px">${arr.map((v, i) => `<div title="${days[i]}: ${v}" style="flex:1;background:${color};height:${Math.round(v / mx * 100)}%;min-height:2px;border-radius:3px"></div>`).join("")}</div>`; };
    const dm = days.map(d => Math.round(recs.filter(r => r.type === "usage" && dkey(r.at) === d).reduce((a, r) => a + (r.value || 0), 0) / 60));
    const sc = surveys.map(x => x.score).filter(x => typeof x === "number");
    const avg = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : null;
    ex.innerHTML = `<div class="card"><h3>Trends (last 14 days)</h3><div class="mut">Blocked attempts per day</div>${bars(blk, "var(--pri)")}
      <div class="mut" style="margin-top:10px">Students present per day</div>${bars(att, "var(--ok)")}
      <div class="mut" style="margin-top:10px">Minutes in non-allowed apps per day</div>${bars(dm, "#D97706")}<div class="mut" style="margin-top:6px">${days[0]} to ${days[13]}</div></div>
      <div class="card"><h3>Usability survey (SUS)</h3>${avg === null ? '<p class="mut">No responses yet. Students answer it in the app under My profile.</p>'
        : `<p><b>${sc.length}</b> response${sc.length > 1 ? "s" : ""}. Average score: <b>${avg.toFixed(1)}</b> / 100 <span class="mut">(68 is average, above 80 is excellent)</span></p>`}
      ${surveys.map(x => `<div class="row"><div>${esc(x.email)}<div class="mut">${grp(x.id) ? "Group: " + esc(grp(x.id)) : ""}</div></div><b>${typeof x.score === "number" ? x.score.toFixed(1) : "-"}</b></div>`).join("")}
      <button id="svcsv" class="alt">Download survey (CSV)</button></div>`;
    $("svcsv").onclick = () => csvDownload([["Student", "Group", "SUS score", "Answers (Q1 to Q10)"], ...surveys.map(x => [who(x.id, x.email), grp(x.id), x.score, x.answers])], "focusclass-survey-" + id + ".csv");
  };
  const showTab = () => {
    document.querySelectorAll(".tabp").forEach(p => p.style.display = p.dataset.t === tab ? "" : "none");
    document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  };
  const bindTabs = () => { document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; showTab(); }); showTab(); };
  const draw = () => {
    if (!C || !$("cls")) return;
    const paused = C.pauseUntil > Date.now(), pend = reqs.filter(r => r.status === "pending");
    $("cls").innerHTML = `<div class="tabs"><button data-tab="over">Overview</button><button data-tab="set">Settings</button><button data-tab="stu">Students</button></div><div class="tabp" data-t="over"><div id="att"></div>${announceCard()}<div class="card"><div class="mut">Class code (share with president and Android students)</div><div class="code">${id}</div>
      <p>Status: <b>${!C.enabled ? "OFF" : paused ? "Paused until " + new Date(C.pauseUntil).toLocaleTimeString() : "Class mode ON"}</b></p>
      <button id="tg" class="${C.enabled ? "bad" : "ok"}">${C.enabled ? "Turn OFF" : "Turn ON"}</button>
      <div class="mut" style="margin-top:8px">Pause the whole class for:</div>${pausePicker("pc")}<button id="pgo" class="alt">Pause class</button>${paused ? '<button id="p0">End pause</button>' : ""}
      ${(() => { const sp = Object.entries(C.studentPauses || {}).filter(([, t]) => t > Date.now()); return sp.length ? `<div class="mut" style="margin-top:12px">Paused students</div>` + sp.map(([u, t]) => `<div class="row"><div>${esc((studs.find(x => x.id === u) || {}).email || u)}<div class="mut">until ${new Date(t).toLocaleTimeString()}</div></div><button class="alt" data-endp="${u}">End</button></div>`).join("") : ""; })()}</div>
    <div class="card"><h3>Pending requests (${pend.length})</h3>${pend.map(r => `<div class="row"><div>${r.type === "app" ? "Add app: <b>" + esc(r.name) + "</b> <span class=mut>" + esc(r.pkg) + "</span>" : r.type === "student" ? "<b>" + esc(r.email) + "</b> asks for a <b>" + r.minutes + " min</b> pause" : "Pause for <b>" + r.minutes + " min</b>"}<div class="mut">${esc(r.reason)}</div></div>
      <div><button class="ok" data-a="${r.id}">Approve</button><button class="bad" data-d="${r.id}">Deny</button></div></div>`).join("") || '<p class="mut">None</p>'}</div>
    <div class="card"><h3>Activity log</h3>${logs.slice(0, 10).map(l => `<div class="row"><span>${esc(l.text)}</span><span class="mut">${new Date(l.at).toLocaleString()}</span></div>`).join("") || '<p class="mut">Empty</p>'}</div></div><div class="tabp" data-t="set" style="display:none"><div class="card"><h3>Schedule</h3><div class="days">${DN.map((n, i) => `<label class="dchip"><input type="checkbox" class="dayc" value="${i + 1}" ${(C.days || [2, 3, 4, 5, 6]).includes(i + 1) ? "checked" : ""}>${n}</label>`).join("")}</div>
      <input id="st" type="time" value="${fmt(C.startMin)}"><input id="en" type="time" value="${fmt(C.endMin)}"><div class="mut">Mark students late after (minutes)</div><input id="late" type="number" min="0" max="120" value="${C.lateAfter ?? 10}"><button id="sv">Save schedule</button></div>
    ${holidaysCard()}${subjectsCard()}<div class="card"><h3>Allowed apps</h3><div class="mut">Quick add</div><div class="days">${QUICK.filter(a => !C.allowed.some(x => x.pkg === a.pkg)).map(a => `<button class="alt" data-qa="${a.pkg}" style="margin:0">+ ${a.name}</button>`).join("") || '<span class="mut">All quick apps are added</span>'}</div><div class="mut" style="margin-top:8px">Found on students' phones (tap to allow)</div><div class="days">${foundApps().map(a => `<button class="alt" data-fa="${esc(a.pkg)}" style="margin:0">+ ${esc(a.name)} (${a.n})</button>`).join("") || '<span class="mut">Nothing yet. Apps appear after students open FocusClass.</span>'}</div>${C.allowed.map(a => `<div class="row"><div>${esc(a.name)} <span class="mut">${esc(a.pkg)}</span></div><button class="bad" data-rm="${esc(a.pkg)}">Remove</button></div>`).join("")}
      <input id="an" placeholder="App name"><input id="ap" placeholder="Package name (e.g. com.duolingo)"><button id="ad">Add app</button>
      <p class="mut">Phone, SMS and the home screen are always allowed by the Android app.</p></div>
    <div class="card"><h3>Class president</h3><p class="mut">${C.presidentUid ? "Current president: <b>" + esc((studs.find(x => x.id === C.presidentUid) || {}).email || C.presidentUid) + "</b>." : "No class president yet."} Easiest: open a student in the Students tab and tap Make class president. That student logs in on this website with the same email and password as the app and chooses Class president. You can also paste an ID below.</p>
      <input id="pid" placeholder="President's ID" value="${esc(C.presidentUid)}"><button id="ps">Save</button></div>
    ${securityCard()}${coCard()}<div class="card" ${isOwner ? "" : 'style="display:none"'}><h3>Archive class</h3><p class="mut">Hides this class and removes it from every student's phone. Use it when the class is finished. To get a new class code, archive this class and create a new one.</p><button id="arch" class="bad">Archive this class</button></div></div><div class="tabp" data-t="stu" style="display:none"><div id="sx"></div><div id="rx"></div><div id="ext"></div></div>`;
    const up = (d, msg) => guard(async () => { await updateDoc(ref, d); if (msg) await log(msg); });
    $("tg").onclick = up({ enabled: !C.enabled }, C.enabled ? "Turned class mode OFF" : "Turned class mode ON");
    $("pgo").onclick = () => {
      const m = readMin("pc"); if (!(m >= 1 && m <= 600)) return alert("Enter minutes from 1 to 600.");
      up({ pauseUntil: Date.now() + m * 6e4 }, `Paused the class for ${m} min`)();
    };
    bindPicker("pc");
    document.querySelectorAll("[data-endp]").forEach(b => b.onclick = guard(async () => {
      await updateDoc(ref, { ["studentPauses." + b.dataset.endp]: 0 }); await log("Ended a student's pause");
    }));
    if ($("p0")) $("p0").onclick = up({ pauseUntil: 0 }, "Ended pause");
    $("sv").onclick = () => {
      const days = [...document.querySelectorAll(".dayc")].filter(x => x.checked).map(x => +x.value);
      if (!days.length) return alert("Pick at least one day.");
      up({ startMin: toMin($("st").value), endMin: toMin($("en").value), days, lateAfter: Math.max(0, +$("late").value || 0) }, `Schedule set ${$("st").value}-${$("en").value} (${daysText(days)})`)();
    };
    $("ad").onclick = () => { const pkg = $("ap").value.trim(), name = $("an").value.trim() || pkg; if (pkg) up({ allowed: arrayUnion({ pkg, name }) }, "Allowed " + name)(); };
    $("ps").onclick = () => up({ presidentUid: $("pid").value.trim() }, "Assigned class president")();
    document.querySelectorAll("[data-qa]").forEach(b => b.onclick = () => { const a = QUICK.find(x => x.pkg === b.dataset.qa); up({ allowed: arrayUnion({ pkg: a.pkg, name: a.name }) }, "Allowed " + a.name)(); });
    $("hadd").onclick = () => { const d = $("hd").value; if (!d) return alert("Pick a date."); up({ holidays: [...new Set([...(C.holidays || []), d])].sort() }, "Added no-class date " + d)(); };
    document.querySelectorAll("[data-hd]").forEach(b => b.onclick = () => up({ holidays: (C.holidays || []).filter(x => x !== b.dataset.hd) }, "Removed no-class date " + b.dataset.hd)());
    $("arch").onclick = () => { if (confirm("Archive this class? Students will be removed from it on their phones.")) up({ archived: true }, "Archived the class")(); };
    $("annpost").onclick = () => up({ announcement: $("ann").value.trim(), announcementAt: Date.now() }, "Posted an announcement")();
    if ($("annclr")) $("annclr").onclick = () => up({ announcement: "", announcementAt: 0 }, "Cleared the announcement")();
    document.querySelectorAll("[data-fa]").forEach(b => b.onclick = () => { const a = foundApps().find(x => x.pkg === b.dataset.fa); if (a) up({ allowed: arrayUnion({ pkg: a.pkg, name: a.name }) }, "Allowed " + a.name)(); });
    $("cotadd").onclick = () => { const v = $("cot").value.trim(); if (v) up({ coTeachers: arrayUnion(v) }, "Added a co-teacher")(); };
    document.querySelectorAll("[data-cot]").forEach(b => b.onclick = () => up({ coTeachers: arrayRemove(b.dataset.cot) }, "Removed a co-teacher")());
    drawAttention();
    bindSecurity(); drawStudents(); drawRecords(); bindTabs(); bindSubjects();
    document.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { const a = C.allowed.find(x => x.pkg === b.dataset.rm); up({ allowed: arrayRemove(a) }, "Removed " + a.name)(); });
    document.querySelectorAll("[data-a]").forEach(b => b.onclick = guard(async () => {
      const r = reqs.find(x => x.id === b.dataset.a);
      await updateDoc(doc(db, "classes", id, "requests", r.id), { status: "approved" });
      if (r.type === "app") await updateDoc(ref, { allowed: arrayUnion({ pkg: r.pkg, name: r.name }) });
      else if (r.type === "student") await updateDoc(ref, { ["studentPauses." + r.by]: Date.now() + r.minutes * 6e4 });
      else await updateDoc(ref, { pauseUntil: Date.now() + r.minutes * 6e4 });
      await log("Approved request: " + (r.type === "app" ? r.name : r.minutes + " min pause"));
    }));
    document.querySelectorAll("[data-d]").forEach(b => b.onclick = guard(async () => {
      await updateDoc(doc(db, "classes", id, "requests", b.dataset.d), { status: "denied" }); await log("Denied a request"); }));
  };
  cl.push(onSnapshot(ref, s => { C = s.data(); draw(); }));
  cl.push(onSnapshot(collection(db, "classes", id, "requests"), s => { reqs = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at); draw(); }));
  cl.push(onSnapshot(collection(db, "classes", id, "log"), s => { logs = s.docs.map(d => d.data()).sort((a, b) => b.at - a.at); draw(); }));
  cl.push(onSnapshot(collection(db, "classes", id, "students"), s => { studs = s.docs.map(d => ({ id: d.id, ...d.data() })); drawStudents(); drawRecords(); drawAttention(); }));
  cl.push(onSnapshot(query(collection(db, "classes", id, "records"), orderBy("at", "desc"), limit(500)), s => { recs = s.docs.map(d => d.data()); drawRecords(); drawAttention(); }));
  cl.push(onSnapshot(collection(db, "classes", id, "apps"), s => { appsSeen = s.docs.map(d => d.data()); if (C) draw(); }, () => {}));
  cl.push(onSnapshot(collection(db, "classes", id, "surveys"), s => { surveys = s.docs.map(d => ({ id: d.id, ...d.data() })); drawRecords(); }, () => {}));
  cl.push(onSnapshot(doc(db, "classes", id, "private", "pin"), s => { pinDoc = s.exists() ? s.data().pin : ""; if (C) draw(); }, () => {}));
  const tm = setInterval(() => { drawStudents(); drawAttention(); }, 30000); cl.push(() => clearInterval(tm));
}

/* ---------------- CLASS PRESIDENT ---------------- */
function president(u) {
  app.innerHTML = header(u) + `<main>${downloadCard()}<div class="card"><h3>Your ID</h3><p class="mut">Your teacher can make you class president from their Students tab. If they ask, send them this ID.</p>
    <input readonly value="${u.uid}" onclick="this.select()"></div>
    <div class="card"><h3>Class</h3><input id="code" placeholder="Class code" value="${esc(localStorage.code || "")}"><button id="go">Open class</button></div><div id="cls"></div></main>`;
  $("out").onclick = () => signOut(auth);
  $("go").onclick = () => { localStorage.code = $("code").value.trim().toUpperCase(); openAsPresident(u, localStorage.code); };
  if (localStorage.code) openAsPresident(u, localStorage.code);
}

function openAsPresident(u, id) {
  stop(cl); let C = null, reqs = [];
  const draw = () => {
    if (!C) return $("cls").innerHTML = `<p class="err">Class not found.</p>`;
    $("cls").innerHTML = `<div class="card"><h3>${esc(C.name)}</h3>
      <p>Schedule: <b>${fmt(C.startMin)} - ${fmt(C.endMin)}</b> (${daysText(C.days)}) &middot; ${C.enabled ? "ON" : "OFF"}</p>
      <div class="mut">Allowed apps</div>${C.allowed.map(a => `<span class="tag">${esc(a.name)}</span> `).join("")}
      ${C.presidentUid !== u.uid ? '<p class="err">Your teacher has not made you class president yet. Send them your ID above.</p>' : ""}</div>
    <div class="card"><h3>Request an app</h3><input id="an" placeholder="App name"><input id="ap" placeholder="Package name (e.g. com.duolingo)"><input id="ar" placeholder="Reason"><button id="sa">Send request</button></div>
    <div class="card"><h3>Request a pause</h3><select id="pm"><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select><input id="pr" placeholder="Reason"><button id="sp">Send request</button></div>
    <div class="card"><h3>My requests</h3>${reqs.map(r => `<div class="row"><span>${r.type === "app" ? esc(r.name) : r.minutes + " min pause"}</span><span class="tag">${r.status}</span></div>`).join("") || '<p class="mut">None yet</p>'}</div>`;
    const send = d => guard(() => addDoc(collection(db, "classes", id, "requests"), { ...d, by: u.uid, status: "pending", at: Date.now() }));
    $("sa").onclick = () => { const pkg = $("ap").value.trim(); if (pkg) send({ type: "app", pkg, name: $("an").value.trim() || pkg, reason: $("ar").value.trim() })(); };
    $("sp").onclick = () => send({ type: "pause", minutes: +$("pm").value, reason: $("pr").value.trim() })();
  };
  cl.push(onSnapshot(doc(db, "classes", id), s => { C = s.exists() ? s.data() : null; draw(); }, () => { C = null; draw(); }));
  cl.push(onSnapshot(query(collection(db, "classes", id, "requests"), where("by", "==", u.uid)),
    s => { reqs = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at); if (C) draw(); }, () => {}));
}
