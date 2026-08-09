'use client';

import { Button, Drawer, Input, Radio, Table, Tag, message } from "antd";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? '';
const INTERNAL_HEADERS = { 'x-internal-key': INTERNAL_KEY };

interface ITransaction {
  id: number;
  listingId: number;
  vehicleId: number;
  sellerId: number | null;
  dealerId: number | null;
  dealerName: string;
  winningBidAmount: number;
  status: string;
  createdAt: string;
}

interface IEscrowPayment {
  id: number;
  pgProvider: string;
  pgTransactionId: string | null;
  amount: number;
  escrowStatus: string;
  paidAt: string | null;
  releasedAt: string | null;
}

interface ITransport {
  id: number;
  pickupAddress: string;
  destinationAddress: string;
  pickupContact: string;
  deliveryContact: string;
  transportFee: number | null;
  payer: string;
  transportStatus: string;
}

interface ISettlement {
  id: number;
  vehiclePrice: number;
  transportFee: number;
  brokerageFee: number;
  sellerDeduction: number;
  sellerPayout: number;
  paidAt: string | null;
}

interface ITransactionDetail extends ITransaction {
  escrow: IEscrowPayment | null;
  transport: ITransport | null;
  settlement: ISettlement | null;
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  AWAITING_ESCROW_PAYMENT: { text: '에스크로 입금대기', color: 'gold' },
  ESCROW_PAID: { text: '에스크로 입금완료', color: 'blue' },
  TRANSPORT_READY: { text: '탁송 대기', color: 'blue' },
  TRANSPORT_IN_PROGRESS: { text: '탁송중', color: 'processing' as any },
  VEHICLE_PICKED_UP: { text: '차량 인수완료', color: 'purple' },
  SETTLEMENT_PENDING: { text: '정산 대기', color: 'gold' },
  SETTLEMENT_RELEASE_REQUESTED: { text: '정산 지급요청됨', color: 'orange' },
  SELLER_PAID: { text: '차주 정산완료', color: 'green' },
  DELIVERED: { text: '딜러 배송완료', color: 'green' },
  COMPLETED: { text: '거래완료', color: 'success' as any },
  CANCELLED: { text: '취소됨', color: 'red' },
};

function fmtKRW(n?: number | null) {
  if (n == null) return '-';
  return `${Math.round(Number(n) / 10_000).toLocaleString()}만원`;
}

