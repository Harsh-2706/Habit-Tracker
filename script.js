/* Habit Tracker Pro (Front-end, local-first) */

const STORAGE_KEY = "habitTracker.v1";
const THEME_KEY = "habitTracker.theme";

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const state = {
  db: null,
  monthCursor: new Date(),
  selectedDate: toISODate(new Date()),
  editingHabitId: null,
  toastTimer: null,
  reminderTimer: null,
};

init();

function init() {
  applyTheme(loadTheme());
  $("#todayLine").textContent = formatHumanDate(new Date());

  state.db = loadDB() ?? seedDB();
  normalizeDB(state.db);
  saveDB();

  wireUI();
  renderAll();
  startReminderLoop();
}

function wireUI() {
  $("#btnAddHabit").addEventListener("click", () => openHabitModal());
  $("#btnPrevMonth").addEventListener("click", () => moveMonth(-1));
  $("#btnNextMonth").addEventListener("click", () => moveMonth(1));
  $("#btnThisMonth").addEventListener("click", () => { state.monthCursor = new Date(); renderCalendar(); });

  $("#q").addEventListener("input", renderHabitList);
  $("#filterStatus").addEventListener("change", renderHabitList);

  $("#btnMarkAll").addEventListener("click", () => markAllForSelectedDate(true));
  $("#btnClearAll").addEventListener("click", () => markAllForSelectedDate(false));

  $("#btnExportJson").addEventListener("click", exportJSON);
  $("#btnExportCsv").addEventListener("click", exportCSV);
  $("#fileImport").addEventListener("change", importJSON);

  $("#btnTheme").addEventListener("click", () => {
    const next = (document.documentElement.dataset.theme === "light") ? "dark" : "light";
    applyTheme(next);
    saveTheme(next);
  });

  $("#btnEnableNotifs").addEventListener("click", enableNotifications);

  const modal = $("#habitModal");
  $("#habitForm").addEventListener("submit", (e) => {
    e.preventDefault();
    saveHabitFromModal();
    modal.close();
  });
  $("#btnArchiveHabit").addEventListener("click", () => {
    const id = $("#habitId").value;
    if (!id) return;
    archiveHabit(id);
    modal.close();
  });

  // DOW chips
  const wrap = $("#dowChips");
  wrap.innerHTML = "";
  DOW.forEach((d, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chipbtn";
    b.textContent = d;
    b.setAttribute("aria-pressed", "true"); // default: all on
    b.dataset.idx = String(i);
    b.addEventListener("click", () => {
      const v = b.getAttribute("aria-pressed") === "true";
      b.setAttribute("aria-pressed", String(!v));
    });
    wrap.appendChild(b);
  });
}

function renderAll() {
  $("#selectedDateLine").textContent = "Selected: " + formatHumanDate(fromISODate(state.selectedDate));
  renderHabitList();
  renderCalendar();
  renderDayLog();
  renderStats();
  renderMeta();
  renderNotifsState();
}

function renderMeta() {
  const active = state.db.habits.filter(h => !h.archived).length;
  const archived = state.db.habits.filter(h => h.archived).length;
  $("#dbInfo").textContent = `${active} active • ${archived} archived • ${Object.keys(state.db.logs).length} log days`;
}

function getFilteredHabits() {
  const q = ($("#q").value || "").trim().toLowerCase();
  const filter = $("#filterStatus").value;

  return state.db.habits
    .filter(h => {
      if (filter === "active") return !h.archived;
      if (filter === "archived") return !!h.archived;
      return true;
    })
    .filter(h => !q || (h.name.toLowerCase().includes(q) || (h.notes || "").toLowerCase().includes(q)));
}

