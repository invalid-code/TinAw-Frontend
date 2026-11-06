/**
 * Regenerates supabase/seed.sql from the demo data in src/data/stations.ts.
 * Usage: npx tsx scripts/generate-seed.ts
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATIONS } from '../src/data/stations.ts';
import type { HistoryDataPoint, WaterParameter, WaterStation } from '../src/types.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const q = (value: string): string => `'${value.replace(/'/g, "''")}'`;
const n = (value: number | undefined | null): string =>
  value === undefined || value === null ? 'NULL' : String(value);

const parameterRow = (station: WaterStation, p: WaterParameter, index: number): string =>
  `  (${[
    q(station.id),
    q(p.name),
    q(p.key),
    n(p.value),
    q(p.unit),
    q(p.status),
    q(p.statusType),
    q(p.targetLabel),
    n(p.min),
    n(p.max),
    n(p.optimalRange?.[0]),
    n(p.optimalRange?.[1]),
    n(p.targetMax),
    n(p.currentPercent),
    q(p.description),
    String(index),
  ].join(', ')})`;

const historyRow = (
  station: WaterStation,
  range: '24h' | '7d' | '30d',
  point: HistoryDataPoint,
  index: number,
): string =>
  `  (${[
    q(station.id),
    q(range),
    q(point.time),
    q(point.fullTime),
    n(point.score),
    n(point.thresholdMin),
    n(point.thresholdMax),
    n(point.turbidity),
    n(point.ph),
    n(point.tds),
    String(index),
  ].join(', ')})`;

const stationRow = (s: WaterStation): string =>
  `  (${[
    q(s.id),
    q(s.stationNumber),
    q(s.name),
    q(s.hubName),
    q(s.locationSubtitle),
    q(s.catchment),
    String(Boolean(s.isPrimary)),
    q(s.status),
    q(s.statusLabel),
    q(s.scoreDisplay),
    n(s.calculatedScore),
    q(s.scoreNote),
    n(s.clarityPercent),
    String(s.recirculationActive),
    q(s.recirculationStatus),
    n(s.recircCyclesDone),
    q(s.updatedAgo),
    q(s.lastUpdatedTimestamp),
    q(s.heroImage),
    n(s.coordinates.x),
    n(s.coordinates.y),
    n(s.coordinates.lat),
    n(s.coordinates.lng),
    q(s.assessmentSummary),
    q(s.evaluatedParametersText),
    q(s.referenceAssessmentText),
    q(s.lastVerificationDate),
  ].join(', ')})`;

const seed = `-- TinAw demo data
-- Run after supabase/schema.sql. Safe to re-run (upserts by natural keys).
-- Generated from src/data/stations.ts by scripts/generate-seed.ts.

insert into public.stations (
  id, station_number, name, hub_name, location_subtitle, catchment,
  is_primary, status, status_label, score_display, calculated_score, score_note,
  clarity_percent, recirculation_active, recirculation_status, recirc_cycles_done,
  updated_ago, last_updated_timestamp, hero_image,
  map_x, map_y, lat, lng,
  assessment_summary, evaluated_parameters_text, reference_assessment_text,
  last_verification_date
) values
${STATIONS.map(stationRow).join(',\n')}
on conflict (id) do update set
  station_number = excluded.station_number,
  name = excluded.name,
  hub_name = excluded.hub_name,
  location_subtitle = excluded.location_subtitle,
  catchment = excluded.catchment,
  is_primary = excluded.is_primary,
  status = excluded.status,
  status_label = excluded.status_label,
  score_display = excluded.score_display,
  calculated_score = excluded.calculated_score,
  score_note = excluded.score_note,
  clarity_percent = excluded.clarity_percent,
  recirculation_active = excluded.recirculation_active,
  recirculation_status = excluded.recirculation_status,
  recirc_cycles_done = excluded.recirc_cycles_done,
  updated_ago = excluded.updated_ago,
  last_updated_timestamp = excluded.last_updated_timestamp,
  hero_image = excluded.hero_image,
  map_x = excluded.map_x,
  map_y = excluded.map_y,
  lat = excluded.lat,
  lng = excluded.lng,
  assessment_summary = excluded.assessment_summary,
  evaluated_parameters_text = excluded.evaluated_parameters_text,
  reference_assessment_text = excluded.reference_assessment_text,
  last_verification_date = excluded.last_verification_date,
  updated_at = now();

insert into public.station_parameters (
  station_id, name, parameter_key, value, unit, status, status_type,
  target_label, min_value, max_value, optimal_min, optimal_max, target_max,
  current_percent, description, sort_order
) values
${STATIONS.flatMap((station) =>
  station.parameters.map((p, i) => parameterRow(station, p, i)),
).join(',\n')}
on conflict (station_id, parameter_key) do update set
  name = excluded.name,
  value = excluded.value,
  unit = excluded.unit,
  status = excluded.status,
  status_type = excluded.status_type,
  target_label = excluded.target_label,
  min_value = excluded.min_value,
  max_value = excluded.max_value,
  optimal_min = excluded.optimal_min,
  optimal_max = excluded.optimal_max,
  target_max = excluded.target_max,
  current_percent = excluded.current_percent,
  description = excluded.description,
  sort_order = excluded.sort_order;

insert into public.station_history (
  station_id, time_range, label, full_time, score, threshold_min, threshold_max,
  turbidity, ph, tds, sort_order
) values
${STATIONS.flatMap((station) => {
  const rows: string[] = [];
  (['24h', '7d', '30d'] as const).forEach((range) => {
    const points =
      range === '24h'
        ? station.history24h
        : range === '7d'
          ? station.history7d
          : station.history30d;
    points.forEach((point, i) => rows.push(historyRow(station, range, point, i)));
  });
  return rows;
}).join(',\n')}
on conflict (station_id, time_range, sort_order) do update set
  label = excluded.label,
  full_time = excluded.full_time,
  score = excluded.score,
  threshold_min = excluded.threshold_min,
  threshold_max = excluded.threshold_max,
  turbidity = excluded.turbidity,
  ph = excluded.ph,
  tds = excluded.tds;
`;

writeFileSync(resolve(root, 'supabase/seed.sql'), seed);

console.log(`Generated supabase/seed.sql for ${STATIONS.length} stations.`);
