/* ============================================================
   Constants & Storage Keys
   ============================================================ */
const USERS_KEY    = 'tt_users_v1';
const SESSION_KEY  = 'tt_session_v1';
const STATE_PREFIX = 'tt_state_v1_';

// ?숆낵 紐⑸줉? courses.json?먯꽌 ?숈쟻?쇰줈 濡쒕뱶 (?꾨옒 loadDepartments 李몄“)
let DEPARTMENTS = [];

// 議몄뾽?붽굔 ?곗씠?곌? ?놁뼱 ?좏깮 遺덇????숆낵
const DEPTS_NO_GRAD_REQS = new Set([
  'RISE?ъ뾽??,
  '寃쎌쁺怨꾩뿴 ?먯쑉?꾧났?숇?',
  '怨듯븰怨꾩뿴 ?먯쑉?꾧났?숇?',
  '湲濡쒕쾶?먯쑉?꾧났?숇?',
  '湲곗닠寃쎌쁺怨듯븰怨?,
  '湲곗큹怨쇳븰遺 ?먮꼫吏?뷀븰?꾧났',
  '?щ┝?꾨꼫?ㅽ븰遺',
  '?ы쉶怨꾩뿴 ?먯쑉?꾧났?숇?',
  '?먮꼫吏?뷀븰怨듯븰怨?,
  '?멸났吏?μ쑖?⑷났?숆낵',
  '?몃Ц怨꾩뿴 ?먯쑉?꾧났?숇?',
  '?щ즺湲덉냽怨듯븰怨?,
  '泥⑤떒?뚯옱?듯빀怨듯븰怨?,
]);

const DAY_NAMES   = ['??, '??, '??, '紐?, '湲?];
const HOUR_ROWS   = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
const HOUR_ROWS_END = '18:00';

// ?먮툕由ы????ㅽ????뚯뒪???붾젅??const COLORS = [
  { bg: '#ffd6d6', border: '#e05555', text: '#8b0000' },
  { bg: '#ffdfc8', border: '#e07040', text: '#7a3000' },
  { bg: '#fff3c8', border: '#d4a017', text: '#6b4c00' },
  { bg: '#d6f5d6', border: '#4caf50', text: '#1b5e20' },
  { bg: '#c8e8ff', border: '#3a8fd4', text: '#0d3c6e' },
  { bg: '#e8d6ff', border: '#8b5cf6', text: '#4c1d95' },
  { bg: '#ffd6f0', border: '#d4509a', text: '#7a0050' },
  { bg: '#d6fff5', border: '#0ea87a', text: '#004d38' },
  { bg: '#ffe8e8', border: '#c0392b', text: '#7b0000' },
  { bg: '#fff8d6', border: '#c8a000', text: '#5a4000' }
];

// 移댄뀒怨좊━蹂?怨좎젙 ?됱긽
const CAT_COLORS = {
  '?꾧났?꾩닔': { bg: '#ffd6d6', border: '#e05555', text: '#8b0000' },
  '?꾧났?좏깮': { bg: '#ffdfc8', border: '#e07040', text: '#7a3000' },
  '?듯빀?꾧났?꾩닔': { bg: '#ffe8e8', border: '#c0392b', text: '#7b0000' },
  '?듯빀?꾧났': { bg: '#ffd6f0', border: '#d4509a', text: '#7a0050' },
  '湲곗큹援먯뼇': { bg: '#d6f5d6', border: '#4caf50', text: '#1b5e20' },
  '洹좏삎援먯뼇': { bg: '#c8e8ff', border: '#3a8fd4', text: '#0d3c6e' },
  '?뺣?援먯뼇': { bg: '#e8d6ff', border: '#8b5cf6', text: '#4c1d95' },
  '?먯쑀?좏깮':  { bg: '#d6fff5', border: '#0ea87a', text: '#004d38' },
};

/* ============================================================
   Auth helpers
   ============================================================ */
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); } catch { return []; }
}
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

function getSession() {
  return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || null;
}
function setSession(sid) {
  sessionStorage.setItem(SESSION_KEY, sid);
  localStorage.setItem(SESSION_KEY, sid);
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}
function findUser(sid) {
  return getUsers().find(u => u.studentId === sid) || null;
}

/* ============================================================
   Per-user state
   ============================================================ */
const DEFAULT_STATE = {
  studentId: '', department: '', year: '', semester: '1?숆린',
  totalCredits: 0, prevGpa: 3.6, appliedCredits: 0, maxCredits: 20,
  timetables: {},        // { "2026_1?숆린": [...courses], "2025_2?숆린": [...] }
  courses: [],           // ?섏쐞?명솚: index ?섏씠吏?먯꽌 ?꾩옱 ?숆린 courses 李몄“
  completedCourses: [],  // array of course names already taken
  excludedCourses: [],   // array of course names to exclude from auto-gen
  pinnedCourses: [],     // array of course names to force-include in auto-gen
  retakeCourses: [],     // array of course names marked as needing retake (not counted as completed)
  allowRetake: false     // if true, completed courses can appear in auto-gen
};

function loadState() {
  const sid = getSession();
  if (!sid) return { ...DEFAULT_STATE };
  const raw = localStorage.getItem(STATE_PREFIX + sid);
  const user = findUser(sid);
  const base = { ...DEFAULT_STATE, studentId: sid, department: user?.department || '' };
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw);
    const state = { ...base, ...parsed };
    migrateLegacyCourses(state); // 湲곗〈 ?⑥씪 courses 諛곗뿴 ??timetables 留덉씠洹몃젅?댁뀡
    return state;
  } catch { return base; }
}
function saveState(s) {
  if (!s.studentId) return;
  localStorage.setItem(STATE_PREFIX + s.studentId, JSON.stringify(s));
}

/* ============================================================
   Timetable-per-semester helpers
   ============================================================ */
function ttKey(year, semester) {
  return `${year}_${semester || '1?숆린'}`;
}
function getTimetable(state, year, semester) {
  if (!state.timetables) state.timetables = {};
  const k = ttKey(year || state.year, semester || state.semester);
  return state.timetables[k] || [];
}
function setTimetable(state, year, semester, courses) {
  if (!state.timetables) state.timetables = {};
  const k = ttKey(year || state.year, semester || state.semester);
  state.timetables[k] = courses;
  // state.courses???꾩옱 ?좏깮 ?숆린瑜?mirror (index ?섏씠吏 ?명솚??
  if (k === ttKey(state.year, state.semester)) state.courses = courses;
}
// 湲곗〈 state.courses(?⑥씪 諛곗뿴)瑜?timetables濡?留덉씠洹몃젅?댁뀡
function migrateLegacyCourses(state) {
  if (!state.timetables) state.timetables = {};
  if (state.courses?.length) {
    const k = ttKey(state.year || new Date().getFullYear(), state.semester || '1?숆린');
    if (!state.timetables[k]) {
      state.timetables[k] = state.courses;
    }
  }
}

/* ============================================================
   Utilities
   ============================================================ */
function getAdmissionYear(sid) {
  return /^\d{8}$/.test(sid) ? Number(sid.slice(0, 4)) : null;
}
function buildAllowedYears(admYear) {
  const cur = new Date().getFullYear();
  const start = admYear || cur - 2;
  const years = [];
  for (let y = cur; y >= start; y--) years.push(y);
  return years;
}
function fillYearOptions(sel, selected, admYear) {
  if (!sel) return;
  sel.innerHTML = buildAllowedYears(admYear).map(y =>
    `<option value="${y}" ${String(y) === String(selected) ? 'selected' : ''}>${y}</option>`
  ).join('');
}
function fillDepartmentOptions(sel, selected = '') {
  if (!sel) return;
  sel.innerHTML = `<option value="">?숆낵 ?좏깮</option>` + DEPARTMENTS.map(d =>
    `<option value="${d}" ${d === selected ? 'selected' : ''}>${d}</option>`
  ).join('');
}

async function loadDepartments() {
  if (DEPARTMENTS.length > 0) return; // ?대? 濡쒕뱶??  try {
    const res  = await fetch('data/all_grad_reqs.json');
    const data = await res.json();
    DEPARTMENTS = Object.keys(data).sort((a, b) => a.localeCompare(b, 'ko'));
  } catch {
    DEPARTMENTS = [];
  }
}
function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/* ============================================================
   Color map (stable per course name)
   ============================================================ */
function buildColorMap(courses) {
  const map = {};
  let i = 0;
  courses.forEach(c => {
    if (!(c.name in map)) {
      // 移댄뀒怨좊━ 怨좎젙???곗꽑, ?놁쑝硫??붾젅???쒗솚
      map[c.name] = CAT_COLORS[c.category] || COLORS[i++ % COLORS.length];
    }
  });
  return map;
}

/* ============================================================
   Timetable Renderer  (handles grouped course objects)
   ============================================================ */
function flattenCourses(courses) {
  // Supports both old {name,day,start,end,room} and new {name,slots:[...]}
  return courses.flatMap(c =>
    c.slots
      ? c.slots.map(s => ({ name: c.name, day: s.day, start: s.start, end: s.end, room: s.room || '' }))
      : [c]
  );
}

function renderTimetable(container, courses, opts = {}) {
  if (!container) return;
  container.innerHTML = '';

  const flat     = flattenCourses(courses);
  const colorMap = buildColorMap(courses);

  const mini      = opts.mini || false;
  const timeColW  = opts.timeColW || (mini ? 32 : 48);
  const hourH     = opts.hourH    || (mini ? 44 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-h'))  || 60);

  // 紐⑤컮?쇱뿉??而⑦뀒?대꼫 ?덈퉬??留욊쾶 dayCol ?먮룞 怨꾩궛
  let dayCol;
  if (opts.dayCol) {
    dayCol = opts.dayCol;
  } else if (mini) {
    dayCol = 62;
  } else {
    const containerW = container.clientWidth || container.offsetWidth || 0;
    dayCol = containerW > 0
      ? Math.floor((containerW - timeColW) / 5)
      : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--day-col')) || 108);
  }

  const baseMin   = timeToMin('09:00');
  const lastMin   = timeToMin(HOUR_ROWS_END);
  const hours     = HOUR_ROWS;

  const wrap = document.createElement('div');
  wrap.className = 'et-wrap';
  if (mini) wrap.style.cssText = `--day-col:${dayCol}px;--hour-h:${hourH}px;font-size:11px;`;

  // Header row
  const top = document.createElement('div');
  top.className = 'et-top';
  top.style.gridTemplateColumns = `${timeColW}px repeat(5, ${dayCol}px)`;
  top.innerHTML = `<div class="corner">?쒓컙</div>` +
    DAY_NAMES.map(d => `<div class="day">${d}</div>`).join('');
  wrap.appendChild(top);

  const body = document.createElement('div');
  body.className = 'et-body';

  // Grid
  const grid = document.createElement('div');
  grid.className = 'et-grid';
  grid.style.gridTemplateColumns = `${timeColW}px repeat(5, ${dayCol}px)`;
  hours.forEach(time => {
    const lbl = document.createElement('div');
    lbl.className = 'time-label';
    lbl.style.height = `${hourH}px`;
    lbl.textContent = time;
    grid.appendChild(lbl);
    for (let d = 0; d < 5; d++) {
      const cell = document.createElement('div');
      cell.className = 'day-cell';
      cell.style.height = `${hourH}px`;
      grid.appendChild(cell);
    }
  });

  // Course blocks layer
  const layer = document.createElement('div');
  layer.className = 'courses-layer';
  layer.style.left = `${timeColW}px`;

  const retakeSet = new Set((opts.retakeCourses || []).map(n => n.trim().toLowerCase()));

  flat.forEach(slot => {
    const start = timeToMin(slot.start);
    const end   = timeToMin(slot.end);
    if (end <= start || start < baseMin || end > lastMin) return;
    if (slot.day < 0 || slot.day > 4) return;

    const topPx    = ((start - baseMin) / 60) * hourH;
    const heightPx = ((end - start) / 60) * hourH;
    const leftPx   = slot.day * dayCol + 2;
    const widthPx  = dayCol - 4;

    const color = colorMap[slot.name] || COLORS[0];
    const isRetake = retakeSet.has(slot.name.trim().toLowerCase());
    const block = document.createElement('div');
    block.className = 'course-block' + (isRetake ? ' retake' : '');
    block.style.cssText = `
      left:${leftPx}px; top:${topPx + 1}px;
      width:${widthPx}px; height:${heightPx - 2}px;
      background:${color.bg}; border:1.5px solid ${color.border}; color:${color.text};
    `;
    block.dataset.name = slot.name;
    block.innerHTML = `
      <div class="course-title">${slot.name}</div>
      ${isRetake && !mini ? `<div class="course-meta retake-label">?봽 ?ъ닔媛?/div>` : ''}
      ${!mini ? `<div class="course-meta">${slot.start}??{slot.end}</div>` : ''}
      ${!mini && slot.room ? `<div class="course-meta">${slot.room}</div>` : ''}
    `;
    layer.appendChild(block);
  });

  body.appendChild(grid);
  body.appendChild(layer);
  wrap.appendChild(body);
  container.appendChild(wrap);

  return layer; // caller may attach click handlers
}

/* ============================================================
   Credit / GPA options
   ============================================================ */
function setupCreditOptions(state) {
  const maxSel  = document.getElementById('maxCredits');
  const gpaInp  = document.getElementById('prevGpa');
  const helpEl  = document.getElementById('creditHelp');
  if (!maxSel || !gpaInp) return;

  function refresh() {
    const gpa   = Number(gpaInp.value || 0);
    const upper = gpa >= 3.8 ? 23 : 20;
    const safe  = Math.min(Number(maxSel.value || state.maxCredits || 20), upper);
    maxSel.innerHTML = Array.from({ length: upper - 11 }, (_, i) => {
      const v = i + 12;
      return `<option value="${v}" ${v === safe ? 'selected' : ''}>${v}?숈젏</option>`;
    }).join('');
    if (helpEl) helpEl.textContent = gpa >= 3.8
      ? '吏곸쟾?숆린 ?깆쟻 3.8 ?댁긽 ??理쒕? 23?숈젏'
      : '湲곕낯 理쒕? ?좎껌?숈젏? 20?숈젏?낅땲??';
    state.prevGpa  = gpa;
    state.maxCredits = safe;
    saveState(state);
  }
  gpaInp.addEventListener('input', refresh);
  maxSel.addEventListener('change', () => { state.maxCredits = Number(maxSel.value); saveState(state); });
  refresh();
}

/* ============================================================
   Page: Login  (data-page="login")
   ============================================================ */
async function setupLoginPage() {
  const tabs       = document.querySelectorAll('.auth-tab');
  const loginForm  = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const loginErr   = document.getElementById('loginError');
  const signupErr  = document.getElementById('signupError');

  // ?숆낵 紐⑸줉 濡쒕뱶 ??select 梨꾩슦湲?  await loadDepartments();
  fillDepartmentOptions(document.getElementById('signupDepartment'));

  // Tab switching
  tabs.forEach(tab => tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isLogin = tab.dataset.tab === 'login';
    loginForm.classList.toggle('hidden', !isLogin);
    signupForm.classList.toggle('hidden', isLogin);
    loginErr.classList.add('hidden');
    signupErr.classList.add('hidden');
  }));

  // Enter key
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (!loginForm.classList.contains('hidden')) document.getElementById('loginBtn')?.click();
    else document.getElementById('signupBtn')?.click();
  });

  // Login
  document.getElementById('loginBtn')?.addEventListener('click', () => {
    const sid  = document.getElementById('loginStudentId').value.trim();
    const pass = document.getElementById('loginPassword').value;
    if (!/^\d{8}$/.test(sid)) return showErr(loginErr, '?숇쾲? 8?먮━ ?レ옄濡??낅젰??二쇱꽭??');
    if (!pass)                 return showErr(loginErr, '鍮꾨?踰덊샇瑜??낅젰??二쇱꽭??');
    const user = findUser(sid);
    if (!user)              return showErr(loginErr, '?깅줉?섏? ?딆? ?숇쾲?낅땲?? ?뚯썝媛?낆쓣 ?댁＜?몄슂.');
    if (user.password !== pass) return showErr(loginErr, '鍮꾨?踰덊샇媛 ?쇱튂?섏? ?딆뒿?덈떎.');
    setSession(sid);
    location.href = 'index.html';
  });

  // Signup
  document.getElementById('signupBtn')?.addEventListener('click', () => {
    const sid   = document.getElementById('signupStudentId').value.trim();
    const dept  = document.getElementById('signupDepartment')?.value || '';
    const pass  = document.getElementById('signupPassword').value;
    const pass2 = document.getElementById('signupPasswordConfirm').value;
    if (!/^\d{8}$/.test(sid)) return showErr(signupErr, '?숇쾲? 8?먮━ ?レ옄濡??낅젰??二쇱꽭??');
    if (!dept)                 return showErr(signupErr, '?숆낵瑜??좏깮??二쇱꽭??');
    if (pass.length < 4)       return showErr(signupErr, '鍮꾨?踰덊샇??4???댁긽 ?낅젰??二쇱꽭??');
    if (pass !== pass2)        return showErr(signupErr, '鍮꾨?踰덊샇媛 ?쇱튂?섏? ?딆뒿?덈떎.');
    if (findUser(sid))         return showErr(signupErr, '?대? ?깅줉???숇쾲?낅땲?? 濡쒓렇?명빐 二쇱꽭??');
    const users = getUsers();
    users.push({ studentId: sid, department: dept, password: pass });
    saveUsers(users);
    const initState = {
      ...DEFAULT_STATE, studentId: sid, department: dept,
      year: String(getAdmissionYear(sid) || new Date().getFullYear())
    };
    saveState(initState);
    setSession(sid);
    location.href = 'index.html';
  });
}

