/* ---------- LinkedIn: личные посты Екатерины ----------
   Claude готовит черновик (пн, ср, пт утром), Екатерина публикует сама.
   С 2.18 вкладка устроена как очередь, а не как стена карточек:
   — сверху пульс: сколько готово, сколько вышло за неделю против цели, когда придёт следующий черновик;
   — один «текущий» черновик крупно: слева превью как в ленте LinkedIn (с обрывом «…ещё»), справа пять шагов публикации;
   — остальные готовые — короткими строками «Дальше в очереди»; вышедшие и отклонённые — в истории.
   Почему так: два черновика пролежали по 4 дня неопубликованными. Узкое место — не текст, а сам выход:
   скопировать, скачать фото, открыть LinkedIn, не забыть ссылку в первый комментарий. Шаги это и закрывают. */
const liCol=()=>db.collection("linkedin");
const LI_UI={};   /* id → {lang, dirty, en, ru, mode, edit} — локальное состояние */
const LI_GOAL=2;  /* постов в неделю: стабильный ритм важнее объёма */
const LI_SHARE="https://www.linkedin.com/feed/?shareActive=true";
const LI_ICO='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5v6M8 7.5v.01M12 16.5v-6M12 13c0-1.5 1-2.5 2.3-2.5S16.5 11.3 16.5 13v3.5"/></svg>';
function liWatch(){ try{ liCol().onSnapshot(sn=>{ S.li=sn.docs.map(d=>({id:d.id,...d.data()})); if(S.owner) renderSoon(); },()=>{}); }catch(_){} }
const liReady=()=>(S.li||[]).filter(x=>x.status==="ready");
function liSave(id,patch){ return liCol().doc(id).update({...patch, updated_at:Date.now()}).catch(e=>{ toast("Не сохранилось: "+((e&&e.message)||"ошибка базы")); throw e; }); }
/* какие шаги уже сделаны — только в этом браузере, базе это не нужно */
const liDone=(id)=>{ try{ return (JSON.parse(localStorage.getItem("dr_li_done")||"{}"))[id]||{}; }catch(_){ return {}; } };
function liMark(id,step){ try{ const all=JSON.parse(localStorage.getItem("dr_li_done")||"{}"); all[id]={...(all[id]||{}),[step]:Date.now()}; const keys=Object.keys(all); if(keys.length>40) delete all[keys[0]]; localStorage.setItem("dr_li_done",JSON.stringify(all)); }catch(_){} }
const liPhotos=x=>(x.photos||[]).filter(p=>p&&/^https:\/\//.test(p.url||""));
const liDays=ms=>ms?Math.floor((Date.now()-ms)/86400000):0;
/* Следующий черновик: задача запускается в 9:13 по Москве в пн, ср и пт, черновик готов к ~9:30 */
function liNextDraft(){
  const MSK=3*3600000; const now=Date.now();
  for(let i=0;i<8;i++){ const d=new Date(now+MSK+i*86400000); const dow=d.getUTCDay();
    if(![1,3,5].includes(dow)) continue;
    const t=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),9,30)-MSK;
    if(t>now) return t; }
  return 0;
}
const liWhen=ms=>{ const d=new Date(ms); const today=new Date(); const tm=new Date(Date.now()+86400000);
  const same=(a,b)=>a.toDateString()===b.toDateString();
  const day=same(d,today)?"сегодня":same(d,tm)?"завтра":d.toLocaleDateString("ru-RU",{weekday:"short",day:"numeric",month:"short"});
  return day+" к "+d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}); };
function liComment(x,lang){
  if(!x.source_url) return "";
  const nm=(x.source_name||"").split(" — ")[0].trim();
  return (lang==="ru"?"Источник: ":"Source: ")+(nm?nm+" — ":"")+x.source_url;
}

