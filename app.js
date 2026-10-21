import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc, updateDoc, addDoc, collection, onSnapshot, query, where, arrayUnion, arrayRemove }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const fb = initializeApp(firebaseConfig), auth = getAuth(fb), db = getFirestore(fb);
const $ = id => document.getElementById(id), app = $("app");
const fmt = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const toMin = s => { const [h, m] = s.split(":"); return +h * 60 + +m; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
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
  <button id="login">Log in</button><button id="reg" class="alt">Create account</button><p id="err" class="err"></p></div></div>`;
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
    $("main").innerHTML = `<div class="card"><h3>My classes</h3>
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
  stop(cl); let C = null, reqs = [], logs = [];
  const ref = doc(db, "classes", id);
  const log = text => addDoc(collection(db, "classes", id, "log"), { by: u.email, text, at: Date.now() });
  const draw = () => {
    if (!C || !$("cls")) return;
    const paused = C.pauseUntil > Date.now(), pend = reqs.filter(r => r.status === "pending");
    $("cls").innerHTML = `
    <div class="card"><div class="mut">Class code (share with president and Android students)</div><div class="code">${id}</div>
      <p>Status: <b>${!C.enabled ? "OFF" : paused ? "Paused until " + new Date(C.pauseUntil).toLocaleTimeString() : "Class mode ON"}</b></p>
      <button id="tg" class="${C.enabled ? "bad" : "ok"}">${C.enabled ? "Turn OFF" : "Turn ON"}</button>
      <button id="p30" class="alt">Pause 30 min</button><button id="p60" class="alt">Pause 60 min</button>${paused ? '<button id="p0">End pause</button>' : ""}</div>
    <div class="card"><h3>Schedule (Mon-Fri)</h3>
      <input id="st" type="time" value="${fmt(C.startMin)}"><input id="en" type="time" value="${fmt(C.endMin)}"><button id="sv">Save schedule</button></div>
    <div class="card"><h3>Pending requests (${pend.length})</h3>${pend.map(r => `<div class="row"><div>${r.type === "app" ? "Add app: <b>" + esc(r.name) + "</b> <span class=mut>" + esc(r.pkg) + "</span>" : "Pause for <b>" + r.minutes + " min</b>"}<div class="mut">${esc(r.reason)}</div></div>
      <div><button class="ok" data-a="${r.id}">Approve</button><button class="bad" data-d="${r.id}">Deny</button></div></div>`).join("") || '<p class="mut">None</p>'}</div>
    <div class="card"><h3>Allowed apps</h3>${C.allowed.map(a => `<div class="row"><div>${esc(a.name)} <span class="mut">${esc(a.pkg)}</span></div><button class="bad" data-rm="${esc(a.pkg)}">Remove</button></div>`).join("")}
      <input id="an" placeholder="App name"><input id="ap" placeholder="Package name (e.g. com.duolingo)"><button id="ad">Add app</button>
      <p class="mut">Phone, SMS and the home screen are always allowed by the Android app.</p></div>
    <div class="card"><h3>Class president</h3><p class="mut">Ask your president to log in and send you their ID.</p>
      <input id="pid" placeholder="President's ID" value="${esc(C.presidentUid)}"><button id="ps">Save</button></div>
    <div class="card"><h3>Activity log</h3>${logs.slice(0, 10).map(l => `<div class="row"><span>${esc(l.text)}</span><span class="mut">${new Date(l.at).toLocaleString()}</span></div>`).join("") || '<p class="mut">Empty</p>'}</div>`;
    const up = (d, msg) => guard(async () => { await updateDoc(ref, d); if (msg) await log(msg); });
    $("tg").onclick = up({ enabled: !C.enabled }, C.enabled ? "Turned class mode OFF" : "Turned class mode ON");
    $("p30").onclick = up({ pauseUntil: Date.now() + 30 * 6e4 }, "Paused 30 min");
    $("p60").onclick = up({ pauseUntil: Date.now() + 60 * 6e4 }, "Paused 60 min");
    if ($("p0")) $("p0").onclick = up({ pauseUntil: 0 }, "Ended pause");
    $("sv").onclick = () => up({ startMin: toMin($("st").value), endMin: toMin($("en").value) }, `Schedule set ${$("st").value}-${$("en").value}`)();
    $("ad").onclick = () => { const pkg = $("ap").value.trim(), name = $("an").value.trim() || pkg; if (pkg) up({ allowed: arrayUnion({ pkg, name }) }, "Allowed " + name)(); };
    $("ps").onclick = () => up({ presidentUid: $("pid").value.trim() }, "Assigned class president")();
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
}

/* ---------------- CLASS PRESIDENT ---------------- */
function president(u) {
  app.innerHTML = header(u) + `<main><div class="card"><h3>Your ID</h3><p class="mut">Send this to your teacher so they can make you class president.</p>
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
      <p>Schedule: <b>${fmt(C.startMin)} - ${fmt(C.endMin)}</b> (Mon-Fri) &middot; ${C.enabled ? "ON" : "OFF"}</p>
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
