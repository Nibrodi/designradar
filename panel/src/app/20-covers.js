/* ---------- covers: same renderer as the channel ---------- */
const isRendered = a => !a.cover_off && a.cover_render!==false && (a.cover_render===true || (!a.image_file_id && !a.archived && a.kind!=="news" && !mediaOf(a).length));
const coverParams = a => { const p={topic_id:a.cover_seed?a.id+"~"+a.cover_seed:a.id, title:(a.cover_title||a.title||"Дизайн-Радар").trim(), label:a.label||a.section||"Дизайн-Радар"}; if(a.cover_art) p.art=a.cover_art; return p; };
const coverKey = a => JSON.stringify(coverParams(a));
/* Обложка рисуется в 2000×640 (как в канале) — это 5 МБ памяти на холст. В 2.17 каждая карточка
   держала свою копию полного холста, а кэш хранил ещё 40: на iPhone это сотни мегабайт и пустые обложки.
   С 2.18: полный холст живёт только для публикации и редактора (последние 3), карточки и превью
   показывают уменьшенную картинку 1000 px из кэша (blob-ссылка, ~50 КБ). */
const coverCache = new Map();   /* полный холст: ключ → canvas, последние 3 */
const coverThumbs = new Map();  /* уменьшенная копия: ключ → blob-ссылка, последние 120 */
const THUMB_W = 1000;
function drawCover(a){
  const key=coverKey(a);
  if(coverCache.has(key)){ const c=coverCache.get(key); coverCache.delete(key); coverCache.set(key,c); return c; }
  let r; try{ r=renderCoverRGB(coverParams(a)); }catch(e){ if(a.cover_art){ try{ r=renderCoverRGB({...coverParams(a),art:undefined}); }catch(_){ return null; } } else return null; }
  const c=document.createElement("canvas"); c.width=r.W; c.height=r.H;
  const ctx=c.getContext("2d"); const img=ctx.createImageData(r.W,r.H); const d=img.data, src=r.rgb;
  for(let i=0,j=0;i<src.length;i+=3,j+=4){ d[j]=src[i]; d[j+1]=src[i+1]; d[j+2]=src[i+2]; d[j+3]=255; }
  ctx.putImageData(img,0,0); c.dataset.size=r.size; c.dataset.lines=r.lines; c.dataset.text=(r.text_lines||[]).join("\n");
  coverCache.set(key,c);
  while(coverCache.size>3){ const k=coverCache.keys().next().value; const old=coverCache.get(k); coverCache.delete(k); if(old){ old.width=0; old.height=0; } }
  return c;
}
function thumbCanvas(full){
  const t=document.createElement("canvas"); t.width=THUMB_W; t.height=Math.round(THUMB_W*full.height/full.width);
  const x=t.getContext("2d"); x.imageSmoothingEnabled=true; x.imageSmoothingQuality="high"; x.drawImage(full,0,0,t.width,t.height);
  t.setAttribute("aria-hidden","true"); return t;
}
function rememberThumb(key, t){
  if(!t.toBlob) return;
  t.toBlob(b=>{ if(!b) return; coverThumbs.set(key,URL.createObjectURL(b));
    while(coverThumbs.size>120){ const k=coverThumbs.keys().next().value; const u=coverThumbs.get(k); coverThumbs.delete(k); try{ URL.revokeObjectURL(u); }catch(_){} } },"image/png");
}
function mountCanvas(box, a, full){
  const key=coverKey(a);
  if(!full && coverThumbs.has(key)){ const im=h("img",{src:coverThumbs.get(key),alt:"","aria-hidden":"true",decoding:"async"}); box.replaceChildren(im); return; }
  const go=deferred=>{ if(deferred && !full && !box.isConnected) return; /* карточку уже перерисовали — у новой свой запуск */
    const c=drawCover(a); if(!c) return;
    if(full){ const v=document.createElement("canvas"); v.width=c.width; v.height=c.height; v.getContext("2d").drawImage(c,0,0); v.setAttribute("aria-hidden","true"); box.replaceChildren(v); return; }
    const t=thumbCanvas(c); box.replaceChildren(t); rememberThumb(key,t); };
  if(full || coverCache.has(key)) go(false); else (window.requestIdleCallback||setTimeout)(()=>go(true));
}
function coverMock(a, opt){
  const c=h("div",{class:"cover","aria-label":"Обложка: "+(a.cover_title||a.title||"")});
  if(isRendered(a)){ mountCanvas(c,a,!!(opt&&opt.full)); return c; }
  if(!a.cover_off && a.cover_url && /^https:\/\//.test(a.cover_url)){
    /* Фото находки по ссылке: показываем из источника, в Telegram оно загрузится только при публикации */
    c.classList.add("photocover");
    const img=h("img",{src:photoSrc(a,a.cover_url),alt:a.cover_title||a.title||"Фото",loading:"lazy",referrerpolicy:"no-referrer"});
    img.addEventListener("error",()=>{ img.remove(); c.append(h("a",{class:"phfail",href:a.cover_url,target:"_blank",rel:"noopener",onclick:e=>e.stopPropagation()},"Фото не показывается здесь — открыть ↗")); });
    c.append(img, h("span",{class:"has",text:a.image_file_id?"фото в Telegram":"фото из источника · загрузится при публикации"}));
    return c; }
  const firstMedia=mediaOf(a)[0];
  if(!a.image_file_id && firstMedia){ const med=mediaOf(a); c.classList.add("mcover"); c.setAttribute("aria-label","Карусель: "+med.length+" карточек");
    med.slice(0,4).forEach((m,i)=>c.append(h("img",{src:photoSrc(a,m.url),alt:i?"":(m.caption||"Первая карточка"),loading:"lazy",class:i?"":"first"})));
    if(med.length>4) c.append(h("span",{class:"more",text:"+"+(med.length-4)}));
    return c; }
  c.append(h("span",{class:"cl",text:(a.label||a.section||"Дизайн-Радар").toUpperCase()}));
  c.append(h("div",{class:"ct",text:a.cover_title||a.title||"Заголовок обложки"}));
  c.append(h("div",{class:"art","aria-hidden":"true"},h("i")));
  c.append(h("span",{class:"has",text:a.image_file_id?(a.kind==="news"?"фото из источника · превью нет":"обложка в Telegram · превью нет"):"без картинки"}));
  return c;
}
const SCN_PHOTO_URL = 6801221;
async function uploadByUrl(url, key){
  const res=await mcp.callTool(MAKE, "scenarios_run", {scenarioId:SCN_PHOTO_URL, responsive:true, data:{image_url:url, topic_id:String(key).replace(/[^A-Za-z0-9_-]/g,"-").slice(0,38)}});
  const m=JSON.stringify(res.payload??res.content??"").match(/photo_file_id\\?"\s*:\s*\\?"([A-Za-z0-9_-]{10,300})/);
  if(!m) throw {code:"tool_error",message:"Make не загрузил фото по ссылке: "+JSON.stringify(res.payload??res.content??"").slice(0,160)};
  return m[1];
}
const isExternal = u => /^https:\/\//.test(u||"") && !/\/_blob\//.test(u||"");
/* Фото с сайта источника страница панели не показывает: она пускает только свои картинки.
   Поэтому панель переносит их к себе (Make 6848987, 1 операция на фото, один раз) и показывает копию
   из photo_assets; в Telegram при публикации по-прежнему уходит исходная ссылка. */
