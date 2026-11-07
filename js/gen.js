"use strict";
/* Utilitaires partagés */
const R=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const fmt=n=>String(Math.round(n*1000)/1000).replace(".",",");
const norm=s=>String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[.!?]+$/,"").replace(/\s+/g," ").trim();
function poly(a,b,c){let s=a===1?"x²":a===-1?"\u2212x²":(a<0?"\u2212"+(-a):a)+"x²";if(b)s+=(b>0?" + ":" - ")+(Math.abs(b)===1?"":Math.abs(b))+"x";if(c)s+=(c>0?" + ":" - ")+Math.abs(c);return s}
const factor=r=>r===0?"x":"(x "+(r>0?"- "+r:"+ "+(-r))+")";
function mkQcm(q,correct,distract,e){const d=shuffle([...new Set(distract.filter(x=>x!==correct))]).slice(0,3);const c=shuffle([correct,...d]);return{t:"qcm",q,c,a:c.indexOf(correct),e}}

/*
 Générateurs : chaque appel produit une nouvelle question.
 Dans un fichier de chapitre : {"n": 1, "gen": "delta"}
 Format renvoyé : t = "qcm" | "vf" | "texte" | "nombre", q = énoncé, a = réponse, e = explication.
*/
const GEN={
 delta(){const a=pick([1,2,-1,3]),b=R(-6,6),c=R(-5,5),d=b*b-4*a*c;
  return{t:"nombre",q:"Calcule le discriminant Δ de f(x) = "+poly(a,b,c),a:d,e:"Δ = b² - 4ac = ("+b+")² - 4·("+a+")·("+c+") = "+d}},
 sommet(){const a=pick([1,2,-1,-2]),h=R(-5,5),k=R(-6,6),b=-2*a*h,c=a*h*h+k;
  return{t:"nombre",q:"Quelle est l'abscisse du sommet de la parabole f(x) = "+poly(a,b,c)+" ?",a:h,e:"x = -b / (2a) = "+(-b)+" / "+(2*a)+" = "+h}},
 racines(){const r1=R(-6,6);let r2;do{r2=R(-6,6)}while(r2===r1);const lo=Math.min(r1,r2),hi=Math.max(r1,r2),f=(x,y)=>x+" et "+y;
  return mkQcm("Quelles sont les racines de f(x) = "+poly(1,-(r1+r2),r1*r2)+" ?",f(lo,hi),[f(-hi,-lo),f(lo,-hi),f(-lo,hi),f(lo+1,hi+1),f(lo-1,hi)],"f(x) = "+factor(lo)+factor(hi)+", donc les racines sont "+f(lo,hi)+".")},
 degRad(){const T=[[30,"π/6"],[45,"π/4"],[60,"π/3"],[90,"π/2"],[120,"2π/3"],[135,"3π/4"],[150,"5π/6"],[180,"π"],[270,"3π/2"]],p=pick(T);
  return mkQcm("Combien vaut "+p[0]+"° en radians ?",p[1],T.filter(x=>x!==p).map(x=>x[1]),p[0]+"° = "+p[0]+" × π/180 = "+p[1]+" rad")},
 mru(){const v=pick([30,40,50,60,80,90,120]),t=pick([0.5,1.5,2,2.5,3]),d=v*t;
  return{t:"nombre",q:"Une voiture roule à vitesse constante et parcourt "+fmt(d)+" km en "+fmt(t)+" h. Quelle est sa vitesse en km/h ?",a:v,e:"v = d / t = "+fmt(d)+" / "+fmt(t)+" = "+v+" km/h"}},
 mrua(){const a=R(2,5),t=R(2,8);
  return{t:"nombre",q:"Un mobile part à l'arrêt avec une accélération constante de "+a+" m/s². Quelle est sa vitesse (m/s) après "+t+" s ?",a:a*t,e:"v = a·t = "+a+" × "+t+" = "+(a*t)+" m/s"}},
 mruaD(){const a=pick([2,4,6]),t=R(2,6),d=a*t*t/2;
  return{t:"nombre",q:"Départ à l'arrêt, accélération de "+a+" m/s². Quelle distance (m) est parcourue en "+t+" s ?",a:d,e:"d = a·t²/2 = "+a+" × "+(t*t)+" / 2 = "+d+" m"}},
 mole(){const k=R(2,6),m=18*k;
  return{t:"nombre",q:"Combien de moles y a-t-il dans "+m+" g d'eau (M = 18 g/mol) ?",a:k,e:"n = m / M = "+m+" / 18 = "+k+" mol"}},
 echelle(){const s=pick([25000,50000,100000]),cm=R(2,8),km=cm*s/100000,S=x=>x.toLocaleString("fr-BE");
  return{t:"nombre",q:"Sur une carte au 1/"+S(s)+", "+cm+" cm représentent combien de km ?",a:km,e:cm+" cm × "+S(s)+" = "+S(cm*s)+" cm = "+fmt(km)+" km"}}
};

