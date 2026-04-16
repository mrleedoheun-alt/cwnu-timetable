/* ============================================================
   Constants & Storage Keys
   ============================================================ */
const USERS_KEY    = 'tt_users_v1';
const SESSION_KEY  = 'tt_session_v1';
const STATE_PREFIX = 'tt_state_v1_';

// 학과 목록은 courses.json에서 동적으로 로드 (아래 loadDepartments 참조)
let DEPARTMENTS = [];

const DAY_NAMES   = ['월', '화', '수', '목', '금'];
const HOUR_ROWS   = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];
const HOUR_ROWS_END = '18:00';

// 에브리타임 스타일 파스텔 팔레트
const COLORS = [
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

// 카테고리별 고정 색상
const CAT_COLORS = {
  '전공필수': { bg: '#ffd6d6', border: '#e05555', text: '#8b0000' },
  '전공선택': { bg: '#ffdfc8', border: '#e07040', text: '#7a3000' },
  '융합전공필수': { bg: '#ffe8e8', border: '#c0392b', text: '#7b0000' },
  '융합전공': { bg: '#ffd6f0', border: '#d4509a', text: '#7a0050' },
  '기초교양': { bg: '#d6f5d6', border: '#4caf50', text: '#1b5e20' },
  '균형교양': { bg: '#c8e8ff', border: '#3a8fd4', text: '#0d3c6e' },
  '확대교양': { bg: '#e8d6ff', border: '#8b5cf6', text: '#4c1d95' },
  '자유선택':  { bg: '#d6fff5', border: '#0ea87a', text: '#004d38' },
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
  studentId: '', department: '', year: '', semester: '1학기',
  totalCredits: 0, prevGpa: 3.6, appliedCredits: 0, maxCredits: 20,
  timetables: {},        // { "2026_1학기": [...courses], "2025_2학기": [...] }
  courses: [],           // 하위호환: index 페이지에서 현재 학기 courses 참조
  completedCourses: [],  // array of course names already taken
  excludedCourses: [],   // array of course names to exclude from auto-gen
  pinnedCourses: [],     // array of course names to force-include in auto-gen
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
    migrateLegacyCourses(state); // 기존 단일 courses 배열 → timetables 마이그레이션
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
  return `${year}_${semester || '1학기'}`;
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
  // state.courses는 현재 선택 학기를 mirror (index 페이지 호환용)
  if (k === ttKey(state.year, state.semester)) state.courses = courses;
}
// 기존 state.courses(단일 배열)를 timetables로 마이그레이션
function migrateLegacyCourses(state) {
  if (!state.timetables) state.timetables = {};
  if (state.courses?.length) {
    const k = ttKey(state.year || new Date().getFullYear(), state.semester || '1학기');
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
  sel.innerHTML = `<option value="">학과 선택</option>` + DEPARTMENTS.map(d =>
    `<option value="${d}" ${d === selected ? 'selected' : ''}>${d}</option>`
  ).join('');
}

async function loadDepartments() {
  if (DEPARTMENTS.length > 0) return; // 이미 로드됨
  try {
    const res  = await fetch('data/courses.json');
    const data = await res.json();
    const depts = [...new Set(
      data.filter(c => c.type === 'major' && c.department).map(c => c.department)
    )].sort((a, b) => a.localeCompare(b, 'ko'));
    DEPARTMENTS = depts;
  } catch {
    // fallback: 빈 목록
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
      // 카테고리 고정색 우선, 없으면 팔레트 순환
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
  const dayCol    = opts.dayCol   || (mini ? 62 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--day-col')) || 108);
  const hourH     = opts.hourH    || (mini ? 44 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hour-h'))  || 60);
  const timeColW  = opts.timeColW || (mini ? 32 : 48);
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
  top.innerHTML = `<div class="corner">시간</div>` +
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
    const block = document.createElement('div');
    block.className = 'course-block';
    block.style.cssText = `
      left:${leftPx}px; top:${topPx + 1}px;
      width:${widthPx}px; height:${heightPx - 2}px;
      background:${color.bg}; border:1.5px solid ${color.border}; color:${color.text};
    `;
    block.dataset.name = slot.name;
    block.innerHTML = `
      <div class="course-title">${slot.name}</div>
      ${!mini ? `<div class="course-meta">${slot.start}–${slot.end}</div>` : ''}
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
      return `<option value="${v}" ${v === safe ? 'selected' : ''}>${v}학점</option>`;
    }).join('');
    if (helpEl) helpEl.textContent = gpa >= 3.8
      ? '직전학기 성적 3.8 이상 → 최대 23학점'
      : '기본 최대 신청학점은 20학점입니다.';
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

  // 학과 목록 로드 후 select 채우기
  await loadDepartments();
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
    if (!/^\d{8}$/.test(sid)) return showErr(loginErr, '학번은 8자리 숫자로 입력해 주세요.');
    if (!pass)                 return showErr(loginErr, '비밀번호를 입력해 주세요.');
    const user = findUser(sid);
    if (!user)              return showErr(loginErr, '등록되지 않은 학번입니다. 회원가입을 해주세요.');
    if (user.password !== pass) return showErr(loginErr, '비밀번호가 일치하지 않습니다.');
    setSession(sid);
    location.href = 'index.html';
  });

  // Signup
  document.getElementById('signupBtn')?.addEventListener('click', () => {
    const sid   = document.getElementById('signupStudentId').value.trim();
    const dept  = document.getElementById('signupDepartment')?.value || '';
    const pass  = document.getElementById('signupPassword').value;
    const pass2 = document.getElementById('signupPasswordConfirm').value;
    if (!/^\d{8}$/.test(sid)) return showErr(signupErr, '학번은 8자리 숫자로 입력해 주세요.');
    if (!dept)                 return showErr(signupErr, '학과를 선택해 주세요.');
    if (pass.length < 4)       return showErr(signupErr, '비밀번호는 4자 이상 입력해 주세요.');
    if (pass !== pass2)        return showErr(signupErr, '비밀번호가 일치하지 않습니다.');
    if (findUser(sid))         return showErr(signupErr, '이미 등록된 학번입니다. 로그인해 주세요.');
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
  if (semSel) semSel.value = state.semester || '1학기';

  const refreshIndex = () => {
    state.year     = yearSel?.value || state.year;
    state.semester = semSel?.value  || state.semester;
    // 현재 선택 학기 시간표 반영
    state.courses = getTimetable(state, state.year, state.semester);
    saveState(state);
    updateSummary(state);
    renderTimetable(container, state.courses);
    setupBlockClicks(container, state);
  };

  yearSel?.addEventListener('change', refreshIndex);
  semSel?.addEventListener('change',  refreshIndex);

  // 현재 학기 시간표 로드
  state.courses = getTimetable(state, state.year, state.semester);
  updateSummary(state);

  const container = document.getElementById('timetableContainer');
  renderTimetable(container, state.courses);
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
      // 재렌더 후 새 layer에 이벤트 재연결
      setupBlockClicks(container, state);
    });
  }, { once: true });
}

function semOrdinal(sem) {
  return ({ '1학기': 1, '여름학기': 2, '2학기': 3, '겨울학기': 4 })[sem] ?? 3;
}

/* 해당 학년도+학기가 현재 시점 기준으로 이미 끝났는지 판단
   1학기: 3~7월 → 8월 이후부터 종료로 간주
   여름학기: 7~8월 → 9월 이후부터 종료로 간주
   2학기: 9~12월 → 다음해부터 종료로 간주
   겨울학기: 1~2월 → 3월 이후(같은 해 혹은 다음해)부터 종료로 간주 */
function isPastSemester(year, sem) {
  const now  = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1; // 1~12
  const yr   = Number(year);
  if (yr < nowY) return true;
  if (yr > nowY) return false;
  // 같은 연도
  if (sem === '1학기')   return nowM >= 7;   // 7월 이후면 1학기 종료
  if (sem === '여름학기') return nowM >= 9;   // 9월 이후면 여름학기 종료
  if (sem === '2학기')   return false;        // 2학기는 같은 해엔 아직 안 끝남
  if (sem === '겨울학기') return false;        // 겨울학기도 마찬가지
  return false;
}

/* 지난 학기 timetables에서 과목명 Set 반환 */
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

/* ── Course block popup (index page) ── */
let _popup = null;
function showCoursePopup(block, courseName, state, onDelete) {
  closePopup();

  const course = state.courses.find(c => c.name === courseName);
  const rect   = block.getBoundingClientRect();

  const popup = document.createElement('div');
  popup.className = 'course-popup';
  popup.innerHTML = `
    <div class="popup-name">${courseName}</div>
    ${course?.professor ? `<div class="popup-meta">👤 ${course.professor}</div>` : ''}
    ${course?.category  ? `<div class="popup-meta">📚 ${course.category}${course.subtitle ? ' · '+course.subtitle : ''}</div>` : ''}
    ${course?.credits   ? `<div class="popup-meta">✏️ ${course.credits}학점</div>` : ''}
    <button class="popup-del-btn" type="button">시간표에서 삭제</button>
  `;

  // Position popup
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;
  popup.style.top  = `${rect.bottom + scrollY + 8}px`;
  popup.style.left = `${rect.left  + scrollX}px`;
  document.body.appendChild(popup);
  _popup = popup;

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
let _myDepartment   = '';   // 로그인한 사용자의 학과
let _gradReqs       = null; // loaded from data/all_grad_reqs.json
let _currentState   = null; // reference to current page state

// Filter state
let _activeType     = '';   // '' | 'liberal' | 'major'
let _activeDept     = '';   // major: 학과명
let _activeCategory = '';   // liberal: category
let _activeSubtitle = '';   // liberal: subtitle
let _activeYear     = 0;    // 0=전체 1~4=학년

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
  // 기본 선택: 저장된 year > 현재 연도. admYear는 선택 범위 시작값일 뿐
  const defaultYear = state.year || new Date().getFullYear();
  fillYearOptions(yearSel, defaultYear, admYear);
  if (semSel) semSel.value = state.semester || '1학기';

  const reloadCourses = () => {
    state.year     = yearSel?.value || state.year;
    state.semester = semSel?.value  || state.semester;
    // 해당 학기에 저장된 시간표 불러오기
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

  // 내 학과 세팅
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

// 학과+학년+학기 기준 로드맵 과목명 목록 반환
function getRoadmapCourses(dept, grade, semester) {
  if (!_roadmap || !dept) return [];
  const deptMap = _roadmap[dept];
  if (!deptMap) return [];
  const semKey = String(semester).replace('학기', '').trim(); // '1학기' → '1'
  return (deptMap[String(grade)]?.[semKey]) || [];
}

// 현재 로드된 학년도/학기 기록 (중복 로드 방지)
let _loadedTerm = '';

async function loadCoursesForTerm(year, semester) {
  const statusEl  = document.getElementById('courseLoadStatus');
  const noticeEl  = document.getElementById('fallbackNotice');
  const y   = year     || String(new Date().getFullYear());
  const sem = semester || '1학기';
  const url = `/api/courses?year=${encodeURIComponent(y)}&semester=${encodeURIComponent(sem)}`;

  if (statusEl) { statusEl.textContent = '로딩중…'; statusEl.className = 'status-badge warn'; }
  if (noticeEl) noticeEl.classList.add('hidden');

  try {
    const res  = await fetch(url);

    // 202: 서버에서 크롤링 중 → 5초 후 자동 재시도
    if (res.status === 202) {
      if (statusEl) { statusEl.textContent = '수집중…'; statusEl.className = 'status-badge warn'; }
      const listEl = document.getElementById('courseList');
      if (listEl) listEl.innerHTML = `<div class="course-list-empty">
        <strong>${y} ${sem}</strong> 강의 데이터를 처음 수집 중입니다.<br>
        <small>잠시 후 자동으로 다시 불러옵니다…</small>
      </div>`;
      setTimeout(() => loadCoursesForTerm(year, semester), 5000);
      return;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    _allCourses = data;

    // 폴백 여부 확인 (서버 헤더)
    const isFallback   = res.headers.get('X-Is-Fallback') === 'true';
    const actualYear   = res.headers.get('X-Actual-Year') || y;
    const actualSemRaw = res.headers.get('X-Actual-Semester') || encodeURIComponent(sem);
    const actualSem    = (() => { try { return decodeURIComponent(actualSemRaw); } catch { return sem; } })();

    if (statusEl) {
      statusEl.textContent = `${_allCourses.length}개 강의`;
      statusEl.className   = 'status-badge ok';
    }

    // 폴백 안내 배지 표시
    if (noticeEl) {
      if (isFallback && (actualYear !== y || actualSem !== sem)) {
        noticeEl.textContent = `📅 ${y} ${sem} 미개설 → ${actualYear} ${actualSem} 기준으로 표시`;
        noticeEl.classList.remove('hidden');
      } else {
        noticeEl.classList.add('hidden');
      }
    }

    buildTypePills();
    renderCourseList();
  } catch (err) {
    if (statusEl) { statusEl.textContent = '로드 실패'; statusEl.className = 'status-badge warn'; }
    const listEl = document.getElementById('courseList');
    if (listEl) listEl.innerHTML = `<div class="course-list-empty">강의 데이터를 불러오지 못했습니다.<br><small>${err.message}</small></div>`;
  }
}

/* ============================================================
   3단계 필터 pill 시스템
   ① 교양/전공  ② 교양→분류 / 전공→학과  ③ 교양→세부 / 전공→학년
   ============================================================ */

/* ① 타입 pills: [전체] [교양] [내 전공] */
function buildTypePills() {
  const row = document.getElementById('catFilterRow');
  if (!row) return;

  // 내 학과 전공 과목 수
  const myDept      = _myDepartment;
  const myMajorCount = myDept
    ? _allCourses.filter(c => c.type === 'major' && c.department === myDept).length
    : _allCourses.filter(c => c.type === 'major').length;

  const types = [
    { val: '',           label: '전체',   count: _allCourses.length },
    { val: 'liberal',    label: '교양',   count: _allCourses.filter(c => c.type === 'liberal').length },
    { val: 'major',      label: myDept ? `내 전공 (${myDept})` : '전공', count: myMajorCount },
    { val: '자유선택',   label: '자유선택', count: _allCourses.filter(c => c.type === '자유선택').length }
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

/* ② 두 번째 행: 교양→분류 / 전공→학과 */
function buildSecondRow() {
  const row = document.getElementById('subFilterRow');
  if (!row) return;

  if (!_activeType) { row.classList.add('hidden'); buildThirdRow(); return; }

  // 자유선택 탭: 세부 필터 불필요 → 숨김
  if (_activeType === '자유선택') {
    row.classList.add('hidden');
    buildThirdRow();
    return;
  }

  row.classList.remove('hidden');

  if (_activeType === 'liberal') {
    // 교양 카테고리 pills
    const cats = [...new Set(
      _allCourses.filter(c => c.type === 'liberal').map(c => c.category).filter(Boolean)
    )];
    const libBase = _allCourses.filter(c => c.type === 'liberal');
    row.innerHTML = makeRow([
      { val: '', label: '전체', count: libBase.length },
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
    // 전공: 내 학과가 있으면 자동 선택, 없으면 전체 학과 목록
    if (_myDepartment) {
      // 내 학과 자동 고정 → 2단계 행 숨김
      _activeDept = _myDepartment;
      row.classList.add('hidden');
      buildThirdRow();
      return;
    }

    // 학과 선택 pills (학과명 오름차순)
    const depts = [...new Set(
      _allCourses.filter(c => c.type === 'major' && c.department).map(c => c.department)
    )].sort((a, b) => a.localeCompare(b, 'ko'));
    const majBase = _allCourses.filter(c => c.type === 'major');
    row.innerHTML = makeRow([
      { val: '', label: '전체', count: majBase.length },
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

/* ③ 세 번째 행: 교양→세부분류 / 전공→학년 */
function buildThirdRow() {
  const row = document.getElementById('thirdFilterRow');
  if (!row) return;

  if (_activeType === 'liberal' && _activeCategory) {
    // 세부분류 pills
    const subs = [...new Set(
      _allCourses.filter(c => c.type === 'liberal' && c.category === _activeCategory && c.subtitle).map(c => c.subtitle)
    )];
    if (!subs.length) { row.classList.add('hidden'); return; }
    const base = _allCourses.filter(c => c.type === 'liberal' && c.category === _activeCategory);
    row.classList.remove('hidden');
    row.innerHTML = makeRow([
      { val: '', label: '전체', count: base.length },
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
    // 학년 pills
    const base = _allCourses.filter(c => c.type === 'major' && c.department === _activeDept);
    row.classList.remove('hidden');
    row.innerHTML = makeRow([
      { val: '0', label: '전 학년', count: base.length },
      ...[1,2,3,4].map(y => ({
        val: String(y), label: `${y}학년`,
        count: base.filter(c => c.eligible_years?.includes(y)).length
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

/* pill HTML 생성 헬퍼 */
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
      if (_activeYear && !c.eligible_years?.includes(_activeYear)) return false;
    }
    if (query && !c.name.toLowerCase().includes(query) &&
        !(c.professor   || '').toLowerCase().includes(query) &&
        !(c.subtitle    || '').toLowerCase().includes(query) &&
        !(c.department  || '').toLowerCase().includes(query)) return false;
    return true;
  });

  if (countEl) countEl.textContent = `${filtered.length}개 강의`;

  if (!filtered.length) {
    listEl.innerHTML = '<div class="course-list-empty">검색 결과가 없습니다.</div>';
    return;
  }

  listEl.innerHTML = filtered.map(course => {
    const isAdded = _selected.some(s => s.name === course.name && s.section === course.section);
    const slotText = course.slots.map(s =>
      `${DAY_NAMES[s.day] || '?'} ${s.start}–${s.end}`
    ).join(' / ');

    // 학년 뱃지
    const yearBadge = course.eligible_years?.length
      ? `<span class="year-badge">${course.eligible_years.map(y => `${y}학년`).join('·')}</span>`
      : '';
    // 학과 뱃지: 내 학과로 필터 중이면 생략, 아니면 표시
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
            <span class="credit-text">${course.credits}학점</span>
          </div>
          <div class="course-card-time">${slotText}</div>
        </div>
        <button class="add-btn ${isAdded ? 'added' : ''}" type="button"
                data-name="${esc(course.name)}" data-section="${esc(course.section || '')}">
          ${isAdded ? '✓' : '+'}
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
      alert(`시간 충돌: "${conflict}" 강의와 시간이 겹칩니다.`);
      return;
    }
    _selected.push(course);
  }
  renderCourseList();
  renderSelectedList();
  renderMiniTimetable();
  if (_gradReqs && _currentState) renderGradReq(_currentState);
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
  if (infoEl) infoEl.textContent = `${_selected.length}개 · ${totalCredits}학점`;

  if (!_selected.length) {
    listEl.classList.add('empty');
    listEl.innerHTML = '왼쪽에서 강의를 담아주세요';
    return;
  }

  listEl.classList.remove('empty');
  listEl.innerHTML = _selected.map(c => `
    <div class="selected-item">
      <div class="selected-item-info">
        <div class="selected-item-name">${c.name}</div>
        <div class="selected-item-meta">
          ${c.category} · ${c.credits}학점
          ${c.professor ? ` · ${c.professor}` : ''}
        </div>
      </div>
      <button class="remove-btn" type="button"
              data-name="${esc(c.name)}" data-section="${esc(c.section || '')}">×</button>
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
    // 실제 렌더링 너비 기준으로 dayCol 계산
    const containerW = el.getBoundingClientRect().width || el.offsetWidth || 300;
    const timeColW   = 32;
    const dayCol     = Math.max(40, Math.floor((containerW - timeColW - 2) / 5));
    renderTimetable(el, _selected, { mini: true, dayCol, timeColW });
  };
  // 레이아웃이 완성된 후 실행
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
    if (!/^\d{8}$/.test(id)) { alert('학번은 8자리 숫자로 입력해 주세요.'); sidInp?.focus(); return; }
    if (!dept)                { alert('학과를 선택해 주세요.'); deptSel?.focus(); return; }

    const users = getUsers();
    const idx   = users.findIndex(u => u.studentId === state.studentId);
    if (idx >= 0) {
      users[idx].studentId  = id;
      users[idx].department = dept;
      saveUsers(users);
    }

    // 학번이 바뀌면 기존 state를 새 키로 이전
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
    alert('설정이 저장되었습니다.');
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

/* ============================================================
   Helpers
   ============================================================ */
function esc(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function catClass(cat) {
  if (cat === '전공필수')   return 'req';
  if (cat === '전공선택')   return 'elec';
  if (cat === '융합전공필수') return 'fusion-req';
  if (cat === '융합전공')   return 'fusion';
  if (cat === '기초교양')   return 'basic';
  if (cat === '균형교양')   return 'balance';
  if (cat === '확대교양')   return 'expand';
  if (cat === '자유선택')   return 'free';
  return 'other';
}

/* ============================================================
   Auto Timetable Generation
   ============================================================ */

// State
let _autoGrade = 0;
const _autoPrefs = new Set();

const STYLE_META = {
  avoid_morning:  { label: '아침 회피형',    desc: '9시~10시 이전 수업을 최대한 배제합니다.' },
  avoid_gap:      { label: '우주공강 회피',   desc: '같은 날 긴 공강(1시간 이상)이 생기지 않도록 합니다.' },
  cluster:        { label: '몰아듣기형',     desc: '수업이 적은 날 수를 만들어 공강일을 확보합니다.' },
  spread:         { label: '널널한 분산형',   desc: '요일별로 고르게 분산하여 과부하 없이 구성합니다.' },
  major_first:    { label: '전공 우선',       desc: '전공 과목을 최대한 채운 뒤 교양으로 나머지를 채웁니다.' },
  liberal_first:  { label: '교양 우선',       desc: '교양 과목을 먼저 채운 뒤 전공 선택으로 마무리합니다.' }
};

/* ── 과목 슬롯 → 분 단위 변환 ── */
function courseToFlat(course) {
  return (course.slots || []).map(s => ({
    day:       s.day,
    start_min: timeToMin(s.start),
    end_min:   timeToMin(s.end)
  })).filter(s => s.start_min < s.end_min && s.day >= 0 && s.day <= 4);
}

/* ── 충돌 검사 ── */
function flatConflict(aSlots, bSlots) {
  return aSlots.some(a => bSlots.some(b =>
    a.day === b.day && a.start_min < b.end_min && a.end_min > b.start_min
  ));
}

/* ── 스코어링: 이 과목을 추가했을 때 얼마나 선호도에 맞는가 ── */
function scoreCourse(course, usedFlat, prefs) {
  const cFlat   = courseToFlat(course);
  const allFlat = [...usedFlat, ...cFlat];
  let score = 0;

  // 아침 회피형
  if (prefs.has('avoid_morning')) {
    cFlat.forEach(s => {
      if (s.start_min < 9 * 60)        score -= 40;  // 09:00 이전
      else if (s.start_min < 9.5 * 60) score -= 20;  // 09:00~09:30
      else if (s.start_min < 10 * 60)  score -= 8;   // 09:30~10:00
    });
  }

  // 우주공강 회피형: 추가 후 당일 공강 계산
  if (prefs.has('avoid_gap')) {
    for (let day = 0; day < 5; day++) {
      const daySlots = allFlat.filter(s => s.day === day)
        .sort((a, b) => a.start_min - b.start_min);
      for (let i = 1; i < daySlots.length; i++) {
        const gap = daySlots[i].start_min - daySlots[i - 1].end_min;
        if (gap > 120) score -= 30;
        else if (gap > 60)  score -= 15;
        else if (gap > 0)   score -= 3;
      }
    }
  }

  // 몰아듣기형: 이미 수업 있는 날 추가 선호
  if (prefs.has('cluster')) {
    const usedDays = new Set(usedFlat.map(s => s.day));
    cFlat.forEach(s => {
      if (usedDays.has(s.day)) score += 25;
      else                     score -= 10;
    });
  }

  // 널널한 분산형: 새로운 요일 선호
  if (prefs.has('spread')) {
    const usedDays = new Set(usedFlat.map(s => s.day));
    cFlat.forEach(s => {
      if (!usedDays.has(s.day)) score += 20;
      else                      score -= 5;
    });
  }

  return score;
}

/* ── 과목명 정규화 (★ 등 제거, 중복 방지용) ── */
function normName(name) {
  return name.replace(/★/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/* ── 기본 과목명 추출 (괄호 설명, ★ 제거 → 수강완료 비교용) ── */
function baseName(name) {
  return name
    .replace(/★/g, '')
    .replace(/\s*\([^)]*\)\s*/g, '') // (괄호 내용) 전체 제거
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/* ── 기초교양 필수 이수 그룹 (전교 공통, subtitle 기준) ── */
const REQUIRED_LIBERAL_GROUPS = [
  { label: 'AI융합기초',     picks: 1, subtitle: 'AI융합기초' },
  { label: '열린사고와표현', picks: 1, subtitle: '열린사고와표현' },
  { label: '글로벌의사소통', picks: 1, subtitle: '글로벌의사소통' },
];

/* ── 과목이 어느 필수 그룹에 속하는지 반환 ── */
function getRequiredGroup(course) {
  if (course.type !== 'liberal' || course.category !== '기초교양') return null;
  const g = REQUIRED_LIBERAL_GROUPS.find(x => x.subtitle && course.subtitle === x.subtitle);
  return g ? g.label : null;
}

/* ── 학년별 교양 풀 ── */
function getLiberalPool(grade) {
  return _allCourses.filter(c => {
    if (c.type !== 'liberal') return false;
    if (c.eligible_years?.length && !c.eligible_years.includes(grade)) return false;
    return true;
  });
}

/* ── 한 가지 시간표 변형 생성 ── */
function generateVariant(state, { grade, prefs, inclRequired, inclElective, inclLiberal, shuffleSeed = 0 }) {
  const dept      = state.department || '';
  const maxCr     = state.maxCredits || 18;
  const completed = new Set((state.completedCourses || []).map(n => n.trim().toLowerCase()));
  const excluded  = new Set((state.excludedCourses  || []).map(n => n.trim().toLowerCase()));
  const allowRtk  = state.allowRetake || false;

  let schedule = [];
  let usedFlat = [];
  let totalCr  = 0;

  /* 수강완료 과목 제외 (재수강 허용 시 포함) */
  const isCompleted = (course) => !allowRtk && (
    completed.has(course.name.trim().toLowerCase()) ||
    completed.has(normName(course.name)) ||
    completed.has(baseName(course.name))
  );

  /* 제외 과목 체크 */
  const isExcluded = (course) => (
    excluded.has(course.name.trim().toLowerCase()) ||
    excluded.has(normName(course.name)) ||
    excluded.has(baseName(course.name))
  );

  /* 추가 가능 여부 판단 */
  const canAdd = (course) => {
    const cr = Number(course.credits) || 0;
    if (cr === 0) return false;
    if (course.type === '교직' || course.category === '교직') return false;
    if (isCompleted(course)) return false;
    if (isExcluded(course)) return false;
    if (totalCr + cr > maxCr) return false;
    const cFlat = courseToFlat(course);
    if (!cFlat.length) return false;
    if (flatConflict(cFlat, usedFlat)) return false;
    // ★ 정규화 + 괄호 설명 제거: 같은 과목명 중복 방지
    if (schedule.some(s =>
      normName(s.name) === normName(course.name) ||
      baseName(s.name) === baseName(course.name)
    )) return false;
    // 같은 필수 그룹에서 이미 1과목 이수한 경우 추가 차단 (단, picks > 1인 그룹 제외)
    const grp = getRequiredGroup(course);
    if (grp) {
      const g = REQUIRED_LIBERAL_GROUPS.find(x => x.label === grp);
      const alreadyInGroup = schedule.filter(s => getRequiredGroup(s) === grp).length;
      if (g && alreadyInGroup >= g.picks) return false;
    }
    return true;
  };

  /* 과목 추가 */
  const addCourse = (course) => {
    schedule.push(course);
    usedFlat.push(...courseToFlat(course));
    totalCr += Number(course.credits) || 0;
  };

  /* 간단한 seeded PRNG (mulberry32 계열) */
  let _rngState = shuffleSeed * 2654435761 >>> 0 || 1;
  const rng = () => {
    _rngState ^= _rngState << 13; _rngState ^= _rngState >> 17; _rngState ^= _rngState << 5;
    return ((_rngState >>> 0) / 4294967296);
  };

  /* 풀에서 베스트 섹션 선택 (shuffleSeed로 강하게 변형) */
  const pickBest = (pool) => {
    const valid = pool.filter(canAdd);
    if (!valid.length) return null;
    const noise = shuffleSeed ? 18 : 0;
    const scored = valid.map(c => ({
      c, s: scoreCourse(c, usedFlat, prefs) + (noise ? (rng() - 0.5) * noise : 0)
    })).sort((a, b) => b.s - a.s);
    return scored[0].c;
  };

  /* 과목명으로 묶어서 베스트 섹션만 추가 (★·괄호 정규화 적용) */
  const addPoolByName = (pool) => {
    // baseName 기준으로 그룹화 (괄호 설명·★ 제거 후 동일 과목 묶기)
    const nameMap = new Map();
    for (const c of pool) {
      const key = baseName(c.name);
      if (!nameMap.has(key)) nameMap.set(key, []);
      nameMap.get(key).push(c);
    }
    const keys = [...nameMap.keys()];
    if (shuffleSeed) keys.sort(() => rng() - 0.5);
    for (const key of keys) {
      if (totalCr >= maxCr) break;
      const best = pickBest(nameMap.get(key));
      if (best) addCourse(best);
    }
  };

  /* 과목 전체를 스코어순으로 추가 (섹션 중복 제거, ★·괄호 정규화 적용) */
  const addPoolGreedy = (pool) => {
    const usedBaseNames = new Set(schedule.map(c => baseName(c.name)));
    const candidates = pool
      .filter(c => !usedBaseNames.has(baseName(c.name)) && canAdd(c))
      .map(c => ({
        c,
        s: scoreCourse(c, usedFlat, prefs) + (shuffleSeed ? (rng() - 0.5) * 18 : 0)
      }))
      .sort((a, b) => b.s - a.s);

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

  // ① 로드맵 과목 우선 강제 포함 (해당 학년·학기 이수체계도 과목)
  const semNum = String(state.semester || '1학기').replace('학기','').trim();
  const roadmapNames = getRoadmapCourses(dept, grade, semNum);
  if (roadmapNames.length) {
    const usedBase = new Set(schedule.map(c => baseName(c.name)));
    for (const name of roadmapNames) {
      if (totalCr >= maxCr) break;
      const bn = baseName(name);
      if (usedBase.has(bn)) continue;
      // 같은 이름의 과목 모든 분반 중 추가 가능한 것 선택 (shuffleSeed로 변형)
      // 전공 과목은 내 학과 것만 허용, 교양 과목은 학과 무관
      const candidates = _allCourses.filter(c =>
        baseName(c.name) === bn && canAdd(c) &&
        (c.type !== 'major' || !dept || c.department === dept)
      );
      if (!candidates.length) continue;
      // 시간 충돌 없는 후보 중 점수 최고 선택
      const valid = candidates.filter(c => !checkConflict(c, schedule));
      if (!valid.length) continue;
      const picked = valid.sort((a, b) =>
        scoreCourse(b, usedFlat, prefs) - scoreCourse(a, usedFlat, prefs)
      )[shuffleSeed ? Math.floor(rng() * Math.min(valid.length, 2)) : 0];
      if (picked) { addCourse(picked); usedBase.add(bn); }
    }
  }

  // ② 전공필수 (로드맵에 없는 것)
  if (inclRequired) {
    const req = _allCourses.filter(c =>
      c.type === 'major' && c.category === '전공필수' &&
      c.department === dept && c.eligible_years?.includes(grade)
    );
    addPoolByName(req);
  }

  // ③ 전공선택
  const fillElective = () => {
    if (!inclElective || totalCr >= maxCr) return;
    const elec = _allCourses.filter(c =>
      c.type === 'major' && c.category === '전공선택' &&
      c.department === dept && c.eligible_years?.includes(grade)
    );
    addPoolGreedy(elec);
  };

  // ④ 꼭 듣고 싶은 강의 — 전공 다음, 교양 이전
  const fillPinned = () => {
    const pinned = (state.pinnedCourses || []).map(n => n.trim().toLowerCase());
    for (const pname of pinned) {
      if (totalCr >= maxCr) break;
      const candidates = _allCourses.filter(c =>
        c.name.trim().toLowerCase() === pname && !flatConflict(courseToFlat(c), usedFlat) &&
        schedule.every(s => normName(s.name) !== normName(c.name))
      );
      if (!candidates.length) continue;
      const scored = candidates
        .map(c => ({ c, s: scoreCourse(c, usedFlat, prefs) + (shuffleSeed ? (rng() - 0.5) * 10 : 0) }))
        .sort((a, b) => b.s - a.s);
      addCourse(scored[0].c);
    }
  };

  /* ── 기초교양 필수 그룹에서 각각 1과목씩 먼저 채우기 ── */
  const fillRequiredLiberalGroups = () => {
    if (!inclLiberal || totalCr >= maxCr) return;
    const liberalPool = getLiberalPool(grade);
    for (const group of REQUIRED_LIBERAL_GROUPS) {
      if (totalCr >= maxCr) break;
      const alreadyHas = schedule.some(s => getRequiredGroup(s) === group.label);
      if (alreadyHas) continue;
      const groupPool = liberalPool.filter(c => getRequiredGroup(c) === group.label);
      if (!groupPool.length) continue;
      const best = pickBest(groupPool);
      if (best) addCourse(best);
    }
  };

  const fillLiberal = () => {
    if (!inclLiberal || totalCr >= maxCr) return;
    addPoolGreedy(getLiberalPool(grade));
  };

  // 기초교양 필수 그룹 먼저 (전공우선이 아닌 이상)
  if (!prefs.has('major_first')) {
    fillRequiredLiberalGroups();
  }

  if (prefs.has('major_first')) {
    fillElective(); fillPinned(); fillRequiredLiberalGroups(); fillLiberal();
  } else if (prefs.has('liberal_first')) {
    fillElective(); fillPinned(); fillLiberal();
  } else {
    // 기본: 전공선택으로 절반 채우고, 꼭 듣고 싶은 강의, 나머지 교양
    const half = totalCr + Math.ceil((maxCr - totalCr) / 2);
    const saved = maxCr;
    state.maxCredits = half;
    fillElective();
    state.maxCredits = saved;
    fillPinned();
    fillLiberal();
    fillElective();
  }

  return schedule;
}

/* ── 시간표 요약 정보 계산 ── */
function summarizeSchedule(schedule) {
  const totalCr  = schedule.reduce((s, c) => s + (Number(c.credits) || 0), 0);
  const flat     = schedule.flatMap(courseToFlat);
  const daysUsed = new Set(flat.map(s => s.day)).size;

  // 가장 이른 시작
  const earliest = flat.length ? Math.min(...flat.map(s => s.start_min)) : 0;
  const h = Math.floor(earliest / 60), m = earliest % 60;
  const earliestStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

  // 최대 공강
  let maxGap = 0;
  for (let day = 0; day < 5; day++) {
    const ds = flat.filter(s => s.day === day).sort((a,b) => a.start_min - b.start_min);
    for (let i = 1; i < ds.length; i++) {
      maxGap = Math.max(maxGap, ds[i].start_min - ds[i-1].end_min);
    }
  }

  return { totalCr, daysUsed, earliestStr, maxGap };
}

/* ── 자동 생성 결과 렌더링 ── */
function renderAutoResults(variants, state) {
  const wrap   = document.getElementById('autoResults');
  const grid   = document.getElementById('autoResultsGrid');
  const desc   = document.getElementById('autoResultsDesc');
  if (!wrap || !grid) return;

  if (!variants.length || variants.every(v => !v.schedule.length)) {
    wrap.classList.remove('hidden');
    grid.innerHTML = `<div class="auto-empty">
      선택한 조건으로 생성된 시간표가 없습니다.<br>
      <small>학점 한도를 높이거나 포함 옵션을 확인해 주세요.</small>
    </div>`;
    desc.textContent = '';
    return;
  }

  const labels = ['추천 A', '추천 B', '추천 C'];
  const labelIcons = ['🥇', '🥈', '🥉'];

  grid.innerHTML = variants.map((v, i) => {
    const { totalCr, daysUsed, earliestStr, maxGap } = summarizeSchedule(v.schedule);
    const colorMap = buildColorMap(v.schedule);
    const flat     = v.schedule.flatMap(courseToFlat);

    // 미니 시간표 HTML
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
      // 이름 찾기
      const courseName = v.schedule.find(c =>
        courseToFlat(c).some(f =>
          f.day === slot.day && f.start_min === slot.start_min
        )
      )?.name || '';
      const bg = color?.bg || '#dbe9ff';
      const bd = color?.border || '#8fb1f5';
      blocks += `<div class="rt-block" data-name="${esc(courseName)}" style="left:${leftPx}px;top:${topPx}px;width:${widthPx}px;height:${heightPx - 1}px;background:${bg};border:1px solid ${bd};pointer-events:auto;cursor:context-menu;">
        <div class="rt-block-name">${courseName}</div>
      </div>`;
    });

    const gapText = maxGap > 90 ? `최대 공강 ${Math.round(maxGap/60*10)/10}h` : '공강 적음';

    return `
      <div class="result-card" data-variant="${i}">
        <div class="result-card-head">
          <div class="result-label">${labelIcons[i]} ${labels[i]}</div>
          <div class="result-tag-row">
            <span class="result-tag">${totalCr}학점</span>
            <span class="result-tag">${daysUsed}일 수업</span>
            <span class="result-tag">${earliestStr} 시작</span>
            <span class="result-tag">${gapText}</span>
          </div>
        </div>

        <!-- 인라인 미니 시간표 -->
        <div class="result-tt">
          <div class="rt-header">
            <div class="rt-corner">시간</div>
            ${DAY_NAMES.map(d => `<div class="rt-day">${d}</div>`).join('')}
          </div>
          <div class="rt-body">
            <div class="rt-grid" style="grid-template-columns:${timeColW}px repeat(5,${dayCol}px)">
              ${gridCells}
            </div>
            <div class="rt-layer" style="left:${timeColW}px">${blocks}</div>
          </div>
        </div>

        <!-- 과목 목록 -->
        <div class="result-course-list">
          ${v.schedule.map(c => `
            <div class="result-course-item" data-name="${esc(c.name)}" style="cursor:pointer;">
              <span class="result-course-name">${c.name}</span>
              <span class="cat-badge cat-${catClass(c.category)} small">${c.category}</span>
              <span class="result-course-credit">${c.credits}학점</span>
            </div>
          `).join('')}
        </div>

        <button class="result-apply-btn primary-btn full" data-variant="${i}" type="button">
          이 시간표 적용하기
        </button>
      </div>
    `;
  }).join('');

  desc.textContent = `${_autoGrade}학년 기준 · 최대 ${state.maxCredits}학점`;
  wrap.classList.remove('hidden');
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 적용 버튼 이벤트
  grid.querySelectorAll('.result-apply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.variant);
      _selected = [...variants[idx].schedule];
      renderSelectedList();
      renderMiniTimetable();
      renderCourseList();
      document.getElementById('miniTimetable')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // 과목 목록 아이템 클릭 → 상세 팝업
  grid.querySelectorAll('.result-course-item').forEach(item => {
    item.addEventListener('click', e => {
      e.stopPropagation();
      showCourseInfoPopup(item.dataset.name);
    });
  });

  // rt-block 좌클릭 → 상세 팝업
  grid.querySelectorAll('.rt-block').forEach(block => {
    block.addEventListener('click', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      showCourseInfoPopup(block.dataset.name);
    });
  });

  // 우클릭 컨텍스트 메뉴 (rt-block)
  grid.querySelectorAll('.rt-block').forEach(block => {
    block.addEventListener('contextmenu', e => {
      e.preventDefault();
      showResultContextMenu(e.clientX, e.clientY, block.dataset.name);
    });
  });
}

/* ── 자동생성 결과 과목 클릭 → 상세 정보 팝업 ── */
let _infoPopup = null;
function showCourseInfoPopup(courseName) {
  if (_infoPopup) { _infoPopup.remove(); _infoPopup = null; }
  if (!courseName) return;

  const course = _allCourses.find(c => c.name === courseName);
  if (!course) return;

  const slotText = (course.slots || []).map(s => {
    const days = ['월','화','수','목','금'];
    return `${days[s.day] || '?'} ${s.start}~${s.end}${s.room ? ' '+s.room : ''}`;
  }).join(', ') || '시간 정보 없음';

  const popup = document.createElement('div');
  popup.className = 'course-info-popup';
  popup.innerHTML = `
    <div class="cip-header">
      <span class="cat-badge cat-${catClass(course.category)}">${course.category}</span>
      <button class="cip-close" type="button">✕</button>
    </div>
    <div class="cip-name">${course.name}</div>
    <div class="cip-rows">
      <div class="cip-row"><span class="cip-label">담당교수</span><span>${course.professor || '미정'}</span></div>
      <div class="cip-row"><span class="cip-label">학점</span><span>${course.credits}학점</span></div>
      <div class="cip-row"><span class="cip-label">분반</span><span>${course.section || '-'}</span></div>
      <div class="cip-row"><span class="cip-label">시간/장소</span><span>${slotText}</span></div>
      ${course.department ? `<div class="cip-row"><span class="cip-label">개설학과</span><span>${course.department}</span></div>` : ''}
      ${course.eligible_years?.length ? `<div class="cip-row"><span class="cip-label">수강대상</span><span>${course.eligible_years.join('·')}학년</span></div>` : ''}
    </div>
  `;

  document.body.appendChild(popup);
  _infoPopup = popup;

  // 화면 중앙 고정
  popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:10000;';

  popup.querySelector('.cip-close').addEventListener('click', () => {
    popup.remove(); _infoPopup = null;
  });
  // 배경 클릭 시 닫기
  const backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.3);';
  backdrop.addEventListener('click', () => {
    popup.remove(); backdrop.remove(); _infoPopup = null;
  });
  document.body.insertBefore(backdrop, popup);
}

/* ── 자동생성 결과 과목 우클릭 메뉴 ── */
let _ctxMenu = null;
function showResultContextMenu(x, y, courseName) {
  closeCtxMenu();
  if (!courseName) return;

  const menu = document.createElement('div');
  menu.className = 'result-ctx-menu';
  menu.innerHTML = `
    <div class="ctx-course-name">${courseName}</div>
    <button class="ctx-item" data-action="exclude" type="button">🚫 추천 제외 과목으로 설정</button>
    <button class="ctx-item" data-action="completed" type="button">✅ 수강 완료로 표시</button>
    <div class="ctx-divider"></div>
    <button class="ctx-item ctx-cancel" data-action="close" type="button">닫기</button>
  `;

  // 화면 경계 체크
  menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:9999;`;
  document.body.appendChild(menu);
  _ctxMenu = menu;

  // 화면 밖으로 나가면 보정
  requestAnimationFrame(() => {
    const r = menu.getBoundingClientRect();
    if (r.right  > window.innerWidth)  menu.style.left = `${x - r.width}px`;
    if (r.bottom > window.innerHeight) menu.style.top  = `${y - r.height}px`;
  });

  menu.querySelectorAll('.ctx-item').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      if (action === 'exclude') {
        if (_currentState && !_currentState.excludedCourses.includes(courseName)) {
          _currentState.excludedCourses.push(courseName);
          saveState(_currentState);
          // 제외 목록 UI 갱신
          const listEl = document.getElementById('excludedList');
          const countEl = document.getElementById('excludedCount');
          if (countEl) countEl.textContent = `${_currentState.excludedCourses.length}과목`;
          if (listEl) {
            listEl.innerHTML = _currentState.excludedCourses.map((name, i) => `
              <span class="completed-tag excluded-tag">
                ${name}
                <button class="completed-tag-del" data-idx="${i}" type="button" title="삭제">×</button>
              </span>
            `).join('');
            listEl.querySelectorAll('.completed-tag-del').forEach(btn => {
              btn.addEventListener('click', () => {
                _currentState.excludedCourses.splice(Number(btn.dataset.idx), 1);
                saveState(_currentState);
                setupExcludedCourses(_currentState);
              });
            });
          }
          // 제외 패널 펼치기
          const body = document.getElementById('excludedBody');
          const chevron = document.getElementById('excludedChevron');
          if (body?.classList.contains('hidden')) {
            body.classList.remove('hidden');
            if (chevron) chevron.textContent = '▼';
          }
          showToast(`"${courseName}"을(를) 추천 제외 목록에 추가했습니다.`);
        } else {
          showToast(`이미 제외 목록에 있는 과목입니다.`);
        }
      } else if (action === 'completed') {
        if (_currentState && !_currentState.completedCourses.includes(courseName)) {
          _currentState.completedCourses.push(courseName);
          saveState(_currentState);
          if (_gradReqs) renderGradReq(_currentState);
          showToast(`"${courseName}"을(를) 수강 완료로 표시했습니다.`);
        } else {
          showToast(`이미 수강 완료 목록에 있는 과목입니다.`);
        }
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

/* ── 자동 생성 UI 설정 ── */
/* ============================================================
   졸업요건 현황 패널
   ============================================================ */
function setupGradReqPanel(state) {
  const toggle  = document.getElementById('gradReqToggle');
  const body    = document.getElementById('gradReqBody');
  const chevron = document.getElementById('gradReqChevron');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    if (chevron) chevron.textContent = open ? '▶' : '▼';
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
      <span>📋</span>
      <p><strong>${dept || '학과 미설정'}</strong>의 졸업요건 데이터가 없습니다.</p>
      <small>설정 페이지에서 학과를 확인하거나 학교 학사지원팀에 문의하세요.</small>
    </div>`;
    if (badge) badge.textContent = '';
    return;
  }

  // 수강완료 과목 계산
  // 1) 수동 완료 표시  2) 지난 학기 timetable 과목 (자동)  3) 현재 담은 과목
  const completed    = new Set((state.completedCourses || []).map(n => n.trim().toLowerCase()));
  const pastCourses  = getPastTimetableCourseNames(state);
  const selected     = _selected || [];

  // 모든 이수 과목 = 수동완료 + 지난학기 자동완료 + 현재 선택중
  const allTaken = new Set([
    ...Array.from(completed),
    ...Array.from(pastCourses),
    ...selected.map(c => c.name.trim().toLowerCase())
  ]);

  // 과목명 → 학점/타입 조회 (courses.json 우선, 없으면 졸업요건 필수과목 목록, 없으면 기본 3학점)
  const reqCourseMap = {};
  (req.required_courses || []).forEach(rc => {
    reqCourseMap[rc.name.trim().toLowerCase()] = rc;
  });

  const lookupCourse = (nameLower) => {
    // courses.json에서 찾기
    const c = _allCourses.find(x => x.name.trim().toLowerCase() === nameLower);
    if (c) return c;
    // 졸업요건 필수과목 목록에서 찾기 → 전공필수로 간주
    const rc = reqCourseMap[nameLower];
    if (rc) return { type: 'major', category: '전공필수', department: dept, credits: rc.credits || 3 };
    // 기본: 전공선택 3학점으로 추정
    return null;
  };

  // 카테고리별 이수 학점 계산 (수동완료 + 지난학기 자동완료 + 현재담은과목)
  const calcEarned = (filterFn) => {
    let cr = 0;
    const counted = new Set();
    // 수동 완료 + 지난 학기 자동 완료
    for (const name of allTaken) {
      if (counted.has(name)) continue;
      const c = lookupCourse(name);
      if (c && filterFn(c)) { cr += Number(c.credits) || 0; counted.add(name); }
    }
    // 현재 담은 과목 (allTaken에 없는 것만)
    for (const c of selected) {
      const name = c.name.trim().toLowerCase();
      if (!counted.has(name) && filterFn(c)) { cr += Number(c.credits) || 0; counted.add(name); }
    }
    return cr;
  };

  // 완료과목 중 courses.json에 없는 것은 전공필수 여부를 reqCourseMap으로 판단
  const earnedLiberal   = calcEarned(c => c.type === 'liberal');
  const earnedMajorReq  = calcEarned(c => c.type === 'major' && c.category === '전공필수');
  const earnedMajorElec = calcEarned(c => c.type === 'major' && c.category === '전공선택' && (!c.department || c.department === dept));
  const earnedMajor     = earnedMajorReq + earnedMajorElec;
  const earnedTotal     = earnedLiberal + earnedMajor;
  const totalReq         = req.total || 130;

  if (badge) {
    const pct = Math.round(earnedTotal / totalReq * 100);
    badge.textContent = `${earnedTotal}/${totalReq}학점 (${pct}%)`;
    badge.style.background = pct >= 80 ? '#e3f7df' : pct >= 50 ? '#fff1d8' : '#f0f4ff';
    badge.style.color       = pct >= 80 ? '#1a6a1a' : pct >= 50 ? '#8a5800' : '#3b6bdc';
  }

  // 카테고리별 Progress bar 데이터
  const liberal = req.liberal || {};
  const major   = req.major   || {};
  const libReq  = (liberal['기초교양'] || 0) + (liberal['균형교양'] || 0) + (liberal['확대교양'] || 0);
  const majReq  = (major['전공필수'] || 0) + (major['전공선택'] || 0);

  const rows = [
    { label: '교양', earned: earnedLiberal,   required: libReq,  color: '#3b6bdc' },
    { label: '전공', earned: earnedMajor,      required: majReq,  color: '#2a7a1a' },
  ];

  // 세부 교양
  const subLib = [
    { label: '기초교양', req: liberal['기초교양'] || 0 },
    { label: '균형교양', req: liberal['균형교양'] || 0 },
    { label: '확대교양', req: liberal['확대교양'] || 0 },
  ].filter(x => x.req > 0);

  const subMaj = [
    { label: '전공필수', earned: earnedMajorReq,  req: major['전공필수'] || 0 },
    { label: '전공선택', earned: earnedMajorElec, req: major['전공선택'] || 0 },
  ].filter(x => x.req > 0);

  if (major['심화전공']) subMaj.push({ label: '심화전공', earned: 0, req: major['심화전공'] });

  // 이수 체계도 표 (roadmap 기반, 전공필수+전공선택)
  const roadmap = _roadmap?.[dept] || {};
  // required_courses를 name→{grade,semester} 맵으로 변환
  const reqMap = {};
  (req.required_courses || []).forEach(rc => {
    reqMap[rc.name.trim().toLowerCase()] = rc;
  });

  const makeRoadmapTable = () => {
    // roadmap에서 학과 전공과목만 추출 (이미 dept 기준)
    // 구조: roadmap[grade][sem] = [courseName, ...]
    const grades = ['1', '2', '3', '4'];
    const sems   = ['1', '2'];

    // 각 셀(grade×sem)의 과목 목록 빌드
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
          const cat = course?.category || (isReq ? '전공필수' : '전공선택');
          const credits = course?.credits ?? reqMap[lower]?.credits ?? 3;
          const done = allTaken.has(lower);
          const inProgress = !done && selected.some(c => c.name.trim().toLowerCase() === lower);
          return { name, cat, credits, done, inProgress, isReq };
        });
      }
    }

    // 실제 데이터가 있는 학년만 표시
    const activeGrades = grades.filter(g => sems.some(s => cells[`${g}_${s}`]?.length));
    if (!activeGrades.length) return '';

    const semLabel = { '1': '1학기', '2': '2학기' };

    const headerRow = `
      <tr class="rmap-header-row">
        <th class="rmap-grade-th"></th>
        ${sems.map(s => `<th class="rmap-sem-th">${semLabel[s]}</th>`).join('')}
      </tr>`;

    const bodyRows = activeGrades.map(g => {
      const cols = sems.map(s => {
        const items = cells[`${g}_${s}`];
        if (!items.length) return `<td class="rmap-cell rmap-empty">—</td>`;
        return `<td class="rmap-cell">
          ${items.map(item => {
            const cls = item.done ? 'rmap-course done' : item.inProgress ? 'rmap-course in-progress' : 'rmap-course';
            const badge = item.isReq
              ? `<span class="rmap-badge req">필수</span>`
              : `<span class="rmap-badge elec">선택</span>`;
            const status = item.done
              ? `<span class="rmap-status done-icon">✓</span>`
              : item.inProgress
              ? `<span class="rmap-status prog-icon">담는중</span>`
              : '';
            return `<div class="${cls}" title="${item.name} · ${item.credits}학점">
              ${badge}
              <span class="rmap-name">${item.name}</span>
              <span class="rmap-cr">${item.credits}학점</span>
              ${status}
            </div>`;
          }).join('')}
        </td>`;
      }).join('');
      return `<tr><td class="rmap-grade-label">${g}학년</td>${cols}</tr>`;
    }).join('');

    return `
      <div class="grad-section">
        <div class="grad-section-title">전공 이수 체계도
          <span class="rmap-legend">
            <span class="rmap-badge req">필수</span> 전공필수 &nbsp;
            <span class="rmap-badge elec">선택</span> 전공선택 &nbsp;
            <span class="rmap-status done-icon">✓</span> 이수완료 &nbsp;
            <span class="rmap-status prog-icon">담는중</span> 현재 담음
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
          <span class="grad-bar-label">${done ? '✓ ' : ''}${label}</span>
          <span class="grad-bar-val ${done ? 'done' : ''}">${earned}/${req}학점</span>
        </div>
        <div class="grad-bar-wrap">
          <div class="grad-bar" style="width:${pct}%;background:${color}"></div>
        </div>
        ${subHtml}
      </div>
    `;
  };

  // 총 이수 진행
  const totalPct = Math.min(100, Math.round(earnedTotal / totalReq * 100));

  content.innerHTML = `
    <div class="grad-total-row">
      <div class="grad-total-label">전체 이수 진행률</div>
      <div class="grad-total-bar-wrap">
        <div class="grad-total-bar" style="width:${totalPct}%"></div>
      </div>
      <div class="grad-total-val">${earnedTotal} / ${totalReq}학점 (${totalPct}%)</div>
    </div>

    <div class="grad-bars-grid">
      ${makeBar('교양', earnedLiberal, libReq, '#3b6bdc', null)}
      ${makeBar('전공', earnedMajor,   majReq, '#2a7a1a', subMaj)}
    </div>

    ${roadmapHtml}

    <div class="grad-note">
      <small>* 수강완료 과목과 현재 담은 강의 기준으로 계산됩니다. 실제 이수 학점은 학교 학사시스템을 확인하세요.</small>
    </div>
  `;
}

/* ============================================================
   추천 제외 과목 관리
   ============================================================ */
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
    if (countEl) countEl.textContent = list.length ? `${list.length}과목` : '';
    if (!listEl) return;
    if (!list.length) {
      listEl.innerHTML = '<span class="completed-empty">제외할 과목이 없습니다.</span>';
      return;
    }
    listEl.innerHTML = list.map((name, i) => `
      <span class="completed-tag excluded-tag">
        ${name}
        <button class="completed-tag-del" data-idx="${i}" type="button" title="삭제">×</button>
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
    if (chevron) chevron.textContent = open ? '▶' : '▼';
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
            c.type === 'major' ? '전공' :
            c.type === '자유선택' ? '자유선택' : '교양'
          } · ${c.credits}학점</span>
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
    if (confirm(`제외 과목 ${state.excludedCourses.length}개를 모두 삭제할까요?`)) {
      state.excludedCourses = [];
      saveState(state);
      renderList();
    }
  });

  renderList();
}

/* ============================================================
   꼭 듣고 싶은 강의 (pinnedCourses) 관리
   ============================================================ */
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
    if (countEl) countEl.textContent = list.length ? `${list.length}과목` : '';
    if (!listEl) return;
    if (!list.length) {
      listEl.innerHTML = '<span class="completed-empty">지정된 과목이 없습니다.</span>';
      return;
    }
    listEl.innerHTML = list.map((name, i) => {
      const course = _allCourses.find(c => c.name === name);
      const slotText = course
        ? (course.slots || []).map(s => `${DAY_NAMES[s.day]} ${s.start}–${s.end}`).join(' / ')
        : '';
      return `
        <span class="completed-tag pinned-tag">
          📌 ${name}
          ${slotText ? `<span class="pinned-slot">${slotText}</span>` : ''}
          <button class="completed-tag-del" data-idx="${i}" type="button" title="삭제">×</button>
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

  // 패널 토글
  toggle?.addEventListener('click', () => {
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    if (chevron) chevron.textContent = open ? '▶' : '▼';
  });

  // 검색 + 자동완성
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
        const slotText = (c.slots || []).map(s => `${DAY_NAMES[s.day]} ${s.start}–${s.end}`).join(' / ');
        return `
          <div class="completed-sug-item" data-name="${esc(c.name)}">
            <span class="completed-sug-name">${c.name}</span>
            <span class="completed-sug-meta">${c.type === 'major' ? '전공' : c.type === '자유선택' ? '자유선택' : '교양'} · ${c.credits}학점 · ${slotText}</span>
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
            // 패널이 닫혀 있으면 열어줌
            if (body.classList.contains('hidden')) {
              body.classList.remove('hidden');
              if (chevron) chevron.textContent = '▼';
            }
          }
          searchInp.value = '';
          suggestions.innerHTML = '';
        });
      });
    }, 200);
  });

  // 외부 클릭 시 자동완성 닫기
  document.addEventListener('click', (e) => {
    if (!suggestions?.contains(e.target) && e.target !== searchInp) {
      if (suggestions) suggestions.innerHTML = '';
    }
  });

  // 전체 삭제
  document.getElementById('pinnedClearAll')?.addEventListener('click', () => {
    if (!state.pinnedCourses.length) return;
    if (confirm(`필수 포함 과목 ${state.pinnedCourses.length}개를 모두 삭제할까요?`)) {
      state.pinnedCourses = [];
      saveState(state);
      renderList();
    }
  });

  renderList();
}

/* ============================================================
   수강 완료 과목 관리
   ============================================================ */
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
    if (countEl) countEl.textContent = list.length ? `${list.length}과목` : '';
    if (!listEl) return;
    if (!list.length) {
      listEl.innerHTML = '<span class="completed-empty">아직 추가된 과목이 없습니다.</span>';
      return;
    }
    listEl.innerHTML = list.map((name, i) => `
      <span class="completed-tag">
        ${name}
        <button class="completed-tag-del" data-idx="${i}" type="button" title="삭제">×</button>
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
    if (chevron) chevron.textContent = open ? '▶' : '▼';
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
          <span class="completed-sug-meta">${c.type === 'major' ? '전공' : c.type === '자유선택' ? '자유선택' : '교양'} · ${c.credits}학점</span>
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
    if (confirm(`수강 완료 과목 ${state.completedCourses.length}개를 모두 삭제할까요?`)) {
      state.completedCourses = [];
      saveState(state);
      renderList();
    }
  });

  renderList();
}