const photoSrc = (a, url) => { const u=((a&&a.photo_assets)||{})[url]; return u ? (R_LOCAL.get(u)||u) : url; };
const needsImport = (a, url) => rIsExt(url) && !((a&&a.photo_assets)||{})[url];
const extPhotos = a => [...new Set([...(a.cover_off?[]:[a.cover_url]), ...mediaOf(a).filter(m=>!m.gen).map(m=>m.url)].filter(u=>u&&rIsExt(u)))];
const PH_BUSY = new Map(), PH_ERR = new Set();
async function importPostPhotos(a, onStep){
  const todo=extPhotos(a).filter(u=>needsImport(a,u)&&!PH_ERR.has(u)); if(!todo.length||!mcp||!assets) return 0;
  a.photo_assets={...(a.photo_assets||{})}; let n=0;
  for(let i=0;i<todo.length;i++){ const u=todo[i]; if(onStep) onStep(i,todo.length);
    let p=PH_BUSY.get(u); if(!p){ p=importPhoto(u); PH_BUSY.set(u,p); }
    try{ a.photo_assets[u]=await p; n++; } catch(e){ PH_BUSY.delete(u); PH_ERR.add(u); throw e; } }
  return n;
}
/* Вход одного вызова коннектора — не больше 1 МиБ вместе с base64. Большую картинку пережимаем в JPEG:
   Telegram всё равно хранит фото как JPEG не крупнее 2560 px, так что на канале разницы не видно. */
const TOOL_B64_MAX = 900*1024;
const b64Of = blob => new Promise((ok,no)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result).split(",")[1]||""); r.onerror=()=>no(r.error); r.readAsDataURL(blob); });
async function loadPic(blob){
  if(window.createImageBitmap){ try{ const b=await createImageBitmap(blob); return {img:b, w:b.width, h:b.height, done:()=>b.close&&b.close()}; }catch(_){} }
  const u=URL.createObjectURL(blob);
  const img=await new Promise((ok,no)=>{ const im=new Image(); im.onload=()=>ok(im); im.onerror=()=>{ URL.revokeObjectURL(u); no({code:"tool_error",message:"Не получилось открыть картинку — загрузи её заново (PNG, JPEG или WebP)."}); }; im.src=u; });
  return {img, w:img.naturalWidth, h:img.naturalHeight, done:()=>URL.revokeObjectURL(u)};
}
function shrinkCanvas(src, w0, h0, max=TOOL_B64_MAX){
  let scale=Math.min(1, 2560/Math.max(w0,h0,1));
  for(let i=0;i<8;i++){
    const w=Math.max(1,Math.round(w0*scale)), h=Math.max(1,Math.round(h0*scale));
    const c=document.createElement("canvas"); c.width=w; c.height=h;
    const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,w,h); x.drawImage(src,0,0,w,h);
    for(const q of [0.92,0.85,0.78]){ const s=c.toDataURL("image/jpeg",q).split(",")[1]||""; if(s && s.length<=max) return s; }
    scale*=0.8;
  }
  throw {code:"tool_error",message:"Картинка слишком большая даже после сжатия — замени её файлом поменьше."};
}
async function fitB64(blob){
  const b64=await b64Of(blob);
  if(b64.length<=TOOL_B64_MAX) return b64;
  const p=await loadPic(blob);
  try{ return shrinkCanvas(p.img, p.w, p.h); } finally{ p.done(); }
}
async function uploadBlobUrl(url, key){
  if(isExternal(url)) return uploadByUrl(url, key);
  const blob=await (await fetch(url)).blob();
  const b64=await fitB64(blob);
  const res=await mcp.callTool(MAKE, "scenarios_run", {scenarioId:SCN_PHOTO, responsive:true, data:{image_base64:b64, key:String(key).replace(/[^A-Za-z0-9_-]/g,"_")}});
  const m=JSON.stringify(res.payload??res.content??"").match(/photo_file_id\\?"\s*:\s*\\?"([A-Za-z0-9_-]{10,300})/);
  if(!m) throw {code:"tool_error",message:"Make не вернул фото: "+JSON.stringify(res.payload??res.content??"").slice(0,160)};
  return m[1];
}
async function uploadCover(a){
  const key=coverKey(a);
  if(a.image_file_id && a.cover_key===key) return a.image_file_id;
  const c=drawCover(a); if(!c) throw {code:"tool_error",message:"Не получилось нарисовать обложку."};
  let b64=c.toDataURL("image/png").split(",")[1];
  if(b64.length>TOOL_B64_MAX) b64=shrinkCanvas(c, c.width, c.height);
  const cp=coverParams(a); cp.topic_id=String(cp.topic_id).replace(/[^A-Za-z0-9_-]/g,"-").slice(0,38);
  const res=await mcp.callTool(MAKE, TOOL_COVER, {...cp, image_base64:b64});
  const sres=JSON.stringify(res.payload??res.content??"");
  const m=sres.match(/photo_file_id\\?"\s*:\s*\\?"([A-Za-z0-9_-]{10,300})/);
  if(!m) throw {code:"tool_error",message:"Make не вернул обложку."};
  await savePost(a.id,{image_file_id:m[1], cover_key:key, cover_render:true});
  return m[1];
}


