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
  /* роль, имя и «Тестовый вход» с 2.18 живут в меню профиля справа в шапке */
  const w=$("#who"); if(w) w.replaceChildren();
  drawMobileBar();
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