/* ---------- Chimie : données du cours ---------- */
const SUP={"0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹","+":"⁺","-":"⁻"};
const sup=t=>String(t).split("").map(c=>SUP[c]||c).join("");
const ionF=(sym,q)=>sym+sup((Math.abs(q)>1?Math.abs(q):"")+(q>0?"+":"-"));
// Z <= 20 : nom, symbole
const ELZ=[null,["hydrogène","H"],["hélium","He"],["lithium","Li"],["béryllium","Be"],["bore","B"],["carbone","C"],["azote","N"],["oxygène","O"],["fluor","F"],["néon","Ne"],["sodium","Na"],["magnésium","Mg"],["aluminium","Al"],["silicium","Si"],["phosphore","P"],["soufre","S"],["chlore","Cl"],["argon","Ar"],["potassium","K"],["calcium","Ca"]];
// tableau « Principaux éléments et leur symbole » (annexe du cours)
const ELEMS=ELZ.slice(1).concat([["chrome","Cr"],["manganèse","Mn"],["fer","Fe"],["cobalt","Co"],["nickel","Ni"],["cuivre","Cu"],["zinc","Zn"],["arsenic","As"],["sélénium","Se"],["brome","Br"],["krypton","Kr"],["argent","Ag"],["étain","Sn"],["iode","I"],["xénon","Xe"],["baryum","Ba"],["platine","Pt"],["or","Au"],["mercure","Hg"],["plomb","Pb"],["bismuth","Bi"],["uranium","U"]]);
const FAM=[["Ia","alcalins"],["IIa","alcalino-terreux"],["IIIa","terreux"],["IVa","carbonides"],["Va","azotides"],["VIa","sulfurides"],["VIIa","halogènes"],["VIIIa","gaz nobles"]];
const VAL={Ia:1,IIa:2,IIIa:3,IVa:4,Va:3,VIa:2,VIIa:1};
// éléments des familles a : [nom, symbole, Z, famille]
const FA=[["lithium","Li",3,"Ia"],["sodium","Na",11,"Ia"],["potassium","K",19,"Ia"],["béryllium","Be",4,"IIa"],["magnésium","Mg",12,"IIa"],["calcium","Ca",20,"IIa"],["baryum","Ba",56,"IIa"],["bore","B",5,"IIIa"],["aluminium","Al",13,"IIIa"],["carbone","C",6,"IVa"],["silicium","Si",14,"IVa"],["azote","N",7,"Va"],["phosphore","P",15,"Va"],["oxygène","O",8,"VIa"],["soufre","S",16,"VIa"],["fluor","F",9,"VIIa"],["chlore","Cl",17,"VIIa"],["brome","Br",35,"VIIa"],["iode","I",53,"VIIa"]];
const IONQ={Ia:1,IIa:2,IIIa:3,Va:-3,VIa:-2,VIIa:-1};
// électronégativités utilisées au cours
const CHI={H:2.1,Li:1.0,Be:1.5,B:2.0,C:2.5,N:3.0,O:3.5,F:4.0,Na:0.9,Mg:1.2,Al:1.5,Si:1.8,P:2.1,S:2.5,Cl:3.0,K:0.8,Ca:1.0,Br:2.8,I:2.5,Ba:0.9};
function config(z){const sh=["K","L","M","N"],cap=[2,8,8,2];let r=[],n=z;for(let i=0;i<4&&n>0;i++){const k=Math.min(n,cap[i]);r.push(sh[i]+k);n-=k}return r.join(" ")}
const de=n=>/^[aeiouéèhy]/i.test(n)?"de l'"+n:"du "+n;
const fmtChi=x=>x.toFixed(1).replace(".",",");
Object.assign(GEN,{
 symbole(){const e=pick(ELEMS);return mkQcm("Quel est le symbole "+de(e[0])+" ?",e[1],shuffle(ELEMS.filter(x=>x!==e&&x[1][0]===e[1][0])).map(x=>x[1]).concat(shuffle(ELEMS).map(x=>x[1])),e[0]+" : "+e[1])},
 element(){const e=pick(ELEMS);return mkQcm("Quel élément a pour symbole "+e[1]+" ?",e[0],shuffle(ELEMS.filter(x=>x!==e&&x[1][0]===e[1][0])).map(x=>x[0]).concat(shuffle(ELEMS).map(x=>x[0])),e[1]+" : "+e[0])},
 configElec(){const z=R(3,20),e=ELZ[z];return mkQcm("Configuration électronique "+de(e[0])+" (Z = "+z+") ?",config(z),[config(z-1),config(Math.min(z+1,20)),config(Math.min(z+2,20)),config(Math.max(z-2,1))],"Z = "+z+" : "+z+" électrons répartis K (max 2), L (max 8), M... -> "+config(z))},
 famille(){const f=pick(FAM);return Math.random()<0.5?mkQcm("Comment s'appelle la famille du groupe "+f[0]+" ?",f[1],FAM.map(x=>x[1]),f[0]+" : "+f[1]):mkQcm("À quel groupe correspond la famille des "+f[1]+" ?",f[0],FAM.map(x=>x[0]),f[1]+" : groupe "+f[0])},
 valence(){const e=pick(FA.filter(x=>VAL[x[3]]));return{t:"nombre",q:"Quelle est la valence "+de(e[0])+" ("+e[1]+", famille "+e[3]+") ? (réponds par un nombre)",a:VAL[e[3]],e:"Famille "+e[3]+" : valence "+VAL[e[3]]+" (= nombre d'électrons célibataires)."}},
 ion(){const e=pick(FA.filter(x=>IONQ[x[3]]!==undefined&&x[1]!=="B")),q=IONQ[e[3]],ok=ionF(e[1],q);
  return mkQcm("Quel ion forme "+(e[0]==="azote"||/^[aeiouéh]/.test(e[0])?"l'":"le ")+e[0]+" ("+e[1]+", famille "+e[3]+") ?",ok,[ionF(e[1],-q),ionF(e[1],q>0?q+1:q-1),ionF(e[1],q>0?Math.max(1,q-1)+(q===1?1:0):q+1||-2),ionF(e[1],-(Math.abs(q)%3+1))],q>0?"Un métal de la famille "+e[3]+" perd "+q+" électron"+(q>1?"s":"")+" : "+ok:"Un non-métal de la famille "+e[3]+" capte "+(-q)+" électron"+(q<-1?"s":"")+" pour compléter son octet : "+ok)},
 electronsIon(){const e=pick(FA.filter(x=>IONQ[x[3]]!==undefined&&x[1]!=="B")),q=IONQ[e[3]];return{t:"nombre",q:"Combien d'électrons possède l'ion "+ionF(e[1],q)+" ? ("+e[1]+" : Z = "+e[2]+")",a:e[2]-q,e:e[2]+" protons ; charge "+(q>0?"+":"")+q+" -> "+e[2]+(q>0?" - ":" + ")+Math.abs(q)+" = "+(e[2]-q)+" électrons."}},
 celib(){const f=pick(FAM);const n={Ia:1,IIa:2,IIIa:3,IVa:4,Va:3,VIa:2,VIIa:1,VIIIa:0}[f[0]];return{t:"nombre",q:"Combien d'électrons célibataires possède, dans le modèle de Lewis, un atome de la famille "+f[0]+" ("+f[1]+") ?",a:n,e:"Ia:1, IIa:2, IIIa:3, IVa:4, Va:3, VIa:2, VIIa:1, VIIIa:0 (= valence)."}},
 liaison(){const P=[["Na","Cl"],["K","Br"],["Mg","O"],["Ca","F"],["Na","Br"],["H","Cl"],["H","Br"],["H","O"],["H","N"],["C","O"],["C","H"],["H","S"],["P","Cl"],["C","S"],["Cl","Cl"],["O","O"],["N","N"],["H","H"],["Al","F"],["Li","F"],["C","Cl"],["S","O"],["Ba","O"]],p=pick(P),a=CHI[p[0]],b=CHI[p[1]],d=Math.round(Math.abs(a-b)*10)/10;
  const t=d>=1.7?"ionique":d>0?"covalente polarisée":"covalente pure";
  return mkQcm("Quel type de liaison entre "+p[0]+" (χ = "+fmtChi(a)+") et "+p[1]+" (χ = "+fmtChi(b)+") ?",t,["ionique","covalente polarisée","covalente pure"],"Δχ = "+fmtChi(d)+" : "+(d>=1.7?"Δχ ≥ 1,7 -> ionique":d>0?"0 < Δχ < 1,7 -> covalente polarisée":"Δχ = 0 -> covalente pure"))}
});
if(typeof module!=="undefined")module.exports={GEN,R,pick,shuffle,fmt,norm};