const ART_KIT = `const GREEN = [0, 112, 60], WHITE = [255, 255, 255], MUT = [140, 134, 124], LINE = [205, 199, 188], DARKG = [0, 40, 24], RED = [212, 53, 28];
const rr = (x0, y0, x1, y1, r) => { const p = []; const c = [[x1 - r, y0 + r, -Math.PI / 2], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, Math.PI / 2], [x0 + r, y0 + r, Math.PI]]; c.forEach(([cx, cy, a]) => { for (let i = 0; i <= 8; i++) { const t = a + (Math.PI / 2) * i / 8; p.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } }); return p; };
const card = (x0, y0, x1, y1) => { poly(rr(x0, y0, x1, y1, 18), LINE, 1); poly(rr(x0 + 2, y0 + 2, x1 - 2, y1 - 2, 16), WHITE, 1); };
const box = (x0, y0, x1, y1, w, col) => { rect(x0, y0, x1, y0 + w, col); rect(x0, y1 - w, x1, y1, col); rect(x0, y0, x0 + w, y1, col); rect(x1 - w, y0, x1, y1, col); };
const chip = (x, y, s, bg) => { rect(x, y, x + txtW(s, 22, 0.06) + 24, y + 38, bg); txt(s, x + 12, y + 27, 22, BG, 0.06); };

const ell = (cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, n = 48) => { const p = []; for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; p.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); } return p; };
const ink = (pts, w = 4, closed = true) => stroke(pts, w, FG, 1, closed);
const shape = (pts, col, w = 4) => { poly(pts, col, 1); stroke(pts, w, FG, 1, true); };
const ground = (x0, x1, y) => line(x0, y, x1, y, 3, LINE, 1);
const shadow = (cx, y, rx) => poly(ell(cx, y, rx, rx * 0.075), FG, 0.08);
const BEIGE = [232, 220, 198];
const smooth = (pts, k = 10) => { const n = pts.length, out = []; for (let i = 0; i < n; i++) { const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]; for (let j = 0; j < k; j++) { const t = j / k, t2 = t * t, t3 = t2 * t; out.push([0, 1].map(d => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3))); } } return out; };`;
const ART_EXAMPLE_PUN = `// одобрено Екатериной: обложка «Незамеченный бургер»
// Каламбур в одну линию: иконка меню и бургер одинаковым контуром, рядом
const LW = 10, DY = 30;
const rl = (x1, y1, x2, y2, col) => { line(x1, y1, x2, y2, LW, col, 1); disc(x1, y1, LW / 2, col, 1); disc(x2, y2, LW / 2, col, 1); };
stroke(rr(1250, 170 + DY, 1490, 410 + DY, 50), LW, INK, 1, true);
[226, 290, 354].forEach(y => rl(1305, y + DY, 1435, y + DY, ORANGE));
const cx = 1700;
const dome = ell(cx, 282 + DY, 118, 104, Math.PI, Math.PI * 2, 56);
stroke(dome, LW, ORANGE, 1, false); rl(cx - 118, 282 + DY, cx + 118, 282 + DY, ORANGE);
[[-48, 240], [-16, 218], [16, 218], [48, 240], [0, 252]].forEach(([dx, y]) => ring(cx + dx, y + DY, 8, 4.5, ORANGE, 1));
rl(cx - 114, 316 + DY, cx + 114, 316 + DY, ORANGE);
stroke(rr(cx - 118, 348 + DY, cx + 118, 410 + DY, 24), LW, ORANGE, 1, true);`;
/* Образцы — обложки, которые Екатерина одобрила и выпустила. Без повторных объявлений из ART_KIT. */
const ART_EXAMPLE_UI = `// одобрено Екатериной: «Светофор, который видят не все» — две карточки списка платежей рядом
const G1 = [150, 146, 138], G2 = [158, 152, 140], G3 = [146, 140, 132], GRN = [0, 128, 72], YEL = [214, 150, 0];
const rows = [["№ 1024", "31 октября"], ["№ 1025", "31 октября"], ["№ 1026", "30 октября"]];
const A = 1150, B = 1550, W1 = 360, T = 128, Bt = 540;
chip(A, 70, "ТОЛЬКО ЦВЕТ", FG); chip(B, 70, "ЦВЕТ + СЛОВО", ORANGE);
card(A, T, A + W1, Bt); card(B, T, B + W1, Bt);
const head = x => { txt("Платежи", x + 26, T + 54, 26, FG, 0); txt("Статус", x + W1 - 106, T + 54, 20, MUT, 0); rect(x + 26, T + 76, x + W1 - 26, T + 78, LINE); };
head(A); head(B);
// слева статусы — почти одинаковые серые точки
[G1, G2, G3].forEach((g, i) => { const y = T + 118 + i * 96; txt(rows[i][0], A + 26, y, 24, FG, 0); txt(rows[i][1], A + 26, y + 34, 20, MUT, 0); disc(A + W1 - 56, y - 8, 16, g, 1); });
txt("Какой из них отклонён?", A + 26, Bt - 30, 20, RED, 0);
// справа бейджи со значком и словом
const badge = (x, y, col, label, sym) => { const w = txtW(label, 20, 0) + 58, x0 = x - w; poly(rr(x0, y - 26, x, y + 10, 18), col, 0.14); disc(x0 + 20, y - 8, 11, col, 1);
  if (sym === "ok") { line(x0 + 14, y - 8, x0 + 19, y - 3, 3.5, WHITE, 1); line(x0 + 19, y - 3, x0 + 27, y - 13, 3.5, WHITE, 1); }
  if (sym === "wait") [15, 20, 25].forEach(dx => disc(x0 + dx, y - 8, 2.2, WHITE, 1));
  if (sym === "no") { line(x0 + 15, y - 13, x0 + 25, y - 3, 3.5, WHITE, 1); line(x0 + 25, y - 13, x0 + 15, y - 3, 3.5, WHITE, 1); }
  txt(label, x0 + 38, y + 1, 20, col, 0); };
[[GRN, "Оплачен", "ok"], [YEL, "Ждёт", "wait"], [RED, "Отклонён", "no"]].forEach((s, i) => { const y = T + 118 + i * 96; txt(rows[i][0], B + 26, y, 24, FG, 0); txt(rows[i][1], B + 26, y + 34, 20, MUT, 0); badge(B + W1 - 24, y, s[0], s[1], s[2]); });
txt("Понятно и без цвета", B + 26, Bt - 30, 20, GRN, 0);`;
const ART_EXAMPLE_OBJ = `// одобрено Екатериной: «Цель перевешивает красоту» — весы: на опущенной чаше оранжевая мишень, на поднятой ваза с цветком
const gy = 540, cx = 1560, py = 404, tilt = 0.16, half = 240;
ground(1200, 1900, gy);
shadow(cx, gy, 150);
// стойка и основание
shape([[cx - 16, gy - 26], [cx + 16, gy - 26], [cx + 12, py], [cx - 12, py]], BEIGE);
shape([[cx - 110, gy], [cx - 90, gy - 30], [cx + 90, gy - 30], [cx + 110, gy]], WHITE);
// коромысло наклонено: слева тяжелее
const dx = half * Math.cos(tilt), dy = half * Math.sin(tilt), bw = 9;
const L = [cx - dx, py + dy], R = [cx + dx, py - dy];
const nx = -Math.sin(tilt) * bw, ny = -Math.cos(tilt) * bw;
shape([[L[0] + nx, L[1] + ny], [R[0] + nx, R[1] + ny], [R[0] - nx, R[1] - ny], [L[0] - nx, L[1] - ny]], WHITE);
shape(ell(cx, py, 20, 20), WHITE);
disc(cx, py, 6, FG);
// чаши на коротких стойках
const pan = (x, y) => { shape([[x - 7, y], [x + 7, y], [x + 7, y - 34], [x - 7, y - 34]], BEIGE); shape([[x - 96, y - 52], [x + 96, y - 52], [x + 78, y - 34], [x - 78, y - 34]], WHITE); return y - 52; };
const lt = pan(L[0], L[1]), rt = pan(R[0], R[1]);
// мишень — единственный оранжевый акцент
const tr = 72, tcx = L[0], tcy = lt - tr - 2;
shape([[tcx - 26, lt], [tcx + 26, lt], [tcx + 14, lt - 30], [tcx - 14, lt - 30]], BEIGE);
shape(ell(tcx, tcy, tr, tr), ORANGE);
shape(ell(tcx, tcy, tr * 0.64, tr * 0.64), WHITE);
shape(ell(tcx, tcy, tr * 0.3, tr * 0.3), ORANGE);
// ваза с цветком
const vx = R[0], vb = rt;
ink([[vx, vb - 104], [vx + 4, vb - 140], [vx - 2, vb - 156]], 4, false);
shape(ell(vx + 22, vb - 140, 18, 8), BEIGE);
const fy = vb - 174;
for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; shape(ell(vx - 2 + 20 * Math.cos(a), fy + 20 * Math.sin(a), 14, 14), BEIGE); }
shape(ell(vx - 2, fy, 12, 12), WHITE);
shape([[vx - 26, vb], [vx + 26, vb], [vx + 40, vb - 50], [vx + 30, vb - 92], [vx + 18, vb - 104], [vx - 18, vb - 104], [vx - 30, vb - 92], [vx - 40, vb - 50]], WHITE);`;

