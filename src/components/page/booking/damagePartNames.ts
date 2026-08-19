// CarEvaluationDamageChecker(진단사 앱)의 CHECK_POSITIONS(37개, index 0~36)와 1:1 대응되는 부위명.
// ChavatarApp의 constants/damageDepreciation.ts와 동일한 원본(Flutter) 순서.
export const PART_NAMES = [
  "운전석 앞휀더", "운전석 앞도어", "운전석 A필러", "운전석 사이드실 패널",
  "운전석 B필러", "운전석 뒷도어", "운전석 C필러", "운전석 쿼터패널",
  "후드", "루프패널", "트렁크 리드",
  "조수석 앞휀더", "조수석 A필러", "조수석 앞도어", "조수석 사이드실 패널",
  "조수석 B필러", "조수석 뒷도어", "조수석 C필러", "조수석 쿼터패널",
  "라디에이터 서포트", "프런트 패널",
  "운전석 인사이드 패널", "운전석 프런트 사이드멤버", "조수석 프런트 사이드멤버",
  "조수석 인사이드 패널", "운전석 프런트 휠하우스", "조수석 프런트 휠하우스",
  "크로스 멤버", "대쉬 패널", "플로어 패널", "패키지 트레이",
  "운전석 리어 휠하우스", "운전석 리어 사이드멤버", "트렁크 플로어 패널",
  "조수석 리어 사이드멤버", "조수석 리어 휠하우스", "리어 패널",
];

const SYMBOL_LABEL: Record<string, string> = { X: "교환", B: "판금", W: "용접" };

// checkedDamages(리포트의 damages 배열)를 "후드(교환), 루프패널(교환) ..." 형태로 요약.
export function summarizeDamages(damages: string[][] | undefined | null): { text: string; count: number } {
  if (!Array.isArray(damages)) return { text: "", count: 0 };
  const parts: string[] = [];
  damages.forEach((symbols, i) => {
    const symbol = symbols?.[0];
    if (!symbol || !SYMBOL_LABEL[symbol]) return;
    const name = PART_NAMES[i] || `부위${i + 1}`;
    parts.push(`${name}(${SYMBOL_LABEL[symbol]})`);
  });
  return { text: parts.join(", "), count: parts.length };
}

// ── 사고감가율(%) — ChavatarApp의 constants/damageDepreciation.ts와 동일한 표. X(교환) 기준값,
// B(판금)·W(용접)는 절반 반영. 사용자 제공 사고감가표 기준.
const DEPRECIATION_RATES: Record<string, number> = {
  후드: 4, 프론트펜더: 2, 프론트패널: 4, 인사이드패널: 2, "휠하우스(앞)": 6,
  필러패널A: 4, 필러패널B: 4, 필러패널C: 4, 사이드실패널: 3, 도어: 3,
  루프패널: 8, 쿼터패널: 4, "휠하우스(뒤)": 5, 트렁크플로어: 4, 리어패널: 3,
  트렁크리드: 3, 사이드멤버: 3, 대쉬패널: 3, 플로어패널: 4, 패키지트레이: 3,
};

// PART_NAMES(37개) 각 위치를 위 요율표의 카테고리 키로 매핑. 표에 없는 부위(라디에이터
// 서포트/크로스 멤버)는 null로 두어 감가 계산에서 제외.
const PART_CATEGORY: (string | null)[] = [
  "프론트펜더", "도어", "필러패널A", "사이드실패널",
  "필러패널B", "도어", "필러패널C", "쿼터패널",
  "후드", "루프패널", "트렁크리드",
  "프론트펜더", "필러패널A", "도어", "사이드실패널",
  "필러패널B", "도어", "필러패널C", "쿼터패널",
  null, "프론트패널",
  "인사이드패널", "사이드멤버", "사이드멤버",
  "인사이드패널", "휠하우스(앞)", "휠하우스(앞)",
  null, "대쉬패널", "플로어패널", "패키지트레이",
  "휠하우스(뒤)", "사이드멤버", "트렁크플로어",
  "사이드멤버", "휠하우스(뒤)", "리어패널",
];

export interface DamageBreakdownItem {
  name: string;
  symbol: string;
  pct: number; // 이 부위 하나의 감가율(%)
  won: number; // 기준가(만원) × pct/100 — 만원 단위, 반올림
}

// checkedDamages + 기준가(만원, 보통 회귀 예상가의 중간값)를 받아 부위별 "얼마씩 깎이는지" 목록을 만든다.
export function computeDamageBreakdown(
  damages: string[][] | undefined | null,
  basePriceManwon: number,
): { items: DamageBreakdownItem[]; totalPct: number; totalWon: number } {
  const items: DamageBreakdownItem[] = [];
  let totalPct = 0;
  if (Array.isArray(damages)) {
    damages.forEach((symbols, i) => {
      const symbol = symbols?.[0];
      if (!symbol || !SYMBOL_LABEL[symbol]) return;
      const category = PART_CATEGORY[i];
      if (!category) return;
      const baseRate = DEPRECIATION_RATES[category];
      if (baseRate == null) return;
      const pct = symbol === "X" ? baseRate : baseRate / 2; // B/W는 절반
      totalPct += pct;
      items.push({
        name: PART_NAMES[i] || `부위${i + 1}`,
        symbol,
        pct,
        won: Math.round((basePriceManwon * pct) / 100),
      });
    });
  }
  const totalWon = Math.round((basePriceManwon * totalPct) / 100);
  return { items, totalPct: Math.round(totalPct * 10) / 10, totalWon };
}

// ── 외판도색/휠/스마트키/타이어/실내크리닝 실비(만원) — ChavatarApp의 constants/repairCostEstimate.ts와 동일 기준.
const DOMESTIC_MANUFACTURERS = new Set([
  "현대", "기아", "제네시스", "쉐보레(GM대우)", "쉐보레", "GM대우",
  "르노코리아", "르노삼성", "삼성", "KG모빌리티", "쌍용",
]);

export interface RepairCostInputs {
  manufacturer?: string | null;
  paintNeeded: number;
  wheelScratch: number;
  smartKeyCount: number;
  frontTirePct: number;
  backTirePct: number;
}

export function computeFlatRepairDeduction(input: RepairCostInputs): { totalWon: number; breakdown: string[] } {
  const isDomestic = !input.manufacturer || DOMESTIC_MANUFACTURERS.has(input.manufacturer.trim());
  const breakdown: string[] = [];
  let total = 0;

  if (input.paintNeeded > 0) {
    const rate = isDomestic ? 10 : 15;
    const cost = input.paintNeeded * rate;
    total += cost;
    breakdown.push(`외판도색 ${input.paintNeeded}판 -${cost}만원`);
  }
  if (input.wheelScratch > 0) {
    const cost = input.wheelScratch * 10;
    total += cost;
    breakdown.push(`휠 스크래치 ${input.wheelScratch}짝 -${cost}만원`);
  }
  if (input.smartKeyCount === 0) {
    total += 15;
    breakdown.push(`스마트키 없음 -15만원`);
  }
  let tireCount = 0;
  if (input.frontTirePct <= 20) tireCount += 1;
  if (input.backTirePct <= 20) tireCount += 1;
  if (tireCount > 0) {
    const cost = tireCount * 10;
    total += cost;
    breakdown.push(`타이어 마모(${tireCount}개) -${cost}만원`);
  }
  return { totalWon: total, breakdown };
}
