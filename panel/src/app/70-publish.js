/* ---------- publishing ---------- */
const chanOf = a => (a&&a.channel) || (S.settings&&S.settings.channel) || CHANNEL;
/* Проверка перед выходом: пустой заголовок, пустой текст, длина, метки картинок без картинок, незакрытый жирный. */
function prePublishProblems(a){
  const p=[];
  if(!plain(a.title||"").trim()) p.push("нет заголовка");
  if(plain(a.full_text||"").trim().length<40) p.push("почти нет текста");
  if(textLength(a)>LIMIT) p.push("пост длиннее "+LIMIT+" знаков");
  const n=Math.max(0,...[...String(a.full_text||"").matchAll(/\[фото:(\d{1,2})\]/g)].map(m=>+m[1]));
  const have=(mediaOf(a).length||photoList(a).filter(Boolean).length);
  if(n>have) p.push("в тексте [фото:"+n+"], а картинок "+have);
  const fmt=lintText(String(a.full_text||""),have).filter(x=>x.kind==="fmt");
  if(fmt.length) p.push(fmt[0].msg.toLowerCase());
  p.push(...pollProblems(a.poll));
  return p;
}
function findMessageId(x, depth=0){
  if(x==null || depth>6) return 0;
  if(typeof x==="string"){ try{ return findMessageId(JSON.parse(x),depth+1);}catch{ return 0; } }
  if(typeof x!=="object") return 0;
  if(Number.isSafeInteger(x.message_id) && x.message_id>0) return x.message_id;
  for(const v of Object.values(x)){ const m=findMessageId(v,depth+1); if(m) return m; }
  return 0;
}
const PUB_TRIGGER = "trig_015jMNCGYWvjDN6b5s8MGi3R";
/* Опрос к посту (с 2.20): poll {type:"quiz"|"regular", question, options[], correct, explanation}.
   Уходит отдельным сообщением сразу после поста (sendPoll); в канале опросы всегда анонимные. */
