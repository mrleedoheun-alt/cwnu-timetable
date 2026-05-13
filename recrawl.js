/**
 * recrawl.js — 전체 학기 강제 재크롤 스크립트
 * 사용: node recrawl.js
 *
 * server.js의 크롤 로직을 그대로 사용 (exports 노출)
 * server.js 끝에 module.exports = { crawlCourses } 를 임시 추가해 실행
 */
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ── server.js 핵심 크롤 코드 직접 인라인 ── */
const cheerio  = require('cheerio');
const BASE_URL = 'https://chains.changwon.ac.kr/cnu/haksa/open_subject/open_down_manager.php';
const TOP_URL  = 'https://chains.changwon.ac.kr/cnu/haksa/open_subject/open_top_manager.php';

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
  return String(text||'').replace(/ /g,' ').replace(/\s+/g,' ').trim();
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
  if(cat.includes('기초')||cat.includes('학부')) return'기초교양';
  if(cat.startsWith('균')) return'균형교양';
  if(cat.startsWith('확')) return'확대교양';
  return cat;
}
const LIBERAL_DETAIL_MAP = {
  '0':'미래설계','1':'AI융합기초','2':'열린사고와표현','3':'글로벌의사소통',
  '4':'디지털커뮤니케이션','5':'인문예술','6':'사회와문화','7':'자연과학기술의이해',
  '8':'언어의세계','9':'소양교육'
};
const LIBERAL_SUBTITLE_CAT = {
  '미래설계':'기초교양','AI융합기초':'기초교양','열린사고와표현':'기초교양','글로벌의사소통':'기초교양',
  '디지털커뮤니케이션':'균형교양','인문예술':'균형교양','사회와문화':'균형교양','자연과학기술의이해':'균형교양',
  '언어의세계':'확대교양','소양교육':'확대교양'
};
const LIBERAL_CATS = new Set(['기초교양','균형교양','확대교양']);

function extractSubtitle(queryTitle) {
  const m=(queryTitle||'').match(/교양[-\s]?(.+)$/);
  return m?m[1].trim():'';
}

/* ── server.js와 동일한 fetchDeptList (regex 방식) ── */
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