/* Обложка в два шага, как у арт-директора: сначала идеи от конкретики поста, потом рисунок выбранной.
   С 2.19: идеи строятся от настоящего предмета, экрана или цифры из поста (не от слова из заголовка),
   а рисунок проходит две проверки — панель сама смотрит, не залез ли он на заголовок и не пустой ли,
   а Claude смотрит на готовую картинку и правит её. */
const COVER_KINDS={interface:"Интерфейс",object:"Предмет-метафора",thing:"Сам предмет",icon:"Значок"};
const KIND_ALIAS={pun:"icon",scene:"object"};
/* одобренные обложки — ориентир по уровню и стилю (выпущены в канал) */
const APPROVED_COVERS=[
  "«Светофор, который видят не все» (Крафт, интерфейс): две карточки «Платежи» рядом. Слева у заказов № 1024–1026 статус — почти одинаковые серые точки, внизу красное «Какой из них отклонён?». Справа бейджи «Оплачен / Ждёт / Отклонён» со значком и словом. Плашки над карточками: «ТОЛЬКО ЦВЕТ» и «ЦВЕТ + СЛОВО».",
  "«Бомба замедленного действия» (Крафт, интерфейс): карточка «ПЛОХО» с токенами blue-500, gray-900, white и карточка «ХОРОШО» с button-primary, text-default, surface.",
  "«Скелетон вреден, не везде» (Мнение, интерфейс): три маленьких экрана на шкале времени 0 — 1 с — 10 с: пустой, скелетон, прогресс-бар 62 % в оранжевой рамке.",
  "«Скучный цвет за 200 миллионов» (Крафт, интерфейс): поисковая выдача с синими ссылками и полоса из 41 оттенка синего, один в оранжевой рамке.",
  "«Агент Figma вышел на смену» (Новости, интерфейс): табель из 20 клеток, 13 оранжевых с галочкой.",
  "«Цель перевешивает красоту» (Мнение, предмет): весы, на опущенной чаше оранжевая мишень, на поднятой — ваза с цветком.",
  "«Самозванец с десятью годами стажа» (Мнение, предмет): стремянка, на верхней площадке лежит оранжевая маска.",
  "«Мерч, который надо выбить» (Находка, сам предмет): бетонный куб, в трещине оранжевая ткань, сверху молоток.",
  "«Незамеченный бургер» (Мнение, значок): иконка меню и бургер одной оранжевой линией рядом."];
function recentConcepts(d){ return (S.posts||[]).filter(p=>p.id!==d.id&&p.cover_concept).sort((a,b)=>(b.updated_at||0)-(a.updated_at||0)).slice(0,8).map(p=>"— "+p.cover_concept).join("\n"); }
function approvedConcepts(){ const extra=(S.posts||[]).filter(p=>p.status==="published"&&p.cover_concept).sort((a,b)=>(b.published_at||0)-(a.published_at||0)).slice(0,6).map(p=>"«"+plain(p.cover_title||p.title).replace(/\n/g," ")+"» ("+(p.label||p.section||"")+"): "+p.cover_concept);
  const seen=new Set(); return APPROVED_COVERS.concat(extra).filter(x=>{ const k=x.slice(0,40); if(seen.has(k)) return false; seen.add(k); return true; }).slice(0,14).map(x=>"— "+x).join("\n"); }