function renderHabitList() {
  const list = $("#habitList");
  list.innerHTML = "";

  const habits = getFilteredHabits().sort((a,b) => (a.archived - b.archived) || a.name.localeCompare(b.name));
  if (habits.length === 0) {
    list.innerHTML = `<div class="muted" style="padding:12px 10px;">No habits found.</div>`;
    return;
  }

  habits.forEach(h => {
    const row = document.createElement("div");
    row.className = "habit";
    row.role = "listitem";
    row.tabIndex = 0;

    const done = isHabitDoneOn(h.id, state.selectedDate);

    row.innerHTML = `
      <div class="dot" style="background:${escapeHTML(h.color)}"></div>
      <div class="meta">
        <div class="name">${escapeHTML(h.icon ? `${h.icon} ` : "")}${escapeHTML(h.name)}</div>
        <div class="sub">${escapeHTML(h.notes || "No notes")}</div>
      </div>
      <div class="pill">${done ? "Done" : "—"}</div>
    `;

    row.addEventListener("click", () => openHabitModal(h.id));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openHabitModal(h.id); }
    });

    list.appendChild(row);
  });
}

function renderCalendar() {
  const el = $("#calendar");
  el.innerHTML = "";

  const cursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth(), 1);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();

  // DOW header
  DOW.forEach(d => {
    const h = document.createElement("div");
    h.className = "cal-dow";
    h.textContent = d;
    el.appendChild(h);
  });

  const firstDow = isoDow(cursor); // 1..7
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Leading blanks (Mon-based)
  for (let i = 1; i < firstDow; i++) {
    const blank = document.createElement("div");
    blank.className = "day";
    blank.style.visibility = "hidden";
    el.appendChild(blank);
  }

  const todayISO = toISODate(new Date());

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const iso = toISODate(dt);

    const day = document.createElement("div");
    day.className = "day";
    if (iso === todayISO) day.classList.add("is-today");
    if (iso === state.selectedDate) day.classList.add("is-selected");

    const habits = state.db.habits.filter(h => !h.archived && isScheduledOn(h, dt));
    const doneCount = habits.filter(h => isHabitDoneOn(h.id, iso)).length;

    day.innerHTML = `
      <div class="n">
        <span>${d}</span>
        <span class="muted" style="font-weight:700;">${habits.length ? `${doneCount}/${habits.length}` : ""}</span>
      </div>
      <div class="mini">${habits.slice(0,10).map(h => `<span class="chip" title="${escapeHTML(h.name)}" style="background:${escapeHTML(h.color)};opacity:${isHabitDoneOn(h.id, iso)?1:.25}"></span>`).join("")}</div>
    `;

    day.addEventListener("click", () => {
      state.selectedDate = iso;
      $("#selectedDateLine").textContent = "Selected: " + formatHumanDate(fromISODate(iso));
      renderCalendar();
      renderDayLog();
      renderStats();
      renderHabitList();
    });

    el.appendChild(day);
  }
}

function renderDayLog() {
  const wrap = $("#dayLog");
  wrap.innerHTML = "";

  const dt = fromISODate(state.selectedDate);
  const habits = state.db.habits
    .filter(h => !h.archived && isScheduledOn(h, dt))
    .sort((a,b) => a.name.localeCompare(b.name));

  if (habits.length === 0) {
    wrap.innerHTML = `<div class="muted" style="padding:10px;">No scheduled habits for this day.</div>`;
    return;
  }

  habits.forEach(h => {
    const row = document.createElement("div");
    row.className = "log-row";
    row.tabIndex = 0;

    const done = isHabitDoneOn(h.id, state.selectedDate);
    const check = document.createElement("div");
    check.className = "checkbox" + (done ? " done" : "");
    check.textContent = done ? "✓" : "";

    const title = document.createElement("div");
    title.className = "title";
    title.innerHTML = `<strong>${escapeHTML(h.icon ? `${h.icon} ` : "")}${escapeHTML(h.name)}</strong><span>${escapeHTML(h.notes || "Daily target: " + (h.target || 1))}</span>`;

    const btn = document.createElement("button");
    btn.className = "btn btn-ghost";
    btn.type = "button";
    btn.textContent = done ? "Undo" : "Done";
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setHabitDone(h.id, state.selectedDate, !done);
      renderDayLog(); renderCalendar(); renderStats(); renderHabitList();
    });

    row.addEventListener("click", () => btn.click());
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click(); }
    });

    row.prepend(check);
    row.appendChild(title);
    row.appendChild(btn);
    wrap.appendChild(row);
  });
}

