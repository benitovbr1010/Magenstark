-- Mehrere Bilder pro Befund (SPEC.md §4.9 Erweiterung): ein Dokument kann aus mehreren Fotos bestehen,
-- die zusammen ausgewertet werden. file_path bleibt als erstes Bild für Abwärtskompatibilität erhalten.
alter table documents add column file_paths text[] not null default '{}';
update documents set file_paths = array[file_path] where file_path is not null;
