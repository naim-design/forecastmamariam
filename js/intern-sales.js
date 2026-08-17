let currentUser=null;
let currentProfile=null;
let selectedMonth='';
let allSales=[];
let monthSales=[];
let currentTarget={whatsapp:0,shopee:0,mamayuyu:0,solusi:0,total:0};
let editingId=null;
let trendChart=null;
let mixChart=null;

const money=(n,dec=0)=>new Intl.NumberFormat('ms-MY',{style:'currency',currency:'MYR',minimumFractionDigits:dec,maximumFractionDigits:dec}).format(Number(n)||0).replace('MYR','RM');
const num=n=>Number(n)||0;
const pct=(a,b)=>b>0?(a/b*100):0;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const monthLabel=(key)=>{if(!key)return'';const [y,m]=key.split('-').map(Number);return new Intl.DateTimeFormat('ms-MY',{month:'long',year:'numeric'}).format(new Date(y,m-1,1));};
const daysInMonth=(key)=>{const [y,m]=key.split('-').map(Number);return new Date(y,m,0).getDate();};
const todayISO=()=>new Date().toLocaleDateString('en-CA');
const currentMonthKey=()=>todayISO().slice(0,7);
const sourceLabel=e=>e.channel==='whatsapp'?'WhatsApp':`Live · ${platformLabel(e.platform)}`;
const platformLabel=p=>({shopee:'Shopee',mamayuyu:'Mamayuyu',solusi:'TikTok Solusi'}[p]||'—');
const entryMonth=e=>e.monthKey||(e.date||'').slice(0,7);

function toast(message,type='ok'){
  const el=document.getElementById('toast');el.textContent=message;el.className=`toast show ${type}`;clearTimeout(toast.t);toast.t=setTimeout(()=>el.className='toast',2800);
}
function setThemeIcon(){const light=document.documentElement.getAttribute('data-theme')==='light';document.getElementById('theme-toggle').textContent=light?'☀️':'🌙';}
function toggleTheme(){const light=document.documentElement.getAttribute('data-theme')==='light';if(light){document.documentElement.removeAttribute('data-theme');localStorage.setItem('internTheme','dark');}else{document.documentElement.setAttribute('data-theme','light');localStorage.setItem('internTheme','light');}setThemeIcon();renderCharts();}

const viewCopy={
  dashboard:['Dashboard Sales Intern','Prestasi sales bulan dipilih berbanding target.'],
  input:['Input Sales Harian','Rekod sales daripada Live atau WhatsApp.'],
  target:['Target Bulanan','Tetapkan target setiap channel untuk bulan dipilih.'],
  report:['Laporan Sales','Semak semua transaksi dan prestasi bulanan.']
};
function switchView(name){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  const copy=viewCopy[name]||viewCopy.dashboard;document.getElementById('page-title').textContent=copy[0];document.getElementById('page-subtitle').textContent=copy[1];
  window.scrollTo({top:0,behavior:'smooth'});
}

document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.go)));
document.getElementById('theme-toggle').addEventListener('click',toggleTheme);setThemeIcon();
document.getElementById('logout-btn').addEventListener('click',()=>auth.signOut());

auth.onAuthStateChanged(async user=>{
  if(!user){location.href='index.html';return;}
  currentUser=user;
  await loadProfile();
  selectedMonth=currentMonthKey();
  document.getElementById('global-month').value=selectedMonth;
  document.getElementById('sale-date').value=todayISO();
  document.getElementById('app-shell').hidden=false;
  document.getElementById('loading-screen').style.display='none';
  await refreshAll();
});

async function loadProfile(){
  try{const snap=await db.collection('users').doc(currentUser.uid).get();currentProfile=snap.exists?snap.data():null;}catch(e){currentProfile=null;}
  const fallback=(currentUser.email||'Intern').split('@')[0].replace(/[._-]+/g,' ');
  const name=(currentProfile&&currentProfile.name)||fallback;
  document.getElementById('user-name').textContent=name;
  document.getElementById('user-email').textContent=currentUser.email||'—';
  document.getElementById('user-avatar').textContent=name.trim().charAt(0).toUpperCase()||'I';
}

document.getElementById('global-month').addEventListener('change',async e=>{selectedMonth=e.target.value||currentMonthKey();await refreshAll();});

async function refreshAll(){
  await Promise.all([loadSales(),loadTarget()]);
  renderEverything();
}

