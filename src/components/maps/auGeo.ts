export type GeoPoint = [number, number];

export interface GeoPolygon {
  type: "Polygon";
  coordinates: GeoPoint[][];
}

export interface GeoFeature<P> {
  type: "Feature";
  properties: P;
  geometry: GeoPolygon;
}

export interface FeatureCollection<P> {
  type: "FeatureCollection";
  features: Array<GeoFeature<P>>;
}

import type { CityId, StateId } from "../../model/regions";

/**
 * Embedded simplified geometry in the same coordinate system as the map viewBox:
 * 0..1000 (x) by 0..760 (y).
 *
 * Projection: equirectangular centred on Australia.
 *   x = (lon − 112) × 20.5 + 40
 *   y = (lat − 9.5) × 19.0 + 50   (lat is degrees south, positive = south)
 *
 * Coastlines are traced from real geography with ~10-15 points per state
 * to produce a recognisable silhouette while keeping the data compact.
 */

// ─── helpers ─────────────────────────────────────────────────────────

function px(lon: number): number { return Math.round((lon - 112) * 20.5 + 40); }
function py(lat: number): number { return Math.round((lat - 9.5) * 19.0 + 50); }

// ─── state outlines ──────────────────────────────────────────────────

export const AU_STATES_GEOJSON: FeatureCollection<{
  id: StateId;
  name: string;
}> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { id: "WA", name: "Western Australia" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          // Clockwise from NE corner (129°E border on north coast)
          [px(129), py(14.7)],   // NE — border with NT on coast
          [px(126), py(13.8)],   // Kimberley coast
          [px(123), py(16.5)],   // Broome area
          [px(118), py(20)],     // coast south
          [px(114.5), py(22)],   // NW Cape / Exmouth
          [px(113), py(24.5)],   // Shark Bay
          [px(113.5), py(27)],   // coast
          [px(115), py(30)],     // coast north of Perth
          [px(115.5), py(32)],   // Perth coast
          [px(115), py(34.3)],   // SW corner (Augusta)
          [px(118), py(35)],     // south coast east
          [px(123), py(34)],     // Bight coast
          [px(129), py(31.5)],   // SE — border with SA on coast
          [px(129), py(14.7)],   // close
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "NT", name: "Northern Territory" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          // Clockwise from NW coast
          [px(129), py(14.7)],   // WA border on coast
          [px(129), py(12.5)],   // coast NW
          [px(131), py(12)],     // Darwin area
          [px(132), py(11.3)],   // Top End
          [px(134), py(11)],     // Arnhem Land
          [px(136.5), py(12)],   // E Arnhem coast
          [px(137), py(14)],     // Gulf west side
          [px(138), py(16)],     // Gulf — QLD border
          [px(138), py(26)],     // SA border (26°S at 138°E)
          [px(129), py(26)],     // SA border (26°S at 129°E)
          [px(129), py(14.7)],   // close
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "SA", name: "South Australia" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          // Clockwise from NW (129°E, 26°S)
          [px(129), py(26)],     // NW
          [px(138), py(26)],     // NE (NT border)
          [px(141), py(26)],     // border with QLD
          [px(141), py(34)],     // border with NSW
          [px(141), py(38)],     // SE — VIC border coast
          [px(140), py(38.2)],   // coast
          [px(139), py(35.8)],   // Murray mouth
          [px(138.6), py(35.2)], // Gulf St Vincent east
          [px(138), py(34.8)],   // Adelaide coast
          [px(137.5), py(34.8)], // between gulfs
          [px(137.6), py(32.5)], // Spencer Gulf head (Pt Augusta)
          [px(136.5), py(34.5)], // Spencer Gulf west
          [px(135.5), py(34.5)], // Eyre Peninsula
          [px(133), py(32.5)],   // Ceduna
          [px(131), py(32)],     // Bight coast
          [px(129), py(31.5)],   // WA border coast
          [px(129), py(26)],     // close
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "QLD", name: "Queensland" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          // Clockwise from Gulf coast
          [px(138), py(16)],     // NT border on Gulf
          [px(139), py(17)],     // Gulf coast
          [px(141), py(18)],     // Gulf coast E
          [px(141), py(12)],     // Cape York west
          [px(142.5), py(10.7)], // Cape York tip
          [px(143.5), py(11.5)], // Cape York east
          [px(145.5), py(15)],   // Cooktown coast
          [px(146), py(17)],     // Cairns
          [px(147), py(19.5)],   // Townsville
          [px(149.5), py(21)],   // Mackay
          [px(150.5), py(23.5)], // Rockhampton
          [px(153), py(26.5)],   // Sunshine Coast
          [px(153.5), py(27.5)], // Brisbane / Gold Coast coast
          [px(153.5), py(28.2)], // NSW border on coast
          [px(141), py(29)],     // NSW border inland (29°S)
          [px(141), py(26)],     // SA border
          [px(138), py(26)],     // NT border (26°S)
          [px(138), py(16)],     // close
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "NSW", name: "New South Wales" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          // Clockwise from NW
          [px(141), py(29)],     // QLD border inland
          [px(153.5), py(28.2)], // QLD border coast
          [px(153.6), py(29)],   // coast Tweed
          [px(153.2), py(30.5)], // Coffs Harbour
          [px(152.9), py(31.5)], // Port Macquarie
          [px(152), py(33)],     // Newcastle
          [px(151.3), py(34)],   // Sydney
          [px(150.8), py(34.8)], // Wollongong
          [px(150), py(36.5)],   // south coast
          [px(150), py(37.5)],   // VIC border coast (Eden)
          [px(146.5), py(36.2)], // Murray border (approx)
          [px(143.5), py(35.8)], // Murray border
          [px(141), py(34)],     // SA border
          [px(141), py(29)],     // close
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "VIC", name: "Victoria" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          // Clockwise from NW
          [px(141), py(34)],     // SA border
          [px(143.5), py(35.8)], // Murray border
          [px(146.5), py(36.2)], // Murray border
          [px(150), py(37.5)],   // NSW border coast (Eden)
          [px(148.5), py(38.5)], // Gippsland coast
          [px(146), py(38.5)],   // coast east of Melbourne
          [px(145), py(38.3)],   // Port Phillip Bay east
          [px(144.8), py(37.8)], // Melbourne
          [px(144.3), py(38.3)], // Port Phillip Bay west / Geelong
          [px(143), py(38.6)],   // west coast
          [px(141), py(38)],     // SA border coast
          [px(141), py(34)],     // close
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "TAS", name: "Tasmania" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          // Clockwise from NW
          [px(144.5), py(40.7)], // NW coast (Burnie)
          [px(146.3), py(40.8)], // N coast (Devonport)
          [px(148.2), py(41)],   // NE coast
          [px(148.4), py(42)],   // E coast
          [px(147.8), py(43.5)], // SE coast
          [px(146.5), py(43.4)], // S coast
          [px(145.5), py(43)],   // SW coast
          [px(144.6), py(42)],   // W coast
          [px(144.5), py(40.7)], // close
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "ACT", name: "Australian Capital Territory" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [px(148.7), py(35)],
          [px(149.4), py(35)],
          [px(149.4), py(35.6)],
          [px(148.7), py(35.6)],
          [px(148.7), py(35)],
        ]],
      },
    },
  ],
};