async function coverIdeas(d, wish){
  if(!sample) throw {message:"Генерация недоступна в этом окне: открой панель в Claude."};
  const recent=recentConcepts(d);
  const prompt="Ты арт-директор Telegram-канала «Дизайн-Радар» для продуктовых дизайнеров. Придумай обложку поста: 2000×640, слева рубрика и заголовок, справа рисунок в стиле канала (плоско, кремовый фон, белые и бежевые заливки, чёрный контур, один оранжевый акцент).\n\nПОСТ\nЗаголовок обложки: "+plain(d.cover_title||d.title).replace(/\n/g," ")+"\nЗаголовок поста: "+plain(d.title)+"\nРубрика: "+(d.label||d.section||"")+"\nТекст:\n"+String(d.full_text||"").slice(0,2600)+"\n"+(wish?"\nПОЖЕЛАНИЕ РЕДАКТОРА (главное, выполни его): "+wish+"\n":"")+
  "\nОБЛОЖКИ, КОТОРЫЕ ЕКАТЕРИНА ОДОБРИЛА — уровень, к которому стремимся:\n"+approvedConcepts()+"\n"+
  "\nКАК ДУМАТЬ\n1. Сформулируй главную мысль поста одной фразой. Найди в тексте конкретику, которую читатель узнает: настоящий экран, кнопку, статус, токен, число, название, физический предмет, о котором пост.\n2. Обложка показывает эту конкретику так, чтобы мысль была видна за секунду: контраст (только цвет / цвет + слово, до / после), перевес, поломка, скрытое и явное, шкала.\n3. Тип выбирай по смыслу:\n   interface — кусок настоящего интерфейса с реальными подписями из поста (карточка, список, форма, бейджи, шкала, две карточки для сравнения с плашками сверху). Для крафта, разборов и новостей про продукты обычно сильнее всего.\n   object — один крупный предмет из жизни как метафора главной мысли (весы, стремянка, бетон и молоток). Для мнений, психологии работы, книг и фильмов.\n   thing — сам предмет, о котором пост (визитка, упаковка, мерч, вывеска, герб), упрощённо, с одной деталью, в которой весь смысл. Для находок и айдентики.\n   icon — пара значков одной линией, визуальный каламбур. Только если каламбур очевиден и смешной сам по себе — не притягивай.\n4. ТАК НЕ НАДО:\n   — каламбур на слово, которое не про смысл поста (точки в посте про растровый портрет — не точки пароля);\n   — дежурные символы: лупа, лампочка, пазл, ракета, мозг, шестерёнки, сердце, вопросительный знак, глаз;\n   — абстракция из кружков и точек без узнаваемого предмета; пересказ заголовка буквами;\n   — люди, лица, руки, персонажи, логотипы брендов; крестики и «плохо/хорошо» без конкретного содержания.\n5. Рисунок рисуется кодом из простых фигур в зоне примерно 760×530: 1–2 крупных предмета или 1–3 карточки интерфейса. Подписей мало, только настоящие слова и цифры из поста.\n6. Дай ТРИ идеи, которые заметно отличаются; хотя бы одна — interface или thing, если пост про конкретный экран или вещь. Выбери сильнейшую честно, без предпочтения типа.\n"+(recent?"\nНЕ ПОВТОРЯЙ идеи последних обложек:\n"+recent+"\n":"")+
  "\nОтветь только JSON: {\"core\":\"главная мысль поста, одна фраза\",\"ideas\":[{\"kind\":\"interface|object|thing|icon\",\"title\":\"2–4 слова\",\"see\":\"что нарисовано: предметы или карточки, их расположение, что оранжевое — 1–3 предложения\",\"labels\":[\"подписи на рисунке дословно, 0–8 коротких\"],\"why\":\"почему читатель скажет «ага», 1 фраза\"}],\"best\":<индекс сильнейшей>}";
  const v=await sample.json(prompt,{modelTier:"complex",cache:false});
  const ideas=(v&&Array.isArray(v.ideas)?v.ideas:[]).filter(x=>x&&x.see).slice(0,3).map(x=>{ const k=KIND_ALIAS[x.kind]||x.kind; return {kind:COVER_KINDS[k]?k:"object",title:String(x.title||"").slice(0,60),see:String(x.see||"").slice(0,500),labels:(Array.isArray(x.labels)?x.labels:[]).map(s=>String(s).slice(0,40)).filter(Boolean).slice(0,10),why:String(x.why||"").slice(0,200)}; });
  if(!ideas.length) throw {message:"Claude не придумал идеи. Попробуй ещё раз."};
  return {core:String(v.core||"").slice(0,240), ideas, best:Math.max(0,Math.min(ideas.length-1,Number(v.best)||0))};
}
const KIND_STYLE={
  interface:"ИНТЕРФЕЙС. 1–3 белые карточки card(x0,y0,x1,y1) — список, форма, экран, таблица, ровно выровненные по одной линии. Внутри настоящие подписи из поста: заголовок карточки 26, строки 22–24 цветом FG, второстепенное 20 цветом MUT, отступы внутри 24–26, разделители — rect высотой 2 цвета LINE. Над карточками для сравнения — плашки chip(x, y, \"СЛОВО\", FG или ORANGE). Кнопки и бейджи — скруглённые rr(). Оранжевое — одно: нужная кнопка, бейдж, прогресс или рамка выбранного. Никаких экранов-телефонов с мелочью, никаких иконок-заглушек вместо текста.",
  object:"ПРЕДМЕТ-МЕТАФОРА. 1–2 крупных предмета (главный — от 380 px по большей стороне), простые узнаваемые силуэты. Каждая часть — shape(pts, WHITE | BEIGE | LINE) с чёрным контуром 4. Предметы стоят на земле: ground(1200, 1900, 540) и мягкая тень shadow(cx, 540, rx). Живые детали скупо: фактура точками disc с прозрачностью, трещина stroke, лента, блик. Оранжевое — одна главная деталь, в которой вся мысль.",
  thing:"САМ ПРЕДМЕТ ИЗ ПОСТА. Нарисуй вещь, о которой пост (визитку, упаковку, вывеску, мерч), крупно и упрощённо: плоские заливки WHITE | BEIGE | LINE через shape() с чёрным контуром 4, лёгкий поворот или второй план для объёма, предмет лежит или стоит на земле ground(1200, 1900, 540) с тенью shadow(). Деталь, в которой смысл, — оранжевая; остальное спокойное. Узор или фактуру рисуй крупно и редко, чтобы она читалась с телефона, а не превращалась в серую кашу.",
  icon:"ЗНАЧОК. 1–2 крупных значка одной линией толщиной 10 (stroke и line, на концах линий disc радиусом 5), одинакового размера, рядом, вокруг много воздуха. Без заливок, без экранов и подписей. Рамка значка FG, линии ORANGE."};
