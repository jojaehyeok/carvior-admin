'use client';

import { Button, Modal, Table, Tag, message } from "antd";
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

interface ISaleBid {
  id: number;
  listingId: number;
  dealerId: number | null;
  dealerName: string;
  amount: number;
  status: string;
  createdAt: string;
}

const BID_STATUS_LABEL: Record<string, { text: string; color: string }> = {
  ACTIVE: { text: '입찰중', color: 'blue' },
  WITHDRAWN: { text: '철회됨', color: 'default' },
  WINNER: { text: '낙찰', color: 'green' },
  LOST: { text: '미낙찰', color: 'default' },
};

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
  const [bidModalListing, setBidModalListing] = useState<ISaleListing | null>(null);
  const [bids, setBids] = useState<ISaleBid[]>([]);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [selecting, setSelecting] = useState<number | null>(null);

  const openBidModal = async (listing: ISaleListing) => {
    setBidModalListing(listing);
    setBidsLoading(true);
    try {
      const res = await fetch(`${API}/admin/sale-listings/${listing.id}/bids`, { headers: INTERNAL_HEADERS });
      const data = await res.json();
      setBids(Array.isArray(data) ? data : []);
    } catch {
      setBids([]);
    } finally {
      setBidsLoading(false);
    }
  };

  const selectWinner = async (bidId: number) => {
    if (!bidModalListing) return;
    if (!window.confirm('이 입찰을 낙찰로 확정할까요? 확정 후에는 되돌릴 수 없습니다.')) return;
    setSelecting(bidId);
    try {
      const res = await fetch(`${API}/admin/sale-listings/${bidModalListing.id}/select-winner`, {
        method: 'PATCH',
        headers: { ...INTERNAL_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidId }),
      });
      if (!res.ok) {
        const err = await res.json();
        message.error(err.message ?? '낙찰 확정에 실패했습니다.');
        return;
      }
      message.success('낙찰이 확정됐어요. 거래관리에서 이어서 진행하세요.');
      setBidModalListing(null);
      fetchListings();
    } catch {
      message.error('서버와 통신할 수 없습니다.');
    } finally {
      setSelecting(null);
    }
  };

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
          {
            title: '입찰 관리',
            render: (_: any, l: ISaleListing) => (
              <Button size="small" onClick={() => openBidModal(l)}>
                입찰 보기{l.listingStatus === 'AWARDED' ? ' · 낙찰완료' : ''}
              </Button>
            ),
          },
        ]}
      />

      <Modal
        open={!!bidModalListing}
        onCancel={() => setBidModalListing(null)}
        footer={null}
        title={`입찰 현황 · ${bidModalListing?.carNumber ?? ''}`}
      >
        {bidsLoading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : bids.length === 0 ? (
          <p className="text-sm text-gray-400">아직 입찰이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {bids.map(b => {
              const s = BID_STATUS_LABEL[b.status] ?? { text: b.status, color: 'default' };
              return (
                <div key={b.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-bold">{b.dealerName}</p>
                    <p className="text-xs text-gray-400">{fmtKRW(b.amount)} · <Tag color={s.color}>{s.text}</Tag></p>
                  </div>
                  {bidModalListing?.listingStatus !== 'AWARDED' && b.status === 'ACTIVE' && (
                    <Button
                      size="small" type="primary"
                      loading={selecting === b.id}
                      onClick={() => selectWinner(b.id)}
                    >
                      낙찰선정
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
