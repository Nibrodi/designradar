/* ---------- рилс: spec → вертикальное видео 1080×1920, рисуется в браузере ---------- */
const RW=1080, RH=1920, RM=80;
/* безопасная зона Instagram: в ленте видео режется до 4:5 (по 285 px сверху и снизу), во вкладке Reels низ (~420 px) закрыт подписью, справа — колонка кнопок */
const R_ST=300, R_SB=1480, R_RR=150;
let R_SHOW_SAFE=false;
function drawSafeZones(ctx){ ctx.save(); ctx.fillStyle="rgba(220,40,40,.28)"; ctx.fillRect(0,0,RW,285); ctx.fillRect(0,RH-420,RW,420); ctx.fillRect(RW-R_RR,1000,R_RR,RH-1420);
  ctx.strokeStyle="rgba(220,40,40,.9)"; ctx.lineWidth=4; ctx.setLineDash([18,12]); ctx.strokeRect(2,285,RW-4,RH-570); ctx.setLineDash([]);
  ctx.font="600 30px Inter, sans-serif"; ctx.fillStyle="#fff"; ctx.textBaseline="top"; ctx.fillText("обрежется в ленте",RM,120); ctx.fillText("закроет подпись Reels",RM,RH-300); ctx.restore(); }
const R_BG={cream:[C_CREAM,C_INK,"rgb(91,86,80)","#fff"], ink:[C_INK,C_CREAM,"rgb(190,182,168)","rgb(36,35,33)"], orange:[C_OR,C_INK,"rgb(60,30,15)",C_CREAM]};
const R_ACC={orange:C_OR, green:"rgb(31,122,58)", ink:C_INK, blue:"rgb(42,92,220)"};
const R_SIZE={S:96,M:120,L:146};
const R_TYPES=[["title","Заголовок"],["photo","Фото"],["number","Цифра"],["swatches","Цвета"],["compare","Было / стало"],["list","Список"],["ui","Интерфейс"],["text","Тезис"],["end","Финал"]];
/* фото: грузим с CORS (тогда видео можно записать), без CORS — только для превью */
const R_IMG=new Map(), R_LOCAL=new Map(); let rImgTick=0;
function rImg(url){ if(!url) return null; const u=R_LOCAL.get(url)||url; let e=R_IMG.get(u); if(e) return e;
  e={st:"loading",img:null,clean:false}; R_IMG.set(u,e); const local=/^(blob|data):/.test(u);
  const go=(cors)=>{ const im=new Image(); if(cors) im.crossOrigin="anonymous"; im.referrerPolicy="no-referrer"; im.decoding="async";
    im.onload=()=>{ e.st="ok"; e.img=im; e.clean=cors||local; rImgTick++; }; im.onerror=()=>{ if(cors) go(false); else { e.st="err"; rImgTick++; } }; im.src=u; };
  go(!local); return e; }
/* фото с чужих сайтов панель показать не может: забираем их через Make (6848987) и кладём в хранилище панели */
const SCN_IMG64=6848987;
async function importPhoto(url){
  if(!mcp||!assets) throw {message:"Загрузка фото недоступна в этом окне"};
  const res=await mcp.callTool(MAKE,"scenarios_run",{scenarioId:SCN_IMG64,responsive:true,data:{image_url:url}});
  const raw=JSON.stringify(res.payload??res.content??""); const m=raw.match(/image_base64\\?"\s*:\s*\\?"([A-Za-z0-9+\/=]{100,})/);
  if(!m) throw {message:"Make не смог скачать фото: "+raw.slice(0,140)};
  const bin=atob(m[1]); const u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
  const type=u8[0]===0x89?"image/png":u8[0]===0x52?"image/webp":"image/jpeg";
  const blob=new Blob([u8],{type}); const local=URL.createObjectURL(blob);
  const r=await assets.upload(new File([blob],"photo_"+Date.now()+"."+type.split("/")[1],{type}));
  R_LOCAL.set(r.url,local); return r.url; }
const rIsExt=u=>/^https:\/\//.test(u||"")&&!/\/_blob\//.test(u||"")&&!/claude\.ai|claudeusercontent|anthropic/.test(u||"");
/* фото поста, которые можно показать: ссылки https и загруженные в панель */
function reelPhotos(d){ const out=[], seen=new Set(); const add=(url,cap)=>{ if(!url||seen.has(url)||!/^(https:|blob:)/.test(url)) return; seen.add(url); out.push({url,cap:cap||""}); };
  const credit=(String(d.full_text||"").match(/^Фото:\s*(.+)$/m)||[])[1]||"";
  const pa=d.photo_assets||{}; const add0=add; const addM=(url,cap)=>{ const n=out.length; add0(pa[url]||url,cap); if(out.length>n) out[n].orig=url; }; 
  return reelPhotosFrom(d,addM,credit,out); }
function reelPhotosFrom(d,add,credit,out){
  add(d.cover_url, credit); (d.photo_urls||[]).forEach(u=>add(u,((d.photo_meta||{})[u]||{}).credit||credit)); (d.media||[]).filter(m=>m&&!m.gen&&!m.pending).forEach(m=>add(m.url,(m.caption||"").replace(/^Фото:\s*/,"")||credit));
  return out; }
const R_KINDS=[["list","Список"],["skeleton","Скелетон"],["progress","Прогресс"]];
const rClamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const rEase=x=>1-Math.pow(1-rClamp(x),3);
const rHex=s=>{ const m=String(s||"").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i); if(!m) return null; let h=m[1]; if(h.length===3) h=h.split("").map(c=>c+c).join(""); return "#"+h.toLowerCase(); };
function rMix(a,b,t){ const p=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16)); const A=p(a), B=p(b); return "rgb("+A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(",")+")"; }
function rSwatches(sc){ const list=String(sc.colors||"").split(/[\s,;]+/).map(rHex).filter(Boolean); if(list.length>1) return list.slice(0,60);
  const a=rHex(sc.from)||"#0b1f6b", b=rHex(sc.to)||"#7fb2ff", n=Math.max(4,Math.min(60,Number(sc.count)||24)); return Array.from({length:n},(_,i)=>rMix(a,b,i/(n-1))); }
/* счётчик: «+200 млн $» досчитывает от нуля, единицы и знаки остаются */
function rCount(v, k){ const s=String(v||""); const m=s.match(/\d[\d\s\u00A0.,]*/); if(!m) return s; const raw=m[0].replace(/[\s\u00A0]/g,""); const dec=(raw.match(/[.,](\d+)$/)||[])[1]||""; const num=parseFloat(raw.replace(",","."));
  if(!isFinite(num)) return s; const cur=num*k; const f=dec?cur.toFixed(dec.length).replace(".",","):String(Math.round(cur)).replace(/\B(?=(\d{3})+(?!\d))/g,"\u00A0"); return s.slice(0,m.index)+f+(/[\s\u00A0]$/.test(m[0])?" ":"")+s.slice(m.index+m[0].length); }
const reelDur=spec=>(spec&&spec.scenes||[]).reduce((s,x)=>s+rClamp(Number(x.dur)||3,1.5,8),0)||1;
const reelCaption=(sc,i)=>(i+1)+" · "+((R_TYPES.find(t=>t[0]===sc.type)||[])[1]||"Сцена");
function reelAcc(sc,bg){ let a=R_ACC[sc.accent||"orange"]||C_OR; if(bg==="orange"&&a===C_OR) a=C_CREAM; if(bg==="ink"&&a===C_INK) a=C_OR; return a; }

