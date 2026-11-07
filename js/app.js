"use strict";
/* L'Île aux Révisions : logique de l'application */
const app=document.getElementById("app");
const esc=s=>String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/* ---------- jours et semaines (jour = nombre de jours depuis 1970, heure locale) ---------- */
const today=()=>{const d=new Date();return Math.floor((d.getTime()-d.getTimezoneOffset()*60000)/864e5)};
const dayOf=s=>{const[y,m,d]=String(s).split("-").map(Number);return Math.floor(Date.UTC(y,m-1,d)/864e5)};
const weekStart=d=>d-((d+3)%7); // lundi

/* ---------- réglages ---------- */
const GOAL_WEEK=4;      // jours d'exploration visés par semaine
const DAY_MIN=5;        // réponses pour qu'une journée compte
const EXP_SIZE=10;      // questions par expédition du jour
const EXAM_SIZE=20;     // questions en mode examen
const LEVEL_SIZE=8;     // questions par niveau
const PASS=70;          // % pour débloquer la suite
const INT=[0,1,3,7,14,30,60]; // répétition espacée : jours avant le rappel, par boîte
// Rangs : [XP, nom, niveau minimum exigé dans chaque matière réelle]
const RANKS=[[0,"Naufragé",0],[100,"Survivant",0],[250,"Explorateur",0],[450,"Éclaireur",0],[700,"Aventurier",0],[1000,"Pisteur",0],[1400,"Grimpeur",0],[1900,"Navigateur",0],[2500,"Bâtisseur",1],[3300,"Cartographe",1],[4300,"Chasseur de trésors",2],[5500,"Capitaine",2],[7000,"Gardien du phare",3],[9000,"Sage du village",3],[11500,"Chef d'expédition",4],[14500,"Maître de l'île",4],[18000,"Héros de l'île",5],[22000,"Légende de l'île",6],[27000,"Mythe de l'île",7],[33000,"Gardien de l'île",8]];
const ITEMS=[[0,"🎒","Sac à dos"],[250,"🔦","Lampe torche"],[700,"🧭","Boussole"],[1400,"🔭","Longue-vue"],[2500,"⛺","Campement"],[4300,"🛶","Canoë"],[7000,"🗝️","Clé ancienne"],[11500,"📜","Carte au trésor"],[18000,"⛵","Voilier"],[27000,"👑","Couronne"],[33000,"💎","Trésor de l'île"]];
// Pondération des XP (anti-« farming »)
const XP_SOON=0.3;              // question revue avant sa date de rappel
const DAY_CAP=[[150,1],[300,0.5],[Infinity,0.2]]; // XP par matière et par jour -> multiplicateur
const HERO='<svg viewBox="0 0 64 64" width="60" height="60" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#ffc85733"/><path d="M12 62 Q32 44 52 62Z" fill="#3e8e7e"/><circle cx="32" cy="36" r="13" fill="#f2c9a0"/><path d="M20 26 Q32 6 44 26Z" fill="#b07d45"/><ellipse cx="32" cy="26" rx="21" ry="5" fill="#8b5a2b"/><rect x="21" y="22" width="22" height="3" fill="#5c3a1a"/><circle cx="27" cy="37" r="1.8" fill="#222"/><circle cx="37" cy="37" r="1.8" fill="#222"/><path d="M27 43 Q32 47 37 43" stroke="#222" stroke-width="1.6" fill="none"/></svg>';

/* ---------- état sauvegardé ---------- */
const KEY="revisions-5a-v1";
const blank=()=>({v:1,xp:0,best:{},srs:{},days:{},chests:{},streak:{},qdone:{},qbest:{}});
let S=blank();
try{const raw=localStorage.getItem(KEY);if(raw)S=Object.assign(blank(),JSON.parse(raw))}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}

/* ---------- contenu ---------- */
let COURS=[],QUESTS=[];const QIDX={};
function hash(s){let h=5381;for(let i=0;i<s.length;i++)h=((h<<5)+h+s.charCodeAt(i))|0;return(h>>>0).toString(36)}
function makeLevels(qs){
 const sorted=qs.slice().sort((a,b)=>(a.n||1)-(b.n||1)),L=[];
 for(let i=0;i<sorted.length;i+=LEVEL_SIZE)L.push(sorted.slice(i,i+LEVEL_SIZE));
 if(L.length>1&&L[L.length-1].length<4)L[L.length-2]=L[L.length-2].concat(L.pop());
 return L;
}
async function load(){
 const idx=await fetch("data/cours.json",{cache:"no-cache"}).then(r=>r.json());
 COURS=idx.cours;
 QUESTS=await fetch("data/quetes.json",{cache:"no-cache"}).then(r=>r.ok?r.json():{quetes:[]}).then(d=>d.quetes||[]).catch(()=>[]);
 await Promise.all(COURS.flatMap(c=>c.chapitres.map(ch=>
  fetch("data/"+c.id+"/"+ch.fichier,{cache:"no-cache"}).then(r=>{if(!r.ok)throw 0;return r.json()})
   .then(d=>{ch.q=d.questions||[];ch.fiche=d.fiche||null}).catch(()=>{ch.q=[];ch.err=true}))));
 COURS.forEach(c=>c.chapitres.forEach(ch=>{
  const seen={};
  ch.q.forEach(q=>{const base=q.gen?"gen:"+q.gen:String(q.q);seen[base]=(seen[base]||0)+1;
   q.id=c.id+"/"+ch.id+"/"+hash(base)+(seen[base]>1?"-"+seen[base]:"");QIDX[q.id]={q,c,ch}});
  ch.levels=makeLevels(ch.q);
 }));
}
const course=id=>COURS.find(c=>c.id===id);
const chap=(cid,chid)=>course(cid).chapitres.find(x=>x.id===chid);
const isActive=ch=>!ch.vu||dayOf(ch.vu)<=today();
const activeChaps=()=>COURS.flatMap(c=>c.chapitres.filter(ch=>isActive(ch)&&ch.q.length));

