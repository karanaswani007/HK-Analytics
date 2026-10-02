/** Deterministic stats helpers — no causation claims, p-values are approximations. */

function finite(xs: number[]): number[] {
  return xs.filter((x) => Number.isFinite(x));
}

export function mean(xs: number[]): number | null {
  const v = finite(xs);
  if (!v.length) return null;
  let s = 0;
  for (const x of v) s += x;
  return s / v.length;
}

export function median(xs: number[]): number | null {
  const v = finite(xs).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

export function quantile(xs: number[], q: number): number | null {
  const v = finite(xs).sort((a, b) => a - b);
  if (!v.length) return null;
  if (v.length === 1) return v[0]!;
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return v[lo]!;
  return v[lo]! * (hi - pos) + v[hi]! * (pos - lo);
}

export function stdev(xs: number[], sample = true): number | null {
  const v = finite(xs);
  if (v.length < 2) return null;
  const m = mean(v);
  if (m === null) return null;
  let s = 0;
  for (const x of v) s += (x - m) ** 2;
  const d = sample ? v.length - 1 : v.length;
  return Math.sqrt(s / d);
}

export function skewness(xs: number[]): number | null {
  const v = finite(xs);
  if (v.length < 8) return null;
  const m = mean(v);
  const sd = stdev(v);
  if (m === null || sd === null || sd === 0) return null;
  let s = 0;
  for (const x of v) s += ((x - m) / sd) ** 3;
  return (v.length / ((v.length - 1) * (v.length - 2))) * s;
}

export function minMax(xs: number[]): { min: number; max: number } | null {
  const v = finite(xs);
  if (!v.length) return null;
  let min = v[0]!;
  let max = v[0]!;
  for (const x of v) {
    if (x < min) min = x;
    if (x > max) max = x;
  }
  return { min, max };
}

export function modeString(values: string[]): string | null {
  if (!values.length) return null;
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | null = null;
  let n = -1;
  for (const [k, c] of counts) {
    if (c > n) {
      best = k;
      n = c;
    }
  }
  return best;
}

export function topK(values: string[], k = 8): { value: string; count: number; pct: number }[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const total = values.length || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([value, count]) => ({ value, count, pct: (count / total) * 100 }));
}

export function pearson(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  if (n < 8) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = x[i]!;
    const b = y[i]!;
    if (Number.isFinite(a) && Number.isFinite(b)) {
      xs.push(a);
      ys.push(b);
    }
  }
  if (xs.length < 8) return null;
  const mx = mean(xs)!;
  const my = mean(ys)!;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

function rank(xs: number[]): number[] {
  const idx = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1]!.v === idx[i]!.v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[idx[k]!.i] = avg;
    i = j + 1;
  }
  return ranks;
}

export function spearman(x: number[], y: number[]): number | null {
  const n = Math.min(x.length, y.length);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = x[i]!;
    const b = y[i]!;
    if (Number.isFinite(a) && Number.isFinite(b)) {
      xs.push(a);
      ys.push(b);
    }
  }
  if (xs.length < 8) return null;
  return pearson(rank(xs), rank(ys));
}

/** Abramowitz & Stegun erf approximation */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function chiSquarePValue(chi2: number, k: number): number {
  if (k <= 0 || chi2 < 0) return 1;
  // Wilson–Hilferty approximation
  const z = (Math.pow(chi2 / k, 1 / 3) - (1 - 2 / (9 * k))) / Math.sqrt(2 / (9 * k));
  return 1 - normalCdf(z);
}

export function tCdfAbs(t: number, df: number): number {
  const abs = Math.abs(t);
  if (df > 60) return 2 * (1 - normalCdf(abs));
  // Hill's approximation for two-tailed p
  const z = Math.sqrt(df) * Math.log1p(abs * abs / df);
  const p = 2 * (1 - normalCdf(abs * Math.sqrt(1 - 1 / (4 * df))));
  return Math.min(1, Math.max(0, Number.isFinite(p) ? p : 2 * (1 - normalCdf(z))));
}

export function chiSquareFromTable(table: number[][]): {
  chi2: number;
  p: number;
  dof: number;
  n: number;
  ok: boolean;
} | null {
  const r = table.length;
  const c = table[0]?.length ?? 0;
  if (r < 2 || c < 2) return null;
  const rowSum = table.map((row) => row.reduce((a, b) => a + b, 0));
  const colSum = Array.from({ length: c }, (_, j) => table.reduce((a, row) => a + (row[j] ?? 0), 0));
  const n = rowSum.reduce((a, b) => a + b, 0);
  if (n < 20) return null;
  let chi2 = 0;
  let lowExp = 0;
  let cells = 0;
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const exp = (rowSum[i]! * colSum[j]!) / n;
      cells++;
      if (exp < 5) lowExp++;
      if (exp <= 0) continue;
      const obs = table[i]![j] ?? 0;
      chi2 += (obs - exp) ** 2 / exp;
    }
  }
  const ok = lowExp / cells <= 0.2;
  const dof = (r - 1) * (c - 1);
  return { chi2, p: chiSquarePValue(chi2, dof), dof, n, ok };
}

