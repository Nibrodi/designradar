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
const R_TYPES=[["hook","Крючок"],["photo","Фото"],["number","Цифра"],["swatches","Цвета"],["compare","Было / стало"],["list","Список"],["ui","Интерфейс"],["text","Тезис"],["end","Финал"]];
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
const rBack=x=>{ x=rClamp(x); const c=1.7; return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2); };
const reelDur=spec=>(spec&&spec.scenes||[]).reduce((s,x)=>s+rClamp(Number(x.dur)||3,1.2,8),0)||1;
const reelCaption=(sc,i)=>(i+1)+" · "+((R_TYPES.find(t=>t[0]===(sc.type==="title"?"hook":sc.type))||[])[1]||"Сцена");
function reelAcc(sc,bg){ let a=R_ACC[sc.accent||"orange"]||C_OR; if(bg==="orange"&&a===C_OR) a=C_INK; if(bg==="ink"&&a===C_INK) a=C_OR; return a; }
/* безопасный прямоугольник для текста: ниже шапки, выше подписи Reels, левее кнопок */
const R_SX=RM, R_SW=RW-RM-R_RR, R_SY0=410, R_SY1=R_SB;

/* ---- кинетическая типографика: *слово* — маркер акцентом, слова появляются по одному с «толчком» ---- */
function kParse(t, hlLast){
  const ps=String(t||"").replace(/\r/g,"").split("\n").filter((p,i,a)=>p.trim()||a.length===1);
  const hasMark=/\*[^*]+\*/.test(String(t||""));
  return ps.map((p,pi)=>{ const parts=[]; let on=false;
    p.split(/[ \u00A0]+/).filter(Boolean).forEach(w=>{ let s=w, cur=on;
      if(/^[«"(]*\*/.test(s)){ cur=true; s=s.replace(/^([«"(]*)\*/,"$1"); }
      let close=false; if(/\*[»".,!?:;)…—]*$/.test(s)){ close=true; s=s.replace(/\*([»".,!?:;)…—]*)$/,"$1"); }
      s=s.replace(/\*/g,""); if(!s) return;
      parts.push({s, hl:cur||(!hasMark&&hlLast&&pi===ps.length-1&&ps.length>1)}); on=cur&&!close; });
    /* неразрывные пробелы — как в обложках: предлоги и тире не отрываются от слова */
    const segs=cTypo(parts.map(x=>x.s).join(" "),true).split(/([ \u00A0])/); const toks=[];
    if((segs.length+1)/2===parts.length){ let cur=null; parts.forEach((pt,i)=>{ const sep=i?segs[2*i-1]:" "; if(!cur||sep===" "){ cur={parts:[]}; toks.push(cur); } cur.parts.push(pt); }); }
    else parts.forEach(pt=>toks.push({parts:[pt]}));
    toks.forEach(t=>{ t.w=t.parts.map(x=>x.s).join("\u00A0"); t.hl=t.parts.some(x=>x.hl); });
    return toks; }); }
function kLayout(ctx, paras, maxW, s, font){ cSet(ctx,font(s),-Math.round(s/60)); const sp=ctx.measureText(" ").width; const lines=[];
  paras.forEach(toks=>{ let cur=null; const p0=lines.length;
    toks.forEach(t=>{ const tw=ctx.measureText(t.w).width; let pre=""; t.parts=t.parts.map(pt=>{ const off=pre?ctx.measureText(pre+"\u00A0").width:0; pre=pre?pre+"\u00A0"+pt.s:pt.s; return {...pt,off,pw:ctx.measureText(pt.s).width}; }); if(!cur||cur.w+sp+tw>maxW&&cur.toks.length){ cur={toks:[],w:0}; lines.push(cur); } const x=cur.toks.length?cur.w+sp:0; cur.toks.push({...t,x,tw}); cur.w=x+tw; });
    if(!toks.length) lines.push({toks:[],w:0});
    /* висячее слово: последнюю строку из одного слова дополняем словом сверху, если влезает */
    const n=lines.length; if(n-1>p0&&cur&&cur.toks.length===1){ const prev=lines[n-2]; if(prev.toks.length>=3){ const mv=prev.toks[prev.toks.length-1]; const nw=mv.tw+sp+cur.w;
      if(nw<=maxW){ prev.toks.pop(); prev.w=prev.toks.length?prev.toks[prev.toks.length-1].x+prev.toks[prev.toks.length-1].tw:0; const last=cur.toks[0]; cur.toks=[{...mv,x:0},{...last,x:mv.tw+sp}]; cur.w=nw; } } } });
  return lines; }
const K_CACHE=new Map(); try{ document.fonts&&document.fonts.addEventListener("loadingdone",()=>K_CACHE.clear()); }catch(_){ }
function kFit(ctx, text, maxW, maxH, maxS, minS, o){ o=o||{}; const font=o.font||cFont.title; const key=[text,maxW,maxH,maxS,minS,font===cFont.num?'n':font===cFont.body?'b':'t',o.hlLast?1:0,o.lh||0].join('|'); const ready=!document.fonts||document.fonts.check(font(Math.round(maxS))); const ch=ready&&K_CACHE.get(key); if(ch) return ch; const r=kFit0(ctx,text,maxW,maxH,maxS,minS,o,font); if(ready){ if(K_CACHE.size>400) K_CACHE.clear(); K_CACHE.set(key,r); } return r; }
function kFit0(ctx, text, maxW, maxH, maxS, minS, o, font){ const paras=kParse(text,o.hlLast); let best=null;
  for(let s=maxS; s>=minS; s-=4){ const L=kLayout(ctx,paras,maxW,s,font), lh=Math.round(s*(o.lh||1.02));
    best={L,s,lh,h:L.length*lh,font,maxW,over:false}; if(best.h<=maxH && L.every(l=>l.w<=maxW+1)) return best; }
  if(best) best.over=true; return best||{L:[],s:minS,lh:minS,h:0,font,maxW,over:false}; }
