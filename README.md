# Système B

Ton espace personnel : une base de données de savoirs, de culture et de choses du quotidien, avec recherche par mots-clés et étiquettes, installable comme une appli sur iPhone.

**Version 1 (étape 1)** : connexion, ajout / modification / suppression d'éléments, types (note, savoir, recette, film, série, livre, cadeau, tâche, objectif, événement), statuts, notes sur 5, étiquettes, dates avec compte à rebours (J-12), image par élément, recherche instantanée (insensible aux accents), filtres par type et par étiquette.

Tout est gratuit : Supabase (base de données), GitHub Pages (hébergement).

---

## Mise en place (environ 20 minutes)

### 1. Créer la base de données (Supabase)

1. Crée un compte sur <https://supabase.com> puis **New project** (choisis une région en Europe, par exemple Paris ou Francfort, et note le mot de passe de la base quelque part).
2. Dans le projet, ouvre **SQL Editor** > **New query**, colle tout le contenu de `schema.sql`, puis clique sur **Run**. Tu dois voir « Success ».

### 2. Créer ton compte utilisateur (et fermer les inscriptions)

1. **Authentication** > **Users** > **Add user** > **Create new user**. Saisis ton e-mail et un mot de passe, et coche **Auto Confirm User** si la case existe.
2. Dans les réglages d'authentification (**Authentication** > **Sign In / Providers** ou **Settings**), désactive **Allow new users to sign up**. Ainsi, toi seule peux te connecter.

(Les intitulés de Supabase évoluent un peu : si tu ne trouves pas exactement ces mots, cherche les équivalents.)

### 3. Récupérer les deux clés

Dans **Project Settings** > **API** (ou **API Keys**) :

- l'**URL** du projet (`https://xxxx.supabase.co`) ;
- la clé **publique** : « publishable key » ou « anon key ».

Ouvre `config.js` et colle ces deux valeurs à la place des textes `COLLE_ICI_...`.

> Ne colle jamais la clé « secret » ou « service_role » : elle donne un accès total à ta base. La clé publique, elle, peut être visible sans risque, car la sécurité de tes données repose sur les règles du fichier `schema.sql`.

### 4. Mettre le code sur GitHub

1. Sur GitHub : **New repository**, nom `systeme-b`, en **Public** (nécessaire pour GitHub Pages gratuit), sans README.
2. Sur la page du dépôt vide : **uploading an existing file**, puis glisse tous les fichiers du dossier (sauf `schema.sql` et `README.md` si tu préfères les garder pour toi). Valide avec **Commit changes**.

### 5. Publier le site (GitHub Pages)

1. Dans le dépôt : **Settings** > **Pages**.
2. **Source** : *Deploy from a branch*, branche `main`, dossier `/ (root)`, puis **Save**.
3. Après une ou deux minutes, l'adresse apparaît : `https://TON-PSEUDO.github.io/systeme-b/`.

### 6. L'installer sur l'iPhone

1. Ouvre l'adresse dans **Safari** (pas dans une autre application).
2. Bouton **Partager** > **Sur l'écran d'accueil** > **Ajouter**.
3. Ouvre l'icône « Système B » et connecte-toi avec l'e-mail et le mot de passe de l'étape 2.

---

## Ce qui n'est pas encore là (prochaines étapes)

- Fiches automatiques pour les films, séries et livres (TMDB, Open Library)
- Partage depuis Instagram / Pinterest / captures d'écran avec tri par IA
- Vue calendrier, vues moodboard, trackers, objectifs avec jalons
- Rappels et notifications

## Personnaliser

- **Couleurs et style** : tout est dans les variables en haut de `style.css`.
- **Types d'éléments et statuts** : la liste `TYPES` en haut de `app.js`.

## Si ça ne marche pas

- **Page « Il manque la configuration »** : `config.js` n'est pas rempli, ou la page est en cache. Recharge en vidant le cache, ou supprime l'icône et réinstalle-la.
- **« Invalid login credentials »** : e-mail ou mot de passe incorrect, ou l'utilisateur n'a pas été confirmé (voir l'étape 2).
- **Erreur « permission denied » ou « row-level security »** : le script `schema.sql` n'a pas été exécuté en entier. Relance-le.
- **Changement non visible après une modification du code** : ferme complètement l'appli puis rouvre-la (le cache hors ligne se met à jour au lancement suivant).
- **Projet Supabase en pause** : les projets gratuits inactifs pendant environ une semaine sont mis en pause. Il suffit de les relancer depuis le tableau de bord Supabase.
