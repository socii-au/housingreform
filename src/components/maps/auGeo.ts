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
 * This is NOT administrative-accurate; it’s a lightweight, readable vector schematic.
 */

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
          [80, 120], [420, 120], [420, 560], [240, 660], [120, 610], [80, 520], [80, 120],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "NT", name: "Northern Territory" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [420, 120], [610, 120], [610, 330], [420, 330], [420, 120],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "SA", name: "South Australia" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [420, 330], [610, 330], [610, 560], [420, 560], [420, 330],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "QLD", name: "Queensland" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [610, 120], [880, 120], [920, 200], [920, 420], [610, 420], [610, 120],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "NSW", name: "New South Wales" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [610, 420], [920, 420], [920, 560], [850, 610], [610, 610], [610, 420],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "VIC", name: "Victoria" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [610, 610], [850, 610], [820, 680], [610, 680], [610, 610],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "TAS", name: "Tasmania" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [780, 700], [840, 700], [860, 740], [800, 750], [780, 720], [780, 700],
        ]],
      },
    },
    {
      type: "Feature",
      properties: { id: "ACT", name: "Australian Capital Territory" },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [800, 545], [820, 545], [820, 565], [800, 565], [800, 545],
        ]],
      },
    },
  ],
};

/**
 * Precomputed “city catchment mesh” within state borders.
 * Each polygon is a coarse partition intended to represent a regional centre’s influence area.
 *
 * Rules:
 * - polygons should stay inside their parent state polygon
 * - polygons can be approximate and need not perfectly tile the state (small gaps are OK)
 */
