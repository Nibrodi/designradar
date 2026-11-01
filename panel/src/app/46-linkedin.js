/* ---------- LinkedIn: черновики постов на двух языках, Екатерина публикует сама ---------- */
const liCol=()=>db.collection("linkedin");
const LI_UI={};   /* id → {lang, dirty, en, ru, mode} — локальное состояние карточек */
const LI_ICO='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5v6M8 7.5v.01M12 16.5v-6M12 13c0-1.5 1-2.5 2.3-2.5S16.5 11.3 16.5 13v3.5"/></svg>';
function liWatch(){ try{ liCol().onSnapshot(sn=>{ S.li=sn.docs.map(d=>({id:d.id,...d.data()})); if(S.owner) render(); },()=>{}); }catch(_){} }
const liReady=()=>(S.li||[]).filter(x=>x.status==="ready");
function liSave(id,patch){ return liCol().doc(id).update({...patch, updated_at:Date.now()}).catch(e=>{ toast("Не сохранилось: "+((e&&e.message)||"ошибка базы")); throw e; }); }

async function liDownload(x,btn,out){
  const ph=(x.photos||[]).filter(p=>p&&/^https:\/\//.test(p.url||""));
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
    out.textContent=n===1?"Фото сохранено.":"Сохранено фото: "+n+".";
  }catch(e){ out.textContent=(e&&e.code==="not_granted")?"Разреши панели сохранять файлы и запускать Make, потом нажми ещё раз.":"Не получилось: "+((e&&e.message)||"ошибка")+". Открой фото по ссылке и сохрани вручную."; }
  finally{ btn.disabled=false; if(Object.keys(pa).length!==Object.keys(x.photo_assets||{}).length) liSave(x.id,{photo_assets:pa}).catch(()=>{}); }
}

