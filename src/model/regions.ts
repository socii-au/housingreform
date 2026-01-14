/**
 * Region registry + scope types
 *
 * Defines all Australian cities (capitals + major urban areas)
 * and provides scope filtering for aggregation views.
 */

export type StateId = "NSW" | "VIC" | "QLD" | "WA" | "SA" | "TAS" | "NT" | "ACT";

export type CityId =
  // Capital cities
  | "SYD" | "MEL" | "BNE" | "PER" | "ADL" | "HBA" | "DRW" | "CBR"
  // Major non-capital urban areas
  | "NCL" | "WOL" | "GEL" | "GC" | "SC" | "TSV" | "CNS" | "TWB"
  | "BAL" | "BEN" | "ALW" | "LST" | "MKY" | "ROP" | "BUN"
  // Expanded regional centres
  | "CCS" | "WGA" | "SHP" | "BDG" | "HVB" | "GLA" | "KAL" | "MTG" | "ASP";

export interface CityMeta {
  id: CityId;
  name: string;
  state: StateId;
  isCapital: boolean;
  isMajor: boolean;
}

/**
 * Major cities registry:
 * - Capitals + commonly-modelled major urban centres
 * - You can extend this list without changing model logic.
 */
export const CITIES: CityMeta[] = [
  // Capitals
  { id: "SYD", name: "Sydney", state: "NSW", isCapital: true, isMajor: true },
  { id: "MEL", name: "Melbourne", state: "VIC", isCapital: true, isMajor: true },
  { id: "BNE", name: "Brisbane", state: "QLD", isCapital: true, isMajor: true },
  { id: "PER", name: "Perth", state: "WA", isCapital: true, isMajor: true },
  { id: "ADL", name: "Adelaide", state: "SA", isCapital: true, isMajor: true },
  { id: "HBA", name: "Hobart", state: "TAS", isCapital: true, isMajor: true },
  { id: "DRW", name: "Darwin", state: "NT", isCapital: true, isMajor: true },
  { id: "CBR", name: "Canberra", state: "ACT", isCapital: true, isMajor: true },

  // NSW
  { id: "NCL", name: "Newcastle", state: "NSW", isCapital: false, isMajor: true },
  { id: "WOL", name: "Wollongong", state: "NSW", isCapital: false, isMajor: true },
  { id: "CCS", name: "Central Coast", state: "NSW", isCapital: false, isMajor: true },
  { id: "WGA", name: "Wagga Wagga", state: "NSW", isCapital: false, isMajor: true },

  // VIC
  { id: "GEL", name: "Geelong", state: "VIC", isCapital: false, isMajor: true },
  { id: "BAL", name: "Ballarat", state: "VIC", isCapital: false, isMajor: true },
  { id: "BEN", name: "Bendigo", state: "VIC", isCapital: false, isMajor: true },
  { id: "SHP", name: "Shepparton", state: "VIC", isCapital: false, isMajor: true },

  // QLD
  { id: "GC", name: "Gold Coast", state: "QLD", isCapital: false, isMajor: true },
  { id: "SC", name: "Sunshine Coast", state: "QLD", isCapital: false, isMajor: true },
  { id: "TSV", name: "Townsville", state: "QLD", isCapital: false, isMajor: true },
  { id: "CNS", name: "Cairns", state: "QLD", isCapital: false, isMajor: true },
  { id: "TWB", name: "Toowoomba", state: "QLD", isCapital: false, isMajor: true },
  { id: "BDG", name: "Bundaberg", state: "QLD", isCapital: false, isMajor: true },
  { id: "HVB", name: "Hervey Bay", state: "QLD", isCapital: false, isMajor: true },
  { id: "GLA", name: "Gladstone", state: "QLD", isCapital: false, isMajor: true },

  // Cross-border / regional hubs
  { id: "ALW", name: "Albury–Wodonga", state: "NSW", isCapital: false, isMajor: true },

  // TAS
  { id: "LST", name: "Launceston", state: "TAS", isCapital: false, isMajor: true },

  // QLD/WA regional
  { id: "MKY", name: "Mackay", state: "QLD", isCapital: false, isMajor: true },
  { id: "ROP", name: "Rockhampton", state: "QLD", isCapital: false, isMajor: true },
  { id: "BUN", name: "Bunbury", state: "WA", isCapital: false, isMajor: true },
  { id: "KAL", name: "Kalgoorlie–Boulder", state: "WA", isCapital: false, isMajor: true },
  { id: "MTG", name: "Mount Gambier", state: "SA", isCapital: false, isMajor: true },
  { id: "ASP", name: "Alice Springs", state: "NT", isCapital: false, isMajor: true },
];

export function cityMeta(id: CityId): CityMeta {
  const m = CITIES.find((c) => c.id === id);
  if (!m) throw new Error(`Unknown city id: ${id}`);
  return m;
}

export function getCapitalCities(): CityMeta[] {
  return CITIES.filter((c) => c.isCapital);
}

export function getMajorCities(): CityMeta[] {
  return CITIES.filter((c) => c.isMajor);
}

export function getCitiesByState(state: StateId): CityMeta[] {
  return CITIES.filter((c) => c.state === state);
}

export const ALL_STATES: StateId[] = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT", "ACT"];

export const STATE_NAMES: Record<StateId, string> = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  WA: "Western Australia",
  SA: "South Australia",
  TAS: "Tasmania",
  NT: "Northern Territory",
  ACT: "Australian Capital Territory",
};

export type Scope =
  | { level: "national" }
  | { level: "state"; state: StateId }
  | { level: "city"; city: CityId };

export function scopeKey(scope: Scope): string {
  if (scope.level === "national") return "NATIONAL";
  if (scope.level === "state") return `STATE:${scope.state}`;
  return `CITY:${scope.city}`;
}

export function scopeLabel(scope: Scope): string {
  if (scope.level === "national") return "National";
  if (scope.level === "state") return STATE_NAMES[scope.state];
  return cityMeta(scope.city).name;
}

export function parseScope(key: string): Scope {
  if (key === "NATIONAL") return { level: "national" };
  if (key.startsWith("STATE:")) {
    return { level: "state", state: key.replace("STATE:", "") as StateId };
  }
  if (key.startsWith("CITY:")) {
    return { level: "city", city: key.replace("CITY:", "") as CityId };
  }
  throw new Error(`Invalid scope key: ${key}`);
}
