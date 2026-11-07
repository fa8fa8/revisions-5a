// Vérifie le contenu avant de pousser : node outils/verifier.js
const fs=require("fs"),path=require("path");
const {GEN}=require("../js/gen.js");
const root=path.join(__dirname,"..","data");
let err=0,warn=0,total=0;
const E=m=>{err++;console.log("ERREUR  "+m)},W=m=>{warn++;console.log("ATTENTION  "+m)};
let idx;
try{idx=JSON.parse(fs.readFileSync(path.join(root,"cours.json"),"utf8"))}catch(e){console.log("ERREUR  data/cours.json illisible : "+e.message);process.exit(1)}
const ids=new Set();
for(const c of idx.cours||[]){
 for(const k of["id","nom","zone","icone","couleur"])if(!c[k])E(c.id+" : champ « "+k+" » manquant");
 if(ids.has(c.id))E("id de cours en double : "+c.id);ids.add(c.id);
 const chIds=new Set();
 for(const ch of c.chapitres||[]){
  const where=c.id+"/"+(ch.fichier||"?");
  if(!ch.id||!ch.titre||!ch.fichier){E(where+" : id, titre ou fichier manquant");continue}
  if(chIds.has(ch.id))E(where+" : id de chapitre en double ("+ch.id+")");chIds.add(ch.id);
  if(ch.vu&&!/^\d{4}-\d{2}-\d{2}$/.test(ch.vu))E(where+" : « vu » doit être au format AAAA-MM-JJ");
  let d;try{d=JSON.parse(fs.readFileSync(path.join(root,c.id,ch.fichier),"utf8"))}catch(e){E(where+" : "+e.message);continue}
  const qs=d.questions||[];if(!qs.length)W(where+" : aucune question");
  const seen=new Set();
  qs.forEach((q,i)=>{total++;const at=where+" #"+(i+1);
   if(q.n&&![1,2,3].includes(q.n))E(at+" : n doit valoir 1, 2 ou 3");
   if(q.gen){if(!GEN[q.gen])E(at+" : générateur inconnu « "+q.gen+" »");return}
   if(!q.q)E(at+" : énoncé « q » manquant");
   if(seen.has(q.q))W(at+" : énoncé en double dans le chapitre");seen.add(q.q);
   switch(q.type){
    case"qcm":if(!Array.isArray(q.choix)||q.choix.length<2)E(at+" : « choix » doit contenir au moins 2 réponses");
     else if(new Set(q.choix).size!==q.choix.length)E(at+" : deux choix identiques");break;
    case"vf":if(typeof q.rep!=="boolean")E(at+" : « rep » doit être true ou false");break;
    case"nombre":if(typeof q.rep!=="number")E(at+" : « rep » doit être un nombre (avec un point : 2.5)");break;
    case"texte":if(!Array.isArray(q.rep)||!q.rep.length)E(at+" : « rep » doit être une liste de réponses acceptées");break;
    default:E(at+" : type inconnu « "+q.type+" »");
   }
   if(!q.expl)W(at+" : pas d'explication");
  });
 }
}
try{const qd=JSON.parse(fs.readFileSync(path.join(root,"quetes.json"),"utf8"));
 for(const qu of qd.quetes||[]){if(!qu.id||!qu.titre||!/^\d{4}-\d{2}-\d{2}$/.test(qu.date||""))E("quete "+(qu.id||"?")+" : id, titre ou date (AAAA-MM-JJ) manquant");
  for(const k of qu.chapitres||[]){const[c,h]=k.split("/");const co=(idx.cours||[]).find(x=>x.id===c);if(!co||!co.chapitres.find(x=>x.id===h))E("quete "+qu.id+" : chapitre inconnu "+k)}}
}catch(e){if(e.code!=="ENOENT")E("data/quetes.json : "+e.message)}
console.log("\n"+total+" questions, "+err+" erreur(s), "+warn+" avertissement(s).");
process.exit(err?1:0);
