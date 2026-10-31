/* ---------- Telegram-style preview ---------- */
function tgPreview(a){
  const box=h("div",{class:"tg"});
  if(!a.cover_off && (a.image_file_id || a.cover_url || isRendered(a))) box.append(coverMock(a));
  const tx=h("div",{class:"tx"});
  const med=mediaOf(a);
  const html=richHtml(a).replace(/<img src="tg:\/\/photo\?id=p(\d+)"\/>/g,(m,n)=>{ const it=med[Number(n)-1]; return it?'<img class="mi" alt="'+esc(it.caption||("фото "+n))+'" src="'+esc(it.url)+'"/>':'<div class="ph">фото '+n+' · превью нет</div>'; }).replace(/<hr\/><footer>/,'<div class="ft">').replace(/<\/footer>$/,"</div>");
  tx.innerHTML=html; // built from escaped text only
  box.append(tx);
  return box;
}

