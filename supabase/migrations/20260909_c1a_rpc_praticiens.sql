-- =====================================================================
-- C1-A — Les six RPC publiques (PUREMENT ADDITIF)
-- =====================================================================
-- Fichier 1 sur 2. Ce script CRÉE les RPC que le front de la PR #57 appelle.
-- Il ne retire aucun droit et ne modifie aucune vue : l'ancien front
-- (production Cloudflare, déploiement wrangler manuel) continue de lire
-- public_doctors exactement comme avant. Il peut être joué à tout moment,
-- AVANT le merge et AVANT le déploiement.
--
-- Le second fichier, 20260909_c1b_fermeture_vue_public_doctors.sql, retire
-- les droits sur les vues. Il ne doit être joué qu'APRÈS le déploiement en
-- production d'un front qui n'appelle plus la vue (condition détaillée dans
-- son en-tête et dans la PR #57).
--
-- Pourquoi security_invoker n'est PAS ici : poser security_invoker = true
-- sur public_doctors fait lire doctor_profiles avec les droits de l'appelant.
-- anon n'a aucun droit sur doctor_profiles (CRIT-4, REVOKE de juillet) :
-- la vue répondrait « permission denied » à l'ancien front dès le COMMIT.
-- Ce n'est donc pas additif, c'est la coupure elle-même → fichier 1B.
--
-- Garde-fous des RPC (toutes SECURITY DEFINER, propriétaire postgres,
-- search_path figé) : pagination ≤ 50, page ≤ 100, wilaya OU spécialité
-- obligatoire pour la recherche, lots d'identifiants ≤ 100, agrégats sans
-- nom pour les compteurs et le générateur SEO.
--
-- Pourquoi SECURITY DEFINER et non INVOKER + policy publique : une policy
-- SELECT « publique » sur doctor_profiles rouvrirait l'énumération sur la
-- TABLE via PostgREST (/rest/v1/doctor_profiles?select=full_name&limit=1000).
--
-- À EXÉCUTER PAR AGHILES dans le SQL Editor. Rien n'est exécuté par l'agent.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Recherche paginée — remplace tous les SELECT filtrés du front
-- ---------------------------------------------------------------------
create or replace function public.chercher_praticiens(
  p_wilaya      text    default null,   -- name_fr ou code ('16')
  p_specialite  text    default null,   -- slug, name_fr, ou préfixe de name_fr
  p_q           text    default null,   -- texte libre sur le nom (≤ 60 car.)
  p_type        text    default null,   -- entity_type exact
  p_page        integer default 1,      -- 1..100
  p_limite      integer default 20,     -- 1..50
  p_reclamables boolean default false   -- fiches à revendiquer (doctor-claim)
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_page   integer := least(greatest(coalesce(p_page, 1), 1), 100);
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_wilaya text    := nullif(trim(coalesce(p_wilaya, '')), '');
  v_spec   text    := nullif(trim(coalesce(p_specialite, '')), '');
  v_q      text    := nullif(left(trim(coalesce(p_q, '')), 60), '');
  v_type   text    := nullif(trim(coalesce(p_type, '')), '');
  v_total  bigint  := 0;
  v_lignes jsonb   := '[]'::jsonb;
begin
  -- Garde-fou n° 1 : jamais de parcours sans périmètre géographique ou
  -- de spécialité. PostgREST traduit ce RAISE en HTTP 400.
  if v_wilaya is null and v_spec is null then
    raise exception 'filtre_obligatoire'
      using detail = 'Indiquez une wilaya ou une spécialité.',
            hint   = 'p_wilaya ou p_specialite',
            errcode = 'P0001';
  end if;

  -- Le texte libre est un motif ilike dont on neutralise les jokers.
  if v_q is not null then
    v_q := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) - 'total_' order by t.name_sort_key nulls last, t.id), '[]'::jsonb),
         coalesce(max(t.total_), 0)
    into v_lignes, v_total
  from (
    select v.*, count(*) over () as total_
      from public.public_doctors v
     where (v_wilaya is null or v.wilaya_fr = v_wilaya or v.wilaya_code::text = v_wilaya)
       and (v_spec   is null or v.specialty_slug = v_spec or v.specialty_fr = v_spec
                             or v.specialty_fr ilike v_spec || '%')
       and (v_type   is null or v.entity_type = v_type)
       and (v_q      is null or v.full_name ilike v_q or v.full_name_ar ilike v_q)
       and (not coalesce(p_reclamables, false)
            or (v.legacy_id is not null and v.is_claimed = false))
     order by v.name_sort_key nulls last, v.id
     offset (v_page - 1) * v_limite
     limit  v_limite
  ) t;

  return jsonb_build_object(
    'total',  v_total,
    'page',   v_page,
    'limite', v_limite,
    'lignes', v_lignes
  );