function showErr(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

/* ============================================================
   Page: Index  (data-page="index")
   ============================================================ */
function setupIndexPage(state) {
  const admYear    = getAdmissionYear(state.studentId);
  const yearSel    = document.getElementById('yearSelect');
  const semSel     = document.getElementById('semesterSelect');

  const defaultYear = state.year || new Date().getFullYear();
  fillYearOptions(yearSel, defaultYear, admYear);
  if (!state.year && yearSel?.value) { state.year = yearSel.value; saveState(state); }
  if (semSel) semSel.value = state.semester || '1?숆린';

  const refreshIndex = () => {
    state.year     = yearSel?.value || state.year;
    state.semester = semSel?.value  || state.semester;
    // ?꾩옱 ?좏깮 ?숆린 ?쒓컙??諛섏쁺
    state.courses = getTimetable(state, state.year, state.semester);
    saveState(state);
    updateSummary(state);
    renderTimetable(container, state.courses, { retakeCourses: state.retakeCourses });
    setupBlockClicks(container, state);
  };

  yearSel?.addEventListener('change', refreshIndex);
  semSel?.addEventListener('change',  refreshIndex);

  // ?꾩옱 ?숆린 ?쒓컙??濡쒕뱶
  state.courses = getTimetable(state, state.year, state.semester);
  updateSummary(state);

  const container = document.getElementById('timetableContainer');
  renderTimetable(container, state.courses, { retakeCourses: state.retakeCourses });
  setupBlockClicks(container, state);

}

function setupBlockClicks(container, state) {
  const layer = container.querySelector('.courses-layer');
  if (!layer) return;
  layer.addEventListener('click', e => {
    const block = e.target.closest('.course-block');
    if (!block) return;
    showCoursePopup(block, block.dataset.name, state, () => {
      updateSummary(state);
      renderTimetable(container, state.courses);
      // ?щ젋??????layer???대깽???ъ뿰寃?      setupBlockClicks(container, state);
    });
  }, { once: true });
}

function semOrdinal(sem) {
  return ({ '1?숆린': 1, '?щ쫫?숆린': 2, '2?숆린': 3, '寃⑥슱?숆린': 4 })[sem] ?? 3;
}

/* ?대떦 ?숇뀈???숆린媛 ?꾩옱 ?쒖젏 湲곗??쇰줈 ?대? ?앸궗?붿? ?먮떒
   1?숆린: 3~7????8???댄썑遺??醫낅즺濡?媛꾩＜
   ?щ쫫?숆린: 7~8????9???댄썑遺??醫낅즺濡?媛꾩＜
   2?숆린: 9~12?????ㅼ쓬?대???醫낅즺濡?媛꾩＜
   寃⑥슱?숆린: 1~2????3???댄썑(媛숈? ???뱀? ?ㅼ쓬??遺??醫낅즺濡?媛꾩＜ */
function isPastSemester(year, sem) {
  const now  = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1; // 1~12
  const yr   = Number(year);
  if (yr < nowY) return true;
  if (yr > nowY) return false;
  // 媛숈? ?곕룄
  if (sem === '1?숆린')   return nowM >= 7;   // 7???댄썑硫?1?숆린 醫낅즺
  if (sem === '?щ쫫?숆린') return nowM >= 9;   // 9???댄썑硫??щ쫫?숆린 醫낅즺
  if (sem === '2?숆린')   return false;        // 2?숆린??媛숈? ?댁뿏 ?꾩쭅 ???앸궓
  if (sem === '寃⑥슱?숆린') return false;        // 寃⑥슱?숆린??留덉갔媛吏
  return false;
}

/* 吏???숆린 timetables?먯꽌 怨쇰ぉ紐?Set 諛섑솚 */
function getPastTimetableCourseNames(state) {
  const names = new Set();
  for (const [key, courses] of Object.entries(state.timetables || {})) {
    const m = key.match(/^(\d{4})_(.+)$/);
    if (!m) continue;
    if (isPastSemester(m[1], m[2])) {
      (courses || []).forEach(c => names.add(c.name.trim().toLowerCase()));
    }
  }
  return names;
}
function calcAccumulatedCredits(state) {
  let total = 0;
  for (const [key, courses] of Object.entries(state.timetables || {})) {
    const m = key.match(/^(\d{4})_(.+)$/);
    if (!m) continue;
    if (isPastSemester(m[1], m[2])) {
      total += (courses || []).reduce((s, c) => s + (Number(c.credits) || 0), 0);
    }
  }
  return total;
}

function updateSummary(state) {
  const credits     = state.courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
  const accumulated = calcAccumulatedCredits(state);
  state.appliedCredits = credits;
  state.totalCredits   = accumulated;
  saveState(state);
  const el      = document.getElementById('appliedCredits');
  const totalEl = document.getElementById('totalCredits');
  if (el)      el.textContent = credits;
  if (totalEl) totalEl.textContent = accumulated;
}

/* ?? Course block popup (index page) ?? */
let _popup = null;
function showCoursePopup(block, courseName, state, onDelete) {
  closePopup();

  if (!state.retakeCourses) state.retakeCourses = [];
  const course    = state.courses.find(c => c.name === courseName);
  const isRetake  = state.retakeCourses.includes(courseName);
  const rect      = block.getBoundingClientRect();

  const popup = document.createElement('div');
  popup.className = 'course-popup';
  popup.innerHTML = `
    <div class="popup-name">${courseName}</div>
    ${course?.professor ? `<div class="popup-meta">?뫀 ${course.professor}</div>` : ''}
    ${course?.category  ? `<div class="popup-meta">?뱴 ${course.category}${course.subtitle ? ' 쨌 '+course.subtitle : ''}</div>` : ''}
    ${course?.credits   ? `<div class="popup-meta">?륅툘 ${course.credits}?숈젏</div>` : ''}
    <button class="popup-retake-btn${isRetake ? ' active' : ''}" type="button">
      ?봽 ${isRetake ? '?ъ닔媛?痍⑥냼' : '?ъ닔媛??꾩슂'}
    </button>
    <button class="popup-del-btn" type="button">?쒓컙?쒖뿉????젣</button>
  `;

  // Position popup
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;
  popup.style.top  = `${rect.bottom + scrollY + 8}px`;
  popup.style.left = `${rect.left  + scrollX}px`;
  document.body.appendChild(popup);
  _popup = popup;

  popup.querySelector('.popup-retake-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (!state.retakeCourses) state.retakeCourses = [];
    if (state.retakeCourses.includes(courseName)) {
      state.retakeCourses = state.retakeCourses.filter(n => n !== courseName);
    } else {
      state.retakeCourses.push(courseName);
    }
    saveState(state);
    closePopup();
    onDelete?.();
  });

  popup.querySelector('.popup-del-btn').addEventListener('click', () => {
    state.courses = state.courses.filter(c => c.name !== courseName);
    setTimetable(state, state.year, state.semester, state.courses);
    saveState(state);
    closePopup();
    onDelete?.();
  });

  // Dismiss on outside click
  setTimeout(() => {
    document.addEventListener('click', closePopup, { once: true });
  }, 0);
}

function closePopup() {
  if (_popup) { _popup.remove(); _popup = null; }
}


/* ============================================================
   Page: Generate  (data-page="generate")
   ============================================================ */
let _allCourses     = [];   // loaded from data/courses.json
let _selected       = [];   // courses user has picked (temp, not saved yet)
let _myDepartment   = '';   // 濡쒓렇?명븳 ?ъ슜?먯쓽 ?숆낵
let _gradReqs       = null; // loaded from data/all_grad_reqs.json
let _currentState   = null; // reference to current page state

// Filter state
let _activeType     = '';   // '' | 'liberal' | 'major'
let _activeDept     = '';   // major: ?숆낵紐?let _activeCategory = '';   // liberal: category
let _activeSubtitle = '';   // liberal: subtitle
let _activeYear     = 0;    // 0=?꾩껜 1~4=?숇뀈

function setupGeneratePage(state) {
  _currentState = state;
  const admYear = getAdmissionYear(state.studentId);

  // Header info
  const sidEl  = document.getElementById('studentIdDisplay');
  const deptEl = document.getElementById('departmentDisplay');
  if (sidEl)  sidEl.textContent  = state.studentId || '-';
  if (deptEl) deptEl.textContent = state.department || '-';

  const yearSel = document.getElementById('generateYear');
  const semSel  = document.getElementById('generateSemester');
  // 湲곕낯 ?좏깮: ??λ맂 year > ?꾩옱 ?곕룄. admYear???좏깮 踰붿쐞 ?쒖옉媛믪씪 肉?  const defaultYear = state.year || new Date().getFullYear();
  fillYearOptions(yearSel, defaultYear, admYear);
  if (semSel) semSel.value = state.semester || '1?숆린';

  const reloadCourses = () => {
    state.year     = yearSel?.value || state.year;
    state.semester = semSel?.value  || state.semester;
    // ?대떦 ?숆린????λ맂 ?쒓컙??遺덈윭?ㅺ린
    _selected = getTimetable(state, state.year, state.semester);
    renderSelectedList();
    renderMiniTimetable();
    saveState(state);
    loadCoursesForTerm(state.year, state.semester);
  };
  yearSel?.addEventListener('change', reloadCourses);
  semSel?.addEventListener('change',  reloadCourses);

  const gpaInp = document.getElementById('prevGpa');
  if (gpaInp) gpaInp.value = state.prevGpa ?? 3.6;
  setupCreditOptions(state);

  // Initialize selected from current semester's saved timetable
  _selected = getTimetable(state, state.year, state.semester);

  // ???숆낵 ?명똿
  _myDepartment = state.department || '';

  // Reset filter state on page load
  _activeType = _activeDept = _activeCategory = _activeSubtitle = '';
  _activeYear = 0;

  // Load courses.json + grad reqs + roadmap in parallel, then setup panels
  Promise.all([loadCoursesForTerm(state.year, state.semester), loadGradReqs(), loadRoadmap()]).then(() => {
    setupGradReqPanel(state);
    setupPinnedCourses(state);
    setupExcludedCourses(state);
    setupCompletedCourses(state);
    setupAutoGen(state);
  });

  // Search
  document.getElementById('courseSearch')?.addEventListener('input', renderCourseList);

  // Save button
  document.getElementById('saveCoursesBtn')?.addEventListener('click', () => {
    setTimetable(state, state.year, state.semester, [..._selected]);
    updateSummaryGen(state);
    saveState(state);
    location.href = 'index.html';
  });

  // Clear all
  document.getElementById('clearSelectionBtn')?.addEventListener('click', () => {
    _selected = [];
    renderSelectedList();
    renderMiniTimetable();
    renderCourseList();
  });

  renderMiniTimetable();
  renderSelectedList();
}

async function loadGradReqs() {
  if (_gradReqs) return _gradReqs;
  try {
    const res = await fetch('data/all_grad_reqs.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _gradReqs = await res.json();
  } catch (e) {
    _gradReqs = {};
  }
  return _gradReqs;
}

let _roadmap = null;
async function loadRoadmap() {
  if (_roadmap) return _roadmap;
  try {
    const res = await fetch('data/curriculum_roadmap.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _roadmap = await res.json();
  } catch (e) {
    _roadmap = {};
  }
  return _roadmap;
}

// ?숆낵+?숇뀈+?숆린 湲곗? 濡쒕뱶留?怨쇰ぉ紐?紐⑸줉 諛섑솚
function getRoadmapCourses(dept, grade, semester) {
  if (!_roadmap || !dept) return [];
  const deptMap = _roadmap[dept];
  if (!deptMap) return [];
  const semKey = String(semester).replace('?숆린', '').trim(); // '1?숆린' ??'1'
  return (deptMap[String(grade)]?.[semKey]) || [];
}

// ?꾩옱 濡쒕뱶???숇뀈???숆린 湲곕줉 (以묐났 濡쒕뱶 諛⑹?)
let _loadedTerm = '';

async function loadCoursesForTerm(year, semester) {
  const statusEl  = document.getElementById('courseLoadStatus');
  const noticeEl  = document.getElementById('fallbackNotice');
  const y   = year     || String(new Date().getFullYear());
  const sem = semester || '1?숆린';
  const url = `/api/courses?year=${encodeURIComponent(y)}&semester=${encodeURIComponent(sem)}`;

  if (statusEl) { statusEl.textContent = '濡쒕뵫以묅?; statusEl.className = 'status-badge warn'; }
  if (noticeEl) noticeEl.classList.add('hidden');

  try {
    const res  = await fetch(url);

    // 202: ?쒕쾭?먯꽌 ?щ·留?以???5珥????먮룞 ?ъ떆??    if (res.status === 202) {
      if (statusEl) { statusEl.textContent = '?섏쭛以묅?; statusEl.className = 'status-badge warn'; }
      const listEl = document.getElementById('courseList');
      if (listEl) listEl.innerHTML = `<div class="course-list-empty">
        <strong>${y} ${sem}</strong> 媛뺤쓽 ?곗씠?곕? 泥섏쓬 ?섏쭛 以묒엯?덈떎.<br>
        <small>?좎떆 ???먮룞?쇰줈 ?ㅼ떆 遺덈윭?듬땲?ㅲ?/small>
      </div>`;
      setTimeout(() => loadCoursesForTerm(year, semester), 5000);
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    _allCourses = data;

    // ?대갚 ?щ? ?뺤씤 (?쒕쾭 ?ㅻ뜑)
    const isFallback   = res.headers.get('X-Is-Fallback') === 'true';
    const actualYear   = res.headers.get('X-Actual-Year') || y;
    const actualSemRaw = res.headers.get('X-Actual-Semester') || encodeURIComponent(sem);
    const actualSem    = (() => { try { return decodeURIComponent(actualSemRaw); } catch { return sem; } })();

    if (statusEl) {
      statusEl.textContent = `${_allCourses.length}媛?媛뺤쓽`;
      statusEl.className   = 'status-badge ok';
    }

    // ?대갚 ?덈궡 諛곗? ?쒖떆
    if (noticeEl) {
      if (isFallback && (actualYear !== y || actualSem !== sem)) {
        noticeEl.textContent = `?뱟 ${y} ${sem} 誘멸컻????${actualYear} ${actualSem} 湲곗??쇰줈 ?쒖떆`;
        noticeEl.classList.remove('hidden');
      } else {
        noticeEl.classList.add('hidden');
      }
    }

    buildTypePills();
    renderCourseList();
  } catch (err) {
    if (statusEl) { statusEl.textContent = '濡쒕뱶 ?ㅽ뙣'; statusEl.className = 'status-badge warn'; }
    const listEl = document.getElementById('courseList');
    if (listEl) listEl.innerHTML = `<div class="course-list-empty">媛뺤쓽 ?곗씠?곕? 遺덈윭?ㅼ? 紐삵뻽?듬땲??<br><small>${err.message}</small></div>`;
  }
}

/* ============================================================
   3?④퀎 ?꾪꽣 pill ?쒖뒪??   ??援먯뼇/?꾧났  ??援먯뼇?믩텇瑜?/ ?꾧났?믫븰怨? ??援먯뼇?믪꽭遺 / ?꾧났?믫븰??   ============================================================ */

/* ?????pills: [?꾩껜] [援먯뼇] [???꾧났] */
function buildTypePills() {
  const row = document.getElementById('catFilterRow');
  if (!row) return;

  // ???숆낵 ?꾧났 怨쇰ぉ ??  const myDept      = _myDepartment;
  const myMajorCount = myDept
    ? _allCourses.filter(c => c.type === 'major' && c.department === myDept).length
    : _allCourses.filter(c => c.type === 'major').length;

  const types = [
    { val: '',           label: '?꾩껜',   count: _allCourses.length },
    { val: 'liberal',    label: '援먯뼇',   count: _allCourses.filter(c => c.type === 'liberal').length },
    { val: 'major',      label: myDept ? `???꾧났 (${myDept})` : '?꾧났', count: myMajorCount },
    { val: '?먯쑀?좏깮',   label: '?먯쑀?좏깮', count: _allCourses.filter(c => c.type === '?먯쑀?좏깮').length }
  ].filter(t => t.val === '' || t.count > 0);

  row.innerHTML = types.map(t => {
    const active = _activeType === t.val;
    return `<button class="filter-pill${active ? ' active' : ''}"
                    data-type="${t.val}" type="button">
              ${t.label} <span class="pill-count">${t.count}</span>
            </button>`;
  }).join('');

  row.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      _activeType     = pill.dataset.type;
      _activeDept     = _activeType === 'major' && _myDepartment ? _myDepartment : '';
      _activeCategory = '';
      _activeSubtitle = '';
      _activeYear     = 0;
      buildTypePills();
      buildSecondRow();
      buildThirdRow();
      renderCourseList();
    });
  });

  buildSecondRow();
}

/* ????踰덉㎏ ?? 援먯뼇?믩텇瑜?/ ?꾧났?믫븰怨?*/
function buildSecondRow() {
  const row = document.getElementById('subFilterRow');
  if (!row) return;

  if (!_activeType) { row.classList.add('hidden'); buildThirdRow(); return; }

  // ?먯쑀?좏깮 ?? ?몃? ?꾪꽣 遺덊븘?????④?
  if (_activeType === '?먯쑀?좏깮') {
    row.classList.add('hidden');
    buildThirdRow();
    return;
  }

  row.classList.remove('hidden');

  if (_activeType === 'liberal') {
    // 援먯뼇 移댄뀒怨좊━ pills
    const cats = [...new Set(
      _allCourses.filter(c => c.type === 'liberal').map(c => c.category).filter(Boolean)
    )];
    const libBase = _allCourses.filter(c => c.type === 'liberal');
    row.innerHTML = makeRow([
      { val: '', label: '?꾩껜', count: libBase.length },
      ...cats.map(cat => ({ val: cat, label: cat, count: libBase.filter(c => c.category === cat).length }))
    ], 'data-cat', _activeCategory, 'sub');

    row.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        _activeCategory = pill.dataset.cat;
        _activeSubtitle = '';
        buildSecondRow();
        buildThirdRow();
        renderCourseList();
      });
    });

  } else {
    // ?꾧났: ???숆낵媛 ?덉쑝硫??먮룞 ?좏깮, ?놁쑝硫??꾩껜 ?숆낵 紐⑸줉
    if (_myDepartment) {
      // ???숆낵 ?먮룞 怨좎젙 ??2?④퀎 ???④?
      _activeDept = _myDepartment;
      row.classList.add('hidden');
      buildThirdRow();
      return;
    }

    // ?숆낵 ?좏깮 pills (?숆낵紐??ㅻ쫫李⑥닚)
    const depts = [...new Set(
      _allCourses.filter(c => c.type === 'major' && c.department).map(c => c.department)
    )].sort((a, b) => a.localeCompare(b, 'ko'));
    const majBase = _allCourses.filter(c => c.type === 'major');
    row.innerHTML = makeRow([
      { val: '', label: '?꾩껜', count: majBase.length },
      ...depts.map(d => ({ val: d, label: d, count: majBase.filter(c => c.department === d).length }))
    ], 'data-dept', _activeDept, 'sub dept-row');

    row.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        _activeDept = pill.dataset.dept;
        _activeYear = 0;
        buildSecondRow();
        buildThirdRow();
        renderCourseList();
      });
    });
  }

  buildThirdRow();
}

/* ????踰덉㎏ ?? 援먯뼇?믪꽭遺遺꾨쪟 / ?꾧났?믫븰??*/
function buildThirdRow() {
  const row = document.getElementById('thirdFilterRow');
  if (!row) return;

  if (_activeType === 'liberal' && _activeCategory) {
    // ?몃?遺꾨쪟 pills
    const subs = [...new Set(
      _allCourses.filter(c => c.type === 'liberal' && c.category === _activeCategory && c.subtitle).map(c => c.subtitle)
    )];
    if (!subs.length) { row.classList.add('hidden'); return; }
    const base = _allCourses.filter(c => c.type === 'liberal' && c.category === _activeCategory);
    row.classList.remove('hidden');
    row.innerHTML = makeRow([
      { val: '', label: '?꾩껜', count: base.length },
      ...subs.map(s => ({ val: s, label: s, count: base.filter(c => c.subtitle === s).length }))
    ], 'data-sub', _activeSubtitle, 'sub');

    row.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        _activeSubtitle = pill.dataset.sub;
        buildThirdRow();
        renderCourseList();
      });
    });

  } else if (_activeType === 'major' && _activeDept) {
    // ?숇뀈 pills ??gradeOk 湲곗?: ?대떦 ?숇뀈 ?숈깮???섍컯 媛?ν븳 怨쇰ぉ ??    // (?곸쐞 ?숇뀈? ?섏쐞 ?숇뀈 怨쇰ぉ ?ъ닔媛?媛?? ?섏쐞 ?숇뀈? ?곸쐞 ?숇뀈 怨쇰ぉ ?섍컯 遺덇?)
    const base = _allCourses.filter(c => c.type === 'major' && c.department === _activeDept);
    row.classList.remove('hidden');
    row.innerHTML = makeRow([
      { val: '0', label: '???숇뀈', count: base.length },
      ...[1,2,3,4].map(y => ({
        val: String(y), label: `${y}?숇뀈`,
        count: base.filter(c => gradeOk(c, y)).length
      })).filter(y => y.count > 0)
    ], 'data-year', String(_activeYear), 'sub');

    row.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        _activeYear = Number(pill.dataset.year);
        buildThirdRow();
        renderCourseList();
      });
    });

  } else {
    row.classList.add('hidden');
  }
}

/* pill HTML ?앹꽦 ?ы띁 */
function makeRow(items, dataAttr, activeVal, extraClass = '') {
  return items.map(item => {
    const active = item.val === activeVal;
    return `<button class="filter-pill ${extraClass}${active ? ' active' : ''}"
                    ${dataAttr}="${esc(item.val)}" type="button">
              ${item.label} <span class="pill-count">${item.count}</span>
            </button>`;
  }).join('');
}