/* одна сцена в момент local (сек от начала сцены) */
function drawReelScene(ctx, spec, sc, local, dur, warn){
  const bg=R_BG[sc.bg]?sc.bg:"cream"; const [B,F,M,CARD]=R_BG[bg]; const A=reelAcc(sc,bg);
  ctx.fillStyle=B; ctx.fillRect(0,0,RW,RH);
  const ins=rEase(local/.45), out=rClamp((dur-local)/.3);
  const isPhoto=sc.type==="photo", full=isPhoto&&sc.layout!=="card"; let pim=null;
  if(isPhoto){ pim=rImg(sc.src);
    if(!sc.src) warn.push("выбери фото"); else if(pim&&pim.st==="err") warn.push("фото не открылось — выбери другое или загрузи своё");
    if(full){ ctx.fillStyle="rgb(40,38,35)"; ctx.fillRect(0,0,RW,RH);
      if(pim&&pim.img){ const im=pim.img, z=sc.zoom==="none"?1:sc.zoom==="out"?1.12-.12*rClamp(local/dur):1+.12*rClamp(local/dur);
        const sc0=Math.max(RW/im.naturalWidth,RH/im.naturalHeight)*z, w=im.naturalWidth*sc0, hh=im.naturalHeight*sc0;
        const fx={left:0,center:.5,right:1}[sc.fx||"center"], fy={top:0,center:.5,bottom:1}[sc.fy||"center"];
        ctx.save(); ctx.globalAlpha=Math.min(rEase(local/.35),rClamp((dur-local)/.25)); ctx.drawImage(im,(RW-w)*fx,(RH-hh)*fy,w,hh); ctx.restore(); }
      const g=ctx.createLinearGradient(0,RH*.38,0,RH); g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(.55,"rgba(0,0,0,.55)"); g.addColorStop(1,"rgba(0,0,0,.82)"); ctx.fillStyle=g; ctx.fillRect(0,0,RW,RH);
      const g2=ctx.createLinearGradient(0,0,0,R_ST+200); g2.addColorStop(0,"rgba(0,0,0,.45)"); g2.addColorStop(1,"rgba(0,0,0,0)"); ctx.fillStyle=g2; ctx.fillRect(0,0,RW,R_ST+200); } }
  if(sc.head!==false){ /* шапка */
    const lab=String(sc.label||spec.label||"Дизайн-Радар").toUpperCase();
    cSet(ctx,cFont.semi(32),4); const tw=ctx.measureText(lab).width; ctx.fillStyle=(bg==="orange"?C_INK:A===C_INK&&bg==="ink"?C_OR:A); ctx.fillRect(RM,R_ST+10,tw+48,64);
    ctx.fillStyle=bg==="orange"?C_CREAM:(bg==="ink"&&A===C_CREAM?C_INK:"#fff"); ctx.fillText(lab,RM+24,R_ST+10+16);
    cSet(ctx,cFont.title(32),0); const br="Дизайн-Радар", bw=ctx.measureText(br).width; ctx.fillStyle=full?"#fff":F; ctx.fillText(br,RW-RM-bw,R_ST+22);
    ctx.fillStyle=bg==="orange"?C_INK:C_OR; ctx.beginPath(); ctx.arc(RW-RM-bw-26,R_ST+42,11,0,7); ctx.fill(); }
  ctx.save(); ctx.globalAlpha=Math.min(ins,out); ctx.translate(0,(1-ins)*70);
  const size=R_SIZE[sc.size]||R_SIZE.M, W=RW-2*RM, TW=RW-RM-R_RR;
  const lines=(t,font,lh,track)=>{ cSet(ctx,font,track); const out=[]; const ps=String(t||"").split("\n"); ps.forEach((p,pi)=>{ const ls=cWrap(ctx,cTypo(p,true),TW); (ls.length?ls:[""]).forEach(l=>out.push({l,lh,last:pi===ps.length-1})); }); return out; };
  const place=(h)=> sc.align==="top"?430 : sc.align==="bottom"?Math.max(430,R_SB-h) : Math.max(430,Math.min(R_SB-h,(R_ST+80+R_SB-h)/2));
  if(isPhoto){
    const tc=full?"#fff":F, mc=full?"rgba(255,255,255,.82)":M;
    const tl=lines(sc.title||"", cFont.title(size), Math.round(size*1.0), -2), sl=sc.sub?lines(sc.sub, cFont.body(44), 56, 0):[];
    const cr=sc.credit?String(sc.credit):"";
    if(full){ const bh=(cr?60:0)+sl.length*56+(sl.length?30:0)+tl.length*tl[0].lh; let y=R_SB-bh; if(sc.align==="top") y=430; else if(sc.align==="center") y=Math.max(430,(R_ST+80+R_SB-bh)/2);
      cSet(ctx,cFont.title(size),-2); tl.forEach(ln=>{ ctx.fillStyle=(sc.hl&&ln.last)?(A===C_INK?C_OR:A):tc; ctx.fillText(ln.l,RM,y); y+=ln.lh; });
      if(sl.length){ y+=30; cSet(ctx,cFont.body(44),0); ctx.fillStyle=mc; sl.forEach(l=>{ ctx.fillText(l.l,RM,y); y+=56; }); }
      if(cr){ cSet(ctx,cFont.mono(26),1); ctx.fillStyle="rgba(255,255,255,.7)"; ctx.fillText("ФОТО: "+cr.toUpperCase(),RM,y+30); }
      if(y+(cr?60:0)>R_SB+10) warn.push("текст уходит под подпись Instagram внизу — сократи"); }
    else { const tlh=tl.length*Math.round(Math.min(size,110))+(sl.length?24+sl.length*54:0)+(cr?30:0)+60; const maxPh=Math.max(420,R_SB-430-tlh); let ph=Math.min(820,maxPh);
      if(pim&&pim.img){ const im=pim.img; ph=Math.min(maxPh,Math.round(W*im.naturalHeight/im.naturalWidth)); }
      const top=sc.align==="top"?430:sc.align==="bottom"?Math.max(430,R_SB-tlh-ph):Math.max(430,(R_ST+80+R_SB-tlh-ph)/2);
      ctx.save(); ctx.beginPath(); ctx.roundRect(RM,top,W,ph,40); ctx.clip(); ctx.fillStyle="rgb(220,214,202)"; ctx.fillRect(RM,top,W,ph);
      if(pim&&pim.img){ const im=pim.img, z=sc.zoom==="none"?1:sc.zoom==="out"?1.1-.1*rClamp(local/dur):1+.1*rClamp(local/dur); const k0=Math.max(W/im.naturalWidth,ph/im.naturalHeight)*z, w=im.naturalWidth*k0, hh=im.naturalHeight*k0; ctx.drawImage(im,RM+(W-w)/2,top+(ph-hh)/2,w,hh); }
      ctx.restore(); let y=top+ph+60;
      if(cr){ cSet(ctx,cFont.mono(24),1); ctx.fillStyle=M; ctx.fillText("ФОТО: "+cr.toUpperCase(),RM,top+ph+20); y+=30; }
      cSet(ctx,cFont.title(Math.min(size,110)),-2); tl.forEach(ln=>{ ctx.fillStyle=(sc.hl&&ln.last)?A:tc; ctx.fillText(ln.l,RM,y); y+=Math.round(Math.min(size,110)); });
      if(sl.length){ y+=24; cSet(ctx,cFont.body(42),0); ctx.fillStyle=mc; sl.forEach(l=>{ ctx.fillText(l.l,RM,y); y+=54; }); }
      if(y>R_SB+10) warn.push("текст уходит под подпись Instagram — сократи или выбери «на весь экран»"); }
    if(!pim||pim.st==="loading"){ cSet(ctx,cFont.body(36),0); ctx.fillStyle=full?"rgba(255,255,255,.6)":M; if(sc.src) ctx.fillText("фото загружается…",RM,full?RH/2:520); }
    if(tl.length>5) warn.push("заголовок длиннее 5 строк");
  } else if(sc.type==="ui"){
    const ph=(sc.phases||[]).filter(Boolean).slice(0,3); const n=Math.max(1,ph.length); const k=Math.min(n-1,Math.floor(local/(dur/n))); const p=ph[k]||{}; const pl=local-k*dur/n, pd=dur/n;
    const top=410, ch=R_SB-top-110;
    if(p.tag){ cSet(ctx,cFont.title(46),0); const tw=ctx.measureText(p.tag.toUpperCase()).width; ctx.fillStyle=(k===n-1&&n>1)?A:F; ctx.fillRect(RM,top,tw+44,74); ctx.fillStyle=(k===n-1&&n>1)?(A===C_CREAM?C_INK:"#fff"):B; ctx.fillText(p.tag.toUpperCase(),RM+22,top+14); }
    const y0=top+110; ctx.fillStyle=CARD; ctx.strokeStyle=bg==="cream"?"rgb(216,210,198)":"rgba(0,0,0,.12)"; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect(RM,y0,W,ch,44); ctx.fill(); ctx.stroke();
    const ink=bg==="ink"?C_CREAM:C_INK, soft=bg==="ink"?"rgb(70,67,62)":"rgb(226,220,208)";
    let y=y0+80; const x=RM+70, iw=W-140;
    if(p.head){ const hl=cBlock(ctx,x,y,p.head,cFont.title(64),ink,iw,74,-1,true); y+=hl.h+50; }
    const kind=p.kind||"list";
    if(kind==="list"||kind==="skeleton"){ const sk=kind==="skeleton"; const pulse=sk?.55+.45*Math.sin(local*7):1;
      if(sk&&!p.head){ ctx.fillStyle=soft; ctx.beginPath(); ctx.roundRect(x,y,300,56,28); ctx.fill(); y+=120; }
      for(let i=0;i<(p.caption?3:4);i++){ const yy=y+i*150; const a0=ctx.globalAlpha; if(sk) ctx.globalAlpha=a0*pulse;
        ctx.fillStyle=sk?soft:"rgb(255,211,194)"; ctx.beginPath(); ctx.arc(x+48,yy+48,48,0,7); ctx.fill();
        ctx.fillStyle=sk?soft:ink; ctx.beginPath(); ctx.roundRect(x+140,yy+20,iw*.68,28,14); ctx.fill();
        ctx.fillStyle=sk?soft:"rgb(185,180,171)"; ctx.beginPath(); ctx.roundRect(x+140,yy+66,iw*.42,28,14); ctx.fill(); ctx.globalAlpha=a0; } }
    else { const target=rClamp(Number(String(p.value||"").replace(/[^\d.]/g,""))||68,0,100); const v=Math.round(target*rEase(pl/(pd*.8)));
      ctx.fillStyle=soft; ctx.beginPath(); ctx.roundRect(x,y,iw,36,18); ctx.fill(); ctx.fillStyle=A===C_CREAM?C_OR:A; ctx.beginPath(); ctx.roundRect(x,y,Math.max(36,iw*v/100),36,18); ctx.fill();
      cSet(ctx,cFont.num(150),-4); ctx.fillStyle=ink; ctx.fillText(v+"%",x,y+80);
      if(p.note) cBlock(ctx,x,y+260,p.note,cFont.body(46),bg==="ink"?"rgb(190,182,168)":"rgb(110,104,96)",iw,58,0,true); }
    if(p.caption){ cSet(ctx,cFont.title(50),0); const cl=cWrap(ctx,cTypo(p.caption,true),iw); ctx.fillStyle=p.capColor==="green"?R_ACC.green:p.capColor==="mute"?"rgb(138,132,123)":(A===C_CREAM?C_OR:A);
      cl.forEach((l,i)=>ctx.fillText(l,x,y0+ch-70-(cl.length-i)*60)); if(cl.length>2) warn.push("подпись карточки длиннее 2 строк"); }
    if(p.head&&p.head.length>34) warn.push("заголовок карточки длинный");
  } else if(sc.type==="number"){
    /* цифра: счётчик крупным начертанием, подпись — как заголовок сцены */
    const vs=String(sc.value||"0"); cSet(ctx,cFont.num(100),-2); const w100=ctx.measureText(vs).width||1;
    const ns=Math.max(100,Math.min(Math.round(300*size/R_SIZE.M),Math.floor(100*TW/w100*.97)));
    const ts=Math.round(size*.8), tl=sc.title?lines(sc.title,cFont.title(ts),ts,-2):[];
    const pre=sc.pre?String(sc.pre).toUpperCase():"";
    const h0=(pre?70:0)+ns+(tl.length?40+tl.length*ts:0); let y=place(h0);
    if(pre){ cSet(ctx,cFont.semi(34),4); ctx.fillStyle=A===C_CREAM&&bg==="cream"?C_OR:(bg==="orange"?C_INK:A); ctx.fillText(pre,RM,y); y+=70; }
    const k=rEase((local-.1)/.9); cSet(ctx,cFont.num(ns),-Math.round(ns/50)); ctx.fillStyle=bg==="orange"?C_INK:(A===C_INK&&bg==="ink"?C_OR:A);
    ctx.fillText(rCount(vs,sc.count===false?1:k),RM,y); y+=ns+40;
    const ka=rEase((local-.6)/.4); const a0=ctx.globalAlpha; ctx.globalAlpha=a0*ka; cSet(ctx,cFont.title(ts),-2);
    tl.forEach(ln=>{ ctx.fillStyle=(sc.hl!==false&&ln.last&&tl.length>1)?A:F; if(ctx.fillStyle===C_CREAM&&bg==="cream") ctx.fillStyle=C_OR; ctx.fillText(ln.l,RM,y+(1-ka)*30); y+=ts; }); ctx.globalAlpha=a0;
    if(ns<=100&&w100*1>TW) warn.push("число слишком длинное");
    if(y>R_SB+10) warn.push("текст уходит под подпись Instagram внизу — сократи");
  } else if(sc.type==="swatches"){
    /* цвета: сетка оттенков, выбранный выделяется рамкой */
    const cols=rSwatches(sc), n=cols.length; const ts=Math.round(size*.8), tl=sc.title?lines(sc.title,cFont.title(ts),ts,-2):[];
    let y=430; cSet(ctx,cFont.title(ts),-2); tl.forEach(ln=>{ ctx.fillStyle=(sc.hl!==false&&ln.last&&tl.length>1)?A:F; ctx.fillText(ln.l,RM,y); y+=ts; }); if(tl.length) y+=40;
    const gw=W, areaH=R_SB-y-(sc.pickLabel?110:0); let c=Math.max(3,Math.min(9,Math.ceil(Math.sqrt(n*gw/Math.max(200,areaH)))));
    { let best=c, bs=1e9; for(let q=Math.max(3,c-2);q<=Math.min(10,c+2);q++){ const rw=Math.ceil(n/q), cw0=(gw-(q-1)*12)/q; if(rw*(Math.min(cw0*1.2,(areaH-(rw-1)*12)/rw)+12)>areaH+12) continue; const sc0=(rw*q-n)*3+Math.abs(q-c); if(sc0<bs){ bs=sc0; best=q; } } c=best; }
    const rows=Math.ceil(n/c), gap=12, cw=(gw-(c-1)*gap)/c, ch=Math.min(cw*1.2,(areaH-(rows-1)*gap)/rows);
    const pick=Math.min(n-1,Math.max(0,(Number(sc.pick)||Math.ceil(n*.6))-1)); const fade=rEase((local-Math.max(1.1,dur*.5))/.4);
    cols.forEach((col,i)=>{ const r=Math.floor(i/c), q=i%c; const x=RM+q*(cw+gap), yy=y+r*(ch+gap); const t0=.1+i*Math.min(.035,1/n); const kk=rEase((local-t0)/.3); if(kk<=0) return;
      ctx.save(); ctx.globalAlpha*=kk*(i===pick?1:1-fade*.6); ctx.fillStyle=col; ctx.beginPath(); ctx.roundRect(x,yy+(1-kk)*20,cw,ch,Math.min(16,cw*.16)); ctx.fill();
      if(i===pick&&fade>0){ ctx.lineWidth=8; ctx.strokeStyle=bg==="ink"?C_CREAM:C_INK; ctx.stroke(); } ctx.restore(); });
    if(sc.pickLabel&&fade>0){ const a0=ctx.globalAlpha; ctx.globalAlpha=a0*fade; cSet(ctx,cFont.title(56),-1); ctx.fillStyle=F; ctx.fillText(sc.pickLabel,RM,y+rows*(ch+gap)+30); ctx.globalAlpha=a0; }
  } else if(sc.type==="compare"){
    /* было / стало: две карточки как в сцене «Интерфейс», вторая выезжает справа */
    const ts=Math.round(size*.7), tl=sc.title?lines(sc.title,cFont.title(ts),ts,-2):[];
    let y=420; cSet(ctx,cFont.title(ts),-2); tl.forEach(ln=>{ ctx.fillStyle=F; ctx.fillText(ln.l,RM,y); y+=ts; }); if(tl.length) y+=36;
    const gap=40, ph=(R_SB-y-gap)/2; const ink=bg==="ink"?C_CREAM:C_INK;
    const card=(yy,lab,txt,col,src,last,k)=>{ if(k<=0) return; ctx.save(); ctx.globalAlpha*=k; ctx.translate((1-k)*120,0);
      const fill=rHex(col); ctx.fillStyle=fill||CARD; ctx.strokeStyle=bg==="cream"?"rgb(216,210,198)":"rgba(0,0,0,.12)"; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect(RM,yy,W,ph,44); ctx.fill(); if(!fill) ctx.stroke();
      const im=src?rImg(src):null; if(im&&im.img){ ctx.save(); ctx.beginPath(); ctx.roundRect(RM,yy,W,ph,44); ctx.clip(); const kz=Math.max(W/im.img.naturalWidth,ph/im.img.naturalHeight); const iw=im.img.naturalWidth*kz, ih=im.img.naturalHeight*kz; ctx.drawImage(im.img,RM+(W-iw)/2,yy+(ph-ih)/2,iw,ih);
        const g=ctx.createLinearGradient(0,yy+ph*.35,0,yy+ph); g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(1,"rgba(0,0,0,.72)"); ctx.fillStyle=g; ctx.fillRect(RM,yy,W,ph); ctx.restore(); }
      const L=String(lab||"").toUpperCase(); cSet(ctx,cFont.title(46),0); const tw=ctx.measureText(L).width; ctx.fillStyle=last?A:(fill||im&&im.img?C_INK:ink); ctx.fillRect(RM+50,yy+50,tw+44,74); ctx.fillStyle=last?(A===C_CREAM||A===C_INK&&bg==="ink"?C_INK:"#fff"):(fill||im&&im.img?"#fff":B); ctx.fillText(L,RM+72,yy+64);
      if(txt){ const light=fill&&/^#(f|e|d|c)/i.test(fill); const tc=im&&im.img?"#fff":fill?(light?C_INK:"#fff"):ink; cSet(ctx,cFont.title(68),-1); const ls=cWrap(ctx,cTypo(txt,true),W-110); ctx.fillStyle=tc;
        ls.forEach((l,i)=>ctx.fillText(l,RM+50,yy+ph-50-(ls.length-i)*76)); if(ls.length>3) warn.push("текст «"+(lab||"")+"» длиннее 3 строк"); }
      ctx.restore(); };
    card(y,sc.a_label||"Было",sc.a_text,sc.a_color,sc.a_src,false,1);
    card(y+ph+gap,sc.b_label||"Стало",sc.b_text,sc.b_color,sc.b_src,true,rEase((local-Math.max(.8,dur*.35))/.45));
  } else if(sc.type==="list"){
    /* список: крупные номера 01 02 03, как в каруселях; пункты появляются по одному */
    const items=String(sc.items||"").split("\n").map(x=>x.trim()).filter(Boolean).slice(0,5); const ts=Math.round(size*.8), tl=sc.title?lines(sc.title,cFont.title(ts),ts,-2):[];
    let y=430; cSet(ctx,cFont.title(ts),-2); tl.forEach(ln=>{ ctx.fillStyle=(sc.hl!==false&&ln.last&&tl.length>1)?A:F; ctx.fillText(ln.l,RM,y); y+=ts; }); if(tl.length) y+=50;
    const n=Math.max(1,items.length), slot=(R_SB-y)/n, step=Math.max(.4,(dur-.9)/n), ink=bg==="ink"?C_CREAM:C_INK;
    items.forEach((it,i)=>{ const k=rEase((local-(tl.length?.45:.1)-i*step)/.35); if(k<=0) return; const yy=y+i*slot; const a0=ctx.globalAlpha; ctx.globalAlpha=a0*k;
      const mk=sc.mark||"num"; const no=mk==="no"||(mk==="mix"&&i<n-1); const sym=mk==="num"?String(i+1).padStart(2,"0"):no?"✕":"✓";
      cSet(ctx,cFont.num(96),-3); ctx.fillStyle=mk==="num"?(bg==="orange"?C_INK:A):no?"rgb(190,60,50)":R_ACC.green; ctx.fillText(sym,RM,yy+(1-k)*30);
      cSet(ctx,cFont.title(60),-1); ctx.fillStyle=ink; const ls=cWrap(ctx,cTypo(it,true),TW-170); ls.forEach((l,j)=>ctx.fillText(l,RM+170,yy+14+j*66+(1-k)*30)); if(ls.length*66>slot-10) warn.push("пункт "+(i+1)+" длинный");
      ctx.globalAlpha=a0; });
    if(!items.length) warn.push("добавь пункты — по одному на строку");
  } else {
    const isEnd=sc.type==="end";
    const tl=lines(sc.title||(isEnd?"Дизайн-Радар":""), cFont.title(size), Math.round(size*1.0), -2);
    const sl=sc.sub?lines(sc.sub, cFont.body(46), 58, 0):[];
    const th=tl.length*tl[0].lh, sh=sl.length?sl.length*58+44:0;
    let y=place(th+sh+(isEnd?110:0));
    if(isEnd){ ctx.fillStyle=bg==="orange"?C_INK:C_OR; ctx.beginPath(); ctx.arc(RW/2,y+30,32,0,7); ctx.fill(); y+=110; }
    const words=sc.type==="title"; let wi=0;
    tl.forEach((ln,i)=>{ const last=ln.last; const col=(sc.type==="text"&&sc.hl&&last)||(sc.hl==="all")?A:F;
      cSet(ctx,cFont.title(size),-2); ctx.fillStyle=col===C_CREAM&&bg==="cream"?C_OR:col;
      if(words){ let x=RM; ln.l.split(" ").forEach(w=>{ const k=rEase((local-.15-wi*.18)/.4); wi++; const a0=ctx.globalAlpha; ctx.globalAlpha=a0*k; ctx.fillText(w,x,y+(1-k)*50); ctx.globalAlpha=a0; x+=ctx.measureText(w+" ").width; }); }
      else { const ww=isEnd?ctx.measureText(ln.l).width:0; ctx.fillText(ln.l,isEnd?(RW-ww)/2:RM,y); }
      y+=ln.lh; });
    if(sl.length){ y+=44; const k=words?rEase((local-1)/.5):1; const a0=ctx.globalAlpha; ctx.globalAlpha=a0*k; cSet(ctx,cFont.body(46),0); ctx.fillStyle=M;
      sl.forEach(s=>{ const ww=isEnd?ctx.measureText(s.l).width:0; ctx.fillText(s.l,isEnd?(RW-ww)/2:RM,y); y+=58; }); ctx.globalAlpha=a0; }
    if(tl.length>6) warn.push("заголовок длиннее 6 строк — уменьши размер или текст");
    if(y>R_SB+10) warn.push("текст уходит под подпись Instagram внизу — сократи");
  }
  ctx.restore();
}
function drawReelFrame(ctx, spec, t){
  const sc=spec.scenes||[]; let acc=0; const warn=[];
  for(let i=0;i<sc.length;i++){ const d=rClamp(Number(sc[i].dur)||3,1.5,8); if(t<acc+d||i===sc.length-1){ drawReelScene(ctx,spec,sc[i],Math.min(t-acc,d),d,warn); return {i,warn}; } acc+=d; }
  ctx.fillStyle=C_CREAM; ctx.fillRect(0,0,RW,RH); return {i:-1,warn};
}
function reelSceneStart(spec,i){ let a=0; for(let k=0;k<i;k++) a+=rClamp(Number(spec.scenes[k].dur)||3,1.5,8); return a; }
function reelThumb(spec,i,cv){ const c=document.createElement("canvas"); c.width=RW; c.height=RH; const ctx=c.getContext("2d"); ctx.textBaseline="top";
  const sc=spec.scenes[i], d=rClamp(Number(sc.dur)||3,1.5,8); const w=[]; drawReelScene(ctx,spec,sc,sc.type==="ui"?Math.min(d-.4,d/((sc.phases||[]).length||1)*.6):/^(number|swatches|compare|list)$/.test(sc.type)?d-.35:Math.min(d-.4,2.2),d,w);
  if(cv) cv.getContext("2d").drawImage(c,0,0,cv.width,cv.height); return w; }

