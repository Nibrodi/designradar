/* ---------- editor helpers: lint, fragments, versions, notes ---------- */
const STOP=[["является","канцелярит — «это»"],["являются","канцелярит"],["осуществля","канцелярит — обычный глагол"],["данный","канцелярит — «этот»"],["данной","канцелярит — «этой»"],["данного","канцелярит"],["в рамках","канцелярит — «в», «для»"],["в целях","канцелярит — «для»"],["важно отметить","вводная — удали"],["не секрет","штамп"],["давайте разбер","вступление без смысла"],["очень ","пустой усилитель"],["крайне ","пустой усилитель"],["максимально","пустой усилитель"],["действительно","пустой усилитель"],["уникальн","оценка без факта"],["инновацион","оценка без факта"],["революцион","оценка без факта"],["game changer","штамп"],["must have","штамп"],["подведём итог","пересказ — дай вердикт"],["на ревью я регулярно вижу","шаблонное начало"],["как вы думаете","пустой призыв"],["пишите в комментариях","пустой призыв"],["чаще всего","утверждение без данных"],["все дизайнеры","обобщение без данных"]];
function lintText(t, media){
  const out=[]; const low=t.toLowerCase();
  for(const [w,why] of STOP){ let i=0; while((i=low.indexOf(w,i))>=0){ out.push({s:i,e:i+w.trim().length,kind:"word",msg:"«"+t.slice(i,i+w.trim().length)+"» — "+why}); i+=w.length; } }
  let off=0;
  for(const line of t.split("\n")){
    const st=(line.match(/\*\*/g)||[]).length; if(st%2) out.push({s:off,e:off+line.length,kind:"fmt",msg:"Незакрытый жирный: в строке нечётное число **"});
    const ph=line.trim().match(/^\[?(?:фото|photo)\s*:?\s*(\d{1,2})\]?$/i);
    if(ph && !/^\[(?:фото|photo)\s*:?\s*\d{1,2}\]$/i.test(line.trim())) out.push({s:off,e:off+line.length,kind:"fmt",msg:"Метка картинки без скобок — нужно [фото:"+ph[1]+"]"});
    else if(ph && Number(ph[1])>(media||0)) out.push({s:off,e:off+line.length,kind:"fmt",msg:"[фото:"+ph[1]+"] — такой картинки в посте нет"});
    const re=/(^|[^\(\w])(https?:\/\/[^\s)]+)/g; let m; while((m=re.exec(line))){ const before=line.slice(0,m.index+m[1].length); if(/\]\($/.test(before)) continue; out.push({s:off+m.index+m[1].length,e:off+m.index+m[1].length+m[2].length,kind:"link",msg:"Голая ссылка — вшей её в слова: [текст](ссылка)"}); }
    off+=line.length+1;
  }
  off=0;
  for(const para of t.split(/\n\s*\n/)){
    const start=t.indexOf(para,off); off=start+para.length;
    if(/^\s*(\[фото|##)/i.test(para)) continue;
    const sents=para.replace(/\n/g," ").split(/(?<=[.!?…])\s+(?=[«"A-ZА-ЯЁ0-9])/);
    if(sents.filter(x=>x.trim()).length>3) out.push({s:start,e:start+para.length,kind:"len",msg:"Абзац длиннее трёх предложений — раздели"});
    let so=start; for(const sn of sents){ const words=sn.replace(/\[([^\]]+)\]\((?:[^()\s]|\([^()\s]*\))+\)/g,"$1").split(/\s+/).filter(Boolean).length; const i=t.indexOf(sn.slice(0,20),so); if(words>22 && i>=0) out.push({s:i,e:i+sn.length,kind:"len",msg:"Длинное предложение ("+words+" слов) — разбей на два"}); if(i>=0) so=i+1; }
  }
  return out.sort((a,b)=>a.s-b.s);
}
const FRAG_MODES={short:"Сделай короче: убери всё, без чего смысл не меняется.",lively:"Сделай живее: конкретная деталь из интерфейса вместо общих слов, связки вместо телеграфных фраз. Без шуток, если это крафт.",simple:"Сделай проще: понятно дизайнеру с полугодом опыта, без канцелярита.",opening:"Перепиши как сильное начало поста: первая фраза — суть и при чём тут читатель."};
async function rewriteFragment(d, frag, mode, wish){
  const prompt=TEXT_RULES+"\n\nПОСТ ЦЕЛИКОМ (для контекста, не переписывай):\nЗаголовок: "+d.title+"\n"+String(d.full_text||"").slice(0,3000)+"\n\nФРАГМЕНТ, КОТОРЫЙ НУЖНО ПЕРЕПИСАТЬ:\n"+frag+"\n\nЗАДАЧА: "+(FRAG_MODES[mode]||"")+(wish?" Пожелание редактора: "+wish:"")+"\nСохрани факты, цифры, цитаты, ссылки [текст](url) и строки [фото:N] из фрагмента. Ответь только новым фрагментом, без кавычек и пояснений.";
  const r=await sample(prompt,{modelTier:"default",cache:false});
  const t=String(r.text||"").replace(/^\s*```[a-z]*\s*/i,"").replace(/```\s*$/,"").trim();
  if(!t) throw {message:"Claude вернул пустой ответ"};
  return t;
}
async function titleVariants(d, kind){
  const prompt=TEXT_RULES+"\n\nПОСТ:\nРубрика: "+(d.label||d.section)+"\nЗаголовок сейчас: "+(kind==="cover"?(d.cover_title||d.title):d.title)+"\nТекст:\n"+String(d.full_text||"").slice(0,2500)+"\n\n"+(kind==="cover"
    ?"Предложи 3 заголовка для ОБЛОЖКИ: до 45 знаков, законченная фраза, цепляет с первого взгляда; хорошо работает парадокс или контраст, который раскрывает суть (пример удачного: «Новый герб, который не новый»). Без кликбейта и выдуманных фактов."
    :"Предложи 3 заголовка ПОСТА: до 60 знаков, главное слово в начале, сразу цепляет читателя конкретикой (цифра, последствие, неожиданный факт из текста). Без каламбуров, приказов и выдуманных фактов.")+"\nОтветь только JSON-массивом из трёх строк.";
  const v=await sample.json(prompt,{modelTier:"default",cache:false});
  return (Array.isArray(v)?v:[]).map(x=>String(x).trim()).filter(Boolean).slice(0,3);
}
const readTime = t => { const w=plain(t).split(/\s+/).filter(Boolean).length; const sec=Math.max(5,Math.round(w/200*60)); return sec<60?"≈ "+(Math.round(sec/5)*5)+" сек чтения":"≈ "+Math.round(sec/60)+" мин чтения"; };
function diffStat(a,b){ const A=String(a||"").split(/\s+/).filter(Boolean), B=String(b||"").split(/\s+/).filter(Boolean); const ca={}; A.forEach(w=>ca[w]=(ca[w]||0)+1); let same=0; B.forEach(w=>{ if(ca[w]){ca[w]--;same++;} }); return {add:B.length-same, del:A.length-same}; }