/* рисует подогнанный текст; возвращает {end, done} */
function kDraw(ctx, f, x, y, local, o){ o=o||{}; const st=o.start||0, sg=o.stagger??.075; let i=0, done=0;
  cSet(ctx,f.font(f.s),-Math.round(f.s/60));
  f.L.forEach((ln,li)=>{ const lx=o.align==="center"?x+(f.maxW-ln.w)/2:x, ly=y+li*f.lh; const i0=i;
    /* маркер — одним блоком на группу выделенных слов в строке, растёт слева направо */
    const pad=Math.round(f.s*.07); let g=null; const groups=[];
    ln.toks.forEach((t,j)=>t.parts.forEach(pt=>{ const a=t.x+pt.off, b=a+pt.pw; if(pt.hl){ if(!g){ g={a,b,j0:j}; groups.push(g); } else g.b=b; } else g=null; }));
    groups.forEach(g=>{ const t0=st+(i0+g.j0)*sg+.08; const m=o.instant?1:rEase((local-t0)/(.22+.06*(g.b-g.a)/Math.max(1,f.s))); if(m<=0) return;
      ctx.save(); ctx.fillStyle=o.hl||C_OR; ctx.beginPath(); ctx.roundRect(lx+g.a-pad*m, ly+f.s*.1, (g.b-g.a+pad*2)*m, f.s*.94, Math.round(f.s*.1)); ctx.fill(); ctx.restore(); });
    ln.toks.forEach(t=>{ const t0=st+i*sg; i++; const k=o.instant?1:rClamp((local-t0)/.26); if(k<=0) return; const e=rBack(k); done++;
      const tx=lx+t.x, tw=t.tw;
      ctx.save(); ctx.globalAlpha*=Math.min(1,k*1.6); const sc=1+.28*(1-e); ctx.translate(tx+tw/2, ly+f.s*.55); ctx.scale(sc,sc);
      t.parts.forEach(pt=>{ ctx.fillStyle=pt.hl?(o.hlText||"#fff"):(o.color||C_INK); ctx.fillText(pt.s,-tw/2+pt.off,-f.s*.55); }); ctx.restore(); }); });
  return {end:y+f.h, words:i}; }
const kWords=t=>String(t||"").replace(/\*/g,"").split(/\s+/).filter(Boolean).length;

/* фото: размытый фон из того же фото (уменьшить и растянуть) */
function rBlurBg(ctx, im, dim){ const c=document.createElement("canvas"); c.width=27; c.height=48; const x=c.getContext("2d");
  const k=Math.max(27/im.naturalWidth,48/im.naturalHeight); x.drawImage(im,(27-im.naturalWidth*k)/2,(48-im.naturalHeight*k)/2,im.naturalWidth*k,im.naturalHeight*k);
  ctx.save(); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality="high"; ctx.drawImage(c,-40,-40,RW+80,RH+80); ctx.fillStyle="rgba(0,0,0,"+(dim??.45)+")"; ctx.fillRect(0,0,RW,RH); ctx.restore(); }
function rCover(ctx, im, x, y, w, h, z, fx, fy){ const k=Math.max(w/im.naturalWidth,h/im.naturalHeight)*z, iw=im.naturalWidth*k, ih=im.naturalHeight*k;
  ctx.drawImage(im, x+(w-iw)*(fx??.5), y+(h-ih)*(fy??.5), iw, ih); }
const rHex=s=>{ const m=String(s||"").trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i); if(!m) return null; let h=m[1]; if(h.length===3) h=h.split("").map(c=>c+c).join(""); return "#"+h.toLowerCase(); };
function rMix(a,b,t){ const p=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16)); const A=p(a), B=p(b); return "rgb("+A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(",")+")"; }
function rSwatches(sc){ const list=String(sc.colors||"").split(/[\s,;]+/).map(rHex).filter(Boolean); if(list.length>1) return list.slice(0,60);
  const a=rHex(sc.from)||"#0b1f6b", b=rHex(sc.to)||"#7fb2ff", n=Math.max(4,Math.min(60,Number(sc.count)||24)); return Array.from({length:n},(_,i)=>rMix(a,b,n===1?0:i/(n-1))); }
function rCount(v, k){ const s=String(v||""); const m=s.match(/[\d][\d\s .,]*/); if(!m) return s; const raw=m[0].replace(/[\s ]/g,""); const dec=(raw.match(/[.,](\d+)$/)||[])[1]||""; const num=parseFloat(raw.replace(",","."));
  if(!isFinite(num)) return s; const cur=num*k; const f=dec?cur.toFixed(dec.length).replace(".",","):String(Math.round(cur)).replace(/\B(?=(\d{3})+(?!\d))/g," "); return s.slice(0,m.index)+f+(m[0].endsWith(" ")?" ":"")+s.slice(m.index+m[0].length); }

