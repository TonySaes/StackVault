# MLD StackVault

## Objectif

Ce MLD traduit le MCD StackVault en structure relationnelle PostgreSQL avant l'ecriture du schema Prisma metier. Il sert de guide pour les migrations futures.

Le MLD reste volontairement pragmatique :

- noms SQL en `snake_case` ;
- tables au pluriel ;
- cles primaires en UUID ;
- dates en `timestamptz` ;
- relations many-to-many transformees en tables de liaison explicites ;
- pas de stockage du corps complet des contenus tiers ;
- compatibilite future avec Prisma via `@map` et `@@map`.

## Conventions relationnelles

### Nommage

- Tables : pluriel en `snake_case`, par exemple `resources`, `collection_resources`.
- Colonnes : `snake_case`, par exemple `canonical_url`, `created_at`.
- Cles primaires : `id`.
- Cles etrangeres : `{entity}_id`, par exemple `source_id`, `resource_id`.
- Contraintes : noms explicites quand elles portent une regle metier.
- Index : prefixe `idx_`, par exemple `idx_resources_published_at`.

### Types communs

- Identifiants : `uuid`.
- Textes courts : `varchar(n)` quand une limite claire existe, sinon `text`.
- URLs : `text`, avec validation applicative.
- Dates metier et techniques : `timestamptz`.
- Compteurs : `integer` avec valeur par defaut `0`.
- Statuts : `text` avec valeurs autorisees documentees dans ce MLD.

Note sur les statuts : le MLD les exprime comme `text` pour garder les evolutions simples. Prisma pourra les representer par des enums applicatifs si cela apporte de la lisibilite TypeScript. Si Prisma cree des enums PostgreSQL natifs, chaque ajout de statut demandera une migration explicite.

### Timestamps

Sauf exception, les tables metier portent :

- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`updated_at` sera maintenu par l'application ou par Prisma.

## Tables

### `sources`

Origine allowlistee des ressources canoniques.

| Colonne | Type | Null | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | non | Cle primaire. |
| `name` | `varchar(160)` | non | Nom public de la source. |
| `url` | `text` | non | URL principale de la source. |
| `type` | `text` | non | `rss_atom`, `official_api`, `public_metadata`. |
| `status` | `text` | non | `active`, `inactive`, `error`, `to_check`. |
| `last_ingestion_at` | `timestamptz` | oui | Derniere ingestion connue. |
| `last_checked_at` | `timestamptz` | oui | Dernier controle de sante ou de lien. |
| `created_at` | `timestamptz` | non | Date de creation. |
| `updated_at` | `timestamptz` | non | Date de mise a jour. |

Contraintes :

- PK : `sources_pkey (id)`.
- Unique : `sources_url_key (url)`.
- Check conceptuel : `type` dans les valeurs autorisees.
- Check conceptuel : `status` dans les valeurs autorisees.

Index :

- `idx_sources_status (status)` pour les vues admin et couverture.

### `categories`

Categorie principale d'une ressource : securite, release, tendance ou autre signal administre.

| Colonne | Type | Null | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | non | Cle primaire. |
| `name` | `varchar(120)` | non | Nom affichable. |
| `slug` | `varchar(120)` | non | Identifiant stable lisible. |
| `signal_type` | `text` | non | `security`, `release`, `trend`, `other`. |
| `created_at` | `timestamptz` | non | Date de creation. |
| `updated_at` | `timestamptz` | non | Date de mise a jour. |

Contraintes :

- PK : `categories_pkey (id)`.
- Unique : `categories_slug_key (slug)`.
- Check conceptuel : `signal_type` dans les valeurs autorisees.

Index :

- Pas d'index supplementaire necessaire au MVP au-dela de l'unicite du slug.

### `technologies`

Technologie, stack ou outil rattache aux ressources.

