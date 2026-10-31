/* ---------- рилс: spec → вертикальное видео 1080×1920, рисуется в браузере ---------- */
const RW=1080, RH=1920, RM=80;
const R_BG={cream:[C_CREAM,C_INK,"rgb(91,86,80)","#fff"], ink:[C_INK,C_CREAM,"rgb(190,182,168)","rgb(36,35,33)"], orange:[C_OR,C_INK,"rgb(60,30,15)",C_CREAM]};
const R_ACC={orange:C_OR, green:"rgb(31,122,58)", ink:C_INK, blue:"rgb(42,92,220)"};
const R_SIZE={S:96,M:120,L:146};
const R_TYPES=[["title","Заголовок"],["photo","Фото"],["ui","Интерфейс"],["text","Тезис"],["end","Финал"]];
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
  const pa=d.photo_assets||{}; const add0=add; const addM=(url,cap)=>add0(pa[url]||url,cap); 
  return reelPhotosFrom(d,addM,credit,out); }
function reelPhotosFrom(d,add,credit,out){
  add(d.cover_url, credit); (d.photo_urls||[]).forEach(u=>add(u,credit)); (d.media||[]).filter(m=>m&&!m.gen&&!m.pending).forEach(m=>add(m.url,(m.caption||"").replace(/^Фото:\s*/,"")||credit));
  return out; }