/* ---------- répétition espacée ---------- */
function srsUpdate(id,ok){const t=today(),cur=S.srs[id];if(ok&&cur&&cur[1]>t)return;let b=(cur||[0])[0];b=ok?Math.min(b+1,INT.length-1):0;S.srs[id]=[b,t+(ok?INT[b]:1)]}
const dueIds=()=>{const t=today();return Object.keys(S.srs).filter(id=>QIDX[id]&&isActive(QIDX[id].ch)&&S.srs[id][1]<=t)};
const mastery=ch=>ch.q.length?Math.round(ch.q.filter(q=>(S.srs[q.id]||[0])[0]>=3).length/ch.q.length*100):0;

function buildExpedition(){
 const due=dueIds().sort((a,b)=>S.srs[a][1]-S.srs[b][1]).slice(0,Math.ceil(EXP_SIZE*0.6)).map(id=>QIDX[id].q);
 const picked=new Set(due.map(q=>q.id));
 const qch=new Set(activeQuests().filter(qu=>qu.days<=7).flatMap(qu=>qu.chapitres));
 const prio=ch=>qch.has(QIDX[ch.q[0].id].c.id+"/"+ch.id)?1e6:(ch.vu?dayOf(ch.vu):0);
 const chs=shuffle(activeChaps()).sort((a,b)=>prio(b)-prio(a));
 const fresh=[];
 for(const ch of chs){if(due.length+fresh.length>=EXP_SIZE)break;
  shuffle(ch.q.filter(q=>!S.srs[q.id]&&!picked.has(q.id))).slice(0,prio(ch)>=1e6?5:3).forEach(q=>{if(due.length+fresh.length<EXP_SIZE){fresh.push(q);picked.add(q.id)}})}
 let all=due.concat(fresh);
 if(all.length<EXP_SIZE){const rest=shuffle(chs.flatMap(ch=>ch.q).filter(q=>!picked.has(q.id)));all=all.concat(rest.slice(0,EXP_SIZE-all.length))}
 return shuffle(all);
}