const KIND_EXAMPLE={interface:ART_EXAMPLE_UI, object:ART_EXAMPLE_OBJ, thing:ART_EXAMPLE_OBJ, icon:ART_EXAMPLE_PUN};
/* панель сама проверяет готовый рисунок: заголовок, края, пустоту, акцент. Возвращает список замечаний для Claude. */
function artIssues(d, full, kind){
  const p=coverParams({...d,cover_art:full}); const r1=renderCoverRGB(p), r0=renderCoverRGB({...p,art:"//"});
  const W=r1.W, H=r1.H, a=r1.rgb, b=r0.rgb, XZ=1145; let tz=0, tAll=0, zone=0, inkN=0, org=0, edge=0, x0=W, x1=0, y0=H, y1=0;
  for(let y=0;y<H;y+=2) for(let x=0;x<W;x+=2){ const i=(y*W+x)*3, df=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);
    if(x<XZ){ tAll++; if(df>30) tz++; continue; }
    zone++; if(df<=30) continue; inkN++; if(x<x0) x0=x; if(x>x1) x1=x; if(y<y0) y0=y; if(y>y1) y1=y;
    if(a[i]>215&&a[i+1]>55&&a[i+1]<140&&a[i+2]<90) org++; if(y<14||y>H-14||x>W-14) edge++; }
  const out=[];
  if(tz>tAll*0.0015) out.push("рисунок залезает на заголовок слева: всё должно быть правее x = 1150");
  if(inkN<zone*0.04) out.push("рисунок почти пустой — сделай предметы крупнее и плотнее");
  else if((x1-x0)<360&&(y1-y0)<260) out.push("рисунок мелкий ("+(x1-x0)+"×"+(y1-y0)+" px) — увеличь главный предмет до 380–500 px");
  if(edge>20) out.push("рисунок упирается в край холста — отступи от краёв на 40 px");
  if(inkN && !org) out.push("нет оранжевого акцента — выдели оранжевым главную деталь");
  else if(kind!=="icon" && org>inkN*0.45) out.push("слишком много оранжевого — оставь оранжевой одну главную деталь");
  return out;
}
const cleanCode = t => String(t||"").replace(/^\s*```[a-z]*\s*/i,"").replace(/```\s*$/,"").trim();
function tryArt(d, code){ const full=ART_KIT+"\n"+code; renderCoverRGB({...coverParams({...d,cover_art:full})}); return full; }
async function coverBlob(d, full){ const c=drawCover({...d,cover_art:full,cover_render:true}); if(!c) return null; const t=document.createElement("canvas"); t.width=1500; t.height=480; t.getContext("2d").drawImage(c,0,0,1500,480); return await new Promise(ok=>t.toBlob(ok,"image/jpeg",0.9)); }
async function newScene(d, wish, idea, onStep){
  if(!sample) throw {message:"Генерация недоступна в этом окне: открой панель в Claude."};
  const step=t=>{ try{ onStep&&onStep(t); }catch(_){} };
  newScene.note="";
  let core="";
  if(!idea){ const r=await coverIdeas(d,wish); idea=r.ideas[r.best]; core=r.core; } else core=idea.core||"";
  const kind=COVER_KINDS[idea.kind]?idea.kind:"object";
  const brief="Ты иллюстратор Telegram-канала «Дизайн-Радар». Нарисуй кодом обложку по выбранной идее так, чтобы она стояла в одном ряду с обложками, которые одобрила главред Екатерина.\n\nПОСТ\nЗаголовок обложки: "+plain(d.cover_title||d.title).replace(/\n/g," ")+"\nРубрика: "+(d.label||d.section||"")+"\nТекст: "+String(d.full_text||"").slice(0,1200)+"\n"+(core?"ГЛАВНАЯ МЫСЛЬ: "+core+"\n":"")+(wish?"\nПОЖЕЛАНИЕ РЕДАКТОРА: "+wish+"\n":"")+
  "\nИДЕЯ ("+COVER_KINDS[kind]+"): "+idea.title+"\nЧТО НАРИСОВАТЬ: "+idea.see+"\n"+((idea.labels||[]).length?"ПОДПИСИ НА РИСУНКЕ (дословно): "+idea.labels.join(" · ")+"\n":"")+
  "\nСТИЛЬ КАНАЛА\n— Кремовый фон BG уже залит. Плоско, без градиентов и лишних цветов: WHITE, BEIGE, LINE (светло-бежевый), MUT (серый текст), FG (чёрный) и ровно один акцент ORANGE на главной детали. GREEN и RED — только если это смысл (статусы).\n— "+KIND_STYLE[kind]+"\n— Подписи — только настоящие короткие слова и цифры, размер 20–28: txt(s, x, baseline, size, col, track). В шрифте есть буквы, цифры и знаки ! % & ' ( ) + , - . / : ; ? @ « » – — №. Других символов нет: стрелки, галочки, крестики, звёздочки рисуй фигурами.\n— Нельзя: люди, лица, руки, персонажи, логотипы брендов, лупа, лампочка, пазл и ракета как украшение, мелкая каша из десятков деталей, предметы в воздухе без опоры.\n"+
  "\nХОЛСТ\n2000×640. Слева рубрика и заголовок: рисунок не заходит левее x = 1150. Зона рисунка — x от 1150 до 1920, y от 60 до 590; центр около x = 1540. Рисунок крупный, занимает зону, но не прилипает к краям.\n"+
  "\nAPI (только эти имена): W, H, X0, BG, FG, INK, ORANGE, CREAM, rnd(), rf(a,b), ri(a,b), pick(arr), disc(cx,cy,r,col,a), ring(cx,cy,r,w,col,a), rect(x0,y0,x1,y1,col,a), line(x1,y1,x2,y2,w,col,a), quad(pts,col,a), poly(pts,col,a), sector(cx,cy,r0,r1,ang0,ang1,col,a), stroke(pts,w,col,a,closed), arc(cx,cy,r,ang0,ang1,w,col,a), txt(s,x,baseline,size,col,track), txtW(s,size,track), Math. Цвета — массивы RGB, a — прозрачность 0–1.\nУже объявлены, НЕ объявляй заново: WHITE, BEIGE, MUT, LINE, GREEN, RED, DARKG, rr(x0,y0,x1,y1,r) — точки скруглённого прямоугольника, card(x0,y0,x1,y1) — белая карточка с рамкой, box(x0,y0,x1,y1,w,col) — рамка, chip(x,y,s,bg) — плашка с текстом цвета BG, ell(cx,cy,rx,ry,a0,a1,n) — точки эллипса или дуги, smooth(pts,k) — сглаженный замкнутый контур, shape(pts,col,w) — заливка с чёрным контуром, ink(pts,w,closed) — только контур, ground(x0,x1,y) — линия земли, shadow(cx,y,rx) — тень под предметом.\n"+
  "\nОБРАЗЕЦ ТОГО ЖЕ ТИПА (одобрен, так выглядит уровень):\n"+KIND_EXAMPLE[kind]+"\n"+
  "\nСначала в одном-двух комментариях // распиши раскладку: где главный предмет, его размеры, где подписи. Потом код. Ответь только телом JavaScript-функции, без ``` и пояснений вне комментариев.";
  let msgs=[{role:"user",content:brief}], code="", full="", lastErr="";
  /* 1. рисунок без ошибок и без грубых промахов (до трёх попыток) */
  for(let i=0;i<3;i++){
    step(i?"Поправляю рисунок…":"Рисую «"+idea.title+"»…");
    const r=await sample(msgs,{modelTier:"complex",cache:false}); code=cleanCode(r.text);
    let fb="";
    try{ const f=tryArt(d,code); const iss=artIssues(d,f,kind); full=f; if(!iss.length||i===2) break; fb="Рисунок получился, но: "+iss.join("; ")+". Исправь и пришли тело функции целиком."; }
    catch(e){ lastErr=String(e&&e.message||e); fb="Код упал с ошибкой: "+lastErr+". Исправь и пришли тело функции целиком."; }
    msgs=[...msgs,{role:"assistant",content:code},{role:"user",content:fb}];
  }
  if(!full) throw {message:"Claude нарисовал сцену с ошибкой ("+lastErr.slice(0,80)+"). Попробуй ещё раз."};
  /* 2. Отдельный строгий арт-директор смотрит на готовую картинку (кода не видит, поэтому не выгораживает своё):
        сначала описывает, что реально видно, ставит оценку; меньше 8 из 10 — иллюстратор перерисовывает по его замечаниям.
        Нужна capability sample: {images: true}; без неё шаг пропускается. */
  const lim=sample.limits?await sample.limits().catch(()=>null):null;
  if(lim&&lim.images){
    try{
      step("Арт-директор смотрит на рисунок…");
      const img=await coverBlob(d,full);
      if(img){
        const crit="Ты строгий арт-директор Telegram-канала «Дизайн-Радар». На картинке обложка поста 2000×640 (уменьшена): слева рубрика и заголовок «"+plain(d.cover_title||d.title).replace(/\n/g," ")+"», справа рисунок иллюстратора. В канале её видят с телефона шириной около 360 px.\nЗамысел иллюстратора: "+idea.see+(core?"\nГлавная мысль поста: "+core:"")+"\nСтиль канала: плоско, кремовый фон, белые и бежевые заливки, чёрный контур, один оранжевый акцент на главной детали; карточки интерфейса чистые, ровные, с настоящими подписями.\n\n1. Сначала одной фразой опиши, что реально видно на рисунке человеку, который не знает замысла — не что задумано, а что видно.\n2. Оцени от 1 до 10, читается ли замысел за секунду. 10 — можно выпускать без правок, 7 — понятно только с подсказкой, 4 — не понятно.\n3. Перечисли конкретные проблемы: деталь не узнаётся, кривые или непонятные формы, наложения, обрезанные края, подписи мельче 20 px или вылезают из карточек, больше одного оранжевого акцента, пусто или тесно, не похоже на стиль канала.\nБудь строгим и честным: лучше перерисовать, чем выпустить непонятную обложку.\nОтветь только JSON: {\"sees\":\"…\",\"score\":<1–10>,\"problems\":[\"…\"],\"fix\":\"как исправить: что упростить, увеличить, убрать или заменить более узнаваемым образом — 1–2 предложения\"}";
        const v=await sample.json(crit,{modelTier:"complex",cache:false,images:[img]});
        const score=Number(v&&v.score)||0, probs=(v&&Array.isArray(v.problems)?v.problems:[]).map(x=>String(x)).filter(Boolean).slice(0,5);
        if(score && score<8){
          step("Перерисовываю по замечаниям арт-директора…");
          const ask="Арт-директор посмотрел на готовую картинку. Он видит: «"+String(v.sees||"").slice(0,300)+"». Замысел читается на "+score+" из 10."+(probs.length?"\nПроблемы: "+probs.join("; ")+".":"")+(v.fix?"\nСовет: "+String(v.fix).slice(0,300):"")+"\nПерерисуй так, чтобы замысел читался за секунду. Если деталь не узнаётся — замени её более узнаваемым образом или упрости рисунок, а не добавляй детали. Пришли тело функции целиком.";
          const r=await sample([...msgs,{role:"assistant",content:code},{role:"user",content:ask}],{modelTier:"complex",cache:false});
          try{ const f2=tryArt(d,cleanCode(r.text)); if(!artIssues(d,f2,kind).some(x=>/заголовок|пустой/.test(x))){ full=f2; newScene.note=(probs[0]||String(v.sees||"")).replace(/[.;\s]+$/,"").slice(0,200); } }catch(_){}
        } } }
    catch(e){ if(e&&(e.code==="not_granted"||e.code==="rate_limited")) throw e; /* иначе оставляем рисунок до проверки */ }
  }
  d.cover_concept=(idea.title+": "+idea.see).slice(0,200);
  return full;
}