async function loadSales(){
  try{
    const snap=await db.collection('entries').where('kind','==','intern_sales').get();
    allSales=snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>e.staffUid===currentUser.uid);
  }catch(err){console.error(err);toast('Tak dapat baca data sales. Semak Firestore Rules.','error');allSales=[];}
  monthSales=allSales.filter(e=>entryMonth(e)===selectedMonth).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||((b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
}

function targetDocId(){return `intern_target_${currentUser.uid}_${selectedMonth}`;}
async function loadTarget(){
  try{
    const snap=await db.collection('meta').doc(targetDocId()).get();
    const d=snap.exists?snap.data():{};
    currentTarget={whatsapp:num(d.whatsapp),shopee:num(d.shopee),mamayuyu:num(d.mamayuyu),solusi:num(d.solusi)};
    currentTarget.total=currentTarget.whatsapp+currentTarget.shopee+currentTarget.mamayuyu+currentTarget.solusi;
  }catch(err){console.error(err);currentTarget={whatsapp:0,shopee:0,mamayuyu:0,solusi:0,total:0};}
  document.getElementById('target-whatsapp').value=currentTarget.whatsapp||0;
  document.getElementById('target-shopee').value=currentTarget.shopee||0;
  document.getElementById('target-mamayuyu').value=currentTarget.mamayuyu||0;
  document.getElementById('target-solusi').value=currentTarget.solusi||0;
  updateTargetPreview();
}

function stats(){
  const s={total:0,live:0,whatsapp:0,shopee:0,mamayuyu:0,solusi:0,leads:0,buyers:0};
  monthSales.forEach(e=>{const v=num(e.sales);s.total+=v;if(e.channel==='whatsapp'){s.whatsapp+=v;s.leads+=num(e.leads);s.buyers+=num(e.buyers);}else{s.live+=v;if(e.platform in s)s[e.platform]+=v;}});
  return s;
}

function elapsedInfo(){
  const totalDays=daysInMonth(selectedMonth);const nowKey=currentMonthKey();let elapsed=totalDays;
  if(selectedMonth===nowKey)elapsed=Math.min(new Date().getDate(),totalDays);
  if(selectedMonth>nowKey)elapsed=0;
  const remaining=selectedMonth<nowKey?0:selectedMonth===nowKey?Math.max(1,totalDays-elapsed+1):totalDays;
  return{totalDays,elapsed,remaining};
}

function renderEverything(){
  renderDashboard();renderInputTable();renderTarget();renderReport();renderCharts();
}

function renderDashboard(){
  const s=stats();const t=currentTarget;const ach=pct(s.total,t.total);const {totalDays,elapsed,remaining}=elapsedInfo();
  const expected=totalDays? t.total*(elapsed/totalDays):0;const gap=Math.max(0,t.total-s.total);const dailyNeed=remaining?gap/remaining:gap;const avg=elapsed?s.total/elapsed:0;const forecast=elapsed?s.total/elapsed*totalDays:0;const paceDiff=s.total-expected;
  document.getElementById('dash-total-sales').textContent=money(s.total);
  document.getElementById('dash-total-target').textContent=money(t.total);
  document.getElementById('overall-progress-bar').style.width=`${clamp(ach,0,100)}%`;
  document.getElementById('overall-progress-text').textContent=`${ach.toFixed(1)}% dicapai`;
  document.getElementById('overall-gap-text').textContent=t.total?`Baki ${money(gap)}`:'Set target dahulu';
  document.getElementById('dash-live-sales').textContent=money(s.live);
  document.getElementById('dash-live-share').textContent=`${s.total?pct(s.live,s.total).toFixed(1):0}% daripada total`;
  document.getElementById('dash-ws-sales').textContent=money(s.whatsapp);
  document.getElementById('dash-ws-meta').textContent=`${s.buyers} buyer · ${s.leads} leads`;
  document.getElementById('dash-forecast').textContent=money(forecast);
  document.getElementById('dash-forecast-gap').textContent=t.total?(forecast>=t.total?`Forecast lebih ${money(forecast-t.total)}`:`Forecast kurang ${money(t.total-forecast)}`):'Tetapkan target untuk bandingan';
  document.getElementById('expected-to-date').textContent=money(expected);
  document.getElementById('expected-meta').textContent=elapsed?`Hari ${elapsed} daripada ${totalDays}`:'Bulan belum bermula';
  document.getElementById('daily-needed').textContent=money(dailyNeed);
  document.getElementById('daily-needed-meta').textContent=t.total?`${remaining} hari masih tersedia`:'Belum ada target';
  document.getElementById('daily-average').textContent=money(avg);
  document.getElementById('daily-average-meta').textContent=elapsed?`Purata ${elapsed} hari berlalu`:'Belum ada data';
  const paceEl=document.getElementById('pace-difference');paceEl.textContent=`${paceDiff>=0?'+':''}${money(paceDiff)}`;paceEl.classList.toggle('negative',paceDiff<0);
  document.getElementById('pace-difference-meta').textContent=t.total?(paceDiff>=0?'Mendahului pace target':'Di belakang pace target'):'Belum ada target';
  const chip=document.getElementById('pace-chip');
  if(!t.total){chip.textContent='Belum ada target';chip.className='status-chip';}
  else if(s.total>=t.total){chip.textContent='Target tercapai';chip.className='status-chip success';}
  else if(paceDiff>=0){chip.textContent='On track';chip.className='status-chip success';}
  else{chip.textContent='Perlu push';chip.className='status-chip warning';}
  renderChannel('shopee',s.shopee,t.shopee);renderChannel('mamayuyu',s.mamayuyu,t.mamayuyu);renderChannel('solusi',s.solusi,t.solusi);renderChannel('whatsapp',s.whatsapp,t.whatsapp);
  renderRecent();
}
function renderChannel(key,actual,target){const p=pct(actual,target);document.getElementById(`${key}-sales`).textContent=money(actual);document.getElementById(`${key}-bar`).style.width=`${clamp(p,0,100)}%`;document.getElementById(`${key}-pct`).textContent=target?`${p.toFixed(1)}%`:'0%';document.getElementById(`${key}-target`).textContent=`Target ${money(target)}`;}
function renderRecent(){
  const el=document.getElementById('recent-sales-list');const rows=monthSales.slice(0,6);
  if(!rows.length){el.innerHTML='<div class="empty-state">Belum ada sales untuk bulan ini.</div>';return;}
  el.innerHTML=rows.map(e=>`<div class="recent-row"><div class="recent-icon ${e.channel}">${e.channel==='whatsapp'?'W':'L'}</div><div class="recent-copy"><b>${sourceLabel(e)}</b><span>${formatDate(e.date)}${e.note?` · ${escapeHtml(e.note)}`:''}</span></div><strong>${money(e.sales,2)}</strong></div>`).join('');
}

function formatDate(v){if(!v)return'—';const [y,m,d]=v.split('-').map(Number);return new Intl.DateTimeFormat('ms-MY',{day:'numeric',month:'short',year:'numeric'}).format(new Date(y,m-1,d));}
function escapeHtml(s){return String(s||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function renderInputTable(){
  const body=document.getElementById('input-sales-body');document.getElementById('input-entry-count').textContent=`${monthSales.length} entri`;
  if(!monthSales.length){body.innerHTML='<tr><td colspan="6" class="empty-cell">Belum ada entri sales.</td></tr>';return;}
  body.innerHTML=monthSales.map(e=>`<tr><td>${formatDate(e.date)}</td><td><span class="table-tag ${e.channel}">${e.channel==='whatsapp'?'WhatsApp':'Live'}</span></td><td>${e.channel==='live'?platformLabel(e.platform):`${num(e.leads)} leads`}</td><td class="money-cell">${money(e.sales,2)}</td><td>${e.channel==='whatsapp'?num(e.buyers):'—'}</td><td><div class="row-actions"><button data-edit="${e.id}">Edit</button><button class="danger" data-delete="${e.id}">Padam</button></div></td></tr>`).join('');
  body.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>startEdit(b.dataset.edit)));
  body.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteEntry(b.dataset.delete)));
}