/* ---------- quêtes de contrôle ---------- */
const QUEST_GOAL=80; // % de questions réussies 2 fois d'affilée
function activeQuests(){const t=today();return QUESTS.map(qu=>Object.assign({},qu,{days:dayOf(qu.date)-t})).filter(qu=>qu.days>=0).sort((a,b)=>a.days-b.days)}
function questQs(qu){return qu.chapitres.flatMap(k=>{const[c,h]=k.split("/"),co=course(c),ch=co&&co.chapitres.find(x=>x.id===h);return ch?ch.q:[]})}
function questMastery(qu){const qs=questQs(qu);return qs.length?Math.round(qs.filter(q=>(S.streak[q.id]||0)>=2).length/qs.length*100):0}
function questSeen(qu){const qs=questQs(qu);return[qs.filter(q=>S.streak[q.id]!==undefined).length,qs.length]}
function questReady(qu){const[v,n]=questSeen(qu);return v===n&&questMastery(qu)>=QUEST_GOAL}
const dateLabel=s=>{const[y,m,d]=s.split("-").map(Number);return new Date(Date.UTC(y,m-1,d)).toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long",timeZone:"UTC"})};
const countdown=n=>n===0?"aujourd'hui":n===1?"demain":"dans "+n+" jours";
function startQuest(id,exam){const qu=QUESTS.find(x=>x.id===id),qs=questQs(qu);if(!qs.length)return;
 let queue;if(exam)queue=shuffle(qs).slice(0,20);
 else{const w=q=>S.streak[q.id]===undefined?-1:S.streak[q.id];queue=shuffle(shuffle(qs).sort((a,b)=>w(a)-w(b)).slice(0,10))}
 begin({mode:exam?"qexam":"quest",questId:id,title:exam?"Contrôle blanc":"Quête",queue})}

/* ---------- progression : rangs, objets, semaine ---------- */
const realCourses=()=>COURS.filter(c=>!c.exemple&&c.chapitres.some(ch=>isActive(ch)&&ch.q.length));
function zoneMastery(c){const qs=c.chapitres.filter(ch=>isActive(ch)).flatMap(ch=>ch.q);return qs.length?qs.filter(q=>(S.srs[q.id]||[0])[0]>=3).length/qs.length:0}
const zoneLevel=c=>Math.min(10,Math.floor(zoneMastery(c)*10));
function minZone(){const rc=realCourses();if(!rc.length)return{lvl:0,c:null};let m=rc[0];rc.forEach(c=>{if(zoneLevel(c)<zoneLevel(m))m=c});return{lvl:zoneLevel(m),c:m}}
function rankIdx(){const mz=minZone().lvl;let i=0;while(i+1<RANKS.length&&S.xp>=RANKS[i+1][0]&&mz>=RANKS[i+1][2])i++;i=Math.max(i,S.rankMax||0);if(i>(S.rankMax||0)){S.rankMax=i;save()}return i}
function rank(){const i=rankIdx(),cur=RANKS[i],nx=RANKS[i+1];
 const blocked=nx&&S.xp>=nx[0]?minZone():null;
 return{name:cur[1],next:nx?nx[1]:null,pct:nx?Math.min(100,Math.round((S.xp-cur[0])/(nx[0]-cur[0])*100)):100,left:nx?Math.max(0,nx[0]-S.xp):0,blocked,need:nx?nx[2]:0}}
function xpGain(base,q,wasSoon){const cid=QIDX[q.id].c.id,t=today();S.dayxp=S.dayxp||{};if(S.dayxp.d!==t)S.dayxp={d:t};const done=S.dayxp[cid]||0;
 let m=1;for(const[lim,k] of DAY_CAP)if(done<lim){m=k;break}
 const g=Math.max(1,Math.round(base*m*(wasSoon?XP_SOON:1)));S.dayxp[cid]=done+g;return{g,why:wasSoon?"déjà revue récemment":m<1?"beaucoup de "+QIDX[q.id].c.nom+" aujourd'hui":""}}
function itemAt(x){let it=null;ITEMS.forEach(i=>{if(x>=i[0])it=i});return it}
function weekInfo(){const t=today(),ws=weekStart(t),days=[];let n=0;
 for(let d=ws;d<ws+7;d++){const ok=(S.days[d]||0)>=DAY_MIN;if(ok)n++;days.push({ok,today:d===t,future:d>t})}
 return{ws,days,n,chest:!!S.chests[ws]}}

const stars=p=>p>=90?3:p>=PASS?2:p>=50?1:0;
const starHtml=n=>'<span class="stars">'+"★".repeat(n)+'<span class="off">'+"★".repeat(3-n)+"</span></span>";
const lvlKey=(cid,chid,k)=>cid+"/"+chid+"/"+k;
function levelOpen(cid,chid,k){
 const ch=chap(cid,chid);
 if(k==="G")return ch.levels.every((_,i)=>(S.best[lvlKey(cid,chid,i)]||0)>=PASS);
 return k===0||(S.best[lvlKey(cid,chid,k-1)]||0)>=PASS;
}

/* ---------- écrans ---------- */
let sess=null,armed=null;
function go(h){app.innerHTML=h;window.scrollTo(0,0)}

function renderHome(){
 sess=null;armed=null;
 const r=rank(),w=weekInfo(),due=dueIds().length,L="LMMJVSD";
 let h='<h1>L\'Île aux Révisions</h1><div class="sub">Explore l\'île, un cours par zone</div>';
 h+='<div class="hero">'+HERO+'<div style="flex:1"><div class="rank">'+esc(r.name)+' · '+S.xp+' XP</div><div class="xpbar"><i style="width:'+r.pct+'%"></i></div>'+
  '<div class="sub small">'+(r.next?(r.blocked?"Rang "+esc(r.next)+" : il faut le niveau "+r.need+" dans toutes les matières ("+esc(r.blocked.c?r.blocked.c.nom:"")+" : niveau "+r.blocked.lvl+")":r.left+" XP avant le rang "+esc(r.next)):"Rang maximum")+'</div>'+
  '<div class="inv">'+ITEMS.map(it=>'<span class="'+(S.xp>=it[0]?"":"lock")+'" title="'+esc(it[2])+(S.xp>=it[0]?"":" ("+it[0]+" XP)")+'">'+it[1]+'</span>').join("")+'</div></div></div>';
 h+='<div class="card week"><div class="row"><b>Cette semaine</b><span class="sub">'+Math.min(w.n,GOAL_WEEK)+' / '+GOAL_WEEK+' jours'+(w.chest?" · coffre ouvert":"")+'</span></div><div class="days">'+
  w.days.map((d,i)=>'<span class="d'+(d.ok?" ok":"")+(d.today?" now":"")+'">'+L[i]+'</span>').join("")+'</div>'+
  (w.chest?"":'<div class="sub small">'+GOAL_WEEK+' jours d\'exploration ('+DAY_MIN+' réponses par jour) -> coffre de 100 XP</div>')+'</div>';
 activeQuests().forEach(qu=>{const m=questMastery(qu),n=questQs(qu).length,b=S.qbest[qu.id];
  h+='<div class="card quest"><div class="row"><b>⚔️ Quête : '+esc(qu.titre)+'</b></div><div class="sub small">'+esc(dateLabel(qu.date))+' ('+countdown(qu.days)+') · '+n+' questions</div>'+
   '<div class="row small" style="margin-top:8px"><span>Vues : '+questSeen(qu)[0]+'/'+n+' · maîtrisées : '+m+' %'+(S.qdone[qu.id]?" ✓":"")+'</span>'+(b!==undefined?'<span>Contrôle blanc : '+b+'/20</span>':"")+'</div><div class="xpbar"><i style="width:'+m+'%"></i></div>'+
   '<div class="tools"><button class="btn" onclick="startQuest(\''+qu.id+'\',false)">S\'entraîner</button><button class="btn sec" onclick="startQuest(\''+qu.id+'\',true)">Contrôle blanc</button></div>'+
   qu.chapitres.map(k=>{const[cc,hh]=k.split("/"),co=course(cc),cp=co&&co.chapitres.find(x=>x.id===hh);return cp&&cp.fiche?'<button class="train fiche-btn" style="margin-top:8px" onclick="renderFiche(\''+cc+'\',\''+hh+'\',true)">📄 Fiche : '+esc(cp.titre)+'</button>':""}).join("")+'</div>'});
 h+='<button class="btn hero-btn" onclick="startExpedition()">Expédition du jour<small>'+(due?due+" rappel"+(due>1?"s":"")+" prêt"+(due>1?"s":"")+" + nouvelles questions":"Nouvelles questions")+' · '+EXP_SIZE+' questions, arrêt possible à tout moment</small></button>';
 h+='<div class="grid">';
 COURS.forEach(c=>{const chs=c.chapitres.filter(ch=>ch.q.length),m=chs.length?Math.round(chs.reduce((s,ch)=>s+mastery(ch),0)/chs.length):0;
  h+='<button class="pcard" style="--c:'+esc(c.couleur)+'" onclick="renderZone(\''+c.id+'\')"><div class="zone">'+esc(c.icone)+'</div><div class="pname">'+esc(c.zone)+'</div><div class="pmeta">'+esc(c.nom)+'<br>'+c.chapitres.length+' chapitre'+(c.chapitres.length>1?"s":"")+' · '+(c.exemple?'exemple':'niveau '+zoneLevel(c)+' · maîtrise '+m+' %')+'</div></button>'});
 h+='</div><div class="tools"><button class="btn sec" onclick="renderCard()">🪪 Ma carte</button><button class="btn sec" onclick="renderExam()">Mode examen</button><button class="btn sec" onclick="renderGuide()">❓ Guide</button><button class="btn sec" onclick="renderSave()">Sauvegarde</button></div>';
 h+='<div class="note">Rien n\'est jamais bloqué : l\'entraînement libre reste ouvert sur tous les chapitres.</div>';
 go(h);
}

function renderZone(cid){
 const c=course(cid);
 let h='<button class="back" onclick="renderHome()">&lt;- L\'île</button><div class="center" style="--c:'+esc(c.couleur)+'"><div class="zone big">'+esc(c.icone)+'</div><h1>'+esc(c.zone)+'</h1><div class="sub">'+esc(c.nom)+'</div></div><div style="height:14px"></div>';
 const nmix=c.chapitres.filter(ch=>isActive(ch)&&ch.q.length).length,bm=S.qbest["mix/"+c.id];
 if(nmix>=2)h+='<button class="btn hero-btn" onclick="startMixed(\''+c.id+'\')">🎯 Quiz mixte<small>'+MIX_SIZE+' questions sur les '+nmix+' chapitres'+(bm!==undefined?' · meilleure note '+fmt(bm)+'/20':'')+'</small></button>';
 if(!c.chapitres.length)h+='<div class="card sub">Aucun chapitre pour l\'instant.</div>';
 c.chapitres.forEach(ch=>{
  h+='<div class="chap" style="--c:'+esc(c.couleur)+'"><h3>'+esc(ch.titre)+'</h3>';
  if(ch.err){h+='<div class="sub">Fichier introuvable ou invalide : data/'+esc(c.id)+'/'+esc(ch.fichier)+'</div></div>';return}
  if(!isActive(ch))h+='<div class="sub small">Pas encore vu en classe (à partir du '+esc(ch.vu)+'), hors expéditions.</div>';
  const m=mastery(ch);
  const ec=inProgress(ch.q),ep=ch.q.length?Math.round(ec/ch.q.length*100):0;
  h+='<div class="sub small">'+ch.q.length+' questions · '+ec+' en cours · maîtrise '+m+' %</div><div class="xpbar dual"><i style="width:'+m+'%;background:var(--c)"></i><i class="ec" style="width:'+ep+'%;background:var(--c)"></i></div><div class="lvls">';
  ch.levels.forEach((_,k)=>{const open=levelOpen(c.id,ch.id,k),b=S.best[lvlKey(c.id,ch.id,k)];
   h+='<button class="lv'+(open?"":" locked")+'" '+(open?'onclick="startLevel(\''+c.id+'\',\''+ch.id+'\','+k+')"':"disabled")+'><b>'+(open?k+1:"🔒")+'</b>'+(open?starHtml(stars(b||0)):'<span class="stars off">-</span>')+'</button>'});
  const go_=levelOpen(c.id,ch.id,"G"),bg=S.best[lvlKey(c.id,ch.id,"G")];
  h+='<button class="lv boss'+(go_?"":" locked")+'" '+(go_?'onclick="startLevel(\''+c.id+'\',\''+ch.id+'\',\'G\')"':"disabled")+'><b>'+(go_?"Gardien":"🔒 Gardien")+'</b>'+(go_?starHtml(stars(bg||0)):"")+'</button></div>';
  h+='<div class="tools"><button class="train" onclick="startTrain(\''+c.id+'\',\''+ch.id+'\')">Entraînement libre</button>'+(ch.fiche?'<button class="train fiche-btn" onclick="renderFiche(\''+c.id+'\',\''+ch.id+'\')">📄 Fiche récap</button>':'')+'</div></div>'});
 h+='<div class="note">Un niveau se débloque à '+PASS+' % au niveau précédent. Le Gardien apparaît quand tous les niveaux sont réussis.</div>';
 go(h);
}

let examSel=new Set();
function renderExam(){
 let h='<button class="back" onclick="renderHome()">&lt;- L\'île</button><h1>Mode examen</h1><div class="sub">Choisis les chapitres d\'une interro ou d\'une session : '+EXAM_SIZE+' questions mélangées.</div><div style="height:12px"></div>';
 COURS.forEach(c=>{const chs=c.chapitres.filter(ch=>ch.q.length);if(!chs.length)return;
  h+='<div class="card"><b>'+esc(c.icone)+' '+esc(c.nom)+'</b>';
  chs.forEach(ch=>{const k=c.id+"/"+ch.id;h+='<label class="chk"><input type="checkbox" '+(examSel.has(k)?"checked":"")+' onchange="toggleExam(\''+k+'\',this.checked)"> '+esc(ch.titre)+'</label>'});
  h+='</div>'});
 h+='<button class="btn" id="exgo" '+(examSel.size?"":"disabled")+' onclick="startExam()">Lancer ('+examSel.size+' chapitre'+(examSel.size>1?"s":"")+')</button>';
 go(h);
}
function toggleExam(k,on){if(on)examSel.add(k);else examSel.delete(k);const b=document.getElementById("exgo");b.disabled=!examSel.size;b.textContent="Lancer ("+examSel.size+" chapitre"+(examSel.size>1?"s":"")+")"}

function exportCode(){return"ILE1:"+btoa(unescape(encodeURIComponent(JSON.stringify(S))))}
function renderSave(msg){
 let h='<button class="back" onclick="renderHome()">&lt;- L\'île</button><h1>Sauvegarde</h1>';
 h+='<div class="card"><b>Exporter</b><div class="sub small">Copie ce code et garde-le (note, message à toi-même). Il permet de retrouver ta progression sur un autre téléphone ou après un nettoyage du navigateur.</div><textarea id="exp" readonly>'+esc(exportCode())+'</textarea><button class="btn" onclick="copyCode()">Copier le code</button></div>';
 h+='<div class="card"><b>Importer</b><div class="sub small">Colle un code de sauvegarde. Attention : il remplace la progression actuelle.</div><textarea id="imp" placeholder="ILE1:..."></textarea><button class="btn sec" onclick="importCode()">'+(armed==="imp"?"Confirmer le remplacement ?":"Restaurer")+'</button></div>';
 if(msg)h+='<div class="fb '+(msg[0])+'"><b>'+esc(msg[1])+'</b></div>';
 go(h);
}
function copyCode(){const t=document.getElementById("exp");try{navigator.clipboard.writeText(t.value).then(()=>renderSave(["ok","Code copié."]),()=>{t.select()})}catch(e){t.select()}}
function importCode(){
 const v=(document.getElementById("imp").value||"").trim();
 if(armed!=="imp"){armed="imp";renderSave();document.getElementById("imp").value=v;return}
 armed=null;
 try{if(!v.startsWith("ILE1:"))throw 0;const d=JSON.parse(decodeURIComponent(escape(atob(v.slice(5)))));if(typeof d.xp!=="number")throw 0;S=Object.assign(blank(),d);save();renderSave(["ok","Progression restaurée."])}
 catch(e){renderSave(["ko","Code invalide."])}
}

/* ---------- fiches récapitulatives ---------- */
const rich=t=>esc(t).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/\*(.+?)\*/g,"<i>$1</i>");
function sectionsHtml(secs,col){let h="";(secs||[]).forEach(sec=>{h+='<div class="card fiche" style="--c:'+esc(col)+'"><h3>'+esc(sec.t)+'</h3>';
  if(sec.p)h+=sec.p.map(x=>'<p>'+rich(x)+'</p>').join("");
  if(sec.l)h+='<ul>'+sec.l.map(x=>'<li>'+rich(x)+'</li>').join("")+'</ul>';
  if(sec.tab)h+='<div class="tw"><table>'+sec.tab.map((r,i)=>'<tr>'+r.map(x=>i?'<td>'+rich(x)+'</td>':'<th>'+rich(x)+'</th>').join("")+'</tr>').join("")+'</table></div>';
  if(sec.n)h+='<div class="sub small" style="margin-top:8px">'+rich(sec.n)+'</div>';
  h+='</div>'});return h}
