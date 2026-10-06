-- Einstellung "Morgen-Check ab" (Minuten seit Mitternacht, Default 04:00) + Korrektur
-- bestehender Bettzeiten, die fälschlich auf dem Abend-Datum statt dem Folgetag liegen
-- (z.B. "00:30 Uhr" wurde bisher auf das Datum des Tagesabschlusses selbst gespeichert).

alter table public.profiles
  add column morning_check_after_minutes smallint not null default 240
  check (morning_check_after_minutes >= 0 and morning_check_after_minutes <= 1439);

do $$
declare
  rec record;
  threshold smallint;
begin
  for rec in
    select sl.id, sl.user_id, sl.night_of, sl.bed_at, sl.fell_asleep_at
    from public.sleep_logs sl
    where sl.bed_at is not null
      and (sl.bed_at at time zone 'Europe/Berlin')::date = sl.night_of
  loop
    select coalesce(p.morning_check_after_minutes, 240) into threshold
    from public.profiles p where p.id = rec.user_id;

    if extract(hour from (rec.bed_at at time zone 'Europe/Berlin')) * 60
       + extract(minute from (rec.bed_at at time zone 'Europe/Berlin')) < threshold then
      update public.sleep_logs
      set bed_at = rec.bed_at + interval '1 day',
          fell_asleep_at = case when rec.fell_asleep_at is not null then rec.fell_asleep_at + interval '1 day' else null end
      where id = rec.id;

      raise notice 'Korrigiert: Nacht % – Bettzeit % Uhr war auf den Abend-Tag datiert, jetzt auf den Folgetag verschoben', rec.night_of, (rec.bed_at at time zone 'Europe/Berlin')::time;
    end if;
  end loop;
end $$;