function liCard(x){
  const ui=LI_UI[x.id]||(LI_UI[x.id]={lang:"en",dirty:false,mode:null});
  if(!ui.dirty){ ui.en=x.text_en||""; ui.ru=x.text_ru||""; }
  const card=h("article",{class:"card licard"}); const b=h("div",{class:"body"});
  const st={ready:"готов к публикации",posted:"опубликован",rejected:"отклонён"}[x.status]||x.status;
  const meta=h("div",{class:"meta"}, h("span",{class:"status "+(x.status==="posted"?"published":x.status==="rejected"?"rejected":"review"),text:st}), x.rubric?h("span",{class:"label",text:x.rubric}):null, h("span",{text:ago(x.posted_at||x.created_at)}));
  if(x.check && x.status==="ready") meta.append(h("span",{class:"chk",title:x.check},h("span",{class:"chk-i","aria-hidden":"true",text:"!"}),"проверить"));
  b.append(meta, h("h3",{text:plain(x.title||"Без названия")}));
  if(x.check && x.status==="ready") b.append(h("div",{class:"hint li-check",text:"Проверить: "+x.check}));

  /* язык и текст */
  const seg=h("div",{class:"seg li-lang",role:"group","aria-label":"Язык"});
  const ta=h("textarea",{class:"li-text","data-li":x.id,rows:"12","aria-label":"Текст поста",readonly:S.owner?null:true});
  const cnt=h("div",{class:"hint li-cnt"});
  const save=h("button",{type:"button",class:"btn sm primary",style:ui.dirty?null:"display:none",onclick:async()=>{ await liSave(x.id,{text_en:ui.en,text_ru:ui.ru,edited:true}); ui.dirty=false; save.style.display="none"; toast("Сохранено"); }},"Сохранить правки");
  const fill=()=>{ ta.value=ui.lang==="en"?ui.en:ui.ru; const t=ta.value; const first=t.split("\n").slice(0,3).join(" ").slice(0,210);
    cnt.textContent=t.length+" / 3000 знаков"+(t.length>3000?" — LinkedIn не примет, сократи":"")+" · до «…ещё» видно: «"+first+(t.length>210?"…":"")+"»";
    [...seg.children].forEach(c=>c.setAttribute("aria-pressed",String(c.dataset.l===ui.lang))); };
  [["en","English"],["ru","Русский"]].forEach(([l,n])=>seg.append(h("button",{type:"button","data-l":l,onclick:()=>{ ui.lang=l; fill(); }},n)));
  ta.addEventListener("input",()=>{ if(ui.lang==="en") ui.en=ta.value; else ui.ru=ta.value; ui.dirty=true; save.style.display=""; fill(); });
  fill();
  const both=()=>ui.en.trim()+"\n\n—\n\n"+ui.ru.trim();
  b.append(seg, ta, cnt, h("div",{class:"acts li-copy"},
    h("button",{type:"button",class:"btn sm",onclick:()=>copyText(ui.lang==="en"?ui.en:ui.ru)},"Скопировать этот"),
    h("button",{type:"button",class:"btn sm",onclick:()=>copyText(both())},"Скопировать EN + RU"), save));
  if((x.hashtags||[]).length) b.append(h("div",{class:"hint",text:(x.hashtags||[]).join(" ")}));

  /* фото */
  const ph=(x.photos||[]).filter(p=>p&&/^https:\/\//.test(p.url||""));
  if(ph.length){
    const pa=x.photo_assets||{}; const out=h("div",{class:"hint"});
    const list=h("div",{class:"li-photos"}); ph.forEach((p,i)=>{ const a=pa[p.url];
      list.append(h("div",{class:"li-ph"}, a?h("img",{src:R_LOCAL.get(a)||a,alt:p.caption||"",loading:"lazy"}):h("div",{class:"li-ph0",text:String(i+1)}),
        h("div",{class:"li-phc"}, h("span",{text:p.caption||("Фото "+(i+1))}), h("a",{href:p.url,target:"_blank",rel:"noopener noreferrer",class:"srclink"},"открыть ↗")))); });
    const dl=h("button",{type:"button",class:"btn sm",onclick:e=>liDownload(x,e.currentTarget,out)},"Скачать фото"+(ph.length>1?" ("+ph.length+")":""));
    b.append(h("div",{class:"li-sec",text:"Фото"}), list, h("div",{class:"acts"}, dl), out,
      h("div",{class:"hint",text:"Скачивание забирает фото через Make: 1 операция на фото, один раз — потом оно хранится в панели."}));
  }
  if(x.source_url&&/^https:\/\//.test(x.source_url)) b.append(h("div",{class:"hint"},"Источник: ",h("a",{href:x.source_url,target:"_blank",rel:"noopener noreferrer",class:"srclink"},x.source_name||"страница ↗")));

  /* действия */
  if(S.owner){
    const acts=h("div",{class:"cacts"}); const main=h("div",{class:"amain"}), sub=h("div",{class:"asub"});
    if(ui.mode==="posted"){
      const inp=h("input",{type:"url",placeholder:"Ссылка на пост в LinkedIn (необязательно)","aria-label":"Ссылка на пост"});
      acts.append(h("div",{class:"confirm"}, inp, h("div",{class:"amain"},
        h("button",{class:"btn accent",onclick:async()=>{ const u=inp.value.trim(); await liSave(x.id,{status:"posted",posted_at:Date.now(),...(/^https:\/\//.test(u)?{post_url:u}:{}),...(ui.dirty?{text_en:ui.en,text_ru:ui.ru,edited:true}:{})}); ui.mode=null; ui.dirty=false; toast("Отмечено как опубликованное"); }},"Готово"),
        h("button",{class:"btn",onclick:()=>{ ui.mode=null; render(); }},"Отмена"))));
    } else if(ui.mode==="reject"){
      const inp=h("input",{type:"text",placeholder:"Почему не подходит — Claude учтёт в следующих","aria-label":"Причина"});
      acts.append(h("div",{class:"confirm"}, inp, h("div",{class:"amain"},
        h("button",{class:"btn danger",onclick:async()=>{ await liSave(x.id,{status:"rejected",rejected_at:Date.now(),reject_reason:inp.value.trim()}); ui.mode=null; toast("Отклонён"); }},"Отклонить"),
        h("button",{class:"btn",onclick:()=>{ ui.mode=null; render(); }},"Отмена"))));
    } else if(x.status==="ready"){
      main.append(h("button",{class:"btn accent",onclick:()=>{ ui.mode="posted"; render(); }},"Опубликовала в LinkedIn"));
      sub.append(h("button",{type:"button",class:"btn danger",onclick:()=>{ ui.mode="reject"; render(); }},"Отклонить"));
    } else {
      if(x.post_url) main.append(h("a",{class:"btn",href:x.post_url,target:"_blank",rel:"noopener noreferrer"},"Открыть в LinkedIn ↗"));
      if(x.reject_reason) b.append(h("div",{class:"hint",text:"Причина: "+x.reject_reason}));
      sub.append(h("button",{type:"button",class:"btn",onclick:()=>liSave(x.id,{status:"ready"})},"Вернуть в готовые"));
    }
    if(main.childNodes.length||sub.childNodes.length) acts.append(main,sub);
    b.append(acts);
  }
  card.append(b); return card;
}

function renderLinkedIn(){
  const m=$("#main");
  m.append(h("div",{class:"lead"}, h("div",{}, h("h2",{text:"LinkedIn"}), h("p",{text:"Черновики постов для твоего LinkedIn: разборы, шрифты, брендинг, интерфейсы, паттерны и исследования. Claude готовит их в понедельник, среду и пятницу к 9:30 на английском и русском. Скопируй текст, скачай фото и опубликуй сама, потом отметь здесь."}))));
  const all=(S.li||[]).slice().sort((a,b)=>(b.created_at||0)-(a.created_at||0));
  const ready=all.filter(x=>x.status==="ready"), done=all.filter(x=>x.status==="posted"), rej=all.filter(x=>x.status==="rejected");
  if(!ready.length) m.append(h("div",{class:"empty"},h("b",{text:"Готовых черновиков нет"}),h("span",{text:"Следующие появятся в ближайший понедельник, среду или пятницу утром."})));
  else { const f=h("div",{class:"feed"}); ready.forEach(x=>f.append(liCard(x))); m.append(f); }
  const group=(name,arr)=>{ if(!arr.length) return; const f=h("div",{class:"feed"}); arr.slice(0,30).forEach(x=>f.append(liCard(x))); m.append(h("details",{class:"li-more"},h("summary",{text:name+" · "+arr.length}),f)); };
  group("Опубликованы",done); group("Отклонены",rej);
}