function renderCourseList() {
  const listEl  = document.getElementById('courseList');
  const countEl = document.getElementById('courseCount');
  const query   = (document.getElementById('courseSearch')?.value || '').trim().toLowerCase();

  if (!listEl) return;

  const filtered = _allCourses.filter(c => {
    if (_activeType && c.type !== _activeType) return false;
    if (_activeType === 'liberal') {
      if (_activeCategory && c.category !== _activeCategory) return false;
      if (_activeSubtitle && c.subtitle !== _activeSubtitle) return false;
    }
    if (_activeType === 'major') {
      if (_activeDept && c.department !== _activeDept) return false;
      // ?곸쐞 ?숇뀈? ?섏쐞 ?숇뀈 怨쇰ぉ ?섍컯 媛???ъ닔媛?, ?섏쐞 ?숇뀈? ?곸쐞 ?숇뀈 怨쇰ぉ ?섍컯 遺덇?
      if (_activeYear && !gradeOk(c, _activeYear)) return false;
    }
    if (query && !c.name.toLowerCase().includes(query) &&
        !(c.professor   || '').toLowerCase().includes(query) &&
        !(c.subtitle    || '').toLowerCase().includes(query) &&
        !(c.department  || '').toLowerCase().includes(query)) return false;
    return true;
  });

  if (countEl) countEl.textContent = `${filtered.length}媛?媛뺤쓽`;

  if (!filtered.length) {
    listEl.innerHTML = '<div class="course-list-empty">寃??寃곌낵媛 ?놁뒿?덈떎.</div>';
    return;
  }

  listEl.innerHTML = filtered.map(course => {
    const isAdded = _selected.some(s => s.name === course.name && s.section === course.section);
    const slotText = course.online
      ? '?벑 鍮꾨?硫?(?쒓컙???놁쓬)'
      : course.slots.map(s => `${DAY_NAMES[s.day] || '?'} ${s.start}??{s.end}`).join(' / ');

    // ?숇뀈 諭껋?
    const yearBadge = course.eligible_years?.length
      ? `<span class="year-badge">${course.eligible_years.map(y => `${y}?숇뀈`).join('쨌')}</span>`
      : '';
    // ?숆낵 諭껋?: ???숆낵濡??꾪꽣 以묒씠硫??앸왂, ?꾨땲硫??쒖떆
    const deptBadge = course.type === 'major' && course.department && !_myDepartment
      ? `<span class="dept-badge">${course.department}</span>`
      : '';

    return `
      <div class="course-card ${isAdded ? 'added' : ''}"
           data-name="${esc(course.name)}"
           data-section="${esc(course.section || '')}">
        <div class="course-card-left">
          <div class="course-card-name">${course.name}</div>
          <div class="course-card-meta">
            <span class="cat-badge cat-${catClass(course.category)}">${course.category}</span>
            ${course.subtitle ? `<span class="sub-badge">${course.subtitle}</span>` : ''}
            ${deptBadge}
            ${yearBadge}
            ${course.professor ? `<span class="prof-text">${course.professor}</span>` : ''}
            <span class="credit-text">${course.credits}?숈젏</span>
          </div>
          <div class="course-card-time">${slotText}</div>
        </div>
        <button class="add-btn ${isAdded ? 'added' : ''}" type="button"
                data-name="${esc(course.name)}" data-section="${esc(course.section || '')}">
          ${isAdded ? '?? : '+'}
        </button>
      </div>
    `;
  }).join('');

  // Attach click events to + buttons
  listEl.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const name    = btn.dataset.name;
      const section = btn.dataset.section;
      const course  = _allCourses.find(c => c.name === name && (c.section || '') === section);
      if (!course) return;
      toggleCourse(course);
    });
  });
}

function toggleCourse(course) {
  const idx = _selected.findIndex(s => s.name === course.name && s.section === course.section);
  if (idx >= 0) {
    _selected.splice(idx, 1);
  } else {
    // Conflict check
    const conflict = checkConflict(course, _selected);
    if (conflict) {
      alert(`?쒓컙 異⑸룎: "${conflict}" 媛뺤쓽? ?쒓컙??寃뱀묩?덈떎.`);
      return;
    }
    _selected.push(course);
  }
  renderCourseList();
  renderSelectedList();
  renderMiniTimetable();
  if (_gradReqs && _currentState) renderGradReq(_currentState);
  syncResultAddButtons();
}

function checkConflict(newCourse, selected) {
  for (const existing of selected) {
    for (const ns of (newCourse.slots || [])) {
      for (const es of (existing.slots || [])) {
        if (ns.day !== es.day) continue;
        const ns0 = timeToMin(ns.start), ns1 = timeToMin(ns.end);
        const es0 = timeToMin(es.start), es1 = timeToMin(es.end);
        if (ns0 < es1 && ns1 > es0) return existing.name;
      }
    }
  }
  return null;
}

function renderSelectedList() {
  const listEl  = document.getElementById('selectedList');
  const infoEl  = document.getElementById('selectedInfo');
  if (!listEl) return;

  const totalCredits = _selected.reduce((s, c) => s + (Number(c.credits) || 0), 0);
  if (infoEl) infoEl.textContent = `${_selected.length}媛?쨌 ${totalCredits}?숈젏`;

  if (!_selected.length) {
    listEl.classList.add('empty');
    listEl.innerHTML = '?쇱そ?먯꽌 媛뺤쓽瑜??댁븘二쇱꽭??;
    return;
  }

  listEl.classList.remove('empty');
  listEl.innerHTML = _selected.map(c => `
    <div class="selected-item">
      <div class="selected-item-info">
        <div class="selected-item-name">${c.name}</div>
        <div class="selected-item-meta">
          ${c.category} 쨌 ${c.credits}?숈젏
          ${c.professor ? ` 쨌 ${c.professor}` : ''}
        </div>
      </div>
      <button class="remove-btn" type="button"
              data-name="${esc(c.name)}" data-section="${esc(c.section || '')}">횞</button>
    </div>
  `).join('');

  listEl.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = _selected.findIndex(
        s => s.name === btn.dataset.name && (s.section || '') === btn.dataset.section
      );
      if (idx >= 0) {
        _selected.splice(idx, 1);
        renderSelectedList();
        renderMiniTimetable();
        renderCourseList();
        if (_gradReqs) renderGradReq(_currentState);
      }
    });
  });
}

function renderMiniTimetable() {
  const el = document.getElementById('miniTimetable');
  if (!el) return;
  const doRender = () => {
    // ?ㅼ젣 ?뚮뜑留??덈퉬 湲곗??쇰줈 dayCol 怨꾩궛
    const containerW = el.getBoundingClientRect().width || el.offsetWidth || 300;
    const timeColW   = 32;
    const dayCol     = Math.max(40, Math.floor((containerW - timeColW - 2) / 5));
    renderTimetable(el, _selected, { mini: true, dayCol, timeColW });
  };
  // ?덉씠?꾩썐???꾩꽦?????ㅽ뻾
  if (el.offsetWidth > 0) { doRender(); }
  else requestAnimationFrame(doRender);
}

function updateSummaryGen(state) {
  state.appliedCredits = state.courses.reduce((s, c) => s + (Number(c.credits) || 0), 0);
}

/* ============================================================
   Page: Settings  (data-page="settings")
   ============================================================ */
async function setupSettingsPage(state) {
  const sidInp  = document.getElementById('settingsStudentId');
  const deptSel = document.getElementById('settingsDepartment');
  const saveBtn = document.getElementById('saveSettingsBtn');

  if (sidInp) sidInp.value = state.studentId || '';

  await loadDepartments();
  fillDepartmentOptions(deptSel, state.department || '');

  saveBtn?.addEventListener('click', () => {
    const id   = sidInp?.value.trim() || '';
    const dept = deptSel?.value || '';
    if (!/^\d{8}$/.test(id)) { alert('?숇쾲? 8?먮━ ?レ옄濡??낅젰??二쇱꽭??'); sidInp?.focus(); return; }
    if (!dept)                { alert('?숆낵瑜??좏깮??二쇱꽭??'); deptSel?.focus(); return; }

    const users = getUsers();
    const idx   = users.findIndex(u => u.studentId === state.studentId);
    if (idx >= 0) {
      users[idx].studentId  = id;
      users[idx].department = dept;
      saveUsers(users);
    }

    // ?숇쾲??諛붾뚮㈃ 湲곗〈 state瑜????ㅻ줈 ?댁쟾
    if (id !== state.studentId) {
      const oldKey = STATE_PREFIX + state.studentId;
      const existing = localStorage.getItem(oldKey);
      if (existing) {
        localStorage.setItem(STATE_PREFIX + id, existing);
        localStorage.removeItem(oldKey);
      }
      setSession(id);
    }

    state.studentId  = id;
    state.department = dept;
    const admYear = getAdmissionYear(id);
    if (!buildAllowedYears(admYear).includes(Number(state.year))) state.year = String(admYear);
    saveState(state);
    alert('?ㅼ젙????λ릺?덉뒿?덈떎.');
    location.href = 'index.html';
  });
}

/* ============================================================
   Logout
   ============================================================ */
function setupLogout() {
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', () => { clearSession(); location.href = 'login.html'; });
  });
}

function setupSidebarToggle() {
  const sidebar  = document.querySelector('.sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const openBtn  = document.getElementById('hamburgerBtn');
  const closeBtn = document.getElementById('sidebarCloseBtn');
  if (!sidebar || !overlay || !openBtn) return;

  const open  = () => { sidebar.classList.add('open');    overlay.classList.add('active'); };
  const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('active'); };

  openBtn.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', close);
  document.querySelectorAll('.side-link').forEach(a => a.addEventListener('click', close));
}

/* ============================================================
   Helpers
   ============================================================ */