function reelBlank(type){
  if(type==="number") return {type:"number",dur:2.8,bg:"cream",accent:"orange",size:"M",pre:"",value:"228",title:"дней на\nдве линии",hl:true};
  if(type==="swatches") return {type:"swatches",dur:3.4,bg:"cream",accent:"orange",size:"M",title:"41 оттенок синего",from:"#0b1f6b",to:"#7fb2ff",count:41,pick:28,pickLabel:"Победил этот"};
  if(type==="compare") return {type:"compare",dur:3.6,bg:"cream",accent:"orange",size:"M",title:"",a_label:"Было",a_text:"Что было",b_label:"Стало",b_text:"Что стало"};
  if(type==="list") return {type:"list",dur:3.8,bg:"cream",accent:"orange",size:"M",title:"Что взять себе",items:"Первое\nВторое\nТретье",mark:"num"};
  if(type==="photo") return {type:"photo",dur:3,layout:"full",zoom:"in",size:"M",src:"",title:"",sub:"",credit:"",hl:false,bg:"ink",accent:"orange"};
  if(type==="ui") return {type:"ui",dur:5.5,bg:"cream",accent:"orange",phases:[{tag:"Было",head:"Заголовок экрана",kind:"list",caption:"Подпись"},{tag:"Стало",head:"",kind:"skeleton",caption:"Подпись"}]};
  if(type==="text") return {type:"text",dur:3,bg:"cream",accent:"orange",size:"M",title:"Главная мысль\nвторой строкой",hl:true};
  if(type==="end") return {type:"end",dur:2.2,bg:"cream",accent:"orange",size:"M",title:"Дизайн-Радар",sub:"@designradar_lab · разбор целиком в канале"};
  return {type:"title",dur:3,bg:"cream",accent:"orange",size:"L",title:"Заголовок",sub:""};
}
function reelFromPost(d){
  const ph=reelPhotos(d);
  if(ph.length){ const t=plain(d.cover_title||d.title).replace(/\|/g," ").slice(0,60);
    return {label:d.label||d.section||"Дизайн-Радар", scenes:[...ph.slice(0,4).map((p,i)=>({...reelBlank("photo"), src:p.url, credit:p.cap, title:i===0?t:"", dur:i===0?3.2:2.6})), reelBlank("end")]}; }
  return {label:d.label||d.section||"Дизайн-Радар", scenes:[
    {...reelBlank("title"), title:plain(d.cover_title||d.title).replace(/\|/g," ").slice(0,60), sub:""},
    {...reelBlank("text"), title:plain(String(d.full_text||"").split(/\n+/).find(x=>x.trim().length>20)||"").slice(0,90)},
    reelBlank("end")]};
}
async function genReel(d, wish){
  const ph=reelPhotos(d); const lab=String(d.label||d.section||"");
  const kind=(/Находка|Разбор|Ребрендинг/i.test(lab)||(d.kind==="news"&&ph.length))&&ph.length?"photo":/Мысль/i.test(lab)?"thought":"craft";
  const meta=d.photo_meta||{};
  const photos=ph.length?ph.map((p,i)=>{ const m=meta[p.orig||p.url]||{}; return "  "+(i+1)+") фото "+(i+1)+(i===0?" — главное фото поста":"")+(m.what?": "+m.what:"")+(m.text_on_photo?" [НА ФОТО ЕСТЬ СВОЙ КРУПНЫЙ ТЕКСТ — ставь его карточкой (layout \"card\") или не первым]":"")+(m.orientation?" ["+m.orientation+"]":"")+(p.cap?" (автор: "+p.cap+")":""); }).join("\n"):"  нет";
  const plans={
    photo:"Это пост о реальной работе — рилс строится НА ФОТО ПОСТА. Схема: 1) photo — самое сильное фото на весь экран и крючок, который хочется досмотреть (факт или парадокс из поста); 2–3) photo — другие фото, каждое с одним фактом или деталью из поста (что сделали, для кого, какой приём); 4) text — вердикт редакции в 1–2 строках; 5) end. Если фото меньше трёх — повтори фото с другим кадрированием (fx/fy) или замени сцену на text. Не используй ui.",
    craft:"Это пост о приёме. Схема: 1) title — крючок; 2) ui — экраны показывают ИМЕННО приём этого поста (плашки, заголовки экранов и подписи — из этого поста, не придумывай чужую тему); 3) text — правило или вывод; 4) end. Если у поста есть фото — можешь заменить ui на photo.",
    thought:"Это короткая мысль. Схема: 2–3 сцены text, каждая — одна фраза мысли, последняя с выводом; потом end. Никакого ui."};
  const prompt=TEXT_RULES+"\n\nСделай сценарий вертикального видео (рилс, 10–16 секунд) по ЭТОМУ посту канала «Дизайн-Радар». Видео рисуется кодом из сцен: ты пишешь тексты и выбираешь сцены.\n\nПОСТ:\nЗаголовок: "+d.title+"\nРубрика: "+lab+"\nТекст:\n"+String(d.full_text||"").slice(0,3200)+"\n\nФОТО ПОСТА:\n"+photos+(wish?"\n\nПОЖЕЛАНИЕ РЕДАКТОРА: "+wish:"")+
  "\n\nСНАЧАЛА сформулируй одну мысль рилса одной фразой (поле idea) — каждая сцена работает на неё по порядку: зацепить → показать → объяснить → вердикт → в канал. Все факты, цифры и имена — только из текста поста выше; ничего не бери из других тем и примеров.\nСХЕМА ДЛЯ ЭТОГО ПОСТА: "+plans[kind]+
  "\n\nПОКАЗЫВАЙ ФАКТЫ КАРТИНКОЙ, где это есть в посте: яркая цифра → number (счётчик), цвета и оттенки → swatches, «было/стало» или «плохо/хорошо» → compare, 3+ правила, ошибки или шага → list. Каждая такая сцена — вместо абзаца текста, а не в дополнение. Не больше 6 сцен.\n\nТИПЫ СЦЕН:\n- number: {type:\"number\", pre (необяз., 1–4 слова над числом), value (число с единицей, как в посте: «41», «+200 млн $», «228 дней», до 12 знаков), title (что значит число, до 50 знаков, строки через \\n)}\n- swatches: {type:\"swatches\", title (до 40 знаков), colors (hex через пробел, 6–48) ИЛИ from/to (hex) + count, pick (номер выделенного, с 1), pickLabel (до 26 знаков)}\n- compare: {type:\"compare\", title (необяз., до 40), a_label (1–2 слова: «Было», «Плохо»), a_text (до 45 знаков), a_color (необяз. hex), a_photo (необяз. номер фото), b_label, b_text, b_color, b_photo}\n- list: {type:\"list\", title (до 35 знаков), items (2–4 пункта через \\n, каждый до 40 знаков), mark: \"num\"|\"ok\"|\"no\"|\"mix\"}\n- photo: {type:\"photo\", photo: номер фото из списка, layout: \"full\"|\"card\" (card — для горизонтальных фото и фото со своим текстом), title (до 50 знаков, строки через \\n), sub (до 80, необязательно), hl: true если последнюю строку выделить цветом, fx: \"left\"|\"center\"|\"right\", fy: \"top\"|\"center\"|\"bottom\" (кадрирование), zoom: \"in\"|\"out\"}\n- title: {type:\"title\", title (крючок до 45 знаков), sub (до 90, необязательно)}\n- ui: {type:\"ui\", phases:[1–3 × {tag (до 14 знаков), head (до 30), kind: \"list\"|\"skeleton\"|\"progress\", value (для progress, 1–100), note (для progress, до 20), caption (до 28)}]}\n- text: {type:\"text\", title (до 80 знаков, строки через \\n, последняя выделится), bg: \"cream\"|\"ink\"|\"orange\"}\n- end: {type:\"end\", title:\"Дизайн-Радар\", sub (до 50, зови в канал по теме поста)}\nУ каждой сцены dur в секундах: photo 2.5–3.5, title 2.5–3, number 2.5–3, swatches 3–4, compare 3.5–4, list 3.5–4.5, ui 4–6, text 2.5–3.5, end 2. Голос — живой, коротко, как в канале.\nОтветь только JSON: {\"idea\":\"…\",\"label\":\"рубрика 1–2 слова\",\"scenes\":[…]}";
  const v=await sample.json(prompt,{modelTier:"complex",cache:false});
  if(!v||!Array.isArray(v.scenes)||!v.scenes.length) throw {message:"Claude вернул сценарий не в том виде. Попробуй ещё раз."};
  const cr=(ph[0]&&ph[0].cap)||"";
  v.scenes=v.scenes.slice(0,7).map(s0=>{ const t=R_TYPES.some(x=>x[0]===s0.type)?s0.type:"text"; const o={...reelBlank(t), ...s0, type:t};
    if(t==="photo"){ const n=Math.max(1,Math.min(ph.length,Number(s0.photo)||1)); const p=ph[n-1]; if(!p) return {...reelBlank("text"), title:String(s0.title||"")}; o.src=p.url; o.credit=p.cap||cr; delete o.photo; }
    if(t==="ui") o.phases=Array.isArray(s0.phases)?s0.phases.slice(0,3):reelBlank("ui").phases; else delete o.phases;
    if(t==="compare") ["a","b"].forEach(k=>{ const n=Number(s0[k+"_photo"]); if(n&&ph[n-1]) o[k+"_src"]=ph[n-1].url; delete o[k+"_photo"]; });
    if(Array.isArray(o.items)) o.items=o.items.join("\n"); if(Array.isArray(o.colors)) o.colors=o.colors.join(" ");
    return o; });
  return {idea:String(v.idea||""), label:String(v.label||lab||""), scenes:v.scenes};
}

