/* ---------- «Отклонить»: спрашиваем почему и учимся на ответе ---------- */
const REJECT_TAGS=["Ахинея в тексте","Скучно и сухо","Не мой тон","Сомнительные факты","Шаблонно, как у робота","Слишком длинно","Тема не наша","Повтор темы","Плохая обложка"];
function openReject(a){
  let ov=document.getElementById("rjov"); if(ov) ov.remove();
  const close=()=>ov.remove();
  const tags=new Set();
  const chips=h("div",{class:"rjchips"}, ...REJECT_TAGS.map(t=>{ const b=h("button",{type:"button",class:"rjchip","aria-pressed":"false",onclick:()=>{ tags.has(t)?tags.delete(t):tags.add(t); b.classList.toggle("on",tags.has(t)); b.setAttribute("aria-pressed",tags.has(t)?"true":"false"); }},t); return b; }));
  const why=h("textarea",{rows:3,placeholder:"Что именно не так? Например: «тема огонь, но текст — пересказ документации без мысли»","aria-label":"Почему отклоняешь"});
  const again=h("input",{type:"checkbox",id:"rjAgain"});
  const st=h("div",{class:"hint"});
  const go=h("button",{type:"button",class:"btn danger-fill",onclick:async()=>{
    const reason=why.value.trim(), list=[...tags];
    go.disabled=true;
    try{
      await savePost(a.id,{status:"rejected", rejected_at:Date.now(), rejected_by:S.me||"", reject_tags:list, reject_reason:reason, reject_learned:false, rewrite_requested:again.checked});
      if(again.checked){
        await ideasCol().add({text:plain(a.title).slice(0,140), angle:"Написать заново: прошлый текст отклонён. Причина: "+(list.join(", ")||"—")+(reason?". "+reason:""), rubric:a.label||a.section||"", author:S.me||"", status:"requested", requested_by:S.me||"", requested_at:Date.now(), created_at:Date.now(), rewrite_of:a.id, avoid:{tags:list, reason}});
      }
      close(); toast(again.checked?"Отклонено. Claude напишет на эту тему заново с учётом причины":"Отклонено. Учту причину в следующих постах");
    }catch(e){ go.disabled=false; st.textContent="Не удалось сохранить. Попробуй ещё раз."; }
  }},"Отклонить");
  const skip=h("button",{type:"button",class:"btn",onclick:async()=>{ try{ await savePost(a.id,{status:"rejected", rejected_at:Date.now(), rejected_by:S.me||""}); close(); toast("Отклонено"); }catch(_){ st.textContent="Не удалось сохранить."; } }},"Без причины");
  const box=h("div",{class:"rjbox",role:"dialog","aria-label":"Почему отклоняешь"},
    panelHead("Почему отклоняешь?",close),
    h("p",{class:"rjpost",text:plain(a.title)}),
    chips, why,
    h("label",{class:"rjagain",for:"rjAgain"}, again, h("span",{}, h("b",{text:"Тема хорошая — напиши заново"}), h("small",{text:"Claude напишет новый пост на эту тему с учётом причины, он придёт в «Ревью»"}))),
    st, h("div",{class:"rjacts"}, skip, go));
  ov=h("div",{id:"rjov",class:"npov",onclick:e=>{ if(e.target===ov) close(); }}, box);
  ov.addEventListener("keydown",e=>{ if(e.key==="Escape") close(); });
  document.body.append(ov); why.focus({preventScroll:true});
}