function renderStats() {
  const el = $("#stats");
  el.innerHTML = "";

  const dt = fromISODate(state.selectedDate);
  const activeHabits = state.db.habits.filter(h => !h.archived && isScheduledOn(h, dt));
  const doneToday = activeHabits.filter(h => isHabitDoneOn(h.id, state.selectedDate)).length;

  const monthStart = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth(), 1);
  const monthEnd = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth()+1, 0);

  const monthISOStart = toISODate(monthStart);
  const monthISOEnd = toISODate(monthEnd);

  const { completed, total } = monthCompletion(activeHabits, monthISOStart, monthISOEnd);

  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  const best = bestStreakAny(activeHabits);

  el.appendChild(statCard("Today", `${doneToday}/${activeHabits.length}`));
  el.appendChild(statCard("Month completion", `${completionRate}%`));
  el.appendChild(statCard("Best streak (any habit)", best ? `${best.days} days • ${best.name}` : "—"));
}

function statCard(k, v) {
  const d = document.createElement("div");
  d.className = "card";
  d.innerHTML = `<div class="k">${escapeHTML(k)}</div><div class="v">${escapeHTML(v)}</div>`;
  return d;
}

/* ----- DB + storage ----- */

function seedDB() {
  const id1 = uid();
  const id2 = uid();
  const today = toISODate(new Date());
  return {
    version: 1,
    habits: [
      {
        id: id1,
        name: "Drink water",
        icon: "💧",
        color: "#5b8cff",
        target: 1,
        schedule: [1,2,3,4,5,6,7],
        reminderTime: "",
        notes: "At least 2L total (track externally).",
        archived: false,
        createdAt: Date.now()
      },
      {
        id: id2,
        name: "Workout",
        icon: "🏋️",
        color: "#ff5b6e",
        target: 1,
        schedule: [1,3,5],
        reminderTime: "19:30",
        notes: "Strength or cardio.",
        archived: false,
        createdAt: Date.now()
      }
    ],
    // logs[isoDate][habitId] = { done:boolean, value:number, note:string, at:number }
    logs: {
      [today]: {}
    }
  };
}

function normalizeDB(db) {
  db.version ??= 1;
  db.habits ??= [];
  db.logs ??= {};
  db.habits.forEach(h => {
    h.target ??= 1;
    h.schedule ??= [1,2,3,4,5,6,7];
    h.reminderTime ??= "";
    h.notes ??= "";
    h.archived ??= false;
    h.createdAt ??= Date.now();
  });
}

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveDB() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.db));
  } catch {
    toast("Storage full/blocked. Export JSON to avoid losing data.");
  }
}

/* ----- Habit ops ----- */

function openHabitModal(id = null) {
  const modal = $("#habitModal");
  const isEdit = !!id;
  state.editingHabitId = id;

  $("#modalTitle").textContent = isEdit ? "Edit habit" : "New habit";
  $("#btnArchiveHabit").style.visibility = isEdit ? "visible" : "hidden";

  // reset DOW chips
  $$("#dowChips .chipbtn").forEach(b => b.setAttribute("aria-pressed", "true"));

  if (!isEdit) {
    $("#habitId").value = "";
    $("#habitName").value = "";
    $("#habitIcon").value = "";
    $("#habitColor").value = "#5b8cff";
    $("#habitTarget").value = "1";
    $("#habitReminderTime").value = "";
    $("#habitNotes").value = "";
  } else {
    const h = state.db.habits.find(x => x.id === id);
    if (!h) return;

    $("#habitId").value = h.id;
    $("#habitName").value = h.name;
    $("#habitIcon").value = h.icon || "";
    $("#habitColor").value = h.color || "#5b8cff";
    $("#habitTarget").value = String(h.target || 1);
    $("#habitReminderTime").value = h.reminderTime || "";
    $("#habitNotes").value = h.notes || "";

    const set = new Set(h.schedule || []);
    $$("#dowChips .chipbtn").forEach(b => {
      const idx = Number(b.dataset.idx) + 1; // 1..7
      b.setAttribute("aria-pressed", String(set.has(idx)));
    });
  }

  modal.showModal();
  setTimeout(() => $("#habitName").focus(), 0);
}

