/* ---------- рилс: spec → вертикальное видео 1080×1920, рисуется в браузере ---------- */
const RW=1080, RH=1920, RM=80;
const R_BG={cream:[C_CREAM,C_INK,"rgb(91,86,80)","#fff"], ink:[C_INK,C_CREAM,"rgb(190,182,168)","rgb(36,35,33)"], orange:[C_OR,C_INK,"rgb(60,30,15)",C_CREAM]};
const R_ACC={orange:C_OR, green:"rgb(31,122,58)", ink:C_INK, blue:"rgb(42,92,220)"};
const R_SIZE={S:96,M:120,L:146};
const R_TYPES=[["title","Заголовок"],["ui","Интерфейс"],["text","Тезис"],["end","Финал"]];
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
  if(sc.head!==false){ /* шапка */
    const lab=String(sc.label||spec.label||"Дизайн-Радар").toUpperCase();
    cSet(ctx,cFont.semi(32),4); const tw=ctx.measureText(lab).width; ctx.fillStyle=(bg==="orange"?C_INK:A===C_INK&&bg==="ink"?C_OR:A); ctx.fillRect(RM,120,tw+48,64);
    ctx.fillStyle=bg==="orange"?C_CREAM:(bg==="ink"&&A===C_CREAM?C_INK:"#fff"); ctx.fillText(lab,RM+24,120+16);
    cSet(ctx,cFont.title(32),0); const br="Дизайн-Радар", bw=ctx.measureText(br).width; ctx.fillStyle=F; ctx.fillText(br,RW-RM-bw,132);
    ctx.fillStyle=bg==="orange"?C_INK:C_OR; ctx.beginPath(); ctx.arc(RW-RM-bw-26,152,11,0,7); ctx.fill(); }
  ctx.save(); ctx.globalAlpha=Math.min(ins,out); ctx.translate(0,(1-ins)*70);
  const size=R_SIZE[sc.size]||R_SIZE.M, W=RW-2*RM;
  const lines=(t,font,lh,track)=>{ cSet(ctx,font,track); const out=[]; const ps=String(t||"").split("\n"); ps.forEach((p,pi)=>{ const ls=cWrap(ctx,cTypo(p,true),W); (ls.length?ls:[""]).forEach(l=>out.push({l,lh,last:pi===ps.length-1})); }); return out; };
  const place=(h)=> sc.align==="top"?420 : sc.align==="bottom"?Math.max(420,RH-420-h) : Math.max(380,(RH-h)/2-60);
  if(sc.type==="ui"){
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
  if(type==="ui") return {type:"ui",dur:5.5,bg:"cream",accent:"orange",phases:[{tag:"Было",head:"Заголовок экрана",kind:"list",caption:"Подпись"},{tag:"Стало",head:"",kind:"skeleton",caption:"Подпись"}]};
  if(type==="text") return {type:"text",dur:3,bg:"cream",accent:"orange",size:"M",title:"Главная мысль\nвторой строкой",hl:true};
  if(type==="end") return {type:"end",dur:2.2,bg:"cream",accent:"orange",size:"M",title:"Дизайн-Радар",sub:"@designradar_lab · разбор целиком в канале"};
  return {type:"title",dur:3,bg:"cream",accent:"orange",size:"L",title:"Заголовок",sub:""};
}
function reelFromPost(d){
  return {label:d.label||d.section||"Дизайн-Радар", scenes:[
    {...reelBlank("title"), title:plain(d.cover_title||d.title).replace(/\|/g," ").slice(0,60), sub:""},
    {...reelBlank("text"), title:plain(String(d.full_text||"").split(/\n+/).find(x=>x.trim().length>20)||"").slice(0,90)},
    reelBlank("end")]};
}
async function genReel(d, wish){
  const prompt=TEXT_RULES+"\n\nСделай сценарий короткого вертикального видео (рилс, 10–15 секунд) по этому посту Telegram-канала «Дизайн-Радар». Видео рисуется кодом из сцен, поэтому пиши только тексты и выбирай типы сцен.\nПОСТ:\nЗаголовок: "+d.title+"\nРубрика: "+(d.label||d.section)+"\nТекст:\n"+String(d.full_text||"").slice(0,3000)+(wish?"\n\nПОЖЕЛАНИЕ РЕДАКТОРА: "+wish:"")+
  "\n\nСЦЕНЫ (3–5, первая — title, последняя — end):\n- title: {type:\"title\", title (крючок, до 45 знаков, можно перенос \\n), sub (до 90 знаков, необязательно)}\n- ui: живой экран-иллюстрация, 1–3 фазы {type:\"ui\", phases:[{tag (до 14 знаков, например «до 1 с» или «было»), head (заголовок экрана до 30 знаков), kind: \"list\"|\"skeleton\"|\"progress\", value (только для progress, число 1–100), note (для progress, до 20 знаков), caption (вывод под экраном, до 28 знаков)}]} — используй, когда в посте есть приём интерфейса или сравнение;\n- text: {type:\"text\", title (тезис или вердикт до 80 знаков, строки через \\n, последняя строка выделится цветом), hl:true}\n- end: {type:\"end\", title:\"Дизайн-Радар\", sub:\"@designradar_lab · …\" (до 50 знаков, зови в канал)}\nУ каждой сцены dur — секунды (title 2.5–3, ui 4–6, text 2.5–3.5, end 2). Факты — только из поста. Голос — живой, коротко.\nОтветь только JSON: {\"label\":\"рубрика 1–2 слова\",\"scenes\":[…]}";
  const v=await sample.json(prompt,{modelTier:"complex",cache:false});
  if(!v||!Array.isArray(v.scenes)||!v.scenes.length) throw {message:"Claude вернул сценарий не в том виде. Попробуй ещё раз."};
  v.scenes=v.scenes.slice(0,7).map(s=>({...reelBlank(R_TYPES.some(t=>t[0]===s.type)?s.type:"text"), ...s, phases:Array.isArray(s.phases)?s.phases.slice(0,3):undefined}));
  return {label:String(v.label||d.label||""), scenes:v.scenes};
}
async function recordReel(spec, onProgress){
  await carFonts();
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
  let raf=0, playing=true, t0=performance.now(), pv=null, pctx=null, thumbs=[], tT=null;
  const commit=()=>{ d.reel=spec; changed(); clearTimeout(tT); tT=setTimeout(redrawThumbs,250); };
  const stop=()=>{ cancelAnimationFrame(raf); raf=0; };
  const loop=()=>{ if(!pv||!pv.isConnected){ stop(); return; } const tot=reelDur(spec); const t=playing?((performance.now()-t0)/1000)%tot:pv._t||0; pv._t=t;
    pctx.setTransform(1,0,0,1,0,0); pctx.clearRect(0,0,pv.width,pv.height); pctx.setTransform(pv.width/RW,0,0,pv.height/RH,0,0); pctx.textBaseline="top"; const r=drawReelFrame(pctx,spec,t);
    if(bar) bar.style.width=(t/tot*100)+"%"; if(curScene!==r.i){ curScene=r.i; thumbs.forEach((th,i)=>th&&th.card.classList.toggle("on",i===r.i)); }
    raf=requestAnimationFrame(loop); };
  let bar=null, curScene=-1;
  const jump=(i)=>{ t0=performance.now()-(reelSceneStart(spec,i)+.05)*1000; if(!playing){ pv._t=reelSceneStart(spec,i)+.9; } };
  const redrawThumbs=async()=>{ await carFonts(); thumbs.forEach((th,i)=>{ if(!th||!spec.scenes[i]) return; const w=reelThumb(spec,i,th.cv); th.w.textContent=w.length?"⚠ "+w.join(", "):""; th.w.hidden=!w.length; }); };
  const seg=(obj,key,opts,lab,def,after)=>{ const wrap=h("div",{class:"rseg"}); const draw=()=>wrap.replaceChildren(h("span",{class:"rsl",text:lab}),...opts.map(([v,t])=>h("button",{type:"button",class:"chipb"+(((obj[key]??def)===v)?" on":""),disabled:ro,onclick:()=>{ obj[key]=v; commit(); if(after) after(); else draw(); }},t))); draw(); return wrap; };
  const fld=(obj,key,lab,ph,area,rows)=>{ const e=area?h("textarea",{rows:rows||2,placeholder:ph||"",readonly:ro}):h("input",{type:"text",placeholder:ph||"",readonly:ro}); e.value=obj[key]??""; e.addEventListener("input",()=>{ obj[key]=e.value; commit(); }); return h("div",{class:"fld"},h("label",{text:lab}),e); };
  const design=(sc)=>h("div",{class:"rdesign"},
    seg(sc,"bg",[["cream","Светлый"],["ink","Тёмный"],["orange","Оранжевый"]],"Фон","cream"),
    seg(sc,"accent",[["orange","Оранжевый"],["green","Зелёный"],["blue","Синий"],["ink","Чёрный"]],"Акцент","orange"),
    sc.type==="ui"?null:seg(sc,"size",[["S","S"],["M","M"],["L","L"]],"Текст","M"),
    seg(sc,"align",[["top","Выше"],["center","Центр"],["bottom","Ниже"]],"Место","center"),
    seg(sc,"head",[[true,"Шапка"],[false,"Без шапки"]],"Верх",true),
    (()=>{ const r=h("input",{type:"range",min:"1.5",max:"8",step:"0.5",value:String(sc.dur||3),disabled:ro}); const v=h("b",{text:(sc.dur||3)+" с"}); r.addEventListener("input",()=>{ sc.dur=Number(r.value); v.textContent=r.value+" с"; commit(); }); return h("div",{class:"rseg"},h("span",{class:"rsl",text:"Длительность"}),r,v); })());
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
        h("p",{class:"hint",text:"Короткое видео на 10–15 секунд из нескольких сцен. Каждую сцену можно переписать и перекрасить — превью играет сразу."}),
        ro?null:h("div",{class:"acts"}, sample?h("button",{type:"button",class:"btn aibtn",onclick:async(e)=>{ const b=e.currentTarget; b.disabled=true; b.textContent="Claude пишет сценарий…"; try{ spec=await genReel(d,""); commit(); draw(); }catch(er){ toast((er&&er.message)||"Не получилось"); b.disabled=false; b.textContent="✦ Сделать рилс из текста"; } }},"✦ Сделать рилс из текста"):null,
          h("button",{type:"button",class:"btn",onclick:()=>{ spec=reelFromPost(d); commit(); draw(); }},"Простой рилс из заголовка"))); return; }
    pv=h("canvas",{class:"reelpv",width:"360",height:"640"}); pctx=pv.getContext("2d");
    bar=h("i"); const play=h("button",{type:"button",class:"btn sm",onclick:()=>{ playing=!playing; if(playing) t0=performance.now()-(pv._t||0)*1000; play.textContent=playing?"❚❚ Пауза":"▶ Играть"; }},"❚❚ Пауза");
    const st=h("div",{class:"hint"}); const out=h("div",{class:"reelout"});
    const showVideo=()=>{ out.replaceChildren(); if(d.reel_video_url){ out.append(h("video",{src:d.reel_video_url,controls:true,playsinline:true,class:"reelvid"}), h("a",{class:"btn sm ghost",href:d.reel_video_url,target:"_blank",rel:"noopener",download:"reel_"+(d.id||"post")+".mp4"},"Скачать видео ↗")); } };
    const rec=ro?null:h("button",{type:"button",class:"btn accent",onclick:async()=>{ rec.disabled=true; try{ st.textContent="Записываю видео… это столько же секунд, сколько длится рилс. Не закрывай вкладку.";
        const blob=await recordReel(spec,p=>{ st.textContent="Записываю видео… "+Math.round(p*100)+"%"; });
        const ext=/mp4/.test(blob.type)?"mp4":"webm";
        if(assets){ st.textContent="Сохраняю видео…"; const r=await assets.upload(new File([blob],"reel_"+(d.id||Date.now())+"."+ext,{type:blob.type})); d.reel_video_url=r.url; d.reel_video_asset=r.id||""; d.reel_video_type=blob.type; d.reel_video_at=Date.now(); changed(); }
        else { d.reel_video_url=URL.createObjectURL(blob); }
        showVideo(); st.textContent=ext==="mp4"?"Готово: MP4 "+Math.round(blob.size/1024)+" КБ.":"Готово, но этот браузер записал WebM — для Telegram лучше записать в Safari или новом Chrome."; }
      catch(e){ st.textContent=(e&&e.message)||"Не получилось записать видео"; } finally{ rec.disabled=false; } }},"Собрать видео");
    const head=h("div",{class:"sech"},h("h4",{text:"Рилс"}),h("span",{text:spec.scenes.length+" сцен · "+reelDur(spec).toFixed(1).replace(".0","")+" с"}));
    const top=h("div",{class:"reeltop"}, h("div",{class:"reelpvw"}, pv, h("div",{class:"reelbar"},bar)),
      h("div",{class:"reelside"}, fld(spec,"label","Плашка в шапке (для всех сцен)","Крафт"), h("div",{class:"acts"}, play, rec), st, out,
        (!ro&&sample)?h("button",{type:"button",class:"btn sm aibtn",onclick:async(e)=>{ const b=e.currentTarget; b.disabled=true; b.textContent="Claude переписывает…"; try{ spec=await genReel(d,""); commit(); draw(); }catch(er){ toast((er&&er.message)||"Не получилось"); b.disabled=false; b.textContent="✦ Новый сценарий"; } }},"✦ Новый сценарий"):null,
        ro?null:h("button",{type:"button",class:"btn sm ghost danger",onclick:()=>{ spec=null; d.reel=null; changed(); draw(); }},"Удалить рилс")));
    const list=h("div",{class:"cards"}); const n=spec.scenes.length;
    spec.scenes.forEach((sc,i)=>{
      const cv=h("canvas",{class:"rthumb",width:"108",height:"192"}); const w=h("div",{class:"cwarn",hidden:true});
      const body=h("div",{class:"cbody"}); const redraw=()=>{ fill(); redrawThumbs(); };
      const fill=()=>{ const f=[];
        f.push(seg(sc,"type",R_TYPES,"Тип сцены","title",()=>{ if(sc.type==="ui"&&!(sc.phases&&sc.phases.length)) sc.phases=reelBlank("ui").phases; redraw(); }));
        if(sc.type==="ui"){ if(!Array.isArray(sc.phases)||!sc.phases.length) sc.phases=reelBlank("ui").phases; sc.phases.forEach((_,j)=>f.push(phaseFields(sc,j,redraw)));
          if(!ro&&sc.phases.length<3) f.push(h("button",{type:"button",class:"btn sm",onclick:()=>{ sc.phases.push({tag:"",head:"",kind:"list",caption:""}); commit(); redraw(); }},"+ Экран")); }
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
    box.replaceChildren(head, top, list, add);
    showVideo(); carFonts().then(()=>{ redrawThumbs(); t0=performance.now(); raf=requestAnimationFrame(loop); });
  };
  draw();
  return box;
}