async function recordReel(spec, onProgress){
  await carFonts();
  const phs=[].concat(...(spec.scenes||[]).map(x=>x.type==="photo"?[x.src]:x.type==="compare"?[x.a_src,x.b_src]:[])).filter(Boolean).map(u=>rImg(u));
  for(let i=0;i<40&&phs.some(e=>e.st==="loading");i++) await new Promise(r=>setTimeout(r,250));
  if(phs.some(e=>e.st!=="ok")) throw {message:"Какое-то фото не открылось. Выбери в сцене другое фото или загрузи своё."};
  if(phs.some(e=>!e.clean)) throw {message:"Сайт источника не разрешает записывать его фото в видео: в превью они видны, а в запись не попадут. В сценах с фото нажми «Своё фото» и загрузи картинку (например, из чата с ботом или сохранённую с сайта)."};
  if(typeof MediaRecorder==="undefined") throw {message:"Этот браузер не умеет записывать видео. Открой панель в Chrome или Safari."};
  const c=document.createElement("canvas"); c.width=RW; c.height=RH; const ctx=c.getContext("2d"); ctx.textBaseline="top";
  const types=["video/mp4;codecs=avc1.42E01E","video/mp4;codecs=avc1","video/mp4","video/webm;codecs=vp9","video/webm"];
  const mime=types.find(t=>{ try{ return MediaRecorder.isTypeSupported(t); }catch(_){ return false; } })||"";
  drawReelFrame(ctx,spec,0);
  const stream=c.captureStream(30); const rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:6e6}:{videoBitsPerSecond:6e6});
  const chunks=[]; rec.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
  const total=reelDur(spec)+.2;
  const done=new Promise(ok=>{ rec.onstop=ok; });
  rec.start(250); const t0=performance.now();
  await new Promise(ok=>{ const step=()=>{ const t=(performance.now()-t0)/1000; ctx.textBaseline="top"; drawReelFrame(ctx,spec,Math.min(t,total-.21)); if(onProgress) onProgress(Math.min(1,t/total)); if(t<total) requestAnimationFrame(step); else ok(); }; requestAnimationFrame(step); });
  rec.stop(); await done; stream.getTracks().forEach(tr=>tr.stop());
  const type=(rec.mimeType||mime||"video/webm").split(";")[0];
  return new Blob(chunks,{type});
}

