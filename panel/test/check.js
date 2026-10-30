// Автопроверка панели: открывает каждый пост, прогоняет основные сценарии. Любая ошибка — сборка падает.
const {chromium}=require('playwright'); const path=require('path');
const W=ms=>new Promise(r=>setTimeout(r,ms));
const url='file://'+path.resolve(process.argv[2]);
(async()=>{ const b=await chromium.launch(); const errs=[]; const fails=[]; const ok=(c,m)=>{ if(!c) fails.push(m); };
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
 await p.click('footer .btn.primary'); await W(1500);
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
 await p.click('footer .btn.primary'); await W(2000); d=await doc('q1029_18'); ok(!!d.carousel,'new carousel saved');
 await p.evaluate(()=>location.hash='team'); await W(400);
 await p.click('text=+ Пригласить редактора'); await W(200); await p.fill('.invform input >> nth=0','Тест'); await p.click('text=Создать приглашение'); await W(500);
 ok(await p.evaluate(()=>(window.__mockdb['invites']||new Map()).size===1),'invite created');
 await p.click('text=Тестовый вход'); await W(800); ok(await p.$('.ob'),'onboarding opens in test mode');
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
 { // телефон: нет горизонтальной прокрутки, нижняя навигация, нужные кнопки на месте
  const m=await b.newPage({viewport:{width:375,height:780},isMobile:true,hasTouch:true,colorScheme:'dark'}); m.on('pageerror',e=>errs.push('mobile: '+e.message));
  await m.goto(url); await W(1500);
  for(const t of ['review','plan','drafts','ideas','published','team']){ await m.evaluate(t=>location.hash=t,t); await W(350);
    ok(await m.evaluate(()=>document.documentElement.scrollWidth<=375),'mobile '+t+' no horizontal scroll'); }
  ok(await m.evaluate(()=>{ const r=document.getElementById('tabs').getBoundingClientRect(); return r.top<130 && r.height<60; }),'mobile nav at top');
  await m.evaluate(()=>window.scrollTo(0,900)); await W(200);
  ok(await m.evaluate(()=>document.getElementById('tabs').getBoundingClientRect().top>=0 && document.getElementById('tabs').getBoundingClientRect().top<130),'mobile nav sticky on scroll');
  ok(await m.evaluate(()=>!/null|undefined/.test(document.querySelector('.mast').textContent)),'no null in header');
  await m.click('#mbar .mbtn.me'); await W(200); ok(await m.$('#mmenu .pop'),'mobile profile menu');
  await m.evaluate(()=>[...document.querySelectorAll('#mmenu button')].find(b=>b.textContent.includes('Что нового')).click()); await W(200);
  ok(await m.$('.wnbox'),'whats new from menu'); await m.evaluate(()=>document.querySelector('.wnbox .phead button').click()); await W(100);
  ok(await m.evaluate(()=>!document.querySelector('#mbar .vdot') && !/null/.test(document.querySelector('.mast').textContent)),'dot gone after reading');
  ok(await m.evaluate(()=>[...document.querySelectorAll('.leadacts .btn.primary')].some(b=>b.offsetParent&&b.textContent.includes('Пригласить'))),'mobile invite button visible');
  ok(await m.evaluate(()=>{ const t=document.querySelector('.brand h1'); return t.scrollWidth<=t.clientWidth+1; }),'mobile title not cut');
  await m.evaluate(()=>location.hash='review'); await W(350); ok(await m.evaluate(()=>{ const b=document.querySelector('#mbar .mbtn.new'); return b && b.getBoundingClientRect().top<60; }),'mobile new post button in header');
  ok(await m.evaluate(()=>{ const s=document.querySelector('.leadacts select'); return s.getBoundingClientRect().width>=document.querySelector('main').clientWidth-34; }),'author filter full width');
  ok(await m.evaluate(()=>[...document.querySelectorAll('input,textarea,select')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)),'mobile inputs 16px');
  await m.click('#mbar .mbtn.new'); await W(250); ok((await m.$$('.npgrid .nptile')).length>=12,'new post picker directions');
  await m.evaluate(()=>[...document.querySelectorAll('.nptile')].find(t=>t.textContent.includes('Психология цвета')).click()); await W(200);
  ok((await m.$$('.nptopics .nptopic')).length===3,'three topics');
  await m.evaluate(()=>[...document.querySelectorAll('.npacts .btn')].find(b=>b.textContent==='Отдать Claude').click()); await W(500);
  ok(await m.evaluate(()=>[...(window.__mockdb['ideas']||new Map()).values()].some(i=>i.status==='requested'&&i.rubric==='Крафт')),'topic handed to Claude');
  await m.click('#mbar .mbtn.new'); await W(250); await m.evaluate(()=>document.querySelector('.npself').click()); await W(900);
  ok(await m.$('.sheet .sec'),'write myself opens editor');
  await m.close(); }
 await b.close();
 if(errs.length||fails.length){ console.error('ОШИБКИ:\n'+errs.join('\n')+'\nНЕ ПРОШЛО:\n'+fails.join('\n')); process.exit(1); }
 console.log('Все проверки прошли');
})();