end;
$$;

comment on function public.chercher_praticiens(text, text, text, text, integer, integer, boolean) is
  'C1 — recherche publique paginée (≤50/page, page ≤100), wilaya ou spécialité obligatoire. Retourne {total, page, limite, lignes}.';

-- ---------------------------------------------------------------------
-- 2. Une fiche — par UUID ou par legacy_id (doctor-profile, doctors-display)
-- ---------------------------------------------------------------------
create or replace function public.praticien(
  p_id        uuid    default null,
  p_legacy_id integer default null
)
returns setof public.public_doctors
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select v.*
    from public.public_doctors v
   where (p_id is not null and v.id = p_id)
      or (p_id is null and p_legacy_id is not null and v.legacy_id = p_legacy_id)
   limit 1;
$$;

comment on function public.praticien(uuid, integer) is
  'C1 — une fiche publique par id ou legacy_id (0 ou 1 ligne).';

-- ---------------------------------------------------------------------
-- 3. Un lot d'identifiants connus — hydratation RDV / messagerie (≤ 100)
-- ---------------------------------------------------------------------
create or replace function public.praticiens_par_ids(p_ids uuid[])
returns setof public.public_doctors
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select v.*
    from public.public_doctors v
   where cardinality(coalesce(p_ids, '{}'::uuid[])) between 1 and 100
     and v.id = any (p_ids)
   limit 100;
$$;

comment on function public.praticiens_par_ids(uuid[]) is
  'C1 — fiches publiques pour une liste d''UUID déjà connus de l''appelant (≤ 100).';

-- ---------------------------------------------------------------------
-- 4. Carte — uniquement les fiches revendiquées + validées géolocalisées
--    (0 ligne aujourd'hui ; 500 au plus, jamais la base entière)
-- ---------------------------------------------------------------------
create or replace function public.praticiens_carte(
  p_wilaya     text default null,
  p_specialite text default null
)
returns setof public.public_doctors
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select v.*
    from public.public_doctors v
   where v.is_claimed = true
     and v.validation_status = 'approved'
     and v.latitude  is not null
     and v.longitude is not null
     and (nullif(trim(coalesce(p_wilaya, '')), '')     is null or v.wilaya_fr = p_wilaya)
     and (nullif(trim(coalesce(p_specialite, '')), '') is null or v.specialty_fr = p_specialite)
   order by v.name_sort_key nulls last
   limit 500;
$$;

comment on function public.praticiens_carte(text, text) is
  'C1 — épingles de la carte : fiches revendiquées, validées et géolocalisées (≤ 500).';

-- ---------------------------------------------------------------------
-- 5. Compteurs et listes de filtres — agrégats, aucun nom ne sort
--    (remplace 58 COUNT + 1 fetch de 500 lignes + 1 COUNT sur l'accueil,
--     et 2 fetch de 10 000 lignes sur doctor-claim)
-- ---------------------------------------------------------------------
create or replace function public.stats_publiques()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with b as materialized (
    select wilaya_code, wilaya_fr, specialty_fr, validation_status
      from public.public_doctors
  )
  select jsonb_build_object(
    'total',      (select count(*) from b),
    'certifies',  (select count(*) from b where validation_status = 'approved'),
    'par_wilaya', (select coalesce(jsonb_object_agg(wilaya_code, n), '{}'::jsonb)
                     from (select wilaya_code, count(*) n from b
                            where wilaya_code is not null group by 1) w),
    'wilayas',    (select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
                     from (select distinct wilaya_fr x from b where wilaya_fr is not null) w2),
    'specialites',(select coalesce(jsonb_agg(x order by x), '[]'::jsonb)
                     from (select distinct specialty_fr x from b where specialty_fr is not null) s)
  );
$$;

comment on function public.stats_publiques() is
  'C1 — compteurs publics : total, certifiés, par wilaya, listes wilayas/spécialités. Aucune donnée nominative.';

-- ---------------------------------------------------------------------
-- 6. Générateur SEO — couples (wilaya, spécialité, commune) + effectif
--    (remplace la lecture des 75 034 lignes par la clé anon)
-- ---------------------------------------------------------------------
create or replace function public.seo_couples()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'wilaya_code',    wilaya_code,
           'wilaya_fr',      wilaya_fr,
           'specialty_slug', specialty_slug,
           'specialty_fr',   specialty_fr,
           'city',           city,
           'n',              n)), '[]'::jsonb)
    from (
      select wilaya_code, wilaya_fr, specialty_slug, specialty_fr,
             nullif(trim(coalesce(city, '')), '') as city, count(*) as n
        from public.public_doctors
       group by 1, 2, 3, 4, 5
    ) t;