function esc(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function catClass(cat) {
  if (cat === '?꾧났?꾩닔')   return 'req';
  if (cat === '?꾧났?좏깮')   return 'elec';
  if (cat === '?듯빀?꾧났?꾩닔') return 'fusion-req';
  if (cat === '?듯빀?꾧났')   return 'fusion';
  if (cat === '湲곗큹援먯뼇')   return 'basic';
  if (cat === '洹좏삎援먯뼇')   return 'balance';
  if (cat === '?뺣?援먯뼇')   return 'expand';
  if (cat === '?먯쑀?좏깮')   return 'free';
  return 'other';
}

/* ============================================================
   Auto Timetable Generation
   ============================================================ */

// State
let _autoGrade = 0;
const _autoPrefs = new Set();

const STYLE_META = {
  avoid_morning:  { label: '?꾩묠 ?뚰뵾??,    desc: '9??10???댁쟾 ?섏뾽??理쒕???諛곗젣?⑸땲??' },
  avoid_gap:      { label: '?곗＜怨듦컯 ?뚰뵾',   desc: '媛숈? ??湲?怨듦컯(1?쒓컙 ?댁긽)???앷린吏 ?딅룄濡??⑸땲??' },
  cluster:        { label: '紐곗븘?ｊ린??,     desc: '?섏뾽???곸? ???섎? 留뚮뱾??怨듦컯?쇱쓣 ?뺣낫?⑸땲??' },
  spread:         { label: '?먮꼸??遺꾩궛??,   desc: '?붿씪蹂꾨줈 怨좊Ⅴ寃?遺꾩궛?섏뿬 怨쇰????놁씠 援ъ꽦?⑸땲??' },
  major_first:       { label: '?꾧났 ?곗꽑',          desc: '?꾧났 怨쇰ぉ??理쒕???梨꾩슫 ??援먯뼇?쇰줈 ?섎㉧吏瑜?梨꾩썎?덈떎.' },
  liberal_first:     { label: '援먯뼇 ?곗꽑',          desc: '援먯뼇 怨쇰ぉ??癒쇱? 梨꾩슫 ???꾧났 ?좏깮?쇰줈 留덈Т由ы빀?덈떎.' },
  liberal_req_first: { label: '援먯뼇 議몄뾽?붽굔 ?곗꽑', desc: '?꾩닔 援먯뼇(湲곗큹쨌洹좏삎) ?곸뿭???쒕뜡 ?놁씠 諛섎뱶??癒쇱? 梨꾩썎?덈떎. 議몄뾽??珥됰컯????沅뚯옣?⑸땲??' }
};

/* ?? 怨쇰ぉ ?щ’ ??遺??⑥쐞 蹂???? */
function courseToFlat(course) {
  return (course.slots || []).map(s => ({
    day:       s.day,
    start_min: timeToMin(s.start),
    end_min:   timeToMin(s.end),
    room:      s.room || ''
  })).filter(s => s.start_min < s.end_min && s.day >= 0 && s.day <= 4);
}

/* ?? 異⑸룎 寃???? */
function flatConflict(aSlots, bSlots) {
  return aSlots.some(a => bSlots.some(b =>
    a.day === b.day && a.start_min < b.end_min && a.end_min > b.start_min
  ));
}

/* ?? ?ㅼ퐫?대쭅: ??怨쇰ぉ??異붽??덉쓣 ???쇰쭏???좏샇?꾩뿉 留욌뒗媛 ?? */
function scoreCourse(course, usedFlat, prefs) {
  const cFlat   = courseToFlat(course);
  const allFlat = [...usedFlat, ...cFlat];
  let score = 0;

  // ?꾩묠 ?뚰뵾????09:00 ?댁쟾 媛뺥븯寃? 10:00 ?댁쟾???⑤꼸??  if (prefs.has('avoid_morning')) {
    cFlat.forEach(s => {
      if (s.start_min < 9 * 60)        score -= 80;  // 09:00 ?댁쟾
      else if (s.start_min < 9.5 * 60) score -= 50;  // 09:00~09:30
      else if (s.start_min < 10 * 60)  score -= 20;  // 09:30~10:00
    });
  }

  // ?곗＜怨듦컯 ?뚰뵾?? 湲?怨듦컯?쇱닔濡?媛뺥븳 ?⑤꼸??  if (prefs.has('avoid_gap')) {
    for (let day = 0; day < 5; day++) {
      const daySlots = allFlat.filter(s => s.day === day)
        .sort((a, b) => a.start_min - b.start_min);
      for (let i = 1; i < daySlots.length; i++) {
        const gap = daySlots[i].start_min - daySlots[i - 1].end_min;
        if (gap > 120) score -= 60;
        else if (gap > 60)  score -= 30;
        else if (gap > 0)   score -= 5;
      }
    }
  }

  // 紐곗븘?ｊ린?? ?대? ?섏뾽 ?덈뒗 ??媛뺥븯寃??좏샇, ???좎? ?⑤꼸??  if (prefs.has('cluster')) {
    const usedDays = new Set(usedFlat.map(s => s.day));
    cFlat.forEach(s => {
      if (usedDays.has(s.day)) score += 50;
      else                     score -= 30;
    });
  }

  // ?먮꼸??遺꾩궛?? ?덈줈???붿씪 媛뺥븯寃??좏샇
  if (prefs.has('spread')) {
    const usedDays = new Set(usedFlat.map(s => s.day));
    cFlat.forEach(s => {
      if (!usedDays.has(s.day)) score += 40;
      else                      score -= 15;
    });
  }

  return score;
}

/* ?? 怨쇰ぉ紐??뺢퇋??(?????쒓굅, 以묐났 諛⑹??? ?? */
function normName(name) {
  return name.replace(/??g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/* ?? 湲곕낯 怨쇰ぉ紐?異붿텧 (愿꾪샇 ?ㅻ챸, ???쒓굅 ???섍컯?꾨즺 鍮꾧탳?? ?? */
function baseName(name) {
  return name
    .replace(/??g, '')
    .replace(/\s*\([^)]*\)\s*/g, '') // (愿꾪샇 ?댁슜) ?꾩껜 ?쒓굅
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/* ?? 湲곗큹援먯뼇 ?꾩닔 ?댁닔 洹몃９ (?꾧탳 怨듯넻, subtitle 湲곗?)
   subtitles 諛곗뿴: ?곕룄蹂꾨줈 subtitle???ㅻ? ???덉뼱 蹂듭닔 吏??   - 2026: AI?듯빀湲곗큹 / 2025: SW?듯빀湲곗큹(subtitle?놁쓬, name fallback) / 2024: subtitle?놁쓬
   ?? */
const REQUIRED_LIBERAL_GROUPS = [
  { label: '誘몃옒?ㅺ퀎',       picks: 1, subtitles: ['誘몃옒?ㅺ퀎'],                        minCredits: 1 },
  { label: 'AI?듯빀湲곗큹',     picks: 1, subtitles: ['AI?듯빀湲곗큹', 'SW?듯빀湲곗큹'],         minCredits: 3 },
  { label: '?대┛?ш퀬??쒗쁽', picks: 1, subtitles: ['?대┛?ш퀬??쒗쁽'],                   minCredits: 3 },
  { label: '湲濡쒕쾶?섏궗?뚰넻', picks: 1, subtitles: ['湲濡쒕쾶?섏궗?뚰넻'],                   minCredits: 2 },
];
// subtitle ?⑥닔 ?묎렐 ?명솚 (湲곗〈 肄붾뱶?먯꽌 .subtitle ?ъ슜?섎뒗 怨??鍮?
REQUIRED_LIBERAL_GROUPS.forEach(g => { g.subtitle = g.subtitles[0]; });

/* ?? 洹좏삎援먯뼇 ?꾩닔 ?곸뿭 (4媛??곸뿭 媛?1怨쇰ぉ ?댁긽) ?? */
const REQUIRED_GYUNHYUNG_AREAS = [
  '?붿??몄빱裕ㅻ땲耳?댁뀡',
  '?몃Ц?덉닠',
  '?ы쉶?臾명솕',
  '?먯뿰怨쇳븰湲곗닠?섏씠??,
];

/* ?? 援먯뼇 ?댁닔 湲곗? (?꾧탳 怨듯넻) ?? */
const LIBERAL_REQ = {
  湲곗큹援먯뼇: 9,   // 誘몃옒?ㅺ퀎1 + AI?듯빀湲곗큹3 + ?대┛?ш퀬??쒗쁽3 + 湲濡쒕쾶?섏궗?뚰넻2
  洹좏삎援먯뼇: 12,  // 4媛??곸뿭 媛?1怨쇰ぉ ?댁긽
  ?뺣?援먯뼇: 0,   // ?먯쑉?댁닔
  total: 34,
};

/* ?? 怨쇰ぉ???대뒓 ?꾩닔 洹몃９???랁븯?붿? 諛섑솚 ?? */
function getRequiredGroup(course) {
  if (course.type !== 'liberal' || course.category !== '湲곗큹援먯뼇') return null;
  const g = REQUIRED_LIBERAL_GROUPS.find(x =>
    x.subtitles.some(s => s && course.subtitle === s)
  );
  return g ? g.label : null;
}

/* ?대떦 ?숇뀈???섍컯 媛?ν븳吏 ?먮떒
   - eligible_years 誘몄꽕?? 紐⑤뱺 ?숇뀈 ?덉슜
   - eligible_years ?ㅼ젙?? grade ?댄븯???숇뀈???섎굹?쇰룄 ?ы븿?섎㈃ ?덉슜
     ??4?숇뀈? 1쨌2쨌3?숇뀈 怨쇰ぉ???ㅼ쓣 ???덇퀬,
       1?숇뀈? 2쨌3쨌4?숇뀈 ?꾩슜 怨쇰ぉ? 異붿쿇諛쏆? ?딆쓬 */
function gradeOk(course, grade) {
  if (!course.eligible_years?.length) return true;
  return course.eligible_years.some(y => y <= grade);
}

/* ?? ?숇뀈蹂?援먯뼇 ? ?? */
function getLiberalPool(grade) {
  return _allCourses.filter(c => {
    if (c.type !== 'liberal') return false;
    return gradeOk(c, grade);
  });
}

/* ?? ??媛吏 ?쒓컙??蹂???앹꽦 ?? */
function generateVariant(state, { grade, prefs, inclRequired, inclElective, inclLiberal, shuffleSeed = 0 }) {
  const dept      = state.department || '';
  const maxCr     = state.maxCredits || 18;
  const completed = new Set((state.completedCourses || []).map(n => n.trim().toLowerCase()));
  const excluded  = new Set((state.excludedCourses  || []).map(n => n.trim().toLowerCase()));
  const retake    = new Set((state.retakeCourses    || []).map(n => n.trim().toLowerCase()));
  const pastNames = getPastTimetableCourseNames(state); // 吏???숆린 ?쒓컙??怨쇰ぉ
  const allowRtk  = state.allowRetake || false;

  let schedule = [];
  let usedFlat = [];
  let totalCr  = 0;

  /* ?섍컯?꾨즺 怨쇰ぉ ?쒖쇅 (?ъ닔媛??덉슜 ???ы븿, ?ъ닔媛??꾩슂 ?쒖떆 ???쒖쇅?먯꽌 ?쒖쇅) */
  const isCompleted = (course) => {
    if (allowRtk) return false;
    const lower = course.name.trim().toLowerCase();
    const norm  = normName(course.name);
    const base  = baseName(course.name);
    // ?ъ닔媛??꾩슂 怨쇰ぉ? ?댁닔?꾨즺濡?泥섎━?섏? ?딆쓬
    if (retake.has(lower) || retake.has(norm) || retake.has(base)) return false;
    // ?섎룞 ?꾨즺 ?먮뒗 吏???숆린 ?먮룞 ?꾨즺 怨쇰ぉ
    return completed.has(lower) || completed.has(norm) || completed.has(base)
        || pastNames.has(lower);
  };

  /* ?쒖쇅 怨쇰ぉ 泥댄겕 */
  const isExcluded = (course) => (
    excluded.has(course.name.trim().toLowerCase()) ||
    excluded.has(normName(course.name)) ||
    excluded.has(baseName(course.name))
  );

  /* 異붽? 媛???щ? ?먮떒 */
  const canAdd = (course) => {
    const cr = Number(course.credits) || 0;
    if (cr === 0) return false;
    if (course.type === '援먯쭅' || course.category === '援먯쭅') return false;
    if (isCompleted(course)) return false;
    if (isExcluded(course)) return false;
    if (totalCr + cr > maxCr) return false;
    const cFlat = courseToFlat(course);
    // ?⑤씪??鍮꾨?硫? 怨쇰ぉ? ?щ’???놁뼱??異붽? 媛??(?쒓컙 異⑸룎 ?놁쓬)
    if (!cFlat.length && !course.online) return false;
    if (cFlat.length && flatConflict(cFlat, usedFlat)) return false;
    // ???뺢퇋??+ 愿꾪샇 ?ㅻ챸 ?쒓굅: 媛숈? 怨쇰ぉ紐?以묐났 諛⑹?
    if (schedule.some(s =>
      normName(s.name) === normName(course.name) ||
      baseName(s.name) === baseName(course.name)
    )) return false;
    // 媛숈? ?꾩닔 洹몃９?먯꽌 ?대? 1怨쇰ぉ ?댁닔??寃쎌슦 異붽? 李⑤떒 (?? picks > 1??洹몃９ ?쒖쇅)
    const grp = getRequiredGroup(course);
    if (grp) {
      const g = REQUIRED_LIBERAL_GROUPS.find(x => x.label === grp);
      const alreadyInGroup = schedule.filter(s => getRequiredGroup(s) === grp).length;
      if (g && alreadyInGroup >= g.picks) return false;
    }
    return true;
  };

  /* 怨쇰ぉ 異붽? */
  const addCourse = (course) => {
    schedule.push(course);
    usedFlat.push(...courseToFlat(course));
    totalCr += Number(course.credits) || 0;
  };

  /* 媛꾨떒??seeded PRNG (mulberry32 怨꾩뿴) */
  let _rngState = shuffleSeed * 2654435761 >>> 0 || 1;
  const rng = () => {
    _rngState ^= _rngState << 13; _rngState ^= _rngState >> 17; _rngState ^= _rngState << 5;
    return ((_rngState >>> 0) / 4294967296);
  };

  // ?ㅽ????놁씠 ?좏깮?????ъ슜?섎뒗 鍮?prefs (1쨌2?④퀎??
  const NOSTYLE = new Set();

  /* ??먯꽌 踰좎뒪???뱀뀡 ?좏깮 ??sp(stylePrefs) 湲곕낯媛?= prefs(?ㅽ????곸슜) */
  /* ?곸쐞 N媛??꾨낫 以??쒕뜡 ?좏깮 (seed=0?대㈃ ??긽 1???뺤젙) */
  const pickRandom = (scored) => {
    if (!shuffleSeed || scored.length <= 1) return scored[0].c;
    // ?곸쐞 min(6, ?꾩껜??40%) 媛?以?洹좊벑 ?쒕뜡
    const topN = Math.max(2, Math.min(6, Math.ceil(scored.length * 0.4)));
    return scored[Math.floor(rng() * topN)].c;
  };

  const pickBest = (pool, sp = prefs) => {
    const valid = pool.filter(canAdd);
    if (!valid.length) return null;
    const scored = valid
      .map(c => ({ c, s: scoreCourse(c, usedFlat, sp) }))
      .sort((a, b) => b.s - a.s);
    return pickRandom(scored);
  };

  /* ?꾩껜 pool?먯꽌 ?ㅽ???媛以??쒕뜡 (湲곗큹援먯뼇쨌洹좏삎援먯뼇 洹몃９ ?좏깮???ъ슜)
     ?ㅽ??쇱씠 ?놁쑝硫??쒖닔 洹좊벑 ?쒕뜡, ?덉쑝硫??ㅽ????먯닔 鍮꾨? 媛以?*/
  const pickBestFull = (pool) => {
    const valid = pool.filter(canAdd);
    if (!valid.length) return null;
    if (valid.length === 1) return valid[0];
    if (!prefs.size) return valid[Math.floor(rng() * valid.length)];
    // ?ㅽ????먯닔 ??媛以묒튂 (?뚯닔?щ룄 理쒖냼 0.05 蹂댁옣)
    const scored = valid.map(c => ({
      c, w: Math.max(0.05, 1 + scoreCourse(c, usedFlat, prefs) * 0.025)
    }));
    const totalW = scored.reduce((s, x) => s + x.w, 0);
    let rand = rng() * totalW;
    for (const item of scored) { rand -= item.w; if (rand <= 0) return item.c; }
    return scored[scored.length - 1].c;
  };

  /* 怨쇰ぉ紐낆쑝濡?臾띠뼱??踰좎뒪???뱀뀡留?異붽? ??sp 湲곕낯媛?= prefs */
  const addPoolByName = (pool, sp = prefs) => {
    const nameMap = new Map();
    for (const c of pool) {
      const key = baseName(c.name);
      if (!nameMap.has(key)) nameMap.set(key, []);
      nameMap.get(key).push(c);
    }
    // 怨쇰ぉ紐??쒖꽌??seed ?덉쑝硫??뷀뵆
    const keys = [...nameMap.keys()];
    if (shuffleSeed) keys.sort(() => rng() - 0.5);
    for (const key of keys) {
      if (totalCr >= maxCr) break;
      const best = pickBest(nameMap.get(key), sp);
      if (best) addCourse(best);
    }
  };

  /* 怨쇰ぉ ?꾩껜瑜??ㅼ퐫?댁닚?쇰줈 異붽? ??sp 湲곕낯媛?= prefs */
  const addPoolGreedy = (pool, sp = prefs) => {
    const usedBaseNames = new Set(schedule.map(c => baseName(c.name)));
    // 怨쇰ぉ紐낅퀎濡?理쒓퀬 ?뱀뀡留??④린怨??ㅼ퐫???뺣젹
    const nameMap = new Map();
    for (const c of pool.filter(c => !usedBaseNames.has(baseName(c.name)) && canAdd(c))) {
      const key = baseName(c.name);
      const s = scoreCourse(c, usedFlat, sp);
      if (!nameMap.has(key) || s > nameMap.get(key).s) nameMap.set(key, { c, s });
    }
    let candidates = [...nameMap.values()].sort((a, b) => b.s - a.s);

    // seed ?덉쑝硫??곸쐞 40% ?대궡 怨쇰ぉ?ㅼ쓣 ?뷀뵆?댁꽌 ?ㅼ뼇???뺣낫
    if (shuffleSeed && candidates.length > 1) {
      const cutIdx = Math.max(2, Math.ceil(candidates.length * 0.4));
      const top    = candidates.slice(0, cutIdx).sort(() => rng() - 0.5);
      const rest   = candidates.slice(cutIdx);
      candidates   = [...top, ...rest];
    }

    const seenInRound = new Set();
    for (const { c } of candidates) {
      if (totalCr >= maxCr) break;
      if (seenInRound.has(baseName(c.name))) continue;
      if (canAdd(c)) {
        addCourse(c);
        seenInRound.add(baseName(c.name));
      }
    }
  };

  // ??濡쒕뱶留?怨쇰ぉ ?곗꽑 媛뺤젣 ?ы븿 (?대떦 ?숇뀈쨌?숆린 ?댁닔泥닿퀎??怨쇰ぉ)
  const semNum = String(state.semester || '1?숆린').replace('?숆린','').trim();
  const roadmapNames = getRoadmapCourses(dept, grade, semNum);
  if (roadmapNames.length) {
    const usedBase = new Set(schedule.map(c => baseName(c.name)));
    for (const name of roadmapNames) {
      if (totalCr >= maxCr) break;
      const bn = baseName(name);
      if (usedBase.has(bn)) continue;
      // 媛숈? ?대쫫??怨쇰ぉ 紐⑤뱺 遺꾨컲 以?異붽? 媛?ν븳 寃??좏깮 (shuffleSeed濡?蹂??
      // ?꾧났 怨쇰ぉ? ???숆낵 寃껊쭔 ?덉슜, 援먯뼇 怨쇰ぉ? ?숆낵 臾닿?
      const candidates = _allCourses.filter(c =>
        baseName(c.name) === bn && canAdd(c) &&
        (c.type !== 'major' || !dept || c.department === dept) &&
        gradeOk(c, grade)
      );
      if (!candidates.length) continue;
      // ?쒓컙 異⑸룎 ?녿뒗 ?꾨낫 以??좏깮 ???댁닔泥닿퀎?꾨뒗 ?ㅽ????놁씠 (NOSTYLE)
      const valid = candidates.filter(c => !checkConflict(c, schedule));
      if (!valid.length) continue;
      const picked = valid.sort((a, b) =>
        scoreCourse(b, usedFlat, NOSTYLE) - scoreCourse(a, usedFlat, NOSTYLE)
      )[shuffleSeed ? Math.floor(rng() * Math.min(valid.length, 2)) : 0];
      if (picked) { addCourse(picked); usedBase.add(bn); }
    }
  }

  // ???꾧났?꾩닔 (濡쒕뱶留듭뿉 ?녿뒗 寃? ???ㅽ????놁씠
  if (inclRequired) {
    const req = _allCourses.filter(c =>
      c.type === 'major' && c.category === '?꾧났?꾩닔' &&
      c.department === dept && gradeOk(c, grade)
    );
    addPoolByName(req, NOSTYLE);
  }

  // ???꾧났?좏깮
  const fillElective = () => {
    if (!inclElective || totalCr >= maxCr) return;
    const elec = _allCourses.filter(c =>
      c.type === 'major' && c.category === '?꾧났?좏깮' &&
      c.department === dept && gradeOk(c, grade)
    );
    addPoolGreedy(elec);
  };

  // ??瑗??ｊ퀬 ?띠? 媛뺤쓽 ???ㅽ????놁씠 (?붿껌 怨쇰ぉ?대?濡??ㅽ???臾닿??섍쾶 ?ы븿)
  const fillPinned = () => {
    const pinned = (state.pinnedCourses || []).map(n => n.trim().toLowerCase());
    for (const pname of pinned) {
      if (totalCr >= maxCr) break;
      const candidates = _allCourses.filter(c =>
        c.name.trim().toLowerCase() === pname && !flatConflict(courseToFlat(c), usedFlat) &&
        schedule.every(s => normName(s.name) !== normName(c.name)) &&
        gradeOk(c, grade)
      );
      if (!candidates.length) continue;
      // 遺꾨컲 ?좏깮留????ㅽ????놁씠
      const scored = candidates
        .map(c => ({ c, s: scoreCourse(c, usedFlat, NOSTYLE) + (shuffleSeed ? (rng() - 0.5) * 10 : 0) }))
        .sort((a, b) => b.s - a.s);
      addCourse(scored[0].c);
    }
  };

  /* ?? 湲곗큹援먯뼇 ?꾩닔 洹몃９?먯꽌 媛곴컖 1怨쇰ぉ??癒쇱? 梨꾩슦湲??? */
  const fillRequiredLiberalGroups = () => {
    if (!inclLiberal || totalCr >= maxCr) return;
    const liberalPool = getLiberalPool(grade);
    // shuffleSeed媛 ?덉쑝硫?洹몃９ ?쒖꽌???뷀뵆?댁꽌 ?ㅼ뼇???뺣낫
    const groups = shuffleSeed ? [...REQUIRED_LIBERAL_GROUPS].sort(() => rng() - 0.5) : REQUIRED_LIBERAL_GROUPS;
    for (const group of groups) {
      if (totalCr >= maxCr) break;
      const alreadyHas = schedule.some(s => getRequiredGroup(s) === group.label);
      if (alreadyHas) continue;
      const groupPool = liberalPool.filter(c => getRequiredGroup(c) === group.label);
      if (!groupPool.length) continue;
      // shuffleSeed ?덉쑝硫??꾩껜 pool?먯꽌 洹좊벑 ?쒕뜡 (top ?쒗븳 ?놁쓬)
      const best = shuffleSeed ? pickBestFull(groupPool) : pickBest(groupPool, NOSTYLE);
      if (best) addCourse(best);
    }
  };

  /* ?? 洹좏삎援먯뼇 4媛??곸뿭 媛?1怨쇰ぉ 梨꾩슦湲??? */
  const fillRequiredGyunhyungAreas = () => {
    if (!inclLiberal || totalCr >= maxCr) return;
    const liberalPool = getLiberalPool(grade);
    const areas = shuffleSeed ? [...REQUIRED_GYUNHYUNG_AREAS].sort(() => rng() - 0.5) : REQUIRED_GYUNHYUNG_AREAS;
    for (const area of areas) {
      if (totalCr >= maxCr) break;
      const alreadyHas = schedule.some(s => s.type === 'liberal' && s.subtitle === area);
      if (alreadyHas) continue;
      const areaPool = liberalPool.filter(c => c.category === '洹좏삎援먯뼇' && c.subtitle === area);
      if (!areaPool.length) continue;
      const best = shuffleSeed ? pickBestFull(areaPool) : pickBest(areaPool, NOSTYLE);
      if (best) addCourse(best);
    }
  };

  const fillLiberal = () => {
    if (!inclLiberal || totalCr >= maxCr) return;
    addPoolGreedy(getLiberalPool(grade));
  };

  /* ?? 4?쒖쐞 援먯뼇: 媛以묒튂 ?쒕뜡 (留??ㅽ뻾留덈떎 ?ㅻⅨ 怨쇰ぉ 議고빀) ?? */
  const fillLiberalRandom = () => {
    if (!inclLiberal || totalCr >= maxCr) return;

    // ???대? ?댁닔 ?꾨즺??湲곗큹援먯뼇 ?꾩닔 洹몃９ ?뚯븙 (completed + pastNames + ??schedule)
    const doneGichyoGroups = new Set();
    for (const g of REQUIRED_LIBERAL_GROUPS) {
      const inCompleted = _allCourses.some(c =>
        getRequiredGroup(c) === g.label &&
        (completed.has(c.name.trim().toLowerCase()) || pastNames.has(c.name.trim().toLowerCase()))
      );
      const inSchedule = schedule.some(c => getRequiredGroup(c) === g.label);
      if (inCompleted || inSchedule) doneGichyoGroups.add(g.label);
    }

    // ???대? ?댁닔 ?꾨즺??洹좏삎援먯뼇 ?곸뿭 ?뚯븙
    const doneGyunhyungAreas = new Set();
    for (const area of REQUIRED_GYUNHYUNG_AREAS) {
      const inCompleted = _allCourses.some(c =>
        c.category === '洹좏삎援먯뼇' && c.subtitle === area &&
        (completed.has(c.name.trim().toLowerCase()) || pastNames.has(c.name.trim().toLowerCase()))
      );
      const inSchedule = schedule.some(c => c.category === '洹좏삎援먯뼇' && c.subtitle === area);
      if (inCompleted || inSchedule) doneGyunhyungAreas.add(area);
    }

    // ??湲대컯??怨꾩궛: ?⑥? ?숆린 ?鍮?誘몄씠???꾩닔 ?곸뿭 ??    const semOrd = ((grade || 1) - 1) * 2 + (['2?숆린','寃⑥슱?숆린'].includes(state.semester) ? 2 : 1);
    const remainingAfter = Math.max(1, 8 - semOrd);
    const unfulfilledRequired =
      REQUIRED_LIBERAL_GROUPS.filter(g => !doneGichyoGroups.has(g.label)).length +
      REQUIRED_GYUNHYUNG_AREAS.filter(a => !doneGyunhyungAreas.has(a)).length;
    // urgency 0~4: ?⑥? ?숆린蹂대떎 誘몄씠?섍? 留롮쓣?섎줉 ?щ씪媛?    const urgency = Math.min(4, unfulfilledRequired / remainingAfter);

    // ??媛以묒튂: 湲대컯?꾩뿉 鍮꾨??댁꽌 ?꾩닔 ?곸뿭 媛以묒튂 ?ㅼ??쇱뾽
    //    urgency=0 ??湲곗큹援먯뼇횞3, 洹좏삎援먯뼇횞2 (湲곕낯)
    //    urgency=4 ??湲곗큹援먯뼇횞15, 洹좏삎援먯뼇횞10 (嫄곗쓽 媛뺤젣)
    const getWeight = (c) => {
      const grp = getRequiredGroup(c);
      if (grp) return doneGichyoGroups.has(grp) ? 0.5 : 3 * (1 + urgency);
      if (c.category === '洹좏삎援먯뼇' && c.subtitle)
        return doneGyunhyungAreas.has(c.subtitle) ? 0.5 : 2 * (1 + urgency);
      return 1;
    };

    // ???좏슚 媛以묒튂 怨꾩궛: 議몄뾽 媛以묒튂 횞 ?ㅽ???諛곗쑉
    //    ?ㅽ????먯닔 踰붿쐞 ???-100~+100 ??諛곗쑉 0.05~3.5
    //    ?ㅽ????놁쑝硫?諛곗쑉 1.0 (議몄뾽 媛以묒튂 洹몃?濡?
    const effectiveW = (c) => {
      const gw = getWeight(c);                              // 議몄뾽 媛以묒튂
      if (!prefs.size) return gw;
      const ss = scoreCourse(c, usedFlat, prefs);           // ?ㅽ????먯닔
      const multiplier = Math.max(0.05, 1 + ss * 0.025);   // ?ㅽ???諛곗쑉
      return gw * multiplier;
    };

    // ??怨쇰ぉ紐?湲곗? dedup ??媛숈? ?대쫫 以??좏슚媛以묒튂 ?믪? ?뱀뀡 ?좏깮
    const pool = getLiberalPool(grade);
    const nameMap = new Map();
    for (const c of pool) {
      if (!canAdd(c)) continue;
      const key = baseName(c.name);
      const ew  = effectiveW(c);
      const cur = nameMap.get(key);
      if (!cur || ew > cur.ew) nameMap.set(key, { c, ew });
    }

    // ???좏슚媛以묒튂 湲곕컲 ?쒕뜡 ?좏깮 ????怨쇰ぉ??戮묒븘??異붽?
    const candidates = [...nameMap.values()];
    while (totalCr < maxCr && candidates.length > 0) {
      const available = candidates.filter(({ c }) => canAdd(c));
      if (!available.length) break;

      // canAdd ?ы솗?????좏슚媛以묒튂 ?ш퀎??(?쒓컙??蹂??諛섏쁺)
      const weighted = available.map(({ c }) => ({ c, ew: effectiveW(c) }));
      const totalW = weighted.reduce((sum, x) => sum + x.ew, 0);
      if (totalW <= 0) break;

      let rand = rng() * totalW;
      let picked = weighted[weighted.length - 1];
      for (const item of weighted) { rand -= item.ew; if (rand <= 0) { picked = item; break; } }

      if (canAdd(picked.c)) addCourse(picked.c);

      // candidates?먯꽌 ?숈씪 怨쇰ぉ(baseName 湲곗?) ?쒓굅
      const pickedKey = baseName(picked.c.name);
      const idx = candidates.findIndex(x => baseName(x.c.name) === pickedKey);
      if (idx !== -1) candidates.splice(idx, 1);
    }
  };

  /* ?? ?숆낵 沅뚯옣 洹좏삎援먯뼇 怨쇰ぉ ?곗꽑 梨꾩슦湲????ㅽ????놁씠 ?? */
  const recLibNames = new Set(
    (_gradReqs?.[dept]?.recommended_liberal || []).map(r => baseName(r.name))
  );
  const fillRecommendedLiberal = () => {
    if (!inclLiberal || totalCr >= maxCr || !recLibNames.size) return;
    const pool = getLiberalPool(grade).filter(c =>
      recLibNames.has(baseName(c.name))
    );
    addPoolByName(pool, NOSTYLE);   // 沅뚯옣援먯뼇? ?ㅽ????놁씠
  };

  /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
     ?먮룞 ?앹꽦 ?곗꽑?쒖쐞:
       1?④퀎 (?ㅽ????놁쓬): ?꾧났 ?댁닔泥닿퀎?????꾧났?꾩닔 ??瑗??ｊ퀬?띠? 媛뺤쓽
       2?④퀎 (?ㅽ????놁쓬): ?숆낵 沅뚯옣援먯뼇
       3?④퀎 (?ㅽ????곸슜): 議몄뾽?붽굔 湲곗큹援먯뼇 ??洹좏삎援먯뼇 ???섎㉧吏(?꾧났?좏깮/援먯뼇)
     ?쒓컙???ㅽ????꾩묠?뚰뵾, 紐곗븘?ｊ린 ??? 3?④퀎?먯꽌留??묐룞
     ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */

  // 1?④퀎: ?댁닔泥닿퀎???졻몼) ?대? ?꾨즺 ??瑗??ｊ퀬 ?띠? 媛뺤쓽
  fillPinned();

  // 2?④퀎: ?숆낵 沅뚯옣援먯뼇 (?ㅽ???臾닿?)
  fillRecommendedLiberal();

  // 3?④퀎: 議몄뾽?붽굔 援먯뼇 (?ㅽ????곸슜 ?쒖옉)
  fillRequiredLiberalGroups();    // 湲곗큹援먯뼇 ?꾩닔 4媛??곸뿭
  fillRequiredGyunhyungAreas();   // 洹좏삎援먯뼇 4媛??곸뿭

  // ?섎㉧吏 ?숈젏: ?꾧났?곗꽑 ?ㅽ??쇱씠硫??꾧났?좏깮 癒쇱?, ?꾨땲硫?援먯뼇 癒쇱?
  // liberal_req_first ?ㅽ??? ?쒕뜡 ?놁씠 ?꾩닔 ?곸뿭 媛뺤젣 梨꾩슦湲?(議몄뾽 珥됰컯 ??
  // shuffleSeed=0(異붿쿇 A): 寃곗젙濡좎쟻 理쒖쟻
  // 洹??? 湲대컯??諛섏쁺 媛以묒튂 ?쒕뜡
  const _fillLib = (prefs.has('liberal_req_first') || !shuffleSeed) ? fillLiberal : fillLiberalRandom;
  if (prefs.has('major_first')) {
    fillElective();
    _fillLib();
  } else {
    _fillLib();
    fillElective();
  }

  // ??理쒖쥌 ?숈젏 梨꾩슦湲?fallback
  // ???④퀎?먯꽌 ?쒓컙 異⑸룎 ?깆쑝濡??숈젏????梨꾩썙吏?寃쎌슦,
  // ?ㅽ???媛以묒튂 ?놁씠 ?⑥? ?먮━瑜?理쒕???梨꾩?
  if (totalCr < maxCr) {
    addPoolGreedy(getLiberalPool(grade), NOSTYLE);  // ?⑥? 援먯뼇 greedy
    if (totalCr < maxCr) {
      const elecPool = _allCourses.filter(c =>
        c.type === 'major' && c.department === dept && gradeOk(c, grade)
      );
      addPoolGreedy(elecPool, NOSTYLE);             // ?⑥? ?꾧났 greedy
    }
  }

  return schedule;
}

/* ?? ?쒓컙???붿빟 ?뺣낫 怨꾩궛 ?? */
function summarizeSchedule(schedule) {
  const totalCr  = schedule.reduce((s, c) => s + (Number(c.credits) || 0), 0);
  const flat     = schedule.flatMap(courseToFlat);
  const daysUsed = new Set(flat.map(s => s.day)).size;

  // 媛???대Ⅸ ?쒖옉
  const earliest = flat.length ? Math.min(...flat.map(s => s.start_min)) : 0;
  const h = Math.floor(earliest / 60), m = earliest % 60;
  const earliestStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

  // 理쒕? 怨듦컯
  let maxGap = 0;
  for (let day = 0; day < 5; day++) {
    const ds = flat.filter(s => s.day === day).sort((a,b) => a.start_min - b.start_min);
    for (let i = 1; i < ds.length; i++) {
      maxGap = Math.max(maxGap, ds[i].start_min - ds[i-1].end_min);
    }
  }

  return { totalCr, daysUsed, earliestStr, maxGap };
}

/* ?? 湲대컯??寃쎄퀬 諛곕꼫 ?뚮뜑留??? */
function renderUrgencyWarning(urgency, unfull, remain, isReqFirstOn) {
  const wrap = document.getElementById('autoResults');
  const existing = document.getElementById('urgencyBanner');
  if (existing) existing.remove();
  if (!wrap) return;

  // urgency < 0.8 ?대㈃ 寃쎄퀬 ?놁쓬
  if (urgency < 0.8 || unfull === 0) return;

  let level, icon, msg;
  if (urgency >= 2) {
    // 留ㅼ슦 ?꾪뿕: ?⑥? ?숆린蹂대떎 誘몄씠?섍? 2諛??댁긽
    level = 'danger';
    icon  = '?슚';
    msg   = `議몄뾽源뚯? <strong>${remain}?숆린</strong> ?⑥븯?붾뜲 ?꾩닔 援먯뼇??<strong>${unfull}媛??곸뿭</strong> 誘몄씠?섏엯?덈떎. 吏湲?諛붾줈 梨꾩슦吏 ?딆쑝硫??꾪뿕?⑸땲??`;
  } else if (urgency >= 1) {
    // 寃쎄퀬: ?⑥? ?숆린? 誘몄씠?섍? 鍮꾩듂
    level = 'warn';
    icon  = '?좑툘';
    msg   = `議몄뾽源뚯? <strong>${remain}?숆린</strong> ?⑥븯怨??꾩닔 援먯뼇??<strong>${unfull}媛??곸뿭</strong> 誘몄씠?섏엯?덈떎. 留??숆린 1~2媛쒖뵫 梨꾩썙???⑸땲??`;
  } else {
    // 二쇱쓽
    level = 'info';
    icon  = '?뱥';
    msg   = `?꾩닔 援먯뼇 <strong>${unfull}媛??곸뿭</strong>???꾩쭅 誘몄씠?섏엯?덈떎. 袁몄???梨꾩썙媛?몄슂.`;
  }

  const hint = isReqFirstOn
    ? `<span class="ub-hint">??'援먯뼇 議몄뾽?붽굔 ?곗꽑' ?듭뀡??耳쒖졇 ?덉뒿?덈떎.</span>`
    : `<span class="ub-hint">?뮕 ?ㅽ??쇱뿉??<strong>援먯뼇 議몄뾽?붽굔 ?곗꽑</strong>???좏깮?섎㈃ ?꾩닔 ?곸뿭??媛뺤젣 諛곗젙?⑸땲??</span>`;

  const banner = document.createElement('div');
  banner.id = 'urgencyBanner';
  banner.className = `urgency-banner urgency-${level}`;
  banner.innerHTML = `<span class="ub-icon">${icon}</span><div class="ub-body"><p>${msg}</p>${hint}</div>`;
  wrap.before(banner);
}

/* ?? ?먮룞 ?앹꽦 寃곌낵 ?뚮뜑留??? */
function renderAutoResults(variants, state) {
  const wrap   = document.getElementById('autoResults');
  const grid   = document.getElementById('autoResultsGrid');
  const desc   = document.getElementById('autoResultsDesc');
  if (!wrap || !grid) return;

  if (!variants.length || variants.every(v => !v.schedule.length)) {
    wrap.classList.remove('hidden');
    grid.innerHTML = `<div class="auto-empty">
      ?좏깮??議곌굔?쇰줈 ?앹꽦???쒓컙?쒓? ?놁뒿?덈떎.<br>
      <small>?숈젏 ?쒕룄瑜??믪씠嫄곕굹 ?ы븿 ?듭뀡???뺤씤??二쇱꽭??</small>
    </div>`;
    desc.textContent = '';
    return;
  }

  const labels = ['異붿쿇 A', '異붿쿇 B', '異붿쿇 C'];
  const labelIcons = ['?쪍', '?쪎', '?쪏'];

  grid.innerHTML = variants.map((v, i) => {
    const { totalCr, daysUsed, earliestStr, maxGap } = summarizeSchedule(v.schedule);
    const colorMap = buildColorMap(v.schedule);
    const flat     = v.schedule.flatMap(courseToFlat);

    // 誘몃땲 ?쒓컙??HTML
    const dayCol = 60, hourH = 36, timeColW = 32;
    const baseMin = timeToMin('09:00');
    const hours   = HOUR_ROWS;

    let gridCells = '';
    hours.forEach(t => {
      gridCells += `<div class="rt-time">${t}</div>`;
      for (let d = 0; d < 5; d++) gridCells += `<div class="rt-cell"></div>`;
    });

    let blocks = '';
    flat.forEach(slot => {
      if (slot.start_min < baseMin || slot.end_min > timeToMin('18:00')) return;
      const topPx    = ((slot.start_min - baseMin) / 60) * hourH;
      const heightPx = ((slot.end_min - slot.start_min) / 60) * hourH;
      const leftPx   = slot.day * dayCol + 1;
      const widthPx  = dayCol - 2;
      const color    = colorMap[flat.find(f => f === slot)?.name] || COLORS[0];
      // ?대쫫 李얘린
      const courseName = v.schedule.find(c =>
        courseToFlat(c).some(f =>
          f.day === slot.day && f.start_min === slot.start_min
        )
      )?.name || '';
      const bg = color?.bg || '#dbe9ff';
      const bd = color?.border || '#8fb1f5';
      blocks += `<div class="rt-block" data-name="${esc(courseName)}" data-variant-idx="${i}" style="left:${leftPx}px;top:${topPx}px;width:${widthPx}px;height:${heightPx - 1}px;background:${bg};border:1px solid ${bd};pointer-events:auto;cursor:pointer;">
        <div class="rt-block-name">${courseName}</div>
      </div>`;
    });

    const gapText = maxGap > 90 ? `理쒕? 怨듦컯 ${Math.round(maxGap/60*10)/10}h` : '怨듦컯 ?곸쓬';

    return `
      <div class="result-card" data-variant="${i}">
        <div class="result-card-head">
          <div class="result-label">${labelIcons[i]} ${labels[i]}</div>
          <div class="result-tag-row">
            <span class="result-tag">${totalCr}?숈젏</span>
            <span class="result-tag">${daysUsed}???섏뾽</span>
            <span class="result-tag">${earliestStr} ?쒖옉</span>
            <span class="result-tag">${gapText}</span>
          </div>
        </div>

        <!-- ?몃씪??誘몃땲 ?쒓컙??-->
        <div class="result-tt">
          <div class="rt-header">
            <div class="rt-corner">?쒓컙</div>
            ${DAY_NAMES.map(d => `<div class="rt-day">${d}</div>`).join('')}
          </div>
          <div class="rt-body">
            <div class="rt-grid" style="grid-template-columns:${timeColW}px repeat(5,${dayCol}px)">
              ${gridCells}
            </div>
            <div class="rt-layer" style="left:${timeColW}px">${blocks}</div>
          </div>
        </div>

        <!-- 怨쇰ぉ 紐⑸줉 -->
        <div class="result-course-list">
          ${v.schedule.map(c => `
            <div class="result-course-item" data-name="${esc(c.name)}" data-variant-idx="${i}">
              <span class="result-course-name">${c.name}</span>
              <span class="cat-badge cat-${catClass(c.category)} small">${c.category}</span>
              <span class="result-course-credit">${c.credits}?숈젏</span>
              <button class="result-course-add-btn" data-name="${esc(c.name)}" data-variant-idx="${i}" type="button" title="?닿린">竊뗫떞湲?/button>
              <button class="result-course-exc-btn" data-name="${esc(c.name)}" type="button" title="異붿쿇 ?쒖쇅">?슟</button>
              <button class="result-course-info-btn" data-name="${esc(c.name)}" type="button" title="?곸꽭 ?뺣낫">??/button>
            </div>
          `).join('')}
        </div>

        <button class="result-apply-btn primary-btn full" data-variant="${i}" type="button">
          ???쒓컙???곸슜?섍린
        </button>
      </div>
    `;
  }).join('');

  desc.textContent = `${_autoGrade}?숇뀈 湲곗? 쨌 理쒕? ${state.maxCredits}?숈젏`;
  wrap.classList.remove('hidden');
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // ?곸슜 踰꾪듉 ?대깽??  grid.querySelectorAll('.result-apply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.variant);
      _selected = [...variants[idx].schedule];
      renderSelectedList();
      renderMiniTimetable();
      renderCourseList();
      syncResultAddButtons();
      document.getElementById('miniTimetable')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // 怨쇰ぉ 紐⑸줉 ??竊뗫떞湲?踰꾪듉 ?좉? (?닿린 ???댁젣)
  grid.querySelectorAll('.result-course-add-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const vIdx   = Number(btn.dataset.variantIdx);
      const cName  = btn.dataset.name;
      const course = variants[vIdx]?.schedule.find(c => c.name === cName);
      if (course) toggleCourseFromResult(course, btn);
    });
  });

  // 怨쇰ぉ 紐⑸줉 ???슟 ?쒖쇅 踰꾪듉 ?대┃
  grid.querySelectorAll('.result-course-exc-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      excludeCourseFromResult(btn.dataset.name);
    });
  });

  // 怨쇰ぉ 紐⑸줉 ????踰꾪듉 ?대┃ ???곸꽭 ?앹뾽
  grid.querySelectorAll('.result-course-info-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      showCourseInfoPopup(btn.dataset.name);
    });
  });

  // rt-block 醫뚰겢由???媛뺤쓽 ?뺣낫 + ?꾩튂 吏??紐⑤떖
  grid.querySelectorAll('.rt-block').forEach(block => {
    block.addEventListener('click', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const vIdx   = Number(block.dataset.variantIdx);
      const cName  = block.dataset.name;
      const course = variants[vIdx]?.schedule.find(c => c.name === cName);
      showBlockInfoModal(cName, course);
    });
  });

  // rt-block ?고겢由???而⑦뀓?ㅽ듃 硫붾돱 (?닿린/?댁젣 + ?쒖쇅 + ?섍컯?꾨즺)
  grid.querySelectorAll('.rt-block').forEach(block => {
    block.addEventListener('contextmenu', e => {
      e.preventDefault();
      const vIdx   = Number(block.dataset.variantIdx);
      const cName  = block.dataset.name;
      const course = variants[vIdx]?.schedule.find(c => c.name === cName);
      showResultContextMenu(e.clientX, e.clientY, cName, course);
    });
  });
}