| Colonne | Type | Null | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | non | Cle primaire. |
| `name` | `varchar(120)` | non | Nom affichable. |
| `slug` | `varchar(120)` | non | Identifiant stable lisible. |
| `status` | `text` | non | `active`, `inactive`. |
| `created_at` | `timestamptz` | non | Date de creation. |
| `updated_at` | `timestamptz` | non | Date de mise a jour. |

Contraintes :

- PK : `technologies_pkey (id)`.
- Unique : `technologies_slug_key (slug)`.
- Check conceptuel : `status` dans les valeurs autorisees.

Index :

- `idx_technologies_status (status)` utile pour masquer les technos inactives.

### `resources`

Ressource technique publique ou sauvegardee.

| Colonne | Type | Null | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | non | Cle primaire. |
| `source_id` | `uuid` | non | FK vers `sources.id`. |
| `category_id` | `uuid` | non | FK vers `categories.id`. |
| `title` | `varchar(240)` | non | Titre affichable. |
| `source_url` | `text` | non | URL visible et ouvrable. |
| `canonical_url` | `text` | non | URL normalisee pour deduplication. |
| `published_at` | `timestamptz` | oui | Date publiee par la source si disponible. |
| `detected_at` | `timestamptz` | non | Date de detection par StackVault. |
| `short_summary` | `text` | oui | Resume court non IA ou description courte. |
| `lifecycle_status` | `text` | non | `active`, `expired`, `unavailable`, `saved_retained`. |
| `link_status` | `text` | non | `unknown`, `active`, `checked_recently`, `unavailable`, `redirect`, `checking`, `error`. |
| `last_link_check_at` | `timestamptz` | oui | Dernier controle de lien. |
| `retention_eligible_at` | `timestamptz` | oui | Date a partir de laquelle une ressource non sauvegardee peut etre purgee. |
| `created_at` | `timestamptz` | non | Date de creation. |
| `updated_at` | `timestamptz` | non | Date de mise a jour. |

Contraintes :

- PK : `resources_pkey (id)`.
- FK : `resources_source_id_fkey (source_id)` vers `sources(id)`.
- FK : `resources_category_id_fkey (category_id)` vers `categories(id)`.
- Unique : `resources_canonical_url_key (canonical_url)`.
- Check conceptuel : `lifecycle_status` dans les valeurs autorisees.
- Check conceptuel : `link_status` dans les valeurs autorisees.
- Interdiction conceptuelle : aucune colonne ne stocke le corps complet d'un contenu tiers.

Index :

- `idx_resources_source_id (source_id)` pour les lectures par source.
- `idx_resources_category_id (category_id)` pour les filtres par categorie.
- `idx_resources_published_at (published_at)` pour le tri chronologique.
- `idx_resources_detected_at (detected_at)` pour les ressources sans date publiee.
- `idx_resources_link_status (link_status)` pour les vues de liens indisponibles.
- `idx_resources_lifecycle_status (lifecycle_status)` pour retention et affichage.

### `resource_technologies`

Table de liaison entre ressources et technologies.

| Colonne | Type | Null | Description |
| --- | --- | --- | --- |
| `resource_id` | `uuid` | non | FK vers `resources.id`. |
| `technology_id` | `uuid` | non | FK vers `technologies.id`. |
| `created_at` | `timestamptz` | non | Date de rattachement. |

Contraintes :

- PK composee : `resource_technologies_pkey (resource_id, technology_id)`.
- FK : `resource_technologies_resource_id_fkey (resource_id)` vers `resources(id)`.
- FK : `resource_technologies_technology_id_fkey (technology_id)` vers `technologies(id)`.

Index :

- `idx_resource_technologies_technology_id (technology_id)` pour filtrer les ressources par technologie.

Note : le MCD impose au moins une technologie par ressource. Cette contrainte est difficile a garantir par simple FK en SQL relationnel sans trigger ou logique applicative. Elle sera donc verifiee par service applicatif et tests.

### `users`

Compte utilisateur minimal.

