# Ajouter du contenu

Tout le contenu est dans `data/`. Il n'y a jamais besoin de toucher au code pour ajouter un cours, un chapitre ou des questions.

## 1. Déclarer le chapitre dans `data/cours.json`

```json
{
  "id": "math",
  "nom": "Mathématiques",
  "zone": "Volcan des Nombres",
  "icone": "🌋",
  "couleur": "#f5a524",
  "chapitres": [
    { "id": "deg2", "titre": "Fonctions du second degré", "fichier": "deg2.json", "vu": "2026-09-15" }
  ]
}
```

- `id` : court, sans espace ni accent. **Ne plus le changer une fois utilisé**, sinon la progression du chapitre est perdue.
- `vu` (facultatif) : date à laquelle le chapitre est vu en classe. Avant cette date, il n'entre pas dans les expéditions du jour. Ça permet de préparer des chapitres à l'avance. Les chapitres les plus récents sont privilégiés pour les nouvelles questions.
- L'ordre des chapitres dans la liste est l'ordre d'affichage.

## 2. Créer le fichier `data/<cours>/<fichier>.json`

```json
{
 "questions": [
  {"n": 1, "type": "qcm", "q": "sin 30° = ?", "choix": ["1/2", "√3/2", "√2/2", "1"], "expl": "sin 30° = 1/2."},
  {"n": 1, "type": "vf", "q": "Dans un MRU, l'accélération est nulle.", "rep": true, "expl": "Vitesse constante."},
  {"n": 2, "type": "nombre", "q": "Convertis 72 km/h en m/s.", "rep": 20, "expl": "72 / 3,6 = 20."},
  {"n": 2, "type": "texte", "q": "Past simple of « go » ?", "rep": ["went"], "expl": "go, went, gone."},
  {"n": 2, "gen": "mrua"}
 ]
}
```

| Champ | Rôle |
|---|---|
| `n` | Difficulté : 1 (bases), 2 (approfondi), 3 (difficile). Sert à ordonner les niveaux. |
| `type` | `qcm`, `vf`, `nombre`, `texte` ou `ouverte` |
| `q` | L'énoncé |
| `choix` (qcm) | **La bonne réponse en premier.** L'appli mélange l'ordre à l'affichage. |
| `rep` (vf) | `true` ou `false` |
| `rep` (nombre) | Un nombre, avec un point décimal : `2.5`. L'élève peut taper `2,5`. Ajouter `"tol": 0.01` pour accepter un arrondi. |
| `rep` (texte) | Liste des réponses acceptées : `["went"]`. Majuscules, accents et point final sont ignorés. |
| `rep` (ouverte) | La réponse modèle, en texte. Ajouter `"points": ["...", "..."]` pour la liste des éléments attendus. L'élève lit sa réponse, puis indique s'il avait tout. |
| `expl` | Explication affichée après la réponse. Fortement conseillée. |
| `gen` | Question générée (valeurs aléatoires à chaque fois). Voir la liste dans `js/gen.js`. |

Attention : l'identifiant interne d'une question est calculé à partir de son énoncé. Corriger une faute dans un énoncé remet à zéro le suivi de cette question (pas grave, mais à savoir).

## 3. Vérifier avant de pousser

```
node outils/verifier.js
```

Le script signale les fichiers JSON invalides, les champs manquants et les types inconnus.

## Fiche récapitulative (facultatif)

Dans le fichier du chapitre, à côté de `questions` :

```json
"fiche": [
  {"t": "Titre de section", "l": ["point 1 avec **gras**", "point 2"]},
  {"t": "Un tableau", "tab": [["En-tête 1", "En-tête 2"], ["case", "case"]], "n": "note sous le tableau"}
]
```

Un bouton « 📄 Fiche récap » apparaît alors dans la zone et dans la quête du contrôle.

## Quêtes de contrôle

Pour un contrôle annoncé, ajouter une entrée dans `data/quetes.json` :

```json
{
  "quetes": [
    { "id": "bio-inne-2026-11-09", "titre": "Contrôle de bio : la réponse immunitaire innée", "date": "2026-11-09", "chapitres": ["bio/inne"] }
  ]
}
```

- `chapitres` : liste de `cours/chapitre`. Un contrôle peut couvrir plusieurs chapitres, même de cours différents.
- La quête apparaît sur l'accueil jusqu'au jour du contrôle inclus, puis disparaît.
- Deux boutons : « S'entraîner » (10 questions, les moins maîtrisées d'abord) et « Contrôle blanc » (20 questions, note sur 20).
- « S'entraîner » propose d'abord les questions jamais vues, puis les ratées : en enchaînant les séries, toute la matière passe.
- La quête est accomplie (+150 XP) quand toutes les questions ont été vues et que 80 % ont été réussies deux fois d'affilée.
- Dans les 7 jours avant le contrôle, l'expédition du jour pioche en priorité dans ces chapitres.

## Sessions d'examens

Dans `data/quetes.json`, à côté de `quetes` :

```json
"sessions": [
  { "id": "examens-juin-2027", "titre": "Examens de juin", "debut": "2027-05-24", "date": "2027-06-14" }
]
```

- De `debut` à `date`, toute question dont le prochain rappel tombe **après** l'examen redevient à revoir, même maîtrisée. Une fois revue, elle est reprogrammée au plus tard la veille de l'examen.
- `"chapitres": ["bio", "chim/liaisons"]` (facultatif) limite la session à certains cours ou chapitres.
- Une carte « 📚 » apparaît sur l'accueil avec le nombre de questions encore à revoir.

## Niveaux

Les niveaux sont calculés automatiquement : les questions d'un chapitre sont triées par difficulté puis découpées en niveaux de 8. Le Gardien (10 questions tirées dans tout le chapitre) s'ouvre quand tous les niveaux sont réussis à 70 %.