async function liDownload(x,btn,out){
  const ph=liPhotos(x);
  if(!ph.length) return;
  if(!downloads){ out.textContent="Скачивание недоступно в этом окне — открой фото по ссылкам и сохрани их оттуда."; return; }
  btn.disabled=true; const pa={...(x.photo_assets||{})}; let n=0;
  try{
    for(let i=0;i<ph.length;i++){
      out.textContent="Забираю фото "+(i+1)+" из "+ph.length+"…";
      let u=pa[ph[i].url]; if(!u){ u=await importPhoto(ph[i].url); pa[ph[i].url]=u; }
      const loc=R_LOCAL.get(u); const blob=await (await fetch(loc||u)).blob();
      const ext=(blob.type.split("/")[1]||"jpg").replace("jpeg","jpg");
      await downloads.save({filename:"linkedin_"+String(x.id).replace(/[^A-Za-z0-9_-]/g,"_")+"_"+(i+1)+"."+ext, data:blob}); n++;
    }
    out.textContent=n===1?"Фото сохранено.":"Сохранено фото: "+n+"."; liMark(x.id,"photos");
  }catch(e){ out.textContent=(e&&e.code==="not_granted")?"Разреши панели сохранять файлы и запускать Make, потом нажми ещё раз.":"Не получилось: "+((e&&e.message)||"ошибка")+". Открой фото по ссылке и сохрани вручную."; }
  finally{ btn.disabled=false; if(Object.keys(pa).length!==Object.keys(x.photo_assets||{}).length) liSave(x.id,{photo_assets:pa}).catch(()=>{}); else renderSoon(); }
}

/* картинка: из хранилища панели, если уже скачана, иначе по ссылке источника; не открылась — плашка с номером */
function liImg(x,p,i,cls){
  const pa=x.photo_assets||{}; const a=pa[p.url]; const src=a?(R_LOCAL.get(a)||a):p.url;
  const box=h("div",{class:cls});
  const im=h("img",{src,alt:p.caption||("Фото "+(i+1)),loading:"lazy",referrerpolicy:"no-referrer",decoding:"async"});
  im.addEventListener("error",()=>{ im.replaceWith(h("div",{class:"li-ph0"}, h("b",{text:String(i+1)}), h("span",{text:p.caption||"фото не показывается здесь"}))); });
  box.append(im); return box;
}

/* превью как в ленте LinkedIn: шапка автора, текст с обрывом на третьей строке, сетка фото, первый комментарий */
function liPreview(x,ui){
  const nm=S.myName||"Екатерина";
  const text=(ui.lang==="en"?ui.en:ui.ru)||"";
  const pv=h("div",{class:"li-pv "+(ui.dev||"phone"),"aria-label":"Превью поста в LinkedIn"});
  const ava=()=>h("div",{class:"li-ava","aria-hidden":"true",text:nm.trim()[0]||"Е"});
  pv.append(h("div",{class:"li-pvh"}, ava(), h("div",{}, h("b",{text:nm}), h("span",{text:"Product Designer"}), h("small",{text:(ui.lang==="en"?"now":"сейчас")+" · 🌐"}))));
  const tx=h("div",{class:"li-pvt"+(ui.open?" open":""),text});
  const more=h("button",{type:"button",class:"li-more-btn",onclick:()=>{ ui.open=!ui.open; renderSoon(); }},ui.open?(ui.lang==="en"?"…show less":"…свернуть"):(ui.lang==="en"?"…see more":"…ещё"));
  pv.append(tx, more);
  const ph=liPhotos(x).slice(0,4);
  if(ph.length){ const g=h("div",{class:"li-pvimg n"+ph.length}); ph.forEach((p,i)=>g.append(liImg(x,p,i,"li-pvi"))); pv.append(g); }
  pv.append(h("div",{class:"li-pvbar","aria-hidden":"true"}, ...(ui.lang==="en"?["Like","Comment","Repost","Send"]:["Нравится","Комментарий","Репост","Отправить"]).map(t=>h("span",{text:t}))));
  const cm=liComment(x,ui.lang);
  if(cm) pv.append(h("div",{class:"li-pvc"}, ava(), h("div",{}, h("b",{text:nm}), h("span",{text:cm}))));
  /* после отрисовки проверяем, обрезан ли текст: если влезает целиком, «…ещё» не нужна */
  requestAnimationFrame(()=>{ if(!ui.open && tx.scrollHeight<=tx.clientHeight+2) more.hidden=true; });
  return pv;
}

