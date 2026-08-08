'use client';

import { Table, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? '';
const INTERNAL_HEADERS = { 'x-internal-key': INTERNAL_KEY };
const REPORT_BASE = 'https://carvior.store/report';

interface ISaleListing {
  id: number;
  vehicleId: number;
  inspectionId: number | null;
  askingPrice: number;
  minimumAcceptablePrice: number | null;
  listingStatus: string;
  biddingStartAt: string | null;
  biddingEndAt: string | null;
  winningBidId: number | null;
  createdAt: string;
  carNumber?: string;
  ownerName?: string | null;
  ownerContact?: string | null;
  inspectionCarModel?: string | null;
  inspectionMileage?: number | null;
  inspectionCarHash?: string | null;
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  ACTIVE: { text: '입찰중', color: 'blue' },
  TARGET_PRICE_MET: { text: '희망가 달성', color: 'gold' },
  AWARDED: { text: '낙찰확정', color: 'green' },
  CLOSED: { text: '마감(낙찰자 없음)', color: 'default' },
  CANCELLED: { text: '취소됨', color: 'red' },
};

function fmtKRW(n?: number | null) {
  if (n == null) return '-';
  return `${Math.round(n / 10_000).toLocaleString()}만원`;
}

export default function SaleListingsList() {
  const [listings, setListings] = useState<ISaleListing[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/sale-listings`, { headers: INTERNAL_HEADERS });
      const data = await res.json();
      setListings(Array.isArray(data) ? data : []);
    } catch {
      // 조용히 실패해도 빈 목록으로 표시
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <Table
        dataSource={listings}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: '판매매물이 없습니다. "미매칭 검차차량"에서 차주 판매동의를 받은 차량을 매물로 전환하세요.' }}
        columns={[
          {
            title: '차량정보',
            render: (_: any, l: ISaleListing) => (
              <div>
                <p className="font-bold">{l.carNumber ?? '-'}</p>
                <p className="text-xs text-gray-400">
                  {l.inspectionCarModel ?? '-'} · {l.inspectionMileage != null ? `${l.inspectionMileage.toLocaleString()}km` : '-'}
                </p>
                {l.inspectionCarHash && (
                  <a href={`${REPORT_BASE}/${l.inspectionCarHash}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline">
                    검차 리포트
                  </a>
                )}
              </div>
            ),
          },
          {
            title: '차주',
            render: (_: any, l: ISaleListing) => (
              <div className="text-xs">
                <p>{l.ownerName ?? '-'}</p>
                <p className="text-gray-400">{l.ownerContact ?? '-'}</p>
              </div>
            ),
          },
          {
            title: '희망가격',
            render: (_: any, l: ISaleListing) => (
              <div className="text-xs">
                <p className="font-bold">{fmtKRW(l.askingPrice)}</p>
                {l.minimumAcceptablePrice != null && (
                  <p className="text-gray-400">최저 {fmtKRW(l.minimumAcceptablePrice)}</p>
                )}
              </div>
            ),
          },
          {
            title: '입찰기간',
            render: (_: any, l: ISaleListing) => (
              <div className="text-xs text-gray-500">
                {l.biddingEndAt ? `~ ${new Date(l.biddingEndAt).toLocaleString('ko-KR')}` : '-'}
              </div>
            ),
          },
          {
            title: '상태',
            dataIndex: 'listingStatus',
            render: (v: string) => {
              const s = STATUS_LABEL[v] ?? { text: v, color: 'default' };
              return <Tag color={s.color}>{s.text}</Tag>;
            },
          },
        ]}
      />
    </div>
  );
}
