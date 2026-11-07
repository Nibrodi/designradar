// Карточки игр Дизайн-Радара: HTML → PNG 1080×1350.
// node games/cards.js <outdir> [id ...]   (CHROME_PATH=/usr/bin/google-chrome; шрифты игры «Где здесь Inter?» — npm @fontsource в FONTS_DIR)
// Каждая карточка печатает gap — зазор между содержимым и линией футера. Меньше 56 px — сборка падает.
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const FONTS = process.env.FONTS_DIR || '/home/claude/gamefonts/node_modules/@fontsource';
const INTER = 'file:///usr/share/fonts/opentype/inter/';
const MONO = 'file:///mnt/skills/examples/canvas-design/canvas-fonts/JetBrainsMono-Regular.ttf';

const BASE = `
@font-face{font-family:IDisp;src:url(${INTER}InterDisplay-ExtraBold.otf);font-weight:800}
@font-face{font-family:IDisp;src:url(${INTER}InterDisplay-Black.otf);font-weight:900}
@font-face{font-family:IText;src:url(${INTER}Inter-Regular.otf);font-weight:400}
@font-face{font-family:IText;src:url(${INTER}Inter-Medium.otf);font-weight:500}
@font-face{font-family:IText;src:url(${INTER}Inter-SemiBold.otf);font-weight:600}
@font-face{font-family:IText;src:url(${INTER}Inter-Bold.otf);font-weight:700}
@font-face{font-family:Mono;src:url(${MONO})}
:root{--cream:#F2EBDD;--paper:#FFFCF6;--ink:#141414;--orange:#FF5A1F;--muted:#605A50;--fill:#E9E1D1;--line:#DCD3C2;--soft:#CFC5B2}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1350px;background:var(--cream);overflow:hidden}
.card{position:relative;width:1080px;height:1350px;padding:80px 80px 0;color:var(--ink);font-family:IText;display:flex;flex-direction:column}
.tag{align-self:flex-start;background:var(--orange);color:var(--cream);font:26px/1 Mono;letter-spacing:.12em;padding:12px 18px 11px}
h1{font:800 82px/0.98 IDisp;letter-spacing:-.025em;margin-top:38px}
.sub{font:500 34px/1.3 IText;color:var(--muted);margin-top:24px}
#store{position:relative;flex:1;margin:44px 0 0;display:flex;flex-direction:column}
#store.center{justify-content:center;margin-bottom:56px}
.foot{position:absolute;left:80px;right:80px;bottom:80px;border-top:2px solid var(--ink);padding-top:18px;display:flex;justify-content:space-between;font:22px/1 Mono;letter-spacing:.02em}
.panel{border:3px solid var(--ink);border-radius:36px;background:var(--paper)}
`;

const page = (o) => `<!doctype html><html><head><meta charset="utf-8"><style>${BASE}${o.css || ''}</style></head><body>
<div class="card" id="card"><div class="tag">${o.tag || 'ИГРА'}</div><h1>${o.title}</h1>${o.sub ? `<div class="sub">${o.sub}</div>` : ''}
<div id="store" class="${o.center ? 'center' : ''}">${o.body}</div>
<div class="foot" id="foot"><span>@designradar_lab</span><span>${o.right || 'ответ в опросе ниже'}</span></div></div>
${o.script ? `<script>${o.script}</script>` : ''}</body></html>`;

const nb = s => s.replace(/ (в|во|на|с|со|к|ко|о|об|от|до|по|за|из|у|и|а|но|не|ни|для|без|под|над|при|про|что|как|это|где|App) /gi, ' $1 ');