$$;

comment on function public.seo_couples() is
  'C1 — agrégat (wilaya, spécialité, commune, effectif) pour scripts/generate-seo-pages.mjs. Aucun nom.';

-- ---------------------------------------------------------------------
-- 7. Droits d'exécution explicites (les privilèges par défaut du projet
--    donnent EXECUTE à public : on les remplace par une liste fermée)
-- ---------------------------------------------------------------------
revoke execute on function public.chercher_praticiens(text, text, text, text, integer, integer, boolean) from public;
revoke execute on function public.praticien(uuid, integer)                 from public;
revoke execute on function public.praticiens_par_ids(uuid[])              from public;
revoke execute on function public.praticiens_carte(text, text)            from public;
revoke execute on function public.stats_publiques()                       from public;
revoke execute on function public.seo_couples()                           from public;

grant execute on function public.chercher_praticiens(text, text, text, text, integer, integer, boolean) to anon, authenticated, service_role;
grant execute on function public.praticien(uuid, integer)                 to anon, authenticated, service_role;
grant execute on function public.praticiens_par_ids(uuid[])              to anon, authenticated, service_role;
grant execute on function public.praticiens_carte(text, text)            to anon, authenticated, service_role;
grant execute on function public.stats_publiques()                       to anon, authenticated, service_role;
grant execute on function public.seo_couples()                           to anon, authenticated, service_role;

commit;

-- =====================================================================
-- Vérification (SELECT, après le COMMIT)
-- =====================================================================
--    select public.chercher_praticiens();                   -- attendu : ERREUR filtre_obligatoire
--    select (public.chercher_praticiens(p_wilaya => 'Alger', p_limite => 500)->>'limite')::int;
--                                                           -- attendu : 50
--    select jsonb_array_length(public.chercher_praticiens(p_wilaya => 'Alger')->'lignes');
--                                                           -- attendu : 20
--    select count(*) from public.praticien(p_legacy_id => 1);   -- attendu : 0 ou 1
--    select public.stats_publiques()->>'total';             -- attendu : 75034 (ordre de grandeur)
--    -- l'ancien front doit TOUJOURS lire la vue :
--    GET /rest/v1/public_doctors?select=id&limit=1 (clé anon)  -- attendu : 200
--    node scripts/verifier-c1.mjs --live                    -- 1er appel ✗ (vue ouverte, normal
--                                                           --   avant 1B), 2e et 3e appels ✓

-- =====================================================================
-- Retour arrière de 1A (purement soustractif : rien d'autre ne dépend
-- de ces fonctions tant que le nouveau front n'est pas déployé)
-- =====================================================================
-- begin;
-- drop function if exists public.chercher_praticiens(text, text, text, text, integer, integer, boolean);
-- drop function if exists public.praticien(uuid, integer);
-- drop function if exists public.praticiens_par_ids(uuid[]);
-- drop function if exists public.praticiens_carte(text, text);
-- drop function if exists public.stats_publiques();
-- drop function if exists public.seo_couples();
-- commit;
