/* ---------- «+»: выбор направления и темы для нового поста ---------- */
const DIRS=[
  {id:"find", t:"Находка", d:"Свежая работа студии или автора — с рецензией. Вставь ссылку в «Своя тема»", label:"Находка", pool:["Свежий ребрендинг российской студии","Упаковка небольшого локального бренда","Дизайнерский дроп или мерч, который разобрали за день","Новая айдентика городского места","Необычная вывеска или навигация"]},
  {id:"news", t:"Новости", d:"Что вышло и что это меняет", label:"Новости", pool:["Главный релиз недели в Figma и что он меняет в работе","Крупный сервис обновил интерфейс: что поменяли и зачем","Что нового в гайдлайнах Apple и Material","AI-функция в дизайн-инструменте: польза или шум","Обновление дизайн-системы известной компании"]},
  {id:"tips", t:"Советы", d:"Приём, который можно взять завтра", label:"Крафт", pool:["Как подписывать слои, чтобы разработчик не переспрашивал","Пустые состояния: три вопроса перед отрисовкой","Как проверить контраст в тёмной теме за минуту","Как отдать макет формы, чтобы не было багов","Отступы: почему сетка 8 px не спасает без правил"]},
  {id:"ideas", t:"Дизайн-идеи", d:"Решение, которое стоит украсть", label:"Крафт", pool:["Микроанимация, которая объясняет, а не украшает","Онбординг без слайдов: учить по ходу","Скелетоны вместо спиннеров — когда это честно","Отмена вместо подтверждения: «Удалено. Вернуть?»","Прогресс, который мотивирует, а не давит"]},
  {id:"review", t:"Разбор нового дизайна", d:"Что поменяли, зачем и как вышло", label:"Разбор", pool:["Разбор свежего редизайна банковского приложения","Новый экран оплаты популярного сервиса: где теряются люди","Редизайн маркетплейса: стало удобнее или моднее?","Разбор онбординга нового приложения"]},
  {id:"rebrand", t:"Ребрендинг", d:"Бренд, логотип, айдентика", label:"Разбор", pool:["Ребрендинг, который сохранил узнаваемость","Почему новые логотипы всё больше похожи друг на друга","Что брендбук должен говорить продуктовым дизайнерам","Ребрендинг через интерфейс: как бренд живёт в продукте"]},
  {id:"color", t:"Психология цвета", d:"Как цвет меняет смысл", label:"Крафт", pool:["Красный — ошибка или акцент? Как цвет меняет смысл кнопки","Почему у финтеха синие логотипы","Цвета статусов: светофор и дальтонизм","Тёмная тема — это не инверсия цветов"]},
  {id:"a11y", t:"Доступность", d:"Интерфейс для всех", label:"Крафт", pool:["Фокус с клавиатуры: что ломается первым","Зона нажатия 44 pt: откуда цифра и когда её нарушают","Подписи полей вместо плейсхолдеров","Как проверить макет на доступность без плагинов"]},
  {id:"texts", t:"UX-тексты", d:"Слова в интерфейсе", label:"Крафт", pool:["Текст ошибки, который помогает исправить","Кнопка «ОК» — худшая подпись","Пустой экран: что написать, кроме «Здесь ничего нет»","Как называть действия: глагол или существительное"]},
  {id:"tools", t:"Инструменты", d:"Figma, плагины, процессы", label:"Крафт", pool:["Variables в Figma: с чего начать","Плагин, который экономит час в неделю","Как организовать файл Figma для команды","Хендофф без боли: что положить рядом с макетом"]},
  {id:"career", t:"Карьера", d:"Рост, портфолио, собеседования", label:"Мнение", pool:["Как показать процесс в портфолио","Что спрашивают на собеседовании продуктового дизайнера","Как спорить с продактом аргументами, а не вкусом","Как вырасти из мидла в сеньора"]},
  {id:"mind", t:"Психология работы", d:"Выгорание, критика, созвоны", label:"Мнение", pool:["Выгорание от созвонов: как защищать время на дизайн","Как принимать критику макета и не защищаться","Синдром самозванца у сеньоров","Когда дизайнеру говорить «нет»"]},
  {id:"opinion", t:"Мнение", d:"Спорный тезис редакции", label:"Мнение", pool:["Дизайн-системы замедляют продукт?","Нужен ли дизайнеру код","Тренды вредят продуктам","Красивый дизайн переоценён"]},
  {id:"check", t:"Карусель-чек-лист", d:"5–7 карточек, которые сохраняют", label:"Крафт", pool:["5 вопросов к макету перед ревью","Чек-лист тёмной темы","Чек-лист формы перед разработкой","7 проверок пустых и ошибочных состояний"]}
];
const pick=(arr,n)=>{ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a.slice(0,n); };
function openNewPost(){
  if(!S.canWrite) return;
  if(S.paused){ toast("Колонка на паузе — новые посты сейчас недоступны"); return; }
  let ov=document.getElementById("npov"); if(ov) ov.remove();
  const close=()=>ov.remove();
  const box=h("div",{class:"npbox",role:"dialog","aria-label":"Новый пост"});
  ov=h("div",{id:"npov",class:"npov",onclick:e=>{ if(e.target===ov) close(); }}, box);
  ov.addEventListener("keydown",e=>{ if(e.key==="Escape") close(); });
  const home=()=>{
    const tiles=pick(DIRS,DIRS.length).map(dr=>h("button",{type:"button",class:"nptile",onclick:()=>detail(dr)}, h("b",{text:dr.t}), h("span",{text:pick(dr.pool,1)[0]})));
    box.replaceChildren(panelHead("Что пишем?",close),
      h("button",{type:"button",class:"npself",onclick:()=>{ close(); newPost(); }}, h("span",{class:"npi","aria-hidden":"true",text:"✎"}), h("span",{}, h("b",{text:"Написать самой"}), h("small",{text:"Пустой черновик, тема своя"}))),
      h("div",{class:"nphint",text:"Или выбери направление — предложу темы"}),
      h("div",{class:"npgrid"}, ...tiles));
    box.scrollTop=0; box.querySelector(".npself")?.focus();
  };
  const detail=(dr)=>{
    let topics=pick(dr.pool,3), chosen=topics[0];
    const list=h("div",{class:"nptopics",role:"radiogroup","aria-label":"Темы"});
    const own=h("input",{type:"text",placeholder:"Или своя тема",class:"npown","aria-label":"Своя тема"});
    const st=h("div",{class:"hint"});
    const draw=()=>{ list.replaceChildren(...topics.map(t=>h("button",{type:"button",role:"radio","aria-checked":t===chosen&&!own.value.trim()?"true":"false",class:"nptopic"+(t===chosen&&!own.value.trim()?" on":""),onclick:()=>{ chosen=t; own.value=""; draw(); }}, t))); };
    own.addEventListener("input",draw);
    const topic=()=>own.value.trim()||chosen;
    const more=h("button",{type:"button",class:"btn sm",onclick:()=>{ const rest=dr.pool.filter(x=>!topics.includes(x)); topics=pick(rest.length>=3?rest:dr.pool,3); chosen=topics[0]; draw(); }},"↻ Другие темы");
    const ai=sample?h("button",{type:"button",class:"btn sm aibtn",onclick:async()=>{
      ai.disabled=true; st.textContent="Claude думает над темами…";
      const recent=S.posts.slice(0,20).map(p=>"— "+plain(p.title)).join("\n");
      try{ const r=await sample.json("Ты редактор Telegram-канала «Дизайн-Радар» для продуктовых дизайнеров с опытом от 2 лет. Предложи 3 темы постов в направлении «"+dr.t+"» ("+dr.d+"). Тема — одна конкретная фраза до 80 знаков, с понятной пользой для практика, без выдуманных фактов, цифр и названий релизов, которых ты не знаешь наверняка. Не повторяй уже вышедшее:\n"+recent+"\nОтветь только JSON-массивом из трёх строк.",{modelTier:"default",cache:false});
        const arr=(Array.isArray(r)?r:[]).map(x=>String(x).trim()).filter(Boolean).slice(0,3);
        if(arr.length){ topics=arr; chosen=arr[0]; own.value=""; draw(); st.textContent=""; } else st.textContent="Не получилось — попробуй ещё раз.";
      }catch(e){ st.textContent=e&&e.code==="not_granted"?"Разреши панели обращаться к Claude.":"Не получилось — попробуй ещё раз."; }
      finally{ ai.disabled=false; } }},"✦ Темы от Claude"):null;
    const write=h("button",{type:"button",class:"btn",onclick:()=>{ close(); newPost({title:topic(), label:dr.label}); }},"Написать самой");
    const give=h("button",{type:"button",class:"btn accent",onclick:async()=>{
      give.disabled=true;
      try{ await addIdea({text:topic().slice(0,140), angle:dr.t+": "+dr.d, rubric:dr.label, author:S.me||"", status:"requested", requested_by:S.me||"", requested_at:Date.now(), created_at:Date.now(), dir:dr.id});
        close(); toast("Отдала Claude — черновик придёт на согласование"); }
      catch(e){ give.disabled=false; st.textContent="Не удалось сохранить. Попробуй ещё раз."; } }},"Отдать Claude");
    box.replaceChildren(
      h("div",{class:"phead"}, h("button",{type:"button",class:"npback","aria-label":"Назад",onclick:home},"←"), h("span",{text:dr.t}), closeX(close)),
      h("p",{class:"npdesc",text:dr.d}), list, h("div",{class:"nprow"}, more, ai), own, st,
      h("div",{class:"npacts"}, write, give));
    draw(); box.scrollTop=0;
  };
  home(); document.body.append(ov);
}
