(() => {
"use strict";
const CHANNEL = "@designradar_lab"; /* канал по умолчанию; можно переопределить в settings/main.channel или полем поста channel */
const MAKE = "Make";
const TOOL_TG = "s6801242_dr_util_telegram_api";
const TOOL_COVER = "s6749993_design_radar_2000640";
const SCN_PHOTO = 6841226;
const LIMIT = 3900;
const VIEWS = [
  {id:"review", name:"На согласовании", short:"Ревью"},
  {id:"plan", name:"План"},
  {id:"drafts", name:"Черновики", short:"Черновики"},
  {id:"ideas", name:"Идеи"},
  {id:"published", name:"Опубликовано", short:"Вышло"},
  {id:"linkedin", name:"LinkedIn", short:"LinkedIn", owner:true},
  {id:"team", name:"Колонки", short:"Команда"}
];
const S = {posts:[], ideas:[], li:[], invites:[], settings:{}, editors:{}, me:null, owner:false, canWrite:false, view:"review", ready:false, dbOk:null, confirm:null, busy:{}, errors:{}, names:{}};
let db=null, user=null, mcp=null, sample=null, assets=null, downloads=null;

const $ = (s, r=document) => r.querySelector(s);
const h = (tag, attrs={}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(attrs||{})) {
    if (v==null || v===false) continue;
    if (k==="class") el.className=v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k==="text") el.textContent=v;
    else el.setAttribute(k, v===true?"":v);
  }
  for (const k of kids.flat()) if (k!=null && k!==false) el.append(k.nodeType?k:document.createTextNode(String(k)));
  return el;
};
const esc = v => String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const plain = v => String(v||"").replace(/\*\*|__/g,"").replace(/\[([^\]\n]+)\]\([^)\s]+\)/g,"$1").trim();
const ago = ms => { if(!ms) return ""; const d=(Date.now()-ms)/60000; if(d<1) return "только что"; if(d<60) return Math.round(d)+" мин назад"; if(d<1440) return Math.round(d/60)+" ч назад"; return new Date(ms).toLocaleDateString("ru-RU",{day:"numeric",month:"short"}); };
const toast = msg => { const r=$("#toastRoot"); r.replaceChildren(h("div",{class:"toast",text:msg})); clearTimeout(toast.t); toast.t=setTimeout(()=>r.replaceChildren(),3200); };
const authorName = id => id==="claude"||!id ? "Редакция" : ((S.editors[id]&&S.editors[id].sign) || (id===TEST_ID?"Тестовый редактор":"") || S.names[id] || "Редактор");
const TEST_ID="test_editor";
const authorOk = p => !S.author || S.author==="all" || (p.author||"claude")===S.author;

