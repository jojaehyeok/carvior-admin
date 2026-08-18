// ChavatarApp(utils/priceEstimate.ts) / cavior(components/PriceChart.tsx)와 동일한 회귀 로직.
// 세 군데(앱/웹/대시보드)가 다 따로 계산하다 어긋나지 않도록 최대한 같은 코드를 유지할 것.
type Listing = { mileage: number; priceManwon: number };

function quadFit(points: { x: number; y: number }[]) {
  let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0;
  for (const { x, y } of points) {
    const x2 = x * x, x3 = x2 * x, x4 = x2 * x2;
    S0 += 1; S1 += x; S2 += x2; S3 += x3; S4 += x4;
    T0 += y; T1 += x * y; T2 += x2 * y;
  }
  const det3 = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const M = [[S0, S1, S2], [S1, S2, S3], [S2, S3, S4]];
  const D = det3(M);
  if (Math.abs(D) < 1e-9) return null;
  const a = det3([[T0, S1, S2], [T1, S2, S3], [T2, S3, S4]]) / D;
  const b = det3([[S0, T0, S2], [S1, T1, S3], [S2, T2, S4]]) / D;
  const c = det3([[S0, S1, T0], [S1, S2, T1], [S2, S3, T2]]) / D;
  return (x: number) => a + b * x + c * x * x;
}

export function computePriceEstimate(
  listings: Listing[],
  targetMileage: number | undefined,
): { rangeLow: number; rangeHigh: number; midpoint: number } | null {
  const points = listings
    .filter((l) => l.mileage > 0 && l.priceManwon > 0)
    .map((l) => ({ x: l.mileage / 10000, y: l.priceManwon }));

  if (points.length < 4 || targetMileage == null || targetMileage <= 0) return null;

  const predict = quadFit(points);
  if (!predict) return null;

  const tx = targetMileage / 10000;
  const targetY = Math.max(0, predict(tx));
  const residuals = points.map((p) => p.y - predict(p.x));
  const meanSq = residuals.reduce((s, r) => s + r * r, 0) / residuals.length;
  const stdev = Math.sqrt(meanSq);
  const margin = Math.max(stdev * 0.5, targetY * 0.03);
  const rangeLow = Math.round((targetY - margin) / 10) * 10;
  const rangeHigh = Math.round((targetY + margin) / 10) * 10;

  return { rangeLow, rangeHigh, midpoint: Math.round(targetY / 10) * 10 };
}
