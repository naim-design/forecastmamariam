
(() => {
  const H = window.NAIM_HISTORICAL_DATA || [];
  const ENTRY_KEY = "naim_sales_entries_v1";
  const TARGET_KEY = "naim_sales_targets_v1";
  const THEME_KEY = "naim_sales_theme_v1";

  const monthNames = ["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];
  const money = n => "RM " + Number(n || 0).toLocaleString("en-MY",{minimumFractionDigits:0,maximumFractionDigits:2});
  const pct = n => Number(n || 0).toLocaleString("en-MY",{minimumFractionDigits:0,maximumFractionDigits:1}) + "%";
  const num = n => Number(n || 0).toLocaleString("en-MY",{maximumFractionDigits:2});
  const byId = id => document.getElementById(id);
  const monthLabel = key => { const [y,m]=key.split("-").map(Number); return `${monthNames[m-1]} ${y}`; };
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;

  let entries = safeParse(localStorage.getItem(ENTRY_KEY), []);
  let targets = safeParse(localStorage.getItem(TARGET_KEY), {});
  let selectedMonth = currentMonth;

  function safeParse(v, fallback){ try{return JSON.parse(v) ?? fallback}catch(e){return fallback} }
  function save(){ localStorage.setItem(ENTRY_KEY, JSON.stringify(entries)); localStorage.setItem(TARGET_KEY, JSON.stringify(targets)); }
  function toast(msg){ const el=byId("toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2200); }

  function histMonth(key){ return H.find(x => x.month === key) || null; }
  function localForMonth(key){ return entries.filter(e => e.date.slice(0,7) === key); }
  function historicalTarget(key){ return histMonth(key)?.target || 0; }
  function effectiveTarget(key){ return Object.prototype.hasOwnProperty.call(targets,key) ? Number(targets[key]||0) : historicalTarget(key); }

  function monthData(key){
    const h=histMonth(key);
    const local=localForMonth(key);
    const localSales=local.reduce((a,b)=>a+Number(b.sales||0),0);
    const localLeads=local.reduce((a,b)=>a+Number(b.leads||0),0);
    const localBuyer=local.reduce((a,b)=>a+Number(b.buyer||0),0);
    const sales=(h?.sales||0)+localSales;
    const leads=(h?.leads||0)+localLeads;
    const buyer=(h?.buyer||0)+localBuyer;
    const target=effectiveTarget(key);
    const conversion=leads ? buyer/leads*100 : 0;
    return {h,local,sales,leads,buyer,target,conversion};
  }

  function daysInMonth(key){ const [y,m]=key.split("-").map(Number); return new Date(y,m,0).getDate(); }
  function elapsedDays(key){
    const [y,m]=key.split("-").map(Number);
    const end=daysInMonth(key);
    if(key < currentMonth) return end;
    if(key > currentMonth) return 0;
    return Math.min(today.getDate(),end);
  }

  function dailySeries(key){
    const data=monthData(key);
    const days=daysInMonth(key);
    const localByDay={};
    data.local.forEach(e=>{
      const d=Number(e.date.slice(8,10));
      if(!localByDay[d]) localByDay[d]={sales:0,leads:0,buyer:0};
      localByDay[d].sales+=Number(e.sales||0);
      localByDay[d].leads+=Number(e.leads||0);
      localByDay[d].buyer+=Number(e.buyer||0);
    });
    const arr=[];
    let cumSales=0, cumTarget=0;
    for(let d=1;d<=days;d++){
      const hd=data.h?.daily?.[d-1] || null;
      const sales=(hd?.sales||0)+(localByDay[d]?.sales||0);
      cumSales += sales;
      const targetDaily = data.target ? data.target/days : (hd?.targetDaily||0);
      cumTarget += targetDaily;
      arr.push({day:d,sales,cumSales,cumTarget});
    }
    return arr;
  }

  function channelBreakdown(key){
    const data=monthData(key);
    const out={};
    data.local.forEach(e => out[e.channel]=(out[e.channel]||0)+Number(e.sales||0));
    const b=data.h?.breakdown;
    if(b){
      if(b.whatsapp) out["WhatsApp (Excel)"]=(out["WhatsApp (Excel)"]||0)+b.whatsapp;
      if(b.liveTikTok) out["Live TikTok (Excel)"]=(out["Live TikTok (Excel)"]||0)+b.liveTikTok;
      if(b.tiktokTotal) out["TikTok Total (Excel)"]=(out["TikTok Total (Excel)"]||0)+b.tiktokTotal;
    }
    return out;
  }

  function renderDashboard(){
    const d=monthData(selectedMonth);
    const achievement=d.target ? d.sales/d.target*100 : 0;
    const balance=Math.max(d.target-d.sales,0);
    byId("kpiSales").textContent=money(d.sales);
    byId("kpiTarget").textContent=money(d.target);
    byId("kpiAchievement").textContent=`${pct(achievement)} dicapai`;
    byId("kpiBalance").textContent=`Baki ${money(balance)}`;
    byId("targetProgress").style.width=Math.min(achievement,100)+"%";
    byId("kpiLeads").textContent=num(d.leads);
    byId("kpiBuyer").textContent=num(d.buyer);
    byId("kpiConversion").textContent=pct(d.conversion);

    const days=daysInMonth(selectedMonth), elapsed=elapsedDays(selectedMonth), remain=Math.max(days-elapsed,0);
    const expected=d.target ? d.target*(elapsed/days) : 0;
    const difference=d.sales-expected;
    const need=d.target && remain>0 ? Math.max(d.target-d.sales,0)/remain : 0;
    const forecast=elapsed>0 ? d.sales/elapsed*days : 0;

    byId("paceExpected").textContent=money(expected);
    byId("paceExpectedSub").textContent=elapsed ? `Hari ${elapsed} daripada ${days}` : "Bulan belum bermula";
    byId("paceDifference").textContent=(difference>=0?"+":"")+money(difference).replace("RM ","RM ");
    byId("paceDifferenceSub").textContent=difference>=0?"Di depan target":"Di belakang target";
    byId("paceDailyNeed").textContent=money(need);
    byId("paceDailyNeedSub").textContent=remain ? `${remain} hari berbaki` : "Bulan selesai / belum bermula";
    byId("paceForecast").textContent=money(forecast);

    const badge=byId("paceBadge");
    badge.className="badge ";
    if(!d.target){ badge.classList.add("neutral"); badge.textContent="BELUM ADA TARGET"; }
    else if(d.sales>=d.target){ badge.classList.add("good"); badge.textContent="TARGET TERCAPAI"; }
    else if(difference>=0){ badge.classList.add("good"); badge.textContent="ON TRACK"; }
    else { badge.classList.add("bad"); badge.textContent="BEHIND TARGET"; }

    renderChannels();
    drawDailyChart();
    drawMonthlyChart();
  }

  function renderChannels(){
    const list=byId("channelList"), note=byId("channelNote");
    const ch=channelBreakdown(selectedMonth);
    const rows=Object.entries(ch).sort((a,b)=>b[1]-a[1]);
    const max=Math.max(...rows.map(x=>x[1]),1);
    if(!rows.length){
      list.innerHTML=`<div class="muted">Tiada pecahan channel untuk bulan ini.</div>`;
      note.textContent=histMonth(selectedMonth) ? "Fail lama untuk bulan ini tidak mempunyai pecahan channel yang konsisten. Jumlah utama masih dipaparkan pada dashboard." : "Masukkan sales melalui menu Input Sales untuk mula melihat pecahan channel.";
      return;
    }
    list.innerHTML=rows.map(([name,val])=>`
      <div class="channel-row">
        <div class="channel-top"><strong>${escapeHtml(name)}</strong><span>${money(val)}</span></div>
        <div class="channel-bar"><i style="width:${Math.max(4,val/max*100)}%"></i></div>
      </div>`).join("");
    note.textContent="Label “(Excel)” ialah pecahan yang dapat dikenal pasti secara jelas daripada sheet lama.";
  }

  function drawLineChart(canvas, datasets, labels, opts={}){
    const ctx=canvas.getContext("2d");
    const ratio=window.devicePixelRatio||1;
    const w=canvas.clientWidth||800, h=Number(canvas.getAttribute("height"))||250;
    canvas.width=w*ratio; canvas.height=h*ratio; ctx.scale(ratio,ratio);
    ctx.clearRect(0,0,w,h);
    const css=getComputedStyle(document.body), muted=css.getPropertyValue("--muted").trim(), line=css.getPropertyValue("--line").trim(), accent=css.getPropertyValue("--accent").trim(), good=css.getPropertyValue("--good").trim();
    const pad={l:52,r:18,t:18,b:38}, iw=w-pad.l-pad.r, ih=h-pad.t-pad.b;
    const vals=datasets.flatMap(d=>d.data).filter(Number.isFinite);
    const max=Math.max(...vals,1), min=Math.min(0,...vals);
    const range=max-min||1;
    ctx.strokeStyle=line;ctx.fillStyle=muted;ctx.font="11px system-ui";
    for(let i=0;i<=4;i++){const y=pad.t+ih*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();const v=max-range*i/4;ctx.fillText(compact(v),5,y+4);}
    const xFor=i=>pad.l+(labels.length<=1?0:iw*i/(labels.length-1));
    const yFor=v=>pad.t+ih-(v-min)/range*ih;
    const step=Math.max(1,Math.ceil(labels.length/8));
    labels.forEach((lab,i)=>{if(i%step===0||i===labels.length-1)ctx.fillText(lab,xFor(i)-8,h-13)});
    datasets.forEach((ds,idx)=>{
      ctx.strokeStyle=ds.color||[accent,good][idx%2];ctx.lineWidth=2.3;ctx.beginPath();
      ds.data.forEach((v,i)=>{const x=xFor(i),y=yFor(v); if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
      ctx.stroke();
    });
    if(opts.legend){
      let lx=pad.l;
      datasets.forEach((ds,idx)=>{ctx.fillStyle=ds.color||[accent,good][idx%2];ctx.fillRect(lx,5,12,3);ctx.fillStyle=muted;ctx.fillText(ds.name,lx+17,9);lx+=100;});
    }
  }
  function compact(v){ if(Math.abs(v)>=1000)return "RM"+(v/1000).toFixed(v>=10000?0:1)+"k"; return "RM"+Math.round(v); }

  function drawDailyChart(){
    const arr=dailySeries(selectedMonth);
    const has=arr.some(x=>x.cumSales>0||x.cumTarget>0);
    byId("chartEmpty").classList.toggle("hidden",has);
    if(!has){ const c=byId("dailyChart").getContext("2d"); c.clearRect(0,0,byId("dailyChart").width,byId("dailyChart").height); return; }
    drawLineChart(byId("dailyChart"),[
      {name:"Sales",data:arr.map(x=>x.cumSales)},
      {name:"Target",data:arr.map(x=>x.cumTarget)}
    ],arr.map(x=>String(x.day)),{legend:true});
  }

  function allMonthSummary(){
    const keys=new Set(H.map(x=>x.month));
    entries.forEach(e=>keys.add(e.date.slice(0,7)));
    Object.keys(targets).forEach(k=>keys.add(k));
    return [...keys].sort().map(k=>({month:k,...monthData(k)}));
  }
  function drawMonthlyChart(){
    const rows=allMonthSummary().filter(x=>x.month<="2026-12");
    const tail=rows.slice(-18);
    drawLineChart(byId("monthlyChart"),[
      {name:"Sales",data:tail.map(x=>x.sales)},
      {name:"Target",data:tail.map(x=>x.target)}
    ],tail.map(x=>x.month.slice(2).replace("-","/")),{legend:true});
  }

  function renderEntries(){
    const rows=localForMonth(selectedMonth).sort((a,b)=>b.date.localeCompare(a.date));
    const el=byId("localEntryList");
    if(!rows.length){el.innerHTML=`<div class="muted">Belum ada input baru untuk ${monthLabel(selectedMonth)}.</div>`;return;}
    el.innerHTML=rows.map(e=>`
      <div class="entry-row">
        <div><strong>${escapeHtml(e.channel)}</strong><br><small>${e.date}${e.note?` · ${escapeHtml(e.note)}`:""} · Leads ${e.leads||0} · Buyer ${e.buyer||0}</small></div>
        <strong>${money(e.sales)}</strong>
        <button data-delete="${e.id}" title="Padam">✕</button>
      </div>`).join("");
    el.querySelectorAll("[data-delete]").forEach(btn=>btn.onclick=()=>{
      entries=entries.filter(e=>e.id!==btn.dataset.delete);save();renderAll();toast("Rekod dipadam");
    });
  }

  function renderTarget(){
    const t=effectiveTarget(selectedMonth);
    byId("targetCurrentDisplay").textContent=money(t);
    byId("targetInput").value=Object.prototype.hasOwnProperty.call(targets,selectedMonth)?targets[selectedMonth]:"";
    byId("cp25").textContent=money(t*.25);byId("cp50").textContent=money(t*.5);byId("cp75").textContent=money(t*.75);byId("cp100").textContent=money(t);
  }

  function renderHistory(){
    const filter=byId("historyYearFilter").value;
    const rows=H.filter(x=>filter==="all"||String(x.year)===filter).slice().sort((a,b)=>b.month.localeCompare(a.month));
    byId("historyTableBody").innerHTML=rows.map(x=>{
      const achievement=x.target?x.sales/x.target*100:0;
      const overall=x.breakdown?.overall ?? x.officialOverall ?? null;
      return `<tr>
        <td><strong>${monthLabel(x.month)}</strong><br><small class="muted">${escapeHtml(x.sheet)}</small></td>
        <td>${money(x.target)}</td><td>${money(x.sales)}</td><td>${pct(achievement)}</td>
        <td>${num(x.leads)}</td><td>${num(x.buyer)}</td><td>${pct(x.conversion)}</td><td>${overall==null?"—":money(overall)}</td>
      </tr>`;
    }).join("");
  }

  function renderYearly(){
    const groups={};
    H.forEach(x=>{
      groups[x.year] ||= {year:x.year,sales:0,target:0,leads:0,buyer:0,months:0};
      const g=groups[x.year];g.sales+=x.sales;g.target+=x.target;g.leads+=x.leads;g.buyer+=x.buyer;g.months++;
    });
    entries.forEach(e=>{
      const y=Number(e.date.slice(0,4));groups[y] ||= {year:y,sales:0,target:0,leads:0,buyer:0,months:0};
      groups[y].sales+=Number(e.sales||0);groups[y].leads+=Number(e.leads||0);groups[y].buyer+=Number(e.buyer||0);
    });
    Object.entries(targets).forEach(([k,v])=>{
      const y=Number(k.slice(0,4)); if(groups[y]) {
        const h=histMonth(k);groups[y].target += Number(v||0)-(h?.target||0);
      }
    });
    const arr=Object.values(groups).sort((a,b)=>a.year-b.year);
    byId("yearCards").innerHTML=arr.map(g=>{
      const ach=g.target?g.sales/g.target*100:0,cr=g.leads?g.buyer/g.leads*100:0;
      return `<article class="card year-card"><span class="eyebrow">${g.year}</span><strong>${money(g.sales)}</strong><span class="muted">Target ${money(g.target)} · ${pct(ach)}</span><div class="year-meta"><span>${num(g.leads)} leads</span><span>${num(g.buyer)} buyer</span><span>CR ${pct(cr)}</span></div></article>`;
    }).join("");
    drawLineChart(byId("yearChart"),[
      {name:"Sales",data:arr.map(x=>x.sales)},{name:"Target",data:arr.map(x=>x.target)}
    ],arr.map(x=>String(x.year)),{legend:true});
  }

  function renderAll(){
    renderDashboard();renderEntries();renderTarget();renderHistory();renderYearly();
  }

  function escapeHtml(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

  const pageMeta={
    dashboard:["Dashboard Sales Naim","Pantau target, sales, leads dan prestasi dari bulan ke bulan."],
    input:["Input Sales","Masukkan sales baru. Data disimpan pada browser ini."],
    target:["Target Bulanan","Tetapkan target untuk bulan dipilih."],
    historical:["Data Lama","Semua rekod sejarah yang dibawa masuk daripada Forecast Sales Naim.xlsx."],
    yearly:["Prestasi Tahunan","Bandingkan prestasi 2024, 2025 dan 2026."],
    backup:["Backup Data","Backup dan pulihkan input baru anda."]
  };
  function go(page){
    document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
    byId("page-"+page).classList.add("active");
    byId("pageTitle").textContent=pageMeta[page][0];byId("pageSubtitle").textContent=pageMeta[page][1];
    if(page==="dashboard"){setTimeout(()=>{drawDailyChart();drawMonthlyChart()},50)}
    if(page==="yearly"){setTimeout(drawYearly,50)}
  }

  document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>go(b.dataset.page));
  document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));

  byId("monthPicker").value=selectedMonth;
  byId("monthPicker").onchange=e=>{selectedMonth=e.target.value||currentMonth;renderAll()};

  byId("salesForm").onsubmit=e=>{
    e.preventDefault();
    const date=byId("entryDate").value;
    if(!date)return;
    entries.push({
      id:(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()),
      date,channel:byId("entryChannel").value,
      sales:Number(byId("entrySales").value||0),
      leads:Number(byId("entryLeads").value||0),
      buyer:Number(byId("entryBuyer").value||0),
      note:byId("entryNote").value.trim()
    });
    save(); selectedMonth=date.slice(0,7);byId("monthPicker").value=selectedMonth;
    byId("salesForm").reset();byId("entryLeads").value=0;byId("entryBuyer").value=0;byId("entryDate").value=new Date().toISOString().slice(0,10);
    renderAll();toast("Sales berjaya disimpan");
  };

  byId("targetForm").onsubmit=e=>{
    e.preventDefault(); targets[selectedMonth]=Number(byId("targetInput").value||0);save();renderAll();toast("Target disimpan");
  };
  byId("removeTargetBtn").onclick=()=>{delete targets[selectedMonth];save();renderAll();toast("Override target dibuang")};

  byId("exportBtn").onclick=()=>{
    const payload={version:1,exportedAt:new Date().toISOString(),entries,targets};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`naim-sales-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
  };
  byId("importFile").onchange=async e=>{
    const f=e.target.files[0];if(!f)return;
    try{const p=JSON.parse(await f.text()); if(!Array.isArray(p.entries)||typeof p.targets!=="object")throw new Error("Format tidak sah");entries=p.entries;targets=p.targets||{};save();renderAll();toast("Backup berjaya dipulihkan");}
    catch(err){alert("Fail backup tidak sah.");}
    e.target.value="";
  };
  byId("clearBtn").onclick=()=>{if(confirm("Padam semua input baru dan target override pada browser ini?")){entries=[];targets={};save();renderAll();toast("Data tempatan dipadam")}};

  const years=[...new Set(H.map(x=>x.year))].sort((a,b)=>b-a);
  byId("historyYearFilter").innerHTML='<option value="all">Semua Tahun</option>'+years.map(y=>`<option value="${y}">${y}</option>`).join("");
  byId("historyYearFilter").onchange=renderHistory;

  const savedTheme=localStorage.getItem(THEME_KEY);
  if(savedTheme==="light")document.body.classList.add("light");
  byId("themeBtn").onclick=()=>{document.body.classList.toggle("light");localStorage.setItem(THEME_KEY,document.body.classList.contains("light")?"light":"dark");renderAll()};

  byId("entryDate").value=new Date().toISOString().slice(0,10);
  window.addEventListener("resize",()=>{ if(byId("page-dashboard").classList.contains("active")){drawDailyChart();drawMonthlyChart()} if(byId("page-yearly").classList.contains("active"))drawYearly(); });
  renderAll();
})();