/* редактор рилса внутри редактора поста */
const IG_TG="t.me/designradar_lab";
async function genIgCaption(d, spec, wish){
  const lab=String(d.label||d.section||"");
  const prompt=TEXT_RULES+"\n\nНапиши подпись к рилсу в Instagram по ЭТОМУ посту канала «Дизайн-Радар». ГЛАВНАЯ ЦЕЛЬ — чтобы зритель перешёл в Telegram-канал. Подпись — не пересказ поста, а крючок с недосказанностью.\n\nПОСТ:\nЗаголовок: "+d.title+"\nРубрика: "+lab+"\nТекст:\n"+String(d.full_text||"").slice(0,3200)+(spec&&spec.idea?"\n\nМЫСЛЬ РИЛСА: "+spec.idea:"")+(wish?"\n\nПОЖЕЛАНИЕ РЕДАКТОРА: "+wish:"")+
  "\n\nПРАВИЛА:\n- Всего 180–350 знаков без хэштегов. Коротко.\n- Строка 1 — крючок до 90 знаков: цифра, парадокс или вопрос из поста. Её видно до кнопки «ещё».\n- Строки 2–3 — один-два факта, которых нет в видео. Вывод, вердикт и совет НЕ раскрывай — они ждут в Telegram.\n- Якорь на канал отдельной строкой, с причиной перейти именно по теме поста, например: «Чем это полезно тебе в работе — разобрали в Telegram 👉 "+IG_TG+" (ссылка в шапке профиля)». Адрес канала пиши ровно так: "+IG_TG+". Не пиши @designradar_lab — в Instagram это ссылка на сам Instagram-профиль, а не на Telegram.\n- Если это чужая работа — строка «Работа: <автор/студия>».\n- В конце 3–5 хэштегов на русском одной строкой.\n- Без markdown, звёздочек и ссылок в скобках; эмодзи не больше двух. Все факты — только из поста.\nОтветь только JSON: {\"caption\":\"…\"}";
  const v=await sample.json(prompt,{modelTier:"complex",cache:false});
  const c=v&&String(v.caption||"").trim(); if(!c) throw {message:"Claude не вернул подпись. Попробуй ещё раз."};
  return c.replace(/\*\*|__/g,"").replace(/@designradar_lab/g,IG_TG);
}
function igCaptionBox(d, spec, ro, commit){
  const ta=h("textarea",{rows:7,readonly:ro,placeholder:"Подпись к рилсу для Instagram: крючок, пара фактов и якорь на Telegram-канал"}); ta.value=spec.ig_caption||"";
  const cnt=h("span",{class:"hint"}); const upd=()=>{ const t=ta.value; const body=t.replace(/(^|\s)#\S+/g,"").trim(); cnt.textContent=t?body.length+" знаков без хэштегов"+(t.includes(IG_TG)?"":" · ⚠ нет ссылки на канал"):""; };
  ta.addEventListener("input",()=>{ spec.ig_caption=ta.value; commit(); upd(); }); upd();
  const wi=h("input",{type:"text",placeholder:"Пожелание: «начни с вопроса», «ещё короче»…"});
  const gen=(!ro&&sample)?h("button",{type:"button",class:"btn sm aibtn",onclick:async()=>{ const was=gen.textContent; gen.disabled=true; gen.textContent="Claude пишет…";
      try{ ta.value=spec.ig_caption=await genIgCaption(d,spec,wi.value.trim()); commit(); upd(); }catch(er){ toast((er&&er.message)||"Не получилось"); } finally{ gen.disabled=false; gen.textContent=spec.ig_caption?"✦ Переписать":was; } }},spec.ig_caption?"✦ Переписать":"✦ Написать подпись"):null;
  const cp=h("button",{type:"button",class:"btn sm",onclick:()=>{ if(ta.value.trim()) copyText(ta.value); else toast("Подпись пустая"); }},"Копировать");
  return h("div",{class:"fld rig"}, h("label",{text:"Подпись для Instagram — ведёт в Telegram"}), ta, cnt, ro?h("div",{class:"acts"},cp):h("div",{class:"airow rwish"}, wi, gen, cp));
}
function reelEditor(d, o){
  const {ro, changed}=o;
  const box=h("section",{class:"sec reelsec"});
  let spec=d.reel?JSON.parse(JSON.stringify(d.reel)):null;
  let lastBlob=null; let raf=0, playing=true, t0=performance.now(), pv=null, pctx=null, thumbs=[], tT=null;
  const impSt=h("div",{class:"hint rimp",hidden:true}); let importing=false;
  const ensurePhotos=async()=>{ if(importing||ro||!spec) return; d.photo_assets=d.photo_assets||{};
    const srcs=[].concat(...spec.scenes.map(x=>x.type==="photo"?[x.src]:x.type==="compare"?[x.a_src,x.b_src]:[])); const ext=[...new Set(srcs.filter(rIsExt))]; if(!ext.length) return;
    const todo=ext.filter(u=>!d.photo_assets[u]); importing=true;
    try{ for(let i=0;i<todo.length;i++){ impSt.hidden=false; impSt.textContent="Переношу фото источника в панель "+(i+1)+" из "+todo.length+"… (Make, ~3 операции на фото, один раз)"; d.photo_assets[todo[i]]=await importPhoto(todo[i]); }
      spec.scenes.forEach(x=>{ ["src","a_src","b_src"].forEach(k=>{ if(x[k]&&d.photo_assets[x[k]]) x[k]=d.photo_assets[x[k]]; }); }); impSt.hidden=true; commit(); draw(); }
    catch(e){ impSt.hidden=false; impSt.textContent=((e&&e.message)||"Фото не перенеслось")+" — загрузи фото вручную кнопкой «Своё фото»."; }
    finally{ importing=false; } };
  const PHOTO_TRIG="trig_01SsdLvWh9WAW64p8KrsoxKp";
  const photoBar=h("div",{class:"rphotobar"}); let pollT=null;
  const drawPhotoBar=()=>{ const r=d.photo_request||{}; const n=reelPhotos(d).length;
    const wi=h("input",{type:"text",placeholder:"Что найти: «вывески и навигация», «упаковка крупно»… (необязательно)"});
    const go=h("button",{type:"button",class:"btn sm aibtn",disabled:ro||r.status==="requested",onclick:async()=>{ go.disabled=true;
      try{ d.photo_request={status:"requested",wish:wi.value.trim(),at:Date.now(),by:S.me||""}; await savePost(d.id,{photo_request:d.photo_request});
        await mcp.callTool(CCR,"update_trigger",{trigger_id:PHOTO_TRIG,run_once_at:new Date(Date.now()+60e3).toISOString().replace(/\.\d{3}Z$/,"Z"),enabled:true}); drawPhotoBar(); poll(); }
      catch(e){ const c=e&&e.code; toast((c==="approval_required"||c==="not_granted")?"Разреши панели доступ к Claude Code Remote и нажми ещё раз.":"Не получилось запустить поиск: "+((e&&e.message)||"")); go.disabled=false; } }},r.status==="requested"?"Claude ищет фото…":"✦ Claude найдёт фото");
    const msg=r.status==="requested"?"Ищу фото работы на сайте источника, у студии и на отраслевых сайтах. Обычно 3–10 минут — можно закрыть пост, фото появятся сами.":r.status==="done"?"Нашёл новых фото: "+(r.found||0)+". "+(r.note||""):r.status==="none"?"Не нашёл: "+(r.note||""):"Фото у поста: "+n+". Claude может поискать ещё — бесплатно, только ссылки.";
    photoBar.replaceChildren(h("div",{class:"hint",text:msg}), ro?null:h("div",{class:"airow rwish"}, r.status==="requested"?null:wi, go)); };
  const poll=()=>{ clearInterval(pollT); if((d.photo_request||{}).status!=="requested") return;
    pollT=setInterval(()=>{ if(!box.isConnected){ clearInterval(pollT); return; } const p=S.posts.find(x=>x.id===d.id); const r=p&&p.photo_request;
      if(r&&r.status!=="requested"){ clearInterval(pollT); d.photo_request=r; d.photo_urls=p.photo_urls||d.photo_urls; d.photo_meta=p.photo_meta||d.photo_meta; drawPhotoBar(); draw(); toast(r.status==="done"?"Claude нашёл фото: "+(r.found||0):"Claude не нашёл фото"); } },15000); };
  const commit=()=>{ d.reel=spec; changed(); clearTimeout(tT); tT=setTimeout(redrawThumbs,250); };
  const stop=()=>{ cancelAnimationFrame(raf); raf=0; };
  const loop=()=>{ if(!pv||!pv.isConnected){ stop(); return; } const tot=reelDur(spec); const t=playing?((performance.now()-t0)/1000)%tot:pv._t||0; pv._t=t;
    pctx.setTransform(1,0,0,1,0,0); pctx.clearRect(0,0,pv.width,pv.height); pctx.setTransform(pv.width/RW,0,0,pv.height/RH,0,0); pctx.textBaseline="top"; const r=drawReelFrame(pctx,spec,t); if(R_SHOW_SAFE) drawSafeZones(pctx);
    if(bar) bar.style.width=(t/tot*100)+"%"; if(curScene!==r.i){ curScene=r.i; thumbs.forEach((th,i)=>th&&th.card.classList.toggle("on",i===r.i)); }
    if(rImgTick!==seenTick){ seenTick=rImgTick; clearTimeout(tT); tT=setTimeout(redrawThumbs,120); }
    raf=requestAnimationFrame(loop); };
  let bar=null, curScene=-1, seenTick=-1;
  const jump=(i)=>{ t0=performance.now()-(reelSceneStart(spec,i)+.05)*1000; if(!playing){ pv._t=reelSceneStart(spec,i)+.9; } };
  const redrawThumbs=async()=>{ await carFonts(); thumbs.forEach((th,i)=>{ if(!th||!spec.scenes[i]) return; const w=reelThumb(spec,i,th.cv); th.w.textContent=w.length?"⚠ "+w.join(", "):""; th.w.hidden=!w.length; }); };
  const seg=(obj,key,opts,lab,def,after)=>{ const wrap=h("div",{class:"rseg"}); const draw=()=>wrap.replaceChildren(h("span",{class:"rsl",text:lab}),...opts.map(([v,t])=>h("button",{type:"button",class:"chipb"+(((obj[key]??def)===v)?" on":""),disabled:ro,onclick:()=>{ obj[key]=v; commit(); if(after) after(); else draw(); }},t))); draw(); return wrap; };
  const fld=(obj,key,lab,ph,area,rows)=>{ const e=area?h("textarea",{rows:rows||2,placeholder:ph||"",readonly:ro}):h("input",{type:"text",placeholder:ph||"",readonly:ro}); e.value=obj[key]??""; e.addEventListener("input",()=>{ obj[key]=e.value; commit(); }); return h("div",{class:"fld"},h("label",{text:lab}),e); };
  const design=(sc)=>h("div",{class:"rdesign"},
    (sc.type==="photo"&&sc.layout!=="card")?null:seg(sc,"bg",[["cream","Светлый"],["ink","Тёмный"],["orange","Оранжевый"]],"Фон","cream"),
    seg(sc,"accent",[["orange","Оранжевый"],["green","Зелёный"],["blue","Синий"],["ink","Чёрный"]],"Акцент","orange"),
    sc.type==="ui"?null:seg(sc,"size",[["S","S"],["M","M"],["L","L"]],"Текст","M"),
    seg(sc,"align",[["top","Выше"],["center","Центр"],["bottom","Ниже"]],"Место","center"),
    seg(sc,"head",[[true,"Шапка"],[false,"Без шапки"]],"Верх",true),
    (()=>{ const r=h("input",{type:"range",min:"1.5",max:"8",step:"0.5",value:String(sc.dur||3),disabled:ro}); const v=h("b",{text:(sc.dur||3)+" с"}); r.addEventListener("input",()=>{ sc.dur=Number(r.value); v.textContent=r.value+" с"; commit(); }); return h("div",{class:"rseg"},h("span",{class:"rsl",text:"Длительность"}),r,v); })());
  const photoPick=(sc,redraw,key,lab)=>{ key=key||"src"; const list=reelPhotos(d); if(sc[key]&&!list.some(p=>p.url===sc[key])) list.push({url:sc[key],cap:sc.credit||""});
    const row=h("div",{class:"rpick"});
    list.forEach(p=>{ const im=h("img",{src:R_LOCAL.get(p.url)||p.url,alt:"",referrerpolicy:"no-referrer",loading:"lazy"}); im.addEventListener("error",()=>{ im.replaceWith(h("span",{class:"rpfail",text:"не открылось"})); });
      row.append(h("button",{type:"button",class:"rph"+(sc[key]===p.url?" on":""),disabled:ro,title:p.cap||"",onclick:()=>{ sc[key]=(key!=="src"&&sc[key]===p.url)?"":p.url; if(key==="src"&&!sc.credit&&p.cap) sc.credit=p.cap; commit(); redraw(); ensurePhotos(); }},im)); });
    if(!ro){ const inp=h("input",{type:"file",accept:"image/*",hidden:true}); inp.addEventListener("change",async()=>{ const f=inp.files&&inp.files[0]; if(!f) return; const blobUrl=URL.createObjectURL(f);
        sc[key]=blobUrl; commit(); redraw();
        if(assets){ try{ const r=await assets.upload(f); R_LOCAL.set(r.url,blobUrl); sc[key]=r.url; commit(); redraw(); }catch(e){ toast("Фото не сохранилось в панели — оно останется только до закрытия вкладки"); } } });
      row.append(h("button",{type:"button",class:"rph add",onclick:()=>inp.click()},"+ Своё фото"), inp); }
    return h("div",{class:"fld"}, h("label",{text:lab||(list.length?"Фото — выбери или загрузи своё":"У поста нет фото по ссылке — загрузи своё")}), row); };
  const phaseFields=(sc,j,redraw)=>{ const p=sc.phases[j];
    return h("div",{class:"rphase"}, h("div",{class:"rphh"}, h("b",{text:"Экран "+(j+1)}), ro?null:h("span",{class:"sp"}),
        (!ro&&sc.phases.length>1)?h("button",{type:"button",class:"btn sm ghost danger",onclick:()=>{ sc.phases.splice(j,1); commit(); redraw(); }},"Убрать"):null),
      h("div",{class:"row2"}, fld(p,"tag","Плашка сверху","до 1 с"), fld(p,"head","Заголовок экрана","Заказы")),
      seg(p,"kind",R_KINDS,"Что на экране","list",redraw),
      p.kind==="progress"?h("div",{class:"row2"}, fld(p,"value","Процент","68"), fld(p,"note","Под процентом","ещё 12 с")):null,
      fld(p,"caption","Подпись внизу экрана","Честный срок"),
      seg(p,"capColor",[["acc","Акцент"],["green","Зелёная"],["mute","Серая"]],"Цвет подписи","acc")); };
  const draw=()=>{
    stop(); thumbs=[];
    if(!spec){ box.replaceChildren(h("div",{class:"sech"},h("h4",{text:"Рилс"}),h("span",{text:"вертикальное видео 1080×1920 по посту"})),
        h("p",{class:"hint",text:(reelPhotos(d).length?"У поста есть фото ("+reelPhotos(d).length+") — Claude построит рилс на них. ":"")+"Короткое видео на 10–15 секунд из нескольких сцен. Каждую сцену можно переписать и перекрасить — превью играет сразу."}),
        photoBar, ro?null:h("div",{class:"acts"}, sample?h("button",{type:"button",class:"btn aibtn",onclick:async(e)=>{ const b=e.currentTarget; b.disabled=true; b.textContent="Claude пишет сценарий…"; try{ spec=await genReel(d,""); commit(); draw(); }catch(er){ toast((er&&er.message)||"Не получилось"); b.disabled=false; b.textContent="✦ Сделать рилс из текста"; } }},"✦ Сделать рилс из текста"):null,
          h("button",{type:"button",class:"btn",onclick:()=>{ spec=reelFromPost(d); commit(); draw(); }},reelPhotos(d).length?"Простой рилс из фото":"Простой рилс из заголовка"))); return; }
    pv=h("canvas",{class:"reelpv",width:"360",height:"640"}); pctx=pv.getContext("2d");
    bar=h("i"); const play=h("button",{type:"button",class:"btn sm",onclick:()=>{ playing=!playing; if(playing) t0=performance.now()-(pv._t||0)*1000; play.textContent=playing?"❚❚ Пауза":"▶ Играть"; }},"❚❚ Пауза");
    const st=h("div",{class:"hint"}); const out=h("div",{class:"reelout"});
    const saveVideo=async(btn)=>{ btn.disabled=true; try{
        let blob=lastBlob; if(!blob){ st.textContent="Готовлю файл…"; const r=await fetch(d.reel_video_url); if(!r.ok) throw {message:"Не получилось взять видео — собери его ещё раз"}; blob=await r.blob(); }
        if(!downloads) throw {message:"Скачивание недоступно в этом окне — открой панель в браузере на claude.ai"};
        const ext=/webm/.test(blob.type||d.reel_video_type||"")?"webm":"mp4";
        await downloads.save({filename:"reel_"+String(d.id||"post").replace(/[^A-Za-z0-9_-]/g,"_")+"."+ext, data:blob}); st.textContent="Видео сохранено."; }
      catch(e){ st.textContent=e&&e.code==="declined"?"Скачивание отменено.":e&&e.code==="rate_limited"?"Окно сохранения уже открыто — подожди секунду.":((e&&e.message)||"Не получилось скачать"); }
      finally{ btn.disabled=false; } };
    const showVideo=()=>{ out.replaceChildren(); if(d.reel_video_url){ const sb=h("button",{type:"button",class:"btn sm",onclick:()=>saveVideo(sb)},"Скачать видео"); out.append(h("video",{src:d.reel_video_url,controls:true,playsinline:true,class:"reelvid"}), sb); } };
    const rec=ro?null:h("button",{type:"button",class:"btn accent",onclick:async()=>{ rec.disabled=true; try{ st.textContent="Записываю видео… это столько же секунд, сколько длится рилс. Не закрывай вкладку.";
        const blob=lastBlob=await recordReel(spec,p=>{ st.textContent="Записываю видео… "+Math.round(p*100)+"%"; });
        const ext=/mp4/.test(blob.type)?"mp4":"webm";
        if(assets){ st.textContent="Сохраняю видео…"; const r=await assets.upload(new File([blob],"reel_"+(d.id||Date.now())+"."+ext,{type:blob.type})); d.reel_video_url=r.url; d.reel_video_asset=r.id||""; d.reel_video_type=blob.type; d.reel_video_at=Date.now(); changed(); }
        else { d.reel_video_url=URL.createObjectURL(blob); }
        showVideo(); st.textContent=ext==="mp4"?"Готово: MP4 "+Math.round(blob.size/1024)+" КБ.":"Готово, но этот браузер записал WebM — для Telegram лучше записать в Safari или новом Chrome."; }
      catch(e){ st.textContent=(e&&e.message)||"Не получилось записать видео"; } finally{ rec.disabled=false; } }},"Собрать видео");
    const head=h("div",{class:"sech"},h("h4",{text:"Рилс"}),h("span",{text:spec.scenes.length+" сцен · "+reelDur(spec).toFixed(1).replace(".0","")+" с"}));
    const top=h("div",{class:"reeltop"}, h("div",{class:"reelpvw"}, pv, h("div",{class:"reelbar"},bar)),
      h("div",{class:"reelside"}, fld(spec,"label","Плашка в шапке (для всех сцен)","Крафт"), h("div",{class:"acts"}, play, rec, (()=>{ const sb=h("button",{type:"button",class:"btn sm ghost",onclick:()=>{ R_SHOW_SAFE=!R_SHOW_SAFE; sb.textContent=R_SHOW_SAFE?"Скрыть зоны Instagram":"Зоны Instagram"; }},R_SHOW_SAFE?"Скрыть зоны Instagram":"Зоны Instagram"); return sb; })()), st, out,
        spec.idea?h("div",{class:"ridea"}, h("b",{text:"Мысль рилса: "}), spec.idea):null,
        igCaptionBox(d, spec, ro, commit),
        (!ro&&sample)?(()=>{ const wi=h("input",{type:"text",placeholder:"Пожелание: «начни с цифры 228», «больше про дугу в логотипе»…"}); return h("div",{class:"airow rwish"}, wi, h("button",{type:"button",class:"btn sm aibtn",onclick:async(e)=>{ const b=e.currentTarget; b.disabled=true; b.textContent="Claude думает…"; try{ { const keep=spec&&spec.ig_caption; spec=await genReel(d,wi.value.trim()); if(keep) spec.ig_caption=keep; } commit(); draw(); }catch(er){ toast((er&&er.message)||"Не получилось"); b.disabled=false; b.textContent="✦ Новый сценарий"; } }},"✦ Новый сценарий")); })():null,
        ro?null:h("button",{type:"button",class:"btn sm ghost danger",onclick:()=>{ spec=null; d.reel=null; changed(); draw(); }},"Удалить рилс")));
    const list=h("div",{class:"cards"}); const n=spec.scenes.length;
    spec.scenes.forEach((sc,i)=>{
      const cv=h("canvas",{class:"rthumb",width:"108",height:"192"}); const w=h("div",{class:"cwarn",hidden:true});
      const body=h("div",{class:"cbody"}); const redraw=()=>{ fill(); redrawThumbs(); };
      const fill=()=>{ const f=[];
        f.push(seg(sc,"type",R_TYPES,"Тип сцены","title",()=>{ const nb=reelBlank(sc.type); Object.keys(nb).forEach(k=>{ if(sc[k]==null||sc[k]==="") sc[k]=nb[k]; }); if(sc.type==="ui"&&!(sc.phases&&sc.phases.length)) sc.phases=reelBlank("ui").phases; if(sc.type==="photo"&&!sc.src){ const p=reelPhotos(d)[0]; if(p){ sc.src=p.url; sc.credit=sc.credit||p.cap; } sc.layout=sc.layout||"full"; } redraw(); }));
        if(sc.type==="ui"){ if(!Array.isArray(sc.phases)||!sc.phases.length) sc.phases=reelBlank("ui").phases; sc.phases.forEach((_,j)=>f.push(phaseFields(sc,j,redraw)));
          if(!ro&&sc.phases.length<3) f.push(h("button",{type:"button",class:"btn sm",onclick:()=>{ sc.phases.push({tag:"",head:"",kind:"list",caption:""}); commit(); redraw(); }},"+ Экран")); }
        else if(sc.type==="number"){ f.push(fld(sc,"pre","Над числом","необязательно: «Google, 2009»")); f.push(fld(sc,"value","Число","41 · +200 млн $ · 228 дней")); f.push(fld(sc,"title","Что значит число","Новая строка — Enter",true,2));
          f.push(seg(sc,"hl",[[true,"Последняя строка"],[false,"Без выделения"]],"Цветом акцента",true)); }
        else if(sc.type==="swatches"){ f.push(fld(sc,"title","Заголовок","41 оттенок синего",true,2)); f.push(fld(sc,"colors","Цвета — hex через пробел (или оставь пустым и задай переход ниже)","#1a73e8 #2962ff …",true,2));
          f.push(h("div",{class:"row2"}, fld(sc,"from","От цвета","#0b1f6b"), fld(sc,"to","До цвета","#7fb2ff"))); f.push(h("div",{class:"row2"}, fld(sc,"count","Сколько оттенков","41"), fld(sc,"pick","Какой выделить (номер)","28"))); f.push(fld(sc,"pickLabel","Подпись к выделенному","Победил этот")); }
        else if(sc.type==="compare"){ f.push(fld(sc,"title","Над карточками","необязательно",true,2));
          f.push(h("div",{class:"rphase"}, h("b",{text:"Верхняя карточка"}), h("div",{class:"row2"}, fld(sc,"a_label","Плашка","Было"), fld(sc,"a_color","Цвет карточки (hex)","необязательно")), fld(sc,"a_text","Текст","Что было",true,2), photoPick(sc,redraw,"a_src","Фото в карточку (необязательно; нажми ещё раз — убрать)")));
          f.push(h("div",{class:"rphase"}, h("b",{text:"Нижняя карточка"}), h("div",{class:"row2"}, fld(sc,"b_label","Плашка","Стало"), fld(sc,"b_color","Цвет карточки (hex)","необязательно")), fld(sc,"b_text","Текст","Что стало",true,2), photoPick(sc,redraw,"b_src","Фото в карточку (необязательно; нажми ещё раз — убрать)"))); }
        else if(sc.type==="list"){ f.push(fld(sc,"title","Заголовок","Что взять себе",true,2)); f.push(fld(sc,"items","Пункты — каждый с новой строки","Первое\nВторое\nТретье",true,4)); f.push(seg(sc,"mark",[["num","01 02 03"],["ok","✓"],["no","✕"],["mix","✕ … ✓"]],"Значки","num")); }
        else if(sc.type==="photo"){ f.push(photoPick(sc,redraw));
          f.push(fld(sc,"title","Текст на фото","Новая строка — Enter",true,3)); f.push(fld(sc,"sub","Подпись мельче","необязательно",true,2)); f.push(fld(sc,"credit","Автор фото","Студия Артемия Лебедева"));
          f.push(seg(sc,"layout",[["full","На весь экран"],["card","Карточкой"]],"Как показать","full",redraw));
          f.push(seg(sc,"zoom",[["in","Приближение"],["out","Отдаление"],["none","Без движения"]],"Движение","in"));
          if(sc.layout!=="card"){ f.push(seg(sc,"fx",[["left","Левый край"],["center","Центр"],["right","Правый край"]],"Кадр по ширине","center")); f.push(seg(sc,"fy",[["top","Верх"],["center","Центр"],["bottom","Низ"]],"Кадр по высоте","center")); }
          f.push(seg(sc,"hl",[[true,"Последняя строка"],[false,"Без выделения"]],"Цветом акцента",false)); }
        else { f.push(fld(sc,"title",sc.type==="text"?"Тезис":"Заголовок","Новая строка — Enter",true,3));
          f.push(fld(sc,"sub","Подпись под заголовком","необязательно",true,2));
          if(sc.type==="text") f.push(seg(sc,"hl",[[true,"Последняя строка"],["all","Весь текст"],[false,"Без выделения"]],"Цветом акцента",true)); }
        f.push(h("details",{class:"rdz"}, h("summary",{text:"Дизайн сцены"}), design(sc)));
        f.push(ro?null:h("div",{class:"acts"},
          h("button",{type:"button",class:"btn sm ghost",title:"Выше",disabled:i===0,onclick:()=>{ const a=spec.scenes; [a[i-1],a[i]]=[a[i],a[i-1]]; commit(); draw(); }},"↑"),
          h("button",{type:"button",class:"btn sm ghost",title:"Ниже",disabled:i===n-1,onclick:()=>{ const a=spec.scenes; [a[i+1],a[i]]=[a[i],a[i+1]]; commit(); draw(); }},"↓"),
          h("button",{type:"button",class:"btn sm ghost",onclick:()=>{ spec.scenes.splice(i+1,0,JSON.parse(JSON.stringify(sc))); commit(); draw(); }},"Копия"),
          n>1?h("button",{type:"button",class:"btn sm ghost danger",onclick:()=>{ spec.scenes.splice(i,1); commit(); draw(); }},"Удалить"):null));
        body.replaceChildren(...f.filter(Boolean)); };
      fill();
      const card=h("details",{class:"card1 rcard",open:i===0}, h("summary",{onclick:()=>jump(i)}, cv, h("div",{class:"ctt"}, h("b",{text:reelCaption(sc,i)}), h("span",{class:"hint",text:plain(sc.title||sc.value||(sc.phases&&sc.phases.map(p=>p.caption).filter(Boolean).join(" → "))||(sc.a_text?sc.a_text+" → "+(sc.b_text||""):"")||"").slice(0,48)}), w)), body);
      thumbs[i]={cv,w,card}; list.append(card); });
    const add=ro?null:h("div",{class:"acts"}, h("span",{class:"hint",text:"Добавить сцену:"}), ...R_TYPES.map(([t,lab])=>h("button",{type:"button",class:"btn sm",onclick:()=>{ const at=spec.scenes.length && spec.scenes[spec.scenes.length-1].type==="end"?spec.scenes.length-1:spec.scenes.length; spec.scenes.splice(at,0,reelBlank(t)); commit(); draw(); }},"+ "+lab)));
    box.replaceChildren(head, impSt, top, photoBar, list, add); setTimeout(ensurePhotos,0);
    showVideo(); carFonts().then(()=>{ redrawThumbs(); t0=performance.now(); raf=requestAnimationFrame(loop); });
  };
  drawPhotoBar(); draw(); poll();
  return box;
}
