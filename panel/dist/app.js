(() => {
"use strict";
const CHANNEL = "@designradar_lab";
const MAKE = "Make";
const TOOL_TG = "s6801242_dr_util_telegram_api";
const TOOL_COVER = "s6749993_design_radar_2000640";
const SCN_PHOTO = 6841226;
const LIMIT = 3900;
const VIEWS = [
  {id:"review", name:"На согласовании"},
  {id:"plan", name:"План"},
  {id:"drafts", name:"Черновики"},
  {id:"ideas", name:"Идеи"},
  {id:"published", name:"Опубликовано"},
  {id:"team", name:"Колонки"}
];
const S = {posts:[], ideas:[], invites:[], settings:{}, editors:{}, me:null, owner:false, canWrite:false, view:"review", ready:false, dbOk:null, confirm:null, busy:{}, errors:{}, names:{}};
let db=null, user=null, mcp=null, sample=null, assets=null;

const $ = (s, r=document) => r.querySelector(s);
const h = (tag, attrs={}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})) {
    if (v==null || v===false) continue;
    if (k==="class") el.className=v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k==="text") el.textContent=v;
    else el.setAttribute(k, v===true?"":v);
  }
  for (const k of kids.flat()) if (k!=null && k!==false) el.append(k.nodeType?k:document.createTextNode(String(k)));
  return el;
};
const esc = v => String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const plain = v => String(v||"").replace(/\*\*|__/g,"").replace(/\[([^\]\n]+)\]\([^)\s]+\)/g,"$1").trim();
const ago = ms => { if(!ms) return ""; const d=(Date.now()-ms)/60000; if(d<1) return "только что"; if(d<60) return Math.round(d)+" мин назад"; if(d<1440) return Math.round(d/60)+" ч назад"; return new Date(ms).toLocaleDateString("ru-RU",{day:"numeric",month:"short"}); };
const toast = msg => { const r=$("#toastRoot"); r.replaceChildren(h("div",{class:"toast",text:msg})); clearTimeout(toast.t); toast.t=setTimeout(()=>r.replaceChildren(),3200); };
const authorName = id => id==="claude"||!id ? "Редакция" : ((S.editors[id]&&S.editors[id].sign) || (id===TEST_ID?"Тестовый редактор":"") || S.names[id] || "Редактор");
const TEST_ID="test_editor";
const authorOk = p => !S.author || S.author==="all" || (p.author||"claude")===S.author;

const APP_VERSION="2.0.0"; const CHANGES=[{"v": "2.0.0", "date": "31.10.2026", "items": ["Права доступа в базе: автор правит только свои посты, общие посты и права редакторов меняет только главный редактор.", "Посты авторов хранятся в их собственных папках. Перед публикацией главный редактор забирает пост в общую ленту.", "Права «публикует сам» и «на паузе» хранятся отдельно от анкеты, редактор не может выдать их себе.", "Номер версии и окно «Что нового» в шапке панели."]}, {"v": "1.6.0", "date": "30.10.2026", "items": ["«Переписать с Claude» даёт два варианта с разными началами и короткий диагноз, что мешало тексту.", "Вместо «Вернуть прежний текст» — переключатель «Твой текст / Вариант 1 / Вариант 2».", "Образец для крафтовых постов и правила, как сделать текст интересным."]}, {"v": "1.5.0", "date": "30.10.2026", "items": ["Код панели разбит на части, перед каждой публикацией панели работает автопроверка.", "Исправлено: пост с каруселью не открывался из-за замороженных данных базы.", "Тёмная «пилюля» для панели выделения, единая кнопка закрытия."]}];
/* ---------- formatting (same rules as the channel) ---------- */
const fmt = v => esc(v)
  .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)"'<>]+)\)/g,'<a href="$2">$1</a>')
  .replace(/\*\*([^*\n]+)\*\*/g,"<b>$1</b>")
  .replace(/(^|[^_\w])__([^_\n]+)__(?![_\w])/g,"$1<i>$2</i>");