const pollOpts = p => (p&&Array.isArray(p.options)?p.options:[]).map(o=>String(o||"").trim()).filter(Boolean);
function pollProblems(p){
  const out=[]; if(!p) return out; const opts=pollOpts(p), q=String(p.question||"").trim();
  if(!q) out.push("у опроса нет вопроса"); else if(q.length>300) out.push("вопрос опроса длиннее 300 знаков");
  if(opts.length<2) out.push("в опросе меньше двух вариантов"); if(opts.length>10) out.push("в опросе больше 10 вариантов");
  if(opts.some(o=>o.length>100)) out.push("вариант ответа длиннее 100 знаков");
  if(p.type==="quiz"){ if(!(Number.isInteger(p.correct)&&p.correct>=0&&p.correct<opts.length&&String((p.options||[])[p.correct]||"").trim())) out.push("в викторине не отмечен верный ответ");
    if(String(p.explanation||"").trim().length>200) out.push("пояснение к викторине длиннее 200 знаков"); }
  return out;
}
function pollBody(a){
  const p=a.poll, raw=(p.options||[]).map(o=>String(o||"").trim()), opts=raw.filter(Boolean);
  const b={chat_id:chanOf(a), question:String(p.question||"").trim(), options:opts.map(text=>({text})), is_anonymous:true};
  if(p.type==="quiz"){ b.type="quiz"; b.correct_option_id=raw.slice(0,p.correct).filter(Boolean).length; const ex=String(p.explanation||"").trim(); if(ex) b.explanation=ex; }
  return b;
}
async function sendPoll(a){
  const res=await mcp.callTool(MAKE, TOOL_TG, {method:"sendPoll", body:JSON.stringify(pollBody(a))});
  const raw=JSON.stringify(res.payload??res.content??""); const mid=findMessageId(res.payload??res.content);
  if(!mid) throw {message:"Telegram не вернул номер опроса: "+raw.slice(0,160)};
  await savePost(a.id,{poll_message_id:mid, poll_sent_at:Date.now(), poll_error:""});
  return mid;
}
async function sendPollNow(a){
  if(!mcp){ toast("Отправка недоступна в этом окне: открой панель в Claude."); return; }
  const pr=pollProblems(a.poll); if(pr.length){ S.errors[a.id]="Опрос не отправлен: "+pr.join(", ")+". Открой пост и поправь."; render(); return; }
  S.busy[a.id]=true; S.errors[a.id]=""; render();
  try{ await sendPoll(a); toast("Опрос отправлен в канал"); }
  catch(e){ const m=String((e&&e.message)||"попробуй ещё раз").slice(0,160); await savePost(a.id,{poll_error:m}).catch(()=>{}); S.errors[a.id]="Опрос не ушёл: "+m; }
  finally{ S.busy[a.id]=false; render(); }
}
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
  else if(a.cover_url && !a.cover_off){ const fid=await uploadByUrl(a.cover_url, a.id+"_c"); await savePost(a.id,{image_file_id:fid}); media.push({id:"cover", media:{type:"photo", media:fid}}); }
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
    const body={chat_id:chanOf(a), message_id:mid, rich_message:await buildRich(a)};
    const res=await mcp.callTool(MAKE, TOOL_TG, {method:"editMessageText", body:JSON.stringify(body)});
    const raw=JSON.stringify(res.payload??res.content??"");
    if(/"ok"\s*:\s*false|error_code/.test(raw)) throw {message:raw.slice(0,200)};
    await savePost(id,{channel_updated_at:Date.now()});
    toast("Пост в канале обновлён");
  }catch(e){ toast("Не удалось обновить: "+((e&&e.message)||"попробуй ещё раз").slice(0,160)); }
  finally{ S.busy[id]=false; render(); }
}
/* ---------- отложенная публикация через Make (с 2.21.0) ----------
   До 2.21 пост по плану выпускала задача Claude, которая после каждого выпуска сама переставляла себя на следующий
   пост. 11–13.11 цепочка дважды оборвалась на этом шаге и один раз не запустилась вовсе — посты молча не выходили.
   Теперь выпускает Make, без сессий Claude:
   • панель кладёт готовое сообщение (outbox.body и outbox.poll) в хранилище Make dr_publish_queue
     через сценарий SCN_QUEUE (действия put / cancel / ack / list);
   • сценарий «DR · Выпуск по плану» раз в час отправляет всё, чьё время пришло, и пишет в запись message_id;
   • панель при открытии и после каждого изменения плана сверяет очередь с постами (syncQueue): переносит в пост
     результат выпуска, убирает из очереди снятое с плана и докладывает то, чего в очереди нет. */
