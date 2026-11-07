/* ---------- «Настроить вид»: главный редактор двигает отступы и размеры, видно сразу ---------- */
const DS=[
  ["Шапка",[["--hdr","Высота шапки",44,68,1,52,"px"],["--logo","Логотип",20,40,1,28,"px"],["--brand-fs","Название канала",14,24,.5,18,"px"]]],
  ["Отступы",[["--g","Поля по краям",8,28,1,16,"px"],["--sec-gap","Между блоками",6,32,1,16,"px"],["--card-gap","Между карточками",4,28,1,12,"px"]]],
  ["Карточки",[["--card-pad","Внутренний отступ",10,26,1,16,"px"],["--card-r","Скругление",0,32,1,18,"px"],["--btn-h","Высота кнопок",36,56,1,44,"px"]]],
  ["Заголовок раздела",[["--h2-fs","Размер",20,40,1,28,"px"]]],
  ["Нижняя панель",[["--tab-h","Высота",44,68,1,52,"px"],["--tab-fs","Подписи",9,13,.5,10.5,"px"],["--tab-pb","Отступ под кнопками",0,48,1,26,"px"]]],
  ["Края экрана в приложении Claude",[["--top-lift","Отступ сверху (редактор, меню)",0,60,1,24,"px"]]]
];
const DS_KEYS=DS.flatMap(g=>g[1].map(r=>r[0]));
function applyDesign(d){ const st=document.documentElement.style; for(const k of DS_KEYS){ if(d&&d[k]!=null) st.setProperty(k,d[k]); else st.removeProperty(k); } if(d&&d["--sub-show"]) st.setProperty("--sub-show",d["--sub-show"]); else st.removeProperty("--sub-show"); }
function savedDesign(){ return (S.settings&&S.settings.design)||{}; }
function openDesign(){
  if(!S.realOwner){ toast("Вид настраивает главный редактор"); return; }
  let ov=document.getElementById("dsov"); if(ov) ov.remove();
  const base=savedDesign(); const cur={...base};
  const close=(revert)=>{ if(revert) applyDesign(base); ov.remove(); };
  const cs=getComputedStyle(document.documentElement);
  const body=h("div",{class:"dsbody"});
  for(const [grp,rows] of DS){
    body.append(h("div",{class:"dsgrp",text:grp}));
    for(const [k,label,min,max,step,def,unit] of rows){
      const v=parseFloat(cur[k]??cs.getPropertyValue(k))||def;
      const out=h("output",{text:v+unit});
      const r=h("input",{type:"range",min,max,step,value:v,"aria-label":label});
      r.addEventListener("input",()=>{ cur[k]=r.value+unit; out.textContent=r.value+unit; applyDesign(cur); });
      body.append(h("div",{class:"dsrow"}, h("label",{text:label}), out, r));
    }
  }
  const sub=h("input",{type:"checkbox"}); sub.checked=(cur["--sub-show"]||"-webkit-box")!=="none";
  sub.addEventListener("change",()=>{ cur["--sub-show"]=sub.checked?"-webkit-box":"none"; applyDesign(cur); });
  body.append(h("label",{class:"dschk"}, sub, "Пояснение под заголовком раздела"));
  const box=h("div",{class:"dsbox",role:"dialog","aria-label":"Настроить вид"});
  const minBtn=h("button",{type:"button",class:"btn sm",onclick:()=>{ box.classList.toggle("dsmin"); minBtn.textContent=box.classList.contains("dsmin")?"Развернуть":"Свернуть"; }},"Свернуть");
  box.append(h("div",{class:"phead"}, h("span",{text:"Настроить вид"}), minBtn, closeX(()=>close(true))),
    h("p",{class:"hint",text:"Двигай ползунки — панель меняется сразу. Окно можно свернуть, чтобы посмотреть страницу целиком."}), body,
    h("div",{class:"dsacts"},
      h("button",{type:"button",class:"btn",onclick:async()=>{ for(const k of [...DS_KEYS,"--sub-show"]) delete cur[k]; applyDesign(cur); try{ await db.doc("settings/main").set({...(S.settings||{}), design:{}, updated_at:Date.now()}); toast("Вернула вид по умолчанию"); close(false); }catch(_){ toast("Не удалось сохранить"); } }},"Сбросить"),
      h("button",{type:"button",class:"btn accent",onclick:async()=>{ try{ await db.doc("settings/main").set({...(S.settings||{}), design:cur, updated_at:Date.now()}); toast("Вид сохранён для всех редакторов"); close(false); }catch(_){ toast("Не удалось сохранить"); } }},"Сохранить")));
  ov=h("div",{id:"dsov",class:"dsov"}, box);
  ov.addEventListener("keydown",e=>{ if(e.key==="Escape") close(true); });
  document.body.append(ov);
}
