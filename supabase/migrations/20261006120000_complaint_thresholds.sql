-- Einstellbare Schwellen für "signifikante Beschwerde" (Wochenübersicht-Überarbeitung):
-- bisher zählte jeder Befinden-Eintrag mit irgendeinem Wert > 0 als Beschwerde, was bei einem
-- 24h-Fenster fast immer zutraf. Jetzt feste, in den Einstellungen anpassbare Schwellen.

alter table public.profiles
  add column complaint_symptom_min smallint not null default 5
    check (complaint_symptom_min >= 1 and complaint_symptom_min <= 10),
  add column complaint_bristol_min smallint not null default 6
    check (complaint_bristol_min >= 4 and complaint_bristol_min <= 7),
  add column complaint_window_hours smallint not null default 8
    check (complaint_window_hours >= 2 and complaint_window_hours <= 12);
