/* =========================================================================
   STATE / STORAGE
   ========================================================================= */
const STORE_KEY = 'mrplSafetyGridState_v1';
const SESSION_KEY = 'mrplSafetyGridSession_v1';
const OSHA_LIMIT_TEXT = '1 ppm (8-hr TWA)';
const WARNING_THRESHOLD = 13;
function statusForExposure(label, ppmh){
  if(label==='Fresh' || label==='Low') return 'safe';
  if(label==='High' || label==='Very High') return 'high-risk';
  return 'warning';
}
function isAlertStatus(status){ return status==='warning' || status==='high-risk'; }
function statusTone(status){ return status==='high-risk' ? 'high-risk' : (status==='warning' ? 'warn' : 'safe'); }
function statusText(status, label){
  if(status==='high-risk') return 'HIGH RISK';
  if(status==='warning') return label==='Medium' ? 'MILD RISK' : 'WARNING';
  return 'SAFE';
}
function statusIcon(status){ return status==='safe' ? '&#10003;' : '&#9888;'; }
function statusClass(status){ return status==='high-risk' ? 'high-risk' : (status==='warning' ? 'warning' : 'safe'); }
function isDarkExposure(label){ return label==='High' || label==='Very High'; }

/* =========================================================================
   SAFE STORAGE — falls back to in-memory if localStorage/sessionStorage is
   blocked (Safari private mode, sandboxed file previews, strict privacy
   settings, etc.) so the app degrades to "works for this session only"
   instead of silently breaking every click handler.
   ========================================================================= */
const _memoryStore = {};
function safeGet(kind, key){
  try{
    const store = kind==='session' ? sessionStorage : localStorage;
    return store.getItem(key);
  }catch(e){
    return Object.prototype.hasOwnProperty.call(_memoryStore, kind+':'+key) ? _memoryStore[kind+':'+key] : null;
  }
}
function safeSet(kind, key, value){
  try{
    const store = kind==='session' ? sessionStorage : localStorage;
    store.setItem(key, value);
  }catch(e){
    _memoryStore[kind+':'+key] = value;
  }
}
function safeRemove(kind, key){
  try{
    const store = kind==='session' ? sessionStorage : localStorage;
    store.removeItem(key);
  }catch(e){
    delete _memoryStore[kind+':'+key];
  }
}

function defaultSlots(){
  return [
    { id:'P-1001', dept:'Wastewater Treatment', shift:'08:00–16:00', name:'Rubika Sri', username:'rubika.p1001', password:'demo', registered:true },
    { id:'P-1002', dept:'Process Unit A',        shift:'08:00–16:00', name:'Anitha R', username:'anitha.p1002', password:'demo', registered:true },
    { id:'P-1003', dept:'Tank Farm',             shift:'16:00–00:00', name:'Karthik M', username:'karthik.p1003', password:'demo', registered:true },
    { id:'P-1004', dept:'Loading Bay',           shift:'00:00–08:00', name:'Divya S', username:'divya.p1004', password:'demo', registered:true },
    { id:'P-1005', dept:'Process Unit B',        shift:'08:00–16:00', name:'Arun Kumar', username:'arun.p1005', password:'demo', registered:true }
  ];
}

function normalizeSlots(slots){
  const roster = defaultSlots();
  return roster.map((person,index)=>{
    const saved = slots[index] || {};
    return { ...person, ...saved, id:person.id, name:person.name, registered:true };
  });
}