function buildCourses(liberalRows, majorRows, extraRows) {
  const map={};
  // 교양 (온라인 과목 포함)
  for(const row of liberalRows) {
    const raw=clean(row.schedule_room);
    const slots=raw?mergeSlots(parseSched(raw)):[];
    const online=!slots.length;
    const eyears=[];
    for(const m of (row.eligible_grade_dept||'').matchAll(/([1-4])/g)){const y=Number(m[1]);if(!eyears.includes(y))eyears.push(y);}
    const sec=secNum(row.code);
    const subtitle=row.forced_subtitle||extractSubtitle(row.query_title||'');
    const category=row.forced_category||normLibCat(clean(row.category));
    const key=`${clean(row.name)}||${clean(row.professor)}||${sec}`;
    if(!map[key]) map[key]={name:clean(row.name),type:'liberal',category,subtitle,department:'',dept_code:'',credits:Number(clean(row.credits))||0,professor:clean(row.professor),section:sec,eligible_years:eyears.sort(),slots:[],online};
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
  // extra
  const baseCodes=new Set([...liberalRows,...majorRows].map(r=>clean(r.code||'')).filter(Boolean));
  for(const row of extraRows) {
    const code=clean(row.code||'');
    if(code&&baseCodes.has(code)) continue;
    const raw=clean(row.schedule_room);
    const slots=raw?mergeSlots(parseSched(raw)):[];
    const sec=secNum(row.code);
    const cat=normCat(clean(row.category));
    if(cat==='교직') continue;
    const type=LIBERAL_CATS.has(cat)?'liberal':cat==='자유선택'?'자유선택':'major';
    const openedDept=clean(row.opened_department||'');
    const realDept=(openedDept&&openedDept!=='교양')?openedDept:'';
    const extraOnline = type === 'liberal' && !slots.length;
    const key=`${clean(row.name)}||${clean(row.professor)}||${sec}||${row.gubun_code||''}`;
    if(!map[key]) map[key]={name:clean(row.name),type,category:cat,subtitle:'',department:realDept,dept_code:'',credits:Number(clean(row.credits))||0,professor:clean(row.professor),section:sec,eligible_years:row.eligible_years||[],gubun_label:row.gubun_label||'',slots:[],...(extraOnline?{online:true}:{})};
    map[key].slots.push(...slots);
  }
  return Object.values(map).map(c=>({...c,slots:uniqSlots(c.slots)}));
}

const EXTRA_GUBUNS=[{gubun:'9',label:'학부원어강좌'},{gubun:'10',label:'학부인터넷강좌'},{gubun:'11',label:'학부자유선택'}];
const LIBERAL_GRADES=['0','1','2','3','4','5','6','7','8','9'];

async function crawlCourses(year, term) {
  console.log(`[${year}-${term}] 크롤링 시작`);
  const liberalRows=[], majorRows=[], extraRows=[];

  for(const g of LIBERAL_GRADES) {
    try {
      const html=await fetchCategory(year,term,'0',g,'0',g);
      const subtitle=LIBERAL_DETAIL_MAP[g]||'';
      const category=LIBERAL_SUBTITLE_CAT[subtitle]||'기초교양';
      liberalRows.push(...parseRows(html,{forced_subtitle:subtitle,forced_category:category}));
      await sleep(350);
    } catch(e){console.warn(`  교양 g=${g} 실패:`,e.message);}
  }

  try {
    const depts=await fetchDeptList(year,term);
    process.stdout.write(`  학과 ${depts.length}개 `);
    for(const dept of depts) {
      try {
        const html=await fetchCategory(year,term,'1',dept.code,dept.code,dept.code);
        majorRows.push(...parseRows(html,{dept_code:dept.code,dept_name:dept.name}));
        process.stdout.write('.');
        await sleep(350);
      } catch(e){process.stdout.write('x');}
    }
    console.log();
  } catch(e){console.warn('  학과 목록 실패:',e.message);}

  for(const {gubun,label} of EXTRA_GUBUNS) {
    try {
      const html=await fetchCategory(year,term,gubun,'',gubun,gubun);
      extraRows.push(...parseRows(html,{gubun_code:gubun,gubun_label:label}));
      await sleep(350);
    } catch(e){console.warn(`  extra ${label} 실패:`,e.message);}
  }

  const courses=buildCourses(liberalRows,majorRows,extraRows);
  console.log(`  교양:${liberalRows.length} 전공:${majorRows.length} extra:${extraRows.length} → ${courses.length}개`);
  return courses;
}

/* ── 재크롤 대상 ── */
const TARGETS = [
  ['2021','1'],['2021','2'],['2021','3'],['2021','4'],
  ['2022','1'],['2022','2'],['2022','3'],['2022','4'],
  ['2023','1'],['2023','2'],['2023','3'],['2023','4'],
  ['2024','1'],['2024','2'],['2024','3'],['2024','4'],
  ['2025','1'],['2025','2'],['2025','3'],['2025','4'],
  ['2026','1'],
];
const TERM_MAP = {'1':'1','2':'2','3':'3','4':'4'};

async function main() {
  console.log(`총 ${TARGETS.length}개 학기 재크롤 시작\n`);
  let done=0, skipped=0;
  for(const [year,term] of TARGETS) {
    const key=`${year}_${term}`;
    const filePath=path.join(DATA_DIR,`courses_${key}.json`);
    try {
      const courses=await crawlCourses(year,term);
      if(courses.length===0){
        console.log(`  ⚠ 결과 없음 — 기존 유지\n`);
        skipped++; continue;
      }
      fs.writeFileSync(filePath,JSON.stringify(courses,null,2),'utf-8');
      console.log(`  ✓ 저장 완료: ${courses.length}개\n`);
      done++;
    } catch(e){
      console.error(`  ✗ 실패:`,e.message,'— 기존 유지\n');
      skipped++;
    }
    await sleep(800);
  }
  console.log(`\n완료: ${done}개 업데이트, ${skipped}개 스킵`);
}

main().catch(console.error);
