/* ---------- сколько низа страницы прячет приложение Claude ----------
   В мобильном Claude страница бывает выше видимой области: её низ уходит под край экрана, пока приложение не спрячет свою шапку.
   IntersectionObserver во фрейме меряет пересечение с настоящим экраном, поэтому невидимая полоска у нижнего края
   показывает, сколько пикселей скрыто. На эту величину поднимаем нижнюю панель и подвал редактора. */
(function(){
  if(!("IntersectionObserver" in window)) return;
  const probe=document.createElement("div"); probe.className="hostprobe"; probe.setAttribute("aria-hidden","true");
  const start=()=>{ document.body.append(probe);
    const th=[]; for(let i=0;i<=240;i++) th.push(i/240);
    new IntersectionObserver(es=>{ for(const e of es){
      const full=e.boundingClientRect.height||240;
      let clip=Math.round(full-e.intersectionRect.height);
      if(!e.isIntersecting) clip=0;            // полоска не видна совсем — данных нет, не сдвигаем
      clip=Math.max(0,Math.min(clip,160));
      document.documentElement.style.setProperty("--hostclip",clip+"px");
    } },{threshold:th}).observe(probe); };
  if(document.body) start(); else document.addEventListener("DOMContentLoaded",start);
})();
