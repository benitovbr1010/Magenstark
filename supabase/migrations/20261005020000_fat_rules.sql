-- Fett-Bewertung mit festen Regeln statt freier KI-Einschätzung:
-- - "gesunde_fette" (gut) nur für eine feste Zutatenliste (Öle, Nüsse, Samen, Avocado, fetter Fisch).
-- - "fettreich" (möglicher Auslöser) ersetzt "fettig_frittiert": wird vergeben bei Zubereitung
--   (frittiert/paniert/viel Öl) ODER wenn eine fettreiche Zutat in GROSSER Menge vorkommt.
-- Die KI liefert dafür nur noch Mengeneinschätzung + Zubereitungsart pro Zutat, der CODE entscheidet
-- nach festen Regeln (siehe supabase/functions/analyze-meal/index.ts, src/lib/ingredientProfiles.ts).

-- 1) Mahlzeiten: Mengeneinschätzung + Zubereitungsart pro Zutat speichern, damit Marker-Herkunft und
-- Begründungen auch beim späteren Anzeigen/Neuberechnen verfügbar sind (analog zu "ingredients").
alter table public.meals add column ingredient_details jsonb not null default '{}'::jsonb;

-- 2) Cache invalidieren: das Extraktions-Schema hat sich geändert (Zutaten sind jetzt Objekte mit
-- Menge/Zubereitung statt reiner Namen) – alte Cache-Einträge würden dem neuen Code fehlende Felder
-- liefern. Reiner Performance-Cache, wird bei Bedarf automatisch neu befüllt, kein Datenverlust.
truncate table public.meal_analysis_cache;

-- 3) Bestehende Zutaten-Marker bereinigen: "fettig_frittiert" gab es nie als Zutaten-Marker (nur als
-- Zubereitungs-Marker auf Mahlzeiten-Ebene), dieser Schritt ist eine reine Absicherung.
update public.ingredient_profiles set markers = array_remove(markers, 'fettig_frittiert')
  where 'fettig_frittiert' = any(markers);

-- 4) "gesunde_fette" auf die feste Liste beschränken (Öle, Nüsse, Samen, Avocado, fetter Fisch).
-- Käse, Butter, Sahne, Wurst, Speck etc. verlieren den Marker, falls fälschlich gesetzt.
with healthy_fat_keywords(kw) as (
  values
    ('olivenöl'), ('rapsöl'), ('leinöl'),
    ('nuss'), ('nüsse'), ('mandel'), ('walnuss'), ('haselnuss'), ('cashew'), ('pistazie'),
    ('erdnuss'), ('macadamia'), ('paranuss'),
    ('samen'), ('kerne'), ('chiasamen'), ('leinsamen'), ('kürbiskern'), ('sonnenblumenkern'), ('hanfsamen'),
    ('avocado'),
    ('lachs'), ('makrele'), ('hering'), ('thunfisch'), ('sardine'), ('forelle')
)
update public.ingredient_profiles p
set good_markers = array_remove(p.good_markers, 'gesunde_fette')
  || case
       when exists (select 1 from healthy_fat_keywords k where p.name ilike '%' || k.kw || '%')
       then array['gesunde_fette']
       else array[]::text[]
     end;

-- 5) Marker-Umbenennung in bereits gespeicherten Mahlzeiten/gespeicherten Mahlzeiten-Vorlagen
-- (Fallback für Zeilen, die nicht über das Neuberechnungs-Skript aktualisiert werden).
update public.meals set markers = array_replace(markers, 'fettig_frittiert', 'fettreich')
  where 'fettig_frittiert' = any(markers);
update public.meals set prep_markers = array_replace(prep_markers, 'fettig_frittiert', 'fettreich')
  where 'fettig_frittiert' = any(prep_markers);
update public.saved_meals set markers = array_replace(markers, 'fettig_frittiert', 'fettreich')
  where 'fettig_frittiert' = any(markers);
