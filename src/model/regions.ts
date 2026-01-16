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
  | "CCS" | "WGA" | "SHP" | "BDG" | "HVB" | "GLA" | "KAL" | "MTG" | "ASP"
  // Additional regional cities
  | "COF" | "PMQ" | "TMW" | "DBO" | "ORG"
  | "MLD" | "WAR" | "TRG"
  | "GER" | "ALB" | "WHY" | "DVP" | "KAT" | "IPS"
  | "BTH" | "GOU" | "LSM"
  | "HOR" | "WGR" | "SAL"
  | "GYP" | "MBH"
  | "BRO" | "KAR"
  | "PLN" | "BUR"
  | "PST" | "NMB" | "TAR" | "FOS" | "KPS" | "NRA" | "TWD" | "BLN" | "BYR"
  | "GRF" | "LET"
  | "PHD" | "NWM" | "TMP"
  | "TNC"
  | "PPR" | "PAG" | "MBR" | "VHB" | "NRC";

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
  { id: "COF", name: "Coffs Harbour", state: "NSW", isCapital: false, isMajor: true },
  { id: "PMQ", name: "Port Macquarie", state: "NSW", isCapital: false, isMajor: true },
  { id: "TMW", name: "Tamworth", state: "NSW", isCapital: false, isMajor: true },
  { id: "DBO", name: "Dubbo", state: "NSW", isCapital: false, isMajor: true },
  { id: "ORG", name: "Orange", state: "NSW", isCapital: false, isMajor: true },
  { id: "BTH", name: "Bathurst", state: "NSW", isCapital: false, isMajor: true },
  { id: "GOU", name: "Goulburn", state: "NSW", isCapital: false, isMajor: true },
  { id: "LSM", name: "Lismore", state: "NSW", isCapital: false, isMajor: true },
  { id: "PST", name: "Port Stephens", state: "NSW", isCapital: false, isMajor: true },
  { id: "NMB", name: "Nambucca", state: "NSW", isCapital: false, isMajor: true },
  { id: "TAR", name: "Taree", state: "NSW", isCapital: false, isMajor: true },
  { id: "FOS", name: "Forster–Tuncurry", state: "NSW", isCapital: false, isMajor: true },
  { id: "KPS", name: "Kempsey", state: "NSW", isCapital: false, isMajor: true },
  { id: "NRA", name: "Nowra–Shoalhaven", state: "NSW", isCapital: false, isMajor: true },
  { id: "TWD", name: "Tweed Heads", state: "NSW", isCapital: false, isMajor: true },
  { id: "BLN", name: "Ballina", state: "NSW", isCapital: false, isMajor: true },
  { id: "BYR", name: "Byron Bay", state: "NSW", isCapital: false, isMajor: true },
  { id: "GRF", name: "Griffith", state: "NSW", isCapital: false, isMajor: true },
  { id: "LET", name: "Leeton", state: "NSW", isCapital: false, isMajor: true },

  // VIC
  { id: "GEL", name: "Geelong", state: "VIC", isCapital: false, isMajor: true },
  { id: "BAL", name: "Ballarat", state: "VIC", isCapital: false, isMajor: true },
  { id: "BEN", name: "Bendigo", state: "VIC", isCapital: false, isMajor: true },
  { id: "SHP", name: "Shepparton", state: "VIC", isCapital: false, isMajor: true },
  { id: "MLD", name: "Mildura", state: "VIC", isCapital: false, isMajor: true },
  { id: "WAR", name: "Warrnambool", state: "VIC", isCapital: false, isMajor: true },
  { id: "TRG", name: "Traralgon", state: "VIC", isCapital: false, isMajor: true },
  { id: "HOR", name: "Horsham", state: "VIC", isCapital: false, isMajor: true },
  { id: "WGR", name: "Wangaratta", state: "VIC", isCapital: false, isMajor: true },
  { id: "SAL", name: "Sale", state: "VIC", isCapital: false, isMajor: true },

  // QLD
  { id: "GC", name: "Gold Coast", state: "QLD", isCapital: false, isMajor: true },
  { id: "SC", name: "Sunshine Coast", state: "QLD", isCapital: false, isMajor: true },
  { id: "TSV", name: "Townsville", state: "QLD", isCapital: false, isMajor: true },
  { id: "CNS", name: "Cairns", state: "QLD", isCapital: false, isMajor: true },
  { id: "TWB", name: "Toowoomba", state: "QLD", isCapital: false, isMajor: true },
  { id: "BDG", name: "Bundaberg", state: "QLD", isCapital: false, isMajor: true },
  { id: "HVB", name: "Hervey Bay", state: "QLD", isCapital: false, isMajor: true },
  { id: "GLA", name: "Gladstone", state: "QLD", isCapital: false, isMajor: true },
  { id: "IPS", name: "Ipswich", state: "QLD", isCapital: false, isMajor: true },
  { id: "GYP", name: "Gympie", state: "QLD", isCapital: false, isMajor: true },
  { id: "MBH", name: "Maryborough", state: "QLD", isCapital: false, isMajor: true },

  // Cross-border / regional hubs
  { id: "ALW", name: "Albury–Wodonga", state: "NSW", isCapital: false, isMajor: true },

  // TAS
  { id: "LST", name: "Launceston", state: "TAS", isCapital: false, isMajor: true },
  { id: "DVP", name: "Devonport", state: "TAS", isCapital: false, isMajor: true },
  { id: "BUR", name: "Burnie", state: "TAS", isCapital: false, isMajor: true },

  // QLD/WA regional
  { id: "MKY", name: "Mackay", state: "QLD", isCapital: false, isMajor: true },
  { id: "ROP", name: "Rockhampton", state: "QLD", isCapital: false, isMajor: true },
  { id: "BUN", name: "Bunbury", state: "WA", isCapital: false, isMajor: true },
  { id: "KAL", name: "Kalgoorlie–Boulder", state: "WA", isCapital: false, isMajor: true },
  { id: "GER", name: "Geraldton", state: "WA", isCapital: false, isMajor: true },
  { id: "ALB", name: "Albany", state: "WA", isCapital: false, isMajor: true },
  { id: "BRO", name: "Broome", state: "WA", isCapital: false, isMajor: true },
  { id: "KAR", name: "Karratha", state: "WA", isCapital: false, isMajor: true },
  { id: "PHD", name: "Port Hedland", state: "WA", isCapital: false, isMajor: true },
  { id: "NWM", name: "Newman", state: "WA", isCapital: false, isMajor: true },
  { id: "TMP", name: "Tom Price", state: "WA", isCapital: false, isMajor: true },
  { id: "MTG", name: "Mount Gambier", state: "SA", isCapital: false, isMajor: true },
  { id: "WHY", name: "Whyalla", state: "SA", isCapital: false, isMajor: true },
  { id: "PLN", name: "Port Lincoln", state: "SA", isCapital: false, isMajor: true },
  { id: "PPR", name: "Port Pirie", state: "SA", isCapital: false, isMajor: true },
  { id: "PAG", name: "Port Augusta", state: "SA", isCapital: false, isMajor: true },
  { id: "MBR", name: "Murray Bridge", state: "SA", isCapital: false, isMajor: true },
  { id: "VHB", name: "Victor Harbor", state: "SA", isCapital: false, isMajor: true },
  { id: "NRC", name: "Naracoorte", state: "SA", isCapital: false, isMajor: true },
  { id: "ASP", name: "Alice Springs", state: "NT", isCapital: false, isMajor: true },
  { id: "KAT", name: "Katherine", state: "NT", isCapital: false, isMajor: true },
  { id: "TNC", name: "Tennant Creek", state: "NT", isCapital: false, isMajor: true },
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
