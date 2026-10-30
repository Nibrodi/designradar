/* ---------- editor ---------- */
let editing=null;
function newPost(prefill={}){
  if(!S.canWrite) return;
  if(S.paused){ toast("Колонка на паузе — новые посты сейчас недоступны"); return; }
  const ref=S.owner?postsCol().doc():authorCol(S.me).doc();
  const now=Date.now();
  const lb=prefill.label||"Крафт"; const a={title:prefill.title||"", cover_title:prefill.title||"", label:lb, section:lb, kind:"original", full_text:"", hashtags:[], photos:[], status:"draft", author:S.me||"", created_at:now, updated_at:now, idea:prefill.idea||null};
  ref.set(a).then(()=>{ if(prefill.idea) ideasCol().doc(prefill.idea).update({status:"taken"}); const tryOpen=n=>{ if(S.posts.some(p=>p.id===ref.id)) openEditor(ref.id); else if(n<40) setTimeout(()=>tryOpen(n+1),100); else toast("Черновик создан — открой его во вкладке «Черновики»"); }; tryOpen(0); });
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