const SCN_QUEUE = 999999;
const QUEUE_LATE = 75*6e4; /* выпуск раз в час: если пост не вышел через 75 минут после своего времени, что-то сломалось */
function queueReply(x, depth=0){
  if(x==null || depth>6) return null;
  if(typeof x==="string"){ try{ return queueReply(JSON.parse(x),depth+1); }catch{ return null; } }
  if(Array.isArray(x)){ for(const v of x){ const r=queueReply(v,depth+1); if(r) return r; } return null; }
  if(typeof x!=="object") return null;
  if("q_status" in x || "q_records" in x) return x;
  for(const v of Object.values(x)){ const r=queueReply(v,depth+1); if(r) return r; }
  return null;
}
async function queueCall(data){
  if(!mcp || !SCN_QUEUE) throw {message:"очередь Make недоступна в этом окне"};
  const res=await mcp.callTool(MAKE,"scenarios_run",{scenarioId:SCN_QUEUE, responsive:true, data});
  const r=queueReply(res.payload??res.content);
  if(!r) throw {message:"Make не ответил: "+JSON.stringify(res.payload??res.content??"").slice(0,160)};
  let recs=r.q_records; if(typeof recs==="string"){ try{ recs=JSON.parse(recs||"[]"); }catch{ recs=[]; } }
  return {status:String(r.q_status||""), records:Array.isArray(recs)?recs.filter(x=>x&&typeof x==="object"):[]};
}
const mskText = ms => new Date(ms).toLocaleString("ru-RU",{timeZone:"Europe/Moscow",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})+" МСК";
/* put не перезаписывает запись, которую Make уже выпускает или выпустил: тогда вернётся её статус */
function queuePut(p){
  const ob=p.outbox||{};
  return queueCall({action:"put", post_id:p.id, title:plain(p.title||"").slice(0,120), scheduled_at:Number(p.scheduled_at)||0,
    when:mskText(p.scheduled_at), ver:Number(ob.prepared_at)||0, body:String(ob.body||""), poll:String(ob.poll||"")});
}
async function freshPost(id){ try{ const g=await db.doc("posts/"+id).get(); return g&&g.exists?{id, ...g.data(), _base:"posts"}:null; }catch{ return null; } }
async function syncQueueOnce(){
  const {records}=await queueCall({action:"list"});
  const have=new Map(records.map(r=>[String(r.post_id||r.key||""),r])); have.delete("");
  let again=false;
  for(const [id,r] of have){
    const now=Date.now(), p=await freshPost(id);
    if(r.status==="published"){
      const mid=Number(r.message_id)||0;
      if(p && p.status!=="published" && mid){
        const at=Number(r.published_at)||now;
        const patch={status:"published", published_at:at, published_message_id:mid, published_url:"https://t.me/"+chanOf(p).slice(1)+"/"+mid, publish_error:"", released_by:"make"};
        if(Number(r.poll_message_id)>0) Object.assign(patch,{poll_message_id:Number(r.poll_message_id), poll_sent_at:at, poll_error:""});
        else if(p.poll && r.poll_error) patch.poll_error=String(r.poll_error).slice(0,200);
        if(p.owner_edited && p.orig_text!=null) patch.edit_logged=false;
        await savePost(id,patch);
      }
      await queueCall({action:"ack", post_id:id});
    } else if(r.status==="failed" || (r.status==="publishing" && now-(Number(r.updated_at)||0)>20*6e4)){
      if(p && ["scheduled","publishing"].includes(p.status))
        await savePost(id,{status:"publish_unknown", publish_error:(r.status==="failed"?"Make не выпустил пост по плану":"Выпуск по плану завис")+(r.error?": "+String(r.error).slice(0,160):"")+". Проверь канал, прежде чем публиковать снова."});
      await queueCall({action:"ack", post_id:id});
    } else if(r.status==="scheduled" && !(p && p.status==="scheduled")){
      await queueCall({action:"cancel", post_id:id});
    }
  }
  const plan=S.posts.filter(p=>p.status==="scheduled" && (p._base||"posts")==="posts" && p.outbox && p.outbox.body);
  for(const p0 of plan){
    const r=have.get(p0.id);
    if(r && r.status!=="scheduled") continue;
    if(r && Number(r.scheduled_at)===Number(p0.scheduled_at) && Number(r.ver||0)===Number(p0.outbox.prepared_at||0)) continue;
    const p=await freshPost(p0.id); if(!p || p.status!=="scheduled" || !p.outbox || !p.outbox.body) continue;
    const res=await queuePut(p); if(res.status && res.status!=="scheduled") again=true;
  }
  return again;
}
let qSync=null, qMore=false, qLast=0;
/* Сверка плана с очередью Make. Запускается при открытии панели, при возврате на вкладку и после каждого изменения плана. */
function syncQueue(){
  if(!S.owner || S.test || !mcp || !SCN_QUEUE) return Promise.resolve();
  if(qSync){ qMore=true; return qSync; }
  qSync=(async()=>{
    try{ let n=0; do{ qMore=false; if(await syncQueueOnce()) qMore=true; }while(qMore && ++n<2); S.queueErr=""; }
    catch(e){ S.queueErr="Не удалось сверить план с Make: "+String((e&&e.message)||"ошибка").slice(0,140)+". Обнови панель через пару минут."; }
    finally{ qSync=null; qLast=Date.now(); renderSoon(); }
  })();
  return qSync;
}
window.__dr=Object.assign(window.__dr||{},{syncQueue}); /* для автопроверки */
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible" && S.ready && Date.now()-qLast>10*6e4) syncQueue(); });
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
function nextFree(ms,exceptId){ let t=ms; for(let i=0;i<96&&slotConflict(t,exceptId);i++) t+=60*6e4; return t; }
/* Make выпускает посты раз в час, в начале часа: время выхода округляем до часа вперёд */
const toHour = ms => Math.ceil(ms/36e5)*36e5;
function schedPicker(a){
  const now=Date.now(); let val=a.scheduled_at&&a.scheduled_at>now?a.scheduled_at:(at(0,18)>now+15*6e4?at(0,18):at(1,10));
  const inp=h("input",{type:"datetime-local",value:localInput(val),min:localInput(toHour(now+5*6e4)),step:3600,"aria-label":"Дата и время выхода"});
  const chips=h("div",{class:"chips"});
  const opts=[["Сегодня 18:00",at(0,18)],["Завтра 10:00",at(1,10)],["Завтра 14:00",at(1,14)],["Завтра 18:00",at(1,18)],["Послезавтра 10:00",at(2,10)]].filter(o=>o[1]>now+5*6e4);
  if(slotConflict(val,a.id)) val=nextFree(val,a.id); inp.value=localInput(val);
  const warn=h("div",{class:"hint slotwarn"});
  const check=()=>{ const ms=toHour(new Date(inp.value).getTime()); const c=ms&&slotConflict(ms,a.id); warn.textContent=c?"Занято: «"+c.title.slice(0,50)+"» ("+authorName(c.author)+") выходит "+whenText(c.ms)+". Между постами нужен час — ближайшее свободное: "+whenText(nextFree(ms,a.id))+".":""; warn.classList.toggle("bad",!!c); return !c; };
  inp.addEventListener("input",check);
  opts.forEach(([t,ms])=>{ const c=slotConflict(ms,a.id); const b=h("button",{type:"button",class:"btn sm chip"+(ms===val?" on":""),disabled:!!c,title:c?"Занято: "+c.title+" — "+authorName(c.author):""},c?t+" · занято":t);
    b.addEventListener("click",()=>{ inp.value=localInput(ms); [...chips.children].forEach(x=>x.classList.remove("on")); b.classList.add("on"); check(); }); chips.append(b); });
  const taken=takenSlots(a.id).filter(t=>t.ms>now).sort((x,y)=>x.ms-y.ms).slice(0,6);
  const takenBox=taken.length?h("div",{class:"taken"}, h("span",{class:"hint",text:"Уже в плане:"}), ...taken.map(t=>h("span",{class:"tk",text:whenText(t.ms)+" · "+authorName(t.author)}))):null;
  const busy=!!S.busy[a.id];
  const hourHint=S.owner?h("div",{class:"hint",text:"Посты выходят в начале часа: 14:20 станет 15:00."}):null;
  return h("div",{class:"sched"}, panelHead("Когда выпустить?",()=>{S.sched=null;render();}), chips, inp, hourHint, warn, takenBox,
    h("div",{class:"amain"}, h("button",{class:"btn accent",disabled:busy,onclick:()=>{ const ms=S.owner?toHour(new Date(inp.value).getTime()):new Date(inp.value).getTime(); if(!ms||ms<Date.now()+2*6e4){ toast("Выбери время хотя бы на 2 минуты вперёд"); return; } if(!check()){ toast("Это время уже занято другим постом"); return; } scheduleAt(a,ms); }},busy?"Готовлю…":"Запланировать"),
      h("button",{class:"btn",onclick:()=>{S.sched=null;render();}},"Отмена")));
}
let preparing=false;
async function prepareEditorPosts(){
  if(!S.owner || !mcp || preparing) return;
  const list=S.posts.filter(p=>p.status==="scheduled" && p.needs_prepare);
  if(!list.length) return;
  preparing=true;
  try{ for(const a of list){ try{ const outbox=await prepareOutbox(a); await savePost(a.id,{outbox, needs_prepare:false}); }catch(e){ await savePost(a.id,{publish_error:"Не удалось подготовить пост редактора: "+String(e&&e.message||"ошибка").slice(0,120)}).catch(()=>{}); } }
    syncQueue(); }
  finally{ preparing=false; }
}
async function prepareOutbox(a){
  const body={chat_id:chanOf(a), rich_message:await buildRich(a)};
  /* опрос сценарий выпуска по плану отправит сразу после поста */
  return {body:JSON.stringify(body), ...(a.poll?{poll:JSON.stringify(pollBody(a))}:{}), prepared_at:Date.now()};
}
const myEd=()=>S.me&&S.editors[S.me]||{};
const canPub=a=>S.owner || (!!myEd().can_publish && !S.paused && (a.author||"")===S.me);
async function scheduleAt(a, ms){
  { const pr=prePublishProblems(a); if(pr.length){ S.errors[a.id]="Не планирую: "+pr.join(", ")+". Открой пост и поправь."; render(); return; } }
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
    const put=await queuePut({...a, status:"scheduled", scheduled_at:ms, outbox});
    if(put.status && put.status!=="scheduled") throw {message:"Make уже выпускает этот пост — проверь канал"};
    S.sched=null; toast("Запланировано: "+whenText(ms)); syncQueue();
  }catch(e){
    await savePost(a.id,{status:"review"}).catch(()=>{});
    const code=e&&e.code;
    S.errors[a.id]=(code==="approval_required"||code==="not_granted")?"Разреши панели доступ к Make и нажми ещё раз.":"Не удалось запланировать"+(e&&e.message?": "+String(e.message).slice(0,160):"")+".";
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
  { const pr=prePublishProblems(a); if(pr.length){ S.errors[a.id]="Не публикую: "+pr.join(", ")+". Открой пост и поправь."; render(); return; } }
  S.busy[a.id]=true; S.errors[a.id]=""; S.confirm=null; render();
  try{ a=await adoptPost(a); }catch(e){ S.busy[a.id]=false; S.errors[a.id]="Не удалось забрать пост автора в общую ленту."; render(); return; }
  let sent=false;
  try{
    const body={chat_id:chanOf(a), rich_message:await buildRich(a)};
    await savePost(a.id,{status:"publishing", publish_error:""});
    const res=await mcp.callTool(MAKE, TOOL_TG, {method:"sendRichMessage", body:JSON.stringify(body)});
    sent=true;
    const raw=JSON.stringify(res.payload??res.content??"");
    const mid=findMessageId(res.payload??res.content);
    if(!mid){ await savePost(a.id,{status:"publish_unknown", publish_error:"Make ответил без номера сообщения: "+raw.slice(0,200)}); toast("Проверь канал: ответ Telegram неясный"); return; }
    const patch={status:"published", published_at:Date.now(), published_message_id:mid, published_url:"https://t.me/"+chanOf(a).slice(1)+"/"+mid};
    if(a.owner_edited && a.orig_text!=null) patch.edit_logged=false;
    await savePost(a.id,patch);
    toast("Опубликовано в канал");
    if(a.poll){ try{ await sendPoll(a); toast("Пост и опрос — в канале"); }
      catch(pe){ const m=String((pe&&pe.message)||"ошибка").slice(0,160); await savePost(a.id,{poll_error:m}).catch(()=>{}); S.errors[a.id]="Пост вышел, а опрос не ушёл ("+m+"). Нажми «Отправить опрос»."; } }
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