const TEXT_RULES = `Ты редактор Telegram-канала «Дизайн-Радар» для продуктовых дизайнеров (практики от 2 лет). Голос — лид продуктового дизайна для коллег: точно, по делу, с прямым обоснованным вердиктом, обращение на «ты».
ПРАВИЛА
— Первые две строки: что случилось или в чём проблема и при чём тут читатель. Живая сцена из интерфейса с конкретной деталью вместо общих слов.
— Одна мысль на пост. Каждое предложение даёт факт, пример или вывод, остальное вычеркни.
— Абзац до 3 предложений, предложение до 20 слов, пустая строка между абзацами. Связки «Например», «А», «Но» вместо перечисления источников подряд. Не рубить текст на телеграфные фразы.
— Ссылок мало: 1–2 на пост, только там, где без источника не поверят (цифра, исследование). Не в каждом абзаце: остальные абзацы — чистая мысль редакции, вывод и наблюдение своими словами, без отсылок «по данным…», «как пишут…».
— Иностранную дизайн-систему или автора представь одной фразой. Английскую цитату сначала перескажи по-русски, потом оригинал в кавычках «…».
— Жирный (**так**) — одна ключевая фраза и короткие разговорные подзаголовки жирной строкой («**Что же произошло?**»). Ссылки [текст](url) вшиты в слова. Вместо списков через тире — короткие абзацы.
— Живо и по-человечески: лёгкая ирония над предметом (не над людьми), живая реакция, можно 1–3 уместных смайлика :) 🙃 — без смайлика в каждой строке.
— Запрещено: «На ревью я регулярно вижу», «Давайте разберёмся», «Важно отметить», «Не секрет», канцелярит («является», «осуществлять», «данный», «в рамках»), пустые усилители («очень», «крайне»), риторические вопросы читателю, «Как вы думаете? Пишите в комментариях», шаблонный финал «Проверь …», сценки с выдуманными персонажами, «все дизайнеры», «чаще всего», «тренд» без данных.
— ФАКТЫ: не добавляй ни одного нового факта, цифры, цитаты, названия, даты или ссылки. Используй только то, что есть в исходном тексте, цитаты и ссылки сохраняй дословно. Цифру показывай с расчётом, если он есть в тексте.
— Строки вида [фото:N] сохрани и оставь на своих местах.
— Не повторяй заголовок поста в начале текста, не пиши хэштеги и строку «Источник».
ГОЛОС ГЛАВРЕДА (Екатерина правит именно так)
— У редакции есть позиция и человеческая интонация: вердикт через контраст («лучше, а не модно»), можно одну тёплую живую оценку («за это большой лайк»).
— Критика только по делу, без придирок ради объективности. Цитаты экспертов — только если без них теряется мысль.
— Концовка — один практичный блок «__Стоит взять на заметку.__ …» с конкретным действием, а не набор шаблонных выводов.
— Порядок разбора: проблема → как решали → что сохранили и поменяли → что дальше → вердикт.
ЭТАЛОН (разбор, доведённый Екатериной):
Герб Newcastle United 1988 года расплывался на экране телефона, в эфирной графике и в вышивке. Клуб не стал заказывать модный редизайн, а сначала спросил болельщиков, что в гербе трогать нельзя.

## Как решали
Решению предшествовали больше двух лет консультаций: встречи с болельщиками, фокус-группы, воркшопы и опросы. 84% ответивших выбрали «обновить то, что есть», а не рисовать новый герб.

Опрос получился основательным. Ответили 27 348 человек из 118 658 приглашённых, а по независимой рекомендации для 95% уверенности хватило бы 21 200. Из трёх вариантов C первым выбрали 64,8%, B — 19%, A — 16,2%.

## Что сохранили и что поменяли
Болельщики назвали неприкосновенное: замок, чёрно-белый щит с гиппокампами (мифическими морскими конями), льва по пояс, вымпел и ленту с названием клуба.

Внутри этих рамок выровняли толщину линий и сделали замок чётче, а щит, льва, вымпел и ленту подогнали друг к другу. Детали перерисовали так, чтобы герб держался в любом размере, в цвете и в одном цвете, в вышивке и на экране.

## Что дальше
На форме новый герб появится в сезоне 2027/28, а вывески, цифровые каналы и эфир переведут постепенно.

**Вердикт редакции: ребрендинг должен отвечать на вопрос «как сделать лучше», а не «как сделать модно».** И самое классное здесь — человечность: клуб два года слушал болельщиков и не тронул то, что им дорого. За это большой лайк.

__Стоит взять на заметку.__ Перед обновлением бренда или дизайн-системы составь с пользователями или заказчиком список «что нельзя трогать». С ним спор «нравится — не нравится» превращается в проверку по списку, а сам список становится брифом: видно, где можно экспериментировать, а где нет.`;
const CRAFT_EXAMPLE=`Ты включаешь тёмную тему, и подписи на карточках исчезают. Код никто не трогал, палитра та же. Просто текст стоит на токене gray-900: в светлом макете это был нужный тёмно-серый, а на почти чёрном фоне он растворился.

Ошибка не в цвете, а в имени. Токен gray-900 отвечает на вопрос «какой это цвет», а компоненту нужен ответ «зачем он здесь». **Компонент должен ссылаться на роль цвета — «основной текст», «фон карточки», — а не на оттенок из палитры.**

Так устроены системы, которые давно живут с тёмной темой. В Atlassian Design System, на которой собраны Jira и Confluence, основной текст так и называется — color.text. А документация прямо предупреждает: не бери токен только потому, что цвета совпали, в другой теме это сломается.

Primer, система GitHub, разводит это на два этажа. Внизу базовые токены вроде base-color-green-5 — просто значения. Сверху функциональные вроде borderColor-default — они говорят, где цвет живёт в интерфейсе.

__Стоит взять на заметку.__ Мысленно перекрась бренд из синего в зелёный и пройдись по токенам. Те, чьё имя стало враньём, вроде button-blue, сломаются первыми. С них и начинай перевод на роли.`;
const CRAFT_RULES=`КАК СДЕЛАТЬ ТЕКСТ ИНТЕРЕСНЫМ (это важнее, чем аккуратность)
— Крючок. Первая фраза — момент, когда что-то пошло не так, или цена ошибки, или неожиданное утверждение. Не определение, не «X — это», не пересказ заголовка. Можно сцена во втором лице: «Ты включаешь тёмную тему, и…».
— Напряжение. Сначала покажи проблему так, чтобы читатель узнал себя, потом дай поворот: «Ошибка не в цвете, а в имени». Без поворота текст — справка.
— Ставка. Скажи, чем это грозит или что даёт в работе: часы, баги, споры, переделки — только если это следует из текста.
— Не парад источников. Если в тексте три системы подряд, оставь одну-две самых сильных и сделай из них доказательство, а не перечисление. Лишнее вырежи — вырезать можно, выдумывать нельзя.
— Ритм. Чередуй короткие фразы с обычными. Глаголы активные: «ты собрал», а не «было собрано».
— Конкретика вместо оценки: имя токена, кнопка, экран — не «важно», «удобно», «эффективно».
— Перед ответом перечитай как подписчик, который листает ленту: остановился бы он на первой строке? Если нет — перепиши начало.`;
const wantsResearch = w => /изуч|поищ|найди|загугл|документац|в интернет|в сети|источник|проверь факт/i.test(w||"");
async function rewriteText(d, wish){
  if(!sample) throw {message:"Переписывание недоступно в этом окне: открой панель в Claude."};
  const isNews=d.kind==="news";
  const rules=TEXT_RULES.split("ЭТАЛОН (")[0].trim();
  const example=isNews?TEXT_RULES.slice(TEXT_RULES.indexOf("ЭТАЛОН (")):"ЭТАЛОН КРАФТ-ПОСТА (уровень, к которому стремимся):\n"+CRAFT_EXAMPLE;
  const prompt=rules+"\n\n"+CRAFT_RULES+"\n\n"+example+
    "\n\nПОСТ\nРубрика: "+(d.label||d.section)+"\nФормат: "+(isNews?"новость или разбор: подзаголовки «## …», в конце вердикт редакции жирным и блок «__Стоит взять на заметку.__ …»":"авторский пост: без подзаголовков-ярлыков, концовка — блок «__Стоит взять на заметку.__ …»")+
    "\nЗаголовок: "+d.title+"\nТекст:\n"+String(d.full_text||"")+"\n"+
    (wish?"\nПОЖЕЛАНИЕ РЕДАКТОРА (выполни в первую очередь): "+wish+"\n":"")+
    (wantsResearch(wish)?"У тебя нет доступа в интернет: ничего не ищи и не придумывай. Выстрой логику из того, что есть в тексте.\n":"")+
    "\nСначала коротко поставь диагноз: что в нынешнем тексте мешает его читать (1–2 фразы, по делу). Потом напиши ДВА разных варианта поста с разными крючками и ходами, оба по правилам и без новых фактов."+
    "\nОтветь только JSON: {\"diagnosis\":\"…\",\"variants\":[{\"angle\":\"2–4 слова: чем вариант отличается\",\"text\":\"…\"},{\"angle\":\"…\",\"text\":\"…\"}]}";
  const r=await sample.json(prompt,{modelTier:"complex",cache:false});
  const clean=t=>String(t||"").replace(/^\s*```[a-z]*\s*/i,"").replace(/```\s*$/,"").trim();
  const vs=(r&&Array.isArray(r.variants)?r.variants:[]).map((v,i)=>({angle:String(v&&v.angle||"Вариант "+(i+1)).trim().slice(0,40),text:clean(v&&v.text)})).filter(v=>v.text.length>=40).slice(0,2);
  if(!vs.length) throw {message:"Claude вернул пустой текст. Попробуй ещё раз."};
  return {diagnosis:String(r.diagnosis||"").trim(), variants:vs};
}


