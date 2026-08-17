
(() => {
  const H = window.NAIM_HISTORICAL_DATA || [];
  const KEYS = {
    entries:"naim_v2_entries",
    cod:"naim_v2_cod",
    targets:"naim_v2_targets",
    settings:"naim_v2_settings",
    theme:"naim_v2_theme"
  };
  const DEFAULT_SETTINGS = {
    wsLiveRate:4,
    adsDeduction:1000,
    sstRate:8,
    roiThreshold:5,
    gmvLowRate:1,
    gmvHighRate:2
  };
  const monthNames=["Januari","Februari","Mac","April","Mei","Jun","Julai","Ogos","September","Oktober","November","Disember"];
  const $=id=>document.getElementById(id);
  const safe=(v,f)=>{try{return JSON.parse(v)??f}catch(e){return f}};
  let entries=safe(localStorage.getItem(KEYS.entries),[]);
  let cod=safe(localStorage.getItem(KEYS.cod),[]);
  let targets=safe(localStorage.getItem(KEYS.targets),{});
  let settings={...DEFAULT_SETTINGS,...safe(localStorage.getItem(KEYS.settings),{})};
  const now=new Date();
  const currentMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  let selectedMonth=currentMonth;

  const money=n=>"RM "+Number(n||0).toLocaleString("en-MY",{minimumFractionDigits:0,maximumFractionDigits:2});
  const nfmt=n=>Number(n||0).toLocaleString("en-MY",{maximumFractionDigits:2});
  const pct=n=>Number(n||0).toLocaleString("en-MY",{minimumFractionDigits:0,maximumFractionDigits:1})+"%";
  const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const monthLabel=k=>{const [y,m]=k.split("-").map(Number);return `${monthNames[m-1]} ${y}`};
  const histMonth=k=>H.find(x=>x.month===k)||null;
  const monthOfDate=d=>d.slice(0,7);
  const dayOfDate=d=>Number(d.slice(8,10));
  const daysInMonth=k=>{const [y,m]=k.split("-").map(Number);return new Date(y,m,0).getDate()};
  const prevMonth=k=>{let [y,m]=k.split("-").map(Number);m--;if(m===0){m=12;y--}return `${y}-${String(m).padStart(2,"0")}`};
  const toast=msg=>{const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)};
  function save(){localStorage.setItem(KEYS.entries,JSON.stringify(entries));localStorage.setItem(KEYS.cod,JSON.stringify(cod));localStorage.setItem(KEYS.targets,JSON.stringify(targets));localStorage.setItem(KEYS.settings,JSON.stringify(settings))}

  function histWsSales(h){return Number(h?.breakdown?.whatsapp ?? h?.sales ?? 0)}
  function histLiveRows(h){
    const out=[];
    if(!h?.live)return out;
    Object.entries(h.live).forEach(([source,obj])=>(obj.daily||[]).forEach(r=>out.push({...r,source,historical:true})));
    return out;
  }
  function histGmvRows(h){return (h?.gmv?.daily||[]).map(r=>({...r,historical:true}))}
  function localRows(month,type){return entries.filter(e=>monthOfDate(e.date)===month&&e.type===type)}

  function liveRows(month){
    const h=histMonth(month);
    const hist=histLiveRows(h);
    const local=localRows(month,"live").map(e=>({date:e.date,sales:Number(e.sales||0),target:0,source:e.source,historical:false}));
    return hist.concat(local);
  }
  function gmvRows(month){
    const h=histMonth(month);
    const hist=histGmvRows(h);
    const local=localRows(month,"gmv").map(e=>({date:e.date,sales:Number(e.sales||0),adsCost:Number(e.adsCost||0),target:0,historical:false,id:e.id}));
    return hist.concat(local);
  }
  function wsLocal(month){return localRows(month,"whatsapp")}
  function targetDefaults(month){
    const h=histMonth(month);
    let liveHQ=0,liveSolusi=0;
    if(h?.live){
      liveHQ=Number(h.live["TikTok HQ"]?.target ?? h.live["TikTok Live"]?.target ?? 0);
      liveSolusi=Number(h.live["TikTok Solusi"]?.target ?? 0);
    }
    return {
      whatsapp:Number(h?.target||0),
      liveHQ, liveSolusi,
      gmv:Number(h?.gmv?.target||0)
    };
  }
  function targetData(month){
    return {...targetDefaults(month),...(targets[month]||{})};
  }

  function roiFor(row){
    const cost=Number(row.adsCost||0);
    const sales=Number(row.sales||0);
    if(cost<=0)return 0;
    const sst=cost*(settings.sstRate/100);
    return sales/(cost+sst);
  }
  function gmvRate(roi){return roi>=settings.roiThreshold?settings.gmvHighRate:settings.gmvLowRate}
  function gmvCommissionRow(row){
    if(Number(row.adsCost||0)<=0)return 0;
    return Number(row.sales||0)*(gmvRate(roiFor(row))/100);
  }

  function monthData(month){
    const h=histMonth(month);
    const localWs=wsLocal(month);
    const wsSales=histWsSales(h)+localWs.reduce((a,e)=>a+Number(e.sales||0),0);
    const leads=Number(h?.leads||0)+localWs.reduce((a,e)=>a+Number(e.leads||0),0);
    const buyer=Number(h?.buyer||0)+localWs.reduce((a,e)=>a+Number(e.buyer||0),0);

    const currentLive=liveRows(month);
    const current125=currentLive.filter(r=>dayOfDate(r.date)<=25).reduce((a,r)=>a+Number(r.sales||0),0);
    const currentLate=currentLive.filter(r=>dayOfDate(r.date)>=26).reduce((a,r)=>a+Number(r.sales||0),0);
    const previousLate=liveRows(prevMonth(month)).filter(r=>dayOfDate(r.date)>=26).reduce((a,r)=>a+Number(r.sales||0),0);
    const liveCycle=current125+previousLate;
    const liveCalendar=currentLive.reduce((a,r)=>a+Number(r.sales||0),0);
    const totalSales=wsSales+liveCycle;

    const gmvs=gmvRows(month);
    const gmvSales=gmvs.reduce((a,r)=>a+Number(r.sales||0),0);
    const gmvAds=gmvs.reduce((a,r)=>a+Number(r.adsCost||0),0);
    const gmvSst=gmvAds*(settings.sstRate/100);
    const gmvRoi=gmvAds>0?gmvSales/(gmvAds+gmvSst):0;
    const gmvCommission=gmvs.reduce((a,r)=>a+gmvCommissionRow(r),0);

    const commissionBase=Math.max(totalSales-settings.adsDeduction,0);
    const salesCommission=commissionBase*(settings.wsLiveRate/100);
    const totalCommission=salesCommission+gmvCommission;
    const t=targetData(month);
    const totalTarget=Number(t.whatsapp||0)+Number(t.liveHQ||0)+Number(t.liveSolusi||0);

    return {h,wsSales,leads,buyer,current125,currentLate,previousLate,liveCycle,liveCalendar,totalSales,gmvs,gmvSales,gmvAds,gmvSst,gmvRoi,gmvCommission,commissionBase,salesCommission,totalCommission,target:t,totalTarget};
  }

  function codeBreakdown(month){
    const h=histMonth(month);
    const out={};
    if(h?.whatsappCodes){
      Object.entries(h.whatsappCodes).forEach(([code,v])=>out[code]={sales:Number(v.sales||0),leads:Number(v.leads||0),buyer:Number(v.buyer||0)});
    }
    wsLocal(month).forEach(e=>{
      const code=e.code||"M9F";
      out[code]??={sales:0,leads:0,buyer:0};
      out[code].sales+=Number(e.sales||0);out[code].leads+=Number(e.leads||0);out[code].buyer+=Number(e.buyer||0);
    });
    return out;
  }

  function renderDashboard(){
    const d=monthData(selectedMonth);
    const ach=d.totalTarget?d.totalSales/d.totalTarget*100:0;
    $("dTotalSales").textContent=money(d.totalSales);
    $("dTarget").textContent=money(d.totalTarget);
    $("dProgress").style.width=Math.min(ach,100)+"%";
    $("dAchievement").textContent=pct(ach)+" dicapai";
    $("dBalance").textContent="Baki "+money(Math.max(d.totalTarget-d.totalSales,0));
    $("dWhatsapp").textContent=money(d.wsSales);
    $("dLive").textContent=money(d.liveCycle);
    $("dGmv").textContent=money(d.gmvSales);
    $("dCommission").textContent=money(d.totalCommission);

    $("liveCarry").textContent=money(d.previousLate);
    $("liveCurrent").textContent=money(d.current125);
    $("liveNext").textContent=money(d.currentLate);
    $("liveCycleTotal").textContent=money(d.liveCycle);
    $("gmvAds").textContent=money(d.gmvAds);
    $("gmvSst").textContent=money(d.gmvSst);
    $("gmvRoi").textContent=d.gmvRoi.toFixed(2);
    $("gmvCommission").textContent=money(d.gmvCommission);

    const src=[
      ["WhatsApp",d.wsSales,`Leads ${nfmt(d.leads)} • Buyer ${nfmt(d.buyer)}`],
      ["Live 1–25",d.current125,"Bulan semasa"],
      ["Carry Live",d.previousLate,"26hb–akhir bulan lepas"],
      ["Live Next Month",d.currentLate,"26hb–akhir bulan ini"]
    ];
    $("sourceCards").innerHTML=src.map(x=>`<article class="card source-card"><span>${x[0]}</span><b>${money(x[1])}</b><small>${x[2]}</small></article>`).join("");

    const codes=codeBreakdown(selectedMonth);
    const codeRows=Object.entries(codes);
    $("wsCodeBreakdown").innerHTML=codeRows.length?codeRows.map(([k,v])=>`<div class="row-card"><div><b>${esc(k)}</b><small>${nfmt(v.leads)} leads • ${nfmt(v.buyer)} buyer</small></div><b>${money(v.sales)}</b></div>`).join(""):`<div class="muted">Tiada pecahan kod untuk bulan ini.</div>`;

    const days=daysInMonth(selectedMonth);
    let elapsed=0;
    if(selectedMonth<currentMonth)elapsed=days;else if(selectedMonth===currentMonth)elapsed=Math.min(now.getDate(),days);
    const expected=d.totalTarget?d.totalTarget*(elapsed/days):0;
    const diff=d.totalSales-expected;
    const remain=Math.max(days-elapsed,0);
    const need=d.totalTarget&&remain>0?Math.max(d.totalTarget-d.totalSales,0)/remain:0;
    const forecast=elapsed>0?d.totalSales/elapsed*days:0;
    $("paceExpected").textContent=money(expected);$("paceExpectedSub").textContent=elapsed?`Hari ${elapsed} / ${days}`:"Bulan belum bermula";
    $("paceDiff").textContent=(diff>=0?"+":"")+money(diff);$("paceDiffSub").textContent=diff>=0?"Di depan pace":"Di belakang pace";
    $("paceNeed").textContent=money(need);$("paceNeedSub").textContent=remain?`${remain} hari berbaki`:"Bulan selesai";
    $("paceForecast").textContent=money(forecast);
    const badge=$("paceBadge");badge.className="badge ";
    if(!d.totalTarget){badge.classList.add("neutral");badge.textContent="BELUM ADA TARGET"}
    else if(d.totalSales>=d.totalTarget){badge.classList.add("good");badge.textContent="TARGET TERCAPAI"}
    else if(diff>=0){badge.classList.add("good");badge.textContent="ON TRACK"}else{badge.classList.add("bad");badge.textContent="BEHIND TARGET"}
    drawMonthlyChart();
  }

  function allMonths(){
    const set=new Set(H.map(x=>x.month));
    entries.forEach(e=>set.add(monthOfDate(e.date)));
    Object.keys(targets).forEach(k=>set.add(k));
    return [...set].sort();
  }
  function drawChart(canvas,labels,series){
    const ctx=canvas.getContext("2d"),ratio=window.devicePixelRatio||1,w=canvas.clientWidth||800,h=Number(canvas.getAttribute("height"))||250;
    canvas.width=w*ratio;canvas.height=h*ratio;ctx.scale(ratio,ratio);ctx.clearRect(0,0,w,h);
    const css=getComputedStyle(document.body),muted=css.getPropertyValue("--muted").trim(),line=css.getPropertyValue("--line").trim(),red=css.getPropertyValue("--red").trim(),green=css.getPropertyValue("--green").trim();
    const pad={l:55,r:15,t:24,b:40},iw=w-pad.l-pad.r,ih=h-pad.t-pad.b;
    const vals=series.flatMap(s=>s.data);const max=Math.max(...vals,1),min=0,range=max-min||1;
    ctx.font="10px system-ui";ctx.strokeStyle=line;ctx.fillStyle=muted;
    for(let i=0;i<=4;i++){const y=pad.t+ih*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();const v=max-range*i/4;ctx.fillText(v>=1000?"RM"+(v/1000).toFixed(1)+"k":"RM"+Math.round(v),4,y+3)}
    const x=i=>pad.l+(labels.length<=1?0:iw*i/(labels.length-1)),y=v=>pad.t+ih-(v-min)/range*ih;
    const step=Math.max(1,Math.ceil(labels.length/8));labels.forEach((lab,i)=>{if(i%step===0||i===labels.length-1)ctx.fillText(lab,x(i)-9,h-13)});
    series.forEach((s,si)=>{ctx.strokeStyle=si===0?red:green;ctx.lineWidth=2.4;ctx.beginPath();s.data.forEach((v,i)=>i?ctx.lineTo(x(i),y(v)):ctx.moveTo(x(i),y(v)));ctx.stroke()});
    let lx=pad.l;series.forEach((s,si)=>{ctx.fillStyle=si===0?red:green;ctx.fillRect(lx,6,12,3);ctx.fillStyle=muted;ctx.fillText(s.name,lx+17,10);lx+=100});
  }
  function drawMonthlyChart(){
    const ms=allMonths().slice(-18),rows=ms.map(m=>monthData(m));
    drawChart($("salesChart"),ms.map(m=>m.slice(2).replace("-","/")),[{name:"Sales",data:rows.map(r=>r.totalSales)},{name:"Target",data:rows.map(r=>r.totalTarget)}]);
  }

  function renderSalesEntries(){
    const rows=entries.filter(e=>monthOfDate(e.date)===selectedMonth&&(e.type==="whatsapp"||e.type==="live")).sort((a,b)=>b.date.localeCompare(a.date));
    $("salesEntryBody").innerHTML=rows.length?rows.map(e=>`<tr><td>${e.date}</td><td>${e.type==="whatsapp"?"WhatsApp":"Live"}</td><td>${esc(e.type==="whatsapp"?e.code:e.source)}</td><td>${money(e.sales)}</td><td>${e.leads??"—"}</td><td>${e.buyer??"—"}</td><td><button class="delete-btn" data-del="${e.id}">✕</button></td></tr>`).join(""):`<tr><td colspan="7" class="muted">Belum ada input baru bulan ini.</td></tr>`;
    document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{entries=entries.filter(e=>e.id!==b.dataset.del);save();renderAll();toast("Rekod dipadam")});
  }

  function renderGmv(){
    const rows=gmvRows(selectedMonth).slice().sort((a,b)=>a.date.localeCompare(b.date));
    $("gmvBody").innerHTML=rows.length?rows.map(r=>{
      const sst=Number(r.adsCost||0)*settings.sstRate/100,roi=roiFor(r),rate=Number(r.adsCost||0)>0?gmvRate(roi):0,comm=gmvCommissionRow(r);
      return `<tr><td>${r.date}${r.historical?" <small>(Excel)</small>":""}</td><td>${money(r.sales)}</td><td>${money(r.adsCost)}</td><td>${money(sst)}</td><td>${money(Number(r.adsCost||0)+sst)}</td><td>${roi.toFixed(2)}</td><td>${rate?rate+"%":"—"}</td><td>${money(comm)}</td><td>${r.id?`<button class="delete-btn" data-delgmv="${r.id}">✕</button>`:""}</td></tr>`;
    }).join(""):`<tr><td colspan="9" class="muted">Tiada data GMV.</td></tr>`;
    document.querySelectorAll("[data-delgmv]").forEach(b=>b.onclick=()=>{entries=entries.filter(e=>e.id!==b.dataset.delgmv);save();renderAll();toast("GMV dipadam")});
    previewGmv();
  }
  function previewGmv(){
    const sales=Number($("gmvSales").value||0),cost=Number($("gmvCost").value||0);
    if(!sales||!cost){$("gmvPreview").textContent="Masukkan sales + cost untuk lihat ROI.";return}
    const sst=cost*settings.sstRate/100,roi=sales/(cost+sst),rate=gmvRate(roi),comm=sales*rate/100;
    $("gmvPreview").textContent=`SST ${money(sst)} • ROI ${roi.toFixed(2)} • Rate ${rate}% • Komisen ${money(comm)}`;
  }

  function renderCod(){
    const filter=$("codFilter").value||"all";
    const rows=cod.filter(r=>filter==="all"||r.status===filter).slice().sort((a,b)=>b.submitDate.localeCompare(a.submitDate));
    $("codBody").innerHTML=rows.length?rows.map(r=>`<tr><td>${r.submitDate}</td><td>${esc(r.code)}</td><td>${esc(r.ref)}</td><td>${esc(r.customer||"—")}</td><td>${esc(r.phone||"—")}</td><td>${money(r.amount)}</td><td>${r.followDate||"—"}</td><td><select class="cod-status" data-codstatus="${r.id}"><option ${r.status==="Pending"?"selected":""}>Pending</option><option ${r.status==="Settled"?"selected":""}>Settled</option><option ${r.status==="Return"?"selected":""}>Return</option></select></td><td><button class="delete-btn" data-delcod="${r.id}">✕</button></td></tr>`).join(""):`<tr><td colspan="9" class="muted">Tiada rekod COD.</td></tr>`;
    document.querySelectorAll("[data-codstatus]").forEach(s=>s.onchange=()=>{const r=cod.find(x=>x.id===s.dataset.codstatus);if(r){r.status=s.value;save();renderCod();toast("Status COD dikemaskini")}});document.querySelectorAll("[data-delcod]").forEach(b=>b.onclick=()=>{cod=cod.filter(x=>x.id!==b.dataset.delcod);save();renderCod();toast("COD dipadam")});
    $("codPending").textContent=cod.filter(x=>x.status==="Pending").length;$("codSettled").textContent=cod.filter(x=>x.status==="Settled").length;$("codReturn").textContent=cod.filter(x=>x.status==="Return").length;$("codPendingValue").textContent=money(cod.filter(x=>x.status==="Pending").reduce((a,x)=>a+Number(x.amount||0),0));
  }

  function renderCommission(){
    const d=monthData(selectedMonth);
    $("cWs").textContent=money(d.wsSales);$("cLiveCurrent").textContent=money(d.current125);$("cLiveCarry").textContent=money(d.previousLate);$("cSalesTotal").textContent=money(d.totalSales);$("cAdsDeduct").textContent="- "+money(settings.adsDeduction);$("cBase").textContent=money(d.commissionBase);$("cRateLabel").textContent=settings.wsLiveRate+"%";$("cWsLiveCommission").textContent=money(d.salesCommission);
    $("cGmvSales").textContent=money(d.gmvSales);$("cGmvAds").textContent=money(d.gmvAds);$("cGmvSst").textContent=money(d.gmvSst);$("cGmvRoi").textContent=d.gmvRoi.toFixed(2);$("cGmvCommission").textContent=money(d.gmvCommission);$("cGrand").textContent=money(d.totalCommission);
    const rows=d.gmvs.slice().sort((a,b)=>a.date.localeCompare(b.date));
    $("commissionGmvBody").innerHTML=rows.length?rows.map(r=>{const roi=roiFor(r),rate=Number(r.adsCost||0)>0?gmvRate(roi):0;return `<tr><td>${r.date}</td><td>${money(r.sales)}</td><td>${money(Number(r.adsCost||0)*(1+settings.sstRate/100))}</td><td>${roi.toFixed(2)}</td><td>${rate?rate+"%":"—"}</td><td>${money(gmvCommissionRow(r))}</td></tr>`}).join(""):`<tr><td colspan="6" class="muted">Tiada data GMV.</td></tr>`;
  }

  function renderTarget(){
    const t=targetData(selectedMonth),total=Number(t.whatsapp||0)+Number(t.liveHQ||0)+Number(t.liveSolusi||0);
    $("tWhatsapp").value=t.whatsapp||"";$("tLiveHQ").value=t.liveHQ||"";$("tLiveSolusi").value=t.liveSolusi||"";$("tGmv").value=t.gmv||"";$("targetSalesTotal").textContent=money(total);$("cp25").textContent=money(total*.25);$("cp50").textContent=money(total*.5);$("cp75").textContent=money(total*.75);$("cp100").textContent=money(total);
  }

  function renderHistory(){
    const year=$("historyYear").value||"all";
    const rows=H.filter(h=>year==="all"||String(h.year)===year).slice().sort((a,b)=>b.month.localeCompare(a.month));
    $("historyBody").innerHTML=rows.map(h=>{
      const d=monthData(h.month);
      return `<tr><td><b>${monthLabel(h.month)}</b><br><small>${esc(h.sheet)}</small></td><td>${money(d.totalTarget)}</td><td>${money(d.wsSales)}</td><td>${money(d.liveCycle)}</td><td><b>${money(d.totalSales)}</b></td><td>${money(d.gmvSales)}</td><td>${d.gmvRoi?d.gmvRoi.toFixed(2):"—"}</td><td>${money(d.salesCommission)}</td><td>${money(d.gmvCommission)}</td><td><b>${money(d.totalCommission)}</b></td></tr>`;
    }).join("");
  }

  function renderSettings(){
    $("sWsLiveRate").value=settings.wsLiveRate;$("sAdsDeduction").value=settings.adsDeduction;$("sSstRate").value=settings.sstRate;$("sRoiThreshold").value=settings.roiThreshold;$("sLowRate").value=settings.gmvLowRate;$("sHighRate").value=settings.gmvHighRate;
    $("ruleSummary").innerHTML=`<b>Sales commission:</b> max(WhatsApp + Live cycle − ${money(settings.adsDeduction)}, 0) × ${settings.wsLiveRate}%<br><b>Live cycle:</b> 26hb–akhir bulan lepas + 1hb–25hb bulan ini.<br><b>GMV ROI:</b> Sales ÷ (Ads + SST ${settings.sstRate}%). ROI ≥ ${settings.roiThreshold} → ${settings.gmvHighRate}%, selainnya → ${settings.gmvLowRate}%.`;
  }

  function renderAll(){renderDashboard();renderSalesEntries();renderGmv();renderCod();renderCommission();renderTarget();renderHistory();renderSettings()}

  const pageMeta={
    dashboard:["Dashboard Sales Naim","Sales, marketing, COD dan anggaran komisen dalam satu sistem."],
    input:["Input Sales","Rekod WhatsApp dan Live. Live selepas 25hb automatik masuk cycle bulan depan."],
    gmv:["Marketing GMV","TikTok GMV diasingkan daripada Total Sales dan dikira melalui ROI."],
    cod:["COD Tracker","Catat tarikh submit, nombor COD/customer dan status follow-up."],
    commission:["Anggaran Komisen","Komisen Sales 4% selepas kos ads + komisen GMV berdasarkan ROI."],
    target:["Target Bulanan","Target Sales dan target GMV disimpan berasingan."],
    history:["Data Lama","Data daripada Forecast Sales Naim.xlsx dengan pecahan sales/marketing."],
    settings:["Rules & Setting","Ubah rate komisen, deduction ads, SST dan threshold ROI."],
    backup:["Backup","Export atau restore data yang dimasukkan dalam browser ini."]
  };
  function go(page){
    document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.page===page));$("page-"+page).classList.add("active");$("pageTitle").textContent=pageMeta[page][0];$("pageSub").textContent=pageMeta[page][1];
    if(page==="dashboard")setTimeout(drawMonthlyChart,50);
  }
  document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>go(b.dataset.page));

  $("monthPicker").value=selectedMonth;$("monthPicker").onchange=e=>{selectedMonth=e.target.value||currentMonth;renderAll()};

  $("wsForm").onsubmit=e=>{e.preventDefault();entries.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),type:"whatsapp",date:$("wsDate").value,code:$("wsCode").value,sales:Number($("wsSales").value||0),leads:Number($("wsLeads").value||0),buyer:Number($("wsBuyer").value||0),note:$("wsNote").value.trim()});save();selectedMonth=$("wsDate").value.slice(0,7);$("monthPicker").value=selectedMonth;$("wsForm").reset();setToday();renderAll();toast("Sales WhatsApp disimpan")};
  $("liveForm").onsubmit=e=>{e.preventDefault();entries.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),type:"live",date:$("liveDate").value,source:$("liveSource").value,sales:Number($("liveSales").value||0),time:$("liveTime").value.trim(),note:$("liveNote").value.trim()});save();selectedMonth=$("liveDate").value.slice(0,7);$("monthPicker").value=selectedMonth;$("liveForm").reset();setToday();renderAll();toast(dayOfDate($("liveDate").value)>25?"Live disimpan untuk cycle bulan depan":"Sales Live disimpan")};
  $("gmvForm").onsubmit=e=>{e.preventDefault();entries.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),type:"gmv",date:$("gmvDate").value,sales:Number($("gmvSales").value||0),adsCost:Number($("gmvCost").value||0),note:$("gmvNote").value.trim()});save();selectedMonth=$("gmvDate").value.slice(0,7);$("monthPicker").value=selectedMonth;$("gmvForm").reset();setToday();renderAll();toast("GMV disimpan")};
  $("gmvSales").oninput=previewGmv;$("gmvCost").oninput=previewGmv;

  $("codForm").onsubmit=e=>{e.preventDefault();cod.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),submitDate:$("codDate").value,code:$("codCode").value,ref:$("codRef").value.trim(),customer:$("codCustomer").value.trim(),phone:$("codPhone").value.trim(),amount:Number($("codAmount").value||0),followDate:$("codFollow").value,status:$("codStatus").value,note:$("codNote").value.trim()});save();$("codForm").reset();setToday();renderCod();toast("COD disimpan")};
  $("codFilter").onchange=renderCod;

  $("targetForm").onsubmit=e=>{e.preventDefault();targets[selectedMonth]={whatsapp:Number($("tWhatsapp").value||0),liveHQ:Number($("tLiveHQ").value||0),liveSolusi:Number($("tLiveSolusi").value||0),gmv:Number($("tGmv").value||0)};save();renderAll();toast("Target disimpan")};
  $("targetReset").onclick=()=>{delete targets[selectedMonth];save();renderAll();toast("Target kembali ikut Excel")};

  $("settingsForm").onsubmit=e=>{e.preventDefault();settings={wsLiveRate:Number($("sWsLiveRate").value||0),adsDeduction:Number($("sAdsDeduction").value||0),sstRate:Number($("sSstRate").value||0),roiThreshold:Number($("sRoiThreshold").value||0),gmvLowRate:Number($("sLowRate").value||0),gmvHighRate:Number($("sHighRate").value||0)};save();renderAll();toast("Rules dikemaskini")};

  const years=[...new Set(H.map(x=>x.year))].sort((a,b)=>b-a);$("historyYear").innerHTML='<option value="all">Semua Tahun</option>'+years.map(y=>`<option>${y}</option>`).join("");$("historyYear").onchange=renderHistory;

  $("exportBtn").onclick=()=>{const payload={version:2,exportedAt:new Date().toISOString(),entries,cod,targets,settings};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`naim-sales-v2-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)};
  $("importFile").onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const p=JSON.parse(await f.text());entries=Array.isArray(p.entries)?p.entries:[];cod=Array.isArray(p.cod)?p.cod:[];targets=p.targets||{};settings={...DEFAULT_SETTINGS,...(p.settings||{})};save();renderAll();toast("Backup dipulihkan")}catch(err){alert("Fail backup tidak sah.")}e.target.value=""};
  $("clearBtn").onclick=()=>{if(confirm("Padam semua input baru, COD, target override dan setting custom? Data sejarah Excel kekal.")){entries=[];cod=[];targets={};settings={...DEFAULT_SETTINGS};save();renderAll();toast("Data tempatan dipadam")}};

  function setToday(){const d=new Date().toISOString().slice(0,10);["wsDate","liveDate","gmvDate","codDate"].forEach(id=>$(id).value=d)}
  setToday();
  if(localStorage.getItem(KEYS.theme)==="light")document.body.classList.add("light");$("themeBtn").onclick=()=>{document.body.classList.toggle("light");localStorage.setItem(KEYS.theme,document.body.classList.contains("light")?"light":"dark");renderAll()};
  window.addEventListener("resize",()=>{if($("page-dashboard").classList.contains("active"))drawMonthlyChart()});
  renderAll();
})();
