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
  const setSt=(v,msg)=>db.doc("editors/"+id).set({...ed,status:v,status_at:Date.now()}).then(()=>toast(msg));
  if(status!=="removed") acts.append(h("button",{type:"button",class:"btn sm"+(ed.can_publish?" on":""),"aria-pressed":ed.can_publish?"true":"false",onclick:()=>db.doc("editors/"+id).set({...ed,can_publish:!ed.can_publish,updated_at:Date.now()}).then(()=>toast(ed.can_publish?"Теперь посты редактора идут тебе на согласование":"Редактор может публиковать сам: Claude выпускает его посты раз в час"))},ed.can_publish?"✓ Публикует сам":"Разрешить публиковать"));
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
  if(S.owner || !S.me || S.me===TEST_ID || !user) return;
  let code=S.inviteCode; if(!code){ try{ code=localStorage.getItem("dr_invite")||""; }catch(_){} }
  if(!code) return;
  const inv=S.invites.find(i=>i.id===code && i.status==="sent"); if(!inv) return;
  try{ localStorage.removeItem("dr_invite"); }catch(_){}
  try{ await db.collection("invites").doc(inv.id).update({status:"joined", user_id:S.me, joined_at:Date.now()});
    const ed=S.editors[S.me]||{}; const pre={}; if(!ed.column && inv.column) pre.column=inv.column; if(!ed.channels && inv.channel) pre.channels=[inv.channel]; if(!ed.sign && inv.name) pre.sign=inv.name;
    if(Object.keys(pre).length) await db.doc("editors/"+S.me).set({...ed, ...pre, invited_by:inv.by||"", updated_at:Date.now()}); }catch(_){}
}
function applyBlock(){
  const ed=S.me&&S.editors[S.me]; const st=!S.owner&&ed&&ed.status;
  S.blocked=(st==="removed"||st==="paused")?st:null;
  if(S.blocked==="paused"){ S.blocked=null; S.paused=true; } else S.paused=false;
  if(st==="removed") S.canWriteEff=false; else if(S.paused) S.canWriteEff=false; else S.canWriteEff=null;
}

