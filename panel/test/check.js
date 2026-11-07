// Автопроверка панели: открывает каждый пост, прогоняет основные сценарии. Любая ошибка — сборка падает.
const {chromium}=require('playwright'); const path=require('path');
const W=ms=>new Promise(r=>setTimeout(r,ms));
const url='file://'+path.resolve(process.argv[2]);
(async()=>{ const b=await chromium.launch(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}); const errs=[]; const fails=[]; const ok=(c,m)=>{ if(!c) fails.push(m); };
 for(const scheme of ['light','dark']){
  const p=await b.newPage({viewport:{width:1300,height:900},colorScheme:scheme});
  p.on('pageerror',e=>errs.push(scheme+': '+e.message+' @ '+(e.stack||'').split('\n')[1]));
  await p.goto(url); await W(1500);
  ok(await p.$('#tabs .tab'),'tabs render');
  for(const tab of ['review','plan','drafts','published','ideas','team']){ await p.evaluate(t=>location.hash=t,tab); await W(300);
    const n=await p.$$eval('.card.open',x=>x.length);
    for(let i=0;i<n;i++){ await p.evaluate(i=>document.querySelectorAll('.card.open')[i].querySelector('h3').click(),i); await W(700);
      ok(await p.$('.sheet .sec'), tab+' #'+i+' editor opens'); ok(!(await p.$('#errbar')), tab+' #'+i+' no error bar');
      await p.evaluate(()=>document.querySelector('.sheet header .iconbtn')?.click()); await W(250); } }
  await p.close(); }
 // сценарии на одной странице
 const p=await b.newPage({viewport:{width:1300,height:900}}); p.on('pageerror',e=>errs.push('flow: '+e.message+' @ '+(e.stack||'').split('\n')[1]));
 await p.goto(url); await W(1500);
 const doc=id=>p.evaluate(id=>window.__mockdb['posts'].get(id),id);
 const open=t=>p.evaluate(t=>{ [...document.querySelectorAll('.card.open')].find(c=>c.textContent.includes(t)).querySelector('h3').click(); },t);
 await open('Пять ошибок'); await W(1000);
 await p.evaluate(()=>{ document.querySelectorAll('.card1')[1].open=true; }); await W(200);
 const ins=await p.$$('.card1 >> nth=1 >> input'); await ins[0].fill('Подпись видна, когда поле заполнено?'); await W(1200);
 await p.click('footer .btn.fsave'); await W(1500);
 let d=await doc('cl_20261029_21_formcheck'); ok(d.carousel.points[0].head==='Подпись видна, когда поле заполнено?','carousel text saved'); ok((d.media||[]).filter(m=>m.gen).length===7,'carousel slides uploaded');
 await open('Пять ошибок'); await W(900); await p.click('.layseg button:nth-child(3)'); await W(3000);
 d=await doc('cl_20261029_21_formcheck'); ok(d.layout==='both','layout switch saved');
 await p.click('.pvtabs button:nth-child(2)'); await W(200); await p.fill('#noteIn','Проверь'); await p.click('.noteform .btn.accent'); await W(400);
 ok(await p.evaluate(()=>(window.__mockdb['posts/cl_20261029_21_formcheck/notes']||new Map()).size===1),'note added');
 await p.evaluate(()=>document.querySelector('.sheet header .iconbtn').click()); await W(800);
 await p.evaluate(()=>{ const c=[...document.querySelectorAll('.card.open')].find(c=>c.textContent.includes('Токен')); [...c.querySelectorAll('button')].find(b=>b.textContent==='Запланировать').click(); }); await W(300);
 await p.evaluate(()=>{ [...document.querySelectorAll('.sched button')].find(b=>b.textContent==='Запланировать').click(); }); await W(1500);
 d=await doc('cl_20261028_19_tokens'); ok(d.status==='scheduled'&&d.outbox&&d.outbox.body,'schedule prepares outbox');
 await p.evaluate(()=>location.hash='review'); await W(300);
 await p.evaluate(()=>{ const c=[...document.querySelectorAll('.card.open')].find(c=>c.textContent.includes('Финал 7')); [...c.querySelectorAll('button')].find(b=>b.textContent==='Опубликовать').click(); }); await W(300);
 await p.evaluate(()=>{ [...document.querySelectorAll('.confirm button')].find(b=>b.textContent.includes('Да')).click(); }); await W(1500);
 d=await doc('m1030_18'); ok(d.status==='published','publish works');
 await open('Пустой экран'); await W(900);
 await p.evaluate(()=>{ const t=document.getElementById('fText'); t.focus(); t.setSelectionRange(0,30); t.dispatchEvent(new Event('select')); }); await W(200);
 ok(!(await p.$eval('.selbar',e=>e.hidden)),'selection bar shows');
 await p.evaluate(()=>document.querySelector('.lblrow .aibtn').click()); await W(600); ok((await p.$$('.vars .varbtn')).length===3,'title variants');
 { const orig=await p.$eval('#fText',e=>e.value);
   await p.evaluate(()=>[...document.querySelectorAll('.tools .aibtn')][0].click()); await W(200);
   await p.evaluate(()=>[...document.querySelectorAll('.ai .btn.accent')].find(b=>b.textContent==='Переписать').click()); await W(800);
   ok((await p.$$('.vpick .vbtn')).length===3,'rewrite gives 2 variants + mine');
   ok((await p.$eval('#fText',e=>e.value)).startsWith('Первый вариант'),'variant 1 applied');
   await p.evaluate(()=>document.querySelectorAll('.vpick .vbtn')[2].click()); await W(100);
   ok((await p.$eval('#fText',e=>e.value)).startsWith('Второй'),'variant 2 switch');
   await p.evaluate(()=>document.querySelector('.vpick .vbtn.mine').click()); await W(100);
   ok((await p.$eval('#fText',e=>e.value))===orig,'back to mine'); }
 await p.click('.layseg button:nth-child(2)'); await W(300);
 await p.evaluate(()=>{ [...document.querySelectorAll('.carsec button')].find(b=>b.textContent.includes('Сделать карусель')).click(); }); await W(1500);
 ok((await p.$$('.card1')).length>=5,'carousel generated');
 await p.click('footer .btn.fsave'); await W(2000); d=await doc('q1029_18'); ok(!!d.carousel,'new carousel saved');
 { /* LinkedIn: очередь, превью, шаги */
  await p.evaluate(async()=>{ const db=await window.claude.use('db'); const now=Date.now();
    await db.collection('linkedin').doc('li_t1').set({title:'Шрифт, который читается на бегу',rubric:'Шрифты',text_en:'English text of the post about a typeface.\nSecond line.\nThird line.\nFourth line that should be hidden behind see more.',text_ru:'Русский текст поста про шрифт.',photos:[{url:'https://example.com/a.jpg',caption:'Фото: студия'}],hashtags:['#typography'],status:'ready',created_at:now-6*86400000,check:'Проверь год релиза',source_url:'https://example.com/story',source_name:'Example Studio — статья'});
    await db.collection('linkedin').doc('li_t2').set({title:'Второй черновик в очереди',rubric:'Интерфейс',text_en:'Second draft.',text_ru:'Второй.',photos:[],status:'ready',created_at:now-86400000}); });
  await p.evaluate(()=>location.hash='linkedin'); await W(500);
  ok(await p.$('.licard'),'linkedin card renders'); ok(await p.$('#tabs .tab[data-v="linkedin"]'),'linkedin tab for owner');
  ok(await p.evaluate(()=>/Шрифт/.test(document.querySelector('.li-studio h3').textContent)),'linkedin oldest draft is current');
  ok((await p.$$('.li-q .li-qrow')).length===1,'linkedin queue shows the rest');
  ok(await p.evaluate(()=>/на паузе/.test(document.querySelector('.li-pulse').textContent)),'linkedin pulse explains pause at 2 ready');
  ok(await p.evaluate(()=>/тема остывает/.test(document.querySelector('.li-age').textContent)),'linkedin stale draft flagged');
  ok(await p.evaluate(()=>{ const t=document.querySelector('.li-pvt'); return t && t.scrollHeight>t.clientHeight+2; }),'linkedin preview folds after 3 lines');
  ok(await p.evaluate(()=>/Source: Example Studio — https:\/\/example.com\/story/.test(document.querySelector('.li-cm').textContent)),'linkedin first comment built');
  ok((await p.$eval('.li-text',e=>e.value)).startsWith('English'),'linkedin EN shown');
  await p.click('.li-lang button[data-l="ru"]'); await W(150); ok((await p.$eval('.li-text',e=>e.value)).startsWith('Русский'),'linkedin RU switch');
  ok(await p.evaluate(()=>/Источник: Example Studio/.test(document.querySelector('.li-cm').textContent)),'linkedin RU comment');
  await p.click('.li-step >> text=Править текст'); await W(150);
  await p.fill('.li-text','Русский текст, поправленный.'); ok(await p.evaluate(()=>document.querySelector('.li-pvt').textContent==='Русский текст, поправленный.'),'linkedin preview follows edit');
  await p.click('text=Сохранить правки'); await W(300);
  let L=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__mockdb['linkedin'].get('li_t1'))));
  ok(L.text_ru==='Русский текст, поправленный.'&&L.text_en.startsWith('English')&&L.edited===true,'linkedin edit saved');
  ok((await p.$$('.li-thumbs .li-ph')).length===1,'linkedin photo listed');
  await p.click('text=Скопировать комментарий'); await W(300); ok(await p.evaluate(()=>[...document.querySelectorAll('.li-step')][3].classList.contains('done')),'linkedin step marked done');
  await p.click('text=Опубликовала в LinkedIn'); await W(200); await p.fill('.licard .confirm input','https://www.linkedin.com/posts/x'); await p.click('.licard .confirm >> text=Готово'); await W(400);
  L=await p.evaluate(()=>JSON.parse(JSON.stringify(window.__mockdb['linkedin'].get('li_t1'))));
  ok(L.status==='posted'&&L.post_url==='https://www.linkedin.com/posts/x'&&L.posted_lang==='ru','linkedin mark posted');
  ok(await p.evaluate(()=>/Второй черновик/.test(document.querySelector('.li-studio h3').textContent)),'linkedin next draft becomes current');
  ok(await p.evaluate(()=>/1/.test(document.querySelectorAll('.li-kpi b')[1].textContent)),'linkedin weekly count');
  ok(!(await p.$('#errbar')),'linkedin no error bar'); }
 await p.evaluate(()=>location.hash='team'); await W(400);
 await p.click('text=+ Пригласить редактора'); await W(200); await p.fill('.invform input >> nth=0','Тест'); await p.click('text=Создать приглашение'); await W(500);
 ok(await p.evaluate(()=>(window.__mockdb['invites']||new Map()).size===1),'invite created');
 await p.click('#mbar .mbtn.me'); await W(200); await p.click('#mmenu >> text=Тестовый вход'); await W(800); ok(await p.$('.ob'),'onboarding opens in test mode');
 await p.click('footer >> text=Выйти из теста'); await W(500); ok(!(await p.$('.ob')),'exit test mode');
 {
  const md=k=>p.evaluate(([c,i])=>{ const m=window.__mockdb[c]; const v=m&&m.get(i); return v?JSON.parse(JSON.stringify(v)):null; },k);
  await p.evaluate(async()=>{ const db=await window.claude.use('db'); await db.doc('editors/u7').set({sign:'Аня Тест',column:'Формы'});
    await db.collection('byauthor/u7/posts').doc('ap1').set({title:'Пост Ани про формы', full_text:'Текст поста Ани для проверки прав доступа.', status:'review', author:'u7', label:'Крафт', section:'Крафт', kind:'original', hashtags:[], photos:[], created_at:Date.now(), updated_at:Date.now()}); });
  await p.evaluate(()=>location.hash='review'); await W(700);
  ok(await p.evaluate(()=>[...document.querySelectorAll('.card.open')].some(c=>c.textContent.includes('Пост Ани'))),'author post visible to owner');
  await p.evaluate(()=>location.hash='team'); await W(500);
  await p.evaluate(()=>{ const r=[...document.querySelectorAll('.erow')].find(e=>e.textContent.includes('Аня Тест')); [...r.querySelectorAll('button[aria-pressed]')][0].click(); }); await W(400);
  const role=await md(['roles','u7']); const edr=await md(['editors','u7']);
  ok(role&&role.can_publish===true,'can_publish stored in roles'); ok(edr&&edr.can_publish===undefined,'editor doc has no rights');
  await p.evaluate(()=>location.hash='review'); await W(400);
  await p.evaluate(()=>{ const c=[...document.querySelectorAll('.card.open')].find(c=>c.textContent.includes('Пост Ани')); [...c.querySelectorAll('button')].find(b=>b.textContent==='Опубликовать').click(); }); await W(300);
  await p.evaluate(()=>{ [...document.querySelectorAll('.confirm button')].find(b=>b.textContent.includes('Да')).click(); }); await W(1800);
  const main=await md(['posts','ap1']); const src=await md(['byauthor/u7/posts','ap1']);
  ok(main&&main.status==='published'&&main.author==='u7'&&!('_base' in main),'owner publish adopts author post into posts');
  ok(src&&src.status==='moved','author copy marked moved');
  ok(!(await p.evaluate(()=>[...document.querySelectorAll('.card.open')].some(c=>c.textContent.includes('Пост Ани')&&c.closest('main')&&location.hash==='#review'))),'moved post left review');
 }
 { await p.evaluate(()=>location.hash='review'); await W(400);
   await p.evaluate(()=>{ const c=[...document.querySelectorAll('.card.open')].find(c=>c.textContent.includes('Пустой экран')||c.textContent.includes('Токен')); [...c.querySelectorAll('button')].find(b=>b.textContent==='Отклонить').click(); }); await W(200);
   ok(await p.$('.rjbox'),'reject asks why');
   await p.evaluate(()=>{ document.querySelector('.rjchip').click(); document.querySelector('.rjbox textarea').value='Тема хорошая, текст пересказ'; document.getElementById('rjAgain').click(); [...document.querySelectorAll('.rjacts .btn')].find(b=>b.textContent==='Отклонить').click(); }); await W(600);
   ok(await p.evaluate(()=>[...window.__mockdb['posts'].values()].some(x=>x.status==='rejected'&&x.reject_tags&&x.reject_tags.length&&x.reject_reason)),'reject reason saved');
   ok(await p.evaluate(()=>[...(window.__mockdb['ideas']||new Map()).values()].some(i=>i.rewrite_of&&i.status==='requested')),'rewrite requested as idea'); }
 { // защиты: пустой пост не публикуется, идеи без дублей, пустой новый черновик не остаётся
   await p.evaluate(async()=>{ const db=await window.claude.use('db'); await db.collection('posts').doc('zz_empty').set({title:'', full_text:'', status:'review', author:'claude', label:'Крафт', section:'Крафт', kind:'original', hashtags:[], photos:[], created_at:Date.now(), updated_at:Date.now()}); });
   await p.evaluate(()=>location.hash='review'); await W(500);
   await p.evaluate(()=>{ const c=[...document.querySelectorAll('.card.open')].find(c=>c.querySelector('h3')&&c.querySelector('h3').textContent===''); [...c.querySelectorAll('button')].find(b=>b.textContent==='Опубликовать').click(); }); await W(200);
   await p.evaluate(()=>{ [...document.querySelectorAll('.confirm button')].find(b=>b.textContent.includes('Да')).click(); }); await W(500);
   ok(await p.evaluate(()=>window.__mockdb['posts'].get('zz_empty').status==='review'),'empty post not published');
   ok(await p.evaluate(()=>document.body.textContent.includes('Не публикую')),'publish problem shown');
   const n0=await p.evaluate(()=>(window.__mockdb['ideas']||new Map()).size);
   await p.evaluate(()=>location.hash='ideas'); await W(300);
   for(let i=0;i<2;i++){ await p.fill('#ideaInput','Тестовая идея про дубли'); await p.evaluate(()=>[...document.querySelectorAll('.ideabox .btn.primary')][0].click()); await W(400); }
   ok(await p.evaluate(n0=>(window.__mockdb['ideas']||new Map()).size===n0+1,n0),'idea dedupe');
   await p.evaluate(()=>location.hash='review'); await W(300);
   const before=await p.evaluate(()=>window.__mockdb['posts'].size);
   await p.evaluate(()=>document.querySelector('.leadacts .btn.newpost').click()); await W(300);
   await p.evaluate(()=>document.querySelector('.npself').click()); await W(1000);
   await p.evaluate(()=>document.querySelector('.sheet header .iconbtn').click()); await W(500);
   ok(await p.evaluate(b=>window.__mockdb['posts'].size===b,before),'empty new draft discarded'); }
 { // находка: фото по ссылке видно в превью, кредиты не тратятся до публикации
   await p.evaluate(async()=>{ const db=await window.claude.use('db'); await db.collection('posts').doc('fd_test').set({title:'Находка тест', full_text:'Текст находки достаточно длинный для проверки публикации.', status:'review', author:'claude', label:'Находка', section:'Находка', kind:'news', hashtags:[], photos:[], cover_render:false, cover_url:'https://example.com/a.jpg', media:[{url:'https://example.com/b.jpg', caption:'Фото: студия', ext:true}], created_at:Date.now(), updated_at:Date.now()}); });
   await p.evaluate(()=>location.hash='review'); await W(500);
   ok(await p.evaluate(()=>[...document.querySelectorAll('.cover.photocover img, .cover.photocover .phfail')].length>0),'find photo preview from url');
   ok(await p.evaluate(()=>!window.__mockdb['posts'].get('fd_test').image_file_id),'no upload before publish'); }

 { // рилс: создаётся, текст и дизайн сцены правятся, превью рисуется, сохраняется в посте
   await open('Находка тест'); await W(900);
   await p.evaluate(()=>[...document.querySelectorAll('.reelsec button')].find(b=>/Простой рилс/.test(b.textContent)).click()); await W(900);
   ok(await p.evaluate(()=>{ const c=document.querySelector('.reelpv'); if(!c) return false; const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data; const set=new Set(); for(let i=0;i<d.length;i+=400) set.add(d[i]+','+d[i+1]); return set.size>3; }),'reel preview draws');
   await p.evaluate(()=>{ const c=document.querySelectorAll('.rcard')[1]; c.open=true; const b=[...c.querySelectorAll('.chipb')].find(x=>x.textContent==='Интерфейс'); b.click(); }); await W(400);
   await p.evaluate(()=>{ const c=document.querySelectorAll('.rcard')[1]; const f=[...c.querySelectorAll('.fld')].find(x=>/Подпись внизу/.test(x.textContent)); const i=f.querySelector('input'); i.value='Прозрачные условия'; i.dispatchEvent(new Event('input')); }); await W(200);
   await p.evaluate(()=>{ const c=document.querySelectorAll('.rcard')[1]; c.querySelector('.rdz').open=true; [...c.querySelectorAll('.chipb')].find(x=>x.textContent==='Тёмный').click(); }); await W(3200);
   const r=(await doc('fd_test')).reel; ok(r&&r.scenes&&r.scenes[1].type==='ui','reel scene type saved'); ok(r&&r.scenes[1].phases[0].caption==='Прозрачные условия','reel caption edit saved'); ok(r&&r.scenes[1].bg==='ink','reel scene design saved');
   ok(!(await p.$('#errbar')),'reel no error bar');
   await p.evaluate(()=>[...document.querySelectorAll('.rphotobar button')].find(b=>/найдёт фото/.test(b.textContent)).click()); await W(800);
   ok(await p.evaluate(()=>(window.__mockdb['posts'].get('fd_test').photo_request||{}).status==='requested'),'photo search requested');
   ok(await p.evaluate(()=>(window.__calls||[]).some(c=>c.tool==='update_trigger'&&c.args.trigger_id==='trig_01SsdLvWh9WAW64p8KrsoxKp')),'photo search task armed');
   ok(await p.evaluate(()=>{ const r=window.__mockdb['posts'].get('fd_test').reel; return r.scenes.filter(x=>x.type==='photo').every(x=>!/example\.com/.test(x.src)); }),'reel external photos moved into panel');
   await p.evaluate(()=>document.querySelector('.sheet header .iconbtn')?.click()); await W(300); }
 { // рилс: новые сцены в текущем стиле рисуются на всём таймлайне
   const reel={label:'Крафт',scenes:[{type:'title',dur:2.5,bg:'cream',accent:'orange',size:'L',title:'41 оттенок синего ради одной ссылки'},{type:'swatches',dur:3.4,bg:'ink',title:'Проверили все 41',from:'#0b1f6b',to:'#7fb2ff',count:41,pick:28,pickLabel:'Победил этот'},{type:'number',dur:2.8,bg:'orange',pre:'Итог теста',value:'+200 млн $',title:'в год —\nза один оттенок',hl:true},{type:'compare',dur:3.6,bg:'cream',title:'Почему синий',a_label:'Другой цвет',a_text:'Ссылку ищут глазами',b_label:'Синий',b_text:'Ссылку узнают сразу'},{type:'list',dur:3.8,bg:'ink',title:'Что взять себе',items:'Не меняй цвет ссылок без теста\nОдин цвет — одна роль\nПроверяй на людях',mark:'num'},{type:'end',dur:2}]};
   await p.evaluate(async(reel)=>{ const db=await window.claude.use('db'); await db.collection('posts').doc('rv2').set({title:'Рилс сцены тест', full_text:'Достаточно длинный текст поста для проверки рилса.', status:'review', author:'claude', label:'Крафт', section:'Крафт', source:'', url:'', hashtags:[], created_at:Date.now(), updated_at:Date.now(), reel}); },reel);
   await p.evaluate(()=>location.hash='review'); await W(400); await open('Рилс сцены тест'); await W(1200);
   await p.evaluate(()=>{ [...document.querySelectorAll('.reelsec button')].find(b=>/Пауза/.test(b.textContent)).click(); });
   for(let t=0;t<19;t+=.7){ await p.evaluate(t=>{ const c=document.querySelector('.reelpv'); if(c) c._t=t; },t); await W(40); }
   ok(await p.evaluate(()=>document.querySelectorAll('.rcard').length===6),'reel new scenes cards');
   ok(!(await p.$('#errbar')),'reel new scenes no error bar');
   await p.evaluate(()=>document.querySelector('.sheet header .iconbtn')?.click()); await W(300); }
 { // двойное «Сохранить» и закрытие во время сохранения не дают ошибки
   await open('Пять ошибок'); await W(900);
   await p.evaluate(()=>{ const t=document.querySelector('#fText')||document.querySelector('.sheet textarea'); if(t){ t.value+=' '; t.dispatchEvent(new Event('input')); } });
   await p.evaluate(()=>{ const a=document.querySelector('.sheet header .hsave'), b=document.querySelector('.sheet footer .btn.fsave'); a&&a.click(); b&&b.click(); document.querySelector('.sheet header .iconbtn')?.click(); }); await W(1500);
   ok(!(await p.$('#errbar')),'double save no error bar'); }
 { // обложка: идеи трёх типов → рисунок выбранной
   await open('Пять ошибок'); await W(900);
   await p.evaluate(()=>{ [...document.querySelectorAll('.sheet button')].find(b=>/Новая сцена от Claude/.test(b.textContent)).click(); }); await W(200);
   await p.evaluate(()=>{ [...document.querySelectorAll('.sheet button')].find(b=>/Придумать идеи/.test(b.textContent)).click(); }); await W(800);
   ok(await p.evaluate(()=>document.querySelectorAll('.cidea').length===3),'cover ideas listed');
   await p.evaluate(()=>document.querySelector('.cidea.best button').click()); await W(2500);
   ok(await p.evaluate(()=>/Готово/.test(document.querySelector('.cideas').previousElementSibling.textContent)),'cover drawn from idea');
   ok(await p.evaluate(()=>window.__reviewed===1&&window.__redrawn===1),'art director reviews the image and the cover is redrawn');
   ok(await p.evaluate(()=>/Claude посмотрел на картинку и поправил: подписи мелкие/.test(document.querySelector('.cideas').previousElementSibling.textContent)),'review note shown');
   ok(!(await p.$('#errbar')),'cover ideas no error bar');
   await p.evaluate(()=>document.querySelector('.sheet header .iconbtn')?.click()); await W(800); }
 { // тяжёлая картинка (PNG больше 1 МиБ) сжимается перед отправкой в Make, пост планируется
   await p.evaluate(async()=>{ const c=document.createElement('canvas'); c.width=1600; c.height=900; const x=c.getContext('2d'); const d=x.createImageData(1600,900);
     for(let i=0;i<d.data.length;i++) d.data[i]=(i%4===3)?255:(Math.random()*256)|0; x.putImageData(d,0,0);
     const blob=await new Promise(r=>c.toBlob(r,'image/png')); window.__bigSize=blob.size;
     const db=await window.claude.use('db'); await db.collection('posts').doc('big_media').set({title:'Тяжёлая карусель тест', full_text:'Текст поста с тяжёлой картинкой для проверки планирования.\n\n[фото:1]', status:'review', author:'claude', label:'Находка', section:'Находка', kind:'news', layout:'cover', hashtags:[], photos:[], media:[{url:URL.createObjectURL(blob), asset_id:'x1', caption:'', file_id:''}], cover_off:true, created_at:Date.now(), updated_at:Date.now()}); });
   ok(await p.evaluate(()=>window.__bigSize>1048576),'test picture is over 1 MiB');
   await p.evaluate(()=>location.hash='review'); await W(500);
   const n0=await p.evaluate(()=>(window.__calls||[]).length);
   await p.evaluate(()=>{ const c=[...document.querySelectorAll('.card.open')].find(c=>c.textContent.includes('Тяжёлая карусель')); [...c.querySelectorAll('button')].find(b=>b.textContent==='Запланировать').click(); }); await W(300);
   await p.evaluate(()=>{ [...document.querySelectorAll('.sched button')].find(b=>b.textContent==='Запланировать').click(); }); await W(4000);
   const bd=await doc('big_media');
   ok(bd.status==='scheduled'&&bd.outbox&&bd.outbox.body,'heavy picture post scheduled');
   ok(bd.media&&bd.media[0].file_id,'heavy picture uploaded');
   ok(await p.evaluate(n0=>(window.__calls||[]).slice(n0).every(c=>JSON.stringify(c.args||{}).length<=1048576),n0),'every connector input under 1 MiB');
   ok(!(await p.evaluate(()=>document.body.textContent.includes('too large'))),'no too-large error shown'); }
 { // телефон: нет горизонтальной прокрутки, нижняя навигация, нужные кнопки на месте
  const m=await b.newPage({viewport:{width:375,height:780},isMobile:true,hasTouch:true,colorScheme:'dark'}); m.on('pageerror',e=>errs.push('mobile: '+e.message));
  await m.goto(url); await W(1500);
  for(const t of ['review','plan','drafts','ideas','published','linkedin','team']){ await m.evaluate(t=>location.hash=t,t); await W(350);
    ok(await m.evaluate(()=>document.documentElement.scrollWidth<=375),'mobile '+t+' no horizontal scroll'); }
  ok(await m.evaluate(()=>{ const r=document.getElementById('tabs').getBoundingClientRect(); return r.bottom>=650 && r.bottom<=780 && r.height<100; }),'mobile nav at bottom');
  await m.evaluate(()=>window.scrollTo(0,900)); await W(200);
  ok(await m.evaluate(()=>document.getElementById('tabs').getBoundingClientRect().bottom>=650),'mobile nav stays at bottom on scroll');
  ok(await m.evaluate(()=>!/null|undefined/.test(document.querySelector('.mast').textContent)),'no null in header');
  await m.click('#mbar .mbtn.me'); await W(200); ok(await m.$('#mmenu .pop'),'mobile profile menu');
  await m.evaluate(()=>[...document.querySelectorAll('#mmenu button')].find(b=>b.textContent.includes('Что нового')).click()); await W(200);
  ok(await m.$('.wnbox'),'whats new from menu'); await m.evaluate(()=>document.querySelector('.wnbox .phead button').click()); await W(100);
  ok(await m.evaluate(()=>!document.querySelector('#mbar .vdot') && !/null/.test(document.querySelector('.mast').textContent)),'dot gone after reading');
  ok(await m.evaluate(()=>[...document.querySelectorAll('.leadacts .btn.primary')].some(b=>b.offsetParent&&b.textContent.includes('Пригласить'))),'mobile invite button visible');
  ok(await m.evaluate(()=>{ const t=document.querySelector('.brand h1'); return t.scrollWidth<=t.clientWidth+1; }),'mobile title not cut');
  await m.evaluate(()=>location.hash='review'); await W(350); ok(await m.evaluate(()=>{ const b=document.querySelector('#mbar .mbtn.new'); return b && b.getBoundingClientRect().top<60; }),'mobile new post button in header');
  ok(await m.evaluate(()=>{ const s=document.querySelector('.leadacts select'); const n=new Set([...window.__mockdb['posts'].values()].map(p=>p.author||'claude')).size; return n>1 ? !!s && s.getBoundingClientRect().width>=document.querySelector('main').clientWidth-34 : !s; }),'author filter: full width, or hidden when one author');
  ok(await m.evaluate(()=>[...document.querySelectorAll('input,textarea,select')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)),'mobile inputs 16px');
  await m.evaluate(()=>window.scrollTo(0,0)); await m.click('#mbar .mbtn.me'); await W(200);
  await m.evaluate(()=>[...document.querySelectorAll('#mmenu button')].find(b=>b.textContent.includes('Настроить вид')).click()); await W(200);
  ok((await m.$$('.dsrow input[type=range]')).length>=14,'design sliders');
  await m.evaluate(()=>{ const r=[...document.querySelectorAll('.dsrow')].find(x=>x.textContent.includes('Поля по краям')).querySelector('input'); r.value=24; r.dispatchEvent(new Event('input')); }); await W(100);
  ok(await m.evaluate(()=>getComputedStyle(document.querySelector('main')).paddingLeft==='24px'),'design live preview');
  await m.evaluate(()=>[...document.querySelectorAll('.dsacts .btn')].find(b=>b.textContent==='Сохранить').click()); await W(300);
  ok(await m.evaluate(()=>{ const d=window.__mockdb['settings']&&window.__mockdb['settings'].get('main'); return d&&d.design&&d.design['--g']==='24px'; }),'design saved to settings');
  await m.evaluate(()=>document.documentElement.style.removeProperty('--g'));
  await m.click('#mbar .mbtn.new'); await W(250); ok((await m.$$('.npgrid .nptile')).length>=12,'new post picker directions');
  await m.evaluate(()=>[...document.querySelectorAll('.nptile')].find(t=>t.textContent.includes('Психология цвета')).click()); await W(200);
  ok((await m.$$('.nptopics .nptopic')).length===3,'three topics');
  await m.evaluate(()=>[...document.querySelectorAll('.npacts .btn')].find(b=>b.textContent==='Отдать Claude').click()); await W(500);
  ok(await m.evaluate(()=>[...(window.__mockdb['ideas']||new Map()).values()].some(i=>i.status==='requested'&&i.rubric==='Крафт')),'topic handed to Claude');
  await m.click('#mbar .mbtn.new'); await W(250); await m.evaluate(()=>document.querySelector('.npself').click()); await W(900);
  ok(await m.$('.sheet .sec'),'write myself opens editor');
  await m.evaluate(()=>{ location.hash='review'; window.scrollTo(0,0); }); await W(400);
  await m.evaluate(()=>{ const c=[...document.querySelectorAll('.card.open')].find(c=>c.textContent.includes('Токен')); c.querySelector('h3').click(); }); await W(1200);
  ok(await m.evaluate(()=>{ const b=document.querySelector('.sheet header .hsave'); return b && b.getBoundingClientRect().top<80 && b.offsetParent; }),'mobile editor save in header');
  ok(await m.evaluate(()=>!!document.querySelector('.ed footer.inline .btn.fsave')),'mobile editor actions at end of text');
  ok(await m.evaluate(()=>![...document.querySelectorAll('.sheet > footer')].length),'no fixed footer on mobile');
  await m.evaluate(()=>document.querySelector('.sheet header .iconbtn').click()); await W(500);
  await m.close(); }
 { // 2.18.1: фото с сайта источника переносятся в панель, кнопка вариантов заголовка появляется после «Нарисовать обложку»
  const q=await b.newPage({viewport:{width:1300,height:900}}); q.on('pageerror',e=>errs.push('photos: '+e.message+' @ '+(e.stack||'').split('\n')[1]));
  await q.goto(url); await W(1500);
  await q.evaluate(async()=>{ const db=await window.claude.use('db'); await db.collection('posts').doc('t_ext_photos').set({title:'Визитка без слова помощь',cover_title:'Точки',label:'Находка',section:'Находка',kind:'news',status:'review',author:'claude',full_text:'Текст поста.\n\n[фото:1]\n\nЕщё абзац.',hashtags:['#находка'],media:[{url:'https://cdn.example.com/a.jpg',caption:'Фото: The Clients',file_id:'',asset_id:''},{url:'https://cdn.example.com/b.jpg',caption:'Фото: The Clients',file_id:'',asset_id:''}],created_at:Date.now(),updated_at:Date.now()}); });
  await q.evaluate(()=>{ location.hash='review'; }); await W(500);
  await q.evaluate(()=>{ [...document.querySelectorAll('.card.open')].find(c=>c.textContent.includes('Визитка без слова')).querySelector('h3').click(); }); await W(2500);
  const pd=await q.evaluate(()=>window.__mockdb['posts'].get('t_ext_photos'));
  ok(pd.photo_assets&&Object.keys(pd.photo_assets).length===2,'external photos imported to panel');
  ok(pd.media[0].url==='https://cdn.example.com/a.jpg','media keeps source url for Telegram');
  ok(await q.evaluate(()=>[...document.querySelectorAll('.tg img.mi')].length===2 && [...document.querySelectorAll('.tg img.mi')].every(i=>!/cdn\.example/.test(i.getAttribute('src')))),'preview shows imported photos');
  ok(await q.evaluate(()=>[...document.querySelectorAll('.mitem img')].every(i=>!/cdn\.example/.test(i.getAttribute('src')))),'media thumbs show imported photos');
  const cvVisible=()=>q.evaluate(()=>{ const b=[...document.querySelectorAll('.sec .lblrow .aibtn')].find(x=>x.textContent.includes('3 варианта')&&x.closest('.fld').querySelector('#fCover')); return !!(b&&b.offsetParent); });
  ok(await cvVisible(),'cover variants shown when post opens with a drawn cover');
  ok(await q.evaluate(()=>![...document.querySelectorAll('.sec .hint')].some(h=>h.offsetParent&&h.textContent.startsWith('Это карусель'))),'no stale carousel hint');
  ok(await q.evaluate(()=>[...document.querySelectorAll('.sec .acts .btn')].some(x=>x.textContent==='Простой рисунок вместо этого')),'cover button label matches drawn cover');
  await q.close(); }
 await b.close();
 if(errs.length||fails.length){ console.error('ОШИБКИ:\n'+errs.join('\n')+'\nНЕ ПРОШЛО:\n'+fails.join('\n')); process.exit(1); }
 console.log('Все проверки прошли');
})();
