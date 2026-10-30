/* ---------- data ---------- */
const postsCol = () => db.collection("posts");
const ideasCol = () => db.collection("ideas");
/* Посты авторов живут в byauthor/<uid>/posts: правила базы дают автору писать только туда. Общие посты (posts) пишет только главный редактор. */
const authorCol = uid => db.collection("byauthor/"+uid+"/posts");
const baseOf = id => (S.baseOverride&&S.baseOverride[id]) || ((S.posts.find(p=>p.id===id)||{})._base) || "posts";
const mayEdit = a => !!a && (S.owner || (S.canWrite && (a._base||"posts")!=="posts" && (a.author||"")===S.me));
function mergePosts(){
  const extra=[]; for(const arr of Object.values(S.authorPosts||{})) extra.push(...arr);
  S.posts=[...(S.mainPosts||[]), ...extra.filter(p=>p.status!=="moved")];
}
const authorSubs={};
function watchAuthors(){
  const ids=new Set(Object.keys(S.edRaw||{})); if(S.realMe) ids.add(S.realMe); if(S.realOwner) ids.add(TEST_ID);
  for(const uid of ids){ if(authorSubs[uid]) continue;
    authorSubs[uid]=authorCol(uid).onSnapshot(snap=>{ S.authorPosts=S.authorPosts||{}; S.authorPosts[uid]=snap.docs.map(d=>({id:d.id,...d.data(),_base:"byauthor/"+uid+"/posts"})); mergePosts(); render(); resolveNames(); syncEditor(); setTimeout(prepareEditorPosts,1500); }, ()=>{}); }
}
function mergeEditors(){ S.editors={}; const ids=new Set([...Object.keys(S.edRaw||{}),...Object.keys(S.roles||{})]); for(const id of ids){ const r=(S.roles||{})[id]||{}; S.editors[id]={...((S.edRaw||{})[id]||{}), status:r.status||"", can_publish:!!r.can_publish}; } }
const setRole=(id,patch)=>db.doc("roles/"+id).set({...((S.roles||{})[id]||{}), ...patch, updated_at:Date.now(), by:S.realMe||""});
/* Главный редактор забирает пост автора в общую ленту перед публикацией: публикует только то, что лежит в posts. */
async function adoptPost(a){
  if(!S.owner || (a._base||"posts")==="posts") return a;
  const {_base, ...data}=JSON.parse(JSON.stringify(a)); delete data.id;
  await postsCol().doc(a.id).set({...data, adopted_from:_base, adopted_at:Date.now()});
  await db.collection(_base).doc(a.id).update({status:"moved", moved_to:"posts/"+a.id, updated_at:Date.now()});
  S.baseOverride=S.baseOverride||{}; S.baseOverride[a.id]="posts";
  return {...a, _base:"posts"};
}
function byView(v){
  const p=S.posts.filter(authorOk);
  if(v==="review") return p.filter(x=>["review","queued","publishing","publish_unknown"].includes(x.status)).sort((a,b)=>(b.updated_at||0)-(a.updated_at||0));
  if(v==="plan") return p.filter(x=>x.status==="scheduled").sort((a,b)=>(a.scheduled_at||0)-(b.scheduled_at||0));
  if(v==="drafts") return p.filter(x=>x.status==="draft").sort((a,b)=>(b.updated_at||0)-(a.updated_at||0));
  if(v==="published") return p.filter(x=>x.status==="published").sort((a,b)=>(b.published_at||0)-(a.published_at||0));
  return [];
}
async function savePost(id, patch){
  const {_base, ...clean}=patch;
  await db.collection(baseOf(id)).doc(id).update({...clean, updated_at:Date.now()});
}