function renderFiche(cid,chid,fromHome){
 const c=course(cid),ch=chap(cid,chid);
 let h='<button class="back" onclick="'+(fromHome?'renderHome()':'renderZone(\''+cid+'\')')+'">&lt;- Retour</button><div class="sub">'+esc(c.icone)+' '+esc(c.nom)+'</div><h1 class="fh">'+esc(ch.titre)+'</h1>';
 h+=sectionsHtml(ch.fiche,c.couleur);
 h+='<button class="btn" onclick="startTrain(\''+cid+'\',\''+chid+'\')">S\'entraîner sur ce chapitre</button>';
 go(h);
}

/* ---------- guide ---------- */
let GUIDE=null;
async function renderGuide(){
 if(!GUIDE){try{GUIDE=await fetch("data/guide.json",{cache:"no-cache"}).then(r=>r.json())}catch(e){GUIDE={sections:[{t:"Guide indisponible",l:["Reconnecte-toi à Internet une fois pour le charger."]}]}}}
 go('<button class="back" onclick="renderHome()">&lt;- L\'île</button><h1 class="fh">❓ Guide de l\'île</h1>'+sectionsHtml(GUIDE.sections,"#ffc857"));
}

/* ---------- carte d'explorateur ---------- */
const inProgress=qs=>qs.filter(q=>{const b=(S.srs[q.id]||[0])[0];return b>=1&&b<3}).length;
function stats(){const days=Object.keys(S.days).filter(d=>S.days[d]>=DAY_MIN).length,answers=Object.values(S.days).reduce((a,b)=>a+b,0),
 mastered=Object.values(S.srs).filter(x=>x[0]>=3).length,prog=Object.values(S.srs).filter(x=>x[0]>=1&&x[0]<3).length;return{days,answers,mastered,prog,chests:Object.keys(S.chests).length,quests:Object.keys(S.qdone).length}}
