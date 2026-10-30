/* ---------- data ---------- */
const postsCol = () => db.collection("posts");
const ideasCol = () => db.collection("ideas");
function byView(v){
  const p=S.posts.filter(authorOk);
  if(v==="review") return p.filter(x=>["review","queued","publishing","publish_unknown"].includes(x.status)).sort((a,b)=>(b.updated_at||0)-(a.updated_at||0));
  if(v==="plan") return p.filter(x=>x.status==="scheduled").sort((a,b)=>(a.scheduled_at||0)-(b.scheduled_at||0));
  if(v==="drafts") return p.filter(x=>x.status==="draft").sort((a,b)=>(b.updated_at||0)-(a.updated_at||0));
  if(v==="published") return p.filter(x=>x.status==="published").sort((a,b)=>(b.published_at||0)-(a.published_at||0));
  return [];
}
async function savePost(id, patch){
  const ref=postsCol().doc(id);
  await ref.update({...patch, updated_at:Date.now()});
}

