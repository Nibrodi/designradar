/* ---------- логотип «ДР»: чаша «Р» — радар, белый сектор — луч ----------
   Один рисунок на всю панель: шапка, загрузка, пустые состояния, аватар канала в превью Telegram.
   Луч вращается вокруг белой точки; рамка-полукольцо (clipPath #drRing в body.html) прячет его слева,
   поэтому на логотипе он виден только внутри «Р» — как засечка на экране радара. */
const DR_LOGO_INNER='<rect class="lg-bg" width="206.58" height="206.58"/>'+
  '<g class="lg-mk"><rect x="85.87" y="53.79" width="19.66" height="95.31"/><rect x="110.23" y="53.79" width="19.66" height="95.31"/>'+
  '<rect x="35.56" y="122.91" width="19.66" height="26.19"/><rect x="45.82" y="122.91" width="49.88" height="14.49"/>'+
  '<polygon points="88.53 53.79 67.58 53.79 42.06 127.56 63.02 127.56 88.53 53.79"/>'+
  '<path d="M129.9,137.4c23.09,0,41.81-18.72,41.81-41.81s-18.72-41.81-41.81-41.81v16.27c14.1,0,25.53,11.43,25.53,25.53s-11.43,25.53-25.53,25.53v16.27Z"/></g>'+
  '<g clip-path="url(#drRing)"><polygon class="lg-beam" points="129.9 95.59 162.75 62.24 176.5 90.68 129.9 95.59"/></g>'+
  '<g clip-path="url(#drBowl)"><circle class="lg-ping" cx="129.9" cy="95.59" r="7.26"/></g><circle class="lg-dot" cx="129.9" cy="95.59" r="7.26"/>';
/* mode: "" — статичный, "live" — редкий проход луча (шапка), "load" — сборка букв и непрерывный луч (загрузка) */
const logoSvg=(mode="", extra="")=>'<svg class="drlogo '+mode+' '+extra+'" viewBox="0 0 206.58 206.58" aria-hidden="true" focusable="false">'+DR_LOGO_INNER+'</svg>';
const logoEl=(mode="", extra="")=>{ const s=h("span",{class:"lgwrap"}); s.innerHTML=logoSvg(mode,extra); return s.firstChild; };
function mountBrandLogo(){
  const a=document.getElementById("brandLogo"); if(!a || a.firstChild) return;
  a.innerHTML=logoSvg("live");
  /* клик по логотипу: луч делает быстрый круг, панель возвращается к согласованию */
  a.addEventListener("click",()=>{ const s=a.firstChild; s.classList.remove("ping"); void s.getBoundingClientRect(); s.classList.add("ping"); window.scrollTo({top:0}); });
  a.firstChild.addEventListener("animationend",e=>{ if(e.animationName==="drSpinOnce") a.firstChild.classList.remove("ping"); });
}
function loaderEl(text){
  return h("div",{class:"loader",role:"status","aria-live":"polite"}, logoEl("load"), h("b",{text:text||"Загружаю редакцию…"}));
}
mountBrandLogo();