/* ?? 異붿쿇 ?쒓컙???닿린 踰꾪듉 ?좉? (?닿린 ???댁젣) ?? */
function toggleCourseFromResult(course, btnEl) {
  if (!course) return;
  const idx = _selected.findIndex(s => s.name === course.name && s.section === course.section);

  if (idx >= 0) {
    // ?대? ?닿꺼?덉쑝硫????댁젣
    _selected.splice(idx, 1);
    renderCourseList();
    renderSelectedList();
    renderMiniTimetable();
    if (_gradReqs && _currentState) renderGradReq(_currentState);
    syncResultAddButtons();
    showToast(`"${course.name}" ?닿린 ?댁젣`);
  } else {
    // ?놁쑝硫????닿린
    const conflict = checkConflict(course, _selected);
    if (conflict) {
      showToast(`???쒓컙 異⑸룎: "${conflict}"? 寃뱀퀜 ?댁쓣 ???놁뒿?덈떎.`);
      return;
    }
    _selected.push(course);
    renderCourseList();
    renderSelectedList();
    renderMiniTimetable();
    if (_gradReqs && _currentState) renderGradReq(_currentState);
    syncResultAddButtons();
    showToast(`"${course.name}" ?댁븯?듬땲????);
  }
}

/* ?? 異붿쿇 移대뱶???닿린 踰꾪듉 ?곹깭瑜?_selected 湲곗??쇰줈 ?숆린???? */
function syncResultAddButtons() {
  document.querySelectorAll('.result-course-add-btn').forEach(btn => {
    const cName = btn.dataset.name;
    const isIn  = _selected.some(s => s.name === cName);
    btn.classList.toggle('active', isIn);
    btn.textContent = isIn ? '?볥떞源' : '竊뗫떞湲?;
  });
  // rt-block?먮룄 ?닿릿 ?곹깭 ?쒖떆
  document.querySelectorAll('.rt-block').forEach(block => {
    const isIn = _selected.some(s => s.name === block.dataset.name);
    block.classList.toggle('rt-block--added', isIn);
  });
}

/* ?? 異붿쿇 ?쒓컙?쒖뿉??怨쇰ぉ ?쒖쇅 泥섎━ (怨듯넻) ?? */
function excludeCourseFromResult(courseName) {
  if (!courseName || !_currentState) return;
  const idx = _currentState.excludedCourses.indexOf(courseName);
  if (idx >= 0) {
    // ?대? ?쒖쇅 以????댁젣
    _currentState.excludedCourses.splice(idx, 1);
    saveState(_currentState);
    setupExcludedCourses(_currentState);
    syncResultExcButtons();
    showToast(`"${courseName}" ?쒖쇅 ?댁젣?먯뒿?덈떎.`);
  } else {
    // ?놁쑝硫????쒖쇅 異붽?
    _currentState.excludedCourses.push(courseName);
    saveState(_currentState);
    setupExcludedCourses(_currentState);
    // ?쒖쇅 ?⑤꼸 ?쇱튂湲?    const body    = document.getElementById('excludedBody');
    const chevron = document.getElementById('excludedChevron');
    if (body?.classList.contains('hidden')) {
      body.classList.remove('hidden');
      if (chevron) chevron.textContent = '??;
    }
    syncResultExcButtons();
    showToast(`"${courseName}" 異붿쿇 ?쒖쇅 紐⑸줉??異붽??덉뒿?덈떎.`);
  }
}

/* ?? 異붿쿇 移대뱶???쒖쇅 踰꾪듉 ?곹깭瑜?excludedCourses 湲곗??쇰줈 ?숆린???? */
function syncResultExcButtons() {
  const excluded = _currentState?.excludedCourses || [];
  document.querySelectorAll('.result-course-exc-btn').forEach(btn => {
    const isExc = excluded.includes(btn.dataset.name);
    btn.classList.toggle('active', isExc);
    btn.textContent = isExc ? '?볦젣?몄쨷' : '?슟';
    btn.title = isExc ? '?쒖쇅 ?댁젣' : '異붿쿇 ?쒖쇅';
  });
}

/* ?? ?먮룞?앹꽦 寃곌낵 怨쇰ぉ ?대┃ ???곸꽭 ?뺣낫 ?앹뾽 ?? */
let _infoPopup = null;
/* ?? 異붿쿇 ?쒓컙??釉붾줉 醫뚰겢由???媛뺤쓽 ?뺣낫 + ?꾩튂 吏??紐⑤떖 ?? */
let _blockInfoModal = null;

function showBlockInfoModal(courseName, courseObj) {
  // 湲곗〈 紐⑤떖 ?リ린
  if (_blockInfoModal) { _blockInfoModal.backdrop.remove(); _blockInfoModal.modal.remove(); _blockInfoModal = null; }

  const course = courseObj || _allCourses.find(c => c.name === courseName);
  if (!course) return;

  const days = ['??,'??,'??,'紐?,'湲?];
  const slotRows = (course.slots || []).map(s =>
    `<div>${days[s.day] || '?'}?붿씪 ${s.start}~${s.end}${s.room ? ' 쨌 ' + s.room : ''}</div>`
  ).join('') || '<div>?쒓컙 ?뺣낫 ?놁쓬</div>';

  // 嫄대Ъ 異붿텧 (吏?꾩슜)
  const rooms = (course.slots || []).map(s => s.room).filter(Boolean);
  const blds  = [...new Set(rooms.map(r => getRoomBuilding(r)).filter(b => b && BUILDING_COORDS[b]))];
  const hasMap = blds.length > 0;

  const isIn = _selected.some(s => s.name === course.name && s.section === course.section);

  const backdrop = document.createElement('div');
  backdrop.className = 'cip-backdrop';

  const modal = document.createElement('div');
  modal.className = 'course-info-popup cip-block-modal';
  modal.innerHTML = `
    <div class="cip-header">
      <span class="cat-badge cat-${catClass(course.category)}">${course.category}</span>
      <button class="cip-close" type="button">??/button>
    </div>
    <div class="cip-name">${course.name}</div>
    <div class="cip-rows">
      <div class="cip-row"><span class="cip-label">?대떦援먯닔</span><span>${course.professor || '誘몄젙'}</span></div>
      <div class="cip-row"><span class="cip-label">?숈젏</span><span>${course.credits}?숈젏</span></div>
      <div class="cip-row"><span class="cip-label">遺꾨컲</span><span>${course.section || '-'}</span></div>
      <div class="cip-row cip-row-slots"><span class="cip-label">?쒓컙/?μ냼</span><span>${slotRows}</span></div>
      ${course.department ? `<div class="cip-row"><span class="cip-label">媛쒖꽕?숆낵</span><span>${course.department}</span></div>` : ''}
    </div>
    ${hasMap
      ? `<div class="cip-map-wrap"><div id="cipMapEl" class="cip-map-el"></div></div>`
      : `<div class="cip-map-none">?룶 媛뺤쓽???꾩튂 ?뺣낫 ?놁쓬 (?⑤씪???먮뒗 誘몄젙)</div>`}
    <div class="cip-actions">
      <button class="cip-add-btn${isIn ? ' active' : ''}" type="button">
        ${isIn ? '???닿? ???대┃ ???댁젣' : '竊??닿린'}
      </button>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  _blockInfoModal = { backdrop, modal };

  const close = () => {
    backdrop.remove(); modal.remove(); _blockInfoModal = null;
  };
  backdrop.addEventListener('click', close);
  modal.querySelector('.cip-close').addEventListener('click', close);

  // ?닿린 踰꾪듉 ?좉?
  modal.querySelector('.cip-add-btn').addEventListener('click', () => {
    toggleCourseFromResult(course, null);
    const btn = modal.querySelector('.cip-add-btn');
    const nowIn = _selected.some(s => s.name === course.name && s.section === course.section);
    btn.classList.toggle('active', nowIn);
    btn.textContent = nowIn ? '???닿? ???대┃ ???댁젣' : '竊??닿린';
  });

  // Leaflet 吏??(嫄대Ъ ?꾩튂)
  if (hasMap) {
    setTimeout(() => {
      const el = document.getElementById('cipMapEl');
      if (!el || typeof L === 'undefined') return;
      const firstCoord = BUILDING_COORDS[blds[0]];
      const map = L.map(el).setView([firstCoord.lat, firstCoord.lng], 17);
      L.tileLayer(OSM_TILE, { attribution: OSM_ATTR, maxZoom: 19 }).addTo(map);
      map.invalidateSize();
      const markers = blds.map(bld => {
        const c = BUILDING_COORDS[bld];
        return L.marker([c.lat, c.lng])
          .bindPopup(`<b>${c.name}</b>`, { closeButton: false, autoClose: false, closeOnClick: false })
          .addTo(map)
          .openPopup();
      });
      if (blds.length > 1) {
        map.fitBounds(blds.map(b => [BUILDING_COORDS[b].lat, BUILDING_COORDS[b].lng]), { padding: [40, 40], maxZoom: 17 });
      }
      const cleanup = () => map.remove();
      backdrop.addEventListener('click', cleanup, { once: true });
      modal.querySelector('.cip-close').addEventListener('click', cleanup, { once: true });
    }, 120);
  }
}

function showCourseInfoPopup(courseName) {
  if (_infoPopup) { _infoPopup.remove(); _infoPopup = null; }
  if (!courseName) return;

  const course = _allCourses.find(c => c.name === courseName);
  if (!course) return;

  const slotText = (course.slots || []).map(s => {
    const days = ['??,'??,'??,'紐?,'湲?];
    return `${days[s.day] || '?'} ${s.start}~${s.end}${s.room ? ' '+s.room : ''}`;
  }).join(', ') || '?쒓컙 ?뺣낫 ?놁쓬';

  const popup = document.createElement('div');
  popup.className = 'course-info-popup';
  popup.innerHTML = `
    <div class="cip-header">
      <span class="cat-badge cat-${catClass(course.category)}">${course.category}</span>
      <button class="cip-close" type="button">??/button>
    </div>
    <div class="cip-name">${course.name}</div>
    <div class="cip-rows">
      <div class="cip-row"><span class="cip-label">?대떦援먯닔</span><span>${course.professor || '誘몄젙'}</span></div>
      <div class="cip-row"><span class="cip-label">?숈젏</span><span>${course.credits}?숈젏</span></div>
      <div class="cip-row"><span class="cip-label">遺꾨컲</span><span>${course.section || '-'}</span></div>
      <div class="cip-row"><span class="cip-label">?쒓컙/?μ냼</span><span>${slotText}</span></div>
      ${course.department ? `<div class="cip-row"><span class="cip-label">媛쒖꽕?숆낵</span><span>${course.department}</span></div>` : ''}
      ${course.eligible_years?.length ? `<div class="cip-row"><span class="cip-label">?섍컯???/span><span>${course.eligible_years.join('쨌')}?숇뀈</span></div>` : ''}
    </div>
  `;

  document.body.appendChild(popup);
  _infoPopup = popup;

  // ?붾㈃ 以묒븰 怨좎젙
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;';

  popup.querySelector('.cip-close').addEventListener('click', () => {
    popup.remove(); _infoPopup = null;
  });

  // 諛곌꼍 ?대┃ ???リ린
  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.3);';
  backdrop.addEventListener('click', () => {
    popup.remove(); backdrop.remove(); _infoPopup = null;
  });
  document.body.insertBefore(backdrop, popup);
}

/* ?? ?먮룞?앹꽦 寃곌낵 怨쇰ぉ ?고겢由?硫붾돱 ?? */
let _ctxMenu = null;
function showResultContextMenu(x, y, courseName, courseObj) {
  closeCtxMenu();
  if (!courseName) return;

  const isInCart    = courseObj ? _selected.some(s => s.name === courseObj.name && s.section === courseObj.section) : false;
  const isExcluded  = _currentState?.excludedCourses?.includes(courseName) ?? false;

  const menu = document.createElement('div');
  menu.className = 'result-ctx-menu';
  menu.innerHTML = `
    <div class="ctx-course-name">${courseName}</div>
    <button class="ctx-item ctx-add${isInCart ? ' active' : ''}" data-action="add" type="button">
      ${isInCart ? '???닿? ???대┃ ???댁젣' : '?뱿 ?닿린'}
    </button>
    <div class="ctx-divider"></div>
    <button class="ctx-item${isExcluded ? ' active' : ''}" data-action="exclude" type="button">
      ${isExcluded ? '???쒖쇅 以????대┃ ???댁젣' : '?슟 異붿쿇 ?쒖쇅 怨쇰ぉ?쇰줈 ?ㅼ젙'}
    </button>
    <button class="ctx-item" data-action="completed" type="button">???섍컯 ?꾨즺濡??쒖떆</button>
    <div class="ctx-divider"></div>
    <button class="ctx-item ctx-cancel" data-action="close" type="button">?リ린</button>
  `;

  // ?붾㈃ 寃쎄퀎 泥댄겕
  menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:9999;`;
  document.body.appendChild(menu);
  _ctxMenu = menu;

  // ?붾㈃ 諛뽰쑝濡??섍?硫?蹂댁젙
  requestAnimationFrame(() => {
    const r = menu.getBoundingClientRect();
    if (r.right  > window.innerWidth)  menu.style.left = `${x - r.width}px`;
    if (r.bottom > window.innerHeight) menu.style.top  = `${y - r.height}px`;
  });

  menu.querySelectorAll('.ctx-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      if (action === 'exclude') {
        excludeCourseFromResult(courseName);
      } else if (action === 'completed') {
        if (_currentState && !_currentState.completedCourses.includes(courseName)) {
          _currentState.completedCourses.push(courseName);
          saveState(_currentState);
          if (_gradReqs) renderGradReq(_currentState);
          showToast(`"${courseName}"??瑜? ?섍컯 ?꾨즺濡??쒖떆?덉뒿?덈떎.`);
        } else {
          showToast(`?대? ?섍컯 ?꾨즺 紐⑸줉???덈뒗 怨쇰ぉ?낅땲??`);
        }
      } else if (action === 'add') {
        if (courseObj) toggleCourseFromResult(courseObj, null);
        else showToast('怨쇰ぉ ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎.');
      }
      closeCtxMenu();
    });
  });

  setTimeout(() => document.addEventListener('click', closeCtxMenu, { once: true }), 0);
}

function closeCtxMenu() {
  if (_ctxMenu) { _ctxMenu.remove(); _ctxMenu = null; }
}

function showToast(msg) {
  const existing = document.querySelector('.tt-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'tt-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 2500);
}

/* ?? ?먮룞 ?앹꽦 UI ?ㅼ젙 ?? */
/* ============================================================
   議몄뾽?붽굔 ?꾪솴 ?⑤꼸
   ============================================================ */
function setupGradReqPanel(state) {
  const toggle  = document.getElementById('gradReqToggle');
  const body    = document.getElementById('gradReqBody');
  const chevron = document.getElementById('gradReqChevron');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    if (chevron) chevron.textContent = open ? '?? : '??;
  });

  renderGradReq(state);
}

function renderGradReq(state) {
  const content = document.getElementById('gradReqContent');
  const badge   = document.getElementById('gradTotalBadge');
  if (!content) return;

  const dept = state.department || '';
  const req  = _gradReqs?.[dept];

  if (!req) {
    content.innerHTML = `<div class="grad-no-data">
      <span>?뱥</span>
      <p><strong>${dept || '?숆낵 誘몄꽕??}</strong>??議몄뾽?붽굔 ?곗씠?곌? ?놁뒿?덈떎.</p>
      <small>?ㅼ젙 ?섏씠吏?먯꽌 ?숆낵瑜??뺤씤?섍굅???숆탳 ?숈궗吏?먰???臾몄쓽?섏꽭??</small>
    </div>`;
    if (badge) badge.textContent = '';
    return;
  }

  // ?섍컯?꾨즺 怨쇰ぉ 怨꾩궛
  // 1) ?섎룞 ?꾨즺 ?쒖떆  2) 吏???숆린 timetable 怨쇰ぉ (?먮룞)  3) ?꾩옱 ?댁? 怨쇰ぉ
  const completed    = new Set((state.completedCourses || []).map(n => n.trim().toLowerCase()));
  const pastCourses  = getPastTimetableCourseNames(state);
  const retakeSet    = new Set((state.retakeCourses   || []).map(n => n.trim().toLowerCase()));
  const selected     = _selected || [];

  // 紐⑤뱺 ?댁닔 怨쇰ぉ = ?섎룞?꾨즺 + 吏?쒗븰湲??먮룞?꾨즺 + ?꾩옱 ?좏깮以?(?? ?ъ닔媛?怨쇰ぉ ?쒖쇅)
  const allTaken = new Set([
    ...Array.from(completed).filter(n => !retakeSet.has(n)),
    ...Array.from(pastCourses).filter(n => !retakeSet.has(n)),
    ...selected.map(c => c.name.trim().toLowerCase())
  ]);

  // 怨쇰ぉ紐????숈젏/???議고쉶 (courses.json ?곗꽑, ?놁쑝硫?議몄뾽?붽굔 ?꾩닔怨쇰ぉ 紐⑸줉, ?놁쑝硫?湲곕낯 3?숈젏)
  const reqCourseMap = {};
  (req.required_courses || []).forEach(rc => {
    reqCourseMap[rc.name.trim().toLowerCase()] = rc;
  });

  const lookupCourse = (nameLower) => {
    // courses.json?먯꽌 李얘린
    const c = _allCourses.find(x => x.name.trim().toLowerCase() === nameLower);
    if (c) return c;
    // 議몄뾽?붽굔 ?꾩닔怨쇰ぉ 紐⑸줉?먯꽌 李얘린 ???꾧났?꾩닔濡?媛꾩＜
    const rc = reqCourseMap[nameLower];
    if (rc) return { type: 'major', category: '?꾧났?꾩닔', department: dept, credits: rc.credits || 3 };
    // 湲곕낯: ?꾧났?좏깮 3?숈젏?쇰줈 異붿젙
    return null;
  };

  // 移댄뀒怨좊━蹂??댁닔 ?숈젏 怨꾩궛 (?섎룞?꾨즺 + 吏?쒗븰湲??먮룞?꾨즺 + ?꾩옱?댁?怨쇰ぉ)
  const calcEarned = (filterFn) => {
    let cr = 0;
    const counted = new Set();
    // ?섎룞 ?꾨즺 + 吏???숆린 ?먮룞 ?꾨즺
    for (const name of allTaken) {
      if (counted.has(name)) continue;
      const c = lookupCourse(name);
      if (c && filterFn(c)) { cr += Number(c.credits) || 0; counted.add(name); }
    }
    // ?꾩옱 ?댁? 怨쇰ぉ (allTaken???녿뒗 寃껊쭔)
    for (const c of selected) {
      const name = c.name.trim().toLowerCase();
      if (!counted.has(name) && filterFn(c)) { cr += Number(c.credits) || 0; counted.add(name); }
    }
    return cr;
  };

  // ?꾨즺怨쇰ぉ 以?courses.json???녿뒗 寃껋? ?꾧났?꾩닔 ?щ?瑜?reqCourseMap?쇰줈 ?먮떒
  const earnedLiberal   = calcEarned(c => c.type === 'liberal');
  const earnedMajorReq  = calcEarned(c => c.type === 'major' && c.category === '?꾧났?꾩닔');
  const earnedMajorElec = calcEarned(c => c.type === 'major' && c.category === '?꾧났?좏깮' && (!c.department || c.department === dept));
  const earnedMajor     = earnedMajorReq + earnedMajorElec;
  const earnedTotal     = earnedLiberal + earnedMajor;
  const totalReq         = req.total || 130;

  if (badge) {
    const pct = Math.round(earnedTotal / totalReq * 100);
    badge.textContent = `${earnedTotal}/${totalReq}?숈젏 (${pct}%)`;
    badge.style.background = pct >= 80 ? '#e3f7df' : pct >= 50 ? '#fff1d8' : '#f0f4ff';
    badge.style.color       = pct >= 80 ? '#1a6a1a' : pct >= 50 ? '#8a5800' : '#3b6bdc';
  }

  // 移댄뀒怨좊━蹂?Progress bar ?곗씠??  const liberal = req.liberal || {};
  const major   = req.major   || {};
  const libReq  = LIBERAL_REQ.湲곗큹援먯뼇 + LIBERAL_REQ.洹좏삎援먯뼇; // 34?숈젏 湲곗? 理쒖냼 ?꾩닔
  const majReq  = (major['?꾧났?꾩닔'] || 0) + (major['?꾧났?좏깮'] || 0);

  // 援먯뼇 ?몃? earned
  const earnedGichyo    = calcEarned(c => c.type === 'liberal' && c.category === '湲곗큹援먯뼇');
  const earnedGyunhyung = calcEarned(c => c.type === 'liberal' && c.category === '洹좏삎援먯뼇');
  const earnedHwakdae   = calcEarned(c => c.type === 'liberal' && c.category === '?뺣?援먯뼇');

  // 湲곗큹援먯뼇 洹몃９蹂??댁닔 ?щ? (subtitle 蹂듭닔 + liberal_areas 怨쇰ぉ紐?fallback)
  const _liberalAreasMap = {};
  (req.liberal_areas || []).forEach(a => { _liberalAreasMap[a.name] = a; });
  const gichyoGroups = REQUIRED_LIBERAL_GROUPS.map(g => {
    // subtitle 留ㅼ묶
    const subtitleDone = Array.from(allTaken).some(name => {
      const c = _allCourses.find(x => x.name.trim().toLowerCase() === name);
      return c && c.type === 'liberal' && g.subtitles.some(s => c.subtitle === s);
    }) || selected.some(c => c.type === 'liberal' && g.subtitles.some(s => c.subtitle === s));
    // liberal_areas 怨쇰ぉ紐?baseName 留ㅼ묶 (援ы삎 ?곗씠??fallback)
    const areaInfo = _liberalAreasMap[g.label];
    const nameDone = areaInfo
      ? Array.from(allTaken).some(name => areaInfo.courses.some(n => baseName(n) === baseName(name)))
        || selected.some(c => areaInfo.courses.some(n => baseName(n) === baseName(c.name)))
      : false;
    return { label: g.label, minCr: g.minCredits, done: subtitleDone || nameDone };
  });

  // 洹좏삎援먯뼇 4媛??곸뿭 ?댁닔 ?щ?
  const gyunhyungAreas = REQUIRED_GYUNHYUNG_AREAS.map(area => {
    const done = Array.from(allTaken).some(name => {
      const c = _allCourses.find(x => x.name.trim().toLowerCase() === name);
      return c && c.type === 'liberal' && c.subtitle === area;
    }) || selected.some(c => c.type === 'liberal' && c.subtitle === area);
    return { label: area, done };
  });
  const gyunhyungDoneCount = gyunhyungAreas.filter(a => a.done).length;

  const subMaj = [
    { label: '?꾧났?꾩닔', earned: earnedMajorReq,  req: major['?꾧났?꾩닔'] || 0 },
    { label: '?꾧났?좏깮', earned: earnedMajorElec, req: major['?꾧났?좏깮'] || 0 },
  ].filter(x => x.req > 0);

  if (major['?ы솕?꾧났']) subMaj.push({ label: '?ы솕?꾧났', earned: 0, req: major['?ы솕?꾧났'] });

  // ?댁닔 泥닿퀎????(roadmap 湲곕컲, ?꾧났?꾩닔+?꾧났?좏깮)
  const roadmap = _roadmap?.[dept] || {};
  // required_courses瑜?name??grade,semester} 留듭쑝濡?蹂??  const reqMap = {};
  (req.required_courses || []).forEach(rc => {
    reqMap[rc.name.trim().toLowerCase()] = rc;
  });

  const makeRoadmapTable = () => {
    // roadmap?먯꽌 ?숆낵 ?꾧났怨쇰ぉ留?異붿텧 (?대? dept 湲곗?)
    // 援ъ“: roadmap[grade][sem] = [courseName, ...]
    const grades = ['1', '2', '3', '4'];
    const sems   = ['1', '2'];

    // 媛??(grade횞sem)??怨쇰ぉ 紐⑸줉 鍮뚮뱶
    const cells = {};
    for (const g of grades) {
      for (const s of sems) {
        const names = roadmap[g]?.[s] || [];
        cells[`${g}_${s}`] = names.map(name => {
          const lower = name.trim().toLowerCase();
          const course = _allCourses.find(c =>
            c.name.trim().toLowerCase() === lower &&
            (c.type === 'major') && (!c.department || c.department === dept)
          );
          const isReq = !!reqMap[lower];
          const cat = course?.category || (isReq ? '?꾧났?꾩닔' : '?꾧났?좏깮');
          const credits = course?.credits ?? reqMap[lower]?.credits ?? 3;
          const isRetakeMarked = retakeSet.has(lower);
          const done = !isRetakeMarked && allTaken.has(lower);
          const inProgress = !done && !isRetakeMarked && selected.some(c => c.name.trim().toLowerCase() === lower);
          return { name, cat, credits, done, inProgress, isReq, isRetakeMarked };
        });
      }
    }

    // ?ㅼ젣 ?곗씠?곌? ?덈뒗 ?숇뀈留??쒖떆
    const activeGrades = grades.filter(g => sems.some(s => cells[`${g}_${s}`]?.length));
    if (!activeGrades.length) return '';

    const semLabel = { '1': '1?숆린', '2': '2?숆린' };

    const headerRow = `
      <tr class="rmap-header-row">
        <th class="rmap-grade-th"></th>
        ${sems.map(s => `<th class="rmap-sem-th">${semLabel[s]}</th>`).join('')}
      </tr>`;

    const bodyRows = activeGrades.map(g => {
      const cols = sems.map(s => {
        const items = cells[`${g}_${s}`];
        if (!items.length) return `<td class="rmap-cell rmap-empty">??/td>`;
        return `<td class="rmap-cell">
          ${items.map(item => {
            const cls = item.isRetakeMarked ? 'rmap-course retake'
              : item.done ? 'rmap-course done'
              : item.inProgress ? 'rmap-course in-progress'
              : 'rmap-course';
            const badge = item.isReq
              ? `<span class="rmap-badge req">?꾩닔</span>`
              : `<span class="rmap-badge elec">?좏깮</span>`;
            const status = item.isRetakeMarked
              ? `<span class="rmap-status retake-icon">?봽?ъ닔媛?/span>`
              : item.done
              ? `<span class="rmap-status done-icon">??/span>`
              : item.inProgress
              ? `<span class="rmap-status prog-icon">?대뒗以?/span>`
              : '';
            return `<div class="${cls}" title="${item.name} 쨌 ${item.credits}?숈젏">
              ${badge}
              <span class="rmap-name">${item.name}</span>
              <span class="rmap-cr">${item.credits}?숈젏</span>
              ${status}
            </div>`;
          }).join('')}
        </td>`;
      }).join('');
      return `<tr><td class="rmap-grade-label">${g}?숇뀈</td>${cols}</tr>`;
    }).join('');

    return `
      <div class="grad-section">
        <div class="grad-section-title">?꾧났 ?댁닔 泥닿퀎??          <span class="rmap-legend">
            <span class="rmap-badge req">?꾩닔</span> ?꾧났?꾩닔 &nbsp;
            <span class="rmap-badge elec">?좏깮</span> ?꾧났?좏깮 &nbsp;
            <span class="rmap-status done-icon">??/span> ?댁닔?꾨즺 &nbsp;
            <span class="rmap-status prog-icon">?대뒗以?/span> ?꾩옱 ?댁쓬 &nbsp;
            <span class="rmap-status retake-icon">?봽?ъ닔媛?/span> ?ъ닔媛??꾩슂
          </span>
        </div>
        <div class="rmap-scroll">
          <table class="rmap-table">
            <thead>${headerRow}</thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </div>
      </div>
    `;
  };

  const roadmapHtml = makeRoadmapTable();

  /* ?? 援먯뼇 ?댁닔 ?꾪솴 ?뚯씠釉??? */
  const makeLiberalTable = () => {
    const HWAKDAE_AREAS = ['?몄뼱?섏꽭怨?, '?뚯뼇援먯쑁'];

    // liberal_areas 留?(?대쫫 ??{courses, credits}) ??all_grad_reqs.json?먯꽌
    const liberalAreasMap = {};
    (req.liberal_areas || []).forEach(a => { liberalAreasMap[a.name] = a; });

    // subtitle 湲곗??쇰줈 ?댁닔 怨쇰ぉ 李얘린 + liberal_areas 怨쇰ぉ紐?湲곗? 蹂댁셿
    const findTakenByArea = (subtitle, areaName) => {
      const result = [];
      const seen = new Set();

      // 1) subtitle 湲곗? (湲곗〈 諛⑹떇)
      for (const name of allTaken) {
        const c = _allCourses.find(x => x.name.trim().toLowerCase() === name && x.type === 'liberal' && x.subtitle === subtitle);
        if (c && !seen.has(c.name)) { seen.add(c.name); result.push({ ...c, status: 'done' }); }
      }
      for (const c of selected) {
        if (c.type === 'liberal' && c.subtitle === subtitle && !seen.has(c.name)) {
          seen.add(c.name); result.push({ ...c, status: 'inProgress' });
        }
      }

      // 2) liberal_areas 怨쇰ぉ紐?湲곗? 蹂댁셿 (subtitle???녿뒗 援ы삎 ?곗씠??而ㅻ쾭)
      // baseName 湲곗??쇰줈 留ㅼ묶 ??愿꾪샇 ?ㅻ챸쨌?낆씠 ?ㅻⅨ 蹂?뺣룄 ?몄떇
      const areaInfo = liberalAreasMap[areaName];
      if (areaInfo) {
        const baseSet = new Set(areaInfo.courses.map(n => baseName(n)));
        for (const name of allTaken) {
          if (baseSet.has(baseName(name)) && !seen.has(name)) {
            const c = _allCourses.find(x => x.name.trim().toLowerCase() === name);
            const displayName = areaInfo.courses.find(n => baseName(n) === baseName(name)) || name;
            seen.add(name);
            result.push({ name: c?.name || displayName, credits: c?.credits ?? areaInfo.credits, status: 'done' });
          }
        }
        for (const c of selected) {
          const lower = c.name.trim().toLowerCase();
          if (baseSet.has(baseName(c.name)) && !seen.has(lower)) {
            seen.add(lower);
            result.push({ ...c, status: 'inProgress' });
          }
        }
      }

      return result;
    };

    // subtitle 湲곗?留?(洹좏삎援먯뼇쨌?뺣?援먯뼇??
    const findTakenBySubtitle = (subtitle) => {
      const result = [];
      const seen = new Set();
      for (const name of allTaken) {
        const c = _allCourses.find(x => x.name.trim().toLowerCase() === name && x.type === 'liberal' && x.subtitle === subtitle);
        if (c && !seen.has(c.name)) { seen.add(c.name); result.push({ ...c, status: 'done' }); }
      }
      for (const c of selected) {
        if (c.type === 'liberal' && c.subtitle === subtitle && !seen.has(c.name)) {
          seen.add(c.name); result.push({ ...c, status: 'inProgress' });
        }
      }
      return result;
    };

    const courseTag = (c) => {
      const retake = retakeSet.has(c.name.trim().toLowerCase());
      const cls = retake ? 'lib-tag retake' : c.status === 'inProgress' ? 'lib-tag prog' : 'lib-tag done';
      const icon = retake ? '?봽' : c.status === 'inProgress' ? '' : '??;
      return `<span class="${cls}">${icon} ${c.name}<span class="lib-tag-cr">${c.credits}?숈젏</span></span>`;
    };

    const statusCell = (taken, required) => {
      if (required) {
        return taken.length ? `<span class="rmap-status done-icon">??/span>` : `<span class="lib-required">?꾩닔</span>`;
      }
      return taken.length ? `<span class="rmap-status done-icon">??/span>` : `<span class="lib-optional">?먯쑉</span>`;
    };

    // 湲곗큹援먯뼇 rows ??liberal_areas 怨쇰ぉ紐??뚰듃 ?ы븿
    const gichyoRows = REQUIRED_LIBERAL_GROUPS.map(g => {
      const areaInfo = liberalAreasMap[g.label];
      return {
        area: g.label,
        minCr: g.minCredits,
        taken: findTakenByArea(g.subtitle, g.label),
        required: true,
        hintCourses: areaInfo ? areaInfo.courses : []
      };
    });

    // 洹좏삎援먯뼇 rows
    const gyunRows = REQUIRED_GYUNHYUNG_AREAS.map(area => ({
      area, minCr: null, taken: findTakenBySubtitle(area), required: true, hintCourses: []
    }));

    // ?뺣?援먯뼇 rows
    const hwakRows = HWAKDAE_AREAS.map(area => ({
      area, minCr: null, taken: findTakenBySubtitle(area), required: false, hintCourses: []
    }));

    const renderRows = (rows, catLabel, catNote, rowspan) => rows.map((row, i) => {
      const hintHtml = (!row.taken.length && row.hintCourses.length)
        ? `<div class="lib-hint-courses">?댁닔 媛?? ${row.hintCourses.map(n => `<span class="lib-hint-tag">${n}</span>`).join('')}</div>`
        : '';
      return `
      <tr class="${row.taken.length ? 'lib-row-done' : 'lib-row'}">
        ${i === 0 ? `<td class="lib-cat-cell" rowspan="${rowspan}">${catLabel}${catNote ? `<br><small>${catNote}</small>` : ''}</td>` : ''}
        <td class="lib-area-cell">${row.area}${row.minCr ? `<br><small class="lib-cr-hint">${row.minCr}?숈젏</small>` : ''}</td>
        <td class="lib-courses-cell">
          ${row.taken.length ? row.taken.map(courseTag).join('') : '<span class="lib-empty">誘몄씠??/span>'}
          ${hintHtml}
        </td>
        <td class="lib-status-cell">${statusCell(row.taken, row.required)}</td>
      </tr>`;
    }).join('');

    return `
      <div class="grad-section">
        <div class="grad-section-title">援먯뼇 ?댁닔 ?꾪솴
          <span class="rmap-legend">
            <span class="lib-tag done">???댁닔?꾨즺</span> &nbsp;
            <span class="lib-tag prog">?대뒗以?/span> &nbsp;
            <span class="lib-tag retake">?봽 ?ъ닔媛?/span>
          </span>
        </div>
        <div class="rmap-scroll">
          <table class="lib-table">
            <thead>
              <tr>
                <th class="lib-cat-th">援щ텇</th>
                <th class="lib-area-th">?곸뿭</th>
                <th class="lib-courses-th">?댁닔 怨쇰ぉ</th>
                <th class="lib-status-th">?곹깭</th>
              </tr>
            </thead>
            <tbody>
              ${renderRows(gichyoRows, '湲곗큹援먯뼇', `${earnedGichyo}/${LIBERAL_REQ.湲곗큹援먯뼇}?숈젏`, gichyoRows.length)}
              ${renderRows(gyunRows,   '洹좏삎援먯뼇', `${earnedGyunhyung}?숈젏`, gyunRows.length)}
              ${renderRows(hwakRows,   '?뺣?援먯뼇', '?먯쑉?댁닔', hwakRows.length)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  /* ?? ?숆낵 沅뚯옣 洹좏삎援먯뼇 ?댁닔 ?꾪솴 ?? */
  const makeRecommendedLiberalTable = () => {
    const recList = req.recommended_liberal || [];
    if (!recList.length) return '';

    const rows = recList.map(r => {
      const nameLower = baseName(r.name);
      // ?댁닔 ?щ?: allTaken ?먮뒗 ?꾩옱 ?좏깮
      const doneName = Array.from(allTaken).find(n => baseName(n) === nameLower);
      const inProgressCourse = selected.find(c => baseName(c.name) === nameLower);
      const retake = doneName ? retakeSet.has(doneName) : false;
      const done = !retake && !!doneName;
      const inProgress = !done && !retake && !!inProgressCourse;

      let statusHtml;
      if (retake)       statusHtml = `<span class="lib-tag retake">?봽 ?ъ닔媛?/span>`;
      else if (done)    statusHtml = `<span class="rmap-status done-icon">??/span>`;
      else if (inProgress) statusHtml = `<span class="lib-tag prog">?대뒗以?/span>`;
      else              statusHtml = `<span class="rec-lib-pending">誘몄씠??/span>`;

      return `
        <tr class="${done ? 'lib-row-done' : 'lib-row'}">
          <td class="lib-area-cell">${r.name}<br><small class="lib-cr-hint">${r.credits}?숈젏</small></td>
          <td class="lib-area-cell rec-lib-area">${r.area}</td>
          <td class="lib-status-cell">${statusHtml}</td>
        </tr>`;
    });

    const doneCount = recList.filter(r => {
      const n = baseName(r.name);
      const dn = Array.from(allTaken).find(x => baseName(x) === n);
      return dn && !retakeSet.has(dn);
    }).length + selected.filter(c => recList.some(r => baseName(r.name) === baseName(c.name))).length;

    return `
      <div class="grad-section">
        <div class="grad-section-title">?숆낵 沅뚯옣 援먯뼇怨쇰ぉ
          <span class="rec-lib-badge">${doneCount}/${recList.length} ?댁닔</span>
        </div>
        <div class="rmap-scroll">
          <table class="lib-table">
            <thead>
              <tr>
                <th class="lib-area-th">怨쇰ぉ紐?/th>
                <th class="lib-area-th">洹좏삎援먯뼇 ?곸뿭</th>
                <th class="lib-status-th">?곹깭</th>
              </tr>
            </thead>
            <tbody>${rows.join('')}</tbody>
          </table>
        </div>
        <small class="rec-lib-note">?뱦 ?숆낵?먯꽌 洹좏삎援먯뼇?쇰줈 沅뚯옣?섎뒗 怨쇰ぉ?낅땲?? ?먮룞 ?쒓컙???앹꽦 ???곗꽑 ?ы븿?⑸땲??</small>
      </div>
    `;
  };

  const makeBar = (label, earned, req, color, subRows) => {
    const pct   = req > 0 ? Math.min(100, Math.round(earned / req * 100)) : 0;
    const done  = earned >= req;
    const subHtml = subRows ? `
      <div class="grad-sub-rows">
        ${subRows.map(s => {
          const ep = s.earned !== undefined ? s.earned : 0;
          const sp = s.req > 0 ? Math.min(100, Math.round(ep / s.req * 100)) : 0;
          return `<div class="grad-sub-row">
            <span class="grad-sub-label">${s.label}</span>
            <div class="grad-sub-bar-wrap">
              <div class="grad-sub-bar" style="width:${sp}%;background:${color}"></div>
            </div>
            <span class="grad-sub-val">${ep}/${s.req}</span>
          </div>`;
        }).join('')}
      </div>
    ` : '';
    return `
      <div class="grad-bar-block">
        <div class="grad-bar-header">
          <span class="grad-bar-label">${done ? '??' : ''}${label}</span>
          <span class="grad-bar-val ${done ? 'done' : ''}">${earned}/${req}?숈젏</span>
        </div>
        <div class="grad-bar-wrap">
          <div class="grad-bar" style="width:${pct}%;background:${color}"></div>
        </div>
        ${subHtml}
      </div>
    `;
  };

  // 珥??댁닔 吏꾪뻾
  const totalPct = Math.min(100, Math.round(earnedTotal / totalReq * 100));

  content.innerHTML = `
    <div class="grad-total-row">
      <div class="grad-total-label">?꾩껜 ?댁닔 吏꾪뻾瑜?/div>
      <div class="grad-total-bar-wrap">
        <div class="grad-total-bar" style="width:${totalPct}%"></div>
      </div>
      <div class="grad-total-val">${earnedTotal} / ${totalReq}?숈젏 (${totalPct}%)</div>
    </div>

    <div class="grad-bars-grid">
      ${makeBar('援먯뼇', earnedLiberal, LIBERAL_REQ.湲곗큹援먯뼇 + LIBERAL_REQ.洹좏삎援먯뼇, '#3b6bdc', null)}
      ${makeBar('?꾧났', earnedMajor,   majReq, '#2a7a1a', subMaj)}
    </div>

    ${roadmapHtml}
    ${makeLiberalTable()}
    ${makeRecommendedLiberalTable()}

    <div class="grad-note">
      <small>* ?섍컯?꾨즺 怨쇰ぉ怨??꾩옱 ?댁? 媛뺤쓽 湲곗??쇰줈 怨꾩궛?⑸땲?? ?ㅼ젣 ?댁닔 ?숈젏? ?숆탳 ?숈궗?쒖뒪?쒖쓣 ?뺤씤?섏꽭??</small>
    </div>
  `;
}

/* ============================================================
   異붿쿇 ?쒖쇅 怨쇰ぉ 愿由?   ============================================================ */
function setupExcludedCourses(state) {
  const section    = document.getElementById('excludedSection');
  const toggle     = document.getElementById('excludedToggle');
  const body       = document.getElementById('excludedBody');
  const chevron    = document.getElementById('excludedChevron');
  const searchInp  = document.getElementById('excludedSearch');
  const suggestions= document.getElementById('excludedSuggestions');
  const listEl     = document.getElementById('excludedList');
  const countEl    = document.getElementById('excludedCount');
  if (!section) return;

  if (!state.excludedCourses) state.excludedCourses = [];

  const renderList = () => {
    const list = state.excludedCourses;
    if (countEl) countEl.textContent = list.length ? `${list.length}怨쇰ぉ` : '';
    if (!listEl) return;
    if (!list.length) {
      listEl.innerHTML = '<span class="completed-empty">?쒖쇅??怨쇰ぉ???놁뒿?덈떎.</span>';
      return;
    }
    listEl.innerHTML = list.map((name, i) => `
      <span class="completed-tag excluded-tag">
        ${name}
        <button class="completed-tag-del" data-idx="${i}" type="button" title="??젣">횞</button>
      </span>
    `).join('');
    listEl.querySelectorAll('.completed-tag-del').forEach(btn => {
      btn.addEventListener('click', () => {
        state.excludedCourses.splice(Number(btn.dataset.idx), 1);
        saveState(state);
        renderList();
      });
    });
  };

  toggle?.addEventListener('click', () => {
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    if (chevron) chevron.textContent = open ? '?? : '??;
  });

  let debounceTimer;
  searchInp?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const q = searchInp.value.trim().toLowerCase();
      if (!q) { suggestions.innerHTML = ''; return; }
      const matches = _allCourses
        .filter(c => c.name.toLowerCase().includes(q))
        .reduce((acc, c) => { if (!acc.find(x => x.name === c.name)) acc.push(c); return acc; }, [])
        .slice(0, 8);
      if (!matches.length) { suggestions.innerHTML = ''; return; }
      suggestions.innerHTML = matches.map(c => `
        <div class="completed-sug-item" data-name="${esc(c.name)}">
          <span class="completed-sug-name">${c.name}</span>
          <span class="completed-sug-meta">${
            c.type === 'major' ? '?꾧났' :
            c.type === '?먯쑀?좏깮' ? '?먯쑀?좏깮' : '援먯뼇'
          } 쨌 ${c.credits}?숈젏</span>
        </div>
      `).join('');
      suggestions.querySelectorAll('.completed-sug-item').forEach(item => {
        item.addEventListener('click', () => {
          const name = item.dataset.name;
          if (!state.excludedCourses.includes(name)) {
            state.excludedCourses.push(name);
            saveState(state);
            renderList();
          }
          searchInp.value = '';
          suggestions.innerHTML = '';
        });
      });
    }, 200);
  });

  document.addEventListener('click', (e) => {
    if (!suggestions?.contains(e.target) && e.target !== searchInp) {
      if (suggestions) suggestions.innerHTML = '';
    }
  });

  document.getElementById('excludedClearAll')?.addEventListener('click', () => {
    if (!state.excludedCourses.length) return;
    if (confirm(`?쒖쇅 怨쇰ぉ ${state.excludedCourses.length}媛쒕? 紐⑤몢 ??젣?좉퉴??`)) {
      state.excludedCourses = [];
      saveState(state);
      renderList();
    }
  });

  renderList();
}