function renderCard(edit){
 const r=rank(),st=stats(),it=ITEMS.filter(i=>S.xp>=i[0]),rc=realCourses(),ri=rankIdx();
 const d=new Date().toLocaleDateString("fr-BE",{day:"numeric",month:"long",year:"numeric"});
 let h='<button class="back" onclick="renderHome()">&lt;- L\'île</button>';
 h+='<div class="excard"><div class="exhead">'+HERO+'<div><div class="sub small">Carte d\'explorateur</div><div class="exname">'+esc(S.pseudo||"Explorateur anonyme")+'</div><div class="exrank">'+esc(r.name)+' · rang '+(ri+1)+'/'+RANKS.length+'</div></div></div>';
 h+='<div class="exstats"><div><b>'+S.xp.toLocaleString("fr-BE")+'</b><span>XP</span></div><div><b>'+st.days+'</b><span>jours d\'exploration</span></div><div><b>'+st.prog+'</b><span>questions en cours</span></div><div><b>'+st.mastered+'</b><span>questions maîtrisées</span></div><div><b>'+st.quests+'</b><span>quête'+(st.quests>1?"s":"")+' accomplie'+(st.quests>1?"s":"")+'</span></div></div>';
 h+='<div class="sub small" style="margin:12px 0 6px">Niveau des zones</div>';
 rc.forEach(c=>{const l=zoneLevel(c),qs=c.chapitres.filter(ch=>isActive(ch)).flatMap(ch=>ch.q),mp=Math.round(zoneMastery(c)*100),ep=qs.length?Math.round(inProgress(qs)/qs.length*100):0;
  h+='<div class="exzone"><span>'+esc(c.icone)+' '+esc(c.nom)+'</span><div class="xpbar dual" style="flex:1"><i style="width:'+mp+'%;background:'+esc(c.couleur)+'"></i><i class="ec" style="width:'+ep+'%;background:'+esc(c.couleur)+'"></i></div><b>'+l+'</b></div>'});
 h+='<div class="sub small" style="text-align:right">barre pleine : maîtrisé · barre claire : en cours · chiffre : niveau</div>';
 h+='<div class="sub small" style="margin:12px 0 6px">Objets ('+it.length+'/'+ITEMS.length+')</div><div class="inv">'+ITEMS.map(i=>'<span class="'+(S.xp>=i[0]?"":"lock")+'">'+i[1]+'</span>').join("")+'</div>';
 h+='<div class="exfoot">'+st.chests+' coffre'+(st.chests>1?"s":"")+' hebdo · '+esc(d)+'</div></div>';
 if(edit)h+='<div class="card"><b>Ton pseudo</b><input id="pseudo" class="txt" maxlength="24" value="'+esc(S.pseudo||"")+'" placeholder="Pseudo (pas ton nom complet)"><button class="btn" onclick="savePseudo()">Enregistrer</button></div>';
 else h+='<button class="btn sec" onclick="renderCard(true)">Changer de pseudo</button>';
 h+='<div class="note">Fais une capture d\'écran pour partager ta carte. Le rang ne monte qu\'en révisant toutes les matières régulièrement.</div>';
 go(h);
}
function savePseudo(){const v=(document.getElementById("pseudo").value||"").trim().slice(0,24);S.pseudo=v;save();renderCard()}

