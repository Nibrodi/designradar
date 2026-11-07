/* ---------- formatting (same rules as the channel) ---------- */
const fmt = v => esc(v)
  .replace(/\[([^\]\n]+)\]\((https?:\/\/(?:[^\s()"'<>]|\([^\s()"'<>]*\))+)\)/g,'<a href="$2">$1</a>')
  .replace(/\*\*([^*\n]+)\*\*/g,"<b>$1</b>")
  .replace(/(^|[^_\w])__([^_\n]+)__(?![_\w])/g,"$1<i>$2</i>");
const photoList = a => (Array.isArray(a.photos)?a.photos:[]).slice(0,9).map(p=>String(typeof p==="string"?p:(p&&(p.file_id||p.id))||"").trim()).map(f=>/^[A-Za-z0-9_-]{10,300}$/.test(f)?f:"");
const tagsOf = a => Array.isArray(a.hashtags)?a.hashtags.join(" "):String(a.hashtags||"");
const mediaOf = a => Array.isArray(a.media)?a.media.filter(m=>m&&m.url&&!(m.gen&&(a.layout==="cover"||a.layout==="none"))):[];
const LAYOUTS=[["cover","Обложка"],["carousel","Карусель"],["both","Обложка + карусель"],["none","Только текст"]];
function layoutOf(a){ if(a.layout) return a.layout; const gen=(a.media||[]).some(m=>m&&m.gen)||!!a.carousel; if(a.cover_off) return gen?"carousel":"none"; if(gen) return (a.cover_render===false&&!a.image_file_id)?"carousel":"both"; return "cover"; }
function adviseLayout(a){
  const t=String(a.full_text||""); const lab=String(a.label||a.section||"");
  const items=t.split("\n").filter(l=>/^\s*([–—•-]|\d+[.)])\s+/.test(l)).length, heads=(t.match(/^##\s+/gm)||[]).length;
  const photos=(a.media||[]).filter(m=>m&&!m.gen).length;
  if(/Мем/.test(lab)) return {layout:"cover",why:"Мем — одна картинка: обложка и есть шутка."};
  if(/Вакансии/.test(lab)) return {layout:"cover",why:"Подборку вакансий читают текстом и переходят по ссылкам — карусель только помешает."};
  if(a.kind==="news" && photos) return {layout:"cover",why:"Новость с фото: обложка задаёт тему, фото проекта стоят в тексте."};
  if(a.kind==="news") return {layout:"cover",why:"Новость читают быстро — хватит обложки с тезисом."};
  if(/Чек-лист/i.test(lab) || items>=4 || heads>=4) return {layout:"carousel",why:"В посте "+Math.max(items,heads,4)+" параллельных пунктов — их удобно листать и сохранять карточками. Первая карточка работает как обложка."};
  if(items>=3 || heads>=3) return {layout:"both",why:"Есть тезис и 3 пункта: обложка цепляет в ленте, карусель раскладывает пункты."};
  return {layout:"cover",why:"Один тезис и пример — сильная обложка работает лучше карусели."};
}
const imgSlots = a => { const m=mediaOf(a); return m.length? m.map(x=>x.file_id||"pending"): photoList(a); };
function richHtml(a, slots){
  const content=["<b>"+esc(plain(a.title))+"</b>"];
  const body=String(a.full_text||"").replace(/\r\n?/g,"\n").trim();
  if(body){
    const lines=body.split("\n").map(line=>{
      const ph=line.trim().match(/^\[(?:фото|photo)\s*:?\s*(\d{1,2})\]$/i);
      if(ph) return "@@IMG"+ph[1]+"@@";
      const hd=line.match(/^#{2,3}\s+(.+)$/);
      return hd?"<b>"+fmt(hd[1]).replace(/<\/?b>/g,"")+"</b>":fmt(line);
    });
    content.push(lines.join("<br/>"));
  }
  const footer=[];
  if(a.kind!=="original" && a.source) footer.push("Источник: "+esc(a.source));
  if(a.kind!=="original" && a.url){ const u=String(a.url).trim(); footer.push(/^https?:\/\/[^\s"'<>]+$/i.test(u)?'<a href="'+esc(u)+'">Открыть первоисточник ↗</a>':esc(u)); }
  const tags=tagsOf(a); if(tags) footer.push(esc(tags));
  const photos=slots||imgSlots(a), used=new Set();
  let html="<p>"+content.join("<br/><br/>")+"</p>";
  const carTop=a.carousel && a.carousel.top!==false && (a.layout==="carousel"||a.layout==="both"||!a.layout);
  html=html.replace(/(?:<br\/>)*@@IMG(\d+)@@(?:<br\/>)*/g,(m,k)=>{const n=Number(k); if(!photos[n-1]||carTop) return carTop?"<br/><br/>":""; used.add(n); return '</p><img src="tg://photo?id=p'+n+'"/><p>';}).replace(/<p><\/p>/g,"");
  const rest=photos.map((f,i)=>f&&!used.has(i+1)?'<img src="tg://photo?id=p'+(i+1)+'"/>':"").join("");
  html=html.replace(/(?:<br\/>){3,}/g,"<br/><br/>").replace(/<br\/><br\/><\/p>/g,"</p>");
  const top=carTop && rest;
  return (top?rest+html:html+rest)+(footer.length?"<hr/><footer>"+footer.join("<br/>")+"</footer>":"");
}
function textLength(a){ return [a.title,a.full_text,tagsOf(a),a.kind!=="original"&&a.source?"Источник: "+a.source:"",a.kind!=="original"?a.url:""].filter(Boolean).join("\n\n").length; }