/* ============================================================
   瑗??ｊ퀬 ?띠? 媛뺤쓽 (pinnedCourses) 愿由?   ============================================================ */
function setupPinnedCourses(state) {
  const section    = document.getElementById('pinnedSection');
  const toggle     = document.getElementById('pinnedToggle');
  const body       = document.getElementById('pinnedBody');
  const chevron    = document.getElementById('pinnedChevron');
  const searchInp  = document.getElementById('pinnedSearch');
  const suggestions= document.getElementById('pinnedSuggestions');
  const listEl     = document.getElementById('pinnedList');
  const countEl    = document.getElementById('pinnedCount');
  if (!section) return;

  if (!state.pinnedCourses) state.pinnedCourses = [];

  const renderList = () => {
    const list = state.pinnedCourses;
    if (countEl) countEl.textContent = list.length ? `${list.length}怨쇰ぉ` : '';
    if (!listEl) return;
    if (!list.length) {
      listEl.innerHTML = '<span class="completed-empty">吏?뺣맂 怨쇰ぉ???놁뒿?덈떎.</span>';
      return;
    }
    listEl.innerHTML = list.map((name, i) => {
      const course = _allCourses.find(c => c.name === name);
      const slotText = course
        ? (course.slots || []).map(s => `${DAY_NAMES[s.day]} ${s.start}??{s.end}`).join(' / ')
        : '';
      return `
        <span class="completed-tag pinned-tag">
          ?뱦 ${name}
          ${slotText ? `<span class="pinned-slot">${slotText}</span>` : ''}
          <button class="completed-tag-del" data-idx="${i}" type="button" title="??젣">횞</button>
        </span>
      `;
    }).join('');
    listEl.querySelectorAll('.completed-tag-del').forEach(btn => {
      btn.addEventListener('click', () => {
        state.pinnedCourses.splice(Number(btn.dataset.idx), 1);
        saveState(state);
        renderList();
      });
    });
  };

  // ?⑤꼸 ?좉?
  toggle?.addEventListener('click', () => {
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    if (chevron) chevron.textContent = open ? '?? : '??;
  });

  // 寃??+ ?먮룞?꾩꽦
  let debounceTimer;
  searchInp?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const q = searchInp.value.trim().toLowerCase();
      if (!q) { suggestions.innerHTML = ''; return; }
      const matches = _allCourses
        .filter(c => c.name.toLowerCase().includes(q))
        .reduce((acc, c) => { if (!acc.find(x => x.name === c.name)) acc.push(c); return acc; }, [])
        .slice(0, 8);
      if (!matches.length) { suggestions.innerHTML = ''; return; }
      suggestions.innerHTML = matches.map(c => {
        const slotText = (c.slots || []).map(s => `${DAY_NAMES[s.day]} ${s.start}??{s.end}`).join(' / ');
        return `
          <div class="completed-sug-item" data-name="${esc(c.name)}">
            <span class="completed-sug-name">${c.name}</span>
            <span class="completed-sug-meta">${c.type === 'major' ? '?꾧났' : c.type === '?먯쑀?좏깮' ? '?먯쑀?좏깮' : '援먯뼇'} 쨌 ${c.credits}?숈젏 쨌 ${slotText}</span>
          </div>
        `;
      }).join('');
      suggestions.querySelectorAll('.completed-sug-item').forEach(item => {
        item.addEventListener('click', () => {
          const name = item.dataset.name;
          if (!state.pinnedCourses.includes(name)) {
            state.pinnedCourses.push(name);
            saveState(state);
            renderList();
            // ?⑤꼸???ロ? ?덉쑝硫??댁뼱以?            if (body.classList.contains('hidden')) {
              body.classList.remove('hidden');
              if (chevron) chevron.textContent = '??;
            }
          }
          searchInp.value = '';
          suggestions.innerHTML = '';
        });
      });
    }, 200);
  });

  // ?몃? ?대┃ ???먮룞?꾩꽦 ?リ린
  document.addEventListener('click', (e) => {
    if (!suggestions?.contains(e.target) && e.target !== searchInp) {
      if (suggestions) suggestions.innerHTML = '';
    }
  });

  // ?꾩껜 ??젣
  document.getElementById('pinnedClearAll')?.addEventListener('click', () => {
    if (!state.pinnedCourses.length) return;
    if (confirm(`?꾩닔 ?ы븿 怨쇰ぉ ${state.pinnedCourses.length}媛쒕? 紐⑤몢 ??젣?좉퉴??`)) {
      state.pinnedCourses = [];
      saveState(state);
      renderList();
    }
  });

  renderList();
}