/* ---------- sessions de questions ---------- */
function inst(def){
 let g;
 if(def.gen){g=GEN[def.gen]?GEN[def.gen]():{t:"vf",q:"Générateur inconnu : "+def.gen,a:true,e:""}}
 else{g={t:def.type,q:def.q,e:def.expl||""};
  if(def.type==="qcm"){const c=shuffle(def.choix);g.c=c;g.a=c.indexOf(def.choix[0])}
  else g.a=def.rep;
  if(def.type==="ouverte")g.pts=def.points||[];
  if(def.tol)g.tol=def.tol}
 g.id=def.id;return g;
}
function begin(o){sess=Object.assign({i:0,ok:0,done:0,xp:0,xp0:S.xp,r0:rankIdx(),again:new Set(),gain:10},o);show()}
function show(){
 if(sess.i>=sess.queue.length){if(sess.endless)sess.queue=sess.queue.concat(shuffle(sess.pool));else return finish()}
 sess.cur=inst(sess.queue[sess.i]);sess.answered=false;sess.given=null;sess.revealed=false;sess.draft="";renderQuiz();
}
function nextQ(){sess.i++;show()}
function reveal(){const d=document.getElementById("draft");sess.draft=d?d.value:"";sess.revealed=true;renderQuiz()}

function startExpedition(){const q=buildExpedition();if(!q.length)return;begin({mode:"exp",title:"Expédition du jour",queue:q})}
function startLevel(cid,chid,k){const ch=chap(cid,chid);
 begin({mode:"level",cid,chid,k,title:k==="G"?"Gardien":"Niveau "+(k+1),color:course(cid).couleur,gain:k==="G"?15:10,
  queue:k==="G"?shuffle(ch.q).slice(0,10):shuffle(ch.levels[k])})}
function startTrain(cid,chid){const ch=chap(cid,chid);begin({mode:"train",cid,chid,title:"Entraînement",color:course(cid).couleur,endless:true,pool:ch.q,queue:shuffle(ch.q)})}
const MIX_SIZE=20;
function startMixed(cid){const chs=shuffle(course(cid).chapitres.filter(ch=>isActive(ch)&&ch.q.length)).map(ch=>shuffle(ch.q));const q=[];
 for(let i=0;q.length<MIX_SIZE&&chs.some(l=>l.length);i++){const l=chs[i%chs.length];if(l.length)q.push(l.pop())}
 begin({mode:"mix",cid,title:"Quiz mixte",queue:shuffle(q)})}
function startExam(){const pool=[...examSel].flatMap(k=>{const[c,h]=k.split("/");return chap(c,h).q});
 begin({mode:"exam",title:"Examen",queue:shuffle(pool).slice(0,EXAM_SIZE)})}

function check(q,g){
 if(q.t==="ouverte")return g===true;
 if(q.t==="qcm"||q.t==="vf")return g===q.a;
 if(q.t==="nombre"){const x=parseFloat(String(g).replace(/\s/g,"").replace(",","."));return!isNaN(x)&&Math.abs(x-q.a)<=(q.tol||1e-6)}
 return[].concat(q.a).map(norm).includes(norm(g));
}
const shown=q=>q.t==="qcm"?q.c[q.a]:q.t==="vf"?(q.a?"Vrai":"Faux"):q.t==="nombre"?fmt(q.a):[].concat(q.a)[0];

