/* ---------- boot ---------- */
function route(){ const hv=location.hash.replace("#","");
  if(/^invite=/.test(hv)){ S.inviteCode=hv.slice(7).replace(/[^A-Za-z0-9_-]/g,"").slice(0,40); try{ localStorage.setItem("dr_invite",S.inviteCode); }catch(_){} history.replaceState(null,"",location.pathname+location.search+"#review"); }
  const v=location.hash.replace("#",""); S.view=VIEWS.some(x=>x.id===v)?v:"review"; S.confirm=null; render(); }
window.addEventListener("hashchange",route);
async function resolveNames(){
  if(!user) return;
  const ids=[...new Set([...S.posts.map(p=>p.author),...S.ideas.map(i=>i.author),...Object.keys(S.editors)].filter(x=>x&&x!=="claude"))];
  if(!ids.length) return;
  try{ const ps=await user.profiles(ids); for(const id of ids) S.names[id]=(ps[id]&&ps[id].name)||"Редактор"; render(); }catch{}
}
route();
(async()=>{
  const c=window.claude;
  if(!c||!c.use){ S.dbOk=false; render(); return; }
  [db,user,mcp,sample,assets]=await Promise.all(["db","user","mcp","sample","assets"].map(n=>c.use(n).catch(()=>null)));
  if(!db){ S.dbOk=false; render(); return; }
  S.dbOk=true;
  if(user){
    try{ S.owner=await user.isOwner(); }catch{}
    try{ const can=await user.can("data.write"); S.canWrite=can!==false; }catch{ S.canWrite=true; }
    try{ S.me=await user.id(); }catch{}
    try{ const me=await user.me(); S.myName=me&&me.name?me.name:""; }catch{}
    S.realOwner=S.owner; S.realMe=S.me;
    let t=false; try{ t=localStorage.getItem("dr_test")==="1"; }catch(_){}
    if(t && S.realOwner){ S.test=true; S.owner=false; S.me=TEST_ID; }
    renderWho();
  }
  postsCol().onSnapshot(snap=>{ S.posts=snap.docs.map(d=>({id:d.id,...d.data()})); S.ready=true; render(); resolveNames(); syncEditor(); setTimeout(prepareEditorPosts,1500); }, ()=>{ S.ready=true; render(); });
  ideasCol().onSnapshot(snap=>{ S.ideas=snap.docs.map(d=>({id:d.id,...d.data()})); render(); });
  db.collection("editors").onSnapshot(snap=>{ S.editors={}; snap.docs.forEach(d=>S.editors[d.id]=d.data()); S.editorsLoaded=true; applyBlock(); render(); if(!$("#sheetRoot").firstChild && !S.blocked) checkOnboarding(); });
  db.collection("settings").onSnapshot(snap=>{ const d=snap.docs.find(x=>x.id==="main"); S.settings=d?d.data():{}; if(S.owner) render(); }, ()=>{});
  db.collection("invites").onSnapshot(snap=>{ S.invites=snap.docs.map(d=>({id:d.id,...d.data()})); if(S.owner) render(); matchInvite(); }, ()=>{});
  if(S.realMe && S.canWrite){ try{ const r=db.doc("editors/"+S.realMe); const g=await r.get(); if(!g.exists) await r.set({column:"", joined_at:Date.now()}); }catch{} }
})();
})();
