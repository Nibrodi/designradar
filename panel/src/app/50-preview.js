/* ---------- Telegram-style preview ---------- */
function tgPreview(a){
  const box=h("div",{class:"tg"});
  if(!a.cover_off && (a.image_file_id || a.cover_url || isRendered(a))) box.append(coverMock(a));
  const tx=h("div",{class:"tx"});
  const med=mediaOf(a);
  const html=richHtml(a).replace(/<img src="tg:\/\/photo\?id=p(\d+)"\/>/g,(m,n)=>{ const it=med[Number(n)-1]; if(it && needsImport(a,it.url)) return '<div class="ph">фото '+n+' · '+(PH_ERR.has(it.url)?'не перенеслось из источника, в Telegram загрузится при публикации':'переношу из источника…')+'</div>'; return it?'<img class="mi" alt="'+esc(it.caption||("фото "+n))+'" src="'+esc(photoSrc(a,it.url))+'"/>':'<div class="ph">фото '+n+' · превью нет</div>'; }).replace(/<hr\/><footer>/,'<div class="ft">').replace(/<\/footer>$/,"</div>");
  tx.innerHTML=html; // built from escaped text only
  box.append(tx);
  if(a.poll && pollOpts(a.poll).length){ const p=a.poll, quiz=p.type==="quiz", raw=(p.options||[]).map(o=>String(o||"").trim());
    box.append(h("div",{class:"tgpoll"}, h("b",{text:String(p.question||"").trim()||"Вопрос опроса"}), h("span",{class:"pt",text:quiz?"Анонимная викторина · отдельным сообщением":"Анонимный опрос · отдельным сообщением"}),
      ...raw.map((o,i)=>o?h("div",{class:"po"+(quiz&&i===p.correct?" ok":"")}, h("i",{"aria-hidden":"true"}), h("span",{text:o})):null).filter(Boolean))); }
  return box;
}

