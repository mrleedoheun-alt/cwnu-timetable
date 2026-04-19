const http     = require('http');
const fs       = require('fs');
const path     = require('path');
const cheerio  = require('cheerio');

const MIME = {
  html: 'text/html; charset=utf-8',
  css:  'text/css',
  js:   'application/javascript',
  json: 'application/json'
};

const PORT     = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const BASE_URL = 'https://chains.changwon.ac.kr/cnu/haksa/open_subject/open_down_manager.php';
const TOP_URL  = 'https://chains.changwon.ac.kr/cnu/haksa/open_subject/open_top_manager.php';

/* ─────────────────────────────────────────────
   Shared helpers (copied from crawl_to_courses_json.js)
───────────────────────────────────────────── */
const PERIOD_TIME_MAP = {
  '0A':['08:00','08:30'],'0B':['08:30','09:00'],
  '1A':['09:00','09:30'],'1B':['09:30','10:00'],
  '2A':['10:00','10:30'],'2B':['10:30','11:00'],
  '3A':['11:00','11:30'],'3B':['11:30','12:00'],
  '4A':['12:00','12:30'],'4B':['12:30','13:00'],
  '5A':['13:00','13:30'],'5B':['13:30','14:00'],
  '6A':['14:00','14:30'],'6B':['14:30','15:00'],
  '7A':['15:00','15:30'],'7B':['15:30','16:00'],
  '8A':['16:00','16:30'],'8B':['16:30','17:00'],
  '9A':['17:00','17:30'],'9B':['17:30','18:00'],
  'A':['09:00','09:30'],'B':['09:30','10:00'],
  'C':['10:00','10:30'],'D':['10:30','11:00'],
  'E':['11:00','11:30'],'F':['11:30','12:00']
};

function clean(text) {
  return String(text||'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
}
function dayIdx(d) { return({'월':0,'화':1,'수':2,'목':3,'금':4})[d]??-1; }
function normTime(v) {
  if(!v) return '';
  const s=String(v).trim();
  if(/^\d{1,2}:\d{2}$/.test(s)){const[h,m]=s.split(':');return`${String(h).padStart(2,'0')}:${m}`;}
  if(/^\d{3,4}$/.test(s)){const p=s.padStart(4,'0');return`${p.slice(0,2)}:${p.slice(2)}`;}
  return'';
}
function parseTR(seg) {
  const t=clean(seg).replace(/∼/g,'~').replace(/[－–—]/g,'-');
  const m=t.match(/^([월화수목금])\s*(\d{1,2}:\d{2}|\d{3,4})\s*[~\-]\s*(\d{1,2}:\d{2}|\d{3,4})(?:\(([^)]+)\))?$/);
  if(!m) return null;
  return{day:dayIdx(m[1]),start:normTime(m[2]),end:normTime(m[3]),room:clean(m[4]||'')};
}
function parsePeriod(seg) {
  const t=clean(seg);
  const m=t.match(/^([월화수목금])\s*(\d{1,2}[A-B]|[A-F])(?:\(([^)]+)\))?$/);
  if(!m) return null;
  const day=dayIdx(m[1]),pair=PERIOD_TIME_MAP[m[2]];
  if(day<0||!pair) return null;
  return{day,start:pair[0],end:pair[1],room:clean(m[3]||'')};
}
function parseSched(raw) {
  const text=clean(raw);
  if(!text) return[];
  const results=[];
  for(const seg of text.split(',').map(clean).filter(Boolean)){
    const t=parseTR(seg)||parsePeriod(seg);
    if(t) results.push(t);
  }
  const lr={};
  for(const s of results){if(s.room)lr[s.day]=s.room;else if(lr[s.day])s.room=lr[s.day];}
  return results.filter(x=>x.day>=0&&x.start&&x.end);
}
function mergeSlots(slots) {
  const sorted=[...slots].sort((a,b)=>a.day!==b.day?a.day-b.day:a.room!==b.room?String(a.room).localeCompare(String(b.room)):a.start.localeCompare(b.start));
  const merged=[];
  for(const s of sorted){const l=merged[merged.length-1];if(l&&l.day===s.day&&l.room===s.room&&l.end===s.start)l.end=s.end;else merged.push({...s});}
  return merged;
}
function uniqSlots(slots) {
  const seen=new Set();
  return slots.filter(s=>{const k=`${s.day}|${s.start}|${s.end}|${s.room}`;if(seen.has(k))return false;seen.add(k);return true;});
}
function secNum(code){const m=(code||'').match(/\((\d+)\)$/);return m?m[1]:'01';}
function normCat(cat) {
  return({'전필':'전공필수','전선':'전공선택','전공필수':'전공필수','전공선택':'전공선택',
    '교직':'교직','자선':'자유선택','자유선택':'자유선택',
    '융필':'융합전공필수','융합전공':'융합전공',
    '기초교양':'기초교양','균교':'균형교양','균형교양':'균형교양','확교':'확대교양','확대교양':'확대교양'})[cat]||cat||'전공';
}
function normLibCat(cat) {
  if(!cat) return'교양';
  if(cat.includes('기초') || cat.includes('학부')) return'기초교양';
  if(cat.startsWith('균')) return'균형교양';
  if(cat.startsWith('확')) return'확대교양';
  return cat;
}

