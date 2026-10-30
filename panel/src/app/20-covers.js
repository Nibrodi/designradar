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


