À partir des sources fournies à la fin, crée des cartes de révision autonomes et utiles.

Consignes :

- Repère les notions importantes dans les sources et transforme-les en questions précises, avec une réponse claire.
- Une carte doit tester une seule notion. Évite les questions vagues, les doublons et les informations qui ne figurent pas dans les sources.
- Reformule avec tes propres mots. Garde les réponses concises, mais ajoute le contexte nécessaire pour qu'elles soient compréhensibles seules.
- Utilise le sujet indiqué pour toutes les cartes. Si aucun sujet n'est indiqué, omets la propriété « subject ».
- Génère le nombre de cartes demandé. Si ce nombre est impossible à atteindre sans inventer ou répéter des informations, produis-en moins.
- Réponds uniquement avec du JSON valide, sans introduction, sans balises Markdown ni commentaire. Utilise exactement cette structure :

{
"cards": [
{ "question": "Question ici", "answer": "Réponse ici", "subject": "Sujet ici" }
]
}

Exemples de cartes attendues (le contenu ci-dessous illustre le format et ne doit pas être repris, sauf s'il est présent dans les sources) :
{
"cards": [
{
"question": "Quel est le rôle principal des racines chez une plante ?",
"answer": "Elles ancrent la plante dans le sol et absorbent l'eau ainsi que les sels minéraux.",
"subject": "Biologie"
},
{
"question": "Pourquoi la température d'ébullition de l'eau diminue-t-elle en altitude ?",
"answer": "La pression atmosphérique étant plus faible, l'eau atteint sa pression de vapeur d'équilibre à une température plus basse.",
"subject": "Physique"
}
]
}

Paramètres :

- Nombre de cartes souhaité : [NOMBRE]
- Sujet à utiliser (facultatif) : [SUJET ou « aucun »]

Sources :
[COLLER LES SOURCES ICI]
