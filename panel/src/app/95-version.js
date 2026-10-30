/* ---------- версия панели и «Что нового» ---------- */
function seenVersion(){ try{ return localStorage.getItem("dr_seen_version")||""; }catch(_){ return ""; } }
function showChanges(){
  try{ localStorage.setItem("dr_seen_version",APP_VERSION); }catch(_){}
  drawVersionChip();
  const close=()=>ov.remove();
  const ov=h("div",{class:"wnov",onclick:e=>{ if(e.target===ov) close(); }});
  const box=h("div",{class:"wnbox",role:"dialog","aria-label":"Что нового"}, panelHead("Что нового",close),
    ...CHANGES.map(c=>h("section",{class:"wnv"}, h("div",{class:"wnh"}, h("b",{text:"Версия "+c.v}), h("span",{text:c.date})), h("ul",{}, ...c.items.map(t=>h("li",{text:t}))))));
  ov.append(box); document.body.append(ov);
  ov.addEventListener("keydown",e=>{ if(e.key==="Escape") close(); }); box.querySelector("button")?.focus();
}
function drawVersionChip(){
  const sub=document.querySelector(".brand .sub"); if(!sub) return;
  let b=document.getElementById("verChip");
  if(!b){ b=h("button",{type:"button",id:"verChip",class:"verchip",title:"Что нового",onclick:showChanges}); sub.after(b); }
  const fresh=seenVersion()!==APP_VERSION;
  b.replaceChildren(h("span",{text:"v"+APP_VERSION}), fresh?h("i",{class:"vdot","aria-label":"новое"}):null);
}
setTimeout(drawVersionChip,0);
