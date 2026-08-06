'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import DefaultTableBtn from "@/components/shared/ui/default-table-btn";
import { Button, Form, Input, InputNumber, message, Modal, Select, Statistic, Steps, Tag } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Copy, Edit, Gavel, RefreshCw, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

const CAVIOR_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://carvior.store/api/v1').replace('/api/v1', '');
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? '';
const INTERNAL_HEADERS = { 'x-internal-key': INTERNAL_KEY };

interface IRentalListing {
  id: number;
  carNumber?: string;
  titleKo?: string;
  year?: number;
  mileage?: number;
  fuel?: string;
  rentalCompany?: string;
  monthlyPayment?: number;
  remainingMonths?: number;
  totalMonths?: number;
  totalTakeoverCost?: number;
  totalRemainingPayment?: number;
  maxSubsidy?: number;
  returnFeeAtEnd?: number;
  description?: string;
  insuranceNote?: string;
  sellerName?: string;
  sellerContact?: string;
  status: 'active' | 'matched' | 'completed' | 'hidden';
  ownerAccessToken?: string;
  registeredAt: string;
}

interface IRentalBid {
  id: number;
  bidderName: string;
  bidderContact?: string;
  requestedSubsidy: number;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { color: string; text: string }> = {
  active:    { color: 'green',   text: '승계 진행중' },
  matched:   { color: 'blue',    text: '승계자 확정' },
  completed: { color: 'default', text: '승계 완료' },
  hidden:    { color: 'orange',  text: '숨김' },
};

function fmtWon(n?: number) {
  if (!n) return '-';
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  return `${Math.round(n / 10_000).toLocaleString()}만원`;
}

function BidPanel({ item, onChanged }: { item: IRentalListing; onChanged: () => void }) {
  const [bids, setBids] = useState<IRentalBid[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<number | null>(null);

  const fetchBids = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/v1/admin/rental-listings/${item.id}/bids`, { headers: INTERNAL_HEADERS });
      setBids(res.ok ? await res.json() : []);
    } catch {
      message.error('입찰 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  useEffect(() => { fetchBids(); }, [fetchBids]);

  const handleSelectWinner = (bid: IRentalBid) => {
    Modal.confirm({
      title: '승계자 확정',
      content: `${bid.bidderName} (지원금 ${fmtWon(bid.requestedSubsidy)})을(를) 승계자로 확정하시겠습니까?`,
      okText: '확정',
      cancelText: '취소',
      onOk: async () => {
        setSelectingId(bid.id);
        try {
          const res = await fetch(`${CAVIOR_BASE}/api/v1/admin/rental-bids/${bid.id}/select-winner`, {
            method: 'PATCH', headers: INTERNAL_HEADERS,
          });
          if (!res.ok) throw new Error();
          message.success('승계자가 확정되었습니다.');
          onChanged();
          fetchBids();
        } catch {
          message.error('확정에 실패했습니다.');
        } finally {
          setSelectingId(null);
        }
      },
    });
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <p className="text-xs font-bold text-gray-400 mb-2">지원금 낮은 순 — 낮을수록 차주에게 유리 ({bids.length}건)</p>
      {loading ? (
        <p className="text-sm text-gray-400 py-4 text-center">불러오는 중…</p>
      ) : bids.length === 0 ? (
        <p className="text-sm text-gray-300 py-4 text-center">아직 입찰이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {bids.map((bid, i) => (
            <div key={bid.id} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2.5">
              <div>
                <p className="font-bold text-sm">
                  {i === 0 && <span className="mr-1.5 text-[10px] font-black text-green-600 bg-green-50 px-1.5 py-0.5 rounded">최저</span>}
                  {bid.bidderName}
                  {bid.bidderContact && <span className="text-gray-300 ml-1.5 font-normal">{bid.bidderContact}</span>}
                </p>
                <p className="text-xs text-gray-400">{dayjs(bid.createdAt).format('YYYY-MM-DD HH:mm')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-black text-violet-600">{fmtWon(bid.requestedSubsidy)}</span>
                <Button size="small" type="primary" disabled={item.status !== 'active'} loading={selectingId === bid.id} onClick={() => handleSelectWinner(bid)}>
                  확정
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const RentalList = () => {
  const [items, setItems] = useState<IRentalListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<IRentalListing | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [bidsItem, setBidsItem] = useState<IRentalListing | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/v1/admin/rental-listings`, { headers: INTERNAL_HEADERS });
      setItems(res.ok ? await res.json() : []);
    } catch {
      message.error('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditingItem(null);
    form.resetFields();
    setEditModal(true);
  };

  const openEdit = (item: IRentalListing) => {
    setEditingItem(item);
    form.setFieldsValue(item);
    setEditModal(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const url = editingItem
        ? `${CAVIOR_BASE}/api/v1/admin/rental-listings?id=${editingItem.id}`
        : `${CAVIOR_BASE}/api/v1/admin/rental-listings`;
      const res = await fetch(url, {
        method: editingItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error();
      message.success(editingItem ? '수정되었습니다.' : '등록되었습니다.');
      setEditModal(false);
      fetchData();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item: IRentalListing) => {
    Modal.confirm({
      title: '매물 삭제',
      content: `"${item.titleKo}" 을(를) 삭제하시겠습니까?`,
      okText: '삭제', okType: 'danger', cancelText: '취소',
      onOk: async () => {
        await fetch(`${CAVIOR_BASE}/api/v1/admin/rental-listings?id=${item.id}`, { method: 'DELETE', headers: INTERNAL_HEADERS });
        message.success('삭제되었습니다.');
        fetchData();
      },
    });
  };

  const copyOwnerLink = (item: IRentalListing) => {
    if (!item.ownerAccessToken) { message.warning('링크가 아직 없습니다.'); return; }
    const url = `https://carvior.store/my-rental/${item.ownerAccessToken}`;
    navigator.clipboard.writeText(url);
    message.success('차주용 링크가 복사되었습니다. (공개 미연결 베타 페이지)');
  };

  const columns: ColumnsType<IRentalListing> = [
    { title: '차량번호', dataIndex: 'carNumber', render: (v: string) => <span className="font-bold">{v}</span> },
    { title: '차량명', dataIndex: 'titleKo' },
    { title: '렌트사', dataIndex: 'rentalCompany', render: (v?: string) => v ?? <span className="text-gray-300">-</span> },
    { title: '월 납입금', dataIndex: 'monthlyPayment', render: (v?: number) => fmtWon(v) },
    {
      title: '잔여개월', key: 'months',
      render: (_: any, r: IRentalListing) => r.remainingMonths ? `${r.remainingMonths}/${r.totalMonths ?? '-'}개월` : '-',
    },
    { title: '최대 지원금', dataIndex: 'maxSubsidy', render: (v?: number) => fmtWon(v) },
    {
      title: '상태', dataIndex: 'status',
      render: (v: string) => { const sc = STATUS_CONFIG[v] ?? { color: 'default', text: v }; return <Tag color={sc.color}>{sc.text}</Tag>; },
    },
    { title: '등록일', dataIndex: 'registeredAt', render: (v: string) => dayjs(v).format('YYYY-MM-DD') },
    {
      title: '액션', key: 'action', align: 'right', width: 260,
      render: (_: any, item: IRentalListing) => (
        <div className="flex items-center gap-2 justify-end">
          <Button size="small" icon={<Gavel size={13} />} onClick={() => setBidsItem(bidsItem?.id === item.id ? null : item)}>
            입찰현황
          </Button>
          <Button size="small" icon={<Copy size={13} />} onClick={() => copyOwnerLink(item)}>차주링크</Button>
          <Button size="small" icon={<Edit size={13} />} onClick={() => openEdit(item)} />
          <Button size="small" danger icon={<Trash2 size={13} />} onClick={() => handleDelete(item)} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 text-xs text-amber-700 font-semibold">
        ⚠️ 베타 기능입니다 — 고객용 페이지는 아직 사이트에 공개 링크가 걸려있지 않고, 관리자가 이 화면에서 매물을 등록/관리하고 "차주링크"로 개별 안내하는 방식입니다.
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <Statistic title="전체 매물" value={items.length} loading={loading} />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <Statistic title="승계 진행중" value={items.filter(i => i.status === 'active').length} loading={loading} valueStyle={{ color: '#16a34a' }} />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <Statistic title="승계 확정/완료" value={items.filter(i => i.status === 'matched' || i.status === 'completed').length} loading={loading} valueStyle={{ color: '#1677ff' }} />
        </div>
      </div>

      <DefaultTableBtn className="justify-between mb-4">
        <div />
        <div className="flex gap-2">
          <Button icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>새로고침</Button>
          <Button type="primary" onClick={openCreate}>+ 매물 등록</Button>
        </div>
      </DefaultTableBtn>

      <DefaultTable<IRentalListing>
        columns={columns}
        dataSource={items}
        loading={loading}
        rowKey="id"
        expandable={{
          expandedRowKeys: bidsItem ? [bidsItem.id] : [],
          expandedRowRender: (item) => <BidPanel item={item} onChanged={fetchData} />,
          showExpandColumn: false,
        }}
      />

      <Modal
        title={editingItem ? `매물 수정 — ${editingItem.titleKo}` : '렌트 승계 매물 등록'}
        open={editModal}
        onOk={handleSave}
        onCancel={() => setEditModal(false)}
        confirmLoading={saving}
        okText="저장"
        cancelText="취소"
        width={720}
      >
        <Form form={form} layout="vertical" size="middle">
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item label="차량번호" name="carNumber" rules={[{ required: true }]}>
              <Input placeholder="예: 27버2089" />
            </Form.Item>
            <Form.Item label="차량명" name="titleKo" rules={[{ required: true }]}>
              <Input placeholder="예: EV3 롱레인지 GT라인" />
            </Form.Item>
            <Form.Item label="연식" name="year">
              <InputNumber className="w-full" />
            </Form.Item>
            <Form.Item label="주행거리 (km)" name="mileage">
              <InputNumber className="w-full" formatter={v => v ? `${Number(v).toLocaleString()}` : ''} />
            </Form.Item>
            <Form.Item label="연료" name="fuel">
              <Select options={['가솔린','디젤','하이브리드','LPG','전기'].map(o => ({ value: o, label: o }))} />
            </Form.Item>
            <Form.Item label="렌트사" name="rentalCompany">
              <Input placeholder="예: 롯데렌터카" />
            </Form.Item>
            <Form.Item label="월 납입금 (원)" name="monthlyPayment" rules={[{ required: true }]}>
              <InputNumber className="w-full" formatter={v => v ? `${Number(v).toLocaleString()}` : ''} />
            </Form.Item>
            <Form.Item label="총 인수 비용 (원)" name="totalTakeoverCost">
              <InputNumber className="w-full" formatter={v => v ? `${Number(v).toLocaleString()}` : ''} />
            </Form.Item>
            <Form.Item label="잔여 개월수" name="remainingMonths" rules={[{ required: true }]}>
              <InputNumber className="w-full" />
            </Form.Item>
            <Form.Item label="총 계약 개월수" name="totalMonths">
              <InputNumber className="w-full" />
            </Form.Item>
            <Form.Item label="승계 후 총 납입 예정액 (원)" name="totalRemainingPayment">
              <InputNumber className="w-full" formatter={v => v ? `${Number(v).toLocaleString()}` : ''} />
            </Form.Item>
            <Form.Item label="최대 승계지원금 (원, 참고용)" name="maxSubsidy">
              <InputNumber className="w-full" formatter={v => v ? `${Number(v).toLocaleString()}` : ''} />
            </Form.Item>
            <Form.Item label="만기 후 반납 비용 (원)" name="returnFeeAtEnd">
              <InputNumber className="w-full" formatter={v => v ? `${Number(v).toLocaleString()}` : ''} />
            </Form.Item>
            <Form.Item label="상태" name="status">
              <Select options={[
                { value: 'active', label: '승계 진행중' },
                { value: 'matched', label: '승계자 확정' },
                { value: 'completed', label: '승계 완료' },
                { value: 'hidden', label: '숨김' },
              ]} />
            </Form.Item>
            <Form.Item label="차주 이름" name="sellerName">
              <Input />
            </Form.Item>
            <Form.Item label="차주 연락처" name="sellerContact">
              <Input placeholder="010-0000-0000" />
            </Form.Item>
            <Form.Item label="차량 설명" name="description" className="col-span-2">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item label="보험 이력 메모" name="insuranceNote" className="col-span-2">
              <Input.TextArea rows={2} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default React.memo(RentalList);
