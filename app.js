import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, addDoc, collection, onSnapshot, query, where, orderBy, limit, arrayUnion, arrayRemove }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const fb = initializeApp(firebaseConfig), auth = getAuth(fb), db = getFirestore(fb);
const $ = id => document.getElementById(id), app = $("app");
const fmt = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const toMin = s => { const [h, m] = s.split(":"); return +h * 60 + +m; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const DN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const daysText = d => (d && d.length ? d : [2, 3, 4, 5, 6]).map(x => DN[x - 1]).join(", ");
const dkey = ms => { const x = new Date(ms); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
const today = () => dkey(Date.now());
const GH_APK = "https://github.com/jvmes2065-hash/FocusClass-App/releases/latest/download/FocusClass.apk";
// On a short site address (Netlify or Cloudflare) the link is clean: yoursite/FocusClass.apk, which redirects to the latest build.
const APK_URL = location.hostname.endsWith("github.io") || location.protocol === "file:" ? GH_APK : location.origin + "/FocusClass.apk";
const downloadCard = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
  ? `<div class="card"><h3>FocusClass app</h3><p class="mut">The app is for Android phones. On iPhone you can use this website.</p></div>`
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
  <button id="login">Log in</button><button id="reg" class="alt">Create account</button><p id="err" class="err"></p></div>${downloadCard()}</div>`;
  const go = fn => async () => { localStorage.role = $("role").value;
    try { await fn(auth, $("em").value.trim(), $("pw").value); } catch (e) { $("err").textContent = e.message; } };
  $("login").onclick = go(signInWithEmailAndPassword); $("reg").onclick = go(createUserWithEmailAndPassword);
}

/* ---------------- TEACHER ---------------- */
function teacher(u) {
  app.innerHTML = header(u) + `<main id="main"></main>`; $("out").onclick = () => signOut(auth);
  subs.push(onSnapshot(query(collection(db, "classes"), where("teacherUid", "==", u.uid)), s => {
    const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
    const cur = localStorage.cur && list.find(c => c.id === localStorage.cur) ? localStorage.cur : list[0]?.id;
    $("main").innerHTML = `${downloadCard()}<div class="card"><h3>My classes</h3>
      ${list.length ? `<select id="pick">${list.map(c => `<option value="${c.id}" ${c.id === cur ? "selected" : ""}>${esc(c.name)} (${c.id})</option>`).join("")}</select>` : `<p class="mut">No class yet. Create your first one.</p>`}
      <input id="cname" placeholder="New class name (e.g. Grade 10 - Math)"><button id="mk">Create class</button></div><div id="cls"></div>`;
    $("mk").onclick = guard(async () => {
      const name = $("cname").value.trim(); if (!name) return;
      const code = Math.random().toString(36).slice(2, 8).toUpperCase();
      await setDoc(doc(db, "classes", code), { name, teacherUid: u.uid, presidentUid: "", enabled: true,
        startMin: 480, endMin: 900, pauseUntil: 0, allowed: PRESETS });
      localStorage.cur = code;
    });
    if ($("pick")) $("pick").onchange = e => { localStorage.cur = e.target.value; openClass(u, e.target.value); };
    if (cur) openClass(u, cur);
  }));
}

function openClass(u, id) {
  stop(cl); let C = null, reqs = [], logs = [], studs = [], recs = [], pinDoc = "", day = today(), sel = null, tab = "over", pday = "";
  const ref = doc(db, "classes", id);
  const log = text => addDoc(collection(db, "classes", id, "log"), { by: u.email, text, at: Date.now() });

  const hash = async x => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x)))].map(b => b.toString(16).padStart(2, "0")).join("");
  const setPin = guard(async pin => {
    if (!/^\d{4,8}$/.test(pin)) return alert("The PIN must be 4 to 8 digits.");
    await updateDoc(ref, { pinHash: await hash(id + ":" + pin) });
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
      return `<div class="row" data-s="${x.id}" style="cursor:pointer"><div style="display:flex;gap:10px;align-items:center"><div class="avatar">${esc((x.email || "?")[0].toUpperCase())}</div><div><b>${esc(x.email)}</b><div class="mut">Blocked today: ${bToday(x.id)} | Protection: ${x.admin ? "on" : "OFF"}</div></div></div><span class="tag" style="${on ? "" : "background:#FEE2E2;color:#991B1B"}">${on ? "Online" : "Offline"}</span></div>`;
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
    const list = pday ? mine.filter(r => dkey(r.at) === pday) : mine;
    el.innerHTML = `<div class="card"><button id="back" class="alt">All students</button>
      <div style="display:flex;gap:12px;align-items:center;margin:10px 0"><div class="avatar">${esc((st.email || "?")[0].toUpperCase())}</div>
        <div><b>${esc(st.email)}</b><div><span class="tag" style="${on ? "" : "background:#FEE2E2;color:#991B1B"}">${on ? "Online" : "Offline"}</span></div></div></div>
      <div class="stats"><div><b>${days.size}</b><span>Days present</span></div><div><b>${bToday(st.id)}</b><span>Blocked today</span></div><div><b>${blockedAll.length}</b><span>Blocked total</span></div><div><b>${alerts}</b><span>Alerts</span></div></div>
      <p class="mut">Last seen: ${st.lastSeen ? fmtTime(st.lastSeen) : "never"}<br>Uninstall protection: ${st.admin ? "on" : "OFF"}</p>
      ${top.length ? `<p><b>Most blocked apps:</b> ${top.map(t => esc(t[0]) + " (" + t[1] + ")").join(", ")}</p>` : ""}</div>
    <div class="card"><h3>Activity log</h3><input id="pday" type="date" value="${pday}"><button id="pall" class="alt">All days</button>
      ${list.slice(0, 100).map(r => `<div class="row"><div>${LBL[r.type] || esc(r.type)}<div class="mut">${esc(r.text)}</div></div><span class="mut">${fmtTime(r.at)}</span></div>`).join("") || '<p class="mut">No activity.</p>'}
      <button id="pcsv" class="alt">Download this student (CSV)</button></div>`;
    $("back").onclick = () => { sel = null; drawStudents(); drawRecords(); };
    $("pday").onchange = e => { pday = e.target.value; drawStudents(); };
    $("pall").onclick = () => { pday = ""; drawStudents(); };
    $("pcsv").onclick = () => csvDownload([["Date", "Time", "Type", "Details"], ...mine.map(r => [new Date(r.at).toLocaleDateString(), new Date(r.at).toLocaleTimeString(), r.type, r.text])],
      "focusclass-" + (st.email || "student") + ".csv");
  };
  const LBL = { checkin: "Checked in", joined: "Joined", left: "Left", blocked: "Blocked app", tamper: "Security alert" };
  const drawRecords = () => {
    const el = $("rx"); if (!el) return; if (sel) { el.innerHTML = ""; return; }
    const list = recs.filter(r => dkey(r.at) === day);
    const present = new Set(list.filter(r => r.type === "checkin").map(r => r.email));
    const absent = studs.map(s => s.email).filter(e => !present.has(e));
    el.innerHTML = `<div class="card"><h3>Class record</h3><input id="day" type="date" value="${day}">
      <p><b>Present (${present.size}):</b> ${[...present].map(esc).join(", ") || "none"}</p>
      <p><b>Not checked in (${absent.length}):</b> ${absent.map(esc).join(", ") || "none"}</p>
      ${list.slice(0, 50).map(r => `<div class="row"><div>${esc(r.email)}<div class="mut">${LBL[r.type] || esc(r.type)}: ${esc(r.text)}</div></div><span class="mut">${new Date(r.at).toLocaleTimeString()}</span></div>`).join("") || '<p class="mut">No records for this day.</p>'}
      <button id="csv" class="alt">Download all (CSV)</button></div>`;
    $("day").onchange = e => { day = e.target.value || today(); drawRecords(); };
    $("csv").onclick = () => {
      const q = v => '"' + String(v ?? "").replace(/"/g, '""') + '"';
      const rows = [["Date", "Time", "Student", "Type", "Details"], ...recs.map(r => [new Date(r.at).toLocaleDateString(), new Date(r.at).toLocaleTimeString(), r.email, r.type, r.text])];
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(q).join(",")).join("\n")], { type: "text/csv" }));
      a.download = "focusclass-" + id + ".csv"; a.click();
    };
  };
  const subjectsCard = () => `<div class="card"><h3>Subjects</h3><p class="mut">Add class periods. Phones are only restricted during these periods, and a subject can allow extra apps (like a math app). With no subjects, the schedule above is used.</p>
    ${(C.periods || []).map((p, i) => `<div class="row"><div><b>${esc(p.name)}</b> <span class="mut">${fmt(p.start)} - ${fmt(p.end)}</span>${p.apps && p.apps.length ? `<div class="mut">Extra apps: ${p.apps.map(esc).join(", ")}</div>` : ""}</div><button class="bad" data-sub="${i}">Remove</button></div>`).join("")}
    <input id="sn" placeholder="Subject (e.g. Math)"><input id="ss" type="time" value="08:00"><input id="se" type="time" value="09:00"><input id="sa" placeholder="Extra apps, comma separated (optional)"><button id="sadd">Add subject</button></div>`;
  const bindSubjects = () => {
    $("sadd").onclick = guard(async () => {
      const name = $("sn").value.trim(), start = toMin($("ss").value), end = toMin($("se").value);
      if (!name || !(end > start)) return alert("Enter a subject name, and a start time that is before the end time.");
      const apps = $("sa").value.split(",").map(x => x.trim()).filter(Boolean);
      const list = [...(C.periods || []), { name, start, end, apps }].sort((a, b) => a.start - b.start);
      await updateDoc(ref, { periods: list }); await log("Added subject " + name);
    });
    document.querySelectorAll("[data-sub]").forEach(b => b.onclick = guard(async () => {
      await updateDoc(ref, { periods: (C.periods || []).filter((_, i) => i !== +b.dataset.sub) }); await log("Removed a subject");
    }));
  };
  const showTab = () => {
    document.querySelectorAll(".tabp").forEach(p => p.style.display = p.dataset.t === tab ? "" : "none");
    document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  };
  const bindTabs = () => { document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; showTab(); }); showTab(); };
  const draw = () => {
    if (!C || !$("cls")) return;
    const paused = C.pauseUntil > Date.now(), pend = reqs.filter(r => r.status === "pending");
    $("cls").innerHTML = `<div class="tabs"><button data-tab="over">Overview</button><button data-tab="set">Settings</button><button data-tab="stu">Students</button></div><div class="tabp" data-t="over"><div class="card"><div class="mut">Class code (share with president and Android students)</div><div class="code">${id}</div>
      <p>Status: <b>${!C.enabled ? "OFF" : paused ? "Paused until " + new Date(C.pauseUntil).toLocaleTimeString() : "Class mode ON"}</b></p>
      <button id="tg" class="${C.enabled ? "bad" : "ok"}">${C.enabled ? "Turn OFF" : "Turn ON"}</button>
      <button id="p30" class="alt">Pause 30 min</button><button id="p60" class="alt">Pause 60 min</button>${paused ? '<button id="p0">End pause</button>' : ""}</div>
    <div class="card"><h3>Pending requests (${pend.length})</h3>${pend.map(r => `<div class="row"><div>${r.type === "app" ? "Add app: <b>" + esc(r.name) + "</b> <span class=mut>" + esc(r.pkg) + "</span>" : "Pause for <b>" + r.minutes + " min</b>"}<div class="mut">${esc(r.reason)}</div></div>
      <div><button class="ok" data-a="${r.id}">Approve</button><button class="bad" data-d="${r.id}">Deny</button></div></div>`).join("") || '<p class="mut">None</p>'}</div>
    <div class="card"><h3>Activity log</h3>${logs.slice(0, 10).map(l => `<div class="row"><span>${esc(l.text)}</span><span class="mut">${new Date(l.at).toLocaleString()}</span></div>`).join("") || '<p class="mut">Empty</p>'}</div></div><div class="tabp" data-t="set" style="display:none"><div class="card"><h3>Schedule</h3><div class="days">${DN.map((n, i) => `<label class="dchip"><input type="checkbox" class="dayc" value="${i + 1}" ${(C.days || [2, 3, 4, 5, 6]).includes(i + 1) ? "checked" : ""}>${n}</label>`).join("")}</div>
      <input id="st" type="time" value="${fmt(C.startMin)}"><input id="en" type="time" value="${fmt(C.endMin)}"><button id="sv">Save schedule</button></div>
    ${subjectsCard()}<div class="card"><h3>Allowed apps</h3>${C.allowed.map(a => `<div class="row"><div>${esc(a.name)} <span class="mut">${esc(a.pkg)}</span></div><button class="bad" data-rm="${esc(a.pkg)}">Remove</button></div>`).join("")}
      <input id="an" placeholder="App name"><input id="ap" placeholder="Package name (e.g. com.duolingo)"><button id="ad">Add app</button>
      <p class="mut">Phone, SMS and the home screen are always allowed by the Android app.</p></div>
    <div class="card"><h3>Class president</h3><p class="mut">Ask your president to log in and send you their ID.</p>
      <input id="pid" placeholder="President's ID" value="${esc(C.presidentUid)}"><button id="ps">Save</button></div>
    ${securityCard()}</div><div class="tabp" data-t="stu" style="display:none"><div id="sx"></div><div id="rx"></div></div>`;
    const up = (d, msg) => guard(async () => { await updateDoc(ref, d); if (msg) await log(msg); });
    $("tg").onclick = up({ enabled: !C.enabled }, C.enabled ? "Turned class mode OFF" : "Turned class mode ON");
    $("p30").onclick = up({ pauseUntil: Date.now() + 30 * 6e4 }, "Paused 30 min");
    $("p60").onclick = up({ pauseUntil: Date.now() + 60 * 6e4 }, "Paused 60 min");
    if ($("p0")) $("p0").onclick = up({ pauseUntil: 0 }, "Ended pause");
    $("sv").onclick = () => {
      const days = [...document.querySelectorAll(".dayc")].filter(x => x.checked).map(x => +x.value);
      if (!days.length) return alert("Pick at least one day.");
      up({ startMin: toMin($("st").value), endMin: toMin($("en").value), days }, `Schedule set ${$("st").value}-${$("en").value} (${daysText(days)})`)();
    };
    $("ad").onclick = () => { const pkg = $("ap").value.trim(), name = $("an").value.trim() || pkg; if (pkg) up({ allowed: arrayUnion({ pkg, name }) }, "Allowed " + name)(); };
    $("ps").onclick = () => up({ presidentUid: $("pid").value.trim() }, "Assigned class president")();
    bindSecurity(); drawStudents(); drawRecords(); bindTabs(); bindSubjects();
    document.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { const a = C.allowed.find(x => x.pkg === b.dataset.rm); up({ allowed: arrayRemove(a) }, "Removed " + a.name)(); });
    document.querySelectorAll("[data-a]").forEach(b => b.onclick = guard(async () => {
      const r = reqs.find(x => x.id === b.dataset.a);
      await updateDoc(doc(db, "classes", id, "requests", r.id), { status: "approved" });
      if (r.type === "app") await updateDoc(ref, { allowed: arrayUnion({ pkg: r.pkg, name: r.name }) });
      else await updateDoc(ref, { pauseUntil: Date.now() + r.minutes * 6e4 });
      await log("Approved request: " + (r.type === "app" ? r.name : r.minutes + " min pause"));
    }));
    document.querySelectorAll("[data-d]").forEach(b => b.onclick = guard(async () => {
      await updateDoc(doc(db, "classes", id, "requests", b.dataset.d), { status: "denied" }); await log("Denied a request"); }));
  };
  cl.push(onSnapshot(ref, s => { C = s.data(); draw(); }));
  cl.push(onSnapshot(collection(db, "classes", id, "requests"), s => { reqs = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at); draw(); }));
  cl.push(onSnapshot(collection(db, "classes", id, "log"), s => { logs = s.docs.map(d => d.data()).sort((a, b) => b.at - a.at); draw(); }));
  cl.push(onSnapshot(collection(db, "classes", id, "students"), s => { studs = s.docs.map(d => ({ id: d.id, ...d.data() })); drawStudents(); drawRecords(); }));
  cl.push(onSnapshot(query(collection(db, "classes", id, "records"), orderBy("at", "desc"), limit(500)), s => { recs = s.docs.map(d => d.data()); drawRecords(); }));
  cl.push(onSnapshot(doc(db, "classes", id, "private", "pin"), s => { pinDoc = s.exists() ? s.data().pin : ""; if (C) draw(); }, () => {}));
  const tm = setInterval(drawStudents, 30000); cl.push(() => clearInterval(tm));
}