/* ============================================================
   ?섍컯 ?꾨즺 怨쇰ぉ 愿由?   ============================================================ */
function setupCompletedCourses(state) {
  const section    = document.getElementById('completedSection');
  const toggle     = document.getElementById('completedToggle');
  const body       = document.getElementById('completedBody');
  const chevron    = document.getElementById('completedChevron');
  const searchInp  = document.getElementById('completedSearch');
  const suggestions= document.getElementById('completedSuggestions');
  const listEl     = document.getElementById('completedList');
  const countEl    = document.getElementById('completedCount');
  if (!section) return;

  if (!state.completedCourses) state.completedCourses = [];

  const renderList = () => {
    const list = state.completedCourses;
    if (countEl) countEl.textContent = list.length ? `${list.length}怨쇰ぉ` : '';
    if (!listEl) return;
    if (!list.length) {
      listEl.innerHTML = '<span class="completed-empty">?꾩쭅 異붽???怨쇰ぉ???놁뒿?덈떎.</span>';
      return;
    }
    listEl.innerHTML = list.map((name, i) => `
      <span class="completed-tag">
        ${name}
        <button class="completed-tag-del" data-idx="${i}" type="button" title="??젣">횞</button>
      </span>
    `).join('');
    listEl.querySelectorAll('.completed-tag-del').forEach(btn => {
      btn.addEventListener('click', () => {
        state.completedCourses.splice(Number(btn.dataset.idx), 1);
        saveState(state);
        renderList();
        if (_gradReqs) renderGradReq(state);
      });
    });
  };

  // Panel toggle
  toggle?.addEventListener('click', () => {
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    if (chevron) chevron.textContent = open ? '?? : '??;
  });

  // Search + suggestion
  let debounceTimer;
  searchInp?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const q = searchInp.value.trim().toLowerCase();
      if (!q || q.length < 1) { suggestions.innerHTML = ''; return; }
      const matches = _allCourses
        .filter(c => c.name.toLowerCase().includes(q))
        .reduce((acc, c) => { if (!acc.find(x => x.name === c.name)) acc.push(c); return acc; }, [])
        .slice(0, 8);
      if (!matches.length) { suggestions.innerHTML = ''; return; }
      suggestions.innerHTML = matches.map(c => `
        <div class="completed-sug-item" data-name="${c.name}">
          <span class="completed-sug-name">${c.name}</span>
          <span class="completed-sug-meta">${c.type === 'major' ? '?꾧났' : c.type === '?먯쑀?좏깮' ? '?먯쑀?좏깮' : '援먯뼇'} 쨌 ${c.credits}?숈젏</span>
        </div>
      `).join('');
      suggestions.querySelectorAll('.completed-sug-item').forEach(item => {
        item.addEventListener('click', () => {
          const name = item.dataset.name;
          if (!state.completedCourses.includes(name)) {
            state.completedCourses.push(name);
            saveState(state);
            renderList();
            if (_gradReqs) renderGradReq(state);
          }
          searchInp.value = '';
          suggestions.innerHTML = '';
        });
      });
    }, 200);
  });

  // Hide suggestions on outside click
  document.addEventListener('click', (e) => {
    if (!suggestions?.contains(e.target) && e.target !== searchInp) {
      if (suggestions) suggestions.innerHTML = '';
    }
  });

  // Clear all button
  document.getElementById('completedClearAll')?.addEventListener('click', () => {
    if (!state.completedCourses.length) return;
    if (confirm(`?섍컯 ?꾨즺 怨쇰ぉ ${state.completedCourses.length}媛쒕? 紐⑤몢 ??젣?좉퉴??`)) {
      state.completedCourses = [];
      saveState(state);
      renderList();
    }
  });

  renderList();
}

