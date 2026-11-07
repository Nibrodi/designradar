const {chromium}=require('playwright');
(async()=>{ const [,,src,out]=process.argv;
 const b=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--allow-file-access-from-files']});
 const p=await b.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
 await p.goto('file://'+src); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(300);
 const m=await p.evaluate(()=>{const s=document.getElementById('store').getBoundingClientRect(),f=document.getElementById('foot').getBoundingClientRect();
   const fonts=[...document.fonts].map(f=>f.family+':'+f.status); return {storeTop:s.top,storeBottom:s.bottom,footTop:f.top,gap:f.top-s.bottom,fonts};});
 console.log(JSON.stringify(m));
 await p.screenshot({path:out}); await b.close(); })();