/* ---------------- CLASS PRESIDENT ---------------- */
function president(u) {
  app.innerHTML = header(u) + `<main>${downloadCard()}<div class="card"><h3>Your ID</h3><p class="mut">Send this to your teacher so they can make you class president.</p>
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
    <div class="card"><h3>Request a pause</h3><select id="pm"><option value="30">30 minutes</option><option value="60">60 minutes</option></select><input id="pr" placeholder="Reason"><button id="sp">Send request</button></div>
    <div class="card"><h3>My requests</h3>${reqs.map(r => `<div class="row"><span>${r.type === "app" ? esc(r.name) : r.minutes + " min pause"}</span><span class="tag">${r.status}</span></div>`).join("") || '<p class="mut">None yet</p>'}</div>`;
    const send = d => guard(() => addDoc(collection(db, "classes", id, "requests"), { ...d, by: u.uid, status: "pending", at: Date.now() }));
    $("sa").onclick = () => { const pkg = $("ap").value.trim(); if (pkg) send({ type: "app", pkg, name: $("an").value.trim() || pkg, reason: $("ar").value.trim() })(); };
    $("sp").onclick = () => send({ type: "pause", minutes: +$("pm").value, reason: $("pr").value.trim() })();
  };
  cl.push(onSnapshot(doc(db, "classes", id), s => { C = s.exists() ? s.data() : null; draw(); }, () => { C = null; draw(); }));
  cl.push(onSnapshot(query(collection(db, "classes", id, "requests"), where("by", "==", u.uid)),
    s => { reqs = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at); if (C) draw(); }, () => {}));
}
