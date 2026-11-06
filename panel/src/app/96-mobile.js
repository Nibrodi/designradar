/* ---------- шапка: «новый пост» (телефон) и меню профиля (везде) ----------
   С 2.18 меню одно на телефоне и компьютере: тема, «Что нового», тестовый вход, анкета, вид.
   Раньше на компьютере эти кнопки жили отдельно в шапке и спорили с вкладками за внимание. */
function drawMobileBar(){
  const brand=document.querySelector(".brand"); if(!brand) return;
  let bar=document.getElementById("mbar");
  if(!bar){ bar=h("div",{id:"mbar",class:"mbar"}); brand.append(bar); }
  const kids=[];
  const nm=S.test?"Тестовый редактор":(S.myName||"");
  const role=S.test?"Тестовый режим":S.owner?"Главный редактор":S.me?"Редактор":"";
  if(nm||role) kids.push(h("div",{class:"mrole"}, nm?h("b",{text:nm}):null, role?h("span",{text:role}):null));
  if(S.canWrite && !S.blocked){ const nb=h("button",{type:"button",class:"mbtn new","aria-label":"Новый пост",title:"Новый пост",onclick:()=>openNewPost()}); nb.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'; kids.push(nb); }
  const fresh=typeof APP_VERSION!=="undefined" && seenVersion()!==APP_VERSION;
  const me=h("button",{type:"button",class:"mbtn me","aria-label":"Меню: "+(nm||"профиль")+(fresh?", есть новая версия":""),"aria-haspopup":"menu",title:"Меню",onclick:openMeMenu}, (nm.trim()[0]||"Я").toUpperCase());
  if(fresh) me.append(h("i",{class:"vdot","aria-hidden":"true"}));
  kids.push(me); bar.replaceChildren(...kids);
}
function openMeMenu(){
  let m=document.getElementById("mmenu"); if(m) m.remove();
  const opener=document.querySelector("#mbar .mbtn.me");
  const close=()=>{ m.remove(); opener?.focus(); };
  const role=S.test?"Тестовый режим":S.owner?"Главный редактор":"Редактор";
  const item=(label,right,fn,dot)=>h("button",{type:"button",role:"menuitem",onclick:()=>{ m.remove(); fn(); }}, h("span",{}, label, dot?h("i",{class:"vdot","aria-hidden":"true"}):null), right?h("small",{text:right}):null);
  const themeName={auto:"как в системе",light:"светлая",dark:"тёмная"}[getTheme()]||"";
  const fresh=seenVersion()!==APP_VERSION;
  const items=[
    item("Что нового","v"+APP_VERSION,showChanges,fresh),
    item("Тема",themeName,()=>{ const i=THEMES.findIndex(x=>x[0]===getTheme()); const nx=THEMES[(i+1)%THEMES.length]; try{ localStorage.setItem("dr_theme",nx[0]); }catch(_){} applyTheme(nx[0]); toast(nx[2]); })
  ];
  if(S.realOwner) items.push(item("Настроить вид","",openDesign));
  if(S.realOwner) items.push(item(S.test?"Выйти из теста":"Тестовый вход","",()=>setTest(!S.test)));
  if(!S.owner && S.me) items.push(item("Моя анкета","",()=>openOnboarding(true)));
  m=h("div",{id:"mmenu",class:"mmenu"}, h("div",{class:"scrim",onclick:close}),
    h("div",{class:"pop",role:"menu","aria-label":"Меню профиля"}, h("div",{class:"who2"}, h("b",{text:S.test?"Тестовый редактор":(S.myName||"Без имени")}), h("span",{text:role})), ...items));
  m.addEventListener("keydown",e=>{
    if(e.key==="Escape") close();
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){ e.preventDefault(); const bs=[...m.querySelectorAll(".pop button")]; const i=bs.indexOf(document.activeElement); bs[(i+(e.key==="ArrowDown"?1:-1)+bs.length)%bs.length]?.focus(); }
  });
  document.body.append(m); m.querySelector(".pop button")?.focus();
}
