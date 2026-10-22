export interface TrackingEntry {
  id: string;
  league: "nba" | "nfl" | "other";
  event_name: string;
  selection: string;
  american_odds: number | null;
  stake: number | null;
  notes: string | null;
  source: "manual" | "ocr_confirmed";
  created_at: string;
}

const STORAGE_KEY = "edge_scanner_tracking_entries";

export function getTrackingEntries(): TrackingEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTrackingEntry(
  entry: Omit<TrackingEntry, "id" | "created_at">
): TrackingEntry {
  const existing = getTrackingEntries();
  const newEntry: TrackingEntry = {
    ...entry,
    id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };
  const updated = [newEntry, ...existing];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 50)));
  } catch {
    // Local storage limit fallback
  }
  return newEntry;
}