function answer(g){
 if(sess.answered)return;
 const q=sess.cur;
 if(q.t==="texte"||q.t==="nombre"){const el=document.getElementById("in");g=el?el.value:"";if(!g.trim())return}
 sess.answered=true;sess.given=g;const ok=check(q,g);sess.okLast=ok;sess.done++;
 const prev=S.srs[q.id],wasSoon=!!(prev&&prev[1]>today());
 srsUpdate(q.id,ok);
 S.streak[q.id]=ok?(S.streak[q.id]||0)+1:0;
 sess.lastXP=null;
 if(ok||g==="partiel"){const r=xpGain(ok?sess.gain:sess.gain/2,q,wasSoon);S.xp+=r.g;sess.xp+=r.g;sess.lastXP=r}
 if(ok)sess.ok++;
 else if((sess.mode==="exp"||sess.mode==="quest")&&!sess.again.has(q.id)){sess.again.add(q.id);sess.queue.push(sess.queue[sess.i])}
 activeQuests().forEach(qu=>{if(!S.qdone[qu.id]&&questReady(qu)){S.qdone[qu.id]=1;S.xp+=150;sess.questDone=qu.titre}});
 const t=today();S.days[t]=(S.days[t]||0)+1;
 const w=weekInfo();if(w.n>=GOAL_WEEK&&!S.chests[w.ws]){S.chests[w.ws]=1;S.xp+=100;sess.chest=true}
 save();renderQuiz();
}

function renderQuiz(){
 const q=sess.cur,meta=QIDX[q.id],c=meta.c,A=sess.answered,col=c.couleur;
 const prog=sess.endless?sess.ok+" / "+sess.done+" ✓":Math.min(sess.i+1,sess.queue.length)+" / "+sess.queue.length;
 const pct=sess.endless?100:Math.round(sess.i/sess.queue.length*100);
 let h='<div style="--c:'+esc(col)+'"><div class="top"><button class="x" onclick="stop()" aria-label="Arrêter">✕</button><div class="grow">'+esc(sess.title)+' · '+esc(c.icone)+' '+esc(c.nom)+'</div><div>'+prog+'</div></div>';
 h+='<div class="bar"><i style="width:'+pct+'%"></i></div><div class="qcard"><div class="sub small">'+esc(meta.ch.titre)+'</div>'+esc(q.q)+'</div>';
 if(q.t==="qcm"){q.c.forEach((t,i)=>{let cl="ans";if(A){if(i===q.a)cl+=" ok";else if(i===sess.given)cl+=" ko"}
  h+='<button class="'+cl+'" onclick="answer('+i+')">'+esc(t)+'</button>'})}
 else if(q.t==="vf"){h+='<div class="vf">';[[true,"Vrai"],[false,"Faux"]].forEach(([v,t])=>{let cl="ans";if(A){if(v===q.a)cl+=" ok";else if(v===sess.given)cl+=" ko"}
  h+='<button class="'+cl+'" onclick="answer('+v+')">'+t+'</button>'});h+='</div>'}
 else if(q.t==="ouverte"){
  if(!sess.revealed)h+='<textarea id="draft" class="draft" placeholder="Réponds dans ta tête ou écris ta réponse ici (facultatif)">'+esc(sess.draft)+'</textarea><button class="btn" onclick="reveal()">Voir la réponse attendue</button>';
  else{if(sess.draft.trim())h+='<div class="card"><b>Ta réponse</b><div class="sub" style="white-space:pre-wrap;margin-top:4px">'+esc(sess.draft)+'</div></div>';
   h+='<div class="card model"><b>Réponse attendue</b><div style="margin-top:6px">'+esc(q.a)+'</div>'+(q.pts.length?'<div class="sub small" style="margin-top:10px">Éléments à citer :</div><ul>'+q.pts.map(p=>'<li>'+esc(p)+'</li>').join("")+'</ul>':"")+'</div>';
   if(!A)h+='<div class="sub small">As-tu donné tous ces éléments ?</div><div class="vf3"><button class="ans" onclick="answer(true)">Oui, tout</button><button class="ans" onclick="answer(\'partiel\')">Pas complètement</button><button class="ans" onclick="answer(false)">Pas du tout</button></div>'}}
 else{h+='<input id="in" class="txt" '+(q.t==="nombre"?'inputmode="decimal" ':"")+'autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Ta réponse" '+(A?'disabled value="'+esc(sess.given)+'"':"")+'>';
  if(!A)h+='<button class="btn" onclick="answer()">Valider</button>'}
 if(A){const ok=sess.okLast;
  h+='<div class="fb '+(ok?"ok":"ko")+'"><b>'+(ok?"Bien joué ! +"+sess.lastXP.g+" XP"+(sess.lastXP.why?' <span class="sub small">('+esc(sess.lastXP.why)+')</span>':""):q.t==="ouverte"?(sess.given==="partiel"?"À compléter (+"+sess.lastXP.g+" XP)":"À retravailler"):"Pas tout à fait. Réponse : "+esc(shown(q)))+'</b><span class="ex">'+esc(q.e||"")+'</span>'+
   (ok?"":'<div class="sub small" style="margin-top:6px">Elle reviendra '+(sess.mode==="exp"||sess.mode==="quest"?"en fin de session et ":"")+'dans tes rappels.</div>')+'</div>';
  if(sess.questDone){h+='<div class="fb ok"><b>Quête accomplie : '+esc(sess.questDone)+' ! +150 XP</b><span class="ex">Toutes les questions du contrôle vues, et '+QUEST_GOAL+' % maîtrisées.</span></div>';sess.questDone=null}
  if(sess.chest){h+='<div class="fb ok"><b>Coffre de la semaine ouvert : +100 XP !</b></div>';sess.chestShown=true;sess.chest=false}
  const last=!sess.endless&&sess.i+1>=sess.queue.length;
  h+='<button class="btn" id="nx" onclick="nextQ()">'+(last?"Voir le résultat":"Suivant")+'</button>';
  if(!last)h+='<button class="btn sec" onclick="stop()">'+(sess.endless?"Arrêter l'entraînement":"Arrêter ici")+'</button>'}
 h+='</div>';app.innerHTML=h;
 const inp=document.getElementById("in");if(inp&&!A){inp.focus();inp.addEventListener("keydown",e=>{if(e.key==="Enter")answer()})}
}
function stop(){if(sess&&sess.done)finish();else back()}
function back(){const s=sess;sess=null;if(s&&s.questId)renderHome();else if(s&&s.cid)renderZone(s.cid);else if(s&&s.mode==="exam")renderExam();else renderHome()}