function loadState(){
  try{
    const raw = safeGet('local', STORE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && Array.isArray(parsed.slots) && parsed.slots.length){
        const oldSlotIds = parsed.slots.map(slot=>slot.id);
        parsed.slots = normalizeSlots(parsed.slots);
        if(Array.isArray(parsed.readings)){
          parsed.readings.forEach(reading=>{
            const oldIndex = oldSlotIds.indexOf(reading.slotId);
            if(oldIndex >= 0 && parsed.slots[oldIndex]) reading.slotId = parsed.slots[oldIndex].id;
          });
          parsed.readings.forEach(reading=>{ reading.status=statusForExposure(reading.exposureLabel, reading.ppmh); });
          safeSet('local', STORE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  }catch(e){}
  const fresh = { slots: defaultSlots(), readings: [] };
  safeSet('local', STORE_KEY, JSON.stringify(fresh));
  return fresh;
}
function saveState(state){ safeSet('local', STORE_KEY, JSON.stringify(state)); }

function getSession(){
  try{ return JSON.parse(safeGet('session', SESSION_KEY) || 'null'); }catch(e){ return null; }
}
function setSession(s){ safeSet('session', SESSION_KEY, JSON.stringify(s)); }
function clearSession(){ safeRemove('session', SESSION_KEY); }

let STATE = loadState();
let currentSlotId = null;
let expandedSlot = null;
let supervisorHistorySlot = null;
let supervisorFlowPpm = null;
let supervisorFlowRecord = {};
let supervisorLastRecordKey = null;
const supervisorSamples = {};
const REFERENCE_RGB_BY_LABEL = {
  Fresh:{r:229,g:217,b:206}, Low:{r:219,g:193,b:134}, Medium:{r:174,g:135,b:67}, High:{r:109,g:77,b:32}, 'Very High':{r:35,g:25,b:33}
};

/* =========================================================================
   UTIL
   ========================================================================= */
function todayStr(){ return new Date().toISOString().slice(0,10); }
function nowHHMM(){ const d=new Date(); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function fmtDate(iso){
  const d = new Date(iso+'T00:00:00');
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
}
function daysAgoStr(n){
  const d = new Date(); d.setDate(d.getDate()-n);
  return d.toISOString().slice(0,10);
}
function initials(name){
  if(!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}
function readingsForSlot(slotId){ return STATE.readings.filter(r=>r.slotId===slotId); }
function readingsInRange(slotId, fromDate){
  return readingsForSlot(slotId).filter(r=> r.date >= fromDate);
}

/* =========================================================================
   LANDING GRID BACKGROUND
   ========================================================================= */
function buildGrid(){
  const el = document.getElementById('grid-bg');
  if(!el) return;
  const count = 260;
  let html = '';
  for(let i=0;i<count;i++){
    const val = Math.random() < 0.15
      ? (Math.random()*20).toFixed(1)
      : Math.floor(Math.random()*90+8);
    const delay = (Math.random()*4).toFixed(2);
    html += '<span style="animation-delay:'+delay+'s">'+val+'</span>';
  }
  el.innerHTML = html;
}

/* =========================================================================
   SCREEN NAVIGATION
   ========================================================================= */
function showScreen(id){
  document.querySelectorAll('body > section').forEach(s=>s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  window.scrollTo(0,0);
}
function goTo(where){
  if(where==='landing') showScreen('screen-landing');
  else if(where==='worker'){ populateSlotSelect(); document.getElementById('reg-msg').innerHTML=''; document.getElementById('login-msg').innerHTML=''; setWorkerTab('login'); showScreen('screen-worker-auth'); }
  else if(where==='supervisor'){ document.getElementById('sup-msg').innerHTML=''; showScreen('screen-supervisor-auth'); }
}

// on load, resume session if present
function boot(){
  buildGrid();
  const s = getSession();
  if(s && s.role==='worker' && STATE.slots.find(x=>x.id===s.slotId && x.registered)){
    renderWorkerApp(s.slotId);
    showScreen('screen-worker-app');
  } else if(s && s.role==='supervisor'){
    renderSupervisorApp();
    showScreen('screen-supervisor-app');
  } else {
    showScreen('screen-landing');
  }
}

/* =========================================================================
   WORKER AUTH
   ========================================================================= */
function setWorkerTab(tab){
  const isReg = tab==='register';
  document.getElementById('wtab-register').classList.toggle('active', isReg);
  document.getElementById('wtab-login').classList.toggle('active', !isReg);
  document.getElementById('w-register-panel').classList.toggle('hidden', !isReg);
  document.getElementById('w-login-panel').classList.toggle('hidden', isReg);
  document.getElementById('w-tab-eyebrow').textContent = isReg ? '02 / OPTIONAL REGISTRATION' : '01 / GATE ENTRY';
  document.getElementById('w-tab-title').textContent = isReg ? 'Bind Account to Hardware Slot' : 'Enter Worker Name';
}

function populateSlotSelect(){
  const sel = document.getElementById('reg-slot');
  sel.innerHTML = '';
  STATE.slots.forEach(slot=>{
    const opt = document.createElement('option');
    opt.value = slot.id;
    opt.textContent = slot.registered
      ? slot.id+' — '+slot.dept+' (taken by '+slot.name+')'
      : slot.id+' — '+slot.dept+' (open)';
    if(slot.registered) opt.disabled = true;
    sel.appendChild(opt);
  });
}

function registerWorker(){
  const name = document.getElementById('reg-name').value.trim();
  const slotId = document.getElementById('reg-slot').value;
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  const msg = document.getElementById('reg-msg');

  if(!name || !username || !password){
    msg.innerHTML = '<div class="msg-err">Please fill in name, username and password/PIN.</div>';
    return;
  }
  if(password.length < 4){
    msg.innerHTML = '<div class="msg-err">Password/PIN must be at least 4 characters (numbers are fine).</div>';
    return;
  }
  const usernameTaken = STATE.slots.some(s=>s.registered && s.username.toLowerCase()===username.toLowerCase());
  if(usernameTaken){
    msg.innerHTML = '<div class="msg-err">That username is already bound to a slot.</div>';
    return;
  }
  const slot = STATE.slots.find(s=>s.id===slotId);
  if(!slot || slot.registered){
    msg.innerHTML = '<div class="msg-err">Selected slot is unavailable. Choose another.</div>';
    return;
  }
  slot.name = name;
  slot.username = username;
  slot.password = password;
  slot.registered = true;
  saveState(STATE);

  msg.innerHTML = '<div class="msg-ok">Registered "'+escapeHtml(username)+'" &rarr; slot '+slot.id+' ('+slot.dept+'). You can now log in below.</div>';
  document.getElementById('reg-name').value='';
  document.getElementById('reg-username').value='';
  document.getElementById('reg-password').value='';
  populateSlotSelect();
  setTimeout(()=>{
    setWorkerTab('login');
    document.getElementById('login-name').value = name;
    document.getElementById('login-password').value = '2222';
  }, 700);
}

function loginWorker(){
  const enteredValue = document.getElementById('login-name').value.trim();
  const name = enteredValue || 'Guest Worker';
  const password = document.getElementById('login-password').value.trim() || 'demo';
  const msg = document.getElementById('login-msg');
  let slot = STATE.slots.find(s=>s.registered && s.name.toLowerCase()===name.toLowerCase());
  if(!slot){
    slot = STATE.slots.find(s=>!s.registered);
    if(slot){
      const base = name.toLowerCase().replace(/[^a-z0-9]+/g,'.').replace(/^\.|\.$/g,'') || 'worker';
      slot.name = name;
      slot.username = base+'_'+slot.id.slice(-3);
      slot.password = password;
      slot.registered = true;
      saveState(STATE);
    } else {
      const slotIndex = Array.from(name+password).reduce((total, character)=>total+character.charCodeAt(0),0) % STATE.slots.length;
      slot = STATE.slots[slotIndex];
    }
  }
  setSession({ role:'worker', slotId:slot.id, loginTs: Date.now() });
  msg.innerHTML = '<div class="msg-ok">Gate entry accepted. Opening worker dashboard for '+escapeHtml(name)+'.</div>';
  renderWorkerApp(slot.id);
  showScreen('screen-worker-app');
}

/* =========================================================================
   SUPERVISOR AUTH
   ========================================================================= */
const SUP_USER = 'supervisor';
const SUP_PASS = '4321';
function loginSupervisor(){
  const usernameEl = document.getElementById('sup-username');
  const passwordEl = document.getElementById('sup-password');
  const msg = document.getElementById('sup-msg');

  // Normalize username only; password remains exact.
  const u = (usernameEl.value || '').trim().toLowerCase();
  const p = (passwordEl.value || '').trim();
  msg.innerHTML = '';

  if(u !== SUP_USER || p !== SUP_PASS){
    msg.innerHTML = '<div class="msg-err">Incorrect username or password. Use supervisor / 4321.</div>';
    passwordEl.focus();
    return false;
  }

  // Save the session and open the console first so a rendering issue cannot
  // make the login button appear unresponsive.
  setSession({ role:'supervisor' });
  showScreen('screen-supervisor-app');

  try{
    renderSupervisorApp();
  }catch(err){
    console.error('Supervisor console render error:', err);
    const slotsEl = document.getElementById('sup-slots');
    if(slotsEl){
      slotsEl.innerHTML = '<div class="card"><div class="msg-err">Supervisor login succeeded, but dashboard data could not be rendered. Refresh the console.</div></div>';
    }
  }

  return true;
}

function logout(){
  clearSession();
  goTo('landing');
}

/* =========================================================================
   WORKER APP — DASHBOARD / HISTORY / REPORTS / SETTINGS
   ========================================================================= */
function setWorkerView(name){
  ['dashboard','history','reports','settings'].forEach(v=>{
    document.getElementById('view-'+v).classList.toggle('active', v===name);
    document.getElementById('nav-'+v).classList.toggle('active', v===name);
  });
  const subtitleMap = { dashboard:'H\u2082S Safety Monitor', history:'Exposure History', reports:'Reports', settings:'Settings' };
  document.getElementById('w-app-subtitle').textContent = subtitleMap[name];
  if(name==='history') renderHistory();
  if(name==='reports') renderReports();
  if(name==='settings') renderSettings();
  if(name==='history') startHistoryWatch(); else stopHistoryWatch();
}
let historyWatchTimer=null;
function startHistoryWatch(){
  stopHistoryWatch(); renderHistory(); historyWatchTimer=setInterval(()=>{ renderHistory(); renderWorkerExposureMetrics(); },1000);
}
function stopHistoryWatch(){ if(historyWatchTimer){ clearInterval(historyWatchTimer); historyWatchTimer=null; } }

function renderWorkerApp(slotId){
  currentSlotId = slotId;
  const slot = STATE.slots.find(s=>s.id===slotId);
  document.getElementById('w-avatar').textContent = initials(slot.name);
  document.getElementById('w-name').textContent = slot.name;
  document.getElementById('w-id').textContent = slot.id;
  document.getElementById('w-dept').textContent = slot.dept;
  document.getElementById('w-shift').textContent = slot.shift;
  renderDashboardScanArea();
  setWorkerView('dashboard');
}

function readingTimestamp(reading){
  const value=reading.timestamp || (reading.date+'T'+reading.time+':00');
  const timestamp=Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Date.now();
}
function ppmExposureTotals(readings, now){
  const current=now || Date.now();
  const ppmValues=readings.map(reading=>({ppm:Number(reading.ppm ?? reading.ppmh),time:readingTimestamp(reading)})).filter(item=>Number.isFinite(item.ppm));
  const tenMinuteSum=ppmValues.filter(item=>current-item.time<=600000).reduce((sum,item)=>sum+item.ppm,0);
  const hourSum=ppmValues.filter(item=>current-item.time<=3600000).reduce((sum,item)=>sum+item.ppm,0);
  return {ppmSec:tenMinuteSum, ppmMin:tenMinuteSum/60, ppmHour:hourSum/3600, hourSum, points:ppmValues};
}
function renderWorkerExposureMetrics(){
  const readings=readingsForSlot(currentSlotId).filter(reading=>reading.date===todayStr());
  const totals=ppmExposureTotals(readings);
  const shortEl=document.getElementById('w-short-exposure');
  const hourEl=document.getElementById('w-hour-exposure');
  if(shortEl) shortEl.innerHTML=totals.ppmMin.toFixed(3)+'<span> ppm-min</span>';
  if(hourEl) hourEl.innerHTML=totals.ppmHour.toFixed(3)+'<span> ppm-hr</span>';
  renderExposureBars('w-exposure-graph',readings.slice(-12));
}
function renderExposureBars(id,readings){
  const el=document.getElementById(id); if(!el) return;
  const max=Math.max(1,...readings.map(reading=>Number(reading.ppm ?? reading.ppmh) || 0));
  el.innerHTML=readings.length ? readings.map(reading=>'<i class="'+statusTone(reading.status)+'" title="'+escapeHtml(reading.time||'')+' · '+Number(reading.ppm ?? reading.ppmh).toFixed(2)+' ppm" style="height:'+Math.max(8,((Number(reading.ppm ?? reading.ppmh) || 0)/max)*100)+'%"></i>').join('') : '<span style="font-size:10px;color:var(--text-faint);">No exposure samples yet</span>';
}

function renderDashboardScanArea(){
  const container = document.getElementById('dash-scan-content');
  const readings = readingsForSlot(currentSlotId).filter(r=>r.date===todayStr());
  updateScanLimit(readings.length);
  renderWorkerExposureMetrics();
  const checkpoint = scanCheckpointMarkup(readings.length);
  if(readings.length===0){
    container.innerHTML = `
      ${checkpoint}
      <div class="card empty-state">
        <div class="big">&#129514;</div>
        No strips scanned yet today.<br>Tap "New Strip Scan" above to run your first colorimetric reading.
      </div>`;
    return;
  }
  const latest = readings[readings.length-1];
  const cumulative = readings.reduce((sum,r)=>sum+r.ppmh,0);
  const shiftHrs = getShiftHours();
  const statusBadgeClass = statusClass(latest.status);
  const referenceColor = referenceRgbForReading(latest);
  const exposedColor = latest.extractedRgb || {r:128,g:128,b:128};

  container.innerHTML = `
    ${checkpoint}
    <div class="card">
      <div class="card-label" style="display:flex; align-items:center; justify-content:space-between;">
        <span>STRIP ANALYSIS</span>
        <span>${colorSourceBadge(latest.colorSource)}${qrStatusBadge(latest)}</span>
      </div>
      <div class="strip-grid">
        <div class="strip-col">
          <div class="cap">Built-in Reference Guide</div>
          <div class="strip-box ref" style="background:rgb(${referenceColor.r},${referenceColor.g},${referenceColor.b});${latest.refImg ? "background-image:url('"+latest.refImg+"');background-color:transparent;" : ''}"></div>
          <div class="strip-chip">${latest.exposureLabel || 'Clean'} reference</div>
          <div class="color-readout">RGB ${referenceColor.r} / ${referenceColor.g} / ${referenceColor.b}</div>
        </div>
        <div class="play-dot">&#9654;</div>
        <div class="strip-col">
          <div class="cap">Exposed Strip</div>
          <div class="strip-box exp" style="background:rgb(${exposedColor.r},${exposedColor.g},${exposedColor.b});${latest.expImg ? "background-image:url('"+latest.expImg+"');background-color:transparent;" : ''}"></div>
          <div class="strip-chip">H&#8322;S Exposed</div>
          <div class="color-readout">Extracted RGB ${latest.extractedRgb ? latest.extractedRgb.r+' / '+latest.extractedRgb.g+' / '+latest.extractedRgb.b : '-- / -- / --'}</div>
        </div>
      </div>
    </div>

    <div class="card ai-result-card">
      <div class="card-label">AI ANALYSIS RESULT</div>
      <div class="ai-result-top">
        <div>
          <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px;">Cumulative Exposure</div>
          <div class="ai-num">${cumulative.toFixed(1)}<span> ppm&middot;h</span></div>
          <div style="font-size:10.5px;color:var(--teal);margin-top:5px;">Matched shade: ${latest.exposureLabel || 'Reference matched'} &middot; ${latest.exposureRange || 'Calibrated range'}</div>
        </div>
        <div class="status-badge ${statusBadgeClass}">
          <span style="font-size:18px;">${statusIcon(latest.status)}</span>
          ${statusText(latest.status, latest.exposureLabel)}
        </div>
      </div>
      <div class="conf-row"><span>AI Confidence</span><span>${latest.confidence.toFixed(1)}%</span></div>
      <div class="conf-bar"><div class="conf-fill" style="width:${latest.confidence}%"></div></div>
    </div>

    <div class="mini-grid">
      <div class="mini-card purple">
        <div class="lbl">&#128200; Cumulative</div>
        <div class="val">${cumulative.toFixed(1)}<span> ppm&middot;h</span></div>
      </div>
      <div class="mini-card">
        <div class="lbl">&#128337; Shift Time</div>
        <div class="val">${shiftHrs}<span> hrs</span></div>
      </div>
    </div>

    <div class="card">
      <div class="card-label" style="display:flex; align-items:center; justify-content:space-between;">
        <span>ENVIRONMENT</span>
        ${envSourceBadge(latest.envSource)}
      </div>
      <div class="env-grid">
        <div class="env-item temp"><div class="ic">&#127777;</div><div class="val">${latest.temp}&deg;C</div><div class="lbl">Temperature</div></div>
        <div class="env-item hum"><div class="ic">&#128167;</div><div class="val">${latest.humidity}%</div><div class="lbl">Humidity</div></div>
        <div class="env-item comp"><div class="ic">&#9881;</div><div class="val">${latest.compensation}</div><div class="lbl">Compensation</div></div>
      </div>
    </div>
  `;
}

function scanCheckpointMarkup(count){
  const labels=['Before work','Mid-shift','End of shift'];
  return '<div class="checkpoint-card"><b>SHIFT SAFETY CHECKS <span style="float:right;color:var(--teal);">'+Math.min(count,3)+'/3</span></b><div class="checkpoint-row">'+labels.map((label,index)=>'<span class="'+(index<count?'done':index===count?'next':'')+'">'+(index<count?'&#10003; ':'')+label+'</span>').join('')+'</div><div style="font-size:10px;color:var(--text-dim);margin-top:8px;">'+(count<3 ? 'Next: '+labels[count]+' strip check' : 'All shift checkpoints completed')+'</div></div>';
}

function referenceRgbForReading(reading){
  if(reading.referenceRgb) return reading.referenceRgb;
  return REFERENCE_RGB_BY_LABEL[reading.exposureLabel] || REFERENCE_RGB_BY_LABEL.Fresh;
}

function updateScanLimit(count){
  const cta = document.querySelector('#view-dashboard .scan-cta');
  const limit = document.getElementById('scan-limit');
  const countEl = document.getElementById('scan-count');
  if(countEl) countEl.textContent = Math.min(count, 3)+' / 3';
  if(cta){ cta.disabled = count >= 3; cta.style.opacity = count >= 3 ? '.45' : '1'; cta.textContent = count >= 3 ? '\u2713 Three scans complete for today' : '\ud83d\udcf8 New Strip Scan'; }
  if(limit) limit.classList.toggle('locked', count >= 3);
}

function envSourceBadge(source){
  if(source==='live') return '<span class="badge-sm safe" style="margin-left:0;">&#128246; Live Sensor</span>';
  if(source==='unreachable') return '<span class="badge-sm warn" style="margin-left:0;">&#9888; Sensor Unreachable &middot; Simulated</span>';
  return '<span class="badge-sm" style="margin-left:0; background:rgba(139,148,175,0.12); color:var(--text-dim); border:1px solid var(--border);">Simulated</span>';
}
function colorSourceBadge(source){
  if(source==='fixed-reference-match' || source==='measured') return '<span class="badge-sm safe" style="margin-left:0;">&#10003; Color extracted</span>';
  return '<span class="badge-sm warn" style="margin-left:0;">&#9888; Color estimate &middot; image unreadable</span>';
}
function qrStatusBadge(reading){
  if(reading.qrImage && reading.qrValue) return '<span class="badge-sm safe" style="margin-left:4px;">&#128247; QR captured</span>';
  return '<span class="badge-sm warn" style="margin-left:4px;">&#9888; QR unreadable</span>';
}
function getShiftHours(){
  const s = getSession();
  if(!s || !s.loginTs) return '0.0';
  const hrs = (Date.now() - s.loginTs) / 3600000;
  const shown = Math.max(0.2, hrs);
  return shown.toFixed(1);
}

/* ---------- HISTORY ---------- */
function renderHistory(){
  const all = readingsForSlot(currentSlotId).slice().sort((a,b)=> (a.date+a.time) < (b.date+b.time) ? 1 : -1);
  const today = all.filter(r=>r.date===todayStr());
  const total = today.reduce((s,r)=>s+r.ppmh,0);
  const alerts = today.filter(r=>isAlertStatus(r.status)).length;
  document.getElementById('h-total').textContent = total.toFixed(1);
  document.getElementById('h-count').textContent = today.length;
  document.getElementById('h-alerts').textContent = alerts;

  const trendSet = all.slice(0,5);
  const maxV = Math.max(20, ...trendSet.map(r=>r.ppmh));
  document.getElementById('h-trend').innerHTML = trendSet.length ? trendSet.map(r=>{
    const cls = statusTone(r.status);
    const pct = Math.min(100, (r.ppmh/maxV)*100);
    return `<div class="trend-col">
      <div class="v ${cls}">${r.ppmh.toFixed(1)}</div>
      <div class="trend-bar"><i class="${cls}" style="width:${pct}%"></i></div>
      <div class="t">${r.time}</div>
    </div>`;
  }).join('') : '<div class="empty-state" style="padding:10px;">No readings yet.</div>';

  document.getElementById('h-list').innerHTML = all.length ? all.map(r=>{
    const cls = statusTone(r.status);
    return `<div class="reading-row">
      <div>
        <div class="time">${r.time}</div>
        <div class="date">${fmtDate(r.date)}</div>
      </div>
      <div class="right">
        <div><span class="ppm ${cls}">${r.ppmh.toFixed(1)} ppm&middot;h</span><span class="badge-sm ${cls}">${statusText(r.status, r.exposureLabel)}</span></div>
        <div class="meta">${r.temp}&deg;C &middot; ${r.humidity}% RH &middot; ${r.confidence.toFixed(1)}% conf</div>
      </div>
    </div>`;
  }).join('') : '<div class="empty-state">No readings recorded yet.</div>';
}

/* ---------- REPORTS ---------- */
let reportPeriod = 'today';
function setReportPeriod(p){
  reportPeriod = p;
  document.querySelectorAll('.period-tabs button').forEach(b=>b.classList.toggle('active', b.dataset.p===p));
  renderReports();
}
function renderReports(){
  const slot = STATE.slots.find(s=>s.id===currentSlotId);
  document.getElementById('r-avatar').textContent = initials(slot.name);
  document.getElementById('r-name').textContent = slot.name;
  document.getElementById('r-id').textContent = slot.id+' \u00b7 '+slot.dept;

  let fromDate = todayStr(), periodLabel = fmtDate(todayStr());
  if(reportPeriod==='week'){ fromDate = daysAgoStr(6); periodLabel = fmtDate(fromDate)+' \u2013 '+fmtDate(todayStr()); }
  else if(reportPeriod==='month'){ fromDate = daysAgoStr(29); periodLabel = fmtDate(fromDate)+' \u2013 '+fmtDate(todayStr()); }

  const set = readingsInRange(currentSlotId, fromDate);
  const warn = set.filter(r=>isAlertStatus(r.status)).length;
  const compliant = warn===0;

  document.getElementById('r-period').textContent = periodLabel;
  document.getElementById('r-total').textContent = set.length;
  document.getElementById('r-checkpoints').textContent = Math.min(set.length,3)+' / 3';
  document.getElementById('r-warn').textContent = warn;
  const statusEl = document.getElementById('r-status');
  statusEl.textContent = compliant ? '\u2713 Compliant' : '\u26a0 Needs Review';
  statusEl.className = 'v ' + (compliant ? 'ok' : 'bad');

  const score = set.length ? Math.round(((set.length-warn)/set.length)*100) : 100;
  document.getElementById('r-donut-num').textContent = score+'%';
  document.getElementById('r-donut').style.background = `conic-gradient(var(--green) ${score}%, var(--card-2) ${score}%)`;
  document.getElementById('r-donut-title').textContent = score>=90 ? 'Excellent compliance.' : (score>=70 ? 'Good, minor warnings.' : 'Review exposure pattern.');
  document.getElementById('r-donut-sub').textContent = set.length
    ? `${set.length-warn} of ${set.length} readings were below the OSHA TLV-TWA limit.`
    : 'No readings yet for this period.';

  if(set.length){
    const peak = set.reduce((a,b)=> b.ppmh>a.ppmh ? b : a);
    document.getElementById('r-peak').innerHTML = peak.ppmh.toFixed(1)+'<span style="font-size:13px;color:var(--text-dim);"> ppm&middot;h</span>';
    document.getElementById('r-peak-meta').textContent = 'at '+peak.time+' \u00b7 '+fmtDate(peak.date);
    document.getElementById('r-peak-icon').textContent = isAlertStatus(peak.status) ? '\u26a0' : '\u2713';
  } else {
    document.getElementById('r-peak').innerHTML = '0.0<span style="font-size:13px;color:var(--text-dim);"> ppm&middot;h</span>';
    document.getElementById('r-peak-meta').textContent = 'No data';
    document.getElementById('r-peak-icon').textContent = '\u2013';
  }
}

function generatePdfReport(){
  const slot = STATE.slots.find(s=>s.id===currentSlotId);
  const w = window.open('', '_blank');
  const set = readingsForSlot(currentSlotId);
  const rows = set.map(r=>`<tr><td>${fmtDate(r.date)}</td><td>${r.time}</td><td>${r.ppmh.toFixed(1)}</td><td>${r.status}</td><td>${r.confidence.toFixed(1)}%</td></tr>`).join('');
  w.document.write(`
    <html><head><title>MRPL Safety Grid Report - ${slot.id}</title>
    <style>
      body{font-family:Arial, sans-serif; padding:30px; color:#111;}
      h1{font-size:20px;} h2{font-size:14px;color:#444;margin-top:22px;}
      table{width:100%; border-collapse:collapse; margin-top:10px;}
      td,th{border:1px solid #ccc; padding:6px 8px; font-size:12px; text-align:left;}
      .badge{padding:2px 6px;border-radius:6px;font-size:11px;}
    </style></head><body>
    <h1>MRPL Refinery Safety Grid — Exposure Report</h1>
    <p><b>${slot.name}</b> (${slot.id}) &middot; ${slot.dept} &middot; Shift ${slot.shift}</p>
    <p>OSHA TLV-TWA Limit: ${OSHA_LIMIT_TEXT}</p>
    <h2>Reading Log</h2>
    <table><tr><th>Date</th><th>Time</th><th>ppm&middot;h</th><th>Status</th><th>Confidence</th></tr>${rows || '<tr><td colspan=5>No readings recorded.</td></tr>'}</table>
    </body></html>
  `);
  w.document.close();
  setTimeout(()=>{ w.print(); }, 300);
}

function shareReport(){
  const slot = STATE.slots.find(s=>s.id===currentSlotId);
  const set = readingsInRange(currentSlotId, todayStr());
  const total = set.reduce((s,r)=>s+r.ppmh,0);
  const text = `MRPL Safety Grid — ${slot.name} (${slot.id})\nToday: ${set.length} readings, cumulative ${total.toFixed(1)} ppm\u00b7h.\nOSHA TLV-TWA limit: ${OSHA_LIMIT_TEXT}.`;
  if(navigator.share){
    navigator.share({ title:'MRPL Safety Grid Report', text }).catch(()=>{});
  } else if(navigator.clipboard){
    navigator.clipboard.writeText(text).then(()=> alert('Report summary copied to clipboard.'));
  } else {
    alert(text);
  }
}

/* ---------- SETTINGS ---------- */
function renderSettings(){
  const slot = STATE.slots.find(s=>s.id===currentSlotId);
  document.getElementById('s-name').textContent = slot.name;
  document.getElementById('s-id').textContent = slot.id;
  document.getElementById('s-dept').textContent = slot.dept;
  document.getElementById('s-shift').textContent = slot.shift;
  document.getElementById('s-user').textContent = slot.username;
  document.getElementById('sensor-ip').value = getSensorIp() || '';
}
function resetTodaysScans(){
  const before=STATE.readings.length;
  STATE.readings=STATE.readings.filter(reading=>reading.date!==todayStr());
  saveState(STATE);
  const msg=document.getElementById('demo-reset-msg');
  if(msg) msg.innerHTML='<div class="msg-ok">Reset '+(before-STATE.readings.length)+' demo scan(s). The camera workflow is ready again.</div>';
  renderWorkerApp(currentSlotId);
}

/* ---------- ENVIRONMENT SENSOR (ESP32 / DHT22 / BME280) ---------- */
const SENSOR_IP_KEY = 'mrplSensorIp_v1';
function getSensorIp(){ return safeGet('local', SENSOR_IP_KEY) || ''; }
function saveSensorIp(){
  const ip = document.getElementById('sensor-ip').value.trim();
  const msg = document.getElementById('sensor-ip-msg');
  if(!ip){
    safeRemove('local', SENSOR_IP_KEY);
    msg.innerHTML = '<div class="msg-ok">Cleared. Scans will use simulated environment values.</div>';
    return;
  }
  safeSet('local', SENSOR_IP_KEY, ip);
  msg.innerHTML = '<div class="msg-ok">Saved. Testing connection&hellip;</div>';
  fetchSensorReading(ip, 3000).then(r=>{
    if(r){
      msg.innerHTML = '<div class="msg-ok">Connected &mdash; live reading: '+r.temp+'&deg;C, '+r.humidity+'% RH.</div>';
      setSensorStatusPill(true);
    } else {
      msg.innerHTML = '<div class="msg-err">Saved, but could not reach the sensor at that IP yet. It will retry on the next scan.</div>';
      setSensorStatusPill(false);
    }
  });
}
function setSensorStatusPill(ok){
  const el = document.getElementById('sensor-status-pill');
  if(!el) return;
  el.textContent = ok ? 'Live sensor OK' : 'Unreachable';
  el.className = 'badge-sm ' + (ok ? 'safe' : 'warn');
}

// Fetches { temp, humidity } from the ESP32 node's /data endpoint.
// Resolves to null (never rejects) if the device is unreachable or the
// request times out, so callers can cleanly fall back to a simulated value.
function fetchSensorReading(ip, timeoutMs){
  return new Promise((resolve)=>{
    if(!ip){ resolve(null); return; }
    const controller = new AbortController();
    const timer = setTimeout(()=>{ controller.abort(); }, timeoutMs || 2500);
    fetch('http://'+ip+'/data', { signal: controller.signal })
      .then(res=>res.json())
      .then(data=>{
        clearTimeout(timer);
        if(typeof data.temp === 'number' && typeof data.humidity === 'number'){
          resolve({ temp:+data.temp.toFixed(1), humidity:Math.round(data.humidity) });
        } else {
          resolve(null);
        }
      })
      .catch(()=>{ clearTimeout(timer); resolve(null); });
  });
}

/* =========================================================================
   STRIP SCAN WIZARD
   ========================================================================= */
let wizardFiles = { exp:null };
let verifiedScanSlot = null;
let correction = { brightness:100, contrast:100 };
let qrCameraStream = null;
let qrCameraActive = false;
let lastQrImage = null;
let stripCameraStream = null;
let stripAutoActive = false;
let stripStableSamples = [];
let analysisStarted = false;

// Fixed references extracted from the supplied five-level color guide.
// These are application constants, not user uploads.
const FIXED_COLOR_REFERENCES = [
  { label:'Fresh',     range:'No exposure',  ppmh:0.0,  rgb:{r:229,g:217,b:206} },
  { label:'Low',       range:'0–1 ppm·h',    ppmh:0.5,  rgb:{r:219,g:193,b:134} },
  { label:'Medium',    range:'1–5 ppm·h',    ppmh:3.0,  rgb:{r:174,g:135,b:67} },
  { label:'High',      range:'5–20 ppm·h',   ppmh:12.5, rgb:{r:109,g:77,b:32} },
  { label:'Very High', range:'>20 ppm·h',    ppmh:25.0, rgb:{r:35,g:25,b:33} }
];

function openWizard(){
  const used = readingsForSlot(currentSlotId).filter(r=>r.date===todayStr()).length;
  if(used >= 3){ updateScanLimit(used); return; }
  wizardFiles = { exp:null };
  analysisStarted = false;
  verifiedScanSlot = null;
  lastQrImage = null;
  correction = { brightness:100, contrast:100 };
  document.getElementById('qr-input').value = '';
  document.getElementById('qr-status').textContent = 'Scan any worker QR badge. The badge image and payload are saved with the strip result.';
  document.getElementById('qr-identity').innerHTML = '';
  document.getElementById('btn-step1-next').disabled = true;
  document.getElementById('scan-count').textContent = used+' / 3';
  document.getElementById('scan-limit').classList.remove('locked');
  const exp = document.getElementById('exp-preview');
  if(exp){
    exp.style.backgroundImage = '';
    exp.classList.remove('filled');
    exp.innerHTML = '<span class="big">&#128247;</span>No strip captured yet';
  }
  document.getElementById('btn-step2-next').disabled = true;
  document.getElementById('wizard-hint-2').textContent = 'Upload one test-strip image to enable analysis';
  document.getElementById('brightness-control').value = 100;
  document.getElementById('contrast-control').value = 100;
  document.getElementById('brightness-value').textContent = '100%';
  document.getElementById('contrast-value').textContent = '100%';
  document.getElementById('pixel-status').textContent = 'Awaiting image';
  document.getElementById('pixel-rgb').textContent = 'RGB -- / -- / --';
  goStep(1);
  document.getElementById('wizard').classList.remove('hidden');
  setTimeout(startQrCamera,120);
}
function readWorkerQr(){
  const raw = document.getElementById('qr-input').value.trim();
  const status = document.getElementById('qr-status');
  const identity = document.getElementById('qr-identity');
  if(!raw){ verifiedScanSlot=null; identity.innerHTML=''; status.textContent='No QR value received yet.'; status.style.color='var(--red)'; document.getElementById('btn-step1-next').disabled=true; return; }
  const slot = STATE.slots.find(s=>s.id===currentSlotId);
  if(!lastQrImage){ captureQrFrame(); }
  verifiedScanSlot=currentSlotId; status.textContent='QR accepted. Badge image will be saved with this shift reading.'; status.style.color='var(--green)';
  identity.innerHTML='<div class="identity-card"><div class="avatar">'+escapeHtml(initials(slot.name))+'</div><div><b>'+escapeHtml(slot.name)+'</b><span>'+slot.id+' &middot; '+escapeHtml(slot.dept)+'</span></div>'+(lastQrImage ? '<img src="'+lastQrImage+'" alt="Captured worker QR" style="width:42px;height:42px;object-fit:cover;border-radius:6px;margin-left:auto;border:1px solid var(--green);">' : '')+'</div>';
  document.getElementById('btn-step1-next').disabled=false;
}
function captureQrFrame(){
  const video=document.getElementById('qr-video');
  if(!video || video.readyState<2 || !video.videoWidth) return null;
  const canvas=document.createElement('canvas'); canvas.width=video.videoWidth*2; canvas.height=video.videoHeight*2;
  const ctx=canvas.getContext('2d'); ctx.filter='brightness(1.12) contrast(1.2) saturate(1.08)'; ctx.drawImage(video,0,0,canvas.width,canvas.height);
  lastQrImage=canvas.toDataURL('image/jpeg',.82);
  return lastQrImage;
}
async function startQrCamera(){
  const status=document.getElementById('qr-status');
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ status.textContent='Live camera access is unavailable here. Use the QR image option or enter the worker ID manually.'; status.style.color='var(--amber)'; return; }
  try{
    qrCameraStream=await openEnvironmentCamera(document.getElementById('qr-video'), APP_CONFIG.CAMERA_CONSTRAINTS);
    
    document.getElementById('qr-camera').classList.add('open');
    status.textContent='Camera active. Hold the worker QR inside the frame.'+(('BarcodeDetector' in window || typeof jsQR==='function') ? '' : ' Enter the ID manually if decoding is unavailable.'); status.style.color='var(--teal)';
    qrCameraActive=true; scanQrVideo();
  }catch(err){ status.textContent='Camera permission was blocked. Allow camera access, or use the QR image/manual ID option.'; status.style.color='var(--red)'; stopQrCamera(); }
}
async function scanQrVideo(){
  if(!qrCameraActive) return;
  try{
    const video=document.getElementById('qr-video');
    if(video.readyState>=2){
      let rawValue='';
      if('BarcodeDetector' in window){
        const detector=new BarcodeDetector({formats:['qr_code']});
        const codes=await detector.detect(video); rawValue=codes[0] ? codes[0].rawValue : '';
      } else if(typeof jsQR==='function'){
        const canvas=scanQrVideo.canvas || (scanQrVideo.canvas=document.createElement('canvas'));
        const scale=Math.min(1,640/video.videoWidth); canvas.width=Math.max(1,Math.round(video.videoWidth*scale)); canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
        const ctx=canvas.getContext('2d',{willReadFrequently:true}); ctx.drawImage(video,0,0,canvas.width,canvas.height);
        const code=jsQR(canvas.width ? ctx.getImageData(0,0,canvas.width,canvas.height).data : [],canvas.width,canvas.height,{inversionAttempts:'attemptBoth'});
        rawValue=code ? code.data : '';
      }
      if(rawValue){
        const frameCanvas=scanQrVideo.canvas || (scanQrVideo.canvas=document.createElement('canvas'));
        frameCanvas.width=video.videoWidth; frameCanvas.height=video.videoHeight;
        frameCanvas.getContext('2d').drawImage(video,0,0,frameCanvas.width,frameCanvas.height);
        lastQrImage=frameCanvas.toDataURL('image/jpeg',.82);
        document.getElementById('qr-input').value=rawValue; readWorkerQr();
        if(verifiedScanSlot===currentSlotId){ stopQrCamera(); setTimeout(()=>goStep(2),350); return; }
      }
    }
  }catch(err){}
  if(qrCameraActive) setTimeout(scanQrVideo,180);
}
function stopQrCamera(){
  qrCameraActive=false;
  if(qrCameraStream){ qrCameraStream.getTracks().forEach(track=>track.stop()); qrCameraStream=null; }
  const video=document.getElementById('qr-video'); if(video) video.srcObject=null;
  const panel=document.getElementById('qr-camera'); if(panel) panel.classList.remove('open');
}
function captureVisibleQr(){
  const image=captureQrFrame();
  const status=document.getElementById('qr-status');
  if(!image){ status.textContent='Camera frame is not ready yet. Hold the badge steady and try again.'; status.style.color='var(--amber)'; return; }
  document.getElementById('qr-input').value='CAMERA_FRAME_'+Date.now();
  readWorkerQr(); stopQrCamera(); setTimeout(()=>goStep(2),350);
}
function handleQrFile(evt){
  const file=evt.target.files[0]; if(!file) return;
  const status=document.getElementById('qr-status');
  const reader=new FileReader(); reader.onload=async e=>{
    try{
      lastQrImage=e.target.result;
      let rawValue='';
      if('BarcodeDetector' in window){ const detector=new BarcodeDetector({formats:['qr_code']}); const codes=await detector.detect(await createImageBitmap(file)); rawValue=codes[0] ? codes[0].rawValue : ''; }
      else if(typeof jsQR==='function'){
        const img=new Image(); img.onload=function(){ const canvas=document.createElement('canvas'); canvas.width=img.naturalWidth; canvas.height=img.naturalHeight; const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0); const code=jsQR(canvas.width ? ctx.getImageData(0,0,canvas.width,canvas.height).data : [],canvas.width,canvas.height,{inversionAttempts:'attemptBoth'}); if(code){ document.getElementById('qr-input').value=code.data; readWorkerQr(); } else { status.textContent='No QR code found. Try a brighter, closer badge image.'; status.style.color='var(--red)'; } }; img.src=e.target.result; return;
      }
      if(rawValue){ document.getElementById('qr-input').value=rawValue; readWorkerQr(); } else { status.textContent='No QR code found. Try a brighter, closer badge image.'; status.style.color='var(--red)'; }
    }
    catch(err){ status.textContent='QR image could not be read. Enter the worker ID manually.'; status.style.color='var(--amber)'; }
  }; reader.readAsDataURL(file);
}
function closeWizard(){
  stopQrCamera();
  stopStripCamera();
  document.getElementById('wizard').classList.add('hidden');
}
function goStep(n){
  if(n!==2) stopStripCamera();
  [1,2,3].forEach(i=>{
    document.getElementById('wizard-step-'+i).classList.toggle('hidden', i!==n);
    const dot = document.getElementById('dot-'+i);
    dot.classList.toggle('active', i===n);
    dot.classList.toggle('done', i<n);
  });
  if(n===2) setTimeout(startStripCamera,120);
}
async function startStripCamera(){
  const status=document.getElementById('pixel-status');
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ status.textContent='Camera unavailable; use upload image'; return; }
  try{
    stripCameraStream=await openEnvironmentCamera(document.getElementById('strip-video'), APP_CONFIG.CAMERA_CONSTRAINTS);
    
    document.getElementById('strip-camera').classList.add('open'); status.textContent='Strip camera active; center the exposed strip';
    stripAutoActive=true; stripStableSamples=[]; traceStripFrame();
  }catch(err){ status.textContent='Strip camera permission blocked; use upload image'; }
}
function stopStripCamera(){
  stripAutoActive=false; stripStableSamples=[];
  if(stripCameraStream){ stripCameraStream.getTracks().forEach(track=>track.stop()); stripCameraStream=null; }
  const video=document.getElementById('strip-video'); if(video) video.srcObject=null;
  const panel=document.getElementById('strip-camera'); if(panel) panel.classList.remove('open');
}
async function traceStripFrame(){
  if(!stripAutoActive) return;
  const video=document.getElementById('strip-video');
  try{
    if(video.readyState>=2 && video.videoWidth){
      const sampleCanvas=traceStripFrame.canvas || (traceStripFrame.canvas=document.createElement('canvas'));
      const scale=Math.min(1,320/video.videoWidth); sampleCanvas.width=Math.max(1,Math.round(video.videoWidth*scale)); sampleCanvas.height=Math.max(1,Math.round(video.videoHeight*scale));
      const ctx=sampleCanvas.getContext('2d',{willReadFrequently:true}); ctx.drawImage(video,0,0,sampleCanvas.width,sampleCanvas.height);
      const data=ctx.getImageData(Math.round(sampleCanvas.width*.25),Math.round(sampleCanvas.height*.25),Math.max(1,Math.round(sampleCanvas.width*.5)),Math.max(1,Math.round(sampleCanvas.height*.5))).data;
      let r=0,g=0,b=0,n=0; for(let i=0;i<data.length;i+=16){r+=data[i];g+=data[i+1];b+=data[i+2];n++;}
      const current={r:r/n,g:g/n,b:b/n}; const previous=stripStableSamples[stripStableSamples.length-1];
      const delta=previous ? Math.abs(current.r-previous.r)+Math.abs(current.g-previous.g)+Math.abs(current.b-previous.b) : 999;
      if(delta<12) stripStableSamples.push(current); else stripStableSamples=[];
      if(stripStableSamples.length>=5){ captureStripFrame(); return; }
      document.getElementById('pixel-status').textContent='Tracing strip... hold steady '+Math.min(stripStableSamples.length,5)+'/5';
    }
  }catch(err){}
  if(stripAutoActive) setTimeout(traceStripFrame,180);
}
function captureStripFrame(){
  const video=document.getElementById('strip-video');
  if(!video || video.readyState<2 || !video.videoWidth){ document.getElementById('pixel-status').textContent='Camera frame is not ready yet'; return; }
  const canvas=document.createElement('canvas'); canvas.width=video.videoWidth*2; canvas.height=video.videoHeight*2;
  const ctx=canvas.getContext('2d'); ctx.filter='brightness(1.08) contrast(1.16) saturate(1.06)'; ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const dataUrl=canvas.toDataURL('image/jpeg',.9);
  wizardFiles.exp={dataUrl,originalDataUrl:dataUrl,size:dataUrl.length};
  const box=document.getElementById('exp-preview'); box.style.backgroundImage='url('+dataUrl+')'; box.innerHTML=''; box.classList.add('filled');
  document.getElementById('btn-step2-next').disabled=false; document.getElementById('wizard-hint-2').textContent='Enhanced camera frame ready for five-shade comparison';
  stopStripCamera(); applyCorrection();
  setTimeout(analyzeStrips,700);
}
function handleStripFile(evt, which){
  const file = evt.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    wizardFiles.exp = { dataUrl:e.target.result, originalDataUrl:e.target.result, size:file.size };
    const box = document.getElementById('exp-preview');
    box.style.backgroundImage = 'url(' + e.target.result + ')';
    box.innerHTML = '';
    box.classList.add('filled');
    document.getElementById('btn-step2-next').disabled = false;
    document.getElementById('wizard-hint-2').textContent = 'Ready to match against the built-in color guide';
    applyCorrection();
  };
  reader.readAsDataURL(file);
}
function adjustPreview(type,value){
  correction[type]=Number(value); document.getElementById(type+'-value').textContent=value+'%';
  applyCorrection();
}
function applyCorrection(){
  if(!wizardFiles.exp || !wizardFiles.exp.originalDataUrl) return;
  const img=new Image(); img.onload=function(){
    const canvas=document.createElement('canvas'); canvas.width=img.naturalWidth; canvas.height=img.naturalHeight;
    const ctx=canvas.getContext('2d');
    const contrast=correction.contrast/100; const brightness=correction.brightness/100;
    ctx.filter='brightness('+brightness+') contrast('+contrast+')'; ctx.drawImage(img,0,0);
    const crop=document.createElement('canvas'); crop.width=Math.max(1,Math.round(canvas.width*.5)); crop.height=Math.max(1,Math.round(canvas.height*.5));
    const cropCtx=crop.getContext('2d'); cropCtx.drawImage(canvas,canvas.width*.25,canvas.height*.25,canvas.width*.5,canvas.height*.5,0,0,crop.width,crop.height);
    wizardFiles.exp.dataUrl=crop.toDataURL('image/jpeg',.9);
    const box=document.getElementById('exp-preview'); box.style.backgroundImage='url('+wizardFiles.exp.dataUrl+')';
    sampleAverageColor(wizardFiles.exp.dataUrl).then(c=>{ if(c){ document.getElementById('pixel-status').textContent='Center crop corrected'; document.getElementById('pixel-rgb').textContent='RGB '+Math.round(c.r)+' / '+Math.round(c.g)+' / '+Math.round(c.b); } });
  }; img.src=wizardFiles.exp.originalDataUrl;
}

function colorDistance(a,b){
  // Weighted RGB distance; green contributes slightly more to visible strip changes.
  const dr=a.r-b.r, dg=a.g-b.g, db=a.b-b.b;
  return Math.sqrt(0.30*dr*dr + 0.50*dg*dg + 0.20*db*db);
}
function matchFixedReference(color){
  let best = null;
  for(const ref of FIXED_COLOR_REFERENCES){
    const distance = colorDistance(color, ref.rgb);
    if(!best || distance < best.distance) best = {...ref, distance};
  }
  return best;
}

function analyzeStrips(){
  if(analysisStarted || !wizardFiles.exp || verifiedScanSlot!==currentSlotId) return;
  if(readingsForSlot(currentSlotId).filter(r=>r.date===todayStr()).length>=3){ closeWizard(); renderDashboardScanArea(); return; }
  analysisStarted=true;
  goStep(3);
  const analysisStart = Date.now();
  const sensorIp = getSensorIp();
  const sensorPromise = fetchSensorReading(sensorIp, 3000);
  const expColorPromise = sampleAverageColor(wizardFiles.exp.dataUrl);

  Promise.all([sensorPromise, expColorPromise]).then(([sensorReading, expColor])=>{
    const elapsed = Date.now() - analysisStart;
    const remaining = Math.max(0, 900 - elapsed);
    setTimeout(()=>{
      const seed = (wizardFiles.exp ? wizardFiles.exp.size : 100) + Date.now();
      const rnd = mulberry32(seed % 2147483647);

      let ppmh, confidence, colorSource, exposureLabel, exposureRange, match = null;
      if(expColor){
        match = matchFixedReference(expColor);
        ppmh = match.ppmh;
        exposureLabel = match.label;
        exposureRange = match.range;
        const photoNoise = expColor.stdDev;
        const normalizedDistance = Math.min(1, match.distance / 120);
        confidence = 99 - normalizedDistance*20 - Math.min(12, photoNoise*0.18);
        confidence = +clamp(confidence, 60, 99).toFixed(1);
        colorSource = 'fixed-reference-match';
      } else {
        ppmh = +(rnd()*17 + 3).toFixed(1);
        exposureLabel = 'Uncertain';
        exposureRange = 'Image decode fallback';
        confidence = +(rnd()*11 + 80).toFixed(1);
        colorSource = 'fallback';
      }
      const status = statusForExposure(exposureLabel, ppmh);

      let temp, humidity, envSource;
      if(sensorReading){
        temp = sensorReading.temp;
        humidity = sensorReading.humidity;
        envSource = 'live';
      } else {
        temp = +(29 + rnd()*5).toFixed(1);
        humidity = Math.round(55 + rnd()*16);
        envSource = sensorIp ? 'unreachable' : 'simulated';
      }
      setSensorStatusPill(envSource==='live');

      const reading = {
        id: 'r_' + Date.now(),
        slotId: currentSlotId,
        scanStage: ['Before work','Mid-shift','End of shift'][STATE.readings.filter(r=>r.slotId===currentSlotId && r.date===todayStr()).length] || 'Shift check',
        qrValue: document.getElementById('qr-input').value.trim(),
        qrImage: lastQrImage,
        date: todayStr(),
        time: nowHHMM(),
        ppmh, confidence, temp, humidity,
        compensation: 'Applied',
        status, envSource, colorSource,
        exposureLabel, exposureRange,
        extractedRgb: expColor ? {r:Math.round(expColor.r),g:Math.round(expColor.g),b:Math.round(expColor.b)} : null,
        referenceRgb: match ? {r:match.rgb.r, g:match.rgb.g, b:match.rgb.b} : null,
        refImg: null,
        expImg: wizardFiles.exp.dataUrl
      };
      STATE.readings.push(reading);
      const slotReadings = STATE.readings.filter(r=>r.slotId===currentSlotId).sort((a,b)=> (a.date+a.time) < (b.date+b.time) ? 1 : -1);
      slotReadings.slice(3).forEach(r=>{ r.refImg=null; r.expImg=null; });
      saveState(STATE);

      closeWizard();
      renderDashboardScanArea();
    }, remaining);
  });
}

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

// Reads a strip photo (data URL), crops to the center ~50% of the frame
// (to reduce background/table influence) and returns the average RGB plus
// a rough noise/variance figure used to temper the confidence score.
function sampleAverageColor(dataUrl){
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = function(){
      try{
        const size = 48;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        const cropFrac = 1;
        const sx = img.naturalWidth * (1 - cropFrac) / 2;
        const sy = img.naturalHeight * (1 - cropFrac) / 2;
        const sw = img.naturalWidth * cropFrac;
        const sh = img.naturalHeight * cropFrac;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;
        let rSum=0,gSum=0,bSum=0,rSq=0,gSq=0,bSq=0,n=0;
        for(let i=0;i<data.length;i+=4){
          const r=data[i], g=data[i+1], b=data[i+2];
          rSum+=r; gSum+=g; bSum+=b;
          rSq+=r*r; gSq+=g*g; bSq+=b*b;
          n++;
        }
        const r=rSum/n, g=gSum/n, b=bSum/n;
        const variance = (rSq/n - r*r) + (gSq/n - g*g) + (bSq/n - b*b);
        const stdDev = Math.sqrt(Math.max(0, variance/3));
        resolve({ r, g, b, stdDev });
      }catch(e){
        resolve(null); // e.g. canvas security error on an unusual source
      }
    };
    img.onerror = function(){ resolve(null); };
    img.src = dataUrl;
  });
}

