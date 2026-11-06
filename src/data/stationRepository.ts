import { supabase } from '../lib/supabase';
import { STATIONS } from './stations';
import type {
  HistoryDataPoint,
  WaterParameter,
  WaterStation,
} from '../types';

export type StationDataSource = 'supabase' | 'static';

export interface LoadStationsResult {
  stations: WaterStation[];
  source: StationDataSource;
  error?: string;
}

interface StationParameterRow {
  name: string;
  parameter_key: WaterParameter['key'];
  value: number | string;
  unit: string;
  status: WaterParameter['status'];
  status_type: WaterParameter['statusType'];
  target_label: string;
  min_value: number | string;
  max_value: number | string;
  optimal_min: number | string | null;
  optimal_max: number | string | null;
  target_max: number | string | null;
  current_percent: number | string;
  description: string;
  sort_order: number;
}

interface StationHistoryRow {
  time_range: '24h' | '7d' | '30d';
  label: string;
  full_time: string;
  score: number | string;
  threshold_min: number | string;
  threshold_max: number | string;
  turbidity: number | string;
  ph: number | string;
  tds: number | string;
  sort_order: number;
}

interface StationRow {
  id: string;
  station_number: string;
  name: string;
  hub_name: string;
  location_subtitle: string;
  catchment: string;
  is_primary: boolean;
  status: WaterStation['status'];
  status_label: string;
  score_display: string;
  calculated_score: number | string;
  score_note: string;
  clarity_percent: number | string;
  recirculation_active: boolean;
  recirculation_status: string;
  recirc_cycles_done: number | string;
  updated_ago: string;
  last_updated_timestamp: string;
  hero_image: string;
  map_x: number | string;
  map_y: number | string;
  lat: number | string;
  lng: number | string;
  assessment_summary: string;
  evaluated_parameters_text: string;
  reference_assessment_text: string;
  last_verification_date: string;
  station_parameters: StationParameterRow[] | null;
  station_history: StationHistoryRow[] | null;
}

const toNumber = (value: number | string): number =>
  typeof value === 'number' ? value : Number(value);

const mapParameter = (row: StationParameterRow): WaterParameter => {
  const optimalRange =
    row.optimal_min !== null && row.optimal_max !== null
      ? ([toNumber(row.optimal_min), toNumber(row.optimal_max)] as [number, number])
      : undefined;

  return {
    name: row.name,
    key: row.parameter_key,
    value: toNumber(row.value),
    unit: row.unit,
    status: row.status,
    statusType: row.status_type,
    targetLabel: row.target_label,
    min: toNumber(row.min_value),
    max: toNumber(row.max_value),
    optimalRange,
    targetMax: row.target_max === null ? undefined : toNumber(row.target_max),
    currentPercent: toNumber(row.current_percent),
    description: row.description,
  };
};

const mapHistory = (
  rows: StationHistoryRow[] | null,
  range: StationHistoryRow['time_range'],
): HistoryDataPoint[] =>
  (rows ?? [])
    .filter((row) => row.time_range === range)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({
      time: row.label,
      fullTime: row.full_time,
      score: toNumber(row.score),
      thresholdMin: toNumber(row.threshold_min),
      thresholdMax: toNumber(row.threshold_max),
      turbidity: toNumber(row.turbidity),
      ph: toNumber(row.ph),
      tds: toNumber(row.tds),
    }));

const mapStation = (row: StationRow): WaterStation => ({
  id: row.id,
  stationNumber: row.station_number,
  name: row.name,
  hubName: row.hub_name,
  locationSubtitle: row.location_subtitle,
  catchment: row.catchment,
  isPrimary: row.is_primary,
  status: row.status,
  statusLabel: row.status_label,
  scoreDisplay: row.score_display,
  calculatedScore: toNumber(row.calculated_score),
  scoreNote: row.score_note,
  clarityPercent: toNumber(row.clarity_percent),
  recirculationActive: row.recirculation_active,
  recirculationStatus: row.recirculation_status,
  recircCyclesDone: toNumber(row.recirc_cycles_done),
  updatedAgo: row.updated_ago,
  lastUpdatedTimestamp: row.last_updated_timestamp,
  heroImage: row.hero_image,
  coordinates: {
    x: toNumber(row.map_x),
    y: toNumber(row.map_y),
    lat: toNumber(row.lat),
    lng: toNumber(row.lng),
  },
  parameters: (row.station_parameters ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(mapParameter),
  history24h: mapHistory(row.station_history, '24h'),
  history7d: mapHistory(row.station_history, '7d'),
  history30d: mapHistory(row.station_history, '30d'),
  assessmentSummary: row.assessment_summary,
  evaluatedParametersText: row.evaluated_parameters_text,
  referenceAssessmentText: row.reference_assessment_text,
  lastVerificationDate: row.last_verification_date,
});

/**
 * Loads stations from Supabase when credentials are configured.
 * Falls back to the bundled demo data on missing config, network errors,
 * or an empty result set so the public dashboard always renders.
 */
export async function loadStations(): Promise<LoadStationsResult> {
  if (!supabase) {
    console.info(
      '[TinAw] Supabase is not configured. Using bundled demo data. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.',
    );
    return { stations: STATIONS, source: 'static' };
  }

  try {
    const { data, error } = await supabase
      .from('stations')
      .select('*, station_parameters(*), station_history(*)')
      .order('station_number', { ascending: true });

    if (error) throw error;

    const rows = (data ?? []) as StationRow[];
    if (rows.length === 0) {
      console.warn(
        '[TinAw] Supabase returned no stations. Falling back to bundled demo data.',
      );
      return {
        stations: STATIONS,
        source: 'static',
        error: 'No stations found in Supabase.',
      };
    }

    console.info(`[TinAw] Loaded ${rows.length} stations from Supabase.`);
    return { stations: rows.map(mapStation), source: 'supabase' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[TinAw] Supabase request failed: ${message}. Falling back to bundled demo data.`,
    );
    return { stations: STATIONS, source: 'static', error: message };
  }
}