| Colonne | Type | Null | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | non | Cle primaire. |
| `email` | `varchar(320)` | non | Email de connexion. |
| `password_hash` | `text` | non | Hash du mot de passe. |
| `role` | `text` | non | `USER`, `ADMIN`. |
| `created_at` | `timestamptz` | non | Date de creation. |
| `updated_at` | `timestamptz` | non | Date de mise a jour. |
| `deleted_at` | `timestamptz` | oui | Soft delete ou trace de suppression. |

Contraintes :

- PK : `users_pkey (id)`.
- Unique : `users_email_key (email)`.
- Check conceptuel : `role` dans `USER`, `ADMIN`.

Index :

- `idx_users_deleted_at (deleted_at)` pour les routines de suppression/anonymisation.

Decision : `deleted_at` permet de representer la suppression sans perdre immediatement les contraintes relationnelles. La Story auth/suppression de compte precisera si les donnees sont hard delete ou anonymisees apres traitement.

### `favorites`

Table de liaison issue de l'association `SAUVEGARDER`.

| Colonne | Type | Null | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | non | Cle primaire technique. |
| `user_id` | `uuid` | non | FK vers `users.id`. |
| `resource_id` | `uuid` | non | FK vers `resources.id`. |
| `created_at` | `timestamptz` | non | Date de sauvegarde. |

Contraintes :

- PK : `favorites_pkey (id)`.
- FK : `favorites_user_id_fkey (user_id)` vers `users(id)`.
- FK : `favorites_resource_id_fkey (resource_id)` vers `resources(id)`.
- Unique : `favorites_user_id_resource_id_key (user_id, resource_id)`.

Index :

- `idx_favorites_user_id (user_id)` pour afficher les favoris d'un utilisateur.
- `idx_favorites_resource_id (resource_id)` pour savoir si une ressource est protegee de la retention.

### `collections`

Collection personnelle d'un utilisateur.

| Colonne | Type | Null | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | non | Cle primaire. |
| `user_id` | `uuid` | non | FK vers `users.id`. |
| `name` | `varchar(120)` | non | Nom affiche. |
| `normalized_name` | `varchar(120)` | non | Nom normalise pour unicite. |
| `created_at` | `timestamptz` | non | Date de creation. |
| `updated_at` | `timestamptz` | non | Date de mise a jour. |

Contraintes :

- PK : `collections_pkey (id)`.
- FK : `collections_user_id_fkey (user_id)` vers `users(id)`.
- Unique : `collections_user_id_normalized_name_key (user_id, normalized_name)`.

Index :

- `idx_collections_user_id (user_id)` pour lister les collections d'un utilisateur.

Decision : l'unicite se fait sur `normalized_name` pour eviter deux collections identiques a la casse ou aux espaces pres.

### `collection_resources`

Table de liaison issue de l'association `CONTENIR`.

| Colonne | Type | Null | Description |
| --- | --- | --- | --- |
| `collection_id` | `uuid` | non | FK vers `collections.id`. |
| `resource_id` | `uuid` | non | FK vers `resources.id`. |
| `created_at` | `timestamptz` | non | Date d'ajout. |

Contraintes :

- PK composee : `collection_resources_pkey (collection_id, resource_id)`.
- FK : `collection_resources_collection_id_fkey (collection_id)` vers `collections(id)`.
- FK : `collection_resources_resource_id_fkey (resource_id)` vers `resources(id)`.

Index :

- `idx_collection_resources_resource_id (resource_id)` pour la retention.

Note : le MCD n'impose pas encore qu'une ressource soit favorite avant d'etre ajoutee a une collection. Cette regle pourra etre ajoutee au service applicatif si l'UX du Collection Picker le demande.

### `ingestion_runs`

Execution d'ingestion pour une source.