function saveHabitFromModal() {
  const id = $("#habitId").value || uid();
  const isEdit = !!$("#habitId").value;

  const schedule = $$("#dowChips .chipbtn")
    .map((b, i) => (b.getAttribute("aria-pressed") === "true" ? i+1 : null))
    .filter(Boolean);

  const habit = {
    id,
    name: ($("#habitName").value || "").trim(),
    icon: ($("#habitIcon").value || "").trim(),
    color: $("#habitColor").value || "#5b8cff",
    target: clampInt($("#habitTarget").value, 1, 9999),
    schedule: schedule.length ? schedule : [1,2,3,4,5,6,7],
    reminderTime: $("#habitReminderTime").value || "",
    notes: ($("#habitNotes").value || "").trim(),
    archived: false,
    createdAt: Date.now()
  };

  if (!habit.name) { toast("Habit name is required."); return; }

  if (!isEdit) {
    state.db.habits.push(habit);
    toast("Habit created.");
  } else {
    const idx = state.db.habits.findIndex(h => h.id === id);
    if (idx >= 0) {
      habit.archived = state.db.habits[idx].archived;
      habit.createdAt = state.db.habits[idx].createdAt;
      state.db.habits[idx] = habit;
      toast("Habit updated.");
    }
  }

  saveDB();
  renderAll();
}

function archiveHabit(id) {
  const h = state.db.habits.find(x => x.id === id);
  if (!h) return;
  h.archived = !h.archived;
  toast(h.archived ? "Habit archived." : "Habit restored.");
  saveDB();
  renderAll();
}

/* ----- Logging ----- */

function ensureDay(iso) {
  state.db.logs[iso] ??= {};
  return state.db.logs[iso];
}

function isHabitDoneOn(habitId, iso) {
  const day = state.db.logs[iso];
  if (!day) return false;
  return !!day[habitId]?.done;
}

function setHabitDone(habitId, iso, done) {
  const day = ensureDay(iso);
  day[habitId] = {
    done: !!done,
    value: done ? 1 : 0,
    note: day[habitId]?.note || "",
    at: Date.now()
  };
  saveDB();
}

function markAllForSelectedDate(done) {
  const dt = fromISODate(state.selectedDate);
  const habits = state.db.habits.filter(h => !h.archived && isScheduledOn(h, dt));
  habits.forEach(h => setHabitDone(h.id, state.selectedDate, done));
  toast(done ? "All marked done." : "All cleared.");
  renderDayLog(); renderCalendar(); renderStats(); renderHabitList();
}

/* ----- Streaks + completion ----- */

function isScheduledOn(habit, dateObj) {
  const dow = isoDow(dateObj);
  return (habit.schedule || [1,2,3,4,5,6,7]).includes(dow);
}

function bestStreakAny(habits) {
  let best = null;
  for (const h of habits) {
    const s = bestStreakForHabit(h.id, h.name);
    if (!best || s.days > best.days) best = s;
  }
  return best && best.days > 0 ? best : null;
}

function bestStreakForHabit(habitId, habitName) {
  // scan logs by date
  const dates = Object.keys(state.db.logs).sort(); // ISO sorts chronologically
  let best = 0, cur = 0;
  let prev = null;

  for (const iso of dates) {
    const d = fromISODate(iso);
    const h = state.db.habits.find(x => x.id === habitId);
    if (!h || h.archived) continue;
    if (!isScheduledOn(h, d)) continue;

    const done = isHabitDoneOn(habitId, iso);
    if (done) {
      if (!prev) cur = 1;
      else {
        const diff = daysBetweenISO(prev, iso);
        cur = (diff === 1) ? (cur + 1) : 1;
      }
      best = Math.max(best, cur);
      prev = iso;
    } else {
      // keep prev (streak breaks naturally on next done with gap)
    }
  }
  return { id: habitId, name: habitName, days: best };
}

function monthCompletion(habits, isoStart, isoEnd) {
  let total = 0, completed = 0;
  const start = fromISODate(isoStart);
  const end = fromISODate(isoEnd);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
    const iso = toISODate(d);
    habits.forEach(h => {
      if (!isScheduledOn(h, d)) return;
      total += 1;
      if (isHabitDoneOn(h.id, iso)) completed += 1;
    });
  }
  return { total, completed };
}