function liStep(n,title,done,desc,...body){
  return h("li",{class:"li-step"+(done?" done":"")}, h("span",{class:"li-n","aria-hidden":"true",text:done?"✓":String(n)}),
    h("div",{class:"li-sb"}, h("b",{text:title}, done?h("span",{class:"vh",text:" — сделано"}):null), desc?h("p",{class:"hint",text:desc}):null, ...body));
}

/* текущий черновик: превью + пять шагов */
function liCard(x){
  const ui=LI_UI[x.id]||(LI_UI[x.id]={lang:"en",dirty:false,mode:null,edit:false,dev:"phone"});
  if(!ui.dirty){ ui.en=x.text_en||""; ui.ru=x.text_ru||""; }
  const done=liDone(x.id); const ro=!S.owner;
  const card=h("article",{class:"card licard li-studio"}); const b=h("div",{class:"body"});
  const age=liDays(x.created_at);
  const meta=h("div",{class:"meta"}, x.rubric?h("span",{class:"label",text:x.rubric}):null,
    h("span",{class:age>=5?"li-age old":"li-age",text:age<1?"готов сегодня":"лежит "+age+" дн."+(age>=5?" — тема остывает":"")}),
    x.edited?h("span",{text:"есть твои правки"}):null);
  b.append(meta, h("h3",{text:plain(x.title||"Без названия")}));
  if(x.check) b.append(h("details",{class:"li-checkbox"}, h("summary",{}, h("span",{class:"chk-i","aria-hidden":"true",text:"!"}), "Проверь перед публикацией"), h("p",{text:x.check})));

  /* язык и вид превью */
  const seg=h("div",{class:"seg li-lang",role:"group","aria-label":"Язык поста"});
  [["en","English"],["ru","Русский"]].forEach(([l,n])=>seg.append(h("button",{type:"button","data-l":l,"aria-pressed":String(ui.lang===l),onclick:()=>{ ui.lang=l; ta.value=ui.lang==="en"?ui.en:ui.ru; cntUpd(); renderSoon(); }},n)));
  const dev=h("div",{class:"seg li-dev",role:"group","aria-label":"Где смотреть превью"});
  [["phone","Телефон"],["desk","Компьютер"]].forEach(([k,n])=>dev.append(h("button",{type:"button","aria-pressed":String(ui.dev===k),onclick:()=>{ ui.dev=k; renderSoon(); }},n)));
  const left=h("div",{class:"li-left"}, h("div",{class:"li-pvopts"}, seg, dev), liPreview(x,ui),
    h("p",{class:"hint",text:"Пост с фото LinkedIn обрывает на третьей строке — до «…ещё» должен поместиться крючок. Пустая строка тоже считается строкой."}));

  /* шаг 1: текст */
  const ta=h("textarea",{class:"li-text","data-li":x.id,rows:"14","aria-label":"Текст поста",readonly:ro?true:null});
  ta.value=ui.lang==="en"?ui.en:ui.ru;
  const cnt=h("div",{class:"hint li-cnt"});
  const cntUpd=()=>{ const t=ta.value; cnt.textContent=t.length+" / 3000 знаков"+(t.length>3000?" — LinkedIn не примет, сократи":t.length>1800?" — длинновато: лучше 900–1600":""); cnt.classList.toggle("bad",t.length>3000); };
  cntUpd();
  const saveEd=h("button",{type:"button",class:"btn sm primary",disabled:!ui.dirty,onclick:async()=>{ await liSave(x.id,{text_en:ui.en,text_ru:ui.ru,edited:true}); ui.dirty=false; ui.edit=false; toast("Сохранено"); renderSoon(); }},"Сохранить правки");
  ta.addEventListener("input",()=>{ if(ui.lang==="en") ui.en=ta.value; else ui.ru=ta.value; ui.dirty=true; saveEd.disabled=false; cntUpd();
    const t=card.querySelector(".li-pvt"); if(t) t.textContent=ta.value; });
  const editBox=h("div",{class:"li-edit",hidden:!ui.edit}, ta, cnt, h("div",{class:"li-row"}, saveEd,
    h("button",{type:"button",class:"btn sm ghost",onclick:()=>{ ui.dirty=false; ui.edit=false; renderSoon(); }},ui.dirty?"Отменить правки":"Свернуть")));
  const copyBtn=h("button",{type:"button",class:"btn"+(done.text?"":" accent"),onclick:async()=>{ await copyText(ui.lang==="en"?ui.en:ui.ru); liMark(x.id,"text"); renderSoon(); }},done.text?"Скопировать ещё раз":"Скопировать текст");
  const s1=liStep(1,"Скопируй текст",!!done.text, ui.lang==="en"?"Английский — основной: по нему тебя находят рекрутеры. Не публикуй два языка в одном посте.":"Русская версия — чтобы проверить смысл или для отдельного поста.",
    h("div",{class:"li-row"}, copyBtn, ro?null:h("button",{type:"button",class:"btn ghost",onclick:()=>{ ui.edit=!ui.edit; renderSoon(); }},ui.edit?"Свернуть":"Править текст")), editBox);

  /* шаг 2: фото */
  const ph=liPhotos(x); const out=h("div",{class:"hint li-out"});
  const have=ph.length && ph.every(p=>(x.photo_assets||{})[p.url]);
  const s2=ph.length?liStep(2,"Скачай фото",!!done.photos, have?"Фото уже в панели — скачиваются без Make.":"1 операция Make на фото и только в первый раз, потом фото хранится в панели.",
    h("div",{class:"li-thumbs"}, ...ph.map((p,i)=>{ const t=liImg(x,p,i,"li-ph"); t.title=p.caption||""; return t; })),
    h("div",{class:"li-row"}, h("button",{type:"button",class:"btn",onclick:e=>liDownload(x,e.currentTarget,out)},"Скачать "+(ph.length>1?ph.length+" фото":"фото")), h("a",{class:"btn ghost",href:(ph[0].source_url||x.source_url||ph[0].url),target:"_blank",rel:"noopener noreferrer"},"Страница с фото ↗")), out)
    :liStep(2,"Фото",true,"К этому посту фото нет — LinkedIn покажет только текст.");

  /* шаг 3: LinkedIn */
  const s3=liStep(3,"Опубликуй в LinkedIn",!!done.open,"Вставь текст, добавь фото. Лучше ср–пт с 16 до 19 по Москве — вечер рабочего дня в Европе и на Кавказе.",
    h("div",{class:"li-row"}, h("a",{class:"btn",href:LI_SHARE,target:"_blank",rel:"noopener noreferrer",onclick:()=>{ liMark(x.id,"open"); setTimeout(renderSoon,300); }},"Открыть LinkedIn ↗")));

  /* шаг 4: первый комментарий */
  const cm=liComment(x,ui.lang);
  const s4=cm?liStep(4,"Первый комментарий со ссылкой",!!done.comment,"Сразу после публикации: ссылка в тексте поста режет охват, в комментарии — нет.",
    h("div",{class:"li-cm",text:cm}),
    h("div",{class:"li-row"}, h("button",{type:"button",class:"btn",onclick:async()=>{ await copyText(cm); liMark(x.id,"comment"); renderSoon(); }},"Скопировать комментарий")))
    :liStep(4,"Первый комментарий",true,"У этого поста нет ссылки на источник.");

  /* шаг 5: отметить */
  let fin;
  if(ui.mode==="posted"){
    const inp=h("input",{type:"url",placeholder:"Ссылка на пост в LinkedIn (необязательно)","aria-label":"Ссылка на пост"});
    fin=h("div",{class:"confirm"}, inp, h("div",{class:"amain"},
      h("button",{class:"btn accent",onclick:async()=>{ const u=inp.value.trim(); await liSave(x.id,{status:"posted",posted_at:Date.now(),posted_lang:ui.lang,...(/^https:\/\//.test(u)?{post_url:u}:{}),...(ui.dirty?{text_en:ui.en,text_ru:ui.ru,edited:true}:{})}); ui.mode=null; ui.dirty=false; S.liCur=null; toast("Отмечено. Теперь ответь на первые комментарии в течение часа"); }},"Готово"),
      h("button",{class:"btn",onclick:()=>{ ui.mode=null; renderSoon(); }},"Отмена")));
  } else if(ui.mode==="reject"){
    const inp=h("input",{type:"text",placeholder:"Почему не подходит — Claude учтёт в следующих","aria-label":"Причина"});
    fin=h("div",{class:"confirm"}, inp, h("div",{class:"amain"},
      h("button",{class:"btn danger-fill",onclick:async()=>{ await liSave(x.id,{status:"rejected",rejected_at:Date.now(),reject_reason:inp.value.trim()}); ui.mode=null; S.liCur=null; toast("Отклонён. Новый черновик придёт по расписанию"); }},"Отклонить"),
      h("button",{class:"btn",onclick:()=>{ ui.mode=null; renderSoon(); }},"Отмена")));
  } else {
    fin=h("div",{class:"cacts"}, h("div",{class:"amain one"}, h("button",{class:"btn accent",onclick:()=>{ ui.mode="posted"; renderSoon(); }},"Опубликовала в LinkedIn")),
      h("div",{class:"asub one"}, h("button",{type:"button",class:"btn danger end",onclick:()=>{ ui.mode="reject"; renderSoon(); }},"Отклонить черновик")));
  }
  const s5=liStep(5,"Отметь здесь",false,"Ссылка на пост поможет Claude видеть, что выходит. Потом ответь на комментарии в первый час — это главный сигнал для ленты.", fin);

  const steps=h("ol",{class:"li-steps","aria-label":"Шаги публикации"}, s1, s2, s3, s4, ro?null:s5);
  b.append(h("div",{class:"li-grid"}, left, h("div",{class:"li-right"}, steps)));
  card.append(b); return card;
}

function liRow(x, kind){
  const when=kind==="posted"?x.posted_at:kind==="rejected"?x.rejected_at:x.created_at;
  const row=h("div",{class:"li-qrow"},
    h("div",{class:"li-qm"}, h("b",{text:plain(x.title||"Без названия")}),
      h("span",{class:"hint"}, [x.rubric, kind==="ready"?(liDays(x.created_at)<1?"готов сегодня":"лежит "+liDays(x.created_at)+" дн."):ago(when), kind==="rejected"&&x.reject_reason?("причина: "+x.reject_reason):null].filter(Boolean).join(" · "))));
  const acts=h("div",{class:"li-qa"});
  if(kind==="ready") acts.append(h("button",{type:"button",class:"btn sm",onclick:()=>{ S.liCur=x.id; renderSoon(); window.scrollTo({top:0,behavior:"smooth"}); }},"Взять сейчас"));
  if(kind==="posted" && x.post_url) acts.append(h("a",{class:"btn sm",href:x.post_url,target:"_blank",rel:"noopener noreferrer"},"Открыть ↗"));
  if(kind!=="ready" && S.owner) acts.append(h("button",{type:"button",class:"btn sm ghost",onclick:()=>liSave(x.id,{status:"ready"})},"Вернуть в готовые"));
  row.append(acts); return row;
}

function liGuide(){
  const d=h("details",{class:"li-guide"});
  try{ d.open=localStorage.getItem("dr_li_guide")==="1"; }catch(_){}
  d.addEventListener("toggle",()=>{ try{ localStorage.setItem("dr_li_guide",d.open?"1":"0"); }catch(_){} });
  const rules=[
    ["Сначала профиль","Заголовок на английском: роль и две области — например, финтех и дизайн-системы. В «Избранное» — кейс с Behance. «Открыта к работе» — в режиме «только рекрутерам»."],
    ["Ритм "+LI_GOAL+" поста в неделю","Ровный ритм работает лучше, чем пять постов за неделю и месяц тишины. Время — ср–пт, 16–19 по Москве."],
    ["Крючок до «…ещё»","Первые три строки решают, откроют ли пост. Превью слева обрывает текст там же, где LinkedIn."],
    ["Ссылка — в первом комментарии","Сразу после публикации. Текст комментария готов в шаге 4."],
    ["Первый час — на комментарии","Отвечай всем, кто написал. За неделю оставь 5–10 содержательных комментариев у дизайнеров и нанимающих лидов из компаний, куда хочешь: это приводит людей в профиль быстрее своих постов."],
    ["Раз в две недели — своя работа","Чужие разборы показывают вкус, а рекрутер ищет твой опыт: кейс CRM редакции, тренинги для коллег, дизайн-система. Такой пост можно попросить у Claude в чате."]
  ];
  d.append(h("summary",{}, h("b",{text:"Как ведём LinkedIn"}), h("span",{class:"hint",text:rules.length+" правил"})),
    h("ol",{class:"li-rules"}, ...rules.map(([t,p])=>h("li",{}, h("b",{text:t}), h("span",{text:p})))));
  return d;
}

function renderLinkedIn(){
  const m=$("#main");
  m.append(h("div",{class:"lead"}, h("div",{}, h("h2",{text:"LinkedIn"}), h("p",{text:"Твои посты для LinkedIn. Claude готовит черновик в понедельник, среду и пятницу утром — ты публикуешь сама за пять шагов."}))));
  const all=(S.li||[]).slice();
  const ready=all.filter(x=>x.status==="ready").sort((a,b)=>(a.created_at||0)-(b.created_at||0));
  const done=all.filter(x=>x.status==="posted").sort((a,b)=>(b.posted_at||0)-(a.posted_at||0));
  const rej=all.filter(x=>x.status==="rejected").sort((a,b)=>(b.rejected_at||0)-(a.rejected_at||0));
  const week=done.filter(x=>x.posted_at && Date.now()-x.posted_at<7*86400000).length;
  const next=liNextDraft();
  /* пульс */
  const dots=h("span",{class:"li-dots","aria-hidden":"true"}); for(let i=0;i<LI_GOAL;i++) dots.append(h("i",{class:i<week?"on":""}));
  const pulse=h("div",{class:"li-pulse"},
    h("div",{class:"li-kpi"}, h("small",{text:"Готово к выходу"}), h("b",{text:String(ready.length)})),
    h("div",{class:"li-kpi"}, h("small",{text:"Вышло за 7 дней"}), h("b",{}, String(week), h("span",{class:"of",text:" из "+LI_GOAL}), dots)),
    h("div",{class:"li-kpi"}, h("small",{text:"Последний пост"}), h("b",{text:done[0]?(done[0].posted_at?ago(done[0].posted_at):"давно"):"ещё не было"})),
    h("div",{class:"li-kpi"+(ready.length>=2?" warn":"")}, h("small",{text:"Следующий черновик"}), h("b",{text:ready.length>=2?"на паузе":(next?liWhen(next):"—")}),
      ready.length>=2?h("span",{class:"hint",text:"Пока лежат 2 готовых, новые не приходят — опубликуй или отклони один."}):null));
  m.append(pulse, liGuide());
  if(!ready.length){
    m.append(h("div",{class:"empty"}, logoEl("mono live"), h("b",{text:"Готовых черновиков нет"}), h("span",{text:next?"Следующий придёт "+liWhen(next)+".":"Следующий придёт в ближайший понедельник, среду или пятницу."})));
  } else {
    const cur=ready.find(x=>x.id===S.liCur)||ready[0];
    m.append(h("h3",{class:"dayh",text:"Сейчас публикуем"}), liCard(cur));
    const rest=ready.filter(x=>x!==cur);
    if(rest.length) m.append(h("h3",{class:"dayh",text:"Дальше в очереди · "+rest.length}), h("div",{class:"li-q"}, ...rest.map(x=>liRow(x,"ready"))));
  }
  const group=(name,arr,kind)=>{ if(!arr.length) return; m.append(h("details",{class:"li-hist"}, h("summary",{text:name+" · "+arr.length}), h("div",{class:"li-q"}, ...arr.slice(0,40).map(x=>liRow(x,kind))))); };
  group("Опубликовано",done,"posted"); group("Отклонено",rej,"rejected");
}