| Colonne | Type | Null | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | non | Cle primaire. |
| `source_id` | `uuid` | non | FK vers `sources.id`. |
| `status` | `text` | non | `running`, `success`, `partial_success`, `failed`. |
| `started_at` | `timestamptz` | non | Debut du run. |
| `finished_at` | `timestamptz` | oui | Fin du run. |
| `detected_count` | `integer` | non | Nombre detecte. |
| `created_count` | `integer` | non | Nombre cree. |
| `ignored_count` | `integer` | non | Nombre ignore. |
| `error_count` | `integer` | non | Nombre en erreur. |
| `context` | `text` | oui | Contexte non sensible. |
| `created_at` | `timestamptz` | non | Date de creation. |

Contraintes :

- PK : `ingestion_runs_pkey (id)`.
- FK : `ingestion_runs_source_id_fkey (source_id)` vers `sources(id)`.
- Check conceptuel : `status` dans les valeurs autorisees.
- Check : compteurs superieurs ou egaux a `0`.

Index :

- `idx_ingestion_runs_source_id_started_at (source_id, started_at)` pour l'historique admin par source.
- `idx_ingestion_runs_status (status)` pour les diagnostics.

### `ingestion_errors`

Erreur non sensible rattachee a un run d'ingestion.

| Colonne | Type | Null | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | non | Cle primaire. |
| `ingestion_run_id` | `uuid` | non | FK vers `ingestion_runs.id`. |
| `resource_id` | `uuid` | oui | FK vers `resources.id` si une ressource existe deja. |
| `error_type` | `text` | non | Type stable d'erreur. |
| `public_message` | `text` | non | Message non sensible. |
| `created_at` | `timestamptz` | non | Date de creation. |

Contraintes :

- PK : `ingestion_errors_pkey (id)`.
- FK : `ingestion_errors_ingestion_run_id_fkey (ingestion_run_id)` vers `ingestion_runs(id)`.
- FK : `ingestion_errors_resource_id_fkey (resource_id)` vers `resources(id)`.

Index :

- `idx_ingestion_errors_ingestion_run_id (ingestion_run_id)`.
- `idx_ingestion_errors_resource_id (resource_id)`.
- `idx_ingestion_errors_error_type (error_type)`.

Decision : il n'y a pas de `source_id` direct dans `ingestion_errors`. La source se deduit via `ingestion_runs.source_id`, ce qui evite une redondance incoherente.

### `link_checks`

Historique de verification des URLs source.

| Colonne | Type | Null | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | non | Cle primaire. |
| `resource_id` | `uuid` | non | FK vers `resources.id`. |
| `checked_url` | `text` | non | URL verifiee. |
| `status` | `text` | non | `active`, `unavailable`, `redirect`, `unknown`, `error`. |
| `http_status_code` | `integer` | oui | Code HTTP observe. |
| `checked_at` | `timestamptz` | non | Date de controle. |
| `public_message` | `text` | oui | Message non sensible. |
| `created_at` | `timestamptz` | non | Date de creation. |

Contraintes :

- PK : `link_checks_pkey (id)`.
- FK : `link_checks_resource_id_fkey (resource_id)` vers `resources(id)`.
- Check conceptuel : `status` dans les valeurs autorisees.

Index :

- `idx_link_checks_resource_id_checked_at (resource_id, checked_at)` pour retrouver le dernier controle.
- `idx_link_checks_status (status)` pour l'admin liens indisponibles.

### `ai_summaries`

Historique des resumes IA generes pour une ressource.

| Colonne | Type | Null | Description |
| --- | --- | --- | --- |
| `id` | `uuid` | non | Cle primaire. |
| `resource_id` | `uuid` | non | FK vers `resources.id`. |
| `summary_text` | `text` | non | Resume genere. |
| `provider_type` | `text` | non | `mistral`, `groq`, `local`, `other`. |
| `status` | `text` | non | `available`, `provider_error`, `quota_exceeded`, `missing_key`, `stale`. |
| `is_current` | `boolean` | non | Resume courant affiche par le MVP. |
| `generated_at` | `timestamptz` | non | Date de generation. |
| `superseded_at` | `timestamptz` | oui | Date de remplacement par un autre resume. |
| `created_at` | `timestamptz` | non | Date de creation. |
| `updated_at` | `timestamptz` | non | Date de mise a jour. |