// ar_region 인덱스 → subtitle 매핑 (학교 사이트 기준)
const LIBERAL_DETAIL_MAP = {
  '0':'미래설계', '1':'AI융합기초', '2':'열린사고와표현', '3':'글로벌의사소통',
  '4':'디지털커뮤니케이션', '5':'인문예술', '6':'사회와문화', '7':'자연과학기술의이해',
  '8':'언어의세계', '9':'소양교육'
};

// subtitle 매핑 → 교양 대분류
const LIBERAL_SUBTITLE_CAT = {
  '미래설계':'기초교양', 'AI융합기초':'기초교양', '열린사고와표현':'기초교양', '글로벌의사소통':'기초교양',
  '디지털커뮤니케이션':'균형교양', '인문예술':'균형교양', '사회와문화':'균형교양', '자연과학기술의이해':'균형교양',
  '언어의세계':'확대교양', '소양교육':'확대교양'
};

/* ─────────────────────────────────────────────
   Fetch dept list from top page
───────────────────────────────────────────── */
async function fetchDeptList(year, term) {
  const res  = await fetch(`${TOP_URL}?year=${year}&term=${term}&cyear=${year}`);
  const html = await res.text();
  const codes=[], names=[];
  let m;
  const cRe=/dept00_code\[(\d+)\]='([^']+)'/g;
  const nRe=/dept00_name\[(\d+)\]='([^']+)'/g;
  while((m=cRe.exec(html))) codes[+m[1]]=m[2];
  while((m=nRe.exec(html))) names[+m[1]]=m[2];
  const depts=[];
  codes.forEach((code,i)=>{if(!code||code==='801') return;depts.push({code,name:names[i]||code});});
  return depts;
}