function setupAutoGen(state) {
  // 패널 토글
  const toggle  = document.getElementById('autoGenToggle');
  const body    = document.getElementById('autoGenBody');
  const chevron = document.getElementById('autoGenChevron');
  toggle?.addEventListener('click', () => {
    const open = !body.classList.contains('hidden');
    body.classList.toggle('hidden', open);
    chevron.textContent = open ? '▶' : '▼';
  });

  // 학년 pills
  const gradePills = document.getElementById('gradePills');
  gradePills?.querySelectorAll('.ag-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      gradePills.querySelectorAll('.ag-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _autoGrade = Number(btn.dataset.grade);
    });
  });
  // 학번에서 입학년도 → 학년 추정
  const admYear = getAdmissionYear(state.studentId);
  if (admYear) {
    const guessGrade = Math.min(4, Math.max(1, new Date().getFullYear() - admYear + 1));
    _autoGrade = guessGrade;
    gradePills?.querySelectorAll('.ag-pill').forEach(btn => {
      if (Number(btn.dataset.grade) === guessGrade) btn.classList.add('active');
    });
  }

  // 스타일 pills (복수 선택)
  const descRow = document.getElementById('styleDescRow');
  document.getElementById('stylePills')?.querySelectorAll('.ag-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.style;
      // cluster ↔ spread 상호 배제
      if (s === 'cluster' && _autoPrefs.has('spread'))   _autoPrefs.delete('spread');
      if (s === 'spread'  && _autoPrefs.has('cluster'))  _autoPrefs.delete('cluster');
      // major_first ↔ liberal_first 상호 배제
      if (s === 'major_first'   && _autoPrefs.has('liberal_first')) _autoPrefs.delete('liberal_first');
      if (s === 'liberal_first' && _autoPrefs.has('major_first'))   _autoPrefs.delete('major_first');

      if (_autoPrefs.has(s)) _autoPrefs.delete(s);
      else                   _autoPrefs.add(s);

      // 버튼 상태 업데이트
      document.getElementById('stylePills').querySelectorAll('.ag-pill').forEach(b => {
        b.classList.toggle('active', _autoPrefs.has(b.dataset.style));
      });
      // 설명 업데이트
      if (descRow) {
        descRow.innerHTML = [..._autoPrefs].map(p =>
          `<span class="style-desc-item">${STYLE_META[p]?.desc || ''}</span>`
        ).join('');
      }
    });
  });

  // 재수강 허용 토글 (숨겨진 고급 옵션)
  const retakeToggle = document.getElementById('allowRetake');
  if (retakeToggle) {
    retakeToggle.checked = state.allowRetake || false;
    retakeToggle.addEventListener('change', () => {
      state.allowRetake = retakeToggle.checked;
      saveState(state);
    });
  }

  // 최대학점 표시 동기화
  const maxCrDisplay = document.getElementById('autoMaxCrDisplay');
  const syncMaxCr = () => {
    if (maxCrDisplay) maxCrDisplay.textContent = state.maxCredits || 18;
  };
  syncMaxCr();
  document.getElementById('maxCredits')?.addEventListener('change', syncMaxCr);

  // 생성 버튼
  document.getElementById('autoGenBtn')?.addEventListener('click', () => {
    if (!_autoGrade) {
      alert('먼저 현재 학년을 선택해 주세요.');
      return;
    }
    if (!state.department) {
      alert('시작하기 전에 설정에서 학과를 지정해 주세요.');
      return;
    }

    const btn = document.getElementById('autoGenBtn');
    btn.textContent = '생성 중…';
    btn.disabled = true;

    // 약간 delay 줘서 UI 업데이트 후 생성
    setTimeout(() => {
      const options = {
        grade:       _autoGrade,
        prefs:       new Set(_autoPrefs),
        inclRequired: document.getElementById('inclRequired')?.checked ?? true,
        inclElective: document.getElementById('inclElective')?.checked ?? true,
        inclLiberal:  document.getElementById('inclLiberal')?.checked ?? true
      };

      try {
        // 각 변형이 다른 과목을 선택하도록 excluded 집합 다르게 설정
        const v0 = generateVariant(state, { ...options, shuffleSeed: 0 });
        const v1 = generateVariant(state, { ...options, shuffleSeed: 31 });
        const v2 = generateVariant(state, { ...options, shuffleSeed: 97 });

        // 중복 체크: A=B면 B에서 A 과목 일부 강제 제외 후 재생성
        const scheduleKey = s => s.map(c => c.name + (c.section||'')).sort().join('|');
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
          { schedule: k1 === k0 ? forceExclude(v0, 53) : v1 },
          { schedule: k2 === k0 || k2 === k1 ? forceExclude(v0, 79) : v2 }
        ];
        renderAutoResults(variants, state);
      } finally {
        btn.textContent = '✨ 시간표 자동 생성';
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
  const state = loadState();

  if (page === 'index')    setupIndexPage(state);
  if (page === 'generate') setupGeneratePage(state);
  if (page === 'settings') await setupSettingsPage(state);
  if (page === 'signup')   location.href = getSession() ? 'index.html' : 'login.html';
}

document.addEventListener('DOMContentLoaded', init);