Contraintes :

- PK : `ai_summaries_pkey (id)`.
- FK : `ai_summaries_resource_id_fkey (resource_id)` vers `resources(id)`.
- Check conceptuel : `provider_type` dans les valeurs autorisees.
- Check conceptuel : `status` dans les valeurs autorisees.
- Contrainte partielle PostgreSQL recommandee : un seul resume courant par ressource quand `is_current = true`.

Index :

- `idx_ai_summaries_resource_id_generated_at (resource_id, generated_at)` pour l'historique.
- Index unique partiel recommande : `ai_summaries_one_current_per_resource_key (resource_id) where is_current`.

Decision : `ai_summaries` reste une table separee de `resources`, car le resume IA a un cycle de vie, un fournisseur, un statut et un historique differents. Le MVP affiche un seul resume courant, mais le modele permet plusieurs generations.

## Regles de suppression et retention

### Ressources

Une ressource est protegee de la retention automatique si au moins une ligne existe dans :

- `favorites` pour cette ressource ;
- `collection_resources` pour cette ressource.

La suppression automatique ne doit cibler que les ressources non sauvegardees et eligibles selon `retention_eligible_at`.

### Utilisateurs

La suppression d'un utilisateur doit supprimer ou traiter :

- ses favoris ;
- ses collections ;
- les lignes `collection_resources` de ses collections ;
- ses donnees personnelles de compte.

Les ressources elles-memes ne sont pas supprimees uniquement parce qu'un utilisateur est supprime, sauf si elles deviennent ensuite eligibles a retention.

## Traduction Prisma attendue

### Mapping des noms

Prisma pourra utiliser :

- modeles PascalCase : `Resource`, `Source`, `Technology` ;
- champs camelCase : `canonicalUrl`, `createdAt` ;
- mapping SQL via `@map` et `@@map`.

Exemple attendu :

```prisma
model Resource {
  id           String @id @default(uuid()) @db.Uuid
  canonicalUrl String @unique @map("canonical_url")

  @@map("resources")
}
```

### Relations explicites

Les tables suivantes doivent rester explicites dans Prisma, pas des many-to-many implicites :

- `resource_technologies`, car le nom SQL et l'index inverse doivent rester maitrises ;
- `collection_resources`, car l'association porte une date d'ajout et une regle de retention ;
- `favorites`, car l'association porte une date de sauvegarde et une contrainte d'unicite metier.

### Contraintes hors Prisma schema standard

Certaines contraintes pourront demander une migration SQL manuelle ou une decision specifique :

- index unique partiel `ai_summaries_one_current_per_resource_key`;
- checks SQL sur statuts si on ne choisit pas des enums PostgreSQL ;
- enforcement strict "une ressource doit avoir au moins une technologie".

Ces limites devront etre documentees dans la story d'implementation Prisma si elles ne sont pas directement representables dans `schema.prisma`.

## Impacts pour l'implementation Prisma

La prochaine implementation doit deriver le premier schema Prisma metier de ce MLD, mais avec un perimetre plus petit : source, technologie, categorie, ressource et table `resource_technologies`.

Elle ne doit pas forcement implementer tout ce MLD d'un coup. Les tables utilisateurs, favoris, collections, ingestion, link checks et resumes IA pourront arriver dans leurs stories dediees.

La discipline attendue est :

1. verifier le MCD/MLD avant toute modification de `schema.prisma` ;
2. implementer seulement les tables necessaires a la story courante ;
3. documenter toute divergence volontaire entre MLD et Prisma ;
4. creer une migration Prisma versionnee quand le schema metier commence.