const photoList = a => (Array.isArray(a.photos)?a.photos:[]).slice(0,9).map(p=>String(typeof p==="string"?p:(p&&(p.file_id||p.id))||"").trim()).map(f=>/^[A-Za-z0-9_-]{10,300}$/.test(f)?f:"");
const tagsOf = a => Array.isArray(a.hashtags)?a.hashtags.join(" "):String(a.hashtags||"");
const mediaOf = a => Array.isArray(a.media)?a.media.filter(m=>m&&m.url&&!(m.gen&&(a.layout==="cover"||a.layout==="none"))):[];
const LAYOUTS=[["cover","Обложка"],["carousel","Карусель"],["both","Обложка + карусель"],["none","Только текст"]];
function layoutOf(a){ if(a.layout) return a.layout; const gen=(a.media||[]).some(m=>m&&m.gen)||!!a.carousel; if(a.cover_off) return gen?"carousel":"none"; if(gen) return (a.cover_render===false&&!a.image_file_id)?"carousel":"both"; return "cover"; }
function adviseLayout(a){
  const t=String(a.full_text||""); const lab=String(a.label||a.section||"");
  const items=t.split("\n").filter(l=>/^\s*([–—•-]|\d+[.)])\s+/.test(l)).length, heads=(t.match(/^##\s+/gm)||[]).length;
  const photos=(a.media||[]).filter(m=>m&&!m.gen).length;
  if(/Мем/.test(lab)) return {layout:"cover",why:"Мем — одна картинка: обложка и есть шутка."};
  if(/Вакансии/.test(lab)) return {layout:"cover",why:"Подборку вакансий читают текстом и переходят по ссылкам — карусель только помешает."};
  if(a.kind==="news" && photos) return {layout:"cover",why:"Новость с фото: обложка задаёт тему, фото проекта стоят в тексте."};
  if(a.kind==="news") return {layout:"cover",why:"Новость читают быстро — хватит обложки с тезисом."};
  if(/Чек-лист/i.test(lab) || items>=4 || heads>=4) return {layout:"carousel",why:"В посте "+Math.max(items,heads,4)+" параллельных пунктов — их удобно листать и сохранять карточками. Первая карточка работает как обложка."};
  if(items>=3 || heads>=3) return {layout:"both",why:"Есть тезис и 3 пункта: обложка цепляет в ленте, карусель раскладывает пункты."};
  return {layout:"cover",why:"Один тезис и пример — сильная обложка работает лучше карусели."};
}
const imgSlots = a => { const m=mediaOf(a); return m.length? m.map(x=>x.file_id||"pending"): photoList(a); };
function richHtml(a, slots){
  const content=["<b>"+esc(plain(a.title))+"</b>"];
  const body=String(a.full_text||"").replace(/\r\n?/g,"\n").trim();
  if(body){
    const lines=body.split("\n").map(line=>{
      const ph=line.trim().match(/^\[(?:фото|photo)\s*:?\s*(\d{1,2})\]$/i);
      if(ph) return "@@IMG"+ph[1]+"@@";
      const hd=line.match(/^#{2,3}\s+(.+)$/);
      return hd?"<b>"+fmt(hd[1]).replace(/<\/?b>/g,"")+"</b>":fmt(line);
    });
    content.push(lines.join("<br/>"));
  }
  const footer=[];
  if(a.kind!=="original" && a.source) footer.push("Источник: "+esc(a.source));
  if(a.kind!=="original" && a.url){ const u=String(a.url).trim(); footer.push(/^https?:\/\/[^\s"'<>]+$/i.test(u)?'<a href="'+esc(u)+'">Открыть первоисточник ↗</a>':esc(u)); }
  const tags=tagsOf(a); if(tags) footer.push(esc(tags));
  const photos=slots||imgSlots(a), used=new Set();
  let html="<p>"+content.join("<br/><br/>")+"</p>";
  const carTop=a.carousel && a.carousel.top!==false && (a.layout==="carousel"||a.layout==="both"||!a.layout);
  html=html.replace(/(?:<br\/>)*@@IMG(\d+)@@(?:<br\/>)*/g,(m,k)=>{const n=Number(k); if(!photos[n-1]||carTop) return carTop?"<br/><br/>":""; used.add(n); return '</p><img src="tg://photo?id=p'+n+'"/><p>';}).replace(/<p><\/p>/g,"");
  const rest=photos.map((f,i)=>f&&!used.has(i+1)?'<img src="tg://photo?id=p'+(i+1)+'"/>':"").join("");
  html=html.replace(/(?:<br\/>){3,}/g,"<br/><br/>").replace(/<br\/><br\/><\/p>/g,"</p>");
  const top=carTop && rest;
  return (top?rest+html:html+rest)+(footer.length?"<hr/><footer>"+footer.join("<br/>")+"</footer>":"");
}
function textLength(a){ return [a.title,a.full_text,tagsOf(a),a.kind!=="original"&&a.source?"Источник: "+a.source:"",a.kind!=="original"?a.url:""].filter(Boolean).join("\n\n").length; }

/* ---------- covers: same renderer as the channel ---------- */
const isRendered = a => !a.cover_off && a.cover_render!==false && (a.cover_render===true || (!a.image_file_id && !a.archived && a.kind!=="news" && !mediaOf(a).length));
const coverParams = a => { const p={topic_id:a.cover_seed?a.id+"~"+a.cover_seed:a.id, title:(a.cover_title||a.title||"Дизайн-Радар").trim(), label:a.label||a.section||"Дизайн-Радар"}; if(a.cover_art) p.art=a.cover_art; return p; };
const coverKey = a => JSON.stringify(coverParams(a));
const coverCache = new Map();
function drawCover(a){
  const key=coverKey(a);
  if(coverCache.has(key)) return coverCache.get(key);
  let r; try{ r=renderCoverRGB(coverParams(a)); }catch(e){ if(a.cover_art){ try{ r=renderCoverRGB({...coverParams(a),art:undefined}); }catch(_){ return null; } } else return null; }
  const c=document.createElement("canvas"); c.width=r.W; c.height=r.H;
  const ctx=c.getContext("2d"); const img=ctx.createImageData(r.W,r.H); const d=img.data, src=r.rgb;
  for(let i=0,j=0;i<src.length;i+=3,j+=4){ d[j]=src[i]; d[j+1]=src[i+1]; d[j+2]=src[i+2]; d[j+3]=255; }
  ctx.putImageData(img,0,0); c.dataset.size=r.size; c.dataset.lines=r.lines; c.dataset.text=(r.text_lines||[]).join("\n");
  if(coverCache.size>40) coverCache.delete(coverCache.keys().next().value);
  coverCache.set(key,c); return c;
}
function mountCanvas(box, a){
  const go=()=>{ const c=drawCover(a); if(!c) return; const v=document.createElement("canvas"); v.width=c.width; v.height=c.height; v.getContext("2d").drawImage(c,0,0); v.setAttribute("aria-hidden","true"); box.replaceChildren(v); };
  if(coverCache.has(coverKey(a))) go(); else (window.requestIdleCallback||setTimeout)(go);
}
function coverMock(a){
  const c=h("div",{class:"cover","aria-label":"Обложка: "+(a.cover_title||a.title||"")});
  if(isRendered(a)){ mountCanvas(c,a); return c; }
  const firstMedia=mediaOf(a)[0];
  if(!a.image_file_id && firstMedia){ const med=mediaOf(a); c.classList.add("mcover"); c.setAttribute("aria-label","Карусель: "+med.length+" карточек");
    med.slice(0,4).forEach((m,i)=>c.append(h("img",{src:m.url,alt:i?"":(m.caption||"Первая карточка"),loading:"lazy",class:i?"":"first"})));
    if(med.length>4) c.append(h("span",{class:"more",text:"+"+(med.length-4)}));
    return c; }
  c.append(h("span",{class:"cl",text:(a.label||a.section||"Дизайн-Радар").toUpperCase()}));
  c.append(h("div",{class:"ct",text:a.cover_title||a.title||"Заголовок обложки"}));
  c.append(h("div",{class:"art","aria-hidden":"true"},h("i")));
  c.append(h("span",{class:"has",text:a.image_file_id?(a.kind==="news"?"фото из источника · превью нет":"обложка в Telegram · превью нет"):"без картинки"}));
  return c;
}
async function uploadBlobUrl(url, key){
  const blob=await (await fetch(url)).blob();
  const b64=await new Promise((ok,no)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result).split(",")[1]); r.onerror=no; r.readAsDataURL(blob); });
  const res=await mcp.callTool(MAKE, "scenarios_run", {scenarioId:SCN_PHOTO, responsive:true, data:{image_base64:b64, key:String(key).replace(/[^A-Za-z0-9_-]/g,"_")}});
  const m=JSON.stringify(res.payload??res.content??"").match(/photo_file_id\\?"\s*:\s*\\?"([A-Za-z0-9_-]{10,300})/);
  if(!m) throw {code:"tool_error",message:"Make не вернул фото: "+JSON.stringify(res.payload??res.content??"").slice(0,160)};
  return m[1];
}
async function uploadCover(a){
  const key=coverKey(a);
  if(a.image_file_id && a.cover_key===key) return a.image_file_id;
  const c=drawCover(a); if(!c) throw {code:"tool_error",message:"Не получилось нарисовать обложку."};
  const b64=c.toDataURL("image/png").split(",")[1];
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
`;
const ART_EXAMPLE = `const sw = 210, sh = 380, gap = 30, y0 = 130, xs = [X0 - 10, X0 - 10 + sw + gap, X0 - 10 + 2 * (sw + gap)];
xs.forEach((x, i) => {
  poly(rr(x, y0, x + sw, y0 + sh, 26), i === 1 ? ORANGE : LINE, 1);
  poly(rr(x + 3, y0 + 3, x + sw - 3, y0 + sh - 3, 23), WHITE, 1);
  rect(x + 24, y0 + 30, x + 120, y0 + 42, FG, 0.8);
  const cx = x + sw / 2, cy = y0 + 170;
  if (i === 0) { ring(cx, cy, 40, 4, FG, 1); rect(cx - 18, cy - 2, cx + 18, cy + 2, FG); rect(cx - 2, cy - 18, cx + 2, cy + 18, FG); }
  if (i === 1) { ring(cx - 8, cy - 8, 30, 6, ORANGE, 1); stroke([[cx + 14, cy + 14], [cx + 42, cy + 42]], 8, ORANGE, 1, false); }
  if (i === 2) { arc(cx, cy - 14, 20, Math.PI, 2 * Math.PI, 6, FG, 1); rect(cx - 30, cy - 14, cx + 30, cy + 30, FG); disc(cx, cy + 6, 6, WHITE); }
  rect(x + 40, y0 + 250, x + sw - 40, y0 + 260, FG, 0.5); rect(x + 60, y0 + 274, x + sw - 60, y0 + 284, FG, 0.3);
  rect(x + 50, y0 + 310, x + sw - 50, y0 + 346, i === 1 ? ORANGE : FG, 1);
});
["первый запуск", "пустой поиск", "нет доступа"].forEach((s, i) => txt(s, xs[i] + 4, y0 + sh + 44, 20, i === 1 ? ORANGE : MUT, 0));
`;
async function newScene(d, wish){
  if(!sample) throw {message:"Генерация недоступна в этом окне: открой панель в Claude."};
  const brief="Ты арт-директор Telegram-канала «Дизайн-Радар» для продуктовых дизайнеров. Придумай сцену для обложки поста и нарисуй её кодом.\n\nПОСТ\nЗаголовок обложки: "+(d.cover_title||d.title)+"\nРубрика: "+(d.label||d.section)+"\nТекст: "+String(d.full_text||"").slice(0,1500)+"\n"+(wish?"\nПОЖЕЛАНИЕ РЕДАКТОРА: "+wish+"\n":"")+
  "\nСЦЕНА\n— Одна метафора, которая показывает суть поста с первого взгляда: конкретный узнаваемый кусок интерфейса или процесса, а не абстрактный узор.\n— НЕ рисуй сравнение «плохо/хорошо» и плашки ПЛОХО/ХОРОШО, если редактор прямо не попросил.\n— Палитра: FG (чёрный), BG (кремовый), WHITE, LINE, MUT и один акцент ORANGE. Акцент — только на главном.\n— Без логотипов брендов, людей и персонажей.\n— Подписи короткие (1–3 слова), кириллица и латиница, размер 18–26. В шрифте НЕТ символов = ‹ › → … ← ↑ ✓ ×: стрелки и галочки рисуй фигурами (poly, stroke).\n\nХОЛСТ\n2000×640. Слева уже нарисованы рубрика и заголовок — туда не заходи. Рисунок живёт в зоне x от X0-20 до 1920 (X0 = 1180), y от 60 до 590.\n\nAPI (только эти имена): W, H, X0, BG, FG, ORANGE, rnd(), rf(a,b), ri(a,b), pick(arr), disc(cx,cy,r,col,a), ring(cx,cy,r,w,col,a), rect(x0,y0,x1,y1,col,a), line(x1,y1,x2,y2,w,col,a), quad(pts,col,a), poly(pts,col,a), sector(cx,cy,r0,r1,ang0,ang1,col,a), stroke(pts,w,col,a,closed), arc(cx,cy,r,ang0,ang1,w,col,a), band(cx,cy,fnOuter,fnInner|null,col,a), txt(s,x,baseline,size,col,track), txtW(s,size), Math. Цвета — массивы RGB. Уже объявлены (не объявляй заново): WHITE, MUT, LINE, GREEN, RED, DARKG, rr(x0,y0,x1,y1,r) — точки скруглённого прямоугольника для poly, card(x0,y0,x1,y1) — белая карточка, box(x0,y0,x1,y1,w,col) — рамка, chip(x,y,s,bg) — плашка.\n\nПРИМЕР (три экрана пустых состояний):\n"+ART_EXAMPLE+"\n\nОтветь только телом JavaScript-функции, без ``` и пояснений.";
  let msgs=[{role:"user",content:brief}], lastErr="";
  for(let i=0;i<2;i++){
    const r=await sample(msgs,{modelTier:"complex",cache:false});
    const code=String(r.text||"").replace(/^\s*```[a-z]*\s*/i,"").replace(/```\s*$/,"").trim();
    const full=ART_KIT+"\n"+code;
    try{ renderCoverRGB({...coverParams({...d,cover_art:full})}); return full; }
    catch(e){ lastErr=String(e&&e.message||e); msgs=[...msgs,{role:"assistant",content:code},{role:"user",content:"Код упал с ошибкой: "+lastErr+". Исправь и пришли только тело функции."}]; }
  }
  throw {message:"Claude нарисовал сцену с ошибкой ("+lastErr.slice(0,80)+"). Попробуй ещё раз."};
}


const TEXT_RULES = `Ты редактор Telegram-канала «Дизайн-Радар» для продуктовых дизайнеров (практики от 2 лет). Голос — лид продуктового дизайна для коллег: точно, по делу, с прямым обоснованным вердиктом, обращение на «ты».
ПРАВИЛА
— Первые две строки: что случилось или в чём проблема и при чём тут читатель. Живая сцена из интерфейса с конкретной деталью вместо общих слов.
— Одна мысль на пост. Каждое предложение даёт факт, пример или вывод, остальное вычеркни.
— Абзац до 3 предложений, предложение до 20 слов, пустая строка между абзацами. Связки «Например», «А», «Но» вместо перечисления источников подряд. Не рубить текст на телеграфные фразы.
— Иностранную дизайн-систему или автора представь одной фразой. Английскую цитату сначала перескажи по-русски, потом оригинал в кавычках «…».
— Жирный (**так**) — максимум одна ключевая фраза. Ссылки [текст](url) вшиты в слова. В новостях и разборах можно подзаголовки строкой «## …» по смыслу и список через «– ».
— Ирония сухая, одна фраза на пост, над предметом, не над людьми. В крафте и мнении без шуток.
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


/* ---------- editor helpers: lint, fragments, versions, notes ---------- */
const STOP=[["является","канцелярит — «это»"],["являются","канцелярит"],["осуществля","канцелярит — обычный глагол"],["данный","канцелярит — «этот»"],["данной","канцелярит — «этой»"],["данного","канцелярит"],["в рамках","канцелярит — «в», «для»"],["в целях","канцелярит — «для»"],["важно отметить","вводная — удали"],["не секрет","штамп"],["давайте разбер","вступление без смысла"],["очень ","пустой усилитель"],["крайне ","пустой усилитель"],["максимально","пустой усилитель"],["действительно","пустой усилитель"],["уникальн","оценка без факта"],["инновацион","оценка без факта"],["революцион","оценка без факта"],["game changer","штамп"],["must have","штамп"],["подведём итог","пересказ — дай вердикт"],["на ревью я регулярно вижу","шаблонное начало"],["как вы думаете","пустой призыв"],["пишите в комментариях","пустой призыв"],["чаще всего","утверждение без данных"],["все дизайнеры","обобщение без данных"]];
function lintText(t, media){
  const out=[]; const low=t.toLowerCase();
  for(const [w,why] of STOP){ let i=0; while((i=low.indexOf(w,i))>=0){ out.push({s:i,e:i+w.trim().length,kind:"word",msg:"«"+t.slice(i,i+w.trim().length)+"» — "+why}); i+=w.length; } }
  let off=0;
  for(const line of t.split("\n")){
    const st=(line.match(/\*\*/g)||[]).length; if(st%2) out.push({s:off,e:off+line.length,kind:"fmt",msg:"Незакрытый жирный: в строке нечётное число **"});
    const ph=line.trim().match(/^\[?(?:фото|photo)\s*:?\s*(\d{1,2})\]?$/i);
    if(ph && !/^\[(?:фото|photo)\s*:?\s*\d{1,2}\]$/i.test(line.trim())) out.push({s:off,e:off+line.length,kind:"fmt",msg:"Метка картинки без скобок — нужно [фото:"+ph[1]+"]"});
    else if(ph && Number(ph[1])>(media||0)) out.push({s:off,e:off+line.length,kind:"fmt",msg:"[фото:"+ph[1]+"] — такой картинки в посте нет"});
    const re=/(^|[^\(\w])(https?:\/\/[^\s)]+)/g; let m; while((m=re.exec(line))){ const before=line.slice(0,m.index+m[1].length); if(/\]\($/.test(before)) continue; out.push({s:off+m.index+m[1].length,e:off+m.index+m[1].length+m[2].length,kind:"link",msg:"Голая ссылка — вшей её в слова: [текст](ссылка)"}); }
    off+=line.length+1;
  }
  off=0;
  for(const para of t.split(/\n\s*\n/)){
    const start=t.indexOf(para,off); off=start+para.length;
    if(/^\s*(\[фото|##)/i.test(para)) continue;
    const sents=para.replace(/\n/g," ").split(/(?<=[.!?…])\s+(?=[«"A-ZА-ЯЁ0-9])/);
    if(sents.filter(x=>x.trim()).length>3) out.push({s:start,e:start+para.length,kind:"len",msg:"Абзац длиннее трёх предложений — раздели"});
    let so=start; for(const sn of sents){ const words=sn.replace(/\[([^\]]+)\]\([^)]+\)/g,"$1").split(/\s+/).filter(Boolean).length; const i=t.indexOf(sn.slice(0,20),so); if(words>22 && i>=0) out.push({s:i,e:i+sn.length,kind:"len",msg:"Длинное предложение ("+words+" слов) — разбей на два"}); if(i>=0) so=i+1; }
  }
  return out.sort((a,b)=>a.s-b.s);
}
const FRAG_MODES={short:"Сделай короче: убери всё, без чего смысл не меняется.",lively:"Сделай живее: конкретная деталь из интерфейса вместо общих слов, связки вместо телеграфных фраз. Без шуток, если это крафт.",simple:"Сделай проще: понятно дизайнеру с полугодом опыта, без канцелярита.",opening:"Перепиши как сильное начало поста: первая фраза — суть и при чём тут читатель."};
async function rewriteFragment(d, frag, mode, wish){
  const prompt=TEXT_RULES+"\n\nПОСТ ЦЕЛИКОМ (для контекста, не переписывай):\nЗаголовок: "+d.title+"\n"+String(d.full_text||"").slice(0,3000)+"\n\nФРАГМЕНТ, КОТОРЫЙ НУЖНО ПЕРЕПИСАТЬ:\n"+frag+"\n\nЗАДАЧА: "+(FRAG_MODES[mode]||"")+(wish?" Пожелание редактора: "+wish:"")+"\nСохрани факты, цифры, цитаты, ссылки [текст](url) и строки [фото:N] из фрагмента. Ответь только новым фрагментом, без кавычек и пояснений.";
  const r=await sample(prompt,{modelTier:"default",cache:false});
  const t=String(r.text||"").replace(/^\s*```[a-z]*\s*/i,"").replace(/```\s*$/,"").trim();
  if(!t) throw {message:"Claude вернул пустой ответ"};
  return t;
}
async function titleVariants(d, kind){
  const prompt=TEXT_RULES+"\n\nПОСТ:\nРубрика: "+(d.label||d.section)+"\nЗаголовок сейчас: "+(kind==="cover"?(d.cover_title||d.title):d.title)+"\nТекст:\n"+String(d.full_text||"").slice(0,2500)+"\n\n"+(kind==="cover"
    ?"Предложи 3 заголовка для ОБЛОЖКИ: до 45 знаков, законченная фраза, цепляет с первого взгляда; хорошо работает парадокс или контраст, который раскрывает суть (пример удачного: «Новый герб, который не новый»). Без кликбейта и выдуманных фактов."
    :"Предложи 3 заголовка ПОСТА: до 60 знаков, главное слово в начале, сразу цепляет читателя конкретикой (цифра, последствие, неожиданный факт из текста). Без каламбуров, приказов и выдуманных фактов.")+"\nОтветь только JSON-массивом из трёх строк.";
  const v=await sample.json(prompt,{modelTier:"default",cache:false});
  return (Array.isArray(v)?v:[]).map(x=>String(x).trim()).filter(Boolean).slice(0,3);
}
const readTime = t => { const w=plain(t).split(/\s+/).filter(Boolean).length; const sec=Math.max(5,Math.round(w/200*60)); return sec<60?"≈ "+(Math.round(sec/5)*5)+" сек чтения":"≈ "+Math.round(sec/60)+" мин чтения"; };
function diffStat(a,b){ const A=String(a||"").split(/\s+/).filter(Boolean), B=String(b||"").split(/\s+/).filter(Boolean); const ca={}; A.forEach(w=>ca[w]=(ca[w]||0)+1); let same=0; B.forEach(w=>{ if(ca[w]){ca[w]--;same++;} }); return {add:B.length-same, del:A.length-same}; }


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

/* ---------- Telegram-style preview ---------- */
function tgPreview(a){
  const box=h("div",{class:"tg"});
  if(!a.cover_off && (a.image_file_id || isRendered(a))) box.append(coverMock(a));
  const tx=h("div",{class:"tx"});
  const med=mediaOf(a);
  const html=richHtml(a).replace(/<img src="tg:\/\/photo\?id=p(\d+)"\/>/g,(m,n)=>{ const it=med[Number(n)-1]; return it?'<img class="mi" alt="'+esc(it.caption||("фото "+n))+'" src="'+esc(it.url)+'"/>':'<div class="ph">фото '+n+' · превью нет</div>'; }).replace(/<hr\/><footer>/,'<div class="ft">').replace(/<\/footer>$/,"</div>");
  tx.innerHTML=html; // built from escaped text only
  box.append(tx);
  return box;
}

/* ---------- data ---------- */
const postsCol = () => db.collection("posts");
const ideasCol = () => db.collection("ideas");
/* Посты авторов живут в byauthor/<uid>/posts: правила базы дают автору писать только туда. Общие посты (posts) пишет только главный редактор. */
const authorCol = uid => db.collection("byauthor/"+uid+"/posts");
const baseOf = id => (S.baseOverride&&S.baseOverride[id]) || ((S.posts.find(p=>p.id===id)||{})._base) || "posts";
const mayEdit = a => !!a && (S.owner || (S.canWrite && (a._base||"posts")!=="posts" && (a.author||"")===S.me));
function mergePosts(){
  const extra=[]; for(const arr of Object.values(S.authorPosts||{})) extra.push(...arr);
  S.posts=[...(S.mainPosts||[]), ...extra.filter(p=>p.status!=="moved")];
}
const authorSubs={};
function watchAuthors(){
  const ids=new Set(Object.keys(S.edRaw||{})); if(S.realMe) ids.add(S.realMe); if(S.realOwner) ids.add(TEST_ID);
  for(const uid of ids){ if(authorSubs[uid]) continue;
    authorSubs[uid]=authorCol(uid).onSnapshot(snap=>{ S.authorPosts=S.authorPosts||{}; S.authorPosts[uid]=snap.docs.map(d=>({id:d.id,...d.data(),_base:"byauthor/"+uid+"/posts"})); mergePosts(); render(); resolveNames(); syncEditor(); setTimeout(prepareEditorPosts,1500); }, ()=>{}); }
}
function mergeEditors(){ S.editors={}; const ids=new Set([...Object.keys(S.edRaw||{}),...Object.keys(S.roles||{})]); for(const id of ids){ const r=(S.roles||{})[id]||{}; S.editors[id]={...((S.edRaw||{})[id]||{}), status:r.status||"", can_publish:!!r.can_publish}; } }
const setRole=(id,patch)=>db.doc("roles/"+id).set({...((S.roles||{})[id]||{}), ...patch, updated_at:Date.now(), by:S.realMe||""});
/* Главный редактор забирает пост автора в общую ленту перед публикацией: публикует только то, что лежит в posts. */
async function adoptPost(a){
  if(!S.owner || (a._base||"posts")==="posts") return a;
  const {_base, ...data}=JSON.parse(JSON.stringify(a)); delete data.id;
  await postsCol().doc(a.id).set({...data, adopted_from:_base, adopted_at:Date.now()});
  await db.collection(_base).doc(a.id).update({status:"moved", moved_to:"posts/"+a.id, updated_at:Date.now()});
  S.baseOverride=S.baseOverride||{}; S.baseOverride[a.id]="posts";
  return {...a, _base:"posts"};
}
function byView(v){
  const p=S.posts.filter(authorOk);
  if(v==="review") return p.filter(x=>["review","queued","publishing","publish_unknown"].includes(x.status)).sort((a,b)=>(b.updated_at||0)-(a.updated_at||0));
  if(v==="plan") return p.filter(x=>x.status==="scheduled").sort((a,b)=>(a.scheduled_at||0)-(b.scheduled_at||0));
  if(v==="drafts") return p.filter(x=>x.status==="draft").sort((a,b)=>(b.updated_at||0)-(a.updated_at||0));
  if(v==="published") return p.filter(x=>x.status==="published").sort((a,b)=>(b.published_at||0)-(a.published_at||0));
  return [];
}
async function savePost(id, patch){
  const {_base, ...clean}=patch;
  await db.collection(baseOf(id)).doc(id).update({...clean, updated_at:Date.now()});
}

/* ---------- publishing ---------- */
function findMessageId(x, depth=0){
  if(x==null || depth>6) return 0;
  if(typeof x==="string"){ try{ return findMessageId(JSON.parse(x),depth+1);}catch{ return 0; } }
  if(typeof x!=="object") return 0;
  if(Number.isSafeInteger(x.message_id) && x.message_id>0) return x.message_id;
  for(const v of Object.values(x)){ const m=findMessageId(v,depth+1); if(m) return m; }
  return 0;
}
const PUB_TRIGGER = "trig_015jMNCGYWvjDN6b5s8MGi3R";
const CCR = "Claude Code Remote";
async function canvasAsset(a){
  const c=drawCover(a); if(!c) throw {code:"cover"};
  const blob=await new Promise(ok=>c.toBlob(ok,"image/png"));
  const r=await assets.upload(new File([blob],"cover_"+a.id+".png",{type:"image/png"}));
  return r.id;
}
async function buildRich(a){
  const media=[];
  if(isRendered(a)) media.push({id:"cover", media:{type:"photo", media:await uploadCover(a)}});
  else if(a.image_file_id && !a.cover_off) media.push({id:"cover", media:{type:"photo", media:a.image_file_id}});
  const med=mediaOf(a); let slots;
  if(med.length){
    const fresh=med.map(m=>({...m}));
    for(let i=0;i<fresh.length;i++){
      if(!fresh[i].file_id){ fresh[i].file_id=await uploadBlobUrl(fresh[i].url, a.id+"_p"+(i+1)); await savePost(a.id,{media:fresh}); }
      media.push({id:"p"+(i+1), media:{type:"photo", media:fresh[i].file_id}});
    }
    slots=fresh.map(m=>m.file_id);
  } else { slots=photoList(a); slots.forEach((f,i)=>{ if(f) media.push({id:"p"+(i+1), media:{type:"photo", media:f}}); }); }
  const rich={html:(media.some(m=>m.id==="cover")?'<img src="tg://photo?id=cover"/>':"")+richHtml(a, slots)};
  if(media.length) rich.media=media;
  return rich;
}
async function updateInChannel(id, draft){
  const base=S.posts.find(p=>p.id===id); if(!base) return;
  const a=draft?{...base, ...draft, id}:base;
  if(!mcp){ toast("Обновление недоступно в этом окне: открой панель в Claude."); return; }
  const mid=Number(a.published_message_id)||Number(String(a.published_url||"").split("/").pop());
  if(!mid){ toast("Не знаю номер сообщения в канале — обнови пост вручную в Telegram."); return; }
  if(textLength(a)>LIMIT){ toast("Пост длиннее "+LIMIT+" знаков. Сократи текст."); return; }
  S.busy[id]=true; render();
  try{
    const body={chat_id:CHANNEL, message_id:mid, rich_message:await buildRich(a)};
    const res=await mcp.callTool(MAKE, TOOL_TG, {method:"editMessageText", body:JSON.stringify(body)});
    const raw=JSON.stringify(res.payload??res.content??"");
    if(/"ok"\s*:\s*false|error_code/.test(raw)) throw {message:raw.slice(0,200)};
    await savePost(id,{channel_updated_at:Date.now()});
    toast("Пост в канале обновлён");
  }catch(e){ toast("Не удалось обновить: "+((e&&e.message)||"попробуй ещё раз").slice(0,160)); }
  finally{ S.busy[id]=false; render(); }
}
const DISPATCH = "trig_01WWyd17PvLVN5jSuiwHkRwb";
const pad2=n=>String(n).padStart(2,"0");
function whenText(ms){ if(!ms) return "—"; const d=new Date(ms); return dayText(ms).toLowerCase()+", "+pad2(d.getHours())+":"+pad2(d.getMinutes()); }
function dayText(ms){ const d=new Date(ms), t=new Date(); const z=x=>new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime(); const diff=Math.round((z(d)-z(t))/864e5);
  const wd=d.toLocaleDateString("ru-RU",{weekday:"long"}); const dm=d.toLocaleDateString("ru-RU",{day:"numeric",month:"long"});
  return diff===0?"Сегодня, "+dm:diff===1?"Завтра, "+dm:wd.charAt(0).toUpperCase()+wd.slice(1)+", "+dm; }
function localInput(ms){ const d=new Date(ms); return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate())+"T"+pad2(d.getHours())+":"+pad2(d.getMinutes()); }
function at(dayOffset,hh,mm){ const d=new Date(); d.setDate(d.getDate()+dayOffset); d.setHours(hh,mm||0,0,0); return d.getTime(); }
const SLOT_GAP=60*6e4;
const takenSlots=exceptId=>S.posts.filter(p=>p.status==="scheduled"&&p.id!==exceptId&&p.scheduled_at).map(p=>({ms:p.scheduled_at,title:plain(p.title),author:p.author||"claude"}));
const slotConflict=(ms,exceptId)=>takenSlots(exceptId).find(t=>Math.abs(t.ms-ms)<SLOT_GAP);
function nextFree(ms,exceptId){ let t=ms; for(let i=0;i<96&&slotConflict(t,exceptId);i++) t+=30*6e4; return t; }
function schedPicker(a){
  const now=Date.now(); let val=a.scheduled_at&&a.scheduled_at>now?a.scheduled_at:(at(0,18)>now+15*6e4?at(0,18):at(1,10));
  const inp=h("input",{type:"datetime-local",value:localInput(val),min:localInput(now+5*6e4),"aria-label":"Дата и время выхода"});
  const chips=h("div",{class:"chips"});
  const opts=[["Сегодня 18:00",at(0,18)],["Завтра 10:00",at(1,10)],["Завтра 14:00",at(1,14)],["Завтра 18:00",at(1,18)],["Послезавтра 10:00",at(2,10)]].filter(o=>o[1]>now+5*6e4);
  if(slotConflict(val,a.id)) val=nextFree(val,a.id); inp.value=localInput(val);
  const warn=h("div",{class:"hint slotwarn"});
  const check=()=>{ const ms=new Date(inp.value).getTime(); const c=ms&&slotConflict(ms,a.id); warn.textContent=c?"Занято: «"+c.title.slice(0,50)+"» ("+authorName(c.author)+") выходит "+whenText(c.ms)+". Между постами нужен час — ближайшее свободное: "+whenText(nextFree(ms,a.id))+".":""; warn.classList.toggle("bad",!!c); return !c; };
  inp.addEventListener("input",check);
  opts.forEach(([t,ms])=>{ const c=slotConflict(ms,a.id); const b=h("button",{type:"button",class:"btn sm chip"+(ms===val?" on":""),disabled:!!c,title:c?"Занято: "+c.title+" — "+authorName(c.author):""},c?t+" · занято":t);
    b.addEventListener("click",()=>{ inp.value=localInput(ms); [...chips.children].forEach(x=>x.classList.remove("on")); b.classList.add("on"); check(); }); chips.append(b); });
  const taken=takenSlots(a.id).filter(t=>t.ms>now).sort((x,y)=>x.ms-y.ms).slice(0,6);
  const takenBox=taken.length?h("div",{class:"taken"}, h("span",{class:"hint",text:"Уже в плане:"}), ...taken.map(t=>h("span",{class:"tk",text:whenText(t.ms)+" · "+authorName(t.author)}))):null;
  const busy=!!S.busy[a.id];
  return h("div",{class:"sched"}, panelHead("Когда выпустить?",()=>{S.sched=null;render();}), chips, inp, warn, takenBox,
    h("div",{class:"amain"}, h("button",{class:"btn accent",disabled:busy,onclick:()=>{ const ms=new Date(inp.value).getTime(); if(!ms||ms<Date.now()+2*6e4){ toast("Выбери время хотя бы на 2 минуты вперёд"); return; } if(!check()){ toast("Это время уже занято другим постом"); return; } scheduleAt(a,ms); }},busy?"Готовлю…":"Запланировать"),
      h("button",{class:"btn",onclick:()=>{S.sched=null;render();}},"Отмена")));
}
let preparing=false;
async function prepareEditorPosts(){
  if(!S.owner || !mcp || preparing) return;
  const list=S.posts.filter(p=>p.status==="scheduled" && p.needs_prepare);
  if(!list.length) return;
  preparing=true;
  try{ for(const a of list){ try{ const outbox=await prepareOutbox(a); await savePost(a.id,{outbox, needs_prepare:false}); }catch(e){ await savePost(a.id,{publish_error:"Не удалось подготовить пост редактора: "+String(e&&e.message||"ошибка").slice(0,120)}).catch(()=>{}); } }
    await armDispatcher(); }
  finally{ preparing=false; }
}
async function armDispatcher(extra){
  if(!mcp) return;
  const times=S.posts.filter(p=>p.status==="scheduled"&&(p._base||"posts")==="posts"&&(!extra||p.id!==extra.id)).map(p=>p.scheduled_at||0);
  if(extra&&extra.status==="scheduled") times.push(extra.scheduled_at);
  const next=times.filter(Boolean).sort((x,y)=>x-y)[0];
  if(!next) return;
  const runAt=new Date(Math.max(next, Date.now()+90*1000)); runAt.setSeconds(0,0);
  try{ await mcp.callTool(CCR,"update_trigger",{trigger_id:DISPATCH, run_once_at:runAt.toISOString().replace(/\.\d{3}Z$/,"Z"), enabled:true}); }
  catch(e){ toast("Не удалось поставить таймер публикации — попробуй ещё раз"); throw e; }
}
async function prepareOutbox(a){
  const body={chat_id:CHANNEL, rich_message:await buildRich(a)};
  return {body:JSON.stringify(body), prepared_at:Date.now()};
}
const myEd=()=>S.me&&S.editors[S.me]||{};
const canPub=a=>S.owner || (!!myEd().can_publish && !S.paused && (a.author||"")===S.me);
async function scheduleAt(a, ms){
  if(ms>Date.now()+5*6e4){ const c=slotConflict(ms,a.id); if(c){ S.errors[a.id]="Время занято постом «"+c.title.slice(0,50)+"» ("+authorName(c.author)+"). Выбери другое."; render(); return; } }
  if(!S.owner){
    if(!canPub(a)) return;
    if(textLength(a)>LIMIT){ S.errors[a.id]="Пост длиннее "+LIMIT+" знаков. Сократи текст."; render(); return; }
    S.busy[a.id]=true; render();
    const med=mediaOf(a); const photos=med.length?med.map(m=>m.file_id||null):photoList(a).map(f=>f||null);
    let cover=null, cover_file_id="";
    if(isRendered(a)){ if(a.image_file_id && a.cover_key===coverKey(a)) cover_file_id=a.image_file_id; else { const cp=coverParams(a); cover={topic_id:String(cp.topic_id).replace(/[^A-Za-z0-9_-]/g,"-").slice(0,38), title:cp.title, label:cp.label, art:cp.art||""}; } }
    else if(a.image_file_id && !a.cover_off) cover_file_id=a.image_file_id;
    const html=((cover||cover_file_id)?'<img src="tg://photo?id=cover"/>':"")+richHtml(a, photos.map(f=>f||"pending"));
    const prep={html, cover, cover_file_id, photos, prepared_at:Date.now()};
    try{ await savePost(a.id,{status:"scheduled", scheduled_at:ms, needs_prepare:true, prep, outbox:{__delete__:true}, scheduled_by:S.me, publish_error:""}); S.sched=null; S.confirm=null;
      toast(ms<=Date.now()+5*6e4?"Пост выйдет в течение часа":"Запланировано: "+whenText(ms)+" (в течение часа после этого времени)"); }
    catch(e){ S.errors[a.id]="Не удалось отправить в публикацию. Попробуй ещё раз."; }
    finally{ S.busy[a.id]=false; render(); }
    return;
  }
  if(!mcp){ toast("Планирование недоступно в этом окне: открой панель в Claude."); return; }
  try{ a=await adoptPost(a); }catch(e){ S.errors[a.id]="Не удалось забрать пост автора в общую ленту."; render(); return; }
  if(textLength(a)>LIMIT){ S.errors[a.id]="Пост длиннее "+LIMIT+" знаков. Сократи текст."; render(); return; }
  S.busy[a.id]=true; S.errors[a.id]=""; render();
  try{
    const outbox=await prepareOutbox(a);
    await savePost(a.id,{status:"scheduled", scheduled_at:ms, outbox, needs_prepare:false, publish_error:""});
    await armDispatcher({id:a.id,status:"scheduled",scheduled_at:ms});
    S.sched=null; toast("Запланировано: "+whenText(ms));
  }catch(e){
    await savePost(a.id,{status:"review"}).catch(()=>{});
    const code=e&&e.code;
    S.errors[a.id]=(code==="approval_required"||code==="not_granted")?"Разреши панели доступ к Make и Claude Code Remote и нажми ещё раз.":"Не удалось запланировать"+(e&&e.message?": "+String(e.message).slice(0,160):"")+".";
  }finally{ S.busy[a.id]=false; render(); }
}
const ICO={auto:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>',
 light:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
 dark:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>'};
const THEMES=[["auto","auto","Тема: как в системе"],["light","light","Тема: светлая"],["dark","dark","Тема: тёмная"]];
function getTheme(){ try{ return localStorage.getItem("dr_theme")||"auto"; }catch(_){ return "auto"; } }
function applyTheme(t){ if(t==="auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme",t); }
function themeBtn(){
  const cur=()=>THEMES.find(x=>x[0]===getTheme())||THEMES[0];
  const b=h("button",{type:"button",class:"iconbtn",title:cur()[2],"aria-label":cur()[2]}); b.innerHTML=ICO[cur()[0]];
  b.addEventListener("click",()=>{ const i=THEMES.findIndex(x=>x[0]===getTheme()); const nx=THEMES[(i+1)%THEMES.length]; try{ localStorage.setItem("dr_theme",nx[0]); }catch(_){} applyTheme(nx[0]); document.querySelectorAll(".iconbtn.th").forEach(e=>{ e.innerHTML=ICO[nx[0]]; e.title=nx[2]; e.setAttribute("aria-label",nx[2]); }); toast(nx[2]); });
  b.classList.add("th"); return b;
}
applyTheme(getTheme());
document.addEventListener("DOMContentLoaded",()=>{ const sl=document.getElementById("themeSlot"); if(sl) sl.replaceWith(themeBtn()); });
setTimeout(()=>{ const sl=document.getElementById("themeSlot"); if(sl) sl.replaceWith(themeBtn()); },0);
async function publish(a){
  if(!mcp){ S.errors[a.id]="Публикация недоступна в этом окне: открой панель в Claude."; render(); return; }
  if(textLength(a)>LIMIT){ S.errors[a.id]="Пост длиннее "+LIMIT+" знаков вместе с заголовком и хэштегами. Сократи текст."; render(); return; }
  S.busy[a.id]=true; S.errors[a.id]=""; S.confirm=null; render();
  try{ a=await adoptPost(a); }catch(e){ S.busy[a.id]=false; S.errors[a.id]="Не удалось забрать пост автора в общую ленту."; render(); return; }
  let sent=false;
  try{
    const body={chat_id:CHANNEL, rich_message:await buildRich(a)};
    await savePost(a.id,{status:"publishing", publish_error:""});
    const res=await mcp.callTool(MAKE, TOOL_TG, {method:"sendRichMessage", body:JSON.stringify(body)});
    sent=true;
    const raw=JSON.stringify(res.payload??res.content??"");
    const mid=findMessageId(res.payload??res.content);
    if(!mid){ await savePost(a.id,{status:"publish_unknown", publish_error:"Make ответил без номера сообщения: "+raw.slice(0,200)}); toast("Проверь канал: ответ Telegram неясный"); return; }
    const patch={status:"published", published_at:Date.now(), published_message_id:mid, published_url:"https://t.me/"+CHANNEL.slice(1)+"/"+mid};
    if(a.owner_edited && a.orig_text!=null) patch.edit_logged=false;
    await savePost(a.id,patch);
    toast("Опубликовано в канал");
  }catch(e){
    const code=e&&e.code; let msg;
    if(sent){ await savePost(a.id,{status:"publish_unknown"}).catch(()=>{}); S.errors[a.id]="Пост мог уйти в канал — проверь его, прежде чем жать ещё раз."; return; }
    if(code==="server_not_connected") msg="В твоём Claude не подключён коннектор Make. Добавь его в настройках коннекторов.";
    else if(code==="approval_required"||code==="not_granted") msg="Разреши панели запускать публикацию: нажми «Опубликовать» ещё раз и подтверди доступ.";
    else if(code==="cover") msg="Не получилось нарисовать обложку. Поменяй заголовок обложки и попробуй снова.";
    else msg="Не удалось опубликовать"+(e&&e.message?": "+String(e.message).slice(0,160):"")+". Попробуй ещё раз через минуту.";
    await savePost(a.id,{status:"review"}).catch(()=>{}); S.errors[a.id]=msg;
  }finally{ S.busy[a.id]=false; render(); }
}

/* ---------- views ---------- */
function renderTabs(){
  const nav=$("#tabs"); nav.replaceChildren();
  for(const v of VIEWS){
    const n = v.id==="ideas" ? S.ideas.filter(i=>i.status!=="done").length : v.id==="team" ? null : byView(v.id).length;
    const nm=v.id==="team"&&S.owner?"Редакция":v.name;
    const n2=v.id==="team"&&S.owner?(S.invites.filter(i=>i.status==="sent").length||null):n;
    nav.append(h("button",{class:"tab","aria-current":S.view===v.id?"page":null,onclick:()=>{location.hash=v.id;}}, nm, n2!=null&&n2>0?h("span",{class:"n",text:n2}):null));
  }
}
function postCard(a){
  const busy=!!S.busy[a.id], err=S.errors[a.id];
  const card=h("article",{class:"card"});
  card.append(coverMock(a,true));
  const b=h("div",{class:"body"});
  const med=mediaOf(a);
  const st={scheduled:"выйдет "+whenText(a.scheduled_at),review:"на согласовании",draft:"черновик",published:"опубликован",rejected:"отклонён",queued:"выходит в канал…",publishing:"публикуется…",publish_unknown:"проверь канал"}[a.status]||a.status;
  b.append(h("div",{class:"meta"}, h("span",{class:"status "+a.status,text:st}), h("span",{text:authorName(a.author)}), h("span",{text:ago(a.published_at||a.updated_at||a.created_at)})));
  b.append(h("h3",{text:plain(a.title)}));
  b.append(h("p",{class:"excerpt",text:plain(a.full_text).slice(0,280)}));
  if(med.length){ const st=h("div",{class:"strip",style:"padding:0"}); med.slice(0,10).forEach((m,i)=>st.append(h("img",{src:m.url,alt:m.caption||("Картинка "+(i+1)),loading:"lazy"}))); b.append(h("div",{class:"meta",text:(med.length>1?"Карусель · ":"Картинка · ")+med.length+" шт."}), st); }
  if(a.notes_open>0) b.querySelector(".meta")?.append(h("span",{class:"chk notes",title:"Открытые заметки к посту"},"💬 "+a.notes_open));
  if(a.check && a.status!=="published") b.querySelector(".meta")?.append(h("span",{class:"chk",title:"Есть что проверить руками — подробности в посте"},h("span",{class:"chk-i","aria-hidden":"true",text:"!"}),"проверить"));
  if(err) b.append(h("div",{class:"notice err",text:err}));
  else if(a.publish_error && (a.status==="review"||a.status==="scheduled")) b.append(h("div",{class:"notice err",text:a.publish_error}));
  if(a.status==="queued") b.append(h("div",{class:"notice",text:"Публикация запущена. Если через 5 минут пост не вышел, проверь канал."}));
  const acts=h("div",{class:"cacts"});
  const main=h("div",{class:"amain"}), sub=h("div",{class:"asub"});
  const link=(text,fn,cls="")=>h("button",{type:"button",class:"btn "+cls,onclick:fn},text);
  if(a.status==="queued"){
    sub.append(link("Отменить публикацию",()=>savePost(a.id,{status:"review"}).then(()=>toast("Публикация отменена")),"danger"));
  } else if(a.status==="publish_unknown"){
    main.append(h("button",{class:"btn accent",onclick:()=>savePost(a.id,{status:"published",published_at:Date.now()})},"Пост вышел"),
                h("button",{class:"btn",onclick:()=>{S.errors[a.id]="";savePost(a.id,{status:"review"});}},"Не вышел"));
  } else if(a.status==="published"){
    if(a.published_url) main.append(h("a",{class:"btn",href:a.published_url,target:"_blank",rel:"noopener"},"Открыть в канале ↗"));
    main.append(h("button",{class:"btn",onclick:()=>openEditor(a.id)},S.owner?"Исправить":"Посмотреть"));
  } else if(S.sched===a.id){
    acts.append(schedPicker(a));
  } else if(a.status==="scheduled"){
    if(S.owner) main.append(h("button",{class:"btn accent",disabled:busy,onclick:()=>{S.sched=a.id;render();}},"Перенести"),
      h("button",{class:"btn",disabled:busy,onclick:()=>{S.confirm=a.id;S.sched=null;savePost(a.id,{status:"review"}).then(()=>{location.hash="review";armDispatcher();});}},"Выпустить сейчас"));
    else if(canPub(a)) main.append(h("button",{class:"btn accent",disabled:busy,onclick:()=>{S.sched=a.id;render();}},"Перенести"));
    if(a.needs_prepare && S.owner) b.append(h("div",{class:"notice"},"Пост редактора: при открытии панели обложка и картинки уже готовятся к выходу."));
    sub.append(link("Редактировать",()=>openEditor(a.id)));
    if(S.owner||canPub(a)) sub.append(link("Снять с плана",()=>savePost(a.id,{status:"review"}).then(()=>{toast("Снято с плана, пост на согласовании");armDispatcher();}),"danger"));
  } else if(S.confirm===a.id){
    acts.append(h("div",{class:"confirm"}, h("p",{},S.owner?"Пост сразу появится в ":"Пост выйдет в течение часа в ", h("b",{text:CHANNEL}), ". Опубликовать?"),
      h("div",{class:"amain"}, h("button",{class:"btn accent",disabled:busy,onclick:()=>S.owner?publish(a):scheduleAt(a,Date.now())},"Да, опубликовать"), h("button",{class:"btn",onclick:()=>{S.confirm=null;render();}},"Отмена"))));
  } else {
    if(canPub(a) && (a.status==="review"||(!S.owner&&a.status==="draft"))){
      main.append(h("button",{class:"btn accent",disabled:busy||a.status==="publishing",onclick:()=>{S.confirm=a.id;render();}},busy?"Публикую…":"Опубликовать"));
      main.append(h("button",{class:"btn",disabled:busy,onclick:()=>{S.sched=a.id;S.confirm=null;render();}},"Запланировать"));
    } else {
      if(a.status==="draft" && mayEdit(a)) main.append(h("button",{class:"btn accent",onclick:()=>savePost(a.id,{status:"review"}).then(()=>toast("Отправлено на согласование"))},"На согласование"));
      main.append(h("button",{class:"btn",onclick:()=>openEditor(a.id)},"Редактировать"));
    }
    if(!S.owner && canPub(a) && a.status==="draft") sub.append(link("На согласование",()=>savePost(a.id,{status:"review"}).then(()=>toast("Отправлено на согласование"))));
    if(a.status==="review" && mayEdit(a)) sub.append(link("В черновики",()=>savePost(a.id,{status:"draft"}).then(()=>toast("Перенесено в черновики"))));
    if(S.owner && a.status!=="published") sub.append(link("Отклонить",()=>savePost(a.id,{status:"rejected"}).then(()=>toast("Отклонено")),"danger"));
  }
  if(main.childNodes.length===1) main.classList.add("one");
  if(sub.childNodes.length===1) sub.classList.add("one");
  if(sub.childNodes.length===3) sub.classList.add("three");
  if(main.childNodes.length) acts.append(main);
  if(sub.childNodes.length) acts.append(sub);
  b.append(acts); card.append(b);
  card.classList.add("open");
  card.tabIndex=0;
  card.setAttribute("aria-label","Открыть пост: "+plain(a.title));
  card.addEventListener("click",e=>{ if(e.target.closest("button,a,input,select,textarea,label,.confirm")) return; if(getSelection&&String(getSelection()).length) return; openEditor(a.id); });
  card.addEventListener("keydown",e=>{ if(e.target===card && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); openEditor(a.id); } });
  return card;
}
function emptyState(v){
  const t={
    review:["Сейчас нечего согласовывать","Новые посты от редакции появятся здесь. Черновики отправляются сюда кнопкой «На согласование»."],
    plan:["Пока ничего не запланировано","На согласовании нажми «Запланировать» у поста и выбери время выхода."],
    drafts:["Черновиков нет","Начни новый пост или возьми идею из раздела «Идеи»."],
    published:["Здесь будут вышедшие посты","После публикации пост переезжает сюда со ссылкой на канал."]
  }[v];
  return h("div",{class:"empty"}, h("b",{text:t[0]}), h("span",{text:t[1]}), S.canWrite?h("button",{class:"btn primary",onclick:newPost},"Новый пост"):null);
}
function renderFeed(v){
  const titles={plan:["План публикаций","Запланированные посты по времени выхода. Они выйдут сами, даже если панель закрыта."],review:["На согласовании","Посты, которые ждут твоего решения. Публикуй сразу или запланируй время выхода."],drafts:["Черновики","Посты в работе. Когда текст готов, отправь его на согласование."],published:["Опубликовано","Последние посты, которые вышли в канале."]}[v];
  const m=$("#main");
  m.append(h("div",{class:"lead"}, h("div",{}, h("h2",{text:titles[0]}), h("p",{text:titles[1]})), h("div",{class:"leadacts"}, authorSelect(), S.canWrite?h("button",{class:"btn primary",onclick:newPost},"+ Новый пост"):null)));
  const list=byView(v);
  if(!S.ready){ m.append(h("div",{class:"empty"},h("b",{text:"Загружаю посты…"}))); return; }
  if(!list.length){ m.append(emptyState(v)); return; }
  if(v==="plan"){ let day=""; let f=null; list.forEach(a=>{ const d=dayText(a.scheduled_at); if(d!==day){ day=d; m.append(h("h3",{class:"dayh",text:d})); f=h("div",{class:"feed"}); m.append(f); } f.append(postCard(a)); }); return; }
  const f=h("div",{class:"feed"}); list.slice(0,v==="published"?40:200).forEach(a=>f.append(postCard(a))); m.append(f);
}
function renderIdeas(){
  const m=$("#main");
  m.append(h("div",{class:"lead"}, h("div",{}, h("h2",{text:"Идеи"}), h("p",{text:"Темы для будущих постов. Идею можно взять в работу сам или отдать редакции: тогда пост напишет Claude по правилам канала и пришлёт на согласование."}))));
  if(S.canWrite){
    const inp=h("input",{id:"ideaInput",type:"text",placeholder:"Тема или зацепка: например, «пустые состояния в B2B-таблицах»","aria-label":"Новая идея"});
    const out=h("div",{class:"hint",id:"ideaOut"});
    const add=async()=>{ const t=inp.value.trim(); if(!t) return; await ideasCol().add({text:t, angle:"", author:S.me||"", status:"new", created_at:Date.now()}); inp.value=""; toast("Идея сохранена"); };
    const gen=async(btn)=>{
      if(!sample){ out.textContent="Генерация идей недоступна в этом окне."; return; }
      btn.disabled=true; out.textContent="Думаю над темами…";
      const recent=S.posts.filter(p=>p.status==="published").slice(0,15).map(p=>"— "+plain(p.title)).join("\n");
      const seed=inp.value.trim();
      try{
        const res=await sample.json("Ты редактор Telegram-канала «Дизайн-Радар» для продуктовых дизайнеров (тон: профессиональный, редакционный, без воды; рубрики: новости, разборы интерфейсов и брендинга, крафт — паттерны и приёмы, мнения, вакансии, книги и фильмы). Предложи 5 тем для постов"+(seed?" вокруг направления: «"+seed+"»":"")+". Каждая тема должна давать читателю практический вывод и опираться на то, что можно проверить по открытым источникам (дизайн-системы, гайдлайны, статьи практиков). Не повторяй уже вышедшие темы:\n"+(recent||"—")+"\nОтветь только JSON-массивом объектов {\"title\": заголовок до 70 знаков, \"angle\": одно предложение — тезис и чем полезно, \"rubric\": одна из «Крафт», «Разбор», «Мнение», «Новости»}.",{modelTier:"default"});
        const arr=Array.isArray(res)?res:(res&&res.ideas)||[];
        for(const it of arr.slice(0,6)) if(it&&it.title) await ideasCol().add({text:String(it.title).slice(0,140), angle:String(it.angle||"").slice(0,400), rubric:String(it.rubric||"").slice(0,30), author:S.me||"", by_ai:true, status:"new", created_at:Date.now()});
        out.textContent=arr.length?"Добавила "+Math.min(arr.length,6)+" идей. Оставь нужные, остальные удали.":"Не получилось придумать — попробуй уточнить направление.";
      }catch(e){ out.textContent=e&&e.code==="not_granted"?"Чтобы генерировать идеи, разреши панели обращаться к Claude.":"Не удалось сгенерировать идеи. Попробуй ещё раз позже."; }
      finally{ btn.disabled=false; }
    };
    inp.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); add(); }});
    const genBtn=h("button",{class:"btn",onclick:e=>gen(e.currentTarget)},"✦ Придумать 5 тем");
    m.append(h("div",{class:"ideabox"}, h("div",{class:"r"}, inp, h("button",{class:"btn primary",onclick:add},"Сохранить идею"), genBtn), out));
  }
  const list=S.ideas.filter(i=>i.status!=="done").sort((a,b)=>(b.created_at||0)-(a.created_at||0));
  if(!list.length){ m.append(h("div",{class:"empty"},h("b",{text:"Идей пока нет"}),h("span",{text:"Запиши тему одной строкой или попроси Claude предложить пять."}))); return; }
  const f=h("div",{class:"feed"});
  for(const it of list){
    const st={new:null,requested:"отдано редакции",taken:"в работе"}[it.status];
    f.append(h("div",{class:"idea"},
      h("div",{class:"meta"}, it.rubric?h("span",{class:"label",text:it.rubric}):null, st?h("span",{class:"status review",text:st}):null, h("span",{text:it.by_ai?"предложил Claude":authorName(it.author)}), h("span",{text:ago(it.created_at)})),
      h("h4",{text:it.text}), it.angle?h("p",{text:it.angle}):null,
      S.canWrite?h("div",{class:"acts"},
        it.status!=="requested"?h("button",{class:"btn sm primary",onclick:()=>ideasCol().doc(it.id).update({status:"requested",requested_by:S.me||"",requested_at:Date.now()}).then(()=>toast("Редакция напишет пост и пришлёт на согласование"))},"Отдать редакции"):null,
        h("button",{class:"btn sm",onclick:()=>newPost({title:it.text, idea:it.id})},"Написать самому"),
        h("button",{class:"btn sm ghost danger",onclick:()=>ideasCol().doc(it.id).delete()},"Удалить")):null));
  }
  m.append(f);
}
function renderTeam(){
  const m=$("#main");
  m.append(h("div",{class:"lead"}, h("div",{}, h("h2",{text:"Колонки"}), h("p",{text:"Кто пишет в канал. Чтобы добавить редактора, поделись этой страницей с правом редактирования: при первом входе он заполнит анкету и появится здесь со своей колонкой."}))));
  const ids=new Set(["claude", ...Object.keys(S.editors), ...S.posts.map(p=>p.author).filter(Boolean)]);
  const g=h("div",{class:"people"});
  for(const id of ids){
    const count=S.posts.filter(p=>(p.author||"claude")===id && p.status==="published").length;
    const ed=S.editors[id]||{};
    const nm=id==="claude"?"Редакция (Claude)":authorName(id);
    const col=id==="claude"?"Новости, крафт, разборы по расписанию":(ed.column||"Колонка без названия");
    const status=id==="claude"?"":ed.onboarded_at?"анкета заполнена":"ждём анкету";
    const person=h("div",{class:"person"}, h("div",{class:"ava",text:(nm||"?").slice(0,1)}), h("div",{style:"min-width:0;flex:1"}, h("div",{class:"nm",text:nm+(id===S.me?" · это ты":"")}), h("div",{class:"cl",text:col+" · опубликовано: "+count+(status?" · "+status:"")})));
    const acts=h("div",{class:"pacts"});
    if(id!=="claude") acts.append(h("button",{type:"button",class:"btn sm",onclick:()=>{ S.author=id; try{localStorage.setItem("dr_author",id);}catch(_){} location.hash="published"; }},"Посты"));
    if(id===S.me && S.canWrite) acts.append(h("button",{type:"button",class:"btn sm",onclick:()=>openOnboarding(true)},ed.onboarded_at?"Моя анкета":"Заполнить анкету"));
    const box=h("div",{class:"pwrap"}, person);
    if(id!=="claude" && ed.onboarded_at && (S.owner||id===S.me)){ const det=h("details",{class:"pdet"}, h("summary",{text:"Анкета"}), profileCard(id)); box.append(det); }
    if(acts.childNodes.length) person.append(acts);
    if(S.realOwner && id===TEST_ID) acts.append(h("button",{type:"button",class:"btn sm ghost danger",onclick:async()=>{ await db.doc("editors/"+TEST_ID).delete(); toast("Тестовая анкета удалена — при следующем входе в тест она откроется заново"); }},"Сбросить"));
    g.append(box);
  }
  m.append(g);
}
function render(){
  renderTabs();
  let tb=document.getElementById("testbar");
  if(S.test && !tb){ tb=h("div",{id:"testbar",class:"testbar"},"Тестовый режим: ты видишь панель глазами нового редактора. Публикация недоступна, посты подписаны «Тестовый редактор». ",h("button",{type:"button",class:"btn sm",style:"margin-left:8px",onclick:()=>setTest(false)},"Выйти")); document.body.prepend(tb); }
  if(!S.test && tb) tb.remove();
  const m=$("#main"); m.replaceChildren();
  if(S.dbOk===false){ m.append(h("div",{class:"empty"},h("b",{text:"Панель работает только в Claude"}),h("span",{text:"Войди в claude.ai и открой эту страницу там: посты и черновики хранятся в базе редакции."}))); return; }
  if(S.blocked){ m.append(h("div",{class:"empty"},h("b",{text:S.blocked==="paused"?"Доступ приостановлен":"Доступ закрыт"}),h("span",{text:S.blocked==="paused"?"Колонка временно на паузе. Посты сохранены — если есть вопросы, напиши главному редактору.":"Доступ к редакции закрыт. Если это ошибка, напиши главному редактору."}))); return; }
  if(S.view==="ideas") renderIdeas(); else if(S.view==="team") (S.owner?renderAdmin():renderTeam()); else renderFeed(S.view);
}


/* ---------- admin: invites and editor management (owner only) ---------- */
const PANEL_URL="https://claude.ai/artifact/DZErVxEJgTWjoZGPGd4Vw9";
const inviteLink = i => PANEL_URL+"#invite="+i.id;
const ESTATUS={active:"работает",paused:"на паузе",removed:"удалён"};
function inviteText(i){
  return "Привет"+(i.name?", "+i.name:"")+"! Зову тебя в редакцию «Дизайн-Радара»"+(i.column?" — вести колонку «"+i.column+"»":"")+".\n\n"+
    "1. Открой свою ссылку: "+inviteLink(i)+"\n2. Если аккаунта в Claude ещё нет — зарегистрируйся, это бесплатно; если есть — просто войди"+(i.email?" (лучше под почтой "+i.email+")":"")+".\n3. При первом входе панель попросит заполнить анкету: 5 минут, о чём и как ты пишешь.\n\n"+
    "Дальше пишешь посты прямо в панели, там же их публикуешь или отправляешь на согласование."+(i.note?"\n\n"+i.note:"")+
    (S.settings.referral_url?"\n\nЕсли Claude у тебя пока бесплатный — вот пропуск на 7 дней Pro от меня: "+S.settings.referral_url:"");
}
async function copyText(t){ try{ await navigator.clipboard.writeText(t); toast("Скопировано"); }catch(_){ toast("Не удалось скопировать — выдели текст вручную"); } }
function inviteForm(){
  const nm=h("input",{type:"text",placeholder:"Имя"}), em=h("input",{type:"email",placeholder:"почта@пример.ру",autocomplete:"off"}),
        col=h("input",{type:"text",placeholder:"Колонка или тема, необязательно"}), note=h("input",{type:"text",placeholder:"Пара слов от тебя, необязательно"});
  const ch=h("select",{}); CHANNELS.forEach(([k,t])=>ch.append(h("option",{value:k},t)));
  const err=h("div",{class:"notice err",hidden:true});
  const go=h("button",{type:"button",class:"btn accent",onclick:async()=>{
    const email=em.value.trim().toLowerCase();
    if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ err.hidden=false; err.textContent="Почта выглядит неправильно — или оставь поле пустым."; return; }
    if(!email && !nm.value.trim()){ err.hidden=false; err.textContent="Впиши хотя бы имя, чтобы потом узнать приглашение в списке."; return; }
    if(email && S.invites.some(i=>i.email===email&&i.status!=="revoked")){ err.hidden=false; err.textContent="Этого человека уже приглашали — приглашение ниже в списке."; return; }
    const data={name:nm.value.trim().slice(0,60), email, channel:ch.value, column:col.value.trim().slice(0,60), note:note.value.trim().slice(0,300), status:"sent", created_at:Date.now(), by:S.me||""};
    try{ const ref=db.collection("invites").doc(); await ref.set(data); S.openInvite=ref.id; S.showInvite=false; render(); toast("Приглашение готово — выдай доступ и отправь текст"); }
    catch(e){ err.hidden=false; err.textContent="Не удалось сохранить. Попробуй ещё раз."; }
  }},"Создать приглашение");
  em.placeholder="необязательно";
  return h("section",{class:"sec invform"}, h("div",{class:"sech"},h("h4",{text:"Новый редактор"}),h("span",{text:"панель сделает уникальную ссылку и текст приглашения"}), h("span",{class:"sp"}), closeX(()=>{S.showInvite=false;render();})),
    h("div",{class:"row2"}, h("div",{class:"fld"},h("label",{text:"Имя"}),nm), h("div",{class:"fld"},h("label",{text:"Почта, если знаешь"}),em)),
    h("div",{class:"row2"}, h("div",{class:"fld"},h("label",{text:"Канал"}),ch), h("div",{class:"fld"},h("label",{text:"Колонка"}),col)),
    h("div",{class:"fld"},h("label",{text:"Сообщение от тебя"}),note), err,
    h("div",{class:"acts"}, go, h("button",{type:"button",class:"btn",onclick:()=>{S.showInvite=false;render();}},"Отмена")));
}
function inviteCard(i){
  const open=S.openInvite===i.id;
  const st={sent:"ждём входа",joined:"в редакции",revoked:"отозвано"}[i.status]||i.status;
  const box=h("div",{class:"inv"+(open?" open":"")},
    h("div",{class:"invh"}, h("div",{style:"min-width:0;flex:1"}, h("b",{text:(i.name||i.email)}), h("span",{text:[i.email,st,ago(i.created_at)].filter(Boolean).join(" · ")})),
      i.status==="sent"?h("button",{type:"button",class:"btn sm",onclick:()=>{S.openInvite=open?null:i.id;render();}},open?"Свернуть":"Как отправить"):null,
      i.status==="sent"?h("button",{type:"button",class:"btn sm ghost danger",onclick:()=>db.collection("invites").doc(i.id).update({status:"revoked",updated_at:Date.now()}).then(()=>toast("Приглашение отозвано. Если доступ уже выдан — убери его в «Поделиться»."))},"Отозвать"):null));
  if(open && i.status==="sent"){
    const msg=inviteText(i);
    box.append(h("ol",{class:"steps"},
      h("li",{}, h("b",{text:"Открой доступ. "}), "В меню «Поделиться» этой панели включи доступ по ссылке с правом пользоваться страницей (не редактировать код)", i.email?[" или добавь ", h("code",{text:i.email})]:"", ". Если доступа по ссылке в меню нет — добавь человека по почте, когда он зарегистрируется."),
      h("li",{}, h("b",{text:"Отправь приглашение. "}), "Ссылка уникальная — она привязывает вход к этому приглашению. Скопируй текст и пришли в Telegram или почтой."),
      h("li",{}, h("b",{text:"Дождись анкеты. "}), "Когда человек откроет ссылку из приглашения, оно отметится само, а анкета появится выше.")),
      h("pre",{class:"invmsg",text:msg}),
      h("div",{class:"acts"}, h("button",{type:"button",class:"btn accent",onclick:()=>copyText(msg)},"Скопировать текст"), h("button",{type:"button",class:"btn",onclick:()=>copyText(inviteLink(i))},"Скопировать ссылку")));
  }
  return box;
}
function editorRow(id){
  const ed=S.editors[id]||{}; const status=ed.status||"active";
  const mine=S.posts.filter(p=>p.author===id);
  const pub=mine.filter(p=>p.status==="published").length, rev=mine.filter(p=>p.status==="review").length, dr=mine.filter(p=>p.status==="draft").length;
  const last=Math.max(0,...mine.map(p=>p.updated_at||0), ed.updated_at||0);
  const nm=authorName(id);
  const card=h("div",{class:"erow "+status},
    h("div",{class:"erh"}, h("div",{class:"ava",text:(nm||"?").slice(0,1)}),
      h("div",{style:"min-width:0;flex:1"}, h("div",{class:"nm",text:nm+(id===TEST_ID?" (тест)":"")}),
        h("div",{class:"cl",text:(ed.column||"колонка не названа")+(ed.grade?" · "+ed.grade:"")})),
      h("span",{class:"estat "+status,text:ed.onboarded_at?ESTATUS[status]:"ждём анкету"})),
    ed.can_publish?h("div",{class:"hint",text:"Публикует сам — посты выходят через Claude в течение часа"}):null,
    h("div",{class:"estats"}, h("span",{},h("b",{text:pub})," опубликовано"), h("span",{},h("b",{text:rev})," на согласовании"), h("span",{},h("b",{text:dr})," в черновиках"), h("span",{text:last?"активность "+ago(last):"постов пока нет"})));
  const acts=h("div",{class:"acts"});
  acts.append(h("button",{type:"button",class:"btn sm",onclick:()=>{ S.author=id; try{localStorage.setItem("dr_author",id);}catch(_){} location.hash=rev?"review":"published"; }},"Посты"));
  const setSt=(v,msg)=>setRole(id,{status:v,status_at:Date.now()}).then(()=>toast(msg));
  if(status!=="removed") acts.append(h("button",{type:"button",class:"btn sm"+(ed.can_publish?" on":""),"aria-pressed":ed.can_publish?"true":"false",onclick:()=>setRole(id,{can_publish:!ed.can_publish}).then(()=>toast(ed.can_publish?"Теперь посты редактора идут тебе на согласование":"Редактор может публиковать сам: Claude выпускает его посты раз в час"))},ed.can_publish?"✓ Публикует сам":"Разрешить публиковать"));
  if(status==="active") acts.append(h("button",{type:"button",class:"btn sm",onclick:()=>setSt("paused","Колонка на паузе: редактор видит панель, но не может писать")},"Пауза"));
  if(status!=="active") acts.append(h("button",{type:"button",class:"btn sm",onclick:()=>setSt("active","Доступ к редакции восстановлен")},"Вернуть"));
  if(status!=="removed") acts.append(h("button",{type:"button",class:"btn sm danger",onclick:()=>{ if(S.confirmRemove===id){ S.confirmRemove=null; setSt("removed","Редактор удалён из редакции. Убери его и в «Поделиться», чтобы закрыть ссылку полностью"); } else { S.confirmRemove=id; render(); } }},S.confirmRemove===id?"Точно удалить?":"Удалить"));
  if(id===TEST_ID) acts.append(h("button",{type:"button",class:"btn sm ghost",onclick:async()=>{ await db.doc("editors/"+TEST_ID).delete(); toast("Тестовая анкета сброшена"); }},"Сбросить анкету"));
  card.append(acts);
  if(ed.onboarded_at) card.append(h("details",{class:"pdet"}, h("summary",{text:"Анкета"}), profileCard(id)));
  return card;
}
function renderAdmin(){
  const m=$("#main");
  m.append(h("div",{class:"lead"}, h("div",{}, h("h2",{text:"Редакция"}), h("p",{text:"Приглашай редакторов, следи за колонками, разрешай публиковать самостоятельно, ставь на паузу или удаляй."})),
    h("div",{class:"leadacts"}, h("button",{class:"btn primary",onclick:()=>{S.showInvite=true;render();}},"+ Пригласить редактора"))));
  if(S.showInvite) m.append(inviteForm());
  const ref=h("input",{type:"url",value:S.settings.referral_url||"",placeholder:"https://claude.ai/… — твоя ссылка гостевого пропуска"});
  const refSave=h("button",{type:"button",class:"btn",onclick:async()=>{ const v=ref.value.trim(); if(v && !/^https:\/\/[^\s]+$/.test(v)){ toast("Нужна ссылка, начинающаяся с https://"); return; } await db.doc("settings/main").set({...S.settings, referral_url:v, updated_at:Date.now()}); toast(v?"Ссылка добавится во все приглашения":"Ссылка убрана из приглашений"); }},"Сохранить");
  m.append(h("details",{class:"pdet refbox"}, h("summary",{text:S.settings.referral_url?"Пропуск Claude в приглашениях: включён":"Добавить в приглашения свой пропуск Claude"}),
    h("div",{class:"fld",style:"margin-top:12px"}, h("div",{class:"airow"}, ref, refSave),
      h("div",{class:"hint",text:"Ссылку гостевого пропуска (7 дней Pro для новичка) найдёшь в настройках Claude — в разделах Claude Code, Cowork или Claude Design — или командой /passes в Claude Code. Она добавится в конец текста каждого приглашения."}))));
  const ids=Object.keys(S.editors).filter(id=>id!==S.realMe && id!=="claude");
  const act=ids.filter(id=>(S.editors[id].status||"active")!=="removed"), rem=ids.filter(id=>S.editors[id].status==="removed");
  m.append(h("h3",{class:"dayh",text:"Редакторы · "+act.length}));
  if(!act.length) m.append(h("div",{class:"empty"},h("b",{text:"Пока ты одна"}),h("span",{text:"Пригласи первого редактора — карточка появится здесь после входа и анкеты."})));
  else { const g=h("div",{class:"egrid"}); act.forEach(id=>g.append(editorRow(id))); m.append(g); }
  const inv=S.invites.filter(i=>i.status!=="revoked").sort((a,b)=>(b.created_at||0)-(a.created_at||0));
  if(inv.length){ m.append(h("h3",{class:"dayh",text:"Приглашения"})); const l=h("div",{class:"invlist"}); inv.forEach(i=>l.append(inviteCard(i))); m.append(l); }
  m.append(h("h3",{class:"dayh",text:"Редакция Claude"}), h("div",{class:"egrid"}, h("div",{class:"erow"}, h("div",{class:"erh"}, h("div",{class:"ava",text:"Р"}), h("div",{style:"min-width:0;flex:1"}, h("div",{class:"nm",text:"Редакция (Claude)"}), h("div",{class:"cl",text:"Новости, крафт, разборы и вакансии по расписанию"}))),
    h("div",{class:"estats"}, h("span",{},h("b",{text:S.posts.filter(p=>(p.author||"claude")==="claude"&&p.status==="published").length})," опубликовано"), h("span",{},h("b",{text:S.posts.filter(p=>(p.author||"claude")==="claude"&&p.status==="review").length})," на согласовании")))));
  if(rem.length){ m.append(h("details",{class:"pdet",style:"margin-top:8px"}, h("summary",{text:"Удалённые редакторы · "+rem.length}), h("div",{class:"egrid",style:"margin-top:12px"}, ...rem.map(editorRow)))); }
}
async function matchInvite(){
  if(S.owner || !S.me || S.me===TEST_ID || !user || !S.editorsLoaded) return;
  let code=S.inviteCode; if(!code){ try{ code=localStorage.getItem("dr_invite")||""; }catch(_){} }
  if(!code) return;
  const inv=S.invites.find(i=>i.id===code && i.status==="sent"); if(!inv) return;
  try{ localStorage.removeItem("dr_invite"); }catch(_){}
  try{ const ed=(S.edRaw||{})[S.me]||{}; const pre={invite_id:inv.id, invite_at:Date.now()}; if(!ed.column && inv.column) pre.column=inv.column; if(!ed.channels && inv.channel) pre.channels=[inv.channel]; if(!ed.sign && inv.name) pre.sign=inv.name;
    await db.doc("editors/"+S.me).set({...ed, ...pre, invited_by:inv.by||"", updated_at:Date.now()}); }catch(_){}
}
/* Приглашённый сам пишет только в свою анкету (invite_id); отметку в приглашении ставит панель главного редактора. */
async function syncInvites(){
  if(!S.realOwner || !db) return;
  for(const [uid,ed] of Object.entries(S.edRaw||{})){
    const inv=ed.invite_id && S.invites.find(i=>i.id===ed.invite_id && i.status==="sent");
    if(inv){ try{ await db.collection("invites").doc(inv.id).update({status:"joined", user_id:uid, joined_at:ed.invite_at||Date.now()}); }catch(_){} }
  }
}
function applyBlock(){
  const ed=S.me&&S.editors[S.me]; const st=!S.owner&&ed&&ed.status;
  S.blocked=(st==="removed"||st==="paused")?st:null;
  if(S.blocked==="paused"){ S.blocked=null; S.paused=true; } else S.paused=false;
  if(st==="removed") S.canWriteEff=false; else if(S.paused) S.canWriteEff=false; else S.canWriteEff=null;
}

/* ---------- editors: switcher, onboarding, test account ---------- */
function editorIds(){ return [...new Set(["claude", ...Object.keys(S.editors), ...S.posts.map(p=>p.author||"claude")])].filter(Boolean); }
function authorSelect(){
  const sel=h("select",{class:"authsel","aria-label":"Показать посты автора"});
  const opts=[["all","Все авторы"]];
  if(S.me && S.me!=="claude") opts.push([S.me,"Мои посты"]);
  editorIds().filter(id=>id!==S.me).forEach(id=>opts.push([id, authorName(id)+(id==="claude"?" (Claude)":"")]));
  opts.forEach(([v,t])=>sel.append(h("option",{value:v,selected:(S.author||"all")===v},t)));
  sel.addEventListener("change",()=>{ S.author=sel.value; try{ localStorage.setItem("dr_author",S.author); }catch(_){} render(); });
  return sel;
}
try{ S.author=localStorage.getItem("dr_author")||"all"; }catch(_){ S.author="all"; }
function renderWho(){
  const w=$("#who"); if(!w) return;
  const role=S.test?"Тест":S.owner?"Главный редактор":"Редактор";
  const nm=S.test?"Тестовый редактор":(S.myName||"");
  w.replaceChildren(h("span",{text:role}), h("b",{text:nm}));
  if(S.realOwner) w.append(h("button",{type:"button",class:"btn sm",onclick:()=>setTest(!S.test)},S.test?"Выйти из теста":"Тестовый вход"));
}
function setTest(on){
  S.test=on; try{ on?localStorage.setItem("dr_test","1"):localStorage.removeItem("dr_test"); }catch(_){}
  S.owner=on?false:S.realOwner; S.me=on?TEST_ID:S.realMe; S.author="all"; S.view="review"; location.hash="review";
  closeEditor(); renderWho(); render(); checkOnboarding();
  toast(on?"Ты смотришь панель глазами нового редактора":"Вернулась в свой аккаунт");
}
const CHANNELS=[["designradar","Дизайн-Радар · @designradar_lab",true]];
const TOPICS=["Продуктовый дизайн","UX-исследования","Дизайн-системы","UI и визуал","Брендинг","Моушн","Доступность","ИИ-инструменты","Процессы в команде","Карьера и найм","Портфолио и рост","B2B и сложные интерфейсы"];
const FORMATS=["Крафт","Разбор","Мнение","Инсайд","Новости","Книга или фильм","Мем"];
const GRADES=["Junior","Middle","Senior","Lead","Head / Art Director"];
const DOMAINS=["Финтех","E-commerce","B2B SaaS","Госсервисы","Медиа","Телеком","Игры","Здоровье","Образование","Агентство"];
function checkOnboarding(){
  if(!S.me || S.owner || !S.canWrite || !S.editorsLoaded) return;
  const ed=S.editors[S.me];
  if(!ed || !ed.onboarded_at) openOnboarding(false);
}
function openOnboarding(editMode){
  const id=S.me; const ed={...(S.editors[id]||{})};
  const root=$("#sheetRoot"); document.body.style.overflow="hidden";
  const chips=(list,sel,multi=true)=>{ const box=h("div",{class:"chipset",role:multi?"group":"radiogroup"}); const st=new Set(Array.isArray(sel)?sel:(sel?[sel]:[]));
    list.forEach(t=>{ const b=h("button",{type:"button",class:"chip"+(st.has(t)?" on":""),"aria-pressed":st.has(t)?"true":"false"},t); b.addEventListener("click",()=>{ if(!multi){ st.clear(); [...box.children].forEach(c=>{c.classList.remove("on");c.setAttribute("aria-pressed","false");}); } if(st.has(t)) st.delete(t); else st.add(t); b.classList.toggle("on",st.has(t)); b.setAttribute("aria-pressed",st.has(t)?"true":"false"); }); box.append(b); });
    box.val=()=>multi?[...st]:([...st][0]||""); return box; };
  const fld=(lab,el,hint,req)=>h("div",{class:"fld"}, h("label",{text:lab+(req?" *":"")}), el, hint?h("div",{class:"hint",text:hint}):null);
  const inp=(v,ph)=>h("input",{type:"text",value:v||"",placeholder:ph||""});
  const area=(v,ph)=>{ const t=h("textarea",{placeholder:ph||"",rows:3,class:"short"}); t.value=v||""; return t; };
  const fSign=inp(ed.sign,"Например: Мария Иванова, Маша из финтеха или «Дизайнер из большой компании»");
  const fTg=inp(ed.tg,"@username");
  const fGrade=chips(GRADES,ed.grade,false);
  const fYears=h("input",{type:"number",min:0,max:40,value:ed.years??"",placeholder:"лет"});
  const fDom=chips(DOMAINS,ed.domains||[]);
  const chBox=h("div",{class:"chipset"}); const chSel=new Set(ed.channels||["designradar"]);
  CHANNELS.forEach(([k,t])=>{ const b=h("button",{type:"button",class:"chip"+(chSel.has(k)?" on":"")},t); b.addEventListener("click",()=>{ chSel.has(k)?chSel.delete(k):chSel.add(k); b.classList.toggle("on",chSel.has(k)); }); chBox.append(b); });
  chBox.append(h("span",{class:"chip off",text:"Новые каналы — скоро"}));
  const fCol=inp(ed.column,"Например: «Сложные интерфейсы без боли»");
  const fPromise=inp(ed.promise,"Что читатель унесёт из твоих постов, одной фразой");
  const fTopics=chips(TOPICS,ed.topics||[]); const fTopicOther=inp(ed.topic_other,"Своя тема, если нет в списке");
  const fFormats=chips(FORMATS,ed.formats||[]);
  const fFreq=chips(["Раз в неделю","Раз в две недели","Раз в месяц","Когда есть что сказать"],ed.frequency,false);
  const fSamples=area((ed.samples||[]).join("\n"),"2–3 ссылки на твои тексты, посты или доклады — по одной в строке. По ним Claude научится писать твоим голосом");
  const fHelp=chips(["Пишу текст — Claude правит","Даю тезисы — Claude пишет черновик","Claude предлагает темы, я выбираю"],ed.help_mode||[]);
  const fTaboo=area(ed.taboo,"Компании, проекты и темы, которые нельзя упоминать (NDA, текущий работодатель)");
  const fAgree=h("input",{type:"checkbox",id:"obAgree",checked:!!ed.agreed});
  const err=h("div",{class:"notice err",hidden:true});
  const form=h("form",{class:"ob",onsubmit:e=>e.preventDefault()},
    h("section",{class:"sec"}, h("div",{class:"sech"},h("h4",{text:"1. О тебе"}),h("span",{text:"как тебя представлять читателям"})),
      fld("Как подписывать посты",fSign,"Имя, псевдоним или анонимно — как удобно с учётом NDA",true),
      h("div",{class:"row2"}, fld("Грейд",fGrade,null,true), fld("Опыт в дизайне",fYears)),
      fld("Сферы, в которых есть опыт",fDom), fld("Telegram для связи",fTg,"Сюда редакция напишет, если по посту будут вопросы")),
    h("section",{class:"sec"}, h("div",{class:"sech"},h("h4",{text:"2. Канал и колонка"})),
      fld("Где будешь писать",chBox,null,true), fld("Название колонки",fCol,null,true), fld("Обещание читателю",fPromise)),
    h("section",{class:"sec"}, h("div",{class:"sech"},h("h4",{text:"3. О чём пишешь"})),
      fld("Темы",fTopics,"Выбери 2–4 — так колонка будет узнаваемой",true), h("div",{class:"fld"},fTopicOther), fld("Форматы",fFormats,null,true), fld("Как часто",fFreq,null,true)),
    h("section",{class:"sec"}, h("div",{class:"sech"},h("h4",{text:"4. Голос и помощь Claude"})),
      fld("Примеры твоих текстов",fSamples), fld("Как тебе помогать",fHelp)),
    h("section",{class:"sec"}, h("div",{class:"sech"},h("h4",{text:"5. Границы и правила"})),
      fld("Что нельзя упоминать",fTaboo),
      h("label",{class:"agree",for:"obAgree"}, fAgree, h("span",{},"Принимаю правила канала: каждый факт — со ссылкой на первоисточник, без чужого NDA, главный редактор может поправить или снять пост.")), err));
  const save=async()=>{
    const data={sign:fSign.value.trim().slice(0,80), tg:fTg.value.trim().slice(0,40), grade:fGrade.val(), years:fYears.value===""?null:Math.max(0,Math.min(40,Number(fYears.value)||0)), domains:fDom.val(),
      channels:[...chSel], column:fCol.value.trim().slice(0,60), promise:fPromise.value.trim().slice(0,160), topics:fTopics.val(), topic_other:fTopicOther.value.trim().slice(0,80),
      formats:fFormats.val(), frequency:fFreq.val(), samples:fSamples.value.split(/\n+/).map(x=>x.trim()).filter(Boolean).slice(0,5), help_mode:fHelp.val(), taboo:fTaboo.value.trim().slice(0,600), agreed:fAgree.checked, updated_at:Date.now()};
    const miss=[]; if(!data.sign) miss.push("подпись"); if(!data.grade) miss.push("грейд"); if(!data.channels.length) miss.push("канал"); if(!data.column) miss.push("название колонки"); if(!data.topics.length&&!data.topic_other) miss.push("темы"); if(!data.formats.length) miss.push("форматы"); if(!data.frequency) miss.push("как часто"); if(!data.agreed) miss.push("согласие с правилами");
    if(miss.length){ err.hidden=false; err.textContent="Заполни: "+miss.join(", ")+"."; err.scrollIntoView({block:"center",behavior:"smooth"}); return; }
    if(!ed.onboarded_at) data.onboarded_at=Date.now();
    try{ const {status:_s, can_publish:_c, ...raw}={...ed, ...data}; await db.doc("editors/"+id).set({...raw, joined_at:ed.joined_at||Date.now()}); closeEditor(); toast(editMode?"Анкета обновлена":"Добро пожаловать в редакцию!"); }
    catch(e){ err.hidden=false; err.textContent="Не удалось сохранить анкету. Попробуй ещё раз."; }
  };
  const head=h("header",{}, editMode?h("button",{class:"iconbtn",onclick:closeEditor,"aria-label":"Назад"},"←"):(S.test?h("button",{class:"iconbtn",onclick:()=>setTest(false),"aria-label":"Выйти из теста"},"←"):null),
    h("div",{class:"t"}, h("b",{text:editMode?"Моя анкета":"Добро пожаловать в редакцию"}), h("span",{text:editMode?"можно поменять в любой момент":"5 минут — и можно писать"})), themeBtn());
  const intro=editMode?null:h("div",{class:"obintro"}, h("h2",{text:"Расскажи о себе и своей колонке"}), h("p",{text:"Анкета нужна, чтобы главный редактор понимал, о чём ты пишешь, а Claude помогал в твоём стиле и не предлагал чужие темы. Поля со звёздочкой обязательные."}));
  const foot=h("footer",{}, S.test&&!editMode?h("button",{class:"btn",onclick:()=>setTest(false)},"Выйти из теста"):null, h("span",{class:"sp"}), editMode?h("button",{class:"btn",onclick:closeEditor},"Отмена"):null, h("button",{class:"btn accent",onclick:save},editMode?"Сохранить анкету":"Готово, в редакцию"));
  const body=h("div",{class:"ed obwrap"}, intro, form);
  const sheet=h("div",{class:"sheet",role:"dialog","aria-modal":"true","aria-label":"Анкета редактора"}, head, h("div",{class:"panes one"}, body), foot);
  editing=null; root.replaceChildren(sheet);
}
function profileCard(id){
  const ed=S.editors[id]||{};
  const rows=[["Подпись",ed.sign],["Грейд",[ed.grade,ed.years!=null&&ed.years!==""?ed.years+" лет опыта":""].filter(Boolean).join(" · ")],["Сферы",(ed.domains||[]).join(", ")],["Колонка",ed.column],["Обещание",ed.promise],["Темы",[...(ed.topics||[]),ed.topic_other].filter(Boolean).join(", ")],["Форматы",(ed.formats||[]).join(", ")],["Частота",ed.frequency],["Помощь Claude",(ed.help_mode||[]).join("; ")],["Нельзя упоминать",ed.taboo],["Telegram",ed.tg]].filter(r=>r[1]);
  return h("dl",{class:"prof"}, ...rows.flatMap(([k,v])=>[h("dt",{text:k}),h("dd",{text:String(v)})]), ...(ed.samples&&ed.samples.length?[h("dt",{text:"Примеры"}),h("dd",{},...ed.samples.map(u=>/^https?:\/\//.test(u)?h("a",{href:u,target:"_blank",rel:"noopener"},u):h("span",{text:u})).flatMap((x,i)=>i?[h("br"),x]:[x]))]:[]));
}

/* ---------- editor ---------- */
let editing=null;
function newPost(prefill={}){
  if(!S.canWrite) return;
  if(S.paused){ toast("Колонка на паузе — новые посты сейчас недоступны"); return; }
  const ref=S.owner?postsCol().doc():authorCol(S.me).doc();
  const now=Date.now();
  const a={title:prefill.title||"", cover_title:prefill.title||"", label:"Крафт", section:"Крафт", kind:"original", full_text:"", hashtags:[], photos:[], status:"draft", author:S.me||"", created_at:now, updated_at:now, idea:prefill.idea||null};
  ref.set(a).then(()=>{ if(prefill.idea) ideasCol().doc(prefill.idea).update({status:"taken"}); openEditor(ref.id); });
}
function openEditor(id){
  const a=S.posts.find(p=>p.id===id); if(!a) return;
  const dc=JSON.parse(JSON.stringify(a)); // db objects arrive frozen — edit a deep copy
  editing={id, draft:{...dc, hashtags:Array.isArray(dc.hashtags)?dc.hashtags:[], media:(dc.media||[])}, dirty:false, base:a.updated_at||0};
  try{ drawSheet(); }
  catch(e){ console.error(e); showErr("Редактор не открылся", e);
    try{ editing.safe=true; drawSheet(); toast("Открыла пост в упрощённом режиме — карусель и оформление недоступны"); }catch(e2){ closeEditor(); } }
}
function syncEditor(){
  if(!editing) return;
  const cur=S.posts.find(p=>p.id===editing.id); if(!cur) return;
  if((cur.updated_at||0)===editing.base) return;
  if(editing.saving){ editing.base=cur.updated_at||0; return; }
  const root=$("#sheetRoot");
  if(!editing.dirty){
    const sc=[...root.querySelectorAll("*")].filter(e=>e.scrollTop>0).map(e=>[e,e.scrollTop]);
    const dc=JSON.parse(JSON.stringify(cur)); editing.draft={...dc, hashtags:Array.isArray(dc.hashtags)?dc.hashtags:[], media:(dc.media||[])};
    editing.base=cur.updated_at||0; drawSheet();
    toast("Пост обновился — в редакторе новая версия");
    return;
  }
  if(root.querySelector("#staleNote")) return;
  const note=h("div",{id:"staleNote",class:"notice err",style:"margin:10px 16px"},"Пост изменили, пока ты его правила. Если сохранишь сейчас, новая версия перезапишется. ",
    h("button",{type:"button",class:"btn sm",onclick:()=>{ editing.dirty=false; editing.base=-1; syncEditor(); }},"Загрузить новую версию"));
  const sheet=root.firstElementChild; if(sheet) sheet.prepend(note);
}
const XICON='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function closeX(onclick, label){ const b=h("button",{type:"button",class:"xbtn",title:label||"Закрыть","aria-label":label||"Закрыть",onclick}); b.innerHTML=XICON; return b; }
function panelHead(title, onClose){ return h("div",{class:"phead"}, h("span",{text:title}), closeX(onClose)); }
function showErr(where, e){
  const msg=(e&&(e.message||e.code))||String(e); const st=String(e&&e.stack||"").split("\n").slice(0,3).join(" ← ");
  let bar=document.getElementById("errbar"); if(!bar){ bar=h("div",{id:"errbar",class:"errbar",role:"alert"}); document.body.append(bar); }
  bar.replaceChildren(h("b",{text:where+": "}), h("span",{text:msg}), h("code",{text:st.slice(0,260)}), closeX(()=>bar.remove()));
}
window.addEventListener("error",ev=>{ if(ev && ev.error) showErr("Ошибка в панели", ev.error); });
window.addEventListener("unhandledrejection",ev=>{ const r=ev&&ev.reason; if(r && r.code!=="not_granted" && r.code!=="rate_limited") showErr("Ошибка в панели", r); });
function closeEditor(){ try{ (editing&&editing.unsubs||[]).forEach(f=>{ try{ f&&f(); }catch(_){} }); }catch(_){} editing=null; $("#sheetRoot").replaceChildren(); document.body.style.overflow=""; }
function drawSheet(){
  const root=$("#sheetRoot"); const d=editing.draft; const ro=!mayEdit(d)||(d.status==="published"&&!S.owner);
  document.body.style.overflow="hidden";
  const panes=h("div",{class:"panes"});
  editing.unsubs=editing.unsubs||[];
  let pvOpt={device:"phone",tg:"auto"}; try{ pvOpt={...pvOpt,...JSON.parse(localStorage.getItem("dr_pv")||"{}")}; }catch(_){}
  const pv=h("div",{class:"pv"}); const pvBody=h("div"); const pvTabsEl=h("div",{class:"pvtabs",role:"tablist"}); const pvPanel=h("div");
  let pvTab=editing.pvTab||"preview";
  const notifEl=h("div",{class:"notif"}); const rtEl=h("span",{class:"rt"});
  const optSeg=(name,opts)=>{ const g=h("div",{class:"seg sm",role:"group"}); opts.forEach(([v,t])=>{ const b=h("button",{type:"button","aria-pressed":pvOpt[name]===v?"true":"false",class:pvOpt[name]===v?"on":""},t); b.addEventListener("click",()=>{ pvOpt[name]=v; try{ localStorage.setItem("dr_pv",JSON.stringify(pvOpt)); }catch(_){} drawPvTabs(); }); g.append(b); }); return g; };
  const upd=()=>{ const n=textLength(d); cnt.textContent=n+" / "+LIMIT; cnt.classList.toggle("over",n>LIMIT); if(pvTab==="preview") drawPreview(); if(typeof drawLint==="function") drawLint(); };
  const drawPreview=()=>{
    const first=plain(String(d.full_text||"").split(/\n/).find(x=>x.trim()&&!/^\[фото/i.test(x.trim()))||"").replace(/^#+\s*/,"");
    notifEl.replaceChildren(h("div",{class:"nicon","aria-hidden":"true"}), h("div",{class:"ntx"}, h("b",{text:"Дизайн-Радар"}), h("span",{text:plain(d.title)+(first?" "+first:"")})));
    rtEl.textContent=readTime((d.title||"")+" "+(d.full_text||""));
    const tgCls=pvOpt.tg==="auto"?"":" tg-"+pvOpt.tg;
    pvBody.replaceChildren(h("div",{class:"tgframe "+pvOpt.device+tgCls}, h("div",{class:"tghead"}, h("div",{class:"tgava","aria-hidden":"true"}), h("div",{}, h("b",{text:"Дизайн-Радар"}), h("span",{text:"канал"}))), tgPreview(d)));
  };
  const panelsBy={};
  const drawPvTabs=()=>{
    const nOpen=(editing.notes||[]).filter(x=>!x.resolved).length, nVer=(editing.versions||[]).length;
    pvTabsEl.replaceChildren(...[["preview","Превью"],["notes","Заметки"+(nOpen?" · "+nOpen:"")],["history","История"+(nVer?" · "+nVer:"")]].map(([k,t])=>{ const b=h("button",{type:"button",role:"tab","aria-selected":pvTab===k?"true":"false",class:pvTab===k?"on":""},t); b.addEventListener("click",()=>{ pvTab=k; editing.pvTab=k; drawPvTabs(); }); return b; }));
    if(pvTab==="preview"){ pvPanel.replaceChildren(h("div",{class:"pvopts"}, optSeg("device",[["phone","Телефон"],["desktop","Компьютер"]]), optSeg("tg",[["auto","Как панель"],["light","Светлый TG"],["dark","Тёмный TG"]]), rtEl), h("div",{class:"tgcap",text:"Уведомление"}), notifEl, h("div",{class:"tgcap",text:"В канале"}), pvBody); drawPreview(); }
    else if(pvTab==="notes") pvPanel.replaceChildren(drawNotes());
    else pvPanel.replaceChildren(drawHistory());
  };
  pv.append(pvTabsEl, pvPanel);
  const cnt=h("span",{class:"cnt"});
  const field=(lab,el,hint)=>h("div",{class:"fld"},h("label",{for:el.id,text:lab}),el,hint?h("div",{class:"hint",text:hint}):null);
  const inp=(id,val,ph)=>{ const e=h("input",{id,type:"text",value:val||"",placeholder:ph||"",readonly:ro}); return e; };
  const tTitle=inp("fTitle",d.title,"Заголовок поста");
  const tCover=h("textarea",{id:"fCover",rows:2,class:"covtitle",readonly:ro,placeholder:"До 50 знаков. Enter — перенос строки там, где хочешь"}); tCover.value=d.cover_title||"";
  const tLabel=h("select",{id:"fLabel",disabled:ro}); ["Крафт","Разбор","Новости","Мнение","Вакансии","Книга","Фильм","Мем","Редакция","Вопрос читателя","Инсайд","Колонка"].forEach(x=>tLabel.append(h("option",{value:x,selected:(d.label||d.section)===x},x)));
  const tText=h("textarea",{id:"fText",readonly:ro,spellcheck:"true"}); tText.value=d.full_text||"";
  const lintBox=h("details",{class:"lint"}); let lintOpen=false; lintBox.addEventListener("toggle",()=>{ lintOpen=lintBox.open; });
  const drawLint=()=>{ const L=lintText(tText.value,(d.media||[]).length); lintBox.hidden=!L.length; if(!L.length){ lintBox.replaceChildren(); return; }
    lintBox.open=lintOpen;
    lintBox.replaceChildren(h("summary",{}, h("span",{class:"chk-i","aria-hidden":"true",text:"!"}), "Замечания редактуры · "+L.length),
      h("ul",{}, ...L.slice(0,40).map(x=>{ const b=h("button",{type:"button",class:"lintit "+x.kind},x.msg, h("span",{class:"lq",text:" — «"+tText.value.slice(x.s,Math.min(x.e,x.s+60)).replace(/\n/g," ")+(x.e-x.s>60?"…":"")+"»"})); b.addEventListener("click",()=>{ tText.focus(); tText.setSelectionRange(x.s,x.e); const lh=parseFloat(getComputedStyle(tText).lineHeight)||27; tText.scrollTop=Math.max(0,tText.value.slice(0,x.s).split("\n").length*lh-tText.clientHeight/3); }); return h("li",{},b); }))); };
  const selBar=h("div",{class:"selbar",hidden:true}); let selRange=null;
  const fragGo=async(mode,btn)=>{ if(!selRange) return; const [a0,b0]=selRange; const frag=tText.value.slice(a0,b0); const prevText=tText.value; btn.disabled=true; selBar.classList.add("busy");
    try{ const nt=await rewriteFragment(d,frag,mode); tText.setRangeText(nt,a0,b0,"select"); selRange=[a0,a0+nt.length]; logVersion("claude",prevText); sync(); toast("Фрагмент переписан — ⌘Z или «История», чтобы вернуть"); }
    catch(e){ toast((e&&e.code==="not_granted")?"Разреши панели обращаться к Claude":(e&&e.message)||"Не получилось"); }
    finally{ btn.disabled=false; selBar.classList.remove("busy"); } };
  const mkFrag=(k,t)=>{ const b=h("button",{type:"button",class:"sbtn"},t); b.addEventListener("click",()=>fragGo(k,b)); return b; };
  if(!ro && sample) selBar.append(h("span",{class:"sic",title:"Claude перепишет выделенное","aria-hidden":"true",text:"✦"}), mkFrag("short","Короче"), mkFrag("lively","Живее"), mkFrag("simple","Проще"), mkFrag("opening","Как начало"));
  const noteSelBtn=h("button",{type:"button",class:"sbtn",onclick:()=>{ if(!selRange) return; editing.noteQuote=tText.value.slice(selRange[0],selRange[1]).slice(0,240); pvTab="notes"; editing.pvTab="notes"; panes.classList.add("showpv"); drawPvTabs(); setTimeout(()=>document.getElementById("noteIn")?.focus(),30); }},"💬 Заметка");
  selBar.append(h("span",{class:"ssep","aria-hidden":"true"}), noteSelBtn, closeX(()=>{ selBar.hidden=true; selRange=null; },"Скрыть"));
  const onSel=()=>{ const a0=tText.selectionStart,b0=tText.selectionEnd; if(b0-a0>=12){ selRange=[a0,b0]; selBar.hidden=false; } else { selRange=null; if(!selBar.classList.contains("busy")) selBar.hidden=true; } };
  ["select","keyup","mouseup"].forEach(ev=>tText.addEventListener(ev,onSel));
  const varBox=(kind)=>{ const box=h("div",{class:"vars",hidden:true}); const btn=h("button",{type:"button",class:"btn sm aibtn"},"✦ 3 варианта");
    btn.addEventListener("click",async()=>{ btn.disabled=true; box.hidden=false; box.replaceChildren(panelHead("Claude думает над заголовками…",()=>{box.hidden=true;}));
      try{ const vs=await titleVariants(d,kind); box.replaceChildren(panelHead(kind==="cover"?"Варианты для обложки":"Варианты заголовка",()=>{box.hidden=true;}), ...vs.map(v=>{ const c=h("button",{type:"button",class:"varbtn"}); if(kind==="cover"){ const cv=drawCover({...d,cover_title:v,cover_render:true}); if(cv){ const sm=document.createElement("canvas"); sm.width=400; sm.height=128; sm.getContext("2d").drawImage(cv,0,0,400,128); c.append(sm); } } c.append(h("span",{text:v})); c.addEventListener("click",()=>{ (kind==="cover"?tCover:tTitle).value=v; sync(); box.hidden=true; }); return c; })); }
      catch(e){ box.replaceChildren(panelHead((e&&e.message)||"Не получилось. Попробуй ещё раз.",()=>{box.hidden=true;})); }
      finally{ btn.disabled=false; } });
    return [btn,box]; };
  const tTags=inp("fTags",tagsOf(d),"#крафт #формы");
  const tSrc=inp("fSrc",d.source,"Например, Apple Newsroom"); const tUrl=inp("fUrl",d.url,"https://…");
  const wrapSel=(pre,post=pre)=>{ const s=tText.selectionStart,e=tText.selectionEnd,v=tText.value; tText.setRangeText(pre+v.slice(s,e)+post,s,e,"end"); tText.focus(); sync(); };
  const aiT=h("div",{class:"ai",hidden:true});
  const aiTBtn=h("button",{type:"button",class:"btn sm aibtn",onclick:()=>{ aiT.hidden=!aiT.hidden; aiTBtn.classList.toggle("on",!aiT.hidden); if(!aiT.hidden) aiT.querySelector("input")?.focus(); }},"✦ Переписать с Claude");
  const tools=h("div",{class:"tools"}, h("div",{class:"seg",role:"group","aria-label":"Форматирование"},
    h("button",{type:"button",title:"Жирный",onclick:()=>wrapSel("**")},h("b",{text:"Ж"})),
    h("button",{type:"button",title:"Курсив",onclick:()=>wrapSel("__")},h("i",{text:"К"})),
    h("button",{type:"button",title:"Ссылка",onclick:()=>{ const s=tText.selectionStart,e=tText.selectionEnd; const t=tText.value.slice(s,e)||"текст"; tText.setRangeText("["+t+"](https://)",s,e,"end"); tText.focus(); sync(); }},"Ссылка"),
    h("button",{type:"button",title:"Подзаголовок",onclick:()=>{ const s=tText.selectionStart; const ls=tText.value.lastIndexOf("\n",s-1)+1; tText.setRangeText("**",ls,ls,"preserve"); const le=tText.value.indexOf("\n",ls); const end=le<0?tText.value.length:le; tText.setRangeText("**",end,end,"preserve"); sync(); }},"Подзаголовок")),
    (!ro&&sample)?aiTBtn:null, cnt);
  const sync=()=>{
    const before=JSON.stringify([d.title,d.full_text]);
    d.title=tTitle.value; d.cover_title=tCover.value; d.label=tLabel.value; d.section=tLabel.value; d.full_text=tText.value;
    d.hashtags=tTags.value.split(/\s+/).filter(Boolean); d.source=tSrc.value; d.url=tUrl.value;
    editing.dirty=true; upd(); clearTimeout(sync.t); sync.t=setTimeout(drawEd,350);
    if(!ro){ setSaveState("Есть изменения…"); clearTimeout(sync.as); sync.as=setTimeout(autosave,2500); }
  };
  [tTitle,tCover,tLabel,tText,tTags,tSrc,tUrl].forEach(e=>e.addEventListener("input",sync));
  const form=h("form",{onsubmit:e=>e.preventDefault()});
  const sec=(title,sub,...kids)=>h("section",{class:"sec"}, h("div",{class:"sech"}, h("h4",{text:title}), sub?h("span",{text:sub}):null), ...kids);
  if(d.check && d.status!=="published") form.append(h("div",{class:"checkbox"}, h("div",{class:"chk-i big","aria-hidden":"true",text:"!"}), h("div",{}, h("b",{text:"Проверь руками перед публикацией"}), h("p",{text:d.check}))));
  if(d.prev && !ro) form.append(h("div",{class:"notice"},"Есть прошлая версия текста. ",h("button",{type:"button",class:"btn sm",onclick:async()=>{ const p=d.prev; await savePost(editing.id,{title:p.title,full_text:p.full_text,prev:{title:d.title,full_text:d.full_text}}); closeEditor(); toast("Вернула прошлую версию"); }},"Вернуть её")));
  const [tvBtn,tvBox]=varBox("title");
  const titleFld=h("div",{class:"fld"}, h("div",{class:"lblrow"}, h("label",{for:"fTitle",text:"Заголовок"}), (!ro&&sample)?tvBtn:null), tTitle, tvBox);
  const secText=sec("Текст", null, titleFld, h("div",{class:"fld"}, h("label",{for:"fText",text:"Текст поста"}), ro?null:tools, aiT, ro?null:selBar, tText, ro?null:lintBox, h("div",{class:"hint",text:"Выдели фрагмент — Claude перепишет только его или оставишь заметку · пустая строка — новый абзац · **жирный** · __курсив__ · [текст](ссылка) · [фото:1]"})));
  form.append(secText);
  if(!ro && sample){
    const wishT=h("input",{type:"text",id:"fTWish",placeholder:"Необязательно: «начни с ошибки», «короче», «убери перечисление систем»"});
    const stT=h("div",{class:"hint"}); const diag=h("div",{class:"aidiag",hidden:true});
    const pick=h("div",{class:"vpick",hidden:true,role:"group","aria-label":"Какой текст оставить"});
    let mine=null, vars=[], cur=-1;
    const show=i=>{ cur=i; tText.value=i<0?mine:vars[i].text; sync();
      [...pick.children].forEach((b,j)=>b.classList.toggle("on",j===i+1));
      if(i<0){ stT.textContent="Это твой текст, ничего не потеряно."; }
      else { const ds=diffStat(mine,vars[i].text); stT.textContent="Claude поменял примерно "+(ds.add+ds.del)+" слов. Цифры и цитаты сверь с источником. Понравилось — нажми «Сохранить»."; } };
    const drawPick=()=>{ pick.replaceChildren(
      h("button",{type:"button",class:"vbtn mine",onclick:()=>show(-1)}, h("span",{class:"vi",text:"↩"}), h("span",{}, h("b",{text:"Твой текст"}), h("small",{text:"как было до Claude"}))),
      ...vars.map((v,i)=>h("button",{type:"button",class:"vbtn",onclick:()=>show(i)}, h("span",{class:"vi",text:String(i+1)}), h("span",{}, h("b",{text:"Вариант "+(i+1)}), h("small",{text:v.angle}))))); pick.hidden=false; };
    const goT=h("button",{type:"button",class:"btn accent",onclick:async()=>{
      goT.disabled=true; const w=wishT.value.trim();
      stT.textContent="Claude пишет два варианта… это около минуты."+(wantsResearch(w)?" Внутри панели Claude не ходит в интернет — если нужно изучить документацию, попроси меня в чате.":"");
      try{ const r=await rewriteText(d, w); if(mine==null||cur<0||tText.value!==vars[cur].text) mine=tText.value; logVersion("claude",mine); vars=r.variants;
        diag.hidden=!r.diagnosis; diag.replaceChildren(h("b",{text:"Что мешало: "}), r.diagnosis||"");
        drawPick(); show(0); goT.textContent="Ещё два варианта"; }
      catch(e){ stT.textContent=(e&&e.code==="not_granted")?"Разреши панели обращаться к Claude и нажми ещё раз.":(e&&e.code==="rate_limited")?"Слишком часто. Подожди минуту.":((e&&e.message)||"Не получилось. Попробуй ещё раз."); }
      finally{ goT.disabled=false; }
    }},"Переписать");
    aiT.append(panelHead("Переписать с Claude",()=>{ aiT.hidden=true; aiTBtn.classList.remove("on"); }), h("label",{for:"fTWish",text:"Что поменять в тексте"}), h("div",{class:"airow"}, wishT, goT), diag, pick, stT);
  }

  const mBox=h("div",{class:"mgrid"});
  const drawMedia=()=>{
    mBox.replaceChildren();
    (d.media||[]).forEach((m,i,arr)=>{
      const cap=h("input",{type:"text",value:m.caption||"",placeholder:"Подпись",readonly:ro||m.gen,"aria-label":"Подпись к картинке "+(i+1)});
      cap.addEventListener("input",()=>{ m.caption=cap.value; editing.dirty=true; upd(); });
      const mv=(dir)=>{ const j=i+dir; if(j<0||j>=arr.length) return; [arr[i],arr[j]]=[arr[j],arr[i]]; editing.dirty=true; drawMedia(); upd(); };
      mBox.append(h("div",{class:"mitem"}, h("img",{src:m.url,alt:m.caption||("Картинка "+(i+1))}), h("div",{class:"mb"},
        h("div",{class:"row"}, h("span",{text:"[фото:"+(i+1)+"]"}), h("span",{class:"sp"}),
          (ro||m.gen)?null:h("button",{type:"button",class:"btn sm ghost",title:"Левее",onclick:()=>mv(-1)},"←"),
          (ro||m.gen)?null:h("button",{type:"button",class:"btn sm ghost",title:"Правее",onclick:()=>mv(1)},"→"),
          (ro||m.gen)?h("span",{class:"hint",text:m.gen?"карусель":""}):h("button",{type:"button",class:"btn sm ghost danger",title:"Убрать",onclick:()=>{ arr.splice(i,1); editing.dirty=true; drawMedia(); upd(); }},"✕")),
        cap, m.source_url?h("a",{href:m.source_url,target:"_blank",rel:"noopener",style:"font-size:12px"},"Источник ↗"):null)));
    });
  };
  const fileIn=h("input",{type:"file",accept:"image/png,image/jpeg,image/webp",multiple:true,class:"sr",id:"fMedia"});
  fileIn.addEventListener("change",async()=>{
    if(!assets){ toast("Загрузка картинок недоступна в этом окне"); return; }
    for(const f of fileIn.files){ try{ const r=await assets.upload(f); (d.media=d.media||[]).push({url:r.url, asset_id:r.id, caption:""}); }catch(e){ toast("Не удалось загрузить "+f.name); } }
    fileIn.value=""; editing.dirty=true; drawMedia(); upd();
  });
  const mediaFld=sec("Картинки и карусель","порядок здесь — порядок в посте", mBox,
    h("div",{class:"hint",text:"Строка [фото:N] в тексте ставит картинку N в это место, остальные идут в конце поста."}),
    ro?null:h("div",{class:"acts"}, fileIn, h("label",{for:"fMedia",class:"btn"},"+ Добавить картинки")));
  drawMedia();
  /* layout chooser */
  const SAFE_MODE=!!editing.safe;
  if(!d.layout) d.layout=layoutOf(d);
  const layoutSec=h("section",{class:"sec laysec"});
  let covSecRef=null;
  const applyLayout=(l,quiet)=>{ d.layout=l; d.cover_off=(l==="carousel"||l==="none"); if((l==="cover"||l==="both") && !d.image_file_id) d.cover_render=true; if(d.carousel) d.carousel.top=true;
    if(!quiet){ editing.dirty=true; clearTimeout(sync.as); sync.as=setTimeout(autosave,1200); }
    if(covSecRef) covSecRef.hidden=!(l==="cover"||l==="both"); carSec.hidden=!(l==="carousel"||l==="both");
    drawLayout(); try{ drawEd(); }catch(_){} drawMedia(); upd(); };
  const drawLayout=()=>{
    const adv=adviseLayout(d);
    const seg=h("div",{class:"layseg",role:"radiogroup","aria-label":"Как оформить пост"}, ...LAYOUTS.map(([k,t])=>{ const b=h("button",{type:"button",role:"radio","aria-checked":d.layout===k?"true":"false",class:d.layout===k?"on":"",disabled:ro}, h("span",{class:"lic "+k,"aria-hidden":"true"}), h("b",{text:t}), k===adv.layout?h("i",{text:"совет"}):null); b.addEventListener("click",()=>applyLayout(k)); return b; }));
    const ask=(!ro&&sample)?h("button",{type:"button",class:"btn sm aibtn",onclick:async(e)=>{ const btn=e.currentTarget; btn.disabled=true; btn.textContent="Claude думает…";
        try{ const v=await sample.json("Ты арт-директор Telegram-канала «Дизайн-Радар» для продуктовых дизайнеров. Реши, как лучше подать пост: \"cover\" — одна обложка 2000×640 над текстом; \"carousel\" — карточки 1080×1350, которые листают, без обложки; \"both\" — обложка и карусель; \"none\" — только текст. Карусель — когда есть 3+ параллельных пункта, которые хочется сохранить; обложка — один тезис, новость, мнение, вакансии.\nРубрика: "+(d.label||d.section)+"\nЗаголовок: "+d.title+"\nТекст:\n"+String(d.full_text||"").slice(0,2500)+"\nОтветь только JSON {\"layout\":\"cover|carousel|both|none\",\"why\":\"одно предложение по-русски\"}.",{modelTier:"default",cache:false});
          if(v&&LAYOUTS.some(x=>x[0]===v.layout)){ adviceEl.textContent="Claude советует: «"+LAYOUTS.find(x=>x[0]===v.layout)[1]+"». "+(v.why||""); } }
        catch(er){ toast((er&&er.message)||"Не получилось"); } finally{ btn.disabled=false; btn.textContent="✦ Спросить Claude"; } }},"✦ Спросить Claude"):null;
    const adviceEl=h("span",{text:"Совет: «"+LAYOUTS.find(x=>x[0]===adv.layout)[1]+"». "+adv.why});
    layoutSec.replaceChildren(h("div",{class:"sech"},h("h4",{text:"Как оформить пост"})), seg, h("div",{class:"advice"}, adviceEl, ask));
  };
  /* carousel editor */
  const carSec=h("section",{class:"sec carsec"});
  let carSpec=d.carousel?JSON.parse(JSON.stringify(d.carousel)):null; editing.carDirty=false;
  const carThumbs=[]; let carT=null;
  const carSig=[];
  const rebuildCarPreview=async(full)=>{ if(!carSpec) return; await carFonts(); const urls=[]; let changed=false;
    const n=carCount(carSpec), others=(d.media||[]).filter(m=>!m.gen);
    const oldGen=(d.media||[]).filter(m=>m.gen);
    for(let i=0;i<n;i++){ const sig=JSON.stringify([i,n,carSpec.cover&&carSpec.cover.label,i===0?carSpec.cover:i<=carSpec.points.length?carSpec.points[i-1]:carSpec.final]);
      if(!full && carSig[i]===sig && oldGen[i] && oldGen[i].pending){ urls.push(oldGen[i].url); continue; }
      const c=drawCarCard(carSpec,i); const th=carThumbs[i]; if(th){ th.cv.getContext("2d").drawImage(c,0,0,th.cv.width,th.cv.height); th.w.textContent=c.warn.length?"⚠ "+c.warn.join(", "):""; th.w.hidden=!c.warn.length; }
      urls.push(c.toDataURL("image/jpeg",.82)); carSig[i]=sig; changed=true; }
    carSig.length=n;
    if(!changed && oldGen.length===n) return;
    d.media=urls.map((u,i)=>({url:u, caption:carCaption(carSpec,i), pending:true, gen:true})).concat(others);
    drawMedia(); upd(); try{ drawEd(); }catch(_){} };
  const carChanged=()=>{ d.carousel=carSpec; editing.carDirty=true; editing.dirty=true; setSaveState("Карточки изменены — соберутся при сохранении"); clearTimeout(carT); carT=setTimeout(rebuildCarPreview,350); clearTimeout(sync.as); sync.as=setTimeout(autosave,2500); };
  const cf=(obj,key,lab,ph,area)=>{ const e=area?h("textarea",{rows:2,placeholder:ph||"",readonly:ro}):h("input",{type:"text",placeholder:ph||"",readonly:ro}); e.value=obj[key]||""; e.addEventListener("input",()=>{ obj[key]=e.value; carChanged(); }); return h("div",{class:"fld"},h("label",{text:lab}),e); };
  const drawCar=()=>{
    carThumbs.length=0;
    if(!carSpec){ carSec.replaceChildren(h("div",{class:"sech"},h("h4",{text:"Карусель"}),h("span",{text:"карточки 1080×1350 в стиле канала"})),
        h("p",{class:"hint",text:"Карусель рисуется прямо здесь из текста карточек: меняешь слово — картинка перерисовывается."}),
        ro?null:h("div",{class:"acts"}, sample?h("button",{type:"button",class:"btn aibtn",onclick:async(e)=>{ const b=e.currentTarget; b.disabled=true; b.textContent="Claude собирает карусель…"; try{ carSpec=await genCarousel(d,""); carSpec.top=true; carChanged(); drawCar(); }catch(er){ toast((er&&er.message)||"Не получилось"); b.disabled=false; b.textContent="✦ Сделать карусель из текста"; } }},"✦ Сделать карусель из текста"):null,
          h("button",{type:"button",class:"btn",onclick:()=>{ carSpec={top:true,cover:{label:d.label||"Чек-лист",title:plain(d.cover_title||d.title).slice(0,45),subtitle:""},points:[{head:"",body:"",check:""},{head:"",body:"",check:""},{head:"",body:"",check:""}],final:{title:"",body:"",cta:"Пришли свою работу на разбор в @designradar_ask_bot",source:""}}; carChanged(); drawCar(); }},"Пустая карусель"))); return; }
    const head=h("div",{class:"sech"},h("h4",{text:"Карусель"}),h("span",{text:carCount(carSpec)+" карточек · правь текст — картинки перерисуются"}));
    const opts=h("div",{class:"acts"},
      (!ro&&sample)?h("button",{type:"button",class:"btn sm aibtn",onclick:async(e)=>{ const b=e.currentTarget; b.disabled=true; b.textContent="Claude пересобирает…"; try{ const t=carSpec.top; carSpec=await genCarousel(d,""); carSpec.top=t; carChanged(); drawCar(); }catch(er){ toast((er&&er.message)||"Не получилось"); b.disabled=false; b.textContent="✦ Пересобрать из текста"; } }},"✦ Пересобрать из текста"):null,
      ro?null:h("button",{type:"button",class:"btn sm ghost danger",onclick:()=>{ carSpec=null; d.carousel=null; editing.carDirty=true; editing.dirty=true; d.media=(d.media||[]).filter(m=>!m.gen); drawCar(); applyLayout(d.layout==="both"?"cover":"none"); }},"Удалить карусель"));
    const list=h("div",{class:"cards"});
    const n=carSpec.points.length;
    for(let i=0;i<n+2;i++){
      const cv=document.createElement("canvas"); cv.width=216; cv.height=270; cv.className="cthumb";
      const w=h("div",{class:"cwarn",hidden:true}); carThumbs[i]={cv,w};
      let fields, ttl;
      if(i===0){ ttl="Обложка"; fields=[cf(carSpec.cover,"label","Рубрика","Чек-лист"), cf(carSpec.cover,"title","Заголовок","до 45 знаков"), cf(carSpec.cover,"subtitle","Подзаголовок","до 110 знаков",true)]; }
      else if(i<=n){ const pt=carSpec.points[i-1]; ttl=String(i).padStart(2,"0")+" · "+(pt.head||"Пункт"); fields=[cf(pt,"head","Вопрос или правило","до 55 знаков"), cf(pt,"body","Объяснение","до 150 знаков",true), cf(pt,"check","Проверка в рамке","до 80 знаков, начни с глагола")]; }
      else { ttl="Финал"; fields=[cf(carSpec.final,"title","Заголовок","до 45 знаков"), cf(carSpec.final,"body","Текст","до 120 знаков",true), cf(carSpec.final,"cta","Призыв в оранжевой плашке","до 70 знаков"), cf(carSpec.final,"source","Источники","GOV.UK · Carbon · NN/g")]; }
      const tools=ro?null:h("div",{class:"acts"},
        (i>0&&i<=n)?h("button",{type:"button",class:"btn sm ghost",title:"Выше",disabled:i===1,onclick:()=>{ const a=carSpec.points; [a[i-2],a[i-1]]=[a[i-1],a[i-2]]; carChanged(); drawCar(); }},"↑"):null,
        (i>0&&i<=n)?h("button",{type:"button",class:"btn sm ghost",title:"Ниже",disabled:i===n,onclick:()=>{ const a=carSpec.points; [a[i],a[i-1]]=[a[i-1],a[i]]; carChanged(); drawCar(); }},"↓"):null,
        sample?h("button",{type:"button",class:"btn sm aibtn",onclick:async(e)=>{ const b=e.currentTarget; b.disabled=true; try{ const v=await rewriteCard(d,carSpec,i,"short"); Object.assign(i===0?carSpec.cover:i<=n?carSpec.points[i-1]:carSpec.final, v); carChanged(); drawCar(); }catch(er){ toast((er&&er.message)||"Не получилось"); b.disabled=false; } }},"✦ Короче"):null,
        sample?h("button",{type:"button",class:"btn sm aibtn",onclick:async(e)=>{ const b=e.currentTarget; b.disabled=true; try{ const v=await rewriteCard(d,carSpec,i,i>0&&i<=n?"check":"clear"); Object.assign(i===0?carSpec.cover:i<=n?carSpec.points[i-1]:carSpec.final, v); carChanged(); drawCar(); }catch(er){ toast((er&&er.message)||"Не получилось"); b.disabled=false; } }},i>0&&i<=n?"✦ Другая проверка":"✦ Яснее"):null,
        (i>0&&i<=n&&n>1)?h("button",{type:"button",class:"btn sm ghost danger",onclick:()=>{ carSpec.points.splice(i-1,1); carChanged(); drawCar(); }},"Удалить"):null);
      list.append(h("details",{class:"card1",open:i===0}, h("summary",{}, cv, h("div",{class:"ctt"}, h("b",{text:ttl}), w)), h("div",{class:"cbody"}, ...fields, tools)));
    }
    carSig.length=0;
    carSec.replaceChildren(head, opts, list, ro?null:h("div",{class:"acts"}, h("button",{type:"button",class:"btn",onclick:()=>{ carSpec.points.push({head:"",body:"",check:""}); carChanged(); drawCar(); }},"+ Карточка"), h("span",{class:"hint",text:"Картинки соберутся и загрузятся при сохранении"})));
    if(editing.carDirty) rebuildCarPreview(true); else drawThumbsOnly();
  };
  const drawThumbsOnly=async()=>{ await carFonts(); for(let i=0;i<carThumbs.length;i++){ const c=drawCarCard(carSpec,i); const th=carThumbs[i]; th.cv.getContext("2d").drawImage(c,0,0,th.cv.width,th.cv.height); th.w.textContent=c.warn.length?"⚠ "+c.warn.join(", "):""; th.w.hidden=!c.warn.length; } };
  if(!SAFE_MODE){ try{ drawCar(); }catch(e){ console.error(e); showErr("Карусель не загрузилась", e); carSec.replaceChildren(h("div",{class:"notice err",text:"Карусель не загрузилась: "+(e&&e.message||e)})); } }
  const covInfo=h("div",{class:"covinfo"});

  const covBox=h("div"); const drawEd=()=>{ covBox.replaceChildren(coverMock(d));
    const c=drawCover(d); if(!isRendered(d)||!c){ covInfo.replaceChildren(); return; }
    const sz=Number(c.dataset.size)||0, ln=(c.dataset.text||"").split("\n").filter(Boolean), manual=/\n/.test(String(d.cover_title||"").trim());
    covInfo.replaceChildren(...[
      h("span",{class:"ci"}, (manual?"Переносы твои":"Переносы автоматические")+" · строк: "+ln.length+" · кегль "+sz),
      sz&&sz<=62?h("span",{class:"ci warn"},"Мелко: укороти заголовок или перенеси иначе"):null,
      (!ro&&manual)?h("button",{type:"button",class:"btn sm ghost",onclick:()=>{ tCover.value=tCover.value.replace(/\s*\n\s*/g," "); sync(); }},"Убрать мои переносы"):null,
      (!ro&&!manual&&ln.length>1)?h("button",{type:"button",class:"btn sm ghost",title:"Подставить текущие строки, чтобы поправить их вручную",onclick:()=>{ tCover.value=ln.join("\n"); sync(); tCover.focus(); }},"Переносить вручную"):null].filter(Boolean)); };
  const aiC=h("div",{class:"ai",hidden:true});
  const [cvBtn,cvBox]=varBox("cover");
  const covRow=h("div",{class:"row2"}, h("div",{class:"fld"}, h("div",{class:"lblrow"}, h("label",{for:"fCover",text:"Заголовок обложки"}), (!ro&&sample&&isRendered(d))?cvBtn:null), tCover), field("Рубрика",tLabel));
  const covBoxWrap=h("div",{class:"covbox"},covBox);
  const cov=sec("Обложка", isRendered(d)?"так её увидят в канале":"", covRow, cvBox, covBoxWrap, covInfo, isRendered(d)?null:h("div",{class:"hint",text:(!d.image_file_id&&mediaOf(d).length)?"Это карусель: отдельной обложки нет, в канале пост откроется карточками. Если нужна обложка над текстом — нажми «Нарисовать обложку редакции».":"У этого поста картинка уже лежит в Telegram, показать её здесь нельзя. Нажми «Нарисовать обложку редакции», чтобы заменить её обложкой канала."}));
  if(!ro && sample){
    const wishIn=h("input",{type:"text",id:"fWish",placeholder:"Пожелание к сцене, необязательно: например, «покажи очередь из уведомлений»"});
    const st=h("div",{class:"hint"});
    const go=h("button",{type:"button",class:"btn accent",onclick:async()=>{
      go.disabled=true; st.textContent="Claude придумывает сцену… это около минуты.";
      try{ const art=await newScene(d, wishIn.value.trim()); if(d.cover_art) d.cover_art_prev=d.cover_art; d.cover_art=art; d.cover_render=true; editing.dirty=true; drawEd(); upd(); st.textContent="Готово. Не нравится — нажми ещё раз или напиши пожелание. Сохрани пост, чтобы оставить обложку."; }
      catch(e){ st.textContent=(e&&e.code==="not_granted")?"Разреши панели обращаться к Claude и нажми ещё раз.":(e&&e.code==="rate_limited")?"Слишком часто. Подожди минуту.":((e&&e.message)||"Не получилось. Попробуй ещё раз."); }
      finally{ go.disabled=false; }
    }},"Нарисовать");
    aiC.append(panelHead("Новая сцена от Claude",()=>{ aiC.hidden=true; document.querySelectorAll(".sec .aibtn.on").forEach(b=>b.classList.remove("on")); }), h("label",{for:"fWish",text:"Какую сцену нарисовать"}), h("div",{class:"airow"}, wishIn, go), st);
  }
  if(!ro){ const aiCBtn=sample?h("button",{type:"button",class:"btn aibtn",onclick:()=>{ aiC.hidden=!aiC.hidden; aiCBtn.classList.toggle("on",!aiC.hidden); if(!aiC.hidden) aiC.querySelector("input")?.focus(); }},"✦ Новая сцена от Claude"):null;
  cov.append(h("div",{class:"acts"}, aiCBtn,
    h("button",{type:"button",class:"btn",onclick:()=>{ d.cover_render=true; d.cover_seed=(Number(d.cover_seed)||0)+1; if(d.cover_art) d.cover_art_prev=d.cover_art; d.cover_art=""; editing.dirty=true; drawEd(); upd(); }},isRendered(d)?"Простой рисунок вместо этого":"Нарисовать обложку редакции"),
    d.cover_art_prev?h("button",{type:"button",class:"btn ghost",onclick:()=>{ d.cover_art=d.cover_art_prev; d.cover_seed=0; editing.dirty=true; drawEd(); upd(); }},"Вернуть рисунок редакции"):null), aiC); }
  drawEd();
  covSecRef=cov; if(!SAFE_MODE){ try{ drawLayout(); applyLayout(d.layout,true); }catch(e){ console.error(e); showErr("Оформление не загрузилось", e); } }
  if(SAFE_MODE){ layoutSec.hidden=true; carSec.hidden=true; }
  form.append(layoutSec, cov, carSec, mediaFld, sec("Источник и хэштеги", null, h("div",{class:"row2"}, field("Хэштеги",tTags), field("Источник",tSrc)), field("Ссылка на первоисточник",tUrl,"Для новостей и разборов: в канале появится строка «Открыть первоисточник ↗».")));
  const ed=h("div",{class:"ed"},form);
  panes.append(ed,pv);
  const saveState=h("span",{class:"savestate"});
  const setSaveState=(t)=>{ saveState.textContent=t; };
  const verCol=()=>db.collection(baseOf(editing.id)+"/"+editing.id+"/versions");
  const noteCol=()=>db.collection(baseOf(editing.id)+"/"+editing.id+"/notes");
  function logVersion(source, before){
    if(ro||!db) return; const now=Date.now();
    const text=before!=null?before:d.full_text;
    if(text===editing.lastVerText && source==="autosave") return;
    editing.lastVerText=text; editing.lastVerAt=now;
    verCol().doc().set({title:d.title||"", full_text:text||"", by:S.me||"", source, at:now}).catch(()=>{});
  }
  function mkPatch(){ return {title:(d.title||"").trim(), cover_title:(d.cover_title||"").trim(), label:d.label, section:d.section, full_text:(d.full_text||"").replace(/\r\n?/g,"\n").trim(), hashtags:d.hashtags, source:(d.source||"").trim(), url:(d.url||"").trim(), cover_render:!!(d.cover_render||isRendered(d)), cover_seed:Number(d.cover_seed)||0, cover_art:d.cover_art||"", cover_art_prev:d.cover_art_prev||"", carousel:d.carousel||null, cover_off:!!d.cover_off, layout:d.layout||"cover", ...((d.media||[]).some(m=>m.pending)?{}:{media:(d.media||[]).map(m=>({url:m.url, asset_id:m.asset_id||"", caption:m.caption||"", source_url:m.source_url||"", file_id:m.file_id||"", ...(m.gen?{gen:true}:{})}))})}; }
  async function uploadPendingSlides(){
    const pend=(d.media||[]).filter(m=>m.pending); if(!pend.length) return true;
    if(!assets){ toast("Загрузка картинок недоступна в этом окне"); return false; }
    setSaveState("Загружаю карточки…");
    const blobs=await carToBlobs(carSpec||d.carousel);
    const media=[];
    for(let i=0;i<blobs.length;i++){ const r=await assets.upload(new File([blobs[i]],"car_"+editing.id+"_"+(i+1)+".png",{type:"image/png"})); media.push({url:r.url, asset_id:r.id, caption:carCaption(d.carousel,i), file_id:"", gen:true}); }
    d.media=media.concat((d.media||[]).filter(m=>!m.gen&&!m.pending)); editing.carDirty=false; drawMedia(); upd(); return true;
  }
  async function autosave(){
    if(ro||!editing||!editing.dirty) return;
    const orig=S.posts.find(p=>p.id===editing.id)||{};
    const patch=mkPatch();
    if(patch.full_text!==orig.full_text||patch.title!==orig.title){ patch.edited_by=S.me||""; patch.edited_at=Date.now(); if(orig.author==="claude" && orig.orig_text==null){ patch.orig_title=orig.title||""; patch.orig_text=orig.full_text||""; } if(orig.author==="claude" && S.owner) patch.owner_edited=true; }
    if(!editing.versions || !editing.versions.length){ if(!editing.origLogged){ editing.origLogged=true; verCol().doc().set({title:orig.title||"", full_text:orig.full_text||"", by:orig.author||"claude", source:"original", at:(orig.created_at||Date.now()-1)}).catch(()=>{}); } }
    setSaveState("Сохраняю…");
    try{ editing.saving=true; await savePost(editing.id,patch); editing.dirty=false; editing.changed=true; const ed=editing; setTimeout(()=>{ ed.saving=false; },2000);
      if(Date.now()-(editing.lastVerAt||0)>4*6e4) logVersion("autosave");
      const t=new Date(); setSaveState("Сохранено в "+pad2(t.getHours())+":"+pad2(t.getMinutes())); }
    catch(e){ setSaveState("Не сохранилось — проверь связь"); }
  }
  function drawHistory(){
    const vs=(editing.versions||[]).slice().sort((a,b)=>b.at-a.at);
    const box=h("div",{class:"hist"});
    if(!vs.length){ box.append(h("div",{class:"empty"},h("b",{text:"История появится после первой правки"}),h("span",{text:"Панель сохраняет версии сама: твои правки, правки редакторов и переписывания Claude."}))); return box; }
    const srcName={original:"исходная версия",autosave:"правка",claude:"до правки Claude",manual:"сохранение",restore:"до возврата версии"};
    vs.forEach((v,i)=>{ const next=i===0?{full_text:d.full_text}:vs[i-1]; const ds=diffStat(v.full_text,next.full_text);
      const it=h("details",{class:"hv"}, h("summary",{}, h("b",{text:authorName(v.by)}), h("span",{text:" · "+(srcName[v.source]||v.source)+" · "+whenText(v.at)}), (ds.add||ds.del)?h("span",{class:"ds"}, h("i",{class:"add",text:"+"+ds.add}), h("i",{class:"del",text:"−"+ds.del})):null),
        h("div",{class:"hvbody"}, h("b",{text:v.title||""}), h("pre",{text:v.full_text||""}),
          ro?null:h("button",{type:"button",class:"btn sm",onclick:()=>{ logVersion("restore",tText.value); tTitle.value=v.title||tTitle.value; tText.value=v.full_text||""; sync(); toast("Версия возвращена — она сохранится автоматически"); }},"Вернуть эту версию")));
      box.append(it); });
    return box;
  }
  function drawNotes(){
    const ns=(editing.notes||[]).slice().sort((a,b)=>(a.resolved-b.resolved)||(b.at-a.at));
    const wrap=h("div",{class:"notes"});
    if(mayEdit(editing.draft)){
      const q=editing.noteQuote||"";
      const ta=h("textarea",{id:"noteIn",rows:3,placeholder:q?"Что не так с этим фрагментом?":"Заметка к посту: что поправить, что проверить"});
      const add=h("button",{type:"button",class:"btn accent",onclick:async()=>{ const t=ta.value.trim(); if(!t) return; add.disabled=true;
        try{ await noteCol().doc().set({text:t.slice(0,1000), quote:q, by:S.me||"", at:Date.now(), resolved:false}); editing.noteQuote=""; ta.value=""; }catch(e){ toast("Не удалось добавить заметку"); } finally{ add.disabled=false; } }},"Добавить");
      wrap.append(h("div",{class:"noteform"}, q?h("blockquote",{text:q}):null, ta, h("div",{class:"acts"}, add, q?h("button",{type:"button",class:"btn ghost",onclick:()=>{ editing.noteQuote=""; drawPvTabs(); }},"Без фрагмента"):null)));
    }
    if(!ns.length) wrap.append(h("div",{class:"hint",text:"Заметок пока нет. Выдели фрагмент в тексте и нажми «💬 Заметка», чтобы оставить замечание к конкретному месту."}));
    ns.forEach(n=>{ const el=h("div",{class:"note"+(n.resolved?" done":"")}, h("div",{class:"nmeta"}, h("b",{text:authorName(n.by)}), h("span",{text:" · "+ago(n.at)+(n.resolved?" · решено":"")})),
        n.quote?h("button",{type:"button",class:"nq",title:"Найти в тексте",onclick:()=>{ const i=tText.value.indexOf(n.quote); if(i>=0){ panes.classList.remove("showpv"); tText.focus(); tText.setSelectionRange(i,i+n.quote.length); } else toast("Этого фрагмента в тексте уже нет"); }},"«"+n.quote+"»"):null,
        h("p",{text:n.text}),
        mayEdit(editing.draft)?h("div",{class:"acts"}, h("button",{type:"button",class:"btn sm",onclick:()=>noteCol().doc(n.id).update({resolved:!n.resolved, resolved_by:S.me||"", resolved_at:Date.now()})},n.resolved?"Вернуть":"✓ Готово"),
          (S.owner||n.by===S.me)?h("button",{type:"button",class:"btn sm ghost danger",onclick:()=>noteCol().doc(n.id).delete()},"Удалить"):null):null);
      wrap.append(el); });
    return wrap;
  }
  if(db && editing.id){
    try{ editing.unsubs.push(verCol().onSnapshot(sn=>{ if(!editing) return; editing.versions=sn.docs.map(x=>({id:x.id,...x.data()})); if(editing.versions.length) editing.origLogged=true; drawPvTabs(); },()=>{})); }catch(_){}
    try{ editing.unsubs.push(noteCol().onSnapshot(sn=>{ if(!editing) return; editing.notes=sn.docs.map(x=>({id:x.id,...x.data()})); const open=editing.notes.filter(x=>!x.resolved).length; const cur=S.posts.find(p=>p.id===editing.id); if(cur && (cur.notes_open||0)!==open && S.canWrite) savePost(editing.id,{notes_open:open}).catch(()=>{}); if(pvTab!=="preview"||true) drawPvTabs(); },()=>{})); }catch(_){}
  }
  async function save(close=true){
    if(ro) { if(close) closeEditor(); return; }
    if((d.media||[]).some(m=>m.pending)){ try{ if(!(await uploadPendingSlides())) return; }catch(e){ toast("Не удалось загрузить карточки. Попробуй ещё раз."); return; } }
    const orig=S.posts.find(p=>p.id===editing.id)||{};
    const patch=mkPatch();
    const changed=patch.title!==orig.title||patch.full_text!==orig.full_text;
    clearTimeout(sync.as);
    if(changed||editing.changed){
      if(changed) patch.prev={title:orig.title||"", full_text:orig.full_text||""};
      patch.edited_by=S.me||""; patch.edited_at=Date.now();
      if(orig.author==="claude" && orig.orig_text==null){ patch.orig_title=orig.title||""; patch.orig_text=orig.full_text||""; }
      if(orig.author==="claude" && S.owner) patch.owner_edited=true;
    }
    editing.saving=true; await savePost(editing.id,patch); editing.dirty=false; const ed=editing; setTimeout(()=>{ ed.saving=false; },2000);
    if(changed) logVersion("manual");
    if(orig.status==="scheduled" && mcp){ try{ const outbox=await prepareOutbox({...orig,...patch,id:editing.id}); await savePost(editing.id,{outbox}); toast("План обновлён: в канал выйдет новая версия"); }catch(e){ toast("Текст сохранён, но не удалось обновить запланированную версию. Перезапланируй пост."); } }
    if(close){ closeEditor(); toast("Сохранено"); }
  }
  const pvToggle=h("button",{type:"button",class:"btn pvbtn",onclick:()=>{ panes.classList.toggle("showpv"); pvToggle.textContent=panes.classList.contains("showpv")?"Текст":"Превью"; }},"Превью");
  const stName={review:"на согласовании",draft:"черновик",published:"опубликован",scheduled:"в плане",rejected:"отклонён"}[d.status]||"";
  const head=h("header",{}, h("button",{class:"iconbtn",onclick:()=>{ if((editing.dirty||editing.changed) && !ro){ save(true); } else closeEditor(); },"aria-label":"Назад"},"←"),
    h("div",{class:"t"}, h("b",{text:plain(d.title)||(ro?"Пост":"Новый пост")}), h("span",{text:(ro?"просмотр":"редактирование")+(stName?" · "+stName:"")})), ro?null:saveState, themeBtn(), pvToggle);
  const foot=h("footer",{});
  if(!ro){
    foot.append(h("span",{class:"hint who",text:"Автор: "+authorName(d.author)}), h("span",{class:"sp"}));
    foot.append(h("button",{class:"btn primary",onclick:()=>save(true)},"Сохранить"));
    if(d.status==="draft") foot.append(h("button",{class:"btn",onclick:async()=>{ await save(false); await savePost(editing.id,{status:"review"}); closeEditor(); toast("Отправлено на согласование"); }},"На согласование"));
    if(S.owner && d.status==="published") foot.append(h("button",{class:"btn accent",onclick:async()=>{ await save(false); const id=editing.id, dr={...d}; closeEditor(); await updateInChannel(id, dr); }},"Сохранить и обновить в канале"));
    if(S.owner && d.status==="review") foot.append(h("button",{class:"btn accent",onclick:async()=>{ await save(false); const id=editing.id; closeEditor(); S.confirm=id; location.hash="review"; render(); }},"К публикации"));
  }
  if(ro) foot.append(h("span",{class:"hint who",text:"Автор: "+authorName(d.author)}));
  const sheet=h("div",{class:"sheet",role:"dialog","aria-modal":"true","aria-label":"Редактор поста"}, head, panes, foot);
  root.replaceChildren(sheet); drawPvTabs(); upd();
  if(!ro) setTimeout(()=>tText.focus({preventScroll:true}),50);
}

/* ---------- версия панели и «Что нового» ---------- */
function seenVersion(){ try{ return localStorage.getItem("dr_seen_version")||""; }catch(_){ return ""; } }
function showChanges(){
  try{ localStorage.setItem("dr_seen_version",APP_VERSION); }catch(_){}
  drawVersionChip();
  const close=()=>ov.remove();
  const ov=h("div",{class:"wnov",onclick:e=>{ if(e.target===ov) close(); }});
  const box=h("div",{class:"wnbox",role:"dialog","aria-label":"Что нового"}, panelHead("Что нового",close),
    ...CHANGES.map(c=>h("section",{class:"wnv"}, h("div",{class:"wnh"}, h("b",{text:"Версия "+c.v}), h("span",{text:c.date})), h("ul",{}, ...c.items.map(t=>h("li",{text:t}))))));
  ov.append(box); document.body.append(ov);
  ov.addEventListener("keydown",e=>{ if(e.key==="Escape") close(); }); box.querySelector("button")?.focus();
}
function drawVersionChip(){
  const sub=document.querySelector(".brand .sub"); if(!sub) return;
  let b=document.getElementById("verChip");
  if(!b){ b=h("button",{type:"button",id:"verChip",class:"verchip",title:"Что нового",onclick:showChanges}); sub.after(b); }
  const fresh=seenVersion()!==APP_VERSION;
  b.replaceChildren(h("span",{text:"v"+APP_VERSION}), fresh?h("i",{class:"vdot","aria-label":"новое"}):null);
}
setTimeout(drawVersionChip,0);
/* ---------- boot ---------- */
function route(){ const hv=location.hash.replace("#","");
  if(/^invite=/.test(hv)){ S.inviteCode=hv.slice(7).replace(/[^A-Za-z0-9_-]/g,"").slice(0,40); try{ localStorage.setItem("dr_invite",S.inviteCode); }catch(_){} history.replaceState(null,"",location.pathname+location.search+"#review"); }
  const v=location.hash.replace("#",""); S.view=VIEWS.some(x=>x.id===v)?v:"review"; S.confirm=null; render(); }
window.addEventListener("hashchange",route);
async function resolveNames(){
  if(!user) return;
  const ids=[...new Set([...S.posts.map(p=>p.author),...S.ideas.map(i=>i.author),...Object.keys(S.editors)].filter(x=>x&&x!=="claude"))];
  if(!ids.length) return;
  try{ const ps=await user.profiles(ids); for(const id of ids) S.names[id]=(ps[id]&&ps[id].name)||"Редактор"; render(); }catch{}
}
route();
(async()=>{
  const c=window.claude;
  if(!c||!c.use){ S.dbOk=false; render(); return; }
  [db,user,mcp,sample,assets]=await Promise.all(["db","user","mcp","sample","assets"].map(n=>c.use(n).catch(()=>null)));
  if(!db){ S.dbOk=false; render(); return; }
  S.dbOk=true;
  if(user){
    try{ S.owner=await user.isOwner(); }catch{}
    try{ const can=await user.can("data.write"); S.canWrite=can!==false; }catch{ S.canWrite=true; }
    try{ S.me=await user.id(); }catch{}
    try{ const me=await user.me(); S.myName=me&&me.name?me.name:""; }catch{}
    S.realOwner=S.owner; S.realMe=S.me;
    let t=false; try{ t=localStorage.getItem("dr_test")==="1"; }catch(_){}
    if(t && S.realOwner){ S.test=true; S.owner=false; S.me=TEST_ID; }
    renderWho();
  }
  postsCol().onSnapshot(snap=>{ S.mainPosts=snap.docs.map(d=>({id:d.id,...d.data(),_base:"posts"})); mergePosts(); S.ready=true; render(); resolveNames(); syncEditor(); setTimeout(prepareEditorPosts,1500); }, ()=>{ S.ready=true; render(); });
  ideasCol().onSnapshot(snap=>{ S.ideas=snap.docs.map(d=>({id:d.id,...d.data()})); render(); });
  db.collection("roles").onSnapshot(snap=>{ S.roles={}; snap.docs.forEach(d=>S.roles[d.id]=d.data()); S.rolesLoaded=true; mergeEditors(); applyBlock(); render(); }, ()=>{});
  db.collection("editors").onSnapshot(snap=>{ S.edRaw={}; snap.docs.forEach(d=>S.edRaw[d.id]=d.data()); mergeEditors(); watchAuthors(); syncInvites(); S.editorsLoaded=true; matchInvite(); applyBlock(); render(); if(!$("#sheetRoot").firstChild && !S.blocked) checkOnboarding(); });
  db.collection("settings").onSnapshot(snap=>{ const d=snap.docs.find(x=>x.id==="main"); S.settings=d?d.data():{}; if(S.owner) render(); }, ()=>{});
  db.collection("invites").onSnapshot(snap=>{ S.invites=snap.docs.map(d=>({id:d.id,...d.data()})); if(S.owner) render(); matchInvite(); syncInvites(); }, ()=>{});
  watchAuthors();
  if(S.realMe && S.canWrite){ try{ const r=db.doc("editors/"+S.realMe); const g=await r.get(); if(!g.exists) await r.set({column:"", joined_at:Date.now()}); }catch{} }
})();
})();