/* одна сцена в момент local (сек от начала сцены); idx — номер сцены в рилсе */
function drawReelScene(ctx, spec, sc, local, dur, warn, idx){
  const type=sc.type==="title"?"hook":sc.type;
  const bg=R_BG[sc.bg]?sc.bg:"cream"; const [B,F,M,CARD]=R_BG[bg]; const A=reelAcc(sc,bg);
  const onA=(A===C_INK||A===R_ACC.blue||A===R_ACC.green||A===C_OR)?"#fff":C_INK;
  ctx.fillStyle=B; ctx.fillRect(0,0,RW,RH);
  const first=idx===0;
  const size=R_SIZE[sc.size]||R_SIZE.M, mul=size/R_SIZE.M;
  const isPhoto=type==="photo", full=isPhoto&&sc.layout!=="card"; let pim=null;
  /* фон */
  if(isPhoto){ pim=rImg(sc.src);
    if(!sc.src) warn.push("выбери фото"); else if(pim&&pim.st==="err") warn.push("фото не открылось — выбери другое или загрузи своё");
    ctx.fillStyle="rgb(28,27,25)"; ctx.fillRect(0,0,RW,RH);
    if(pim&&pim.img){ const z=sc.zoom==="none"?1:sc.zoom==="out"?1.14-.14*rClamp(local/dur):1+.14*rClamp(local/dur);
      if(full){ rCover(ctx,pim.img,0,0,RW,RH,z,{left:0,center:.5,right:1}[sc.fx||"center"],{top:0,center:.5,bottom:1}[sc.fy||"center"]);
        const dm=sc.dim==null?.6:Number(sc.dim); const g=ctx.createLinearGradient(0,RH*.3,0,RH); g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(.5,"rgba(0,0,0,"+(dm*.75)+")"); g.addColorStop(1,"rgba(0,0,0,"+Math.min(.92,dm*1.2)+")"); ctx.fillStyle=g; ctx.fillRect(0,0,RW,RH);
        const g2=ctx.createLinearGradient(0,0,0,R_ST+220); g2.addColorStop(0,"rgba(0,0,0,.5)"); g2.addColorStop(1,"rgba(0,0,0,0)"); ctx.fillStyle=g2; ctx.fillRect(0,0,RW,R_ST+220); }
      else rBlurBg(ctx,pim.img,sc.dim==null?.5:Number(sc.dim)); } }

  /* шапка */
  const dark=isPhoto||bg==="ink";
  if(sc.head!==false){ const lab=String(sc.label||spec.label||"Дизайн-Радар").toUpperCase();
    cSet(ctx,cFont.semi(32),4); const tw=ctx.measureText(lab).width; ctx.fillStyle=bg==="orange"?C_INK:C_OR; ctx.fillRect(RM,R_ST+10,tw+48,64);
    ctx.fillStyle="#fff"; ctx.fillText(lab,RM+24,R_ST+26);
    cSet(ctx,cFont.title(32),0); const br="Дизайн-Радар", bw=ctx.measureText(br).width; ctx.fillStyle=dark?"#fff":F; ctx.fillText(br,RW-R_RR-bw,R_ST+22);
    ctx.fillStyle=bg==="orange"?C_INK:C_OR; ctx.beginPath(); ctx.arc(RW-R_RR-bw-26,R_ST+42,11,0,7); ctx.fill(); }
  ctx.save(); const pz=1+.04*(1-rEase(local/.2))*(first?0:1); ctx.translate(RW/2,RH/2); ctx.scale(pz,pz); ctx.translate(-RW/2,-RH/2);
  const tc=dark?"#fff":F, mc=dark?"rgba(255,255,255,.78)":M;
  const st0=first?-.6:-.12;
  const kick=(txt,y,col)=>{ if(!txt) return 0; cSet(ctx,cFont.mono(40),3); ctx.fillStyle=col||A; const k=first?1:rEase((local-.02)/.25); const a0=ctx.globalAlpha; ctx.globalAlpha=a0*k; ctx.fillText(String(txt).toUpperCase(),R_SX,y); ctx.globalAlpha=a0; return 76; };
  const subT=(txt,y,start,col,align)=>{ if(!txt) return y; const f=kFit(ctx,txt,R_SW,260,Math.round(46*Math.min(mul,1.1)),34,{font:cFont.body,lh:1.28}); const k=rEase((local-start)/.35); const a0=ctx.globalAlpha; ctx.globalAlpha=a0*k;
    kDraw(ctx,f,R_SX,y+(1-k)*20,local,{instant:true,color:col||mc,align}); ctx.globalAlpha=a0; return y+f.h; };
  if(type==="hook"||type==="text"){
    const kh=sc.kicker?76:0, subH=sc.sub?150:0, maxH=R_SY1-R_SY0-kh-subH-40;
    const f=kFit(ctx,sc.title||"",R_SW,maxH,Math.round((type==="hook"?190:150)*mul),70,{font:type==="hook"?cFont.num:cFont.title,hlLast:type==="text"&&sc.hl!==false});
    const total=kh+f.h+(sc.sub?40+110:0); let y=sc.align==="top"?R_SY0:sc.align==="bottom"?R_SY1-total:R_SY0+Math.max(0,(R_SY1-R_SY0-total)/2);
    y+=kick(sc.kicker,y); const r=kDraw(ctx,f,R_SX,y,local,{start:st0,stagger:type==="hook"?.09:.07,color:tc,hl:A,hlText:onA});
    subT(sc.sub,r.end+40,st0+r.words*.08+.15);
    if(f.over) warn.push("текст не влезает — сократи");
    const need=.5+r.words*.3; if(dur<Math.min(need,6)) warn.push("мало времени на чтение: нужно ~"+need.toFixed(1)+" с");
  } else if(type==="number"){
    const kh=sc.pre?76:0; const k=rEase((local-(first?0:.1))/.9);
    const val=rCount(sc.value||"0",sc.count===false?1:k);
    const vs=String(sc.value||"0"); cSet(ctx,cFont.num(100),-2); const w100=ctx.measureText(vs).width||1; const ns=Math.max(90,Math.min(Math.round(340*mul),Math.floor(100*R_SW/w100*.97))); const nf={s:ns,h:Math.round(ns*1.02),over:ns<=90&&w100*.9>R_SW};
    const tf=sc.title?kFit(ctx,sc.title,R_SW,520,Math.round(96*mul),54):null;
    const total=kh+nf.h+(tf?40+tf.h:0); let y=sc.align==="top"?R_SY0:sc.align==="bottom"?R_SY1-total:R_SY0+Math.max(0,(R_SY1-R_SY0-total)/2);
    y+=kick(sc.pre,y);
    cSet(ctx,cFont.num(nf.s),-Math.round(nf.s/50)); ctx.fillStyle=A===C_INK&&bg==="ink"?C_OR:(bg==="orange"?C_INK:A); const pop=1+.06*Math.sin(rClamp((local-.9)/.25)*Math.PI);
    ctx.save(); ctx.translate(R_SX,y+nf.s*.5); ctx.scale(pop,pop); ctx.fillText(val,0,-nf.s*.5); ctx.restore();
    if(tf) kDraw(ctx,tf,R_SX,y+nf.h+40,local,{start:(first?0:.5),stagger:.06,color:tc,hl:A,hlText:onA});
    if(nf.over) warn.push("число слишком длинное"); if(tf&&tf.over) warn.push("подпись не влезает");
  } else if(type==="swatches"){
    const cols=rSwatches(sc), n=cols.length; const tf=sc.title?kFit(ctx,sc.title,R_SW,300,Math.round(104*mul),56):null;
    let y=R_SY0; if(tf){ kDraw(ctx,tf,R_SX,y,local,{start:st0,stagger:.06,color:tc,hl:A,hlText:onA}); y+=tf.h+40; }
    const gw=RW-2*RM, areaH=R_SY1-y-(sc.pickLabel?120:20); let c=Math.max(3,Math.min(9,Math.ceil(Math.sqrt(n*gw/areaH)))); { let best=c, bs=1e9; for(let q=Math.max(3,c-2);q<=Math.min(10,c+2);q++){ const rw=Math.ceil(n/q), empty=rw*q-n; const cw0=(gw-(q-1)*10)/q; if(rw*(Math.min(cw0*1.25,(areaH-(rw-1)*10)/rw)+10)>areaH+10) continue; const sc0=empty*3+Math.abs(q-c); if(sc0<bs){ bs=sc0; best=q; } } c=best; } const rows=Math.ceil(n/c);
    const gap=10, cw=(gw-(c-1)*gap)/c, ch=Math.min(cw*1.25,(areaH-(rows-1)*gap)/rows);
    const pick=Math.min(n-1,Math.max(0,(Number(sc.pick)||Math.ceil(n*.55))-1)); const tp=Math.max(1.2,dur*.55); const fade=sc.pick===0?0:rEase((local-tp)/.4);
    cols.forEach((col,i)=>{ const r=Math.floor(i/c), q=i%c; const x=RM+q*(cw+gap), yy=y+r*(ch+gap); const t0=.15+i*Math.min(.04,1.1/n); const k=rBack(rClamp((local-t0)/.3)); if(k<=0) return;
      ctx.save(); ctx.globalAlpha*=(i===pick?1:1-fade*.55)*rClamp((local-t0)/.15); ctx.translate(x+cw/2,yy+ch/2); const s=(i===pick?1+.12*fade:1)*(.4+.6*k); ctx.scale(s,s);
      ctx.fillStyle=col; ctx.beginPath(); ctx.roundRect(-cw/2,-ch/2,cw,ch,Math.min(18,cw*.18)); ctx.fill();
      if(i===pick&&fade>0){ ctx.lineWidth=8; ctx.strokeStyle=dark?"#fff":C_INK; ctx.stroke(); } ctx.restore(); });
    if(sc.pickLabel&&fade>0){ const yy=y+rows*(ch+gap)+30; cSet(ctx,cFont.title(54),-1); ctx.fillStyle=tc; const a0=ctx.globalAlpha; ctx.globalAlpha=a0*fade; ctx.fillText(sc.pickLabel,R_SX,yy); ctx.globalAlpha=a0; }
    if(tf&&tf.over) warn.push("заголовок не влезает");
  } else if(type==="compare"){
    const tf=sc.title?kFit(ctx,sc.title,R_SW,240,Math.round(84*mul),50):null; let y=R_SY0; if(tf){ kDraw(ctx,tf,R_SX,y,local,{start:st0,stagger:.06,color:tc,hl:A,hlText:onA}); y+=tf.h+34; }
    const gap=30, ph=(R_SY1-y-gap)/2, W=RW-2*RM;
    const panel=(side,yy,k,lab,txt,col,src,accent)=>{ if(k<=0) return; ctx.save(); ctx.beginPath(); ctx.roundRect(RM,yy,W*k,ph,36); ctx.clip();
      ctx.fillStyle=rHex(col)||CARD; ctx.fillRect(RM,yy,W,ph); const im=src?rImg(src):null; if(im&&im.img) rCover(ctx,im.img,RM,yy,W,ph,1+.05*k);
      const onCol=rHex(col)||(im&&im.img)?"#fff":(bg==="ink"?C_CREAM:C_INK);
      if(im&&im.img){ const g=ctx.createLinearGradient(0,yy+ph*.4,0,yy+ph); g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(1,"rgba(0,0,0,.7)"); ctx.fillStyle=g; ctx.fillRect(RM,yy,W,ph); }
      cSet(ctx,cFont.title(40),0); const lw=ctx.measureText(String(lab||"").toUpperCase()).width; ctx.fillStyle=accent?A:(bg==="ink"?C_CREAM:C_INK); ctx.fillRect(RM+36,yy+36,lw+40,64); ctx.fillStyle=accent?onA:(bg==="ink"?C_INK:"#fff"); ctx.fillText(String(lab||"").toUpperCase(),RM+56,yy+48);
      if(txt){ const f=kFit(ctx,txt,W-110,ph-170,Math.round(78*mul),40); kDraw(ctx,f,RM+40,yy+ph-40-f.h,1,{instant:true,color:rHex(col)&&!im?(/^#(f|e|d)/i.test(rHex(col))?C_INK:"#fff"):onCol,hl:A,hlText:onA}); if(f.over) warn.push("текст «"+lab+"» не влезает"); }
      ctx.restore(); };
    const ka=first?1:rEase(local/.35), kb=rEase((local-Math.max(.8,dur*.35))/.45);
    panel("a",y,ka,sc.a_label||"Было",sc.a_text,sc.a_color,sc.a_src,false); panel("b",y+ph+gap,kb,sc.b_label||"Стало",sc.b_text,sc.b_color,sc.b_src,true);
  } else if(type==="list"){
    const items=String(sc.items||"").split("\n").map(s=>s.trim()).filter(Boolean).slice(0,5); const tf=sc.title?kFit(ctx,sc.title,R_SW,300,Math.round(100*mul),56):null;
    let y=R_SY0; if(tf){ kDraw(ctx,tf,R_SX,y,local,{start:st0,stagger:.06,color:tc,hl:A,hlText:onA}); y+=tf.h+50; }
    const n=Math.max(1,items.length), slot=(R_SY1-y)/n, step=Math.max(.45,(dur-.8)/n);
    items.forEach((it,i)=>{ const t0=(tf?.5:.1)+i*step; const k=rBack(rClamp((local-t0)/.3)); if(k<=0) return; const yy=y+i*slot;
      const mk=sc.mark||"num"; const isNo=mk==="no"||(mk==="mix"&&i<n-1); const sym=mk==="num"?String(i+1):isNo?"✕":"✓"; const bc=mk==="num"?A:isNo?"rgb(200,60,50)":R_ACC.green;
      ctx.save(); ctx.globalAlpha*=rClamp((local-t0)/.15); ctx.translate((1-k)*-60,0);
      ctx.fillStyle=bc; ctx.beginPath(); ctx.arc(R_SX+44,yy+46,44,0,7); ctx.fill(); cSet(ctx,cFont.num(48),0); ctx.fillStyle=bc===C_CREAM?C_INK:"#fff"; const sw=ctx.measureText(sym).width; ctx.fillText(sym,R_SX+44-sw/2,yy+20);
      const f=kFit(ctx,it,R_SW-120,Math.max(90,slot-30),Math.round(70*mul),38); kDraw(ctx,f,R_SX+120,yy+Math.max(0,(92-f.lh)/2),1,{instant:true,color:tc,hl:A,hlText:onA}); if(f.over) warn.push("пункт "+(i+1)+" не влезает");
      ctx.restore(); });
    if(!items.length) warn.push("добавь пункты — по одному на строку");
  } else if(isPhoto){
    const cr=sc.credit?String(sc.credit):"";
    if(full){ const maxH=Math.round((R_SY1-R_SY0)*.55), f=kFit(ctx,sc.title||"",R_SW,maxH,Math.round(150*mul),60,{hlLast:!!sc.hl});
      const sf=sc.sub?kFit(ctx,sc.sub,R_SW,200,44,32,{font:cFont.body,lh:1.28}):null; const total=f.h+(sf?30+sf.h:0)+(cr?60:0);
      let y=sc.align==="top"?R_SY0:sc.align==="center"?R_SY0+(R_SY1-R_SY0-total)/2:R_SY1-total;
      const r=kDraw(ctx,f,R_SX,y,local,{start:first?-.6:.15,stagger:.08,color:"#fff",hl:A===C_INK?C_OR:A,hlText:"#fff"}); y=r.end;
      if(sf){ y+=30; const k=rEase((local-.6)/.35); const a0=ctx.globalAlpha; ctx.globalAlpha=a0*k; kDraw(ctx,sf,R_SX,y,1,{instant:true,color:"rgba(255,255,255,.85)"}); ctx.globalAlpha=a0; y+=sf.h; }
      if(cr){ cSet(ctx,cFont.mono(24),1); ctx.fillStyle="rgba(255,255,255,.65)"; ctx.fillText("ФОТО: "+cr.toUpperCase(),R_SX,y+30); }
      if(f.over) warn.push("текст на фото не влезает — сократи"); }
    else { const f=sc.title?kFit(ctx,sc.title,R_SW,380,Math.round(104*mul),52,{hlLast:!!sc.hl}):null; const th=f?f.h+30:0; const cr2=cr?44:0;
      const W=RW-2*RM; let ph=R_SY1-R_SY0-th-cr2; if(pim&&pim.img) ph=Math.min(ph,Math.round(W*pim.img.naturalHeight/pim.img.naturalWidth));
      const y0=sc.align==="bottom"?R_SY1-th-cr2-ph:sc.align==="top"?R_SY0:R_SY0+(R_SY1-R_SY0-th-cr2-ph)/2;
      ctx.save(); ctx.shadowColor="rgba(0,0,0,.45)"; ctx.shadowBlur=60; ctx.shadowOffsetY=20; ctx.fillStyle="rgb(60,58,54)"; ctx.beginPath(); ctx.roundRect(RM,y0,W,ph,36); ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.roundRect(RM,y0,W,ph,36); ctx.clip(); if(pim&&pim.img){ const z=sc.zoom==="none"?1:sc.zoom==="out"?1.08-.08*rClamp(local/dur):1+.08*rClamp(local/dur); rCover(ctx,pim.img,RM,y0,W,ph,z); } ctx.restore();
      let y=y0+ph+(cr?20:0); if(cr){ cSet(ctx,cFont.mono(24),1); ctx.fillStyle="rgba(255,255,255,.65)"; ctx.fillText("ФОТО: "+cr.toUpperCase(),RM,y); y+=cr2-20; }
      if(f){ kDraw(ctx,f,R_SX,y+30,local,{start:first?-.6:.2,stagger:.07,color:"#fff",hl:A===C_INK?C_OR:A,hlText:"#fff"}); if(f.over) warn.push("подпись под фото не влезает"); } }
    if(!pim||pim.st==="loading"){ cSet(ctx,cFont.body(36),0); ctx.fillStyle="rgba(255,255,255,.6)"; if(sc.src) ctx.fillText("фото загружается…",RM,RH/2); }
  } else if(type==="ui"){
    const ph=(sc.phases||[]).filter(Boolean).slice(0,3); const n=Math.max(1,ph.length); const k=Math.min(n-1,Math.floor(local/(dur/n))); const p=ph[k]||{}; const pl=local-k*dur/n, pd=dur/n;
    const top=410, ch=R_SB-top-110, W=RW-2*RM;
    if(p.tag){ cSet(ctx,cFont.title(46),0); const tw=ctx.measureText(p.tag.toUpperCase()).width; ctx.fillStyle=(k===n-1&&n>1)?A:F; ctx.fillRect(RM,top,tw+44,74); ctx.fillStyle=(k===n-1&&n>1)?onA:B; ctx.fillText(p.tag.toUpperCase(),RM+22,top+14); }
    const y0=top+110; ctx.fillStyle=CARD; ctx.strokeStyle=bg==="cream"?"rgb(216,210,198)":"rgba(0,0,0,.12)"; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect(RM,y0,W,ch,44); ctx.fill(); ctx.stroke();
    const ink=bg==="ink"?C_CREAM:C_INK, soft=bg==="ink"?"rgb(70,67,62)":"rgb(226,220,208)";
    let y=y0+80; const x=RM+70, iw=W-140;
    if(p.head){ const hl=cBlock(ctx,x,y,p.head,cFont.title(64),ink,iw,74,-1,true); y+=hl.h+50; }
    const kind=p.kind||"list";
    if(kind==="list"||kind==="skeleton"){ const sk=kind==="skeleton"; const pulse=sk?.55+.45*Math.sin(local*7):1;
      if(sk&&!p.head){ ctx.fillStyle=soft; ctx.beginPath(); ctx.roundRect(x,y,300,56,28); ctx.fill(); y+=120; }
      for(let i=0;i<(p.caption?3:4);i++){ const yy=y+i*150; const a0=ctx.globalAlpha; ctx.globalAlpha=a0*(sk?pulse:rClamp((pl-.08*i)/.2));
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
  } else { /* end */
    const f=kFit(ctx,sc.title||"Больше разборов —\nв *Дизайн-Радаре*",R_SW,560,Math.round(130*mul),60);
    const total=200+f.h+(sc.sub?150:0); let y=R_SY0+Math.max(0,(R_SY1-R_SY0-total)/2);
    { const k=rBack(rClamp(local/.4)); ctx.save(); ctx.translate(R_SX+80,y+80); ctx.scale(k,k); ctx.fillStyle=bg==="orange"?C_INK:C_OR; ctx.beginPath(); ctx.arc(0,0,80,0,7); ctx.fill();
      cSet(ctx,cFont.num(76),-3); ctx.fillStyle=bg==="orange"?C_OR:C_INK; const mw=ctx.measureText("ДР").width; ctx.fillText("ДР",-mw/2,-44); ctx.restore(); y+=200; }
    const r=kDraw(ctx,f,R_SX,y,local,{start:.05,stagger:.07,color:tc,hl:A,hlText:onA}); subT(sc.sub,r.end+40,.5);
  }
  ctx.restore();
}
function drawReelFrame(ctx, spec, t){
  const sc=spec.scenes||[]; let acc=0; const warn=[];
  for(let i=0;i<sc.length;i++){ const d=rClamp(Number(sc[i].dur)||3,1.2,8); if(t<acc+d||i===sc.length-1){ drawReelScene(ctx,spec,sc[i],Math.min(t-acc,d),d,warn,i); return {i,warn}; } acc+=d; }
  ctx.fillStyle=C_CREAM; ctx.fillRect(0,0,RW,RH); return {i:-1,warn};
}
function reelSceneStart(spec,i){ let a=0; for(let k=0;k<i;k++) a+=rClamp(Number(spec.scenes[k].dur)||3,1.2,8); return a; }
function reelThumb(spec,i,cv){ const c=document.createElement("canvas"); c.width=RW; c.height=RH; const ctx=c.getContext("2d"); ctx.textBaseline="top";
  const sc=spec.scenes[i], d=rClamp(Number(sc.dur)||3,1.2,8); const w=[]; drawReelScene(ctx,spec,sc,sc.type==="ui"?Math.min(d-.3,d/((sc.phases||[]).length||1)*.6):Math.max(.1,d-.2),d,w,i);
  if(cv) cv.getContext("2d").drawImage(c,0,0,cv.width,cv.height); return w; }

function reelBlank(type){
  const base={bg:"cream",accent:"orange",size:"M"};
  if(type==="photo") return {...base,type:"photo",dur:2.6,layout:"full",zoom:"in",src:"",title:"",sub:"",credit:"",hl:false,bg:"ink",dim:.6};
  if(type==="ui") return {...base,type:"ui",dur:4.5,phases:[{tag:"Было",head:"Заголовок экрана",kind:"list",caption:"Подпись"},{tag:"Стало",head:"",kind:"skeleton",caption:"Подпись"}]};
  if(type==="text") return {...base,type:"text",dur:2.4,bg:"ink",title:"Главная мысль\nс *выделением*"};
  if(type==="number") return {...base,type:"number",dur:2.4,pre:"",value:"228",title:"дней на *две линии*"};
  if(type==="swatches") return {...base,type:"swatches",dur:3.4,title:"*41* оттенок синего",from:"#0b1f6b",to:"#7fb2ff",count:41,pick:28,pickLabel:"Этот — победил"};
  if(type==="compare") return {...base,type:"compare",dur:3.4,title:"",a_label:"Было",a_text:"Что было",b_label:"Стало",b_text:"Что стало"};
  if(type==="list") return {...base,type:"list",dur:3.6,title:"3 ошибки",items:"Первая\nВторая\nТретья",mark:"num"};
  if(type==="end") return {...base,type:"end",dur:1.8,title:"Разбор целиком —\nв *Дизайн-Радаре*",sub:"@designradar_lab"};
  return {...base,type:"hook",dur:2.2,size:"L",kicker:"",title:"Крючок\nс *главным словом*",sub:""};
}
function reelFromPost(d){
  const ph=reelPhotos(d); const t=plain(d.cover_title||d.title).replace(/\|/g," ").slice(0,60);
  if(ph.length) return {label:d.label||d.section||"Дизайн-Радар", scenes:[...ph.slice(0,4).map((p,i)=>({...reelBlank("photo"), src:p.url, credit:p.cap, title:i===0?t:"", dur:i===0?2.8:2.2})), reelBlank("end")]};
  return {label:d.label||d.section||"Дизайн-Радар", scenes:[{...reelBlank("hook"), title:t},
    {...reelBlank("text"), title:plain(String(d.full_text||"").split(/\n+/).find(x=>x.trim().length>20)||"").slice(0,90)}, reelBlank("end")]};
}
const REEL_CRAFT=`КАК ДЕЛАЮТ СИЛЬНЫЕ РИЛСМЕЙКЕРЫ (обязательно):
1. КРЮЧОК В ПЕРВУЮ СЕКУНДУ. Первая сцена — 3–7 слов, которые останавливают палец: неожиданная цифра, парадокс, «ты делаешь это неправильно», вопрос с подвохом. Не название поста и не «сегодня расскажу». Крючок обещает то, что зритель узнает в конце.
2. ОДНА МЫСЛЬ = ОДНА СЦЕНА. На экране максимум 8–10 слов. Никаких абзацев: если фразу нельзя прочитать за 2 секунды — режь. Ключевое слово каждой сцены выдели звёздочками: *синий*.
3. ПОКАЗЫВАЙ, А НЕ РАССКАЗЫВАЙ. Каждый факт поста превращай в картинку: цифру — в сцену number (счётчик), цвета и оттенки — в swatches, «было/стало» и «плохо/хорошо» — в compare, ошибки/шаги/правила — в list, интерфейсный приём — в ui, реальную работу — в photo. Сцена text — только для поворота мысли или вердикта, не больше двух на рилс.
4. ДУГА: крючок → доказательство (2–3 визуальные сцены с фактами из поста) → поворот/инсайт («и вот почему это работает») → вывод, который хочется сохранить → финал-призыв. Каждая сцена отвечает на вопрос, который родила предыдущая.
5. РИТМ: смена сцены каждые 1,5–3 секунды, весь рилс 9–15 секунд. Длительность сцены = 0,6 с + 0,3 с на слово; визуальные сцены 2,5–3,5 с.
6. СУТЬ ПОСТА должна быть понятна без звука и без текста поста: посмотрел — понял главную мысль и пользу.
7. Финал (end) зовёт за полной версией и может перекликаться с крючком, чтобы ролик хотелось пересмотреть.
8. Контраст фона чередуй: cream / ink / orange, не три одинаковых подряд.`;
async function genReel(d, wish){
  const ph=reelPhotos(d); const lab=String(d.label||d.section||"");
  const kind=(/Находка|Разбор|Ребрендинг/i.test(lab)||(d.kind==="news"&&ph.length))&&ph.length?"photo":/Мысль/i.test(lab)?"thought":"craft";
  const meta=d.photo_meta||{};
  const photos=ph.length?ph.map((p,i)=>{ const m=meta[p.orig||p.url]||{}; return "  "+(i+1)+") фото "+(i+1)+(i===0?" — главное фото поста":"")+(m.what?": "+m.what:"")+(m.text_on_photo?" [НА ФОТО ЕСТЬ СВОЙ КРУПНЫЙ ТЕКСТ — только layout \"card\" и не первым]":"")+(m.orientation?" ["+m.orientation+"]":"")+(p.cap?" (автор: "+p.cap+")":""); }).join("\n"):"  нет";
  const plans={
    photo:"Пост о реальной работе: основа — ФОТО ПОСТА (3–4 сцены photo, каждое фото — один факт или деталь), плюс number, если в посте есть яркая цифра, и compare, если есть «было/стало». Первое фото — без собственного текста. Ui не используй.",
    craft:"Пост о приёме: основа — визуальные сцены, которые ПОКАЗЫВАЮТ приём из этого поста (swatches, compare, list, number, ui). Ни одной сцены «для красоты».",
    thought:"Короткая мысль: hook → 1–2 text (поворот) → end. Можно number, если в мысли есть цифра."};
  const prompt=TEXT_RULES+"\n\n"+REEL_CRAFT+"\n\nСделай сценарий вертикального рилса по ЭТОМУ посту канала «Дизайн-Радар». Видео рисуется кодом из сцен: ты пишешь тексты, выбираешь сцены и данные для них.\n\nПОСТ:\nЗаголовок: "+d.title+"\nРубрика: "+lab+"\nТекст:\n"+String(d.full_text||"").slice(0,3500)+"\n\nФОТО ПОСТА:\n"+photos+(wish?"\n\nПОЖЕЛАНИЕ РЕДАКТОРА (главное): "+wish:"")+
  "\n\nСНАЧАЛА: idea — одна мысль рилса одной фразой; hook_promise — что зритель узнает к концу. Все факты, цифры, имена — только из поста.\nОСНОВА ДЛЯ ЭТОГО ПОСТА: "+plans[kind]+
  "\n\nТИПЫ СЦЕН (поля):\n- hook: {type:\"hook\", kicker (необяз., 1–3 слова над крючком: «Google, 2009»), title (3–7 слов, строки через \\n, *ключевое слово*), sub (необяз., до 60 знаков)}\n- number: {type:\"number\", pre (необяз., 1–4 слова над числом), value (число с единицей, как в посте: «41», «+200 млн $», «228 дней» — до 12 знаков), title (что это число значит, до 50 знаков, *ключевое*)}\n- swatches: {type:\"swatches\", title (до 40 знаков), colors (список hex через пробел, 6–48 цветов) ИЛИ from/to (hex) + count, pick (номер выделенного цвета, с 1), pickLabel (до 26 знаков)} — только когда речь о цветах.\n- compare: {type:\"compare\", title (необяз., до 40), a_label (1–2 слова: «Было», «Плохо», «Обычно»), a_text (до 45 знаков), a_color (необяз. hex, если сравниваются цвета), a_photo (необяз. номер фото), b_label, b_text, b_color, b_photo}\n- list: {type:\"list\", title (до 35 знаков), items (2–4 пункта через \\n, каждый до 40 знаков, *ключевое*), mark: \"num\"|\"ok\"|\"no\"|\"mix\" (mix: все ✕, последний ✓)}\n- photo: {type:\"photo\", photo: номер фото, layout: \"full\"|\"card\", title (до 45 знаков, *ключевое*), sub (необяз., до 60), fx/fy (кадрирование: left|center|right / top|center|bottom), zoom: \"in\"|\"out\"}\n- ui: {type:\"ui\", phases:[1–3 × {tag (до 14), head (до 30), kind: \"list\"|\"skeleton\"|\"progress\", value, note, caption (до 28)}]}\n- text: {type:\"text\", title (до 60 знаков, *ключевое*), bg: \"cream\"|\"ink\"|\"orange\"}\n- end: {type:\"end\", title (призыв за полной версией, до 40 знаков, *ключевое*), sub:\"@designradar_lab\"}\nУ КАЖДОЙ сцены: dur (секунды по правилу ритма), bg (\"cream\"|\"ink\"|\"orange\", чередуй). 4–7 сцен. Первая — hook (или photo с крючком), последняя — end.\nОтветь только JSON: {\"idea\":\"…\",\"hook_promise\":\"…\",\"label\":\"рубрика 1–2 слова\",\"scenes\":[…]}";
  const v=await sample.json(prompt,{modelTier:"complex",cache:false});
  if(!v||!Array.isArray(v.scenes)||!v.scenes.length) throw {message:"Claude вернул сценарий не в том виде. Попробуй ещё раз."};
  const cr=(ph[0]&&ph[0].cap)||"";
  const okT=new Set(R_TYPES.map(x=>x[0]).concat(["title"]));
  v.scenes=v.scenes.slice(0,8).map(s0=>{ let t=okT.has(s0.type)?s0.type:"text"; if(t==="title") t="hook"; const o={...reelBlank(t), ...s0, type:t};
    if(t==="photo"){ const n=Math.max(1,Math.min(ph.length,Number(s0.photo)||1)); const p=ph[n-1]; if(!p) return {...reelBlank("text"), title:String(s0.title||""), dur:s0.dur||2.4}; o.src=p.url; o.credit=p.cap||cr; delete o.photo; }
    if(t==="compare"){ ["a","b"].forEach(k=>{ const n=Number(s0[k+"_photo"]); if(n&&ph[n-1]) o[k+"_src"]=ph[n-1].url; delete o[k+"_photo"]; }); }
    if(t==="ui") o.phases=Array.isArray(s0.phases)?s0.phases.slice(0,3):reelBlank("ui").phases; else delete o.phases;
    if(Array.isArray(o.items)) o.items=o.items.join("\n"); if(Array.isArray(o.colors)) o.colors=o.colors.join(" ");
    const words=kWords(o.title)+kWords(o.sub)+kWords(o.items)+kWords(o.a_text)+kWords(o.b_text);
    const auto=rClamp(.6+.3*words,1.6,4.2); const vis={swatches:3,compare:3.2,list:3.4,ui:4.5,number:2.4,photo:2.4}[t]||0;
    o.dur=Number(s0.dur)>0?rClamp(Math.max(Number(s0.dur),Math.min(auto,4.2)),1.4,6):Math.max(auto,vis);
    return o; });
  return {idea:String(v.idea||""), promise:String(v.hook_promise||""), label:String(v.label||lab||""), scenes:v.scenes, v:2};
}

async function recordReel(spec, onProgress){
  await carFonts(); K_CACHE.clear();
  const phs=[].concat(...(spec.scenes||[]).map(x=>[x.type==="photo"?x.src:"",x.type==="compare"?x.a_src:"",x.type==="compare"?x.b_src:""])).filter(Boolean).map(u=>rImg(u));
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
    sc.type==="ui"?null:seg(sc,"size",[["S","Меньше"],["M","Обычно"],["L","Крупнее"]],"Текст","M"),
    seg(sc,"align",[["top","Выше"],["center","Центр"],["bottom","Ниже"]],"Место","center"),
    seg(sc,"head",[[true,"Шапка"],[false,"Без шапки"]],"Верх",true),
    (()=>{ const r=h("input",{type:"range",min:"1.5",max:"8",step:"0.5",value:String(sc.dur||3),disabled:ro}); const v=h("b",{text:(sc.dur||3)+" с"}); r.addEventListener("input",()=>{ sc.dur=Number(r.value); v.textContent=r.value+" с"; commit(); }); return h("div",{class:"rseg"},h("span",{class:"rsl",text:"Длительность"}),r,v); })());
  const photoPick=(sc,redraw,key,lab)=>{ key=key||"src"; const list=reelPhotos(d); if(sc[key]&&!list.some(p=>p.url===sc[key])) list.push({url:sc[key],cap:sc.credit||""});
    const row=h("div",{class:"rpick"});
    list.forEach(p=>{ const im=h("img",{src:R_LOCAL.get(p.url)||p.url,alt:"",referrerpolicy:"no-referrer",loading:"lazy"}); im.addEventListener("error",()=>{ im.replaceWith(h("span",{class:"rpfail",text:"не открылось"})); });
      row.append(h("button",{type:"button",class:"rph"+(sc[key]===p.url?" on":""),disabled:ro,title:p.cap||"",onclick:()=>{ sc[key]=sc[key]===p.url&&key!=="src"?"":p.url; if(key==="src"&&!sc.credit&&p.cap) sc.credit=p.cap; commit(); redraw(); ensurePhotos(); }},im)); });
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
        spec.idea?h("div",{class:"ridea"}, h("b",{text:"Мысль рилса: "}), spec.idea, spec.promise?h("div",{class:"hint",text:"Крючок обещает: "+spec.promise}):null):null,
        igCaptionBox(d, spec, ro, commit),
        (!ro&&sample)?(()=>{ const wi=h("input",{type:"text",placeholder:"Пожелание: «начни с цифры 228», «больше про дугу в логотипе»…"}); return h("div",{class:"airow rwish"}, wi, h("button",{type:"button",class:"btn sm aibtn",onclick:async(e)=>{ const b=e.currentTarget; b.disabled=true; b.textContent="Claude думает…"; try{ { const keep=spec&&spec.ig_caption; spec=await genReel(d,wi.value.trim()); if(keep) spec.ig_caption=keep; } commit(); draw(); }catch(er){ toast((er&&er.message)||"Не получилось"); b.disabled=false; b.textContent="✦ Новый сценарий"; } }},"✦ Новый сценарий")); })():null,
        ro?null:h("button",{type:"button",class:"btn sm ghost danger",onclick:()=>{ spec=null; d.reel=null; changed(); draw(); }},"Удалить рилс")));
    const list=h("div",{class:"cards"}); const n=spec.scenes.length;
    spec.scenes.forEach((sc,i)=>{
      const cv=h("canvas",{class:"rthumb",width:"108",height:"192"}); const w=h("div",{class:"cwarn",hidden:true});
      const body=h("div",{class:"cbody"}); const redraw=()=>{ fill(); redrawThumbs(); };
      const fill=()=>{ const f=[];
        if(sc.type==="title") sc.type="hook"; f.push(seg(sc,"type",R_TYPES,"Тип сцены","hook",()=>{ const nb=reelBlank(sc.type); Object.keys(nb).forEach(k=>{ if(sc[k]==null||sc[k]==="") sc[k]=nb[k]; }); if(sc.type==="ui"&&!(sc.phases&&sc.phases.length)) sc.phases=reelBlank("ui").phases; if(sc.type==="photo"&&!sc.src){ const p=reelPhotos(d)[0]; if(p){ sc.src=p.url; sc.credit=sc.credit||p.cap; } sc.layout=sc.layout||"full"; } redraw(); }));
        if(sc.type==="ui"){ if(!Array.isArray(sc.phases)||!sc.phases.length) sc.phases=reelBlank("ui").phases; sc.phases.forEach((_,j)=>f.push(phaseFields(sc,j,redraw)));
          if(!ro&&sc.phases.length<3) f.push(h("button",{type:"button",class:"btn sm",onclick:()=>{ sc.phases.push({tag:"",head:"",kind:"list",caption:""}); commit(); redraw(); }},"+ Экран")); }
        else if(sc.type==="number"){ f.push(fld(sc,"pre","Над числом","необязательно: «Google, 2009»")); f.push(fld(sc,"value","Число","41 · +200 млн $ · 228 дней")); f.push(fld(sc,"title","Что значит число","*слово* — выделить маркером",true,2)); }
        else if(sc.type==="swatches"){ f.push(fld(sc,"title","Заголовок","*41* оттенок синего",true,2)); f.push(fld(sc,"colors","Цвета (hex через пробел) — или оставь пустым и задай градиент ниже","#1a73e8 #2962ff …",true,2));
          f.push(h("div",{class:"row2"}, fld(sc,"from","От цвета","#0b1f6b"), fld(sc,"to","До цвета","#7fb2ff"))); f.push(h("div",{class:"row2"}, fld(sc,"count","Сколько оттенков","41"), fld(sc,"pick","Какой выделить (номер)","28"))); f.push(fld(sc,"pickLabel","Подпись к выделенному","Этот — победил")); }
        else if(sc.type==="compare"){ f.push(fld(sc,"title","Над сравнением","необязательно",true,2));
          f.push(h("div",{class:"rphase"}, h("b",{text:"Верх"}), h("div",{class:"row2"}, fld(sc,"a_label","Плашка","Было"), fld(sc,"a_color","Цвет фона (hex)","необязательно")), fld(sc,"a_text","Текст","Что было",true,2), photoPick(sc,redraw,"a_src","Фото (необязательно, нажми ещё раз — убрать)")));
          f.push(h("div",{class:"rphase"}, h("b",{text:"Низ"}), h("div",{class:"row2"}, fld(sc,"b_label","Плашка","Стало"), fld(sc,"b_color","Цвет фона (hex)","необязательно")), fld(sc,"b_text","Текст","Что стало",true,2), photoPick(sc,redraw,"b_src","Фото (необязательно, нажми ещё раз — убрать)"))); }
        else if(sc.type==="list"){ f.push(fld(sc,"title","Заголовок","3 ошибки",true,2)); f.push(fld(sc,"items","Пункты — каждый с новой строки","Первый\nВторой\nТретий",true,4)); f.push(seg(sc,"mark",[["num","1 2 3"],["ok","✓"],["no","✕"],["mix","✕ … ✓"]],"Значки","num")); }
        else if(sc.type==="photo"){ f.push(photoPick(sc,redraw));
          f.push(fld(sc,"title","Текст на фото","Новая строка — Enter",true,3)); f.push(fld(sc,"sub","Подпись мельче","необязательно",true,2)); f.push(fld(sc,"credit","Автор фото","Студия Артемия Лебедева"));
          f.push(seg(sc,"layout",[["full","На весь экран"],["card","Карточкой"]],"Как показать","full",redraw));
          f.push(seg(sc,"zoom",[["in","Приближение"],["out","Отдаление"],["none","Без движения"]],"Движение","in"));
          if(sc.layout!=="card"){ f.push(seg(sc,"fx",[["left","Левый край"],["center","Центр"],["right","Правый край"]],"Кадр по ширине","center")); f.push(seg(sc,"fy",[["top","Верх"],["center","Центр"],["bottom","Низ"]],"Кадр по высоте","center")); }
          f.push(seg(sc,"hl",[[true,"Последняя строка"],[false,"Без выделения"]],"Цветом акцента",false));
          f.push(seg(sc,"dim",[[.3,"Светлее"],[.6,"Обычно"],[.85,"Темнее"]],"Затемнение",.6)); }
        else { if(sc.type==="hook") f.push(fld(sc,"kicker","Над крючком","необязательно: «Google, 2009»"));
          f.push(fld(sc,"title",sc.type==="text"?"Тезис":sc.type==="end"?"Призыв":"Крючок: 3–7 слов","*слово* — выделить маркером · новая строка — Enter",true,3));
          f.push(fld(sc,"sub","Подпись мельче","необязательно",true,2)); }
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
    box.replaceChildren(head, impSt, top, photoBar, list, add); setTimeout(ensurePhotos,0);
    showVideo(); carFonts().then(()=>{ K_CACHE.clear(); redrawThumbs(); t0=performance.now(); raf=requestAnimationFrame(loop); });
  };
  drawPhotoBar(); draw(); poll();
  return box;
}