function renderTarget(){updateTargetPreview();const s=stats();const t=currentTarget;const checkpoints=[{label:'25% bulan',ratio:.25},{label:'50% bulan',ratio:.5},{label:'75% bulan',ratio:.75},{label:'100% bulan',ratio:1}];
  document.getElementById('milestone-grid').innerHTML=checkpoints.map(c=>{const target=t.total*c.ratio;const ok=s.total>=target;return `<div class="milestone ${ok?'done':''}"><span>${c.label}</span><b>${money(target)}</b><small>${ok?'Dah lepas checkpoint':`Baki ${money(Math.max(0,target-s.total))}`}</small></div>`;}).join('');
}
function readTargetInputs(){return{whatsapp:num(document.getElementById('target-whatsapp').value),shopee:num(document.getElementById('target-shopee').value),mamayuyu:num(document.getElementById('target-mamayuyu').value),solusi:num(document.getElementById('target-solusi').value)};}
function updateTargetPreview(){const t=readTargetInputs();const live=t.shopee+t.mamayuyu+t.solusi;const total=live+t.whatsapp;const daily=total/daysInMonth(selectedMonth||currentMonthKey());document.getElementById('target-total-preview').textContent=money(total);document.getElementById('target-live-preview').textContent=money(live);document.getElementById('target-ws-preview').textContent=money(t.whatsapp);document.getElementById('target-grand-preview').textContent=money(total);document.getElementById('target-daily-preview').textContent=money(daily);}
['target-whatsapp','target-shopee','target-mamayuyu','target-solusi'].forEach(id=>document.getElementById(id).addEventListener('input',updateTargetPreview));
document.getElementById('target-form').addEventListener('submit',async e=>{e.preventDefault();const t=readTargetInputs();const total=t.whatsapp+t.shopee+t.mamayuyu+t.solusi;try{await db.collection('meta').doc(targetDocId()).set({kind:'intern_target',staffUid:currentUser.uid,monthKey:selectedMonth,...t,total,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});currentTarget={...t,total};toast(`Target ${monthLabel(selectedMonth)} disimpan.`);renderEverything();}catch(err){console.error(err);toast('Gagal simpan target.','error');}});

