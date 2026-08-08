'use client';

import { Button, message, Modal, Steps, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";

const CAVIOR_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://carvior.store/api/v1').replace('/api/v1', '');
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? '';
const INTERNAL_HEADERS = { 'x-internal-key': INTERNAL_KEY };

// 차대금 입금계좌 — settlement.tsx 등 기존 정산 화면에서 쓰는 카비어 법인계좌와 동일
const BANK_INFO = { bank: '카카오뱅크', number: '3333-35-1997303', holder: '(주)카비어' };

interface IBid {
  id: number;
  storeItemId: number;
  dealerId: number | null;
  dealerName: string;
  amount: number;
  createdAt: string;
}

interface IBidStatusItem {
  id: string;
  titleKo: string;
  status: string;
  saleStage?: string;
  priceKRW?: number;
  winningBidId?: number | null;
  depositConfirmed?: boolean;
  depositConfirmedAt?: string | null;
  sellerPayoutConfirmed?: boolean;
  sellerPayoutConfirmedAt?: string | null;
  transportPreferredDateTime?: string | null;
  transportRequestedAt?: string | null;
  ownerRequestedBidId?: number | null;
  transferredRegistrationUrl?: string | null;
}

const STAGE_STEPS = [
  { key: 'bidding', title: '입찰중' },
  { key: 'winner_selected', title: '낙찰확정' },
  { key: 'in_transit', title: '탁송중' },
  { key: 'transit_done', title: '탁송완료' },
  { key: 'completed', title: '거래완료' },
];

const NEXT_STAGE: Record<string, string> = {
  winner_selected: 'in_transit',
  in_transit: 'transit_done',
};

function fmtKRW(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  return `${Math.round(n / 10_000)}만원`;
}

export default function BidStatusModal({
  item,
  onClose,
  onChanged,
}: {
  item: IBidStatusItem | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [bids, setBids] = useState<IBid[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<number | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmingDeposit, setConfirmingDeposit] = useState(false);
  const [confirmingPayout, setConfirmingPayout] = useState(false);

  const fetchBids = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/v1/external/store-items/${item.id}/bids`, { headers: INTERNAL_HEADERS });
      setBids(res.ok ? await res.json() : []);
    } catch {
      message.error('입찰 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [item]);

  useEffect(() => { fetchBids(); }, [fetchBids]);

  if (!item) return null;

  const stageIndex = Math.max(0, STAGE_STEPS.findIndex(s => s.key === (item.saleStage ?? 'bidding')));
  const nextStage = NEXT_STAGE[item.saleStage ?? ''];
  // winner_selected → in_transit로 넘어가려면 딜러가 입금한 차대금(에스크로 예치)을 관리자가
  // 먼저 확인해야 함. 이 돈은 탁송이 시작되는 시점에 차주에게 지급(release)됨 — 지급 확인은
  // sellerPayoutConfirmed로 별도 추적(아래 "차주 정산 지급 확인" 버튼).
  const awaitingDeposit = item.saleStage === 'winner_selected' && !item.depositConfirmed;
  const canAdvance = !!nextStage && !awaitingDeposit;
  const winningBid = bids.find(b => b.id === item.winningBidId);

  const handleSelectWinner = (bid: IBid) => {
    Modal.confirm({
      title: '낙찰 확정',
      content: `${bid.dealerName} (${fmtKRW(bid.amount)})을(를) 낙찰자로 확정하시겠습니까? 매물이 거래완료 상태로 전환됩니다.`,
      okText: '확정',
      cancelText: '취소',
      onOk: async () => {
        setSelectingId(bid.id);
        try {
          const res = await fetch(`${CAVIOR_BASE}/api/v1/admin/bids/${bid.id}/select-winner`, {
            method: 'PATCH',
            headers: INTERNAL_HEADERS,
          });
          if (!res.ok) throw new Error();
          message.success('낙찰이 확정되었습니다.');
          onChanged();
          fetchBids();
        } catch {
          message.error('낙찰 확정에 실패했습니다.');
        } finally {
          setSelectingId(null);
        }
      },
    });
  };

  const handleAdvanceStage = async () => {
    if (!nextStage) return;
    setAdvancing(true);
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/admin/store-items?id=${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleStage: nextStage }),
      });
      if (!res.ok) throw new Error();
      message.success('진행단계가 업데이트되었습니다.');
      onChanged();
    } catch {
      message.error('단계 업데이트에 실패했습니다.');
    } finally {
      setAdvancing(false);
    }
  };

  const handleConfirmDeposit = async () => {
    setConfirmingDeposit(true);
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/v1/admin/store-items/${item.id}/confirm-deposit`, {
        method: 'PATCH',
        headers: INTERNAL_HEADERS,
      });
      if (!res.ok) throw new Error();
      message.success('입금이 확인되었습니다.');
      onChanged();
    } catch {
      message.error('입금 확인에 실패했습니다.');
    } finally {
      setConfirmingDeposit(false);
    }
  };

  const handleConfirmPayout = async () => {
    setConfirmingPayout(true);
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/v1/admin/store-items/${item.id}/confirm-seller-payout`, {
        method: 'PATCH',
        headers: INTERNAL_HEADERS,
      });
      if (!res.ok) throw new Error();
      message.success('차주 정산 지급이 확인되었습니다.');
      onChanged();
    } catch {
      message.error('정산 지급 확인에 실패했습니다.');
    } finally {
      setConfirmingPayout(false);
    }
  };

  const handleUploadRegistration = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch(`${CAVIOR_BASE}/api/v1/admin/store-items/${item.id}/transferred-registration`, {
        method: 'POST',
        headers: INTERNAL_HEADERS,
        body: fd,
      });
      if (!res.ok) throw new Error();
      message.success('등록증이 업로드되었습니다. 거래완료로 전환됩니다.');
      onChanged();
    } catch {
      message.error('등록증 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
    return false; // antd Upload의 자동 전송 막기
  };

  return (
    <Modal
      title={`입찰현황 — ${item.titleKo}`}
      open={!!item}
      onCancel={onClose}
      footer={null}
      width={640}
    >
      <Steps size="small" current={stageIndex} items={STAGE_STEPS.map(s => ({ title: s.title }))} className="mb-6" />

      {awaitingDeposit && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <p className="text-xs font-bold text-amber-700 mb-2">
            차대금 입금 대기중(에스크로 예치){winningBid ? ` · ${fmtKRW(winningBid.amount)}` : ''}
          </p>
          <div className="text-xs text-gray-600 space-y-0.5 mb-3">
            <p>은행 {BANK_INFO.bank} · 계좌번호 {BANK_INFO.number} · 예금주 {BANK_INFO.holder}</p>
            <p className="text-gray-400">딜러가 입금한 차대금은 카비어가 잠시 보관하고, 탁송이 시작되면 차주에게 지급합니다.</p>
          </div>
          <Button type="primary" loading={confirmingDeposit} onClick={handleConfirmDeposit}>
            입금 확인
          </Button>
        </div>
      )}

      {item.depositConfirmed && !item.sellerPayoutConfirmed && (item.saleStage === 'in_transit' || item.saleStage === 'transit_done') && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <p className="text-xs font-bold text-blue-700 mb-2">
            차주 정산 지급 대기중{winningBid ? ` · ${fmtKRW(winningBid.amount)}` : ''}
          </p>
          <p className="text-xs text-gray-500 mb-3">탁송이 시작됐으니 차주 계좌로 차대금을 지급하고, 실제 송금 후 아래 버튼을 눌러주세요.</p>
          <Button type="primary" loading={confirmingPayout} onClick={handleConfirmPayout}>
            정산 지급 확인
          </Button>
        </div>
      )}

      {item.sellerPayoutConfirmed && (
        <p className="text-xs text-emerald-600 font-bold mb-4">
          ✓ 차주 정산 지급 완료{item.sellerPayoutConfirmedAt ? ` (${dayjs(item.sellerPayoutConfirmedAt).format('YYYY-MM-DD HH:mm')})` : ''}
        </p>
      )}

      {item.transportRequestedAt && (
        <p className="text-xs text-gray-500 mb-4">
          🚚 차주 탁송 신청 · 희망일시: {item.transportPreferredDateTime ? dayjs(item.transportPreferredDateTime).format('YYYY-MM-DD HH:mm') : '-'}
        </p>
      )}

      {(canAdvance || item.saleStage === 'transit_done') && (
        <div className="flex items-center gap-3 mb-6 bg-slate-50 border border-slate-100 rounded-lg px-4 py-3">
          {canAdvance && (
            <Button type="primary" loading={advancing} onClick={handleAdvanceStage}>
              다음 단계로 ({STAGE_STEPS.find(s => s.key === nextStage)?.title})
            </Button>
          )}
          {item.saleStage === 'transit_done' && !item.transferredRegistrationUrl && (
            <Upload beforeUpload={handleUploadRegistration} showUploadList={false} accept="image/*,.pdf">
              <Button icon={<UploadOutlined />} loading={uploading}>등록증 업로드 (거래완료 처리)</Button>
            </Upload>
          )}
          {item.transferredRegistrationUrl && (
            <a href={item.transferredRegistrationUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">
              등록증 보기
            </a>
          )}
        </div>
      )}

      <p className="text-xs font-bold text-gray-400 mb-2">입찰 목록 ({bids.length}건)</p>
      {loading ? (
        <p className="text-sm text-gray-400 py-6 text-center">불러오는 중…</p>
      ) : bids.length === 0 ? (
        <p className="text-sm text-gray-300 py-6 text-center">아직 입찰이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {bids.map(bid => (
            <div key={bid.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3">
              <div>
                <p className="font-bold text-sm">
                  {bid.dealerName}
                  {bid.id === item.ownerRequestedBidId && (
                    <span className="ml-2 text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">차주 선택</span>
                  )}
                </p>
                <p className="text-xs text-gray-400">{dayjs(bid.createdAt).format('YYYY-MM-DD HH:mm')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-black text-green-600">{fmtKRW(bid.amount)}</span>
                <Button
                  size="small"
                  type="primary"
                  disabled={item.status === 'sold'}
                  loading={selectingId === bid.id}
                  onClick={() => handleSelectWinner(bid)}
                >
                  낙찰 확정
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