export const AU_CITY_CATCHMENTS_GEOJSON: FeatureCollection<{
  cityId: CityId;
  state: StateId;
  name: string;
}> = {
  type: "FeatureCollection",
  features: [
    // WA: PER + BUN
    {
      type: "Feature",
      properties: { cityId: "PER", state: "WA", name: "Perth" },
      geometry: { type: "Polygon", coordinates: [[
        [120, 160], [420, 160], [420, 420], [240, 520], [120, 460], [120, 160],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BUN", state: "WA", name: "Bunbury" },
      geometry: { type: "Polygon", coordinates: [[
        [120, 460], [240, 520], [240, 660], [120, 610], [80, 520], [120, 460],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "KAL", state: "WA", name: "Kalgoorlie–Boulder" },
      geometry: { type: "Polygon", coordinates: [[
        [240, 420], [420, 360], [420, 520], [300, 600], [240, 560], [240, 420],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "GER", state: "WA", name: "Geraldton" },
      geometry: { type: "Polygon", coordinates: [[
        [170, 230], [260, 230], [260, 300], [180, 300], [170, 260], [170, 230],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BRO", state: "WA", name: "Broome" },
      geometry: { type: "Polygon", coordinates: [[
        [190, 140], [300, 140], [300, 200], [210, 210], [190, 180], [190, 140],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "KAR", state: "WA", name: "Karratha" },
      geometry: { type: "Polygon", coordinates: [[
        [250, 190], [330, 190], [330, 250], [260, 260], [240, 220], [250, 190],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "PHD", state: "WA", name: "Port Hedland" },
      geometry: { type: "Polygon", coordinates: [[
        [290, 170], [350, 170], [360, 210], [300, 220], [280, 200], [290, 170],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "NWM", state: "WA", name: "Newman" },
      geometry: { type: "Polygon", coordinates: [[
        [300, 230], [360, 230], [360, 270], [320, 285], [290, 260], [300, 230],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "TMP", state: "WA", name: "Tom Price" },
      geometry: { type: "Polygon", coordinates: [[
        [280, 240], [320, 240], [330, 270], [300, 285], [270, 265], [280, 240],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "ALB", state: "WA", name: "Albany" },
      geometry: { type: "Polygon", coordinates: [[
        [150, 540], [240, 540], [240, 610], [170, 620], [140, 580], [150, 540],
      ]] },
    },

    // NT: DRW
    {
      type: "Feature",
      properties: { cityId: "DRW", state: "NT", name: "Darwin" },
      geometry: { type: "Polygon", coordinates: [[
        [430, 130], [600, 130], [600, 320], [430, 320], [430, 130],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "ASP", state: "NT", name: "Alice Springs" },
      geometry: { type: "Polygon", coordinates: [[
        [430, 220], [600, 220], [600, 330], [430, 330], [430, 220],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "KAT", state: "NT", name: "Katherine" },
      geometry: { type: "Polygon", coordinates: [[
        [470, 200], [560, 200], [560, 250], [480, 260], [450, 230], [470, 200],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "TNC", state: "NT", name: "Tennant Creek" },
      geometry: { type: "Polygon", coordinates: [[
        [470, 250], [560, 250], [560, 290], [470, 290], [470, 250],
      ]] },
    },

    // SA: ADL
    {
      type: "Feature",
      properties: { cityId: "ADL", state: "SA", name: "Adelaide" },
      geometry: { type: "Polygon", coordinates: [[
        [430, 340], [600, 340], [600, 550], [430, 550], [430, 340],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "WHY", state: "SA", name: "Whyalla" },
      geometry: { type: "Polygon", coordinates: [[
        [450, 440], [520, 440], [520, 500], [460, 510], [440, 470], [450, 440],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "MTG", state: "SA", name: "Mount Gambier" },
      geometry: { type: "Polygon", coordinates: [[
        [560, 520], [600, 520], [600, 560], [540, 560], [560, 520],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "PLN", state: "SA", name: "Port Lincoln" },
      geometry: { type: "Polygon", coordinates: [[
        [520, 500], [580, 500], [590, 530], [540, 540], [510, 520], [520, 500],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "PPR", state: "SA", name: "Port Pirie" },
      geometry: { type: "Polygon", coordinates: [[
        [500, 450], [540, 450], [550, 480], [510, 490], [490, 470], [500, 450],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "PAG", state: "SA", name: "Port Augusta" },
      geometry: { type: "Polygon", coordinates: [[
        [470, 410], [520, 410], [530, 440], [490, 450], [460, 430], [470, 410],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "MBR", state: "SA", name: "Murray Bridge" },
      geometry: { type: "Polygon", coordinates: [[
        [540, 500], [590, 500], [600, 530], [560, 540], [530, 520], [540, 500],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "VHB", state: "SA", name: "Victor Harbor" },
      geometry: { type: "Polygon", coordinates: [[
        [520, 530], [560, 530], [570, 550], [540, 560], [510, 540], [520, 530],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "NRC", state: "SA", name: "Naracoorte" },
      geometry: { type: "Polygon", coordinates: [[
        [560, 540], [610, 540], [620, 570], [580, 590], [550, 570], [560, 540],
      ]] },
    },

    // QLD: split across major centres
    {
      type: "Feature",
      properties: { cityId: "CNS", state: "QLD", name: "Cairns" },
      geometry: { type: "Polygon", coordinates: [[
        [780, 130], [900, 130], [910, 200], [820, 230], [760, 200], [780, 130],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "TSV", state: "QLD", name: "Townsville" },
      geometry: { type: "Polygon", coordinates: [[
        [720, 200], [820, 230], [820, 310], [740, 320], [700, 280], [720, 200],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "MKY", state: "QLD", name: "Mackay" },
      geometry: { type: "Polygon", coordinates: [[
        [660, 200], [720, 200], [700, 280], [650, 290], [630, 250], [660, 200],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "ROP", state: "QLD", name: "Rockhampton" },
      geometry: { type: "Polygon", coordinates: [[
        [630, 250], [650, 290], [690, 340], [640, 360], [610, 340], [630, 250],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "GLA", state: "QLD", name: "Gladstone" },
      geometry: { type: "Polygon", coordinates: [[
        [690, 340], [740, 340], [740, 380], [690, 390], [660, 370], [690, 340],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BNE", state: "QLD", name: "Brisbane" },
      geometry: { type: "Polygon", coordinates: [[
        [610, 340], [640, 360], [710, 420], [610, 420], [610, 340],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "IPS", state: "QLD", name: "Ipswich" },
      geometry: { type: "Polygon", coordinates: [[
        [610, 360], [660, 360], [670, 390], [630, 410], [600, 390], [610, 360],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "GC", state: "QLD", name: "Gold Coast" },
      geometry: { type: "Polygon", coordinates: [[
        [710, 420], [820, 420], [820, 460], [740, 460], [710, 420],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "SC", state: "QLD", name: "Sunshine Coast" },
      geometry: { type: "Polygon", coordinates: [[
        [640, 360], [690, 340], [760, 360], [740, 420], [710, 420], [640, 360],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "HVB", state: "QLD", name: "Hervey Bay" },
      geometry: { type: "Polygon", coordinates: [[
        [740, 340], [780, 340], [800, 370], [770, 395], [740, 380], [740, 340],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "MBH", state: "QLD", name: "Maryborough" },
      geometry: { type: "Polygon", coordinates: [[
        [720, 330], [760, 330], [770, 355], [740, 380], [710, 360], [720, 330],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BDG", state: "QLD", name: "Bundaberg" },
      geometry: { type: "Polygon", coordinates: [[
        [720, 350], [740, 340], [740, 380], [710, 400], [700, 370], [720, 350],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "GYP", state: "QLD", name: "Gympie" },
      geometry: { type: "Polygon", coordinates: [[
        [690, 330], [720, 330], [740, 360], [710, 380], [680, 360], [690, 330],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "TWB", state: "QLD", name: "Toowoomba" },
      geometry: { type: "Polygon", coordinates: [[
        [610, 300], [660, 300], [690, 340], [640, 360], [610, 340], [610, 300],
      ]] },
    },

    // NSW: SYD + NCL + WOL + ALW + CBR
    {
      type: "Feature",
      properties: { cityId: "SYD", state: "NSW", name: "Sydney" },
      geometry: { type: "Polygon", coordinates: [[
        [760, 460], [920, 460], [920, 560], [850, 610], [760, 610], [760, 460],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "NCL", state: "NSW", name: "Newcastle" },
      geometry: { type: "Polygon", coordinates: [[
        [760, 420], [920, 420], [920, 460], [760, 460], [760, 420],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "CCS", state: "NSW", name: "Central Coast" },
      geometry: { type: "Polygon", coordinates: [[
        [820, 460], [920, 460], [920, 500], [820, 500], [820, 460],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "PST", state: "NSW", name: "Port Stephens" },
      geometry: { type: "Polygon", coordinates: [[
        [880, 470], [920, 470], [920, 500], [880, 500], [880, 470],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "PMQ", state: "NSW", name: "Port Macquarie" },
      geometry: { type: "Polygon", coordinates: [[
        [860, 420], [920, 420], [920, 450], [860, 450], [860, 420],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "TAR", state: "NSW", name: "Taree" },
      geometry: { type: "Polygon", coordinates: [[
        [840, 440], [890, 440], [900, 470], [860, 480], [830, 460], [840, 440],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "FOS", state: "NSW", name: "Forster–Tuncurry" },
      geometry: { type: "Polygon", coordinates: [[
        [860, 430], [900, 430], [910, 450], [880, 465], [850, 450], [860, 430],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "KPS", state: "NSW", name: "Kempsey" },
      geometry: { type: "Polygon", coordinates: [[
        [870, 445], [900, 445], [900, 470], [870, 470], [870, 445],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "NMB", state: "NSW", name: "Nambucca" },
      geometry: { type: "Polygon", coordinates: [[
        [895, 445], [920, 445], [920, 470], [895, 470], [895, 445],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "COF", state: "NSW", name: "Coffs Harbour" },
      geometry: { type: "Polygon", coordinates: [[
        [870, 450], [920, 450], [920, 480], [870, 480], [870, 450],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "LSM", state: "NSW", name: "Lismore" },
      geometry: { type: "Polygon", coordinates: [[
        [900, 440], [920, 440], [920, 470], [900, 470], [900, 440],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BLN", state: "NSW", name: "Ballina" },
      geometry: { type: "Polygon", coordinates: [[
        [910, 440], [930, 440], [930, 460], [910, 460], [910, 440],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BYR", state: "NSW", name: "Byron Bay" },
      geometry: { type: "Polygon", coordinates: [[
        [920, 445], [940, 445], [940, 465], [920, 465], [920, 445],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "TWD", state: "NSW", name: "Tweed Heads" },
      geometry: { type: "Polygon", coordinates: [[
        [920, 455], [940, 455], [940, 475], [920, 475], [920, 455],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "TMW", state: "NSW", name: "Tamworth" },
      geometry: { type: "Polygon", coordinates: [[
        [790, 450], [850, 450], [850, 490], [790, 490], [790, 450],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "DBO", state: "NSW", name: "Dubbo" },
      geometry: { type: "Polygon", coordinates: [[
        [740, 470], [800, 470], [800, 510], [740, 510], [740, 470],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "ORG", state: "NSW", name: "Orange" },
      geometry: { type: "Polygon", coordinates: [[
        [770, 510], [820, 510], [820, 540], [770, 540], [770, 510],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BTH", state: "NSW", name: "Bathurst" },
      geometry: { type: "Polygon", coordinates: [[
        [800, 530], [840, 530], [840, 560], [800, 560], [800, 530],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "GOU", state: "NSW", name: "Goulburn" },
      geometry: { type: "Polygon", coordinates: [[
        [770, 560], [820, 560], [820, 600], [770, 600], [770, 560],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "NRA", state: "NSW", name: "Nowra–Shoalhaven" },
      geometry: { type: "Polygon", coordinates: [[
        [800, 540], [850, 540], [850, 580], [800, 580], [800, 540],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "WOL", state: "NSW", name: "Wollongong" },
      geometry: { type: "Polygon", coordinates: [[
        [720, 560], [760, 560], [760, 610], [720, 610], [700, 590], [720, 560],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "ALW", state: "NSW", name: "Albury–Wodonga" },
      geometry: { type: "Polygon", coordinates: [[
        [610, 520], [720, 520], [720, 610], [610, 610], [610, 520],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "WGA", state: "NSW", name: "Wagga Wagga" },
      geometry: { type: "Polygon", coordinates: [[
        [650, 560], [720, 560], [720, 610], [650, 610], [650, 560],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "GRF", state: "NSW", name: "Griffith" },
      geometry: { type: "Polygon", coordinates: [[
        [700, 540], [760, 540], [770, 570], [730, 580], [700, 560], [700, 540],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "LET", state: "NSW", name: "Leeton" },
      geometry: { type: "Polygon", coordinates: [[
        [730, 530], [780, 530], [790, 560], [760, 575], [720, 555], [730, 530],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "CBR", state: "ACT", name: "Canberra" },
      geometry: { type: "Polygon", coordinates: [[
        [800, 545], [820, 545], [820, 565], [800, 565], [800, 545],
      ]] },
    },

    // VIC: MEL + regional centres
    {
      type: "Feature",
      properties: { cityId: "MEL", state: "VIC", name: "Melbourne" },
      geometry: { type: "Polygon", coordinates: [[
        [700, 610], [850, 610], [820, 680], [720, 680], [700, 650], [700, 610],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "GEL", state: "VIC", name: "Geelong" },
      geometry: { type: "Polygon", coordinates: [[
        [660, 640], [700, 650], [720, 680], [610, 680], [610, 650], [660, 640],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BAL", state: "VIC", name: "Ballarat" },
      geometry: { type: "Polygon", coordinates: [[
        [610, 610], [700, 610], [700, 650], [660, 640], [610, 630], [610, 610],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BEN", state: "VIC", name: "Bendigo" },
      geometry: { type: "Polygon", coordinates: [[
        [610, 630], [660, 640], [610, 650], [610, 630],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "MLD", state: "VIC", name: "Mildura" },
      geometry: { type: "Polygon", coordinates: [[
        [610, 600], [660, 600], [660, 620], [610, 620], [610, 600],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "SHP", state: "VIC", name: "Shepparton" },
      geometry: { type: "Polygon", coordinates: [[
        [700, 610], [740, 610], [740, 640], [700, 650], [700, 610],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "WGR", state: "VIC", name: "Wangaratta" },
      geometry: { type: "Polygon", coordinates: [[
        [740, 610], [780, 610], [780, 640], [740, 640], [740, 610],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "HOR", state: "VIC", name: "Horsham" },
      geometry: { type: "Polygon", coordinates: [[
        [610, 630], [640, 630], [640, 660], [610, 660], [610, 630],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "WAR", state: "VIC", name: "Warrnambool" },
      geometry: { type: "Polygon", coordinates: [[
        [650, 670], [700, 670], [700, 690], [650, 690], [650, 670],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "TRG", state: "VIC", name: "Traralgon" },
      geometry: { type: "Polygon", coordinates: [[
        [760, 640], [800, 640], [800, 670], [760, 670], [760, 640],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "SAL", state: "VIC", name: "Sale" },
      geometry: { type: "Polygon", coordinates: [[
        [800, 650], [830, 650], [830, 670], [800, 670], [800, 650],
      ]] },
    },

    // TAS: HBA + LST
    {
      type: "Feature",
      properties: { cityId: "HBA", state: "TAS", name: "Hobart" },
      geometry: { type: "Polygon", coordinates: [[
        [795, 720], [860, 740], [800, 750], [795, 720],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "LST", state: "TAS", name: "Launceston" },
      geometry: { type: "Polygon", coordinates: [[
        [780, 700], [840, 700], [860, 740], [795, 720], [780, 700],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "DVP", state: "TAS", name: "Devonport" },
      geometry: { type: "Polygon", coordinates: [[
        [770, 690], [800, 690], [800, 710], [770, 710], [770, 690],
      ]] },
    },
    {
      type: "Feature",
      properties: { cityId: "BUR", state: "TAS", name: "Burnie" },
      geometry: { type: "Polygon", coordinates: [[
        [750, 690], [770, 690], [770, 710], [750, 710], [750, 690],
      ]] },
    },
  ],
};

export const AU_STATE_SUBREGIONS_GEOJSON: FeatureCollection<{
  id: string;
  state: StateId;
  label: "coastal" | "inland" | "remote";
}> = {
  type: "FeatureCollection",
  features: [
    // WA
    { type: "Feature", properties: { id: "WA:coastal", state: "WA", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [90, 140], [420, 140], [420, 360], [240, 430], [110, 380], [90, 300], [90, 140],
    ]] } },
    { type: "Feature", properties: { id: "WA:inland", state: "WA", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [110, 380], [240, 430], [240, 640], [120, 610], [90, 520], [110, 380],
    ]] } },
    { type: "Feature", properties: { id: "WA:remote", state: "WA", label: "remote" }, geometry: { type: "Polygon", coordinates: [[
      [240, 430], [420, 360], [420, 560], [240, 660], [240, 430],
    ]] } },

    // NT
    { type: "Feature", properties: { id: "NT:coastal", state: "NT", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [430, 130], [600, 130], [600, 220], [430, 220], [430, 130],
    ]] } },
    { type: "Feature", properties: { id: "NT:inland", state: "NT", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [430, 220], [600, 220], [600, 320], [430, 320], [430, 220],
    ]] } },

    // SA
    { type: "Feature", properties: { id: "SA:coastal", state: "SA", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [430, 340], [600, 340], [600, 430], [430, 430], [430, 340],
    ]] } },
    { type: "Feature", properties: { id: "SA:inland", state: "SA", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [430, 430], [600, 430], [600, 520], [430, 520], [430, 430],
    ]] } },
    { type: "Feature", properties: { id: "SA:remote", state: "SA", label: "remote" }, geometry: { type: "Polygon", coordinates: [[
      [430, 520], [600, 520], [600, 550], [430, 550], [430, 520],
    ]] } },

    // QLD
    { type: "Feature", properties: { id: "QLD:coastal", state: "QLD", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [650, 140], [900, 140], [915, 210], [915, 420], [760, 420], [720, 260], [650, 140],
    ]] } },
    { type: "Feature", properties: { id: "QLD:inland", state: "QLD", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [610, 140], [650, 140], [720, 260], [760, 420], [610, 420], [610, 140],
    ]] } },
    { type: "Feature", properties: { id: "QLD:remote", state: "QLD", label: "remote" }, geometry: { type: "Polygon", coordinates: [[
      [610, 140], [650, 140], [610, 140],
    ]] } }, // tiny placeholder; QLD already well-covered by cities

    // NSW
    { type: "Feature", properties: { id: "NSW:coastal", state: "NSW", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [760, 420], [920, 420], [920, 560], [850, 610], [780, 610], [760, 560], [760, 420],
    ]] } },
    { type: "Feature", properties: { id: "NSW:inland", state: "NSW", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [610, 420], [760, 420], [760, 560], [610, 560], [610, 420],
    ]] } },
    { type: "Feature", properties: { id: "NSW:remote", state: "NSW", label: "remote" }, geometry: { type: "Polygon", coordinates: [[
      [610, 560], [760, 560], [780, 610], [610, 610], [610, 560],
    ]] } },

    // VIC
    { type: "Feature", properties: { id: "VIC:coastal", state: "VIC", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [610, 650], [720, 680], [820, 680], [610, 680], [610, 650],
    ]] } },
    { type: "Feature", properties: { id: "VIC:inland", state: "VIC", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [610, 610], [700, 610], [700, 650], [610, 650], [610, 610],
    ]] } },
    { type: "Feature", properties: { id: "VIC:remote", state: "VIC", label: "remote" }, geometry: { type: "Polygon", coordinates: [[
      [700, 610], [850, 610], [820, 680], [720, 680], [700, 650], [700, 610],
    ]] } },

    // TAS
    { type: "Feature", properties: { id: "TAS:north", state: "TAS", label: "inland" }, geometry: { type: "Polygon", coordinates: [[
      [780, 700], [840, 700], [860, 740], [795, 720], [780, 700],
    ]] } },
    { type: "Feature", properties: { id: "TAS:south", state: "TAS", label: "coastal" }, geometry: { type: "Polygon", coordinates: [[
      [795, 720], [860, 740], [800, 750], [795, 720],
    ]] } },
  ],
};

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

/**
 * Synthetic anchor biases (score-space) used to create meaningful within-state structure
 * even when a state has only one (or zero) included cities.
 *
 * Interpretation:
 * - coastal tends to be slightly higher stress (more demand pressure)
 * - inland tends to be slightly lower (more slack)
 * - remote is mixed; here we bias slightly lower for most states (can be tuned per state)
 *
 * These are intentionally small so they don’t overwhelm the actual state score.
 */
export const SUBREGION_ANCHOR_BIAS: Record<string, number> = {
  // WA
  "WA:coastal": +0.06,
  "WA:inland": -0.02,
  "WA:remote": -0.04,
  // NT
  "NT:coastal": +0.03,
  "NT:inland": -0.03,
  // SA
  "SA:coastal": +0.05,
  "SA:inland": -0.01,
  "SA:remote": -0.04,
  // QLD
  "QLD:coastal": +0.05,
  "QLD:inland": -0.01,
  "QLD:remote": -0.03,
  // NSW
  "NSW:coastal": +0.05,
  "NSW:inland": -0.02,
  "NSW:remote": -0.03,
  // VIC
  "VIC:coastal": +0.04,
  "VIC:inland": -0.02,
  "VIC:remote": -0.02,
  // TAS (north/south)
  "TAS:north": -0.02,
  "TAS:south": +0.03,
};

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

