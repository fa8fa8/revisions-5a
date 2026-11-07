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
if(typeof module!=="undefined")module.exports={GEN,R,pick,shuffle,fmt,norm};
