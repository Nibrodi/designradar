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
      if(a.status==="draft" && S.canWrite) main.append(h("button",{class:"btn accent",onclick:()=>savePost(a.id,{status:"review"}).then(()=>toast("Отправлено на согласование"))},"На согласование"));
      main.append(h("button",{class:"btn",onclick:()=>openEditor(a.id)},"Редактировать"));
    }
    if(!S.owner && canPub(a) && a.status==="draft") sub.append(link("На согласование",()=>savePost(a.id,{status:"review"}).then(()=>toast("Отправлено на согласование"))));
    if(a.status==="review" && S.canWrite) sub.append(link("В черновики",()=>savePost(a.id,{status:"draft"}).then(()=>toast("Перенесено в черновики"))));
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


