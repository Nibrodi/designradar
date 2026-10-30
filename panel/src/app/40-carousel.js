/* ---------- carousel: spec → 1080×1350 cards drawn in the browser ---------- */
const CW=1080, CH=1350, CM=80, C_CREAM="rgb(242,235,221)", C_INK="rgb(20,20,20)", C_OR="rgb(255,90,31)", C_MUT="rgb(96,90,80)";
const C_SHORT=new Set("в во на с со к ко о об обо от до по за из у и а но не ни для без под над при про что как или же бы ли то".split(" "));
let carFontsReady=null;
function carFonts(){ if(!carFontsReady) carFontsReady=Promise.all(["800 80px 'Inter Tight'","900 200px 'Inter Tight'","500 40px Inter","600 38px Inter","500 24px 'JetBrains Mono'"].map(f=>document.fonts&&document.fonts.load(f).catch(()=>null))).catch(()=>null); return carFontsReady; }
const cFont={title:s=>"800 "+s+"px 'Inter Tight', 'Inter', system-ui, sans-serif", num:s=>"900 "+s+"px 'Inter Tight', 'Inter', system-ui, sans-serif", body:s=>"500 "+s+"px Inter, system-ui, sans-serif", semi:s=>"600 "+s+"px Inter, system-ui, sans-serif", mono:s=>"500 "+s+"px 'JetBrains Mono', ui-monospace, monospace"};
function cTypo(t,keepDot){ t=String(t||"").trim(); if(!keepDot && /[^.]\.$/.test(t)) t=t.slice(0,-1);
  const w=t.split(" "); let o=""; w.forEach((x,i)=>{ o+=x; if(i<w.length-1){ const core=x.toLowerCase().replace(/[«»"(),.:;!?]/g,""); const nx=w[i+1]; o+=(C_SHORT.has(core)||/^[\d–-]+$/.test(core)||/^[—–→]$/.test(nx)||/^(же|ли|бы)$/i.test(nx))?" ":" "; } }); return o; }
function cSet(ctx,font,track){ ctx.font=font; try{ ctx.letterSpacing=(track||0)+"px"; }catch(_){} }
function cWrap(ctx,text,width){ const words=text.split(" "), lines=[]; let cur="";
  for(const w of words){ const t=cur?cur+" "+w:w; if(ctx.measureText(t).width>width && cur){ lines.push(cur); cur=w; } else cur=t; }
  if(cur) lines.push(cur);
  if(lines.length>1 && !/[  ]/.test(lines[lines.length-1])){ const prev=lines[lines.length-2].split(" "); if(prev.length>1){ const cand=prev[prev.length-1]+" "+lines[lines.length-1]; if(ctx.measureText(cand).width<=width){ lines[lines.length-2]=prev.slice(0,-1).join(" "); lines[lines.length-1]=cand; } } }
  return lines; }
function cBlock(ctx,x,y,text,font,color,width,lh,track,keepDot){ cSet(ctx,font,track); ctx.fillStyle=color; const ls=cWrap(ctx,cTypo(text,keepDot),width); ls.forEach((l,i)=>ctx.fillText(l,x,y+i*lh)); return {h:ls.length*lh, n:ls.length}; }
function cLabel(ctx,x,y,text,bg,fg,size){ size=size||28; cSet(ctx,cFont.mono(size),3); const t=String(text||"").toUpperCase(); const tw=ctx.measureText(t).width; const padx=Math.round(size*.7), hh=Math.round(size*1.9);
  ctx.fillStyle=bg; ctx.fillRect(x,y,tw+2*padx,hh); ctx.fillStyle=fg; ctx.fillText(t,x+padx,y+hh/2-size*.62); return hh; }
function cRings(ctx,cx,cy,rs,col,w){ ctx.strokeStyle=col; ctx.lineWidth=w||3; rs.forEach(r=>{ ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke(); }); }
function cFooter(ctx,page,total,fg,last){ const y=CH-CM-10; ctx.fillStyle=fg; ctx.fillRect(CM,y-28,CW-2*CM,2); cSet(ctx,cFont.mono(24),1); ctx.fillText("@designradar_lab",CM,y-10);
  const r=String(page).padStart(2,"0")+" / "+String(total).padStart(2,"0")+(last?"":"   листай →"); const rw=ctx.measureText(r).width; ctx.fillText(r,CW-CM-rw,y-10); }
function drawCarCard(spec,idx){
  const pts=spec.points||[], total=pts.length+2;
  const c=document.createElement("canvas"); c.width=CW; c.height=CH; const ctx=c.getContext("2d"); ctx.textBaseline="top";
  const warn=[];
  if(idx===0){ const cv=spec.cover||{};
    ctx.fillStyle=C_CREAM; ctx.fillRect(0,0,CW,CH);
    const cx=CW-260, cy=CH-375; cRings(ctx,cx,cy,[55,110,165,220],C_INK,3);
    ctx.fillStyle=C_OR; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,220,200*Math.PI/180,245*Math.PI/180); ctx.closePath(); ctx.fill();
    cRings(ctx,cx,cy,[55,110,165,220],C_INK,3); ctx.fillStyle=C_INK; ctx.beginPath(); ctx.arc(cx,cy,14,0,7); ctx.fill();
    const a=222*Math.PI/180; ctx.beginPath(); ctx.arc(cx+220*Math.cos(a),cy+220*Math.sin(a),26,0,7); ctx.fill();
    const hh=cLabel(ctx,CM,CM,cv.label||"Чек-лист",C_OR,C_CREAM);
    const y=CM+hh+40; const t=cBlock(ctx,CM,y,cv.title||"Заголовок карусели",cFont.title(104),C_INK,CW-2*CM,104,-2);
    const sb=cBlock(ctx,CM,y+t.h+28,cv.subtitle||"",cFont.body(38),C_MUT,CW-2*CM-120,52);
    if(t.n>4) warn.push("заголовок длиннее 4 строк"); if(y+t.h+28+sb.h>CH-375-230) warn.push("текст заходит на рисунок");
    cFooter(ctx,1,total,C_INK,false);
  } else if(idx<=pts.length){ const pt=pts[idx-1]||{};
    ctx.fillStyle=C_CREAM; ctx.fillRect(0,0,CW,CH);
    cLabel(ctx,CM,CM,(spec.cover&&spec.cover.label)||"Чек-лист",C_INK,C_CREAM,24);
    cSet(ctx,cFont.num(220),-4); ctx.fillStyle=C_OR; ctx.fillText(String(idx).padStart(2,"0"),CM-10,CM+70);
    const y=CM+380; const hd=cBlock(ctx,CM,y,pt.head||"Вопрос",cFont.title(80),C_INK,CW-2*CM,88,-1.5);
    const bd=cBlock(ctx,CM,y+hd.h+36,pt.body||"",cFont.body(44),C_MUT,CW-2*CM-20,60);
    let boxTop=CH-CM-80;
    if(pt.check){ cSet(ctx,cFont.semi(38),0); const ls=cWrap(ctx,cTypo(pt.check,true),CW-2*CM-110); const bh=56+ls.length*52; const yy=CH-CM-80-bh; boxTop=yy;
      ctx.strokeStyle=C_INK; ctx.lineWidth=3; ctx.strokeRect(CM+1.5,yy+1.5,CW-2*CM-3,bh-3); ctx.fillStyle=C_OR; ctx.fillRect(CM,yy,14,bh); ctx.fillStyle=C_INK; ls.forEach((l,i)=>ctx.fillText(l,CM+50,yy+28+i*52)); }
    if(hd.n>3) warn.push("вопрос длиннее 3 строк"); if(y+hd.h+36+bd.h>boxTop-20) warn.push("текст налезает на проверку");
    cFooter(ctx,idx+1,total,C_INK,false);
  } else { const f=spec.final||{};
    ctx.fillStyle=C_INK; ctx.fillRect(0,0,CW,CH); cRings(ctx,CW-40,260,[80,160,240,320],"rgb(70,66,60)",3);
    cLabel(ctx,CM,CM,f.label||"сохрани",C_OR,C_INK);
    const y=CM+140; const t=cBlock(ctx,CM,y,f.title||"Итог",cFont.title(88),C_CREAM,CW-2*CM,92,-2);
    const b=cBlock(ctx,CM,y+t.h+36,f.body||"",cFont.body(38),"rgb(200,192,178)",CW-2*CM-40,54);
    const yy=y+t.h+36+b.h+60;
    if(f.cta){ ctx.fillStyle=C_OR; ctx.fillRect(CM,yy,CW-2*CM,190); cBlock(ctx,CM+40,yy+36,f.cta,cFont.title(46),C_INK,CW-2*CM-80,54,-1); }
    if(f.source){ cSet(ctx,cFont.mono(22),.5); ctx.fillStyle="rgb(160,152,140)"; ctx.fillText(f.source,CM,CH-CM-90); }
    if(yy+190>CH-CM-110) warn.push("текст не влезает на карточку");
    cFooter(ctx,total,total,C_CREAM,true);
  }
  c.warn=warn; return c;
}
const carCount = spec => (spec&&spec.points?spec.points.length:0)+2;
function carCaption(spec,i){ const n=(spec.points||[]).length; return i===0?"Обложка":i<=n?String(i).padStart(2,"0")+" "+String((spec.points[i-1]||{}).head||"").slice(0,40):"Финал"; }
async function carToBlobs(spec){ await carFonts(); const out=[]; for(let i=0;i<carCount(spec);i++){ const c=drawCarCard(spec,i); out.push(await new Promise(ok=>c.toBlob(ok,"image/png"))); } return out; }
async function genCarousel(d, wish){
  const prompt=TEXT_RULES+"\n\nСделай карусель для Telegram-канала по этому посту: обложка, от 3 до 7 карточек-пунктов и финальная карточка. Каждый пункт — один вопрос или правило с объяснением и проверкой, которую читатель сделает сам.\nПОСТ:\nЗаголовок: "+d.title+"\nРубрика: "+(d.label||d.section)+"\nТекст:\n"+String(d.full_text||"").slice(0,3500)+(wish?"\n\nПОЖЕЛАНИЕ РЕДАКТОРА: "+wish:"")+
  "\n\nОграничения длины, иначе текст не влезет: cover.title до 45 знаков, cover.subtitle до 110, cover.label 1–2 слова; points[].head до 55 знаков (вопрос или правило), points[].body до 150 знаков, points[].check до 80 знаков (тест, начинается с глагола); final.title до 45, final.body до 120, final.cta до 70 (призыв прислать работу в @designradar_ask_bot или сохранить), final.source — перечисление источников через « · », только тех, что есть в тексте поста. Не добавляй фактов, которых нет в тексте поста.\nОтветь только JSON: {\"cover\":{\"label\":\"\",\"title\":\"\",\"subtitle\":\"\"},\"points\":[{\"head\":\"\",\"body\":\"\",\"check\":\"\"}],\"final\":{\"title\":\"\",\"body\":\"\",\"cta\":\"\",\"source\":\"\"}}";
  const v=await sample.json(prompt,{modelTier:"complex",cache:false});
  if(!v||!v.cover||!Array.isArray(v.points)||!v.points.length) throw {message:"Claude вернул карусель не в том виде. Попробуй ещё раз."};
  v.points=v.points.slice(0,9).map(p=>({head:String(p.head||""),body:String(p.body||""),check:String(p.check||"")})); v.final=v.final||{}; return v;
}
async function rewriteCard(d, spec, idx, mode){
  const kind=idx===0?"cover":idx<=spec.points.length?"point":"final";
  const card=kind==="cover"?spec.cover:kind==="point"?spec.points[idx-1]:spec.final;
  const how={short:"Сделай короче — чтобы точно влезло на карточку.",clear:"Сделай яснее и конкретнее, с примером из интерфейса.",check:"Придумай другую, более наглядную проверку (поле check)."}[mode]||"";
  const prompt=TEXT_RULES+"\n\nКонтекст — пост: "+d.title+"\n"+String(d.full_text||"").slice(0,2000)+"\n\nКарточка карусели ("+kind+"): "+JSON.stringify(card)+"\nЗАДАЧА: "+how+" Сохрани факты, не добавляй новых. Лимиты: head/title до 55 знаков, body до 150, check до 80.\nОтветь только JSON того же вида, с теми же ключами.";
  const v=await sample.json(prompt,{modelTier:"default",cache:false});
  if(!v||typeof v!=="object") throw {message:"Пустой ответ"}; return v;
}