/* ----- Import/Export ----- */

function exportJSON() {
  const blob = new Blob([JSON.stringify(state.db, null, 2)], { type: "application/json" });
  downloadBlob(blob, `habit-tracker-${toISODate(new Date())}.json`);
  toast("Exported JSON.");
}

function exportCSV() {
  // rows: date, habitId, habitName, done, at
  const habitsById = Object.fromEntries(state.db.habits.map(h => [h.id, h]));
  const rows = [["date","habitId","habitName","done","timestamp"]];

  Object.keys(state.db.logs).sort().forEach(date => {
    const day = state.db.logs[date] || {};
    Object.keys(day).forEach(hid => {
      const h = habitsById[hid];
      rows.push([
        date,
        hid,
        (h?.name || ""),
        String(!!day[hid]?.done),
        String(day[hid]?.at || "")
      ]);
    });
  });

  const csv = rows.map(r => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `habit-tracker-${toISODate(new Date())}.csv`);
  toast("Exported CSV.");
}

function importJSON(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const next = JSON.parse(String(reader.result || ""));
      normalizeDB(next);
      state.db = next;
      saveDB();
      toast("Import successful.");
      renderAll();
    } catch {
      toast("Invalid JSON file.");
    } finally {
      $("#fileImport").value = "";
    }
  };
  reader.readAsText(file);
}

/* ----- Notifications (optional) ----- */

function renderNotifsState() {
  const el = $("#notifsState");
  if (!("Notification" in window)) {
    el.textContent = "Notifications not supported in this browser.";
    return;
  }
  el.textContent = `Permission: ${Notification.permission}`;
}

async function enableNotifications() {
  if (!("Notification" in window)) { toast("Notifications not supported."); return; }
  try {
    const perm = await Notification.requestPermission();
    toast(`Notification permission: ${perm}`);
  } catch {
    toast("Permission request failed.");
  }
  renderNotifsState();
}

function startReminderLoop() {
  if (state.reminderTimer) clearInterval(state.reminderTimer);

  // Check every 30s while tab is open
  state.reminderTimer = setInterval(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const now = new Date();
    const hhmm = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
    const today = toISODate(now);

    const active = state.db.habits.filter(h => !h.archived && h.reminderTime);
    for (const h of active) {
      // only for scheduled days
      if (!isScheduledOn(h, now)) continue;

      const key = `reminded:${h.id}:${today}:${hhmm}`;
      if (sessionStorage.getItem(key)) continue;

      if (h.reminderTime === hhmm) {
        sessionStorage.setItem(key, "1");
        new Notification(h.name, {
          body: h.notes ? h.notes : "Time to do this habit.",
        });
      }
    }
  }, 30_000);
}

/* ----- Theme ----- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $("#btnTheme").setAttribute("aria-pressed", String(theme === "light"));
}
function loadTheme() { return localStorage.getItem(THEME_KEY) || "dark"; }
function saveTheme(t) { try { localStorage.setItem(THEME_KEY, t); } catch {} }

/* ----- Utils ----- */

function moveMonth(delta) {
  const d = new Date(state.monthCursor);
  d.setMonth(d.getMonth() + delta);
  state.monthCursor = d;
  renderCalendar();
  renderStats();
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

function uid() {
  return "h_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function toISODate(d) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0,10);
}
function fromISODate(iso) {
  const [y,m,dd] = iso.split("-").map(Number);
  return new Date(y, m-1, dd);
}
function formatHumanDate(d) {
  return d.toLocaleDateString(undefined, { weekday:"short", year:"numeric", month:"short", day:"numeric" });
}
function isoDow(d) {
  // Mon=1..Sun=7
  const n = d.getDay(); // Sun=0
  return n === 0 ? 7 : n;
}
function daysBetweenISO(a, b) {
  const da = fromISODate(a);
  const db = fromISODate(b);
  return Math.round((db - da) / 86400000);
}
function clampInt(v, min, max) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
function pad2(n){ return String(n).padStart(2,"0"); }
function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function csvCell(v){
  const s = String(v ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
  return s;
}
function downloadBlob(blob, filename){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 800);
}