export function welchT(a: number[], b: number[]): { t: number; df: number; p: number } | null {
  const x = finite(a);
  const y = finite(b);
  if (x.length < 8 || y.length < 8) return null;
  const mx = mean(x)!;
  const my = mean(y)!;
  const vx = stdev(x)! ** 2;
  const vy = stdev(y)! ** 2;
  const se = Math.sqrt(vx / x.length + vy / y.length);
  if (se === 0) return null;
  const t = (mx - my) / se;
  const num = (vx / x.length + vy / y.length) ** 2;
  const den = (vx / x.length) ** 2 / (x.length - 1) + (vy / y.length) ** 2 / (y.length - 1);
  const df = den === 0 ? x.length + y.length - 2 : num / den;
  return { t, df, p: tCdfAbs(t, df) };
}

export function mannWhitney(a: number[], b: number[]): { u: number; p: number } | null {
  const x = finite(a);
  const y = finite(b);
  if (x.length < 8 || y.length < 8) return null;
  const all = [
    ...x.map((v) => ({ v, g: 0 })),
    ...y.map((v) => ({ v, g: 1 })),
  ].sort((p, q) => p.v - q.v);
  const ranks = new Array<number>(all.length);
  for (let i = 0; i < all.length; ) {
    let j = i;
    while (j + 1 < all.length && all[j + 1]!.v === all[i]!.v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = avg;
    i = j + 1;
  }
  let r1 = 0;
  for (let i = 0; i < all.length; i++) if (all[i]!.g === 0) r1 += ranks[i]!;
  const n1 = x.length;
  const n2 = y.length;
  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const u = Math.min(u1, n1 * n2 - u1);
  const mu = (n1 * n2) / 2;
  const su = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  if (su === 0) return null;
  const z = (u - mu) / su;
  const p = 2 * Math.min(normalCdf(z), 1 - normalCdf(z));
  return { u, p };
}

export function kruskalWallis(groups: number[][]): { h: number; p: number } | null {
  const gs = groups.map(finite).filter((g) => g.length >= 3);
  if (gs.length < 3) return null;
  const all = gs.flatMap((g, gi) => g.map((v) => ({ v, gi })));
  all.sort((a, b) => a.v - b.v);
  const n = all.length;
  const ranks = new Array<number>(n);
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && all[j + 1]!.v === all[i]!.v) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = avg;
    i = j + 1;
  }
  const sumR = new Array(gs.length).fill(0);
  const ns = gs.map((g) => g.length);
  for (let i = 0; i < n; i++) sumR[all[i]!.gi] += ranks[i]!;
  let h = 0;
  for (let i = 0; i < gs.length; i++) {
    h += (sumR[i]! ** 2) / ns[i]!;
  }
  h = (12 / (n * (n + 1))) * h - 3 * (n + 1);
  const k = gs.length;
  return { h, p: chiSquarePValue(h, k - 1) };
}

export function iqrBounds(xs: number[]): { q1: number; q3: number; iqr: number; lower: number; upper: number } | null {
  const q1 = quantile(xs, 0.25);
  const q3 = quantile(xs, 0.75);
  if (q1 === null || q3 === null) return null;
  const iqr = q3 - q1;
  return { q1, q3, iqr, lower: q1 - 1.5 * iqr, upper: q3 + 1.5 * iqr };
}

export function histogram(values: number[], binCount = 12): { label: string; count: number; x0: number; x1: number }[] {
  const v = finite(values);
  if (!v.length) return [];
  const mm = minMax(v)!;
  if (mm.min === mm.max) {
    return [{ label: String(mm.min), count: v.length, x0: mm.min, x1: mm.max }];
  }
  const k = Math.min(binCount, Math.max(6, Math.round(Math.sqrt(v.length))));
  const width = (mm.max - mm.min) / k;
  const bins = Array.from({ length: k }, (_, i) => {
    const x0 = mm.min + i * width;
    const x1 = i === k - 1 ? mm.max : mm.min + (i + 1) * width;
    return { label: `${pretty(x0)}–${pretty(x1)}`, count: 0, x0, x1 };
  });
  for (const x of v) {
    let i = Math.floor((x - mm.min) / width);
    if (i >= k) i = k - 1;
    if (i < 0) i = 0;
    bins[i]!.count += 1;
  }
  return bins;
}

function pretty(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) return String(Math.round(n));
  if (abs >= 10) return (Math.round(n * 10) / 10).toString();
  return (Math.round(n * 100) / 100).toString();
}

export function pearsonP(r: number, n: number): number {
  if (n < 5 || Math.abs(r) >= 1) return Math.abs(r) >= 1 ? 0 : 1;
  const t = (r * Math.sqrt(n - 2)) / Math.sqrt(1 - r * r);
  return tCdfAbs(t, n - 2);
}