// tiny deterministic PRNG so results feel stable per-scan
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

/* =========================================================================
   SUPERVISOR APP
   ========================================================================= */
function recordSupervisorSample(ppm, timestamp, recordKey){
  const value = Number(ppm);
  if(!Number.isFinite(value)) return;
  if(recordKey && recordKey===supervisorLastRecordKey) return;
  if(recordKey) supervisorLastRecordKey = recordKey;
  const time = timestamp || Date.now();
  STATE.slots.filter(slot=>slot.registered).forEach(slot=>{
    const samples = supervisorSamples[slot.id] || (supervisorSamples[slot.id]=[]);
    samples.push({ ppm:value, time, ...supervisorFlowRecord });
    supervisorSamples[slot.id] = samples.filter(sample=>time-sample.time<=3600000).slice(-3601);
  });
}
function supervisorSampleTotals(slotId){
  const samples = supervisorSamples[slotId] || [];
  const now = Date.now();
  const recent = samples.filter(sample=>now-sample.time<=600000);
  const hour = samples.filter(sample=>now-sample.time<=3600000);
  const shortSum = recent.reduce((sum,sample)=>sum+sample.ppm,0);
  const hourSum = hour.reduce((sum,sample)=>sum+sample.ppm,0);
  return { samples, recent, shortSum, hourSum, ppmMin:shortSum/60, ppmHr:hourSum/3600 };
}
function supervisorTime(timestamp){
  return timestamp ? new Date(timestamp).toLocaleString() : 'No samples yet';
}
function supervisorHistoryRows(samples){
  return samples.slice(-60).reverse().map(sample=>'<tr><td>'+supervisorTime(sample.time)+'</td><td class="ppm">'+sample.ppm.toFixed(3)+'</td><td>'+escapeHtml(String(sample.adc ?? '--'))+'</td><td>'+escapeHtml(String(sample.temp ?? '--'))+'</td><td>'+escapeHtml(String(sample.humidity ?? '--'))+'</td><td>'+escapeHtml(String(sample.status ?? '--'))+'</td></tr>').join('');
}
function refreshSupervisorHistoryTable(slotId){
  const card = document.querySelector('.slot-card[data-slot-id="'+slotId+'"]');
  if(!card) return;
  const table = card.querySelector('.history-table');
  const exposure = supervisorSampleTotals(slotId);
  const latestSample = exposure.samples[exposure.samples.length-1];
  const shortValue = card.querySelector('.supervisor-short-value');
  const hourValue = card.querySelector('.supervisor-hour-value');
  if(shortValue) shortValue.textContent = exposure.ppmMin.toFixed(3)+' ppm-min';
  if(hourValue) hourValue.textContent = exposure.ppmHr.toFixed(3)+' ppm-hr';
  const shortMeta = card.querySelector('.supervisor-short-meta');
  const hourMeta = card.querySelector('.supervisor-hour-meta');
  if(shortMeta) shortMeta.textContent = exposure.shortSum.toFixed(3)+' ppm-sec · '+exposure.recent.length+' real samples · '+supervisorTime(exposure.recent[0] && exposure.recent[0].time)+' to '+supervisorTime(latestSample && latestSample.time);
  if(hourMeta) hourMeta.textContent = exposure.hourSum.toFixed(3)+' ppm-sec · '+exposure.samples.length+' real samples · through '+supervisorTime(latestSample && latestSample.time);
  if(!table) return;
  table.querySelector('tbody').innerHTML = supervisorHistoryRows(exposure.samples);
  const meta = card.querySelector('.history-table-meta');
  if(meta) meta.textContent = 'Showing latest '+Math.min(60,exposure.samples.length)+' of '+exposure.samples.length+' records · refreshed every second';
  const latest = card.querySelector('.history-latest');
  if(latest) latest.textContent = latestSample ? 'Latest record: '+supervisorTime(latestSample.time) : 'Waiting for live flow PPM samples.';
}
function renderSupervisorApp(){
  STATE = loadState(); // pull latest cross-tab data
  const slots = STATE.slots;
  const registeredCount = slots.filter(s=>s.registered).length;
  const todaysReadings = STATE.readings.filter(r=>r.date===todayStr());
  const warnCount = todaysReadings.filter(r=>isAlertStatus(r.status)).length;
  const compliance = todaysReadings.length ? Math.round(((todaysReadings.length-warnCount)/todaysReadings.length)*100) : 100;

  document.getElementById('sup-registered').textContent = registeredCount+'/5';
  document.getElementById('sup-warnings').textContent = warnCount;
  document.getElementById('sup-compliance').textContent = compliance+'%';

  document.getElementById('sup-slots').innerHTML = slots.map(slot=>{
    const todayForSlot = STATE.readings.filter(r=>r.slotId===slot.id && r.date===todayStr());
    const cumulative = todayForSlot.reduce((s,r)=>s+r.ppmh,0);
    const hasWarning = todayForSlot.some(r=>isAlertStatus(r.status));
    const lastReading = todayForSlot[todayForSlot.length-1];
    const exposure = supervisorSampleTotals(slot.id);
    const latestSample = exposure.samples[exposure.samples.length-1];

    let statusHtml;
    if(!slot.registered){
      statusHtml = '<div class="num none">Open Slot</div>';
    } else if(todayForSlot.length===0){
      statusHtml = '<div class="num none">No scans today</div>';
    } else {
      statusHtml = `<div class="num ${hasWarning?'warn':'safe'}">${cumulative.toFixed(1)} ppm&middot;h</div><div style="font-size:10px;color:var(--text-faint);">last ${lastReading.time}</div>`;
    }
    const historyButton = slot.registered ? `<button class="watch-history" data-history-slot="${slot.id}">&#128065; ${supervisorHistorySlot===slot.id ? 'Hide' : 'Watch'} History</button>` : '';

    const recentRows = slot.registered ? STATE.readings.filter(r=>r.slotId===slot.id).slice().sort((a,b)=> (a.date+a.time) < (b.date+b.time) ? 1 : -1).slice(0,5) : [];

    return `
      <div class="slot-card ${slot.registered?'':'open'}" data-slot-id="${slot.id}" onclick="toggleSlot('${slot.id}')">
        <div class="slot-top">
          <div class="slot-id-row">
            <div class="slot-badge">${slot.id}</div>
            <div>
              <div class="slot-name">${slot.registered ? slot.name : 'Not Registered'}</div>
              <div class="slot-dept">${slot.dept} &middot; ${slot.shift}</div>
            </div>
          </div>
          <div class="slot-status">${statusHtml}${historyButton}</div>
        </div>
        <div class="slot-detail ${expandedSlot===slot.id ? 'open2' : ''}">
          ${slot.registered ? `<div class="mini-grid" style="margin-bottom:10px;">
            <div class="mini-card exposure-card"><div class="lbl">Short-time exposure · 10 min</div><div class="val supervisor-short-value">${exposure.ppmMin.toFixed(3)}<span> ppm-min</span></div><div class="meta supervisor-short-meta">${exposure.shortSum.toFixed(3)} ppm-sec · ${exposure.recent.length} real samples · ${supervisorTime(exposure.recent[0] && exposure.recent[0].time)} to ${supervisorTime(latestSample && latestSample.time)}</div></div>
            <div class="mini-card exposure-card"><div class="lbl">Cumulative exposure · 1 hour</div><div class="val supervisor-hour-value">${exposure.ppmHr.toFixed(3)}<span> ppm-hr</span></div><div class="meta supervisor-hour-meta">${exposure.hourSum.toFixed(3)} ppm-sec · ${exposure.samples.length} real samples · through ${supervisorTime(latestSample && latestSample.time)}</div></div>
          </div>
          ${supervisorHistorySlot===slot.id ? `<div class="card" style="margin-top:10px;padding:12px;"><div class="card-label">FLOW HISTORY · EVERY SECOND</div>${exposure.samples.length ? '<div class="history-table-wrap"><table class="history-table"><thead><tr><th>Recorded at</th><th>Flow PPM</th><th>ADC</th><th>Temp °C</th><th>Humidity %</th><th>Status</th></tr></thead><tbody>'+supervisorHistoryRows(exposure.samples)+'</tbody></table></div><div class="meta history-table-meta" style="margin-top:8px;">Showing latest '+Math.min(60,exposure.samples.length)+' of '+exposure.samples.length+' records · refreshed every second</div><div class="meta history-latest" style="margin-top:4px;">Latest record: '+supervisorTime(latestSample && latestSample.time)+'</div>' : '<div class="empty-state history-latest" style="padding:8px;">Waiting for live flow PPM samples.</div>'}</div>` : ''}
          ${recentRows.length ? recentRows.map(r=>`
            <div class="reading-row">
              <div><div class="time">${r.time}</div><div class="date">${fmtDate(r.date)}</div></div>
              <div class="right">
                <span class="ppm ${statusTone(r.status)}">${r.ppmh.toFixed(1)} ppm&middot;h</span>
                <span class="badge-sm ${statusTone(r.status)}">${statusText(r.status, r.exposureLabel)}</span>
              </div>
            </div>`).join('') : '<div class="empty-state" style="padding:8px;">No readings logged yet.</div>'}`
            : '<div class="empty-state" style="padding:8px;">This hardware slot has not been claimed by a worker yet.</div>'}
        </div>
      </div>`;
  }).join('');
}
function toggleSupervisorHistory(id){
  supervisorHistorySlot = supervisorHistorySlot===id ? null : id;
  expandedSlot = id;
  renderSupervisorApp();
}
function toggleSlot(id){
  expandedSlot = (expandedSlot===id) ? null : id;
  renderSupervisorApp();
}

