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