export default function SaleTransactionsList() {
  const [list, setList] = useState<ITransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ITransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const [pickupAddress, setPickupAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [pickupContact, setPickupContact] = useState('');
  const [deliveryContact, setDeliveryContact] = useState('');
  const [transportFee, setTransportFee] = useState('');
  const [payer, setPayer] = useState<'DEALER' | 'SELLER'>('DEALER');

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/transactions`, { headers: INTERNAL_HEADERS });
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch {
      // 조용히 실패
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API}/admin/transactions/${id}`, { headers: INTERNAL_HEADERS });
      const data = await res.json();
      setDetail(data);
      setPickupAddress(''); setDestinationAddress(''); setPickupContact(''); setDeliveryContact(''); setTransportFee(''); setPayer('DEALER');
    } catch {
      message.error('거래 정보를 불러오지 못했습니다.');
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!detail) return;
    await openDetail(detail.id);
    fetchList();
  };

  const act = async (path: string, body?: any) => {
    if (!detail) return;
    setActing(true);
    try {
      const res = await fetch(`${API}/admin/transactions/${detail.id}${path}`, {
        method: 'PATCH',
        headers: { ...INTERNAL_HEADERS, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const err = await res.json();
        message.error(err.message ?? '처리에 실패했습니다.');
        return;
      }
      message.success('처리됐어요.');
      await refreshDetail();
    } catch {
      message.error('서버와 통신할 수 없습니다.');
    } finally {
      setActing(false);
    }
  };

  const requestTransport = () => {
    if (!pickupAddress.trim() || !destinationAddress.trim() || !pickupContact.trim() || !deliveryContact.trim()) {
      message.warning('픽업지·목적지·연락처를 모두 입력해주세요.');
      return;
    }
    act('/transport', {
      pickupAddress, destinationAddress, pickupContact, deliveryContact,
      transportFee: transportFee ? Number(transportFee) * 10_000 : undefined,
      payer,
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <Table
        dataSource={list}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: '아직 낙찰 확정된 거래가 없습니다. "판매매물"에서 입찰을 낙찰선정하면 여기 나타납니다.' }}
        columns={[
          { title: '거래ID', dataIndex: 'id', width: 80 },
          { title: '딜러', dataIndex: 'dealerName' },
          { title: '낙찰가', render: (_: any, t: ITransaction) => fmtKRW(t.winningBidAmount) },
          {
            title: '상태',
            dataIndex: 'status',
            render: (v: string) => {
              const s = STATUS_LABEL[v] ?? { text: v, color: 'default' };
              return <Tag color={s.color}>{s.text}</Tag>;
            },
          },
          { title: '생성일', render: (_: any, t: ITransaction) => new Date(t.createdAt).toLocaleString('ko-KR') },
          {
            title: '관리',
            render: (_: any, t: ITransaction) => <Button size="small" onClick={() => openDetail(t.id)}>상세 관리</Button>,
          },
        ]}
      />

      <Drawer
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `거래 #${detail.id} · ${detail.dealerName}` : ''}
        width={420}
        loading={detailLoading}
      >
        {detail && (
          <div className="flex flex-col gap-5">
            <div>
              <Tag color={(STATUS_LABEL[detail.status] ?? { color: 'default' }).color}>
                {(STATUS_LABEL[detail.status] ?? { text: detail.status }).text}
              </Tag>
              <p className="text-xs text-gray-400 mt-1">낙찰가 {fmtKRW(detail.winningBidAmount)}</p>
            </div>

            {/* 에스크로 */}
            <div className="border border-gray-100 rounded-lg p-3">
              <p className="text-xs font-bold text-gray-700 mb-1">에스크로 (Mock)</p>
              <p className="text-xs text-gray-400">상태: {detail.escrow?.escrowStatus ?? '-'}</p>
              <p className="text-xs text-gray-400">거래번호: {detail.escrow?.pgTransactionId ?? '-'}</p>
              {detail.status === 'AWAITING_ESCROW_PAYMENT' && (
                <Button size="small" type="primary" className="mt-2" loading={acting} onClick={() => act('/confirm-escrow-paid')}>
                  에스크로 입금 확인
                </Button>
              )}
            </div>

            {/* 탁송 */}
            <div className="border border-gray-100 rounded-lg p-3">
              <p className="text-xs font-bold text-gray-700 mb-1">탁송</p>
              {detail.transport ? (
                <div className="text-xs text-gray-500 flex flex-col gap-1">
                  <p>상태: {detail.transport.transportStatus}</p>
                  <p>{detail.transport.pickupAddress} → {detail.transport.destinationAddress}</p>
                  <p>탁송료: {fmtKRW(detail.transport.transportFee)} ({detail.transport.payer === 'SELLER' ? '차주 부담' : '딜러 부담'})</p>
                  {detail.status === 'TRANSPORT_IN_PROGRESS' && detail.transport.transportStatus !== 'PICKUP_CONFIRMED' && (
                    <div className="flex gap-1.5 mt-1">
                      {['DRIVER_ASSIGNED', 'IN_TRANSIT', 'PICKUP_CONFIRMED'].map(s => (
                        <Button key={s} size="small" loading={acting} onClick={() => act('/transport-status', { status: s })}>
                          {s}
                        </Button>
                      ))}
                    </div>
                  )}
                  {detail.status === 'SELLER_PAID' && detail.transport.transportStatus !== 'DELIVERED' && (
                    <Button size="small" type="primary" className="mt-1" loading={acting} onClick={() => act('/transport-status', { status: 'DELIVERED' })}>
                      딜러 배송완료 처리
                    </Button>
                  )}
                </div>
              ) : detail.status === 'TRANSPORT_READY' ? (
                <div className="flex flex-col gap-2 mt-1">
                  <Input size="small" placeholder="픽업 주소 (차주)" value={pickupAddress} onChange={e => setPickupAddress(e.target.value)} />
                  <Input size="small" placeholder="목적지 주소 (딜러)" value={destinationAddress} onChange={e => setDestinationAddress(e.target.value)} />
                  <Input size="small" placeholder="픽업 연락처" value={pickupContact} onChange={e => setPickupContact(e.target.value)} />
                  <Input size="small" placeholder="배송 연락처" value={deliveryContact} onChange={e => setDeliveryContact(e.target.value)} />
                  <Input size="small" placeholder="탁송료 (만원)" value={transportFee} onChange={e => setTransportFee(e.target.value.replace(/[^0-9]/g, ''))} />
                  <Radio.Group size="small" value={payer} onChange={e => setPayer(e.target.value)}>
                    <Radio.Button value="DEALER">딜러 부담</Radio.Button>
                    <Radio.Button value="SELLER">차주 부담</Radio.Button>
                  </Radio.Group>
                  <Button size="small" type="primary" loading={acting} onClick={requestTransport}>탁송 신청</Button>
                </div>
              ) : (
                <p className="text-xs text-gray-400">에스크로 입금 확인 후 신청 가능</p>
              )}
            </div>

            {/* 정산 */}
            <div className="border border-gray-100 rounded-lg p-3">
              <p className="text-xs font-bold text-gray-700 mb-1">정산</p>
              {detail.settlement ? (
                <div className="text-xs text-gray-500 flex flex-col gap-0.5">
                  <p>차량가: {fmtKRW(detail.settlement.vehiclePrice)}</p>
                  <p>탁송료 공제: {fmtKRW(detail.settlement.sellerDeduction)}</p>
                  <p className="font-bold text-gray-800">차주 지급액: {fmtKRW(detail.settlement.sellerPayout)}</p>
                  <p>지급완료: {detail.settlement.paidAt ? new Date(detail.settlement.paidAt).toLocaleString('ko-KR') : '아직'}</p>
                  {detail.status === 'SETTLEMENT_PENDING' && (
                    <Button size="small" type="primary" className="mt-1" loading={acting} onClick={() => act('/confirm-settlement-release')}>
                      정산 지급 요청
                    </Button>
                  )}
                  {detail.status === 'SETTLEMENT_RELEASE_REQUESTED' && (
                    <Button size="small" type="primary" className="mt-1" loading={acting} onClick={() => act('/confirm-seller-paid')}>
                      차주 정산 지급 확인
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400">차량 인수(픽업) 완료 후 자동 계산됩니다</p>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