function bindSupervisorHistory(){
  const slots = document.getElementById('sup-slots');
  if(!slots) return;
  slots.addEventListener('click', function(event){
    const button = event.target.closest('[data-history-slot]');
    if(!button) return;
    event.stopPropagation();
    toggleSupervisorHistory(button.dataset.historySlot);
  });
}

// live cross-tab sync
window.addEventListener('storage', (e)=>{
  if(e.key===STORE_KEY){
    STATE = loadState();
    const s = getSession();
    if(s && s.role==='supervisor') renderSupervisorApp();
    if(s && s.role==='worker') renderDashboardScanArea();
  }
});
// Keep the supervisor view and each person's rolling history current once per second.
setInterval(()=>{
  const s = getSession();
  if(s && s.role==='supervisor' && !document.getElementById('screen-supervisor-app').classList.contains('hidden')){
    STATE.slots.filter(slot=>slot.registered).forEach(slot=>refreshSupervisorHistoryTable(slot.id));
  }
}, 1000);

/* =========================================================================
   DOM INITIALIZATION / HTML HANDLER BRIDGE
   ========================================================================= */
window.addEventListener('DOMContentLoaded', () => {
  bindSupervisorHistory();
  boot();
});

/* Explicitly expose handlers used by index.html inline controls. */
Object.assign(window, {
  analyzeStrips, captureStripFrame, captureVisibleQr, closeWizard, generatePdfReport,
  goStep, goTo, loginSupervisor, loginWorker, logout, openWizard,
  readWorkerQr, registerWorker, renderSupervisorApp, resetTodaysScans,
  saveSensorIp, setReportPeriod, setWorkerTab, setWorkerView,
  shareReport, startQrCamera, startStripCamera, stopQrCamera, stopStripCamera
});