function finish(){
 const s=sess,pct=s.done?Math.round(s.ok/s.done*100):0,complete=s.i+1>=s.queue.length||s.i>=s.queue.length;
 let h='<div class="end">';
 if(s.mode==="level"){
  const k=s.k,key=lvlKey(s.cid,s.chid,k),ch=chap(s.cid,s.chid),nextK=k==="G"?null:(k+1<ch.levels.length?k+1:"G");
  const was=nextK!==null&&levelOpen(s.cid,s.chid,nextK);
  if(complete)S.best[key]=Math.max(S.best[key]||0,pct);save();
  const now=nextK!==null&&levelOpen(s.cid,s.chid,nextK);
  h+='<div class="sub">'+esc(course(s.cid).nom)+' · '+esc(ch.titre)+' · '+esc(s.title)+'</div><div class="score">'+pct+' %</div>'+starHtml(stars(pct))+'<p>'+s.ok+' / '+s.done+' bonnes réponses · +'+s.xp+' XP</p>';
  if(!complete)h+='<div class="sub">Niveau interrompu : le score n\'est compté que sur un niveau terminé.</div>';
  else if(!was&&now)h+='<div class="fb ok"><b>Débloqué : '+(nextK==="G"?"le Gardien de la zone":"niveau "+(nextK+1))+' !</b></div>';
  else if(k==="G"&&pct>=PASS)h+='<div class="fb ok"><b>Gardien vaincu !</b><span class="ex">Chapitre maîtrisé.</span></div>';
  else if(pct<PASS)h+='<div class="fb ko"><b>Encore un effort</b><span class="ex">'+PASS+' % pour débloquer la suite. Rejoue autant que tu veux : les erreurs reviendront dans tes rappels.</span></div>';
  h+='<button class="btn" onclick="startLevel(\''+s.cid+'\',\''+s.chid+'\','+(k==="G"?"'G'":k)+')">Rejouer</button>';
 }else{
  const label={exp:"Expédition du jour",train:"Entraînement libre",exam:"Mode examen",quest:"Quête",qexam:"Contrôle blanc",mix:"Quiz mixte"}[s.mode];
  if(s.mode==="qexam"||s.mode==="mix"){const note=Math.round(s.ok/s.done*20*2)/2,bk=s.mode==="mix"?"mix/"+s.cid:s.questId;if(complete)S.qbest[bk]=Math.max(S.qbest[bk]||0,note);save();
   h+='<div class="sub">'+(s.mode==="mix"?"Quiz mixte · "+esc(course(s.cid).nom):"Contrôle blanc")+(complete?"":" (interrompu, non compté)")+'</div><div class="score">'+fmt(note)+' / 20</div><p>'+s.ok+' / '+s.done+' bonnes réponses · +'+s.xp+' XP</p>';}
  else h+='<div class="sub">'+label+(s.mode==="exp"&&complete?" terminée":"")+'</div><div class="score">'+s.ok+' / '+s.done+'</div><p>+'+s.xp+' XP</p>';
  if(s.questId){const qu=activeQuests().find(x=>x.id===s.questId);if(qu)h+='<p class="sub">Questions vues : '+questSeen(qu).join(' / ')+' · maîtrisées : '+questMastery(qu)+' %</p><button class="btn" onclick="startQuest(\''+qu.id+'\','+(s.mode==="qexam")+')">'+(s.mode==="qexam"?"Refaire un contrôle blanc":"Continuer la quête")+'</button>'}
  if(s.mode==="exp"){const d=dueIds().length;h+='<p class="sub">'+(d?d+" rappel"+(d>1?"s":"")+" encore prêt"+(d>1?"s":"")+" aujourd'hui.":"Plus aucun rappel en attente aujourd'hui.")+'</p>'}
  if(s.mode==="mix")h+='<button class="btn" onclick="startMixed(\''+s.cid+'\')">Nouveau quiz mixte</button>';
  if(s.mode==="exam")h+='<button class="btn" onclick="startExam()">Nouvel examen sur les mêmes chapitres</button>';
 }
 const w=weekInfo();h+='<p class="sub">Semaine : '+Math.min(w.n,GOAL_WEEK)+' / '+GOAL_WEEK+' jours d\'exploration</p>';
 const ni=itemAt(S.xp),oi=itemAt(s.xp0);if(ni!==oi)h+='<div class="fb ok"><b>Nouvel objet : '+ni[1]+' '+esc(ni[2])+'</b></div>';
 {const ri=rankIdx();if(ri>s.r0)h+='<div class="fb ok"><b>Nouveau rang : '+esc(RANKS[ri][1])+'</b></div>'}
 h+='<button class="btn sec" onclick="back()">Retour</button></div>';
 sess=Object.assign({},s,{done:0});app.innerHTML=h;window.scrollTo(0,0);
}

/* ---------- démarrage ---------- */
load().then(renderHome).catch(e=>{go('<div class="card"><b>Impossible de charger les cours.</b><div class="sub">Vérifie data/cours.json (JSON valide ?).</div></div>')});
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