function toggleSourceFields(){const source=document.getElementById('sale-source').value;document.getElementById('live-fields').hidden=source!=='live';document.getElementById('whatsapp-fields').hidden=source!=='whatsapp';updateInputPreview();}
document.getElementById('sale-source').addEventListener('change',toggleSourceFields);
['sale-date','sale-platform','sale-live-hours','sale-leads','sale-buyers','sale-amount'].forEach(id=>document.getElementById(id).addEventListener('input',updateInputPreview));
function updateInputPreview(){const source=document.getElementById('sale-source').value;const amount=num(document.getElementById('sale-amount').value);document.getElementById('preview-amount').textContent=money(amount,2);document.getElementById('preview-source').textContent=source==='live'?`Live · ${platformLabel(document.getElementById('sale-platform').value)}`:'WhatsApp';document.getElementById('preview-date').textContent=formatDate(document.getElementById('sale-date').value);document.getElementById('preview-detail').textContent=source==='live'?`${num(document.getElementById('sale-live-hours').value)} jam`:`${num(document.getElementById('sale-leads').value)} leads · ${num(document.getElementById('sale-buyers').value)} buyer`;}
updateInputPreview();

document.getElementById('sales-form').addEventListener('submit',async e=>{
  e.preventDefault();const btn=document.getElementById('sales-submit');btn.disabled=true;btn.textContent=editingId?'Menyimpan...':'Menyimpan...';
  const date=document.getElementById('sale-date').value;const channel=document.getElementById('sale-source').value;
  const data={kind:'intern_sales',staffUid:currentUser.uid,staffEmail:currentUser.email||'',staffName:(currentProfile&&currentProfile.name)||'',date,monthKey:date.slice(0,7),channel,platform:channel==='live'?document.getElementById('sale-platform').value:'',sales:num(document.getElementById('sale-amount').value),liveHours:channel==='live'?num(document.getElementById('sale-live-hours').value):0,leads:channel==='whatsapp'?num(document.getElementById('sale-leads').value):0,buyers:channel==='whatsapp'?num(document.getElementById('sale-buyers').value):0,note:document.getElementById('sale-note').value.trim(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
  try{
    if(editingId){await db.collection('entries').doc(editingId).set(data,{merge:true});toast('Sales berjaya dikemas kini.');}
    else{data.createdAt=firebase.firestore.FieldValue.serverTimestamp();await db.collection('entries').add(data);toast('Sales berjaya disimpan.');}
    selectedMonth=date.slice(0,7);document.getElementById('global-month').value=selectedMonth;resetForm();await refreshAll();
  }catch(err){console.error(err);toast('Gagal simpan sales. Semak Firestore Rules.','error');}
  finally{btn.disabled=false;btn.textContent='Simpan Sales';}
});
function startEdit(id){const e=monthSales.find(x=>x.id===id);if(!e)return;editingId=id;switchView('input');document.getElementById('sales-form-title').textContent='Edit Rekod Sales';document.getElementById('sale-date').value=e.date||todayISO();document.getElementById('sale-source').value=e.channel||'live';document.getElementById('sale-platform').value=e.platform||'shopee';document.getElementById('sale-live-hours').value=num(e.liveHours);document.getElementById('sale-leads').value=num(e.leads);document.getElementById('sale-buyers').value=num(e.buyers);document.getElementById('sale-amount').value=num(e.sales);document.getElementById('sale-note').value=e.note||'';document.getElementById('cancel-edit').hidden=false;toggleSourceFields();updateInputPreview();}
function resetForm(){editingId=null;document.getElementById('sales-form').reset();document.getElementById('sales-form-title').textContent='Rekod Sales Baru';document.getElementById('sale-date').value=todayISO();document.getElementById('sale-source').value='live';document.getElementById('sale-platform').value='shopee';document.getElementById('sale-leads').value=0;document.getElementById('sale-buyers').value=0;document.getElementById('cancel-edit').hidden=true;toggleSourceFields();updateInputPreview();}
document.getElementById('cancel-edit').addEventListener('click',resetForm);
async function deleteEntry(id){if(!confirm('Padam rekod sales ini?'))return;try{await db.collection('entries').doc(id).delete();toast('Rekod dipadam.');await refreshAll();}catch(err){console.error(err);toast('Gagal padam rekod.','error');}}

function renderReport(){const s=stats();document.getElementById('report-total').textContent=money(s.total);document.getElementById('report-live').textContent=money(s.live);document.getElementById('report-ws').textContent=money(s.whatsapp);document.getElementById('report-achievement').textContent=`${pct(s.total,currentTarget.total).toFixed(1)}%`;const body=document.getElementById('report-sales-body');if(!monthSales.length){body.innerHTML='<tr><td colspan="8" class="empty-cell">Belum ada data untuk bulan ini.</td></tr>';return;}body.innerHTML=monthSales.map(e=>`<tr><td>${formatDate(e.date)}</td><td>${e.channel==='whatsapp'?'WhatsApp':'Live'}</td><td>${e.channel==='live'?platformLabel(e.platform):'—'}</td><td class="money-cell">${money(e.sales,2)}</td><td>${e.channel==='whatsapp'?num(e.leads):'—'}</td><td>${e.channel==='whatsapp'?num(e.buyers):'—'}</td><td>${e.channel==='live'?`${num(e.liveHours)} jam`:'—'}</td><td>${escapeHtml(e.note||'—')}</td></tr>`).join('');}

document.getElementById('export-csv').addEventListener('click',()=>{const rows=[['Tarikh','Jenis','Platform','Sales (RM)','Leads','Buyer','Masa Live (jam)','Nota'],...monthSales.map(e=>[e.date,e.channel==='whatsapp'?'WhatsApp':'Live',e.channel==='live'?platformLabel(e.platform):'',num(e.sales),num(e.leads),num(e.buyers),num(e.liveHours),e.note||''])];const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`sales-intern-${selectedMonth}.csv`;a.click();URL.revokeObjectURL(a.href);});

function renderCharts(){if(typeof Chart==='undefined')return;const s=stats();const d=daysInMonth(selectedMonth);const byDay={};monthSales.forEach(e=>{const day=Number((e.date||'').slice(8,10));if(day)byDay[day]=(byDay[day]||0)+num(e.sales);});let cum=0;const labels=[],actual=[],target=[];for(let i=1;i<=d;i++){labels.push(String(i));cum+=byDay[i]||0;actual.push(cum);target.push(currentTarget.total*(i/d));}
  const css=getComputedStyle(document.documentElement);const text=css.getPropertyValue('--text').trim()||'#eee';const muted=css.getPropertyValue('--muted').trim()||'#888';const grid=css.getPropertyValue('--line').trim()||'#222';
  const trendCtx=document.getElementById('trend-chart');if(trendChart)trendChart.destroy();trendChart=new Chart(trendCtx,{type:'line',data:{labels,datasets:[{label:'Sales Cumulative',data:actual,borderColor:'#ff4d5d',backgroundColor:'rgba(255,77,93,.12)',fill:true,tension:.3,borderWidth:2.5,pointRadius:1.5},{label:'Target Pace',data:target,borderColor:'#7d8b9e',borderDash:[6,6],tension:.2,borderWidth:2,pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:text,usePointStyle:true,boxWidth:8}}},scales:{x:{grid:{display:false},ticks:{color:muted,maxTicksLimit:10}},y:{grid:{color:grid},ticks:{color:muted,callback:v=>'RM'+Number(v).toLocaleString('en-MY')}}}}});
  const mixCtx=document.getElementById('mix-chart');if(mixChart)mixChart.destroy();mixChart=new Chart(mixCtx,{type:'doughnut',data:{labels:['Shopee','Mamayuyu','TikTok Solusi','WhatsApp'],datasets:[{data:[s.shopee,s.mamayuyu,s.solusi,s.whatsapp],backgroundColor:['#ff4d5d','#ff9d55','#7c8cff','#2bc48a'],borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:{legend:{position:'bottom',labels:{color:text,usePointStyle:true,padding:18,boxWidth:8}}}}});
}
