'use client';

// 매물 참고자료 — 접수 때 매물 링크(엔카/KB차차차/케이카)에서 받아둔 성능점검기록부와 엔카진단.
//
// ⚠ 판매자 쪽이 신고해둔 기록이지 우리 진단 결과가 아니다. 평가사가 현장에서 대조할
// 포인트를 미리 짚어주는 용도다 — 기록부엔 없는데 실제로 교환인 경우를 잡아내는 게 우리 일이라,
// 이 값을 리포트에 그대로 옮기면 안 된다. 화면에도 그렇게 적어둔다.

import { Button, Tag, message } from "antd";
import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_ENDPOINT;

export interface IListingData {
  ok?: boolean;
  source?: "encar" | "kbchachacha" | "kcar";
  id?: string;
  fetchedAt?: string;
  vehicle?: {
    manufacturer?: string | null;
    model?: string | null;
    grade?: string | null;
    year?: number | string | null;
    mileage?: number | null;
    fuel?: string | null;
    transmission?: string | null;
    color?: string | null;
    priceManwon?: number | null;
  } | null;
  inspection?: {
    vin?: string | null;
    mileage?: number | null;
    issueDate?: string | null;
    modelYear?: string | null;
    recall?: boolean;
    tuning?: boolean;
    waterlog?: boolean;
    carState?: string | null;
    guaranty?: string | null;
    comments?: string | null;
    seriousTypes?: string[];
    outers?: { part: string; status: string | null }[];
    inners?: { part: string; status: string | null }[];
  } | null;
  diagnosis?: {
    diagnosisDate?: string | null;
    comment?: string | null;
    abnormal?: { name: string; result: string }[];
    normalCount?: number;
  } | null;
  hasHistory?: boolean;
}

const SOURCE_LABEL: Record<string, string> = {
  encar: "엔카",
  kbchachacha: "KB차차차",
  kcar: "케이카",
};

// 기록부 발행일은 YYYYMMDD 문자열로 온다
const ymd = (v?: string | null) =>
  v && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6)}` : v || "-";

export default function ListingReference({
  bookingId,
  listingUrl,
  data,
  onRefreshed,
}: {
  bookingId: number;
  listingUrl?: string | null;
  data?: IListingData | null;
  onRefreshed?: (next: IListingData) => void;
}) {
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/external/request/${bookingId}/refresh-listing-data`, {
        method: "POST",
      });
      const next = await res.json();
      if (!res.ok || !next?.ok) {
        message.warning(
          next?.reason === "no-listing-url" ? "매물 링크가 없습니다."
          : next?.reason === "unsupported-url" ? "지원하지 않는 매물 링크입니다."
          : "매물에서 자료를 받지 못했습니다(이미 내려간 매물일 수 있습니다).",
        );
        return;
      }
      message.success("참고자료를 다시 받았습니다.");
      onRefreshed?.(next);
    } catch {
      message.error("조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!listingUrl) return null;

  const insp = data?.inspection;
  const diag = data?.diagnosis;
  const parts = [...(insp?.outers ?? []), ...(insp?.inners ?? [])];
  const flags = [
    insp?.waterlog && { label: "침수", color: "red" },
    (insp?.seriousTypes?.length ?? 0) > 0 && { label: "중대사고 기록", color: "red" },
    insp?.recall && { label: "리콜 대상", color: "orange" },
    insp?.tuning && { label: "튜닝", color: "orange" },
  ].filter(Boolean) as { label: string; color: string }[];

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">매물 참고자료</p>
        <div className="flex items-center gap-2">
          <a href={listingUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
            매물 열기
          </a>
          <Button size="small" loading={loading} onClick={refresh}>
            다시 받기
          </Button>
        </div>
      </div>

      {!data?.ok ? (
        <p className="text-xs text-gray-400">
          아직 받아온 자료가 없습니다. &quot;다시 받기&quot;를 눌러보세요.
          <span className="block text-gray-300 mt-0.5">
            엔카 매물만 기록부·진단이 나옵니다(케이카는 기록부가 없고, KB차차차는 일부만).
          </span>
        </p>
      ) : (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag color="blue">{SOURCE_LABEL[data.source ?? ""] ?? data.source}</Tag>
            {flags.map(f => (
              <Tag key={f.label} color={f.color}>{f.label}</Tag>
            ))}
            {flags.length === 0 && insp && <Tag color="green">침수·중대사고 기록 없음</Tag>}
            <span className="text-[11px] text-gray-300 ml-auto">
              {data.fetchedAt ? `${new Date(data.fetchedAt).toLocaleDateString("ko-KR")} 기준` : ""}
            </span>
          </div>

          {/* 성능점검기록부 */}
          {insp ? (
            <div>
              <p className="text-[11px] font-bold text-gray-500 mb-1">성능점검기록부</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                <Row label="VIN" value={insp.vin} mono />
                <Row label="기록부 주행거리" value={insp.mileage ? `${insp.mileage.toLocaleString()}km` : null} />
                <Row label="발행일" value={ymd(insp.issueDate)} />
                <Row label="상태 판정" value={insp.carState} />
                <Row label="보증" value={insp.guaranty} />
                <Row label="연식" value={insp.modelYear} />
              </div>

              <p className="text-[11px] font-bold text-gray-500 mt-2 mb-1">교환·판금 기록</p>
              {parts.length === 0 ? (
                <p className="text-xs text-green-600">기록상 교환·판금 없음</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {parts.map((p, i) => (
                    <Tag key={`${p.part}-${i}`} color="volcano" style={{ marginInlineEnd: 0 }}>
                      {p.part}{p.status ? ` (${p.status})` : ""}
                    </Tag>
                  ))}
                </div>
              )}

              {insp.comments && (
                <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{insp.comments}</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400">이 매물은 성능점검기록부가 없습니다.</p>
          )}

          {/* 엔카진단 */}
          {diag && (
            <div className="border-t border-gray-200 pt-2">
              <p className="text-[11px] font-bold text-gray-500 mb-1">
                엔카진단
                {diag.diagnosisDate && (
                  <span className="font-normal text-gray-300 ml-1">
                    {String(diag.diagnosisDate).slice(0, 10)}
                  </span>
                )}
              </p>
              {(diag.abnormal?.length ?? 0) === 0 ? (
                <p className="text-xs text-green-600">
                  전 항목 정상{diag.normalCount ? ` (${diag.normalCount}개 항목)` : ""}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {diag.abnormal!.map((a, i) => (
                    <Tag key={`${a.name}-${i}`} color="red" style={{ marginInlineEnd: 0 }}>
                      {a.name} · {a.result}
                    </Tag>
                  ))}
                </div>
              )}
              {diag.comment && (
                <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">{diag.comment}</p>
              )}
            </div>
          )}

          <p className="text-[11px] text-amber-600 leading-relaxed border-t border-gray-200 pt-2">
            판매자 쪽이 신고해둔 기록입니다. 카비어 진단 결과가 아니며, 현장에서 반드시 직접
            확인해주세요 — 기록에 없는 교환·누유를 잡아내는 것이 검차의 목적입니다.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value?: string | number | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className={`text-gray-800 truncate ${mono ? "font-mono text-[11px]" : ""}`}>
        {value || "-"}
      </span>
    </div>
  );
}