// ─── city catchments ─────────────────────────────────────────────────

/**
 * Precomputed "city catchment mesh" within state borders.
 * Polygons are clipped to their parent state outline via SVG clipPath,
 * so they can extend slightly beyond borders without visual issues.
 */
export const AU_CITY_CATCHMENTS_GEOJSON: FeatureCollection<{
  cityId: CityId;
  state: StateId;
  name: string;
}> = {
  type: "FeatureCollection",
  features: [
    // ── WA ──
    {
      type: "Feature",
      properties: { cityId: "PER", state: "WA", name: "Perth" },
      geometry: { type: "Polygon", coordinates: [[
        [px(113), py(22)], [px(129), py(22)], [px(129), py(34)], [px(115), py(34.3)], [px(113), py(27)], [px(113), py(22)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BRO", state: "WA", name: "Broome" },
      geometry: { type: "Polygon", coordinates: [[
        [px(118), py(14)], [px(129), py(14)], [px(129), py(22)], [px(118), py(22)], [px(118), py(14)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "KAR", state: "WA", name: "Karratha" },
      geometry: { type: "Polygon", coordinates: [[
        [px(114), py(18)], [px(120), py(18)], [px(120), py(23)], [px(114), py(23)], [px(114), py(18)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BUN", state: "WA", name: "Bunbury" },
      geometry: { type: "Polygon", coordinates: [[
        [px(113), py(32)], [px(120), py(32)], [px(120), py(36)], [px(115), py(36)], [px(113), py(34)], [px(113), py(32)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "KAL", state: "WA", name: "Kalgoorlie–Boulder" },
      geometry: { type: "Polygon", coordinates: [[
        [px(119), py(28)], [px(129), py(28)], [px(129), py(34)], [px(119), py(34)], [px(119), py(28)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "ALB", state: "WA", name: "Albany" },
      geometry: { type: "Polygon", coordinates: [[
        [px(115), py(34)], [px(120), py(34)], [px(122), py(36)], [px(115), py(36)], [px(115), py(34)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "GER", state: "WA", name: "Geraldton" },
      geometry: { type: "Polygon", coordinates: [[
        [px(113), py(27)], [px(118), py(27)], [px(118), py(30)], [px(114), py(30)], [px(113), py(28)], [px(113), py(27)],
      ]] },
    },

    // ── NT ──
    {
      type: "Feature",
      properties: { cityId: "DRW", state: "NT", name: "Darwin" },
      geometry: { type: "Polygon", coordinates: [[
        [px(129), py(11)], [px(138), py(11)], [px(138), py(20)], [px(129), py(20)], [px(129), py(11)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "ASP", state: "NT", name: "Alice Springs" },
      geometry: { type: "Polygon", coordinates: [[
        [px(129), py(20)], [px(138), py(20)], [px(138), py(26)], [px(129), py(26)], [px(129), py(20)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "KAT", state: "NT", name: "Katherine" },
      geometry: { type: "Polygon", coordinates: [[
        [px(130), py(13)], [px(135), py(13)], [px(135), py(16)], [px(130), py(16)], [px(130), py(13)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "TNC", state: "NT", name: "Tennant Creek" },
      geometry: { type: "Polygon", coordinates: [[
        [px(132), py(18)], [px(137), py(18)], [px(137), py(22)], [px(132), py(22)], [px(132), py(18)],
      ]] },
    },

    // ── SA ──
    {
      type: "Feature",
      properties: { cityId: "ADL", state: "SA", name: "Adelaide" },
      geometry: { type: "Polygon", coordinates: [[
        [px(135), py(32)], [px(141), py(32)], [px(141), py(37)], [px(137), py(37)], [px(135), py(35)], [px(135), py(32)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "MTG", state: "SA", name: "Mount Gambier" },
      geometry: { type: "Polygon", coordinates: [[
        [px(139), py(36)], [px(141), py(36)], [px(141), py(38.5)], [px(139), py(38.5)], [px(139), py(36)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "WHY", state: "SA", name: "Whyalla" },
      geometry: { type: "Polygon", coordinates: [[
        [px(136), py(32)], [px(139), py(32)], [px(139), py(34)], [px(136), py(34)], [px(136), py(32)],
      ]] },
    },

    // ── QLD ──
    {
      type: "Feature",
      properties: { cityId: "CNS", state: "QLD", name: "Cairns" },
      geometry: { type: "Polygon", coordinates: [[
        [px(142), py(10)], [px(147), py(10)], [px(147), py(18)], [px(142), py(18)], [px(142), py(10)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "TSV", state: "QLD", name: "Townsville" },
      geometry: { type: "Polygon", coordinates: [[
        [px(145), py(18)], [px(150), py(18)], [px(150), py(22)], [px(145), py(22)], [px(145), py(18)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "MKY", state: "QLD", name: "Mackay" },
      geometry: { type: "Polygon", coordinates: [[
        [px(147), py(20)], [px(151), py(20)], [px(151), py(23)], [px(147), py(23)], [px(147), py(20)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "ROP", state: "QLD", name: "Rockhampton" },
      geometry: { type: "Polygon", coordinates: [[
        [px(148), py(22)], [px(152), py(22)], [px(152), py(25)], [px(148), py(25)], [px(148), py(22)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BNE", state: "QLD", name: "Brisbane" },
      geometry: { type: "Polygon", coordinates: [[
        [px(150), py(26)], [px(154), py(26)], [px(154), py(29)], [px(150), py(29)], [px(150), py(26)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "GC", state: "QLD", name: "Gold Coast" },
      geometry: { type: "Polygon", coordinates: [[
        [px(152), py(27.5)], [px(154), py(27.5)], [px(154), py(29)], [px(152), py(29)], [px(152), py(27.5)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "SC", state: "QLD", name: "Sunshine Coast" },
      geometry: { type: "Polygon", coordinates: [[
        [px(151), py(25.5)], [px(154), py(25.5)], [px(154), py(27)], [px(151), py(27)], [px(151), py(25.5)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "TWB", state: "QLD", name: "Toowoomba" },
      geometry: { type: "Polygon", coordinates: [[
        [px(148), py(26)], [px(152), py(26)], [px(152), py(29)], [px(148), py(29)], [px(148), py(26)],
      ]] },
    },

    // ── NSW ──
    {
      type: "Feature",
      properties: { cityId: "SYD", state: "NSW", name: "Sydney" },
      geometry: { type: "Polygon", coordinates: [[
        [px(148), py(32.5)], [px(152), py(32.5)], [px(152), py(35)], [px(148), py(35)], [px(148), py(32.5)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "NCL", state: "NSW", name: "Newcastle" },
      geometry: { type: "Polygon", coordinates: [[
        [px(149), py(31)], [px(153), py(31)], [px(153), py(33)], [px(149), py(33)], [px(149), py(31)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "WOL", state: "NSW", name: "Wollongong" },
      geometry: { type: "Polygon", coordinates: [[
        [px(149), py(34)], [px(152), py(34)], [px(152), py(36)], [px(149), py(36)], [px(149), py(34)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "ALW", state: "NSW", name: "Albury–Wodonga" },
      geometry: { type: "Polygon", coordinates: [[
        [px(143), py(34)], [px(148), py(34)], [px(148), py(37)], [px(143), py(37)], [px(143), py(34)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "CBR", state: "ACT", name: "Canberra" },
      geometry: { type: "Polygon", coordinates: [[
        [px(148.7), py(35)], [px(149.4), py(35)], [px(149.4), py(35.6)], [px(148.7), py(35.6)], [px(148.7), py(35)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "COF", state: "NSW", name: "Coffs Harbour" },
      geometry: { type: "Polygon", coordinates: [[
        [px(151), py(29)], [px(154), py(29)], [px(154), py(31.5)], [px(151), py(31.5)], [px(151), py(29)],
      ]] },
    },

    // ── VIC ──
    {
      type: "Feature",
      properties: { cityId: "MEL", state: "VIC", name: "Melbourne" },
      geometry: { type: "Polygon", coordinates: [[
        [px(143), py(36.5)], [px(148), py(36.5)], [px(148), py(39)], [px(143), py(39)], [px(143), py(36.5)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "GEL", state: "VIC", name: "Geelong" },
      geometry: { type: "Polygon", coordinates: [[
        [px(141), py(37.5)], [px(145), py(37.5)], [px(145), py(39)], [px(141), py(39)], [px(141), py(37.5)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BAL", state: "VIC", name: "Ballarat" },
      geometry: { type: "Polygon", coordinates: [[
        [px(141), py(36.5)], [px(145), py(36.5)], [px(145), py(38)], [px(141), py(38)], [px(141), py(36.5)],
      ]] },
    },

    // ── TAS ──
    {
      type: "Feature",
      properties: { cityId: "HBA", state: "TAS", name: "Hobart" },
      geometry: { type: "Polygon", coordinates: [[
        [px(145), py(42)], [px(149), py(42)], [px(149), py(44)], [px(146), py(44)], [px(145), py(43)], [px(145), py(42)],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "LST", state: "TAS", name: "Launceston" },
      geometry: { type: "Polygon", coordinates: [[
        [px(144), py(40.5)], [px(149), py(40.5)], [px(149), py(42)], [px(145), py(42)], [px(144), py(41.5)], [px(144), py(40.5)],
      ]] },
    },
  ],
};

// ─── subregions (coastal / inland / remote) ──────────────────────────

export const AU_STATE_SUBREGIONS_GEOJSON: FeatureCollection<{
  id: string;
  state: StateId;
  label: "coastal" | "inland" | "remote";
}> = {
  type: "FeatureCollection",
  features: [
    // WA
    { type: "Feature", properties: { id: "WA:coastal", state: "WA", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [px(113), py(15)], [px(120), py(15)], [px(120), py(35)], [px(115), py(35)], [px(113), py(28)], [px(113), py(15)],
    ]] } },
    { type: "Feature", properties: { id: "WA:inland", state: "WA", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [px(120), py(15)], [px(129), py(15)], [px(129), py(25)], [px(120), py(25)], [px(120), py(15)],
    ]] } },
    { type: "Feature", properties: { id: "WA:remote", state: "WA", label: "remote" }, geometry: { type: "Polygon", coordinates: [[
      [px(120), py(25)], [px(129), py(25)], [px(129), py(35)], [px(120), py(35)], [px(120), py(25)],
    ]] } },
    // NT
    { type: "Feature", properties: { id: "NT:coastal", state: "NT", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [px(129), py(11)], [px(138), py(11)], [px(138), py(18)], [px(129), py(18)], [px(129), py(11)],
    ]] } },
    { type: "Feature", properties: { id: "NT:inland", state: "NT", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [px(129), py(18)], [px(138), py(18)], [px(138), py(26)], [px(129), py(26)], [px(129), py(18)],
    ]] } },
    // SA
    { type: "Feature", properties: { id: "SA:coastal", state: "SA", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [px(135), py(32)], [px(141), py(32)], [px(141), py(39)], [px(135), py(39)], [px(135), py(32)],
    ]] } },
    { type: "Feature", properties: { id: "SA:inland", state: "SA", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [px(129), py(28)], [px(141), py(28)], [px(141), py(32)], [px(129), py(32)], [px(129), py(28)],
    ]] } },
    { type: "Feature", properties: { id: "SA:remote", state: "SA", label: "remote" }, geometry: { type: "Polygon", coordinates: [[
      [px(129), py(26)], [px(141), py(26)], [px(141), py(28)], [px(129), py(28)], [px(129), py(26)],
    ]] } },
    // QLD
    { type: "Feature", properties: { id: "QLD:coastal", state: "QLD", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [px(145), py(10)], [px(154), py(10)], [px(154), py(29)], [px(145), py(29)], [px(145), py(10)],
    ]] } },
    { type: "Feature", properties: { id: "QLD:inland", state: "QLD", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [px(141), py(16)], [px(145), py(16)], [px(145), py(29)], [px(141), py(29)], [px(141), py(16)],
    ]] } },
    { type: "Feature", properties: { id: "QLD:remote", state: "QLD", label: "remote" }, geometry: { type: "Polygon", coordinates: [[
      [px(138), py(16)], [px(141), py(16)], [px(141), py(26)], [px(138), py(26)], [px(138), py(16)],
    ]] } },
    // NSW
    { type: "Feature", properties: { id: "NSW:coastal", state: "NSW", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [px(149), py(29)], [px(154), py(29)], [px(154), py(38)], [px(149), py(38)], [px(149), py(29)],
    ]] } },
    { type: "Feature", properties: { id: "NSW:inland", state: "NSW", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [px(145), py(29)], [px(149), py(29)], [px(149), py(36)], [px(145), py(36)], [px(145), py(29)],
    ]] } },
    { type: "Feature", properties: { id: "NSW:remote", state: "NSW", label: "remote" }, geometry: { type: "Polygon", coordinates: [[
      [px(141), py(29)], [px(145), py(29)], [px(145), py(36)], [px(141), py(36)], [px(141), py(29)],
    ]] } },
    // VIC
    { type: "Feature", properties: { id: "VIC:coastal", state: "VIC", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [px(143), py(37.5)], [px(150), py(37.5)], [px(150), py(39)], [px(141), py(39)], [px(141), py(38)], [px(143), py(37.5)],
    ]] } },
    { type: "Feature", properties: { id: "VIC:inland", state: "VIC", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [px(141), py(34)], [px(146), py(34)], [px(146), py(37.5)], [px(141), py(37.5)], [px(141), py(34)],
    ]] } },
    { type: "Feature", properties: { id: "VIC:remote", state: "VIC", label: "remote" }, geometry: { type: "Polygon", coordinates: [[
      [px(146), py(34)], [px(150), py(34)], [px(150), py(38)], [px(146), py(38)], [px(146), py(34)],
    ]] } },
    // TAS
    { type: "Feature", properties: { id: "TAS:north", state: "TAS", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [px(144), py(40.5)], [px(149), py(40.5)], [px(149), py(42)], [px(144), py(42)], [px(144), py(40.5)],
    ]] } },
    { type: "Feature", properties: { id: "TAS:south", state: "TAS", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [px(144), py(42)], [px(149), py(42)], [px(149), py(44)], [px(144), py(44)], [px(144), py(42)],
    ]] } },
  ],
};

// ─── weights & biases (unchanged — these don't depend on coordinates) ─

export const SUBREGION_WEIGHTS: Record<string, Array<[CityId, number]>> = {
  "WA:coastal": [["PER", 0.75], ["BUN", 0.25]],
  "WA:inland": [["BUN", 0.50], ["PER", 0.50]],
  "WA:remote": [["PER", 1.0]],

  "NT:coastal": [["DRW", 1.0]],
  "NT:inland": [["DRW", 1.0]],

  "SA:coastal": [["ADL", 1.0]],
  "SA:inland": [["ADL", 1.0]],
  "SA:remote": [["ADL", 1.0]],

  "QLD:coastal": [["BNE", 0.45], ["GC", 0.15], ["SC", 0.15], ["CNS", 0.10], ["TSV", 0.10], ["MKY", 0.05]],
  "QLD:inland": [["TWB", 0.35], ["ROP", 0.25], ["MKY", 0.20], ["TSV", 0.20]],
  "QLD:remote": [["TSV", 1.0]],

  "NSW:coastal": [["SYD", 0.65], ["NCL", 0.20], ["WOL", 0.15]],
  "NSW:inland": [["ALW", 0.55], ["SYD", 0.45]],
  "NSW:remote": [["ALW", 0.70], ["SYD", 0.30]],

  "VIC:coastal": [["GEL", 0.70], ["MEL", 0.30]],
  "VIC:inland": [["BAL", 0.50], ["BEN", 0.50]],
  "VIC:remote": [["MEL", 0.70], ["BAL", 0.15], ["BEN", 0.15]],

  "TAS:north": [["LST", 1.0]],
  "TAS:south": [["HBA", 1.0]],
};

export const SUBREGION_ANCHOR_BIAS: Record<string, number> = {
  "WA:coastal": +0.06,
  "WA:inland": -0.02,
  "WA:remote": -0.04,
  "NT:coastal": +0.03,
  "NT:inland": -0.03,
  "SA:coastal": +0.05,
  "SA:inland": -0.01,
  "SA:remote": -0.04,
  "QLD:coastal": +0.05,
  "QLD:inland": -0.01,
  "QLD:remote": -0.03,
  "NSW:coastal": +0.05,
  "NSW:inland": -0.02,
  "NSW:remote": -0.03,
  "VIC:coastal": +0.04,
  "VIC:inland": -0.02,
  "VIC:remote": -0.02,
  "TAS:north": -0.02,
  "TAS:south": +0.03,
};

// ─── path renderer ───────────────────────────────────────────────────

export function polygonToPath(poly: GeoPolygon): string {
  const ring = poly.coordinates[0];
  if (!ring || ring.length === 0) return "";
  const [x0, y0] = ring[0];
  let d = `M${x0},${y0}`;
  for (let i = 1; i < ring.length; i++) {
    const [x, y] = ring[i];
    d += ` L${x},${y}`;
  }
  return d + " Z";
}
