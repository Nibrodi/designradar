/* ---------- views ---------- */
const TAB_ICO=(()=>{ const s=d=>'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+d+'</svg>';
  return {review:s('<path d="M4 13h4l2 3h4l2-3h4"/><path d="M5.5 5h13L21 13v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z"/>'),
    plan:s('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
    drafts:s('<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/>'),
    ideas:s('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/>'),
    published:s('<path d="M21 3L10 14"/><path d="M21 3l-6.5 18-4.5-7-7-4.5z"/>'),
    games:s('<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none"/>'),
    team:s('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6.5 6.5 0 0 0-2.5-5.1"/>')}; })();
function renderTabs(){
  const nav=$("#tabs"); const keep=nav.scrollLeft; nav.replaceChildren();
  requestAnimationFrame(()=>{ nav.scrollLeft=keep; const a=nav.querySelector('[aria-current="page"]'); if(a && nav.scrollWidth>nav.clientWidth){ const l=a.offsetLeft-16, r=a.offsetLeft+a.offsetWidth-nav.clientWidth+24; if(nav.scrollLeft>l) nav.scrollLeft=l; else if(nav.scrollLeft<r) nav.scrollLeft=r; } });
  for(const v of VIEWS){
    if(v.owner && !S.owner) continue;
    if(v.menu) continue;
    const n = v.id==="ideas" ? S.ideas.filter(i=>i.status!=="done").length : v.id==="linkedin" ? liReady().length : v.id==="team" ? null : byView(v.id).length;
    const nm=v.id==="team"&&S.owner?"Редакция":v.name;
    const n2=v.id==="team"&&S.owner?(S.invites.filter(i=>i.status==="sent").length||null):n;
    const ic=h("span",{class:"ti","aria-hidden":"true"}); ic.innerHTML=v.id==="linkedin"?LI_ICO:(TAB_ICO[v.id]||"");
    nav.append(h("button",{class:"tab","aria-current":S.view===v.id?"page":null,"aria-label":nm,onclick:()=>{location.hash=v.id; window.scrollTo({top:0});},"data-v":v.id}, ic, h("span",{class:"tl"}, h("span",{class:"full",text:nm}), h("span",{class:"short",text:v.short||nm})), n2!=null&&n2>0?h("span",{class:"n",text:n2>99?"99+":n2}):null));
  }
}
function postCard(a){
  const busy=!!S.busy[a.id], err=S.errors[a.id];
  const card=h("article",{class:"card"});
  const cov=coverMock(a,true); card.append(cov);
  const b=h("div",{class:"body"});
  const med=mediaOf(a);
  const st={review:"на согласовании",draft:"черновик",published:"опубликован",rejected:"отклонён",queued:"выходит в канал…",publishing:"публикуется…",publish_unknown:"проверь канал"}[a.status]||a.status;
  /* статус показываем, только если он отличается от раздела: в «На согласовании» и так всё на согласовании */
  const natural=S.view==="games"?(a.status==="published"?"published":"review"):{review:"review",drafts:"draft",published:"published",plan:"scheduled"}[S.view];
  const stEl=a.status==="scheduled"?h("span",{class:"when",text:"выйдет "+whenText(a.scheduled_at)}):(a.status!==natural?h("span",{class:"status "+a.status,text:st}):null);
  const multi=new Set(S.posts.map(p=>p.author||"claude")).size>1;
  b.append(h("div",{class:"meta"}, stEl, h("span",{class:"lbl2",text:a.label||a.section||""}), multi?h("span",{text:authorName(a.author)}):null, h("span",{text:ago(a.published_at||a.updated_at||a.created_at)})));
  b.append(h("h3",{text:plain(a.title)}));
  b.append(h("p",{class:"excerpt",text:plain(a.full_text).replace(/\[(?:фото|photo)\s*:?\s*\d{1,2}\]\s*/gi,"").slice(0,280)}));
  if(a.poll) b.append(pollView(a));
  if(isGame(a) && a.threads && a.status!=="published") b.append(threadsView(a));
  if(med.length && cov.classList.contains("mcover")){ b.querySelector(".meta").append(h("span",{text:(med.length>1?"карусель · ":"картинка · ")+med.length})); }
  else if(med.length){ const st=h("div",{class:"strip",style:"padding:0"}); const pa=a.photo_assets||{}; let bad=0; med.slice(0,10).forEach((m,i)=>{ const im=h("img",{src:pa[m.url]||m.url,alt:"",loading:"lazy",referrerpolicy:"no-referrer"}); im.addEventListener("error",()=>{ im.remove(); bad++; if(bad>=Math.min(10,med.length)) st.replaceWith(h("div",{class:"hint",text:"Фото с сайта источника здесь не показываются — они загрузятся в Telegram при публикации."})); }); st.append(im); }); b.append(h("div",{class:"meta",text:(med.length>1?"Карусель · ":"Картинка · ")+med.length+" шт."}), st); }
  if(a.notes_open>0) b.querySelector(".meta")?.append(h("span",{class:"chk notes",title:"Открытые заметки к посту"},"💬 "+a.notes_open));
  if(a.check && a.status!=="published") b.querySelector(".meta")?.append(h("span",{class:"chk",title:"Есть что проверить руками — подробности в посте"},h("span",{class:"chk-i","aria-hidden":"true",text:"!"}),"проверить"));
  if(err) b.append(h("div",{class:"notice err",text:err}));
  else if(a.publish_error && (a.status==="review"||a.status==="scheduled")) b.append(h("div",{class:"notice err",text:a.publish_error}));
  if(a.status==="scheduled" && (a._base||"posts")==="posts" && S.owner){
    if(a.scheduled_at && Date.now()-a.scheduled_at>QUEUE_LATE) b.append(h("div",{class:"notice err",text:"Должен был выйти "+whenText(a.scheduled_at)+", но Make его не выпустил. Проверь канал: если поста там нет — нажми «Выпустить сейчас»."}));
    else if(S.queueErr) b.append(h("div",{class:"notice err",text:S.queueErr}));
  }
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
    if(a.poll && !a.poll_message_id && S.owner) main.append(h("button",{class:"btn accent",disabled:busy,onclick:()=>sendPollNow(a)},busy?"Отправляю…":"Отправить опрос"));
    if(a.published_url) main.append(h("a",{class:"btn",href:a.published_url,target:"_blank",rel:"noopener"},"В канале ↗"));
    main.append(h("button",{class:"btn",onclick:()=>openEditor(a.id)},S.owner?"Исправить":"Посмотреть"));
  } else if(S.sched===a.id){
    acts.append(schedPicker(a));
  } else if(a.status==="scheduled"){
    if(S.owner) main.append(h("button",{class:"btn accent",disabled:busy,onclick:()=>{S.sched=a.id;render();}},"Перенести"),
      h("button",{class:"btn",disabled:busy,onclick:()=>{S.confirm=a.id;S.sched=null;savePost(a.id,{status:"review"}).then(()=>{location.hash="review";syncQueue();});}},"Выпустить сейчас"));
    else if(canPub(a)) main.append(h("button",{class:"btn accent",disabled:busy,onclick:()=>{S.sched=a.id;render();}},"Перенести"));
    if(a.needs_prepare && S.owner) b.append(h("div",{class:"notice"},"Пост редактора: при открытии панели обложка и картинки уже готовятся к выходу."));
    sub.append(link("Редактировать",()=>openEditor(a.id)));
    if(S.owner||canPub(a)) sub.append(link("Снять с плана",()=>savePost(a.id,{status:"review"}).then(()=>{toast("Снято с плана, пост на согласовании");syncQueue();}),"danger end"));
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
    if(S.owner && a.status!=="published") sub.append(link("Отклонить",()=>openReject(a),"danger end"));
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
  card.addEventListener("click",e=>{ if(e.target.closest("button,a,input,select,textarea,label,.confirm,details,summary")) return; if(getSelection&&String(getSelection()).length) return; openEditor(a.id); });
  card.addEventListener("keydown",e=>{ if(e.target===card && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); openEditor(a.id); } });
  return card;
}
/* ---------- игры (с 2.20) ---------- */
function pollView(a){
  const p=a.poll||{}, quiz=p.type==="quiz", raw=(p.options||[]).map(o=>String(o||"").trim());
  const box=h("div",{class:"pollv"}, h("div",{class:"pollh"}, h("span",{class:"pk",text:quiz?"Викторина":"Опрос"}), h("b",{text:String(p.question||"").trim()||"Вопрос не задан"})),
    h("ol",{}, ...raw.map((o,i)=>o?h("li",{class:quiz&&i===p.correct?"ok":""}, h("span",{text:o}), quiz&&i===p.correct?h("em",{text:"верный"}):null):null).filter(Boolean)),
    quiz&&String(p.explanation||"").trim()?h("p",{class:"hint",text:"Пояснение: "+String(p.explanation).trim()}):null);
  if(a.status==="published") box.append(h("p",{class:"hint pst "+(a.poll_message_id?"ok":"bad"),text:a.poll_message_id?"Опрос в канале":a.poll_error?"Опрос не ушёл: "+a.poll_error:"Опрос ещё не отправлен"}));
  else { const pr=pollProblems(p); if(pr.length) box.append(h("p",{class:"hint pst bad",text:"Поправь перед выходом: "+pr.join(", ")})); else box.append(h("p",{class:"hint",text:"Уйдёт в канал сразу после поста."})); }
  return box;
}
async function copyText(t, msg){ try{ await navigator.clipboard.writeText(t); toast(msg||"Скопировано"); }
  catch(_){ const ta=h("textarea",{style:"position:fixed;opacity:0"}); ta.value=t; document.body.append(ta); ta.select(); try{ document.execCommand("copy"); toast(msg||"Скопировано"); }catch(__){ toast("Не получилось скопировать"); } ta.remove(); } }