function setupAutoGen(state) {
  // ?⑤꼸 ?좉?
  const toggle  = document.getElementById('autoGenToggle');
  const body    = document.getElementById('autoGenBody');
  const chevron = document.getElementById('autoGenChevron');
  toggle?.addEventListener('click', () => {
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    chevron.textContent = open ? '?? : '??;
  });

  // ?숇뀈 pills
  const gradePills = document.getElementById('gradePills');
  gradePills?.querySelectorAll('.ag-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      gradePills.querySelectorAll('.ag-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _autoGrade = Number(btn.dataset.grade);
    });
  });
  // ?숇쾲?먯꽌 ?낇븰?꾨룄 ???숇뀈 異붿젙
  const admYear = getAdmissionYear(state.studentId);
  if (admYear) {
    const guessGrade = Math.min(4, Math.max(1, new Date().getFullYear() - admYear + 1));
    _autoGrade = guessGrade;
    gradePills?.querySelectorAll('.ag-pill').forEach(btn => {
      if (Number(btn.dataset.grade) === guessGrade) btn.classList.add('active');
    });
  }

  // ?ㅽ???pills (蹂듭닔 ?좏깮)
  const descRow = document.getElementById('styleDescRow');
  document.getElementById('stylePills')?.querySelectorAll('.ag-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.style;
      // cluster ??spread ?곹샇 諛곗젣
      if (s === 'cluster' && _autoPrefs.has('spread'))   _autoPrefs.delete('spread');
      if (s === 'spread'  && _autoPrefs.has('cluster'))  _autoPrefs.delete('cluster');
      // major_first ??liberal_first ?곹샇 諛곗젣
      if (s === 'major_first'   && _autoPrefs.has('liberal_first'))     _autoPrefs.delete('liberal_first');
      if (s === 'liberal_first' && _autoPrefs.has('major_first'))       _autoPrefs.delete('major_first');
      // liberal_req_first ??liberal_first ?곹샇 諛곗젣
      if (s === 'liberal_req_first' && _autoPrefs.has('liberal_first')) _autoPrefs.delete('liberal_first');
      if (s === 'liberal_first' && _autoPrefs.has('liberal_req_first')) _autoPrefs.delete('liberal_req_first');

      if (_autoPrefs.has(s)) _autoPrefs.delete(s);
      else                   _autoPrefs.add(s);

      // 踰꾪듉 ?곹깭 ?낅뜲?댄듃
      document.getElementById('stylePills').querySelectorAll('.ag-pill').forEach(b => {
        b.classList.toggle('active', _autoPrefs.has(b.dataset.style));
      });
      // ?ㅻ챸 ?낅뜲?댄듃
      if (descRow) {
        descRow.innerHTML = [..._autoPrefs].map(p =>
          `<span class="style-desc-item">${STYLE_META[p]?.desc || ''}</span>`
        ).join('');
      }
    });
  });

  // ?ъ닔媛??덉슜 ?좉? (?④꺼吏?怨좉툒 ?듭뀡)
  const retakeToggle = document.getElementById('allowRetake');
  if (retakeToggle) {
    retakeToggle.checked = state.allowRetake || false;
    retakeToggle.addEventListener('change', () => {
      state.allowRetake = retakeToggle.checked;
      saveState(state);
    });
  }

  document.getElementById('maxCredits')?.addEventListener('change', () => {});

  // ?앹꽦 踰꾪듉
  document.getElementById('autoGenBtn')?.addEventListener('click', () => {
    if (!_autoGrade) {
      alert('癒쇱? ?꾩옱 ?숇뀈???좏깮??二쇱꽭??');
      return;
    }
    if (!state.department) {
      alert('?쒖옉?섍린 ?꾩뿉 ?ㅼ젙?먯꽌 ?숆낵瑜?吏?뺥빐 二쇱꽭??');
      return;
    }

    const btn = document.getElementById('autoGenBtn');
    btn.textContent = '?앹꽦 以묅?;
    btn.disabled = true;

    // ?쎄컙 delay 以섏꽌 UI ?낅뜲?댄듃 ???앹꽦
    setTimeout(() => {
      const options = {
        grade:       _autoGrade,
        prefs:       new Set(_autoPrefs),
        inclRequired: document.getElementById('inclRequired')?.checked ?? true,
        inclElective: document.getElementById('inclElective')?.checked ?? true,
        inclLiberal:  document.getElementById('inclLiberal')?.checked ?? true
      };

      try {
        // A: 寃곗젙濡좎쟻 理쒖쟻 / B쨌C: 留??ㅽ뻾留덈떎 ?ㅻⅨ seed ???ㅻⅨ 援먯뼇 議고빀
        const now = Date.now();
        const seedB = (now % 65521) + 1;          // 1~65521
        const seedC = ((now >> 5) % 65521) + 101; // 101~65621 (B? 援щ텇)
        const v0 = generateVariant(state, { ...options, shuffleSeed: 0 });
        const v1 = generateVariant(state, { ...options, shuffleSeed: seedB });
        const v2 = generateVariant(state, { ...options, shuffleSeed: seedC });

        // 以묐났 泥댄겕: A=B硫?B?먯꽌 A 怨쇰ぉ ?쇰? 媛뺤젣 ?쒖쇅 ???ъ깮??        const scheduleKey = s => s.map(c => c.name + (c.section||'')).sort().join('|');
        const k0 = scheduleKey(v0), k1 = scheduleKey(v1), k2 = scheduleKey(v2);

        const forceExclude = (base, seed) => {
          const excNames = new Set([
            ...state.excludedCourses.map(n => n.trim().toLowerCase()),
            ...base.slice(0, Math.ceil(base.length / 2)).map(c => c.name.trim().toLowerCase())
          ]);
          const fakeState = { ...state, excludedCourses: [...excNames] };
          return generateVariant(fakeState, { ...options, shuffleSeed: seed });
        };

        const variants = [
          { schedule: v0 },
          { schedule: k1 === k0 ? forceExclude(v0, seedB + 17) : v1 },
          { schedule: k2 === k0 || k2 === k1 ? forceExclude(v0, seedC + 37) : v2 }
        ];

        // 湲대컯??寃쎄퀬 怨꾩궛
        const _comp    = new Set((state.completedCourses || []).map(n => n.trim().toLowerCase()));
        const _past    = getPastTimetableCourseNames(state);
        const _isDone  = c => _comp.has(c.name.trim().toLowerCase()) || _past.has(c.name.trim().toLowerCase());
        const _doneG   = REQUIRED_LIBERAL_GROUPS.filter(g => _allCourses.some(c => getRequiredGroup(c) === g.label && _isDone(c))).length;
        const _doneA   = REQUIRED_GYUNHYUNG_AREAS.filter(a => _allCourses.some(c => c.category === '洹좏삎援먯뼇' && c.subtitle === a && _isDone(c))).length;
        const _unfull  = (REQUIRED_LIBERAL_GROUPS.length - _doneG) + (REQUIRED_GYUNHYUNG_AREAS.length - _doneA);
        const _semOrd  = ((_autoGrade || 1) - 1) * 2 + (['2?숆린','寃⑥슱?숆린'].includes(state.semester) ? 2 : 1);
        const _remain  = Math.max(1, 8 - _semOrd);
        const _urgency = _unfull / _remain;
        renderUrgencyWarning(_urgency, _unfull, _remain, _autoPrefs.has('liberal_req_first'));

        renderAutoResults(variants, state);
      } finally {
        btn.textContent = '???쒓컙???먮룞 ?앹꽦';
        btn.disabled = false;
      }
    }, 60);
  });
}

/* ============================================================
   Init
   ============================================================ */
async function init() {
  const page = document.body.dataset.page;

  if (page === 'login') {
    if (getSession()) { location.href = 'index.html'; return; }
    await setupLoginPage();
    return;
  }

  if (!getSession()) { location.href = 'login.html'; return; }

  setupLogout();
  setupSidebarToggle();
  const state = loadState();

  if (page === 'index')    setupIndexPage(state);
  if (page === 'generate') setupGeneratePage(state);
  if (page === 'settings') await setupSettingsPage(state);
  if (page === 'signup')   location.href = getSession() ? 'index.html' : 'login.html';
}

document.addEventListener('DOMContentLoaded', init);

/* ============================================================
   ?꾩튂 湲곕컲 ?대룞 ?뺣낫 紐⑤뱢
   ============================================================ */

/* ?? 李쎌썝? 嫄대Ъ 醫뚰몴 ?뚯씠釉??? */
const BUILDING_COORDS = {
  '11':  { lat: 35.2463093, lng: 128.6921212, name: '11?멸?' },
  '22':  { lat: 35.2474355, lng: 128.6921226, name: '22?멸?' },
  '32':  { lat: 35.2454557, lng: 128.6950178, name: '32?멸?' },
  '33':  { lat: 35.2443687, lng: 128.6932992, name: '33?멸?' },
  '34':  { lat: 35.2459461, lng: 128.6948307, name: '34?멸?' },
  '35':  { lat: 35.2448000, lng: 128.6943000, name: '35?멸?' },
  '41':  { lat: 35.2443812, lng: 128.6926772, name: '41?멸?' },
  '4??: { lat: 35.2443812, lng: 128.6926772, name: '41?멸?' },
  '50':  { lat: 35.2419925, lng: 128.6982163, name: '50?멸?' },
  '52':  { lat: 35.2416249, lng: 128.6993138, name: '52?멸?' },
  '53':  { lat: 35.2413921, lng: 128.6977360, name: '53?멸?' },
  '54':  { lat: 35.2411474, lng: 128.6987354, name: '54?멸?' },
  '55':  { lat: 35.2413997, lng: 128.6958770, name: '55?멸?' },
  '61':  { lat: 35.2451384, lng: 128.6962653, name: '61?멸?' },
  '62':  { lat: 35.2446674, lng: 128.6966943, name: '62?멸?' },
  '63':  { lat: 35.2441996, lng: 128.6962994, name: '63?멸?' },
  '64':  { lat: 35.2456716, lng: 128.6958435, name: '64?멸?' },
  '81':  { lat: 35.2428419, lng: 128.6979290, name: '81?멸?' },
  '8??: { lat: 35.2428419, lng: 128.6979290, name: '81?멸?' },
  '85':  { lat: 35.2408562, lng: 128.6973639, name: '85?멸?' },
  '86':  { lat: 35.2477478, lng: 128.6947957, name: '86?멸?' },
  '98':  { lat: 35.2419937, lng: 128.6942744, name: '98?멸?' },
  'B21': { lat: 35.2447500, lng: 128.6941000, name: 'B21?멸?' },
  'N98': { lat: 35.2418000, lng: 128.6940000, name: 'N98?멸?' },
  'T98': { lat: 35.2421000, lng: 128.6944000, name: 'T98?멸?' },
};

/* ?? 媛뺤쓽??肄붾뱶 ??嫄대Ъ 踰덊샇 異붿텧 ?? */
function getRoomBuilding(room) {
  if (!room || room === '99999') return null;
  const m5   = room.match(/^(\d{2})\d{3}(-\d)?$/);   if (m5)   return m5[1];
  const mPfx = room.match(/^([A-Z]+\d+)\d{3}(-\d)?$/); if (mPfx) return mPfx[1];
  const m4   = room.match(/^(\d)\d{3}(-\d)?$/);       if (m4)   return m4[1] + '동';
  return null;
}

/* ── 지도 상수 (OSM / Leaflet) ── */
const OSM_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