// ---------- Митболы ----------
const thumb = k => {
  const doc = `<rect width="96" height="72" rx="10" fill="#EFE8DA"/>`;
  if (k === 0) return `<svg width="96" height="72" viewBox="0 0 96 72">${doc}<rect x="12" y="12" width="40" height="6" rx="3" fill="#CFC5B2"/><rect x="14" y="44" width="10" height="16" rx="2" fill="#B9AE98"/><rect x="30" y="34" width="10" height="26" rx="2" fill="#B9AE98"/><rect x="46" y="40" width="10" height="20" rx="2" fill="#B9AE98"/><rect x="62" y="28" width="10" height="32" rx="2" fill="#8F846F"/></svg>`;
  if (k === 1) return `<svg width="96" height="72" viewBox="0 0 96 72">${doc}<rect x="10" y="10" width="76" height="22" rx="4" fill="#CFC5B2"/><rect x="10" y="38" width="34" height="24" rx="4" fill="#DCD3C2"/><rect x="50" y="40" width="36" height="5" rx="2.5" fill="#CFC5B2"/><rect x="50" y="50" width="26" height="5" rx="2.5" fill="#CFC5B2"/></svg>`;
  return `<svg width="96" height="72" viewBox="0 0 96 72">${doc}<rect x="10" y="12" width="48" height="16" rx="8" fill="#CFC5B2"/><rect x="38" y="34" width="48" height="16" rx="8" fill="#B9AE98"/><rect x="10" y="56" width="30" height="6" rx="3" fill="#DCD3C2"/></svg>`;
};
const dots = `<svg width="40" height="12" viewBox="0 0 40 12"><circle cx="6" cy="6" r="4.6" fill="#141414"/><circle cx="20" cy="6" r="4.6" fill="#141414"/><circle cx="34" cy="6" r="4.6" fill="#141414"/></svg>`;
const meatballs = page({
  title: 'Как называется<br>это меню?', sub: 'Три точки в ряд в углу карточки. Ответ в опросе', center: true,
  css: `.list{padding:18px 34px 10px;position:relative}
  .lh{font:600 26px/1 IText;color:var(--muted);padding:14px 0 18px;letter-spacing:.01em}
  .r{display:flex;align-items:center;gap:30px;height:150px;border-top:2px solid var(--line)}
  .r .t{flex:1}.r .t b{display:block;font:600 36px/1.15 IText;letter-spacing:-.01em}.r .t i{display:block;font:500 26px/1.3 IText;font-style:normal;color:var(--muted);margin-top:6px}
  .k{width:72px;height:72px;border-radius:50%;display:grid;place-items:center;flex:none}
  .k.on{box-shadow:0 0 0 4px var(--orange);background:#FFF1E8}
  .menu{position:absolute;right:30px;top:200px;width:330px;background:#fff;border-radius:22px;padding:10px 0;box-shadow:0 18px 40px rgba(20,20,20,.16),0 0 0 2px rgba(20,20,20,.08)}
  .menu div{font:500 30px/1 IText;padding:22px 28px}.menu div+div{border-top:2px solid #EFE8DA}.menu .del{color:#D2381E}`,
  body: `<div class="panel list"><div class="lh">Недавние файлы</div>
  <div class="r">${thumb(0)}<div class="t"><b>Отчёт за октябрь</b><i>вчера, 18:40</i></div><div class="k on">${dots}</div></div>
  <div class="r">${thumb(1)}<div class="t"><b>Главная, версия 3</b><i>2 ноября</i></div><div class="k">${dots}</div></div>
  <div class="r">${thumb(2)}<div class="t"><b>Интервью с клиентами</b><i>28 октября</i></div><div class="k">${dots}</div></div>
</div>`
});