function threadsView(a){
  const t=a.threads||{}; const opts=(t.poll_options||[]).filter(Boolean);
  const post=String(t.text||"").trim()+(opts.length?"\n\nОпрос: "+opts.join(" / "):"");
  return h("details",{class:"thr"}, h("summary",{text:"Для Threads"}),
    t.text?h("p",{text:t.text}):null, opts.length?h("p",{class:"hint",text:"Опрос в Threads (только у поста без картинки): "+opts.join(" / ")}):null,
    t.reply?h("p",{class:"hint",text:"Ответом под постом: "+t.reply}):null,
    h("div",{class:"acts"}, t.text?h("button",{type:"button",class:"btn sm",onclick:()=>copyText(post,"Текст для Threads скопирован")},"Копировать пост"):null,
      t.reply?h("button",{type:"button",class:"btn sm",onclick:()=>copyText(String(t.reply),"Ответ скопирован")},"Копировать ответ"):null));
}
function renderGames(){
  const m=$("#main");
  m.append(h("div",{class:"lead"}, h("div",{}, h("h2",{text:"Игры"}), h("p",{text:"Игры и опросы отдельно от статей. Опрос уходит в канал сам, сразу после поста, — и при «Опубликовать», и по плану. Текст для Threads — в карточке."})),
    h("div",{class:"leadacts"}, S.canWrite&&S.owner?h("button",{class:"btn primary newpost",onclick:()=>newPost({label:"Игра"})},"+ Новая игра"):null)));
  if(!S.ready){ m.append(loaderEl("Загружаю игры…")); return; }
  const all=S.posts.filter(authorOk).filter(isGame);
  const ready=byView("games"), plan=all.filter(x=>x.status==="scheduled").sort((a,b)=>(a.scheduled_at||0)-(b.scheduled_at||0)), out=all.filter(x=>x.status==="published").sort((a,b)=>(b.published_at||0)-(a.published_at||0));
  if(!ready.length&&!plan.length&&!out.length){ m.append(h("div",{class:"empty"}, logoEl("mono live"), h("b",{text:"Игр пока нет"}), h("span",{text:"Игра — пост с рубрикой «Игра» и опросом. Опрос добавляется в редакторе, в разделе «Опрос»."}), S.owner?h("button",{class:"btn primary",onclick:()=>newPost({label:"Игра"})},"+ Новая игра"):null)); return; }
  const part=(t,list)=>{ if(!list.length) return; m.append(h("h3",{class:"dayh",text:t+" · "+list.length})); const f=h("div",{class:"feed"}); list.forEach(a=>f.append(postCard(a))); m.append(f); };
  part("Готовы к выходу",ready); part("В плане",plan); part("Вышли",out.slice(0,30));
}
function emptyState(v){
  const t={
    review:["Сейчас нечего согласовывать","Новые посты от редакции появятся здесь. Черновики отправляются сюда кнопкой «На согласование»."],
    plan:["Пока ничего не запланировано","На согласовании нажми «Запланировать» у поста и выбери время выхода."],
    drafts:["Черновиков нет","Начни новый пост или возьми идею из раздела «Идеи»."],
    published:["Здесь будут вышедшие посты","После публикации пост переезжает сюда со ссылкой на канал."]
  }[v];
  return h("div",{class:"empty"}, logoEl("mono live"), h("b",{text:t[0]}), h("span",{text:t[1]}), S.canWrite&&v!=="plan"?h("button",{class:"btn primary",onclick:()=>openNewPost()},"+ Новый пост"):null);
}
function renderFeed(v){
  const titles={plan:["План публикаций","Запланированные посты по времени выхода. Они выйдут сами, даже если панель закрыта."],review:["На согласовании","Посты, которые ждут твоего решения. Публикуй сразу или запланируй время выхода."],drafts:["Черновики","Посты в работе. Когда текст готов, отправь его на согласование."],published:["Опубликовано","Последние посты, которые вышли в канале."]}[v];
  const m=$("#main");
  m.append(h("div",{class:"lead"}, h("div",{}, h("h2",{text:titles[0]}), h("p",{text:titles[1]})), h("div",{class:"leadacts"}, showAuthorFilter()?authorSelect():null, S.canWrite?h("button",{class:"btn primary newpost",onclick:()=>openNewPost()},"+ Новый пост"):null)));
  const list=byView(v);
  if(!S.ready){ m.append(loaderEl("Загружаю посты…")); return; }
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
    const add=async()=>{ const t=inp.value.trim(); if(!t) return; const r=await addIdea({text:t, angle:"", author:S.me||"", status:"new", created_at:Date.now()}); inp.value=""; toast(r.dup?"Такая идея уже есть":"Идея сохранена"); };
    const gen=async(btn)=>{
      if(!sample){ out.textContent="Генерация идей недоступна в этом окне."; return; }
      btn.disabled=true; out.textContent="Думаю над темами…";
      const recent=S.posts.filter(p=>p.status==="published").slice(0,15).map(p=>"— "+plain(p.title)).join("\n");
      const seed=inp.value.trim();
      try{
        const res=await sample.json("Ты редактор Telegram-канала «Дизайн-Радар» для продуктовых дизайнеров (тон: профессиональный, редакционный, без воды; рубрики: новости, разборы интерфейсов и брендинга, крафт — паттерны и приёмы, мнения, вакансии, книги и фильмы). Предложи 5 тем для постов"+(seed?" вокруг направления: «"+seed+"»":"")+". Каждая тема должна давать читателю практический вывод и опираться на то, что можно проверить по открытым источникам (дизайн-системы, гайдлайны, статьи практиков). Не повторяй уже вышедшие темы:\n"+(recent||"—")+"\nОтветь только JSON-массивом объектов {\"title\": заголовок до 70 знаков, \"angle\": одно предложение — тезис и чем полезно, \"rubric\": одна из «Крафт», «Разбор», «Мнение», «Новости»}.",{modelTier:"default"});
        const arr=Array.isArray(res)?res:(res&&res.ideas)||[];
        for(const it of arr.slice(0,6)) if(it&&it.title) await addIdea({text:String(it.title).slice(0,140), angle:String(it.angle||"").slice(0,400), rubric:String(it.rubric||"").slice(0,30), author:S.me||"", by_ai:true, status:"new", created_at:Date.now()});
        out.textContent=arr.length?"Добавила "+Math.min(arr.length,6)+" идей. Оставь нужные, остальные удали.":"Не получилось придумать — попробуй уточнить направление.";
      }catch(e){ out.textContent=e&&e.code==="not_granted"?"Чтобы генерировать идеи, разреши панели обращаться к Claude.":"Не удалось сгенерировать идеи. Попробуй ещё раз позже."; }
      finally{ btn.disabled=false; }
    };
    inp.addEventListener("keydown",e=>{ if(e.key==="Enter"){ e.preventDefault(); add(); }});
    const genBtn=h("button",{class:"btn",onclick:e=>gen(e.currentTarget)},"✦ Придумать 5 тем");
    m.append(h("div",{class:"ideabox"}, h("div",{class:"r"}, inp, h("button",{class:"btn primary",onclick:add},"Сохранить идею"), genBtn), out));
  }
  const list=S.ideas.filter(i=>i.status!=="done").sort((a,b)=>(b.created_at||0)-(a.created_at||0));
  if(!list.length){ m.append(h("div",{class:"empty"},logoEl("mono live"),h("b",{text:"Идей пока нет"}),h("span",{text:"Запиши тему одной строкой или попроси Claude предложить пять."}))); return; }
  const f=h("div",{class:"feed"});
  for(const it of list){
    const st={new:null,requested:"отдано редакции",taken:"в работе"}[it.status];
    f.append(h("div",{class:"idea"},
      h("div",{class:"meta"}, it.rubric?h("span",{class:"label",text:it.rubric}):null, (it.url&&/^https:\/\//.test(it.url))?h("a",{href:it.url,target:"_blank",rel:"noopener",class:"srclink",onclick:e=>e.stopPropagation()},"источник ↗"):null, st?h("span",{class:"status review",text:st}):null, h("span",{text:it.by_ai?"предложил Claude":authorName(it.author)}), h("span",{text:ago(it.created_at)})),
      h("h4",{text:it.text}), it.angle?h("p",{text:it.angle}):null,
      S.canWrite?h("div",{class:"acts"},
        it.status!=="requested"?h("button",{class:"btn sm primary",onclick:()=>ideasCol().doc(it.id).update({status:"requested",requested_by:S.me||"",requested_at:Date.now()}).then(()=>toast("Редакция напишет пост и пришлёт на согласование"))},"Отдать редакции"):null,
        h("button",{class:"btn sm",onclick:()=>newPost({title:it.text, idea:it.id})},"Написать самому"),
        h("button",{class:"btn sm ghost danger end",onclick:()=>ideasCol().doc(it.id).delete()},"Удалить")):null));
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
/* Подписки на базу (посты, идеи, роли, анкеты, настройки, приглашения, папки авторов) срабатывают пачкой:
   при загрузке это 8–12 событий подряд. renderSoon склеивает их в одну перерисовку за кадр. */
let renderQ=0;
function renderSoon(){ if(renderQ) return; renderQ=(window.requestAnimationFrame||setTimeout)(()=>{ renderQ=0; render(); }); }
function showAuthorFilter(){ if(S.author && S.author!=="all") return true; return new Set(S.posts.map(p=>p.author||"claude")).size>1; }
function render(){
  if(renderQ){ (window.cancelAnimationFrame||clearTimeout)(renderQ); renderQ=0; }
  renderTabs();
  drawMobileBar();
  let tb=document.getElementById("testbar");
  if(S.test && !tb){ tb=h("div",{id:"testbar",class:"testbar"},"Тестовый режим: ты видишь панель глазами нового редактора. Публикация недоступна, посты подписаны «Тестовый редактор». ",h("button",{type:"button",class:"btn sm",style:"margin-left:8px",onclick:()=>setTest(false)},"Выйти")); document.body.prepend(tb); }
  if(!S.test && tb) tb.remove();
  const ae=document.activeElement, fx=ae&&ae.dataset&&ae.dataset.li?{id:ae.dataset.li,s:ae.selectionStart,e:ae.selectionEnd,t:ae.scrollTop}:null;
  const m=$("#main"); m.replaceChildren();
  if(S.dbOk===false){ m.append(h("div",{class:"empty"},h("b",{text:"Панель работает только в Claude"}),h("span",{text:"Войди в claude.ai и открой эту страницу там: посты и черновики хранятся в базе редакции."}))); return; }
  if(S.blocked){ m.append(h("div",{class:"empty"},h("b",{text:S.blocked==="paused"?"Доступ приостановлен":"Доступ закрыт"}),h("span",{text:S.blocked==="paused"?"Колонка временно на паузе. Посты сохранены — если есть вопросы, напиши главному редактору.":"Доступ к редакции закрыт. Если это ошибка, напиши главному редактору."}))); return; }
  if(S.view==="linkedin" && !S.owner) S.view="review";
  if(S.view==="linkedin"){ renderLinkedIn(); if(fx){ const t=document.querySelector('textarea[data-li="'+fx.id+'"]'); if(t){ t.focus(); try{ t.setSelectionRange(fx.s,fx.e); }catch(_){} t.scrollTop=fx.t; } } return; }
  if(S.view==="ideas") renderIdeas(); else if(S.view==="games") renderGames(); else if(S.view==="team") (S.owner?renderAdmin():renderTeam()); else renderFeed(S.view);
}