/* ─────────────────────────────────────────────
   Fetch + parse one category
───────────────────────────────────────────── */
async function fetchCategory(year, term, gubun, gradeOrCode, big, detail) {
  const body=new URLSearchParams({year,term,h_gubun:gubun,h_grade:gradeOrCode,keyword:'',big:big||gradeOrCode,detail:detail||gradeOrCode,dummy:''}).toString();
  const res=await fetch(BASE_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',referer:`${TOP_URL}?year=${year}&term=${term}&cyear=${year}`},body});
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseRows(html, extra={}) {
  const $=cheerio.load(html);
  const rows=[];
  $('table tr').each((_,tr)=>{
    const tds=$(tr).find('td');
    if(tds.length<10) return;
    const vals=tds.toArray().map(td=>clean($(td).text()));
    if(!vals[2]||vals[2]==='과목명'||vals[2]==='전체'||/^\d+$/.test(vals[2])) return;
    const gradeDeptRaw=vals[19]||'';
    const eligibleYears=[];
    for(const m of gradeDeptRaw.matchAll(/([1-4])/g)){const y=Number(m[1]);if(!eligibleYears.includes(y))eligibleYears.push(y);}
    rows.push({
      code:vals[0], category:vals[1], name:vals[2], credits:vals[3],
      professor:vals[17], schedule_room:vals[18],
      eligible_grade_dept:gradeDeptRaw, eligible_years:eligibleYears.sort(),
      opened_department:vals[20]||'',
      ...extra
    });
  });
  return rows;
}

/* ─────────────────────────────────────────────
   Convert raw rows → course objects
───────────────────────────────────────────── */
const LIBERAL_CATS=new Set(['기초교양','균형교양','확대교양']);

function extractSubtitle(queryTitle) {
  const m=(queryTitle||'').match(/교양[-\s]?(.+)$/);
  return m?m[1].trim():'';
}

function buildCourses(liberalRows, majorRows, extraRows) {
  const map={};

  // 교양
  for(const row of liberalRows) {
    const raw=clean(row.schedule_room);
    if(!raw) continue;
    const slots=mergeSlots(parseSched(raw));
    if(!slots.length) continue;
    const eyears=[];
    for(const m of (row.eligible_grade_dept||'').matchAll(/([1-4])/g)){const y=Number(m[1]);if(!eyears.includes(y))eyears.push(y);}
    const sec=secNum(row.code);
    // forced_subtitle/category는 크롤링 시 detail 인덱스로 직접 매핑한 값 (우선 사용)
    const subtitle=row.forced_subtitle||extractSubtitle(row.query_title||'');
    const category=row.forced_category||normLibCat(clean(row.category));
    const key=`${clean(row.name)}||${clean(row.professor)}||${sec}`;
    if(!map[key]) map[key]={name:clean(row.name),type:'liberal',category,subtitle,department:'',dept_code:'',credits:Number(clean(row.credits))||0,professor:clean(row.professor),section:sec,eligible_years:eyears.sort(),slots:[]};
    map[key].slots.push(...slots);
  }

  // 전공
  for(const row of majorRows) {
    const raw=clean(row.schedule_room);
    if(!raw) continue;
    const slots=mergeSlots(parseSched(raw));
    if(!slots.length) continue;
    const sec=secNum(row.code);
    const cat=normCat(clean(row.category));
    if(cat==='교직') continue;
    const type=cat==='자유선택'?'자유선택':'major';
    const key=`${clean(row.name)}||${clean(row.professor)}||${sec}||${row.dept_code||''}`;
    if(!map[key]) map[key]={name:clean(row.name),type,category:cat,subtitle:'',department:clean(row.dept_name||row.opened_department||''),dept_code:row.dept_code||'',credits:Number(clean(row.credits))||0,professor:clean(row.professor),section:sec,eligible_years:row.eligible_years||[],slots:[]};
    map[key].slots.push(...slots);
  }

  // extra (원어·인터넷·자유선택)
  const baseCodes=new Set([...liberalRows.map(r=>clean(r.code||'')), ...majorRows.map(r=>clean(r.code||''))].filter(Boolean));
  for(const row of extraRows) {
    const code=clean(row.code||'');
    if(code&&baseCodes.has(code)) continue;
    const raw=clean(row.schedule_room);
    const slots=raw?mergeSlots(parseSched(raw)):[];
    const sec=secNum(row.code);
    const cat=normCat(clean(row.category));
    if(cat==='교직') continue;
    const liberalCatsSet=new Set(['기초교양','균형교양','확대교양']);
    const type=liberalCatsSet.has(cat)?'liberal':cat==='자유선택'?'자유선택':'major';
    const openedDept=clean(row.opened_department||'');
    const realDept=(openedDept&&openedDept!=='교양')?openedDept:'';
    const key=`${clean(row.name)}||${clean(row.professor)}||${sec}||${row.gubun_code||''}`;
    if(!map[key]) map[key]={name:clean(row.name),type,category:cat,subtitle:'',department:realDept,dept_code:'',credits:Number(clean(row.credits))||0,professor:clean(row.professor),section:sec,eligible_years:row.eligible_years||[],gubun_label:row.gubun_label||'',slots:[]};
    map[key].slots.push(...slots);
  }

  return Object.values(map).map(c=>({...c,slots:uniqSlots(c.slots)}));
}

/* ─────────────────────────────────────────────
   Main crawl function (returns courses array)
───────────────────────────────────────────── */
const EXTRA_GUBUNS=[{gubun:'9',label:'학부원어강좌'},{gubun:'10',label:'학부인터넷강좌'},{gubun:'11',label:'학부자유선택'}];
const LIBERAL_GRADES=['0','1','2','3','4','5','6','7','8','9'];

async function crawlCourses(year, term) {
  console.log(`[crawler] ${year}-${term} 크롤링 시작`);
  const liberalRows=[];
  const majorRows=[];
  const extraRows=[];

  // 교양 (h_gubun=0) — detail 인덱스 0~9 순회
  for(const g of LIBERAL_GRADES) {
    try {
      const html=await fetchCategory(year,term,'0',g,g,g);
      const subtitle=LIBERAL_DETAIL_MAP[g]||'';
      const category=LIBERAL_SUBTITLE_CAT[subtitle]||'기초교양';
      const parsed=parseRows(html,{query_title:'', forced_subtitle:subtitle, forced_category:category});
      liberalRows.push(...parsed);
      await sleep(300);
    } catch(e){console.warn(`교양 g=${g} 실패:`,e.message);}
  }
  console.log(`  교양 raw: ${liberalRows.length}행`);

  // 전공 학과 목록
  try {
    const depts=await fetchDeptList(year,term);
    console.log(`  학과 수: ${depts.length}`);
    for(const dept of depts) {
      try {
        const html=await fetchCategory(year,term,'1',dept.code,dept.code,dept.code);
        const rows=parseRows(html,{dept_code:dept.code,dept_name:dept.name});
        majorRows.push(...rows);
        await sleep(300);
      } catch(e){console.warn(`전공 ${dept.name} 실패:`,e.message);}
    }
  } catch(e){console.warn('학과 목록 실패:',e.message);}
  console.log(`  전공 raw: ${majorRows.length}행`);

  // 추가 구분
  for(const {gubun,label} of EXTRA_GUBUNS) {
    try {
      const html=await fetchCategory(year,term,gubun,'',gubun,gubun);
      const rows=parseRows(html,{gubun_code:gubun,gubun_label:label});
      extraRows.push(...rows);
      await sleep(300);
    } catch(e){console.warn(`extra ${label} 실패:`,e.message);}
  }
  console.log(`  추가 raw: ${extraRows.length}행`);

  const courses=buildCourses(liberalRows,majorRows,extraRows);
  console.log(`[crawler] 완료: ${courses.length}개 과목`);
  return courses;
}

// cheerio $ 헬퍼 — 사용처 없음 (삭제 안전)
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

/* ─────────────────────────────────────────────
   서버
───────────────────────────────────────────── */
const crawlingInProgress = new Set();

function semesterToTerm(sem) {
  return({'1학기':'1','2학기':'2','여름학기':'3','겨울학기':'4'})[sem] || '1';
}
function termToSemester(term) {
  return({'1':'1학기','2':'2학기','3':'여름학기','4':'겨울학기'})[String(term)] || '1학기';
}

/* 해당 학기 개설강좌가 실제로 공시됐을 법한 시점인지 판단
   1학기: 2월 이후 공시 (term=1)
   2학기: 7월 이후 공시 (term=2)
   여름학기: 6월 이후 (term=3)
   겨울학기: 11월 이후 (term=4) */
function isSemesterPublished(year, term) {
  const now  = new Date();
  const nowY = now.getFullYear();
  const nowM = now.getMonth() + 1;
  const yr   = Number(year);
  if (yr < nowY) return true;
  if (yr > nowY) return false;
  const pubMonth = { '1': 2, '2': 7, '3': 6, '4': 11 };
  return nowM >= (pubMonth[String(term)] || 1);
}

/* 현재 학기 캐시가 오래됐으면(7일 이상) 재크롤 필요 여부 반환 */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일
function isCacheStale(cachePath) {
  try {
    const stat = fs.statSync(cachePath);
    return (Date.now() - stat.mtimeMs) > CACHE_TTL_MS;
  } catch { return true; }
}

/* data/ 폴더에서 특정 term의 가장 최근 캐시 파일 탐색
   beforeYear: 이 연도보다 strictly 이전 년도만 허용 (미개설 폴백용) */
function findLatestFallback(term, beforeYear) {
  if (!fs.existsSync(DATA_DIR)) return null;
  const files = fs.readdirSync(DATA_DIR);
  let best = null;
  for (const f of files) {
    const m = f.match(/^courses_(\d{4})_(\d)\.json$/);
    if (!m || m[2] !== String(term)) continue;
    const yr = Number(m[1]);
    if (beforeYear && yr >= Number(beforeYear)) continue; // 요청 연도 이상은 제외
    if (!best || yr > best.year) best = { year: yr, path: path.join(DATA_DIR, f) };
  }
  // 기본 courses.json → 2026 1학기로 간주
  if (!best && String(term) === '1') {
    const def = path.join(DATA_DIR, 'courses.json');
    if (fs.existsSync(def)) best = { year: 2026, path: def };
  }
  return best;
}

/* 캐시를 반환하되, 폴백인 경우 헤더에 실제 년도/학기 표시 */
function sendCache(res, cachePath, actualYear, actualSem, isFallback) {
  res.setHeader('X-Actual-Year',     String(actualYear));
  res.setHeader('X-Actual-Semester', encodeURIComponent(actualSem)); // 한글 → URI 인코딩
  res.setHeader('X-Is-Fallback',     isFallback ? 'true' : 'false');
  res.writeHead(200);
  fs.createReadStream(cachePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = urlObj.pathname;

  /* ── /api/courses?year=YYYY&semester=1학기 ── */
  if (pathname === '/api/courses') {
    const year = urlObj.searchParams.get('year') || String(new Date().getFullYear());
    const sem  = urlObj.searchParams.get('semester') || '1학기';
    const term = semesterToTerm(sem);
    const cacheKey  = `courses_${year}_${term}`;
    const cachePath = path.join(DATA_DIR, `${cacheKey}.json`);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // ── 기본 courses.json → courses_2026_1.json 으로 마이그레이션 (최초 1회)
    const defaultPath = path.join(DATA_DIR, 'courses.json');
    const migrated    = path.join(DATA_DIR, 'courses_2026_1.json');
    if (fs.existsSync(defaultPath) && !fs.existsSync(migrated)) {
      fs.copyFileSync(defaultPath, migrated);
    }

    const published = isSemesterPublished(year, term);

    // ── 케이스 A: 개설 공시된 학기
    if (published) {
      // 캐시가 있고 신선하면 즉시 반환
      if (fs.existsSync(cachePath) && !isCacheStale(cachePath)) {
        return sendCache(res, cachePath, year, sem, false);
      }

      // 크롤 중이면 대기
      if (crawlingInProgress.has(cacheKey)) {
        let waited = 0;
        while (crawlingInProgress.has(cacheKey) && waited < 60000) {
          await sleep(1000); waited += 1000;
        }
        if (fs.existsSync(cachePath)) return sendCache(res, cachePath, year, sem, false);
        res.writeHead(503); res.end(JSON.stringify({error:'크롤링 타임아웃'}));
        return;
      }

      // 오래된 캐시가 있으면 즉시 반환 후 백그라운드 재크롤
      if (fs.existsSync(cachePath)) {
        sendCache(res, cachePath, year, sem, false);
        if (!crawlingInProgress.has(cacheKey)) {
          crawlingInProgress.add(cacheKey);
          crawlCourses(year, term).then(courses => {
            fs.writeFileSync(cachePath, JSON.stringify(courses, null, 2), 'utf-8');
            console.log(`[server] 캐시 갱신: ${cachePath}`);
          }).catch(e => console.error('[server] 재크롤 실패:', e.message))
            .finally(() => crawlingInProgress.delete(cacheKey));
        }
        return;
      }

      // 캐시 없음 → 크롤링 시작 (202 반환)
      crawlingInProgress.add(cacheKey);
      console.log(`[server] ${year}-${sem} 크롤링 시작`);
      res.writeHead(202, {'Content-Type':'application/json', 'X-Is-Fallback':'false'});
      res.end(JSON.stringify({status:'crawling', message:`${year} ${sem} 강의 데이터 수집 중… 약 1~2분 후 자동으로 표시됩니다.`}));
      crawlCourses(year, term).then(courses => {
        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive:true});
        fs.writeFileSync(cachePath, JSON.stringify(courses, null, 2), 'utf-8');
        console.log(`[server] 캐시 저장: ${cachePath}`);
      }).catch(e => console.error('[server] 크롤링 실패:', e.message))
        .finally(() => crawlingInProgress.delete(cacheKey));
      return;
    }

    // ── 케이스 B: 아직 미개설 학기 → 직전 동일 학기 폴백
    const fallback = findLatestFallback(term, year);
    if (fallback) {
      console.log(`[server] ${year} ${sem} 미개설 → ${fallback.year} ${sem} 폴백`);
      return sendCache(res, fallback.path, fallback.year, sem, true);
    }

    // 폴백도 없으면 빈 배열
    res.setHeader('X-Is-Fallback', 'false');
    res.writeHead(200);
    res.end('[]');
    return;
  }

  /* ── 정적 파일 ── */
  const u  = pathname;
  const fp = path.join(__dirname, u === '/' ? 'login.html' : u);

  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(fp).slice(1);
  res.writeHead(200, {
    'Content-Type':  MIME[ext] || 'text/plain',
    'Cache-Control': 'no-cache'
  });
  fs.createReadStream(fp).pipe(res);
});

server.listen(PORT, () => {
  console.log(`서버 실행중: http://localhost:${PORT}`);
});