// ---------- 5 отличий ----------
const clock = `<svg width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="8.6" fill="none" stroke="#141414" stroke-width="2.4"/><path d="M11 6.5V11l3 2" fill="none" stroke="#141414" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const phone = (copy, answer) => {
  const m = n => answer && copy ? ` data-n="${n}"` : '';
  const item = (c, name, price, q, nName, nPrice) => `<div class="it"><div class="th" style="background:${c}"></div><div class="nm"><b${nName ? m(nName) : ''}>${name}</b><div class="l2"><span${nPrice ? m(nPrice) : ''}>${price}&nbsp;₽</span><div class="st">−<em>${q}</em>+</div></div></div></div>`;
  return `<div class="ph${copy ? ' copy' : ''}"><div class="sb">9:41</div>
  <div class="hd"><span class="bk">←</span><b>Корзина</b><span class="cl">Очистить</span></div>
  <div class="chip">${copy ? (answer ? `<span class="ghost" data-n="3" data-b="l"></span>` : '') : clock}<span>Доставим к <span${m(1)}>${copy ? '19:20' : '19:30'}</span></span></div>
  ${item('#EFA06A', 'Том ям с креветками', '590', 1)}
  ${item('#F2D3BC', 'Ролл Филадельфия', copy ? '394' : '349', 2, 0, 2)}
  ${item('#C8364A', copy ? 'Морс клюквенный' : 'Морс брусничный', '150', 1, 4)}
  <div class="pr"><span>Промокод</span><span class="chev">›</span></div>
  <div class="tt"><span>Итого</span><b>1&nbsp;438 ₽</b></div>
  <div class="btn"${m(5)}>Оформить заказ</div></div>`;
};
const PHCSS = `.pair{display:flex;gap:40px;justify-content:center}
.ph{width:440px;border:3px solid var(--ink);border-radius:46px;background:#fff;padding:24px 28px 28px;font-family:IText}
.sb{font:600 22px/1 IText;margin-left:6px}
.hd{display:flex;align-items:center;gap:12px;margin-top:28px}.hd .bk{font:600 30px/1 IText}.hd b{font:700 33px/1 IText;flex:1;letter-spacing:-.015em}.hd .cl{font:500 23px/1 IText;color:var(--orange)}
.chip{display:inline-flex;align-items:center;gap:10px;margin-top:26px;background:#F1EBDF;border-radius:30px;padding:12px 20px;font:500 23px/1 IText}
.it{display:flex;align-items:center;gap:18px;margin-top:30px}.th{width:84px;height:84px;border-radius:16px;flex:none}
.nm{flex:1;min-width:0}.nm b{display:block;width:max-content;font:600 23px/1.15 IText;letter-spacing:-.01em}
.l2{display:flex;justify-content:space-between;align-items:center;margin-top:10px}.l2 span{font:700 24px/1 IText}
.st{display:flex;gap:12px;align-items:center;border:2px solid #DCD3C2;border-radius:20px;padding:6px 14px;font:500 21px/1 IText;color:#605A50}.st em{font-style:normal;color:#141414;font-weight:600}
.pr{display:flex;justify-content:space-between;border-top:2px solid #EAE2D3;margin-top:34px;padding-top:24px;font:500 22px/1 IText}.chev{color:#8A8170}
.tt{display:flex;justify-content:space-between;align-items:baseline;margin-top:28px;font:600 25px/1 IText}.tt b{font:800 31px/1 IText;letter-spacing:-.01em}
.btn{margin-top:30px;height:72px;border-radius:18px;background:var(--orange);color:#fff;display:grid;place-items:center;font:700 24px/1 IText}
.copy .btn{border-radius:4px}
.ghost{width:22px;height:22px;border-radius:50%;border:2.5px dashed var(--orange)}
.mk{position:absolute;border:3px solid var(--orange);border-radius:12px}
.nt{position:absolute;display:flex;gap:16px;width:390px}.nt i{flex:none;width:44px;height:44px;border-radius:50%;background:var(--orange);color:#fff;font:700 24px/44px IText;font-style:normal;text-align:center}
.nt span{font:600 26px/1.25 IText;padding-top:7px;letter-spacing:-.01em}
.solo .ph{width:450px}`;
const NOTES = {1:'Время: 19:30 → 19:20', 2:'Цена ролла: 349 → 394\u00a0₽', 3:'Пропала иконка часов', 4:'Морс: брусничный → клюквенный', 5:'Углы кнопки: 18 → 4\u00a0px'};
const ROUTE = {1:'r', 2:'b', 3:'b', 4:'r', 5:'r'};
const MARKS = `document.fonts.ready.then(()=>{const NOTES=${JSON.stringify(NOTES)},ROUTE=${JSON.stringify(ROUTE)};
const S=document.getElementById('store'),st=S.getBoundingClientRect(),ph=S.querySelector('.ph').getBoundingClientRect();
const gx=ph.right-st.left+44, svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
svg.setAttribute('width',1);svg.setAttribute('height',1);svg.style.cssText='position:absolute;left:0;top:0;overflow:visible';S.append(svg);
const ms=[...S.querySelectorAll('[data-n]')].map(e=>{const r=e.getBoundingClientRect(),p=6;return {n:+e.dataset.n,x:r.left-st.left-p,y:r.top-st.top-p,w:r.width+2*p,h:r.height+2*p};}).sort((a,b)=>a.y-b.y||a.x-b.x);
let prev=-1e9;
ms.forEach(m=>{const box=document.createElement('div');box.className='mk';box.style.cssText='left:'+m.x+'px;top:'+m.y+'px;width:'+m.w+'px;height:'+m.h+'px';S.append(box);
 const down=ROUTE[m.n]==='b', cy=down?m.y+m.h+12:m.y+m.h/2, ly=Math.max(cy,prev+84); prev=ly;
 const path=document.createElementNS('http://www.w3.org/2000/svg','path');
 const start=down?'M'+(m.x+m.w/2)+' '+(m.y+m.h)+'V'+cy:'M'+(m.x+m.w)+' '+cy;
 path.setAttribute('d',start+'H'+(gx-40)+(ly!==cy?'L'+(gx-14)+' '+ly:'H'+(gx-14))+'H'+(gx-6));
 path.setAttribute('fill','none');path.setAttribute('stroke','#FF5A1F');path.setAttribute('stroke-width','2.5');svg.append(path);
 const n=document.createElement('div');n.className='nt';n.style.cssText='left:'+gx+'px;top:'+(ly-22)+'px';n.innerHTML='<i>'+m.n+'</i><span>'+NOTES[m.n]+'</span>';S.append(n);});});`;
const diff = page({
  title: 'Найди 5 отличий', sub: 'Слева оригинал, справа копия с пятью правками', right: 'ответ завтра', css: PHCSS,
  body: `<div class="pair">${phone(false)}${phone(true)}</div>`
});
const diffAnswer = page({
  tag: 'ОТВЕТ', title: 'Ответ: 5 отличий', sub: 'Что поменяли в копии корзины', right: 'ответ к игре «Найди 5 отличий»', css: PHCSS, script: MARKS,
  body: `<div class="solo">${phone(true, true)}</div>`
});

// ---------- Рубль ----------
const ruble = page({
  title: 'Сколько человек<br>выбирали этот знак?', center: true,
  css: `.spec{position:relative;height:640px;display:grid;place-items:center}
  .g{font:900 520px/1 IDisp;color:var(--orange);letter-spacing:0;transform:translateY(-14px)}
  .c{position:absolute;font:24px/1 Mono;color:var(--muted);letter-spacing:.02em}.c.tl{left:34px;top:32px}.c.tr{right:34px;top:32px}.c.bl{left:34px;bottom:30px}
  .base{position:absolute;left:34px;right:34px;bottom:118px;border-top:2px dashed #DCD3C2}`,
  body: `<div class="panel spec"><span class="c tl">U+20BD</span><span class="c tr">знак рубля</span><div class="base"></div><div class="g">₽</div><span class="c bl">голосование Банка России · 2013</span></div>`
});

// ---------- ⌘ ----------
const globe = `<svg width="38" height="38" viewBox="0 0 30 30" fill="none" stroke="#141414" stroke-width="2.2"><circle cx="15" cy="15" r="11.5"/><ellipse cx="15" cy="15" rx="5" ry="11.5"/><path d="M3.5 15h23M5.5 9h19M5.5 21h19"/></svg>`;
const key = (w, top, bottom, cls = '') => `<div class="key ${cls}" style="width:${w}px"><span class="tr">${top}</span><span class="bl">${bottom}</span></div>`;
const command = page({
  title: 'Где Сьюзан Кэр нашла<br>этот значок для Mac?', center: true,
  css: `.kb{position:relative;margin:0 -80px 0 0}
  .row{display:flex;gap:16px;white-space:nowrap}.row+.row{margin-top:16px}
  .key{position:relative;flex:none;height:198px;border-radius:22px;background:#FFFDF8;box-shadow:inset 0 0 0 2px #D9CFBD,0 6px 0 #D9CFBD}
  .key .tr{position:absolute;right:22px;top:20px;font:500 38px/1 IText}.key .bl{position:absolute;left:22px;bottom:22px;font:500 29px/1 IText}
  .key.l .tr{right:auto;left:24px;top:22px;font:500 44px/1 IText}
  .key.on{box-shadow:inset 0 0 0 2px #D9CFBD,0 6px 0 #D9CFBD,0 0 0 6px var(--cream),0 0 0 10px var(--orange)}
  .key.on .tr{font:500 56px/1 IText}.key.on .bl{font:600 33px/1 IText}
  .capt{font:500 30px/1.3 IText;color:var(--muted);margin-top:56px}`,
  body: `<div class="kb"><div class="row">${key(304, '⇧', 'shift')}${['Z', 'X', 'C', 'V', 'B'].map(l => key(198, l, '', 'l')).join('')}</div>
  <div class="row">${key(198, 'fn', globe)}${key(198, '⌃', 'control')}${key(198, '⌥', 'option')}${key(292, '⌘', 'command', 'on')}${key(520, '', '')}</div></div>
  <div class="capt">Клавиша Command на&nbsp;клавиатуре Mac</div>`
});

// ---------- Inter ----------
const ff = (n, f) => `@font-face{font-family:${n};src:url(file://${FONTS}/${f}/files/${f}-cyrillic-400-normal.woff2)}`;
const PHRASE = 'Съешь же ещё этих мягких французских булок';
const font = page({
  title: 'Где здесь Inter?', sub: 'Одна фраза, четыре шрифта. Ответ в опросе',
  css: ff('FRoboto', 'roboto') + ff('FPlex', 'ibm-plex-sans') + ff('FInter', 'inter') + ff('FGolos', 'golos-text') + `
  .sp{border-top:2px solid var(--ink)}
  .o{display:flex;gap:36px;padding:30px 0 32px;border-bottom:2px solid var(--line)}
  .o .l{flex:none;width:52px;height:52px;background:var(--orange);color:var(--cream);font:28px/52px Mono;text-align:center;margin-top:6px}
  .o p{font-size:52px;line-height:1.16;letter-spacing:0}`,
  body: `<div class="sp">${[['А', 'FRoboto'], ['Б', 'FPlex'], ['В', 'FInter'], ['Г', 'FGolos']].map(([l, f]) => `<div class="o"><div class="l">${l}</div><p style="font-family:${f}">${PHRASE}</p></div>`).join('')}</div>`
});

const CARDS = { meatballs, diff, diffAnswer, ruble, command, font };

(async () => {
  const out = process.argv[2] || '.'; const only = process.argv.slice(3);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--allow-file-access-from-files'] });
  let bad = 0;
  for (const [id, html] of Object.entries(CARDS)) {
    if (only.length && !only.includes(id)) continue;
    const f = path.resolve(out, id + '.html'); fs.writeFileSync(f, html);
    const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
    await p.goto('file://' + f); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(250);
    const m = await p.evaluate(() => {
      const foot = document.getElementById('foot').getBoundingClientRect().top;
      let bottom = 0; document.querySelectorAll('#store *').forEach(e => { const r = e.getBoundingClientRect(); if (r.height) bottom = Math.max(bottom, r.bottom); });
      const fonts = [...document.fonts].filter(f => f.status !== 'loaded').map(f => f.family + ':' + f.status);
      const over = [...document.querySelectorAll('h1,.sub')].some(e => e.scrollWidth > e.clientWidth + 1);
      return { gap: Math.round(foot - bottom), fonts, over };
    });
    // шрифты, которые не понадобились на странице, остаются unloaded — это не ошибка
    const ok = m.gap >= 56 && !m.over;
    if (!ok) bad++;
    console.log(id, ok ? 'OK' : 'FAIL', JSON.stringify(m));
    await p.screenshot({ path: path.resolve(out, id + '.png') }); await p.close();
  }
  await b.close(); process.exit(bad ? 1 : 0);
})();