const R_KINDS=[["list","Список"],["skeleton","Скелетон"],["progress","Прогресс"]];
const rClamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const rEase=x=>1-Math.pow(1-rClamp(x),3);
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
      const g2=ctx.createLinearGradient(0,0,0,300); g2.addColorStop(0,"rgba(0,0,0,.45)"); g2.addColorStop(1,"rgba(0,0,0,0)"); ctx.fillStyle=g2; ctx.fillRect(0,0,RW,300); } }
  if(sc.head!==false){ /* шапка */
    const lab=String(sc.label||spec.label||"Дизайн-Радар").toUpperCase();
    cSet(ctx,cFont.semi(32),4); const tw=ctx.measureText(lab).width; ctx.fillStyle=(bg==="orange"?C_INK:A===C_INK&&bg==="ink"?C_OR:A); ctx.fillRect(RM,120,tw+48,64);
    ctx.fillStyle=bg==="orange"?C_CREAM:(bg==="ink"&&A===C_CREAM?C_INK:"#fff"); ctx.fillText(lab,RM+24,120+16);
    cSet(ctx,cFont.title(32),0); const br="Дизайн-Радар", bw=ctx.measureText(br).width; ctx.fillStyle=full?"#fff":F; ctx.fillText(br,RW-RM-bw,132);
    ctx.fillStyle=bg==="orange"?C_INK:C_OR; ctx.beginPath(); ctx.arc(RW-RM-bw-26,152,11,0,7); ctx.fill(); }
  ctx.save(); ctx.globalAlpha=Math.min(ins,out); ctx.translate(0,(1-ins)*70);
  const size=R_SIZE[sc.size]||R_SIZE.M, W=RW-2*RM;
  const lines=(t,font,lh,track)=>{ cSet(ctx,font,track); const out=[]; const ps=String(t||"").split("\n"); ps.forEach((p,pi)=>{ const ls=cWrap(ctx,cTypo(p,true),W); (ls.length?ls:[""]).forEach(l=>out.push({l,lh,last:pi===ps.length-1})); }); return out; };
  const place=(h)=> sc.align==="top"?420 : sc.align==="bottom"?Math.max(420,RH-420-h) : Math.max(380,(RH-h)/2-60);
  if(isPhoto){
    const tc=full?"#fff":F, mc=full?"rgba(255,255,255,.82)":M;
    const tl=lines(sc.title||"", cFont.title(size), Math.round(size*1.0), -2), sl=sc.sub?lines(sc.sub, cFont.body(44), 56, 0):[];
    const cr=sc.credit?String(sc.credit):"";
    if(full){ let y=RH-330-(cr?60:0)-sl.length*56-(sl.length?30:0)-tl.length*tl[0].lh; if(sc.align==="top") y=330; else if(sc.align==="center") y=Math.max(330,(RH-(tl.length*tl[0].lh+sl.length*56))/2);
      cSet(ctx,cFont.title(size),-2); tl.forEach(ln=>{ ctx.fillStyle=(sc.hl&&ln.last)?(A===C_INK?C_OR:A):tc; ctx.fillText(ln.l,RM,y); y+=ln.lh; });
      if(sl.length){ y+=30; cSet(ctx,cFont.body(44),0); ctx.fillStyle=mc; sl.forEach(l=>{ ctx.fillText(l.l,RM,y); y+=56; }); }
      if(cr){ cSet(ctx,cFont.mono(26),1); ctx.fillStyle="rgba(255,255,255,.7)"; ctx.fillText("ФОТО: "+cr.toUpperCase(),RM,y+30); }
      if(y>RH-260) warn.push("текст уходит под кнопки соцсети внизу"); }
    else { const top=sc.align==="bottom"?560:sc.align==="center"?420:300; let ph=820;
      if(pim&&pim.img){ const im=pim.img; ph=Math.min(1000,Math.round(W*im.naturalHeight/im.naturalWidth)); }
      ctx.save(); ctx.beginPath(); ctx.roundRect(RM,top,W,ph,40); ctx.clip(); ctx.fillStyle="rgb(220,214,202)"; ctx.fillRect(RM,top,W,ph);
      if(pim&&pim.img){ const im=pim.img, z=sc.zoom==="none"?1:sc.zoom==="out"?1.1-.1*rClamp(local/dur):1+.1*rClamp(local/dur); const k0=Math.max(W/im.naturalWidth,ph/im.naturalHeight)*z, w=im.naturalWidth*k0, hh=im.naturalHeight*k0; ctx.drawImage(im,RM+(W-w)/2,top+(ph-hh)/2,w,hh); }
      ctx.restore(); let y=top+ph+60;
      if(cr){ cSet(ctx,cFont.mono(24),1); ctx.fillStyle=M; ctx.fillText("ФОТО: "+cr.toUpperCase(),RM,top+ph+20); y+=30; }
      cSet(ctx,cFont.title(Math.min(size,110)),-2); tl.forEach(ln=>{ ctx.fillStyle=(sc.hl&&ln.last)?A:tc; ctx.fillText(ln.l,RM,y); y+=Math.round(Math.min(size,110)); });
      if(sl.length){ y+=24; cSet(ctx,cFont.body(42),0); ctx.fillStyle=mc; sl.forEach(l=>{ ctx.fillText(l.l,RM,y); y+=54; }); }
      if(y>RH-260) warn.push("текст уходит под кнопки соцсети — сократи или выбери «на весь экран»"); }
    if(!pim||pim.st==="loading"){ cSet(ctx,cFont.body(36),0); ctx.fillStyle=full?"rgba(255,255,255,.6)":M; if(sc.src) ctx.fillText("фото загружается…",RM,full?RH/2:500); }
    if(tl.length>5) warn.push("заголовок длиннее 5 строк");
  } else if(sc.type==="ui"){
    const ph=(sc.phases||[]).filter(Boolean).slice(0,3); const n=Math.max(1,ph.length); const k=Math.min(n-1,Math.floor(local/(dur/n))); const p=ph[k]||{}; const pl=local-k*dur/n, pd=dur/n;
    const top=sc.align==="top"?300:sc.align==="bottom"?560:420, ch=1080;
    if(p.tag){ cSet(ctx,cFont.title(46),0); const tw=ctx.measureText(p.tag.toUpperCase()).width; ctx.fillStyle=(k===n-1&&n>1)?A:F; ctx.fillRect(RM,top,tw+44,74); ctx.fillStyle=(k===n-1&&n>1)?(A===C_CREAM?C_INK:"#fff"):B; ctx.fillText(p.tag.toUpperCase(),RM+22,top+14); }
    const y0=top+110; ctx.fillStyle=CARD; ctx.strokeStyle=bg==="cream"?"rgb(216,210,198)":"rgba(0,0,0,.12)"; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect(RM,y0,W,ch,44); ctx.fill(); ctx.stroke();
    const ink=bg==="ink"?C_CREAM:C_INK, soft=bg==="ink"?"rgb(70,67,62)":"rgb(226,220,208)";
    let y=y0+80; const x=RM+70, iw=W-140;
    if(p.head){ const hl=cBlock(ctx,x,y,p.head,cFont.title(64),ink,iw,74,-1,true); y+=hl.h+50; }
    const kind=p.kind||"list";
    if(kind==="list"||kind==="skeleton"){ const sk=kind==="skeleton"; const pulse=sk?.55+.45*Math.sin(local*7):1;
      if(sk&&!p.head){ ctx.fillStyle=soft; ctx.beginPath(); ctx.roundRect(x,y,300,56,28); ctx.fill(); y+=120; }
      for(let i=0;i<4;i++){ const yy=y+i*150; const a0=ctx.globalAlpha; if(sk) ctx.globalAlpha=a0*pulse;
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
    if(y>RH-300) warn.push("текст уходит под кнопки соцсети внизу");
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
  const sc=spec.scenes[i], d=rClamp(Number(sc.dur)||3,1.5,8); const w=[]; drawReelScene(ctx,spec,sc,sc.type==="ui"?Math.min(d-.4,d/((sc.phases||[]).length||1)*.6):Math.min(d-.4,2.2),d,w);
  if(cv) cv.getContext("2d").drawImage(c,0,0,cv.width,cv.height); return w; }

function reelBlank(type){
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
  const photos=ph.length?ph.map((p,i)=>"  "+(i+1)+") фото "+(i+1)+(i===0?" — главное фото поста":"")+(p.cap?" (автор: "+p.cap+")":"")).join("\n"):"  нет";
  const plans={
    photo:"Это пост о реальной работе — рилс строится НА ФОТО ПОСТА. Схема: 1) photo — самое сильное фото на весь экран и крючок, который хочется досмотреть (факт или парадокс из поста); 2–3) photo — другие фото, каждое с одним фактом или деталью из поста (что сделали, для кого, какой приём); 4) text — вердикт редакции в 1–2 строках; 5) end. Если фото меньше трёх — повтори фото с другим кадрированием (fx/fy) или замени сцену на text. Не используй ui.",
    craft:"Это пост о приёме. Схема: 1) title — крючок; 2) ui — экраны показывают ИМЕННО приём этого поста (плашки, заголовки экранов и подписи — из этого поста, не придумывай чужую тему); 3) text — правило или вывод; 4) end. Если у поста есть фото — можешь заменить ui на photo.",
    thought:"Это короткая мысль. Схема: 2–3 сцены text, каждая — одна фраза мысли, последняя с выводом; потом end. Никакого ui."};
  const prompt=TEXT_RULES+"\n\nСделай сценарий вертикального видео (рилс, 10–16 секунд) по ЭТОМУ посту канала «Дизайн-Радар». Видео рисуется кодом из сцен: ты пишешь тексты и выбираешь сцены.\n\nПОСТ:\nЗаголовок: "+d.title+"\nРубрика: "+lab+"\nТекст:\n"+String(d.full_text||"").slice(0,3200)+"\n\nФОТО ПОСТА:\n"+photos+(wish?"\n\nПОЖЕЛАНИЕ РЕДАКТОРА: "+wish:"")+
  "\n\nСНАЧАЛА сформулируй одну мысль рилса одной фразой (поле idea) — каждая сцена работает на неё по порядку: зацепить → показать → объяснить → вердикт → в канал. Все факты, цифры и имена — только из текста поста выше; ничего не бери из других тем и примеров.\nСХЕМА ДЛЯ ЭТОГО ПОСТА: "+plans[kind]+
  "\n\nТИПЫ СЦЕН:\n- photo: {type:\"photo\", photo: номер фото из списка, title (до 50 знаков, строки через \\n), sub (до 80, необязательно), hl: true если последнюю строку выделить цветом, fx: \"left\"|\"center\"|\"right\", fy: \"top\"|\"center\"|\"bottom\" (кадрирование), zoom: \"in\"|\"out\"}\n- title: {type:\"title\", title (крючок до 45 знаков), sub (до 90, необязательно)}\n- ui: {type:\"ui\", phases:[1–3 × {tag (до 14 знаков), head (до 30), kind: \"list\"|\"skeleton\"|\"progress\", value (для progress, 1–100), note (для progress, до 20), caption (до 28)}]}\n- text: {type:\"text\", title (до 80 знаков, строки через \\n, последняя выделится), bg: \"cream\"|\"ink\"|\"orange\"}\n- end: {type:\"end\", title:\"Дизайн-Радар\", sub (до 50, зови в канал по теме поста)}\nУ каждой сцены dur в секундах: photo 2.5–3.5, title 2.5–3, ui 4–6, text 2.5–3.5, end 2. Голос — живой, коротко, как в канале.\nОтветь только JSON: {\"idea\":\"…\",\"label\":\"рубрика 1–2 слова\",\"scenes\":[…]}";
  const v=await sample.json(prompt,{modelTier:"complex",cache:false});
  if(!v||!Array.isArray(v.scenes)||!v.scenes.length) throw {message:"Claude вернул сценарий не в том виде. Попробуй ещё раз."};
  const cr=(ph[0]&&ph[0].cap)||"";
  v.scenes=v.scenes.slice(0,7).map(s0=>{ const t=R_TYPES.some(x=>x[0]===s0.type)?s0.type:"text"; const o={...reelBlank(t), ...s0, type:t};
    if(t==="photo"){ const n=Math.max(1,Math.min(ph.length,Number(s0.photo)||1)); const p=ph[n-1]; if(!p) return {...reelBlank("text"), title:String(s0.title||"")}; o.src=p.url; o.credit=p.cap||cr; delete o.photo; }
    if(t==="ui") o.phases=Array.isArray(s0.phases)?s0.phases.slice(0,3):reelBlank("ui").phases; else delete o.phases;
    return o; });
  return {idea:String(v.idea||""), label:String(v.label||lab||""), scenes:v.scenes};
}

async function recordReel(spec, onProgress){
  await carFonts();
  const phs=(spec.scenes||[]).filter(x=>x.type==="photo"&&x.src).map(x=>rImg(x.src));
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
function reelEditor(d, o){
  const {ro, changed}=o;
  const box=h("section",{class:"sec reelsec"});
  let spec=d.reel?JSON.parse(JSON.stringify(d.reel)):null;
  let lastBlob=null; let raf=0, playing=true, t0=performance.now(), pv=null, pctx=null, thumbs=[], tT=null;
  const impSt=h("div",{class:"hint rimp",hidden:true}); let importing=false;
  const ensurePhotos=async()=>{ if(importing||ro||!spec) return; d.photo_assets=d.photo_assets||{};
    const ext=[...new Set(spec.scenes.filter(x=>x.type==="photo"&&rIsExt(x.src)).map(x=>x.src))]; if(!ext.length) return;
    const todo=ext.filter(u=>!d.photo_assets[u]); importing=true;
    try{ for(let i=0;i<todo.length;i++){ impSt.hidden=false; impSt.textContent="Переношу фото источника в панель "+(i+1)+" из "+todo.length+"… (Make, ~3 операции на фото, один раз)"; d.photo_assets[todo[i]]=await importPhoto(todo[i]); }
      spec.scenes.forEach(x=>{ if(x.type==="photo"&&d.photo_assets[x.src]) x.src=d.photo_assets[x.src]; }); impSt.hidden=true; commit(); draw(); }
    catch(e){ impSt.hidden=false; impSt.textContent=((e&&e.message)||"Фото не перенеслось")+" — загрузи фото вручную кнопкой «Своё фото»."; }
    finally{ importing=false; } };
  const commit=()=>{ d.reel=spec; changed(); clearTimeout(tT); tT=setTimeout(redrawThumbs,250); };
  const stop=()=>{ cancelAnimationFrame(raf); raf=0; };
  const loop=()=>{ if(!pv||!pv.isConnected){ stop(); return; } const tot=reelDur(spec); const t=playing?((performance.now()-t0)/1000)%tot:pv._t||0; pv._t=t;
    pctx.setTransform(1,0,0,1,0,0); pctx.clearRect(0,0,pv.width,pv.height); pctx.setTransform(pv.width/RW,0,0,pv.height/RH,0,0); pctx.textBaseline="top"; const r=drawReelFrame(pctx,spec,t);
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
  const photoPick=(sc,redraw)=>{ const list=reelPhotos(d); if(sc.src&&!list.some(p=>p.url===sc.src)) list.push({url:sc.src,cap:sc.credit||""});
    const row=h("div",{class:"rpick"});
    list.forEach(p=>{ const im=h("img",{src:R_LOCAL.get(p.url)||p.url,alt:"",referrerpolicy:"no-referrer",loading:"lazy"}); im.addEventListener("error",()=>{ im.replaceWith(h("span",{class:"rpfail",text:"не открылось"})); });
      row.append(h("button",{type:"button",class:"rph"+(sc.src===p.url?" on":""),disabled:ro,title:p.cap||"",onclick:()=>{ sc.src=p.url; if(!sc.credit&&p.cap) sc.credit=p.cap; commit(); redraw(); ensurePhotos(); }},im)); });
    if(!ro){ const inp=h("input",{type:"file",accept:"image/*",hidden:true}); inp.addEventListener("change",async()=>{ const f=inp.files&&inp.files[0]; if(!f) return; const blobUrl=URL.createObjectURL(f);
        sc.src=blobUrl; commit(); redraw();
        if(assets){ try{ const r=await assets.upload(f); R_LOCAL.set(r.url,blobUrl); sc.src=r.url; commit(); redraw(); }catch(e){ toast("Фото не сохранилось в панели — оно останется только до закрытия вкладки"); } } });
      row.append(h("button",{type:"button",class:"rph add",onclick:()=>inp.click()},"+ Своё фото"), inp); }
    return h("div",{class:"fld"}, h("label",{text:list.length?"Фото — выбери или загрузи своё":"У поста нет фото по ссылке — загрузи своё"}), row); };
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
        ro?null:h("div",{class:"acts"}, sample?h("button",{type:"button",class:"btn aibtn",onclick:async(e)=>{ const b=e.currentTarget; b.disabled=true; b.textContent="Claude пишет сценарий…"; try{ spec=await genReel(d,""); commit(); draw(); }catch(er){ toast((er&&er.message)||"Не получилось"); b.disabled=false; b.textContent="✦ Сделать рилс из текста"; } }},"✦ Сделать рилс из текста"):null,
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
      h("div",{class:"reelside"}, fld(spec,"label","Плашка в шапке (для всех сцен)","Крафт"), h("div",{class:"acts"}, play, rec), st, out,
        spec.idea?h("div",{class:"ridea"}, h("b",{text:"Мысль рилса: "}), spec.idea):null,
        (!ro&&sample)?(()=>{ const wi=h("input",{type:"text",placeholder:"Пожелание: «начни с цифры 228», «больше про дугу в логотипе»…"}); return h("div",{class:"airow rwish"}, wi, h("button",{type:"button",class:"btn sm aibtn",onclick:async(e)=>{ const b=e.currentTarget; b.disabled=true; b.textContent="Claude думает…"; try{ spec=await genReel(d,wi.value.trim()); commit(); draw(); }catch(er){ toast((er&&er.message)||"Не получилось"); b.disabled=false; b.textContent="✦ Новый сценарий"; } }},"✦ Новый сценарий")); })():null,
        ro?null:h("button",{type:"button",class:"btn sm ghost danger",onclick:()=>{ spec=null; d.reel=null; changed(); draw(); }},"Удалить рилс")));
    const list=h("div",{class:"cards"}); const n=spec.scenes.length;
    spec.scenes.forEach((sc,i)=>{
      const cv=h("canvas",{class:"rthumb",width:"108",height:"192"}); const w=h("div",{class:"cwarn",hidden:true});
      const body=h("div",{class:"cbody"}); const redraw=()=>{ fill(); redrawThumbs(); };
      const fill=()=>{ const f=[];
        f.push(seg(sc,"type",R_TYPES,"Тип сцены","title",()=>{ if(sc.type==="ui"&&!(sc.phases&&sc.phases.length)) sc.phases=reelBlank("ui").phases; if(sc.type==="photo"&&!sc.src){ const p=reelPhotos(d)[0]; if(p){ sc.src=p.url; sc.credit=sc.credit||p.cap; } sc.layout=sc.layout||"full"; } redraw(); }));
        if(sc.type==="ui"){ if(!Array.isArray(sc.phases)||!sc.phases.length) sc.phases=reelBlank("ui").phases; sc.phases.forEach((_,j)=>f.push(phaseFields(sc,j,redraw)));
          if(!ro&&sc.phases.length<3) f.push(h("button",{type:"button",class:"btn sm",onclick:()=>{ sc.phases.push({tag:"",head:"",kind:"list",caption:""}); commit(); redraw(); }},"+ Экран")); }
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
      const card=h("details",{class:"card1 rcard",open:i===0}, h("summary",{onclick:()=>jump(i)}, cv, h("div",{class:"ctt"}, h("b",{text:reelCaption(sc,i)}), h("span",{class:"hint",text:plain(sc.title||(sc.phases&&sc.phases.map(p=>p.caption).filter(Boolean).join(" → "))||"").slice(0,48)}), w)), body);
      thumbs[i]={cv,w,card}; list.append(card); });
    const add=ro?null:h("div",{class:"acts"}, h("span",{class:"hint",text:"Добавить сцену:"}), ...R_TYPES.map(([t,lab])=>h("button",{type:"button",class:"btn sm",onclick:()=>{ const at=spec.scenes.length && spec.scenes[spec.scenes.length-1].type==="end"?spec.scenes.length-1:spec.scenes.length; spec.scenes.splice(at,0,reelBlank(t)); commit(); draw(); }},"+ "+lab)));
    box.replaceChildren(head, impSt, top, list, add); setTimeout(ensurePhotos,0);
    showVideo(); carFonts().then(()=>{ redrawThumbs(); t0=performance.now(); raf=requestAnimationFrame(loop); });
  };
  draw();
  return box;
}
