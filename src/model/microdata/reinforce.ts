import type { CityId } from "../regions";
import type { MicroRecord, TenureType } from "../advanced/microdata";

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function weightOf(r: MicroRecord): number {
  return r.weight ?? 1;
}

export function mixRealAndSynthetic(opts: {
  realByCity: Partial<Record<CityId, MicroRecord[]>>;
  syntheticByCity: Partial<Record<CityId, MicroRecord[]>>;
  /**
   * 0..1 share of total weight assigned to real data (rest synthetic).
   */
  realWeightShare?: number;
}): { byCity: Partial<Record<CityId, MicroRecord[]>> } {
  const alpha = clamp(opts.realWeightShare ?? 0.7, 0, 1);
  const byCity: Partial<Record<CityId, MicroRecord[]>> = {};
  const cities = new Set<CityId>([
    ...(Object.keys(opts.realByCity) as CityId[]),
    ...(Object.keys(opts.syntheticByCity) as CityId[]),
  ]);

  cities.forEach((city) => {
    const real = opts.realByCity[city] ?? [];
    const syn = opts.syntheticByCity[city] ?? [];

    const realW = real.reduce((a, r) => a + weightOf(r), 0);
    const synW = syn.reduce((a, r) => a + weightOf(r), 0);
    const targetReal = alpha;
    const targetSyn = 1 - alpha;

    const scaleReal = realW > 0 ? targetReal / realW : 0;
    const scaleSyn = synW > 0 ? targetSyn / synW : 0;

    const mixed: MicroRecord[] = [
      ...real.map((r) => ({ ...r, weight: weightOf(r) * scaleReal })),
      ...syn.map((r) => ({ ...r, weight: weightOf(r) * scaleSyn })),
    ];
    byCity[city] = mixed;
  });

  return { byCity };
}

/**
 * Reweight tenure shares to match targets (within each city).
 * This does NOT change incomes, only weights. Intended to reconcile survey sample
 * with known tenure composition (e.g., from ABS).
 */
export function reweightTenureShares(opts: {
  byCity: Partial<Record<CityId, MicroRecord[]>>;
  targets: Partial<Record<CityId, Partial<Record<TenureType, number>>>>;
}): { byCity: Partial<Record<CityId, MicroRecord[]>> } {
  const byCity: Partial<Record<CityId, MicroRecord[]>> = {};

  (Object.keys(opts.byCity) as CityId[]).forEach((city) => {
    const rows = opts.byCity[city];
    if (!rows || rows.length === 0) return;
    const tgt = opts.targets[city];
    if (!tgt) {
      byCity[city] = rows;
      return;
    }

    const tenures: TenureType[] = ["renter", "mortgaged", "outright", "investor"];
    const curW: Record<TenureType, number> = {
      renter: 0,
      mortgaged: 0,
      outright: 0,
      investor: 0,
    };
    rows.forEach((r) => {
      curW[r.tenure] += weightOf(r);
    });
    const total = Math.max(1e-9, tenures.reduce((a, t) => a + curW[t], 0));

    const curShare: Record<TenureType, number> = {
      renter: curW.renter / total,
      mortgaged: curW.mortgaged / total,
      outright: curW.outright / total,
      investor: curW.investor / total,
    };

    const tgtVals = tenures.map((t) => Math.max(0, tgt[t] ?? curShare[t]));
    const tgtSum = Math.max(1e-9, tgtVals.reduce((a, b) => a + b, 0));
    const tgtShare: Record<TenureType, number> = {
      renter: tgtVals[0] / tgtSum,
      mortgaged: tgtVals[1] / tgtSum,
      outright: tgtVals[2] / tgtSum,
      investor: tgtVals[3] / tgtSum,
    };

    const scales: Record<TenureType, number> = {
      renter: curShare.renter > 0 ? tgtShare.renter / curShare.renter : 1,
      mortgaged: curShare.mortgaged > 0 ? tgtShare.mortgaged / curShare.mortgaged : 1,
      outright: curShare.outright > 0 ? tgtShare.outright / curShare.outright : 1,
      investor: curShare.investor > 0 ? tgtShare.investor / curShare.investor : 1,
    };

    byCity[city] = rows.map((r) => ({ ...r, weight: weightOf(r) * scales[r.tenure] }));
  });

  return { byCity };
}

