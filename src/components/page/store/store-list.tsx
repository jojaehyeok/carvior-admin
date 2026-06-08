'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import DefaultTableBtn from "@/components/shared/ui/default-table-btn";
import { Button, Form, Input, InputNumber, message, Modal, Select, Statistic, Tag } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Eye, RefreshCw } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

// 프로덕션에서는 https://carvior.store, 개발에서는 localhost:3000
const CAVIOR_BASE = (process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://carvior.store/api/v1').replace('/api/v1', '');

interface IBooking {
  id: number;
  carNumber: string;
  carOwner: string;
  carModel?: string;
  address: string;
  preferredDateTime: string;
  assignedDriverName?: string;
  updatedAt?: string;
  completedAt?: string;
}

interface IStoreItem {
  id: string;
  bookingId: number;
  titleKo: string;
  titleEn?: string;
  trim?: string;
  year?: number;
  mileage?: number;
  fuel?: string;
  displacement?: string;
  transmission?: string;
  color?: string;
  colorKo?: string;
  accident?: boolean;
  priceKRW: number;
  priceUSD?: number;
  category?: string;
  region?: string;
  adminMemo?: string;
  carNumber: string;
  status: 'active' | 'sold' | 'hidden';
  registeredAt: string;
}

interface IInspection {
  carModel?: string;
  mileage?: number;
  color?: string;
  photos?: { exterior?: string[]; interior?: string[] };
  inspectionDetails?: { warningDesc?: string; leakDesc?: string; optionsDesc?: string; driveDesc?: string };
  completedAt?: string;
}

const EXCHANGE_RATE = 1350;
const FUEL_OPTIONS = ['가솔린', '디젤', '하이브리드', 'LPG', '전기'];
const TRANS_OPTIONS = ['자동', '수동'];
const CATEGORY_OPTIONS = ['SUV', '세단', '해치백', '경차', '소형차', '준중형', '중형', '대형', 'RV', '밴'];

const STATUS_CONFIG: Record<string, { color: string; text: string }> = {
  active: { color: 'green', text: '판매중' },
  sold:   { color: 'default', text: '판매완료' },
  hidden: { color: 'orange', text: '숨김' },
};

function fmtKRW(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  return `${Math.round(n / 10_000)}만원`;
}

const StoreList = () => {
  const [bookings, setBookings] = useState<IBooking[]>([]);
  const [storeItems, setStoreItems] = useState<IStoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'unregistered' | 'registered'>('unregistered');
  const [search, setSearch] = useState('');

  // 등록 모달
  const [registerModal, setRegisterModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<IBooking | null>(null);
  const [inspection, setInspection] = useState<IInspection | null>(null);
  const [loadingInspection, setLoadingInspection] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [form] = Form.useForm();

  // 상태 변경
  const [statusModal, setStatusModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<IStoreItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        fetch(`${CAVIOR_BASE}/api/admin/bookings`),
        fetch(`${CAVIOR_BASE}/api/admin/store-items`),
      ]);
      setBookings(bRes.ok ? await bRes.json() : []);
      setStoreItems(sRes.ok ? await sRes.json() : []);
    } catch {
      message.error('데이터 로드 실패');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const registeredIds = new Set(storeItems.map(i => i.bookingId));

  const filtered = bookings.filter(b => {
    const isReg = registeredIds.has(b.id);
    if (activeTab === 'unregistered' && isReg) return false;
    if (activeTab === 'registered' && !isReg) return false;
    if (search) {
      const q = search.toLowerCase();
      return b.carNumber?.toLowerCase().includes(q) || (b.carModel ?? '').toLowerCase().includes(q) || b.carOwner?.toLowerCase().includes(q);
    }
    return true;
  });

  const openRegisterModal = async (booking: IBooking) => {
    setSelectedBooking(booking);
    setInspection(null);
    form.resetFields();
    form.setFieldsValue({
      titleKo: booking.carModel ?? '',
      year: new Date().getFullYear(),
      fuel: '가솔린',
      transmission: '자동',
      category: 'SUV',
      region: booking.address?.split(' ')[0] ?? '',
    });
    setRegisterModal(true);
    setLoadingInspection(true);
    try {
      const res = await fetch(`${CAVIOR_BASE}/api/admin/inspection?bookingId=${booking.id}`);
      if (res.ok) {
        const data: IInspection = await res.json();
        setInspection(data);
        form.setFieldsValue({
          titleKo: data.carModel ?? booking.carModel ?? '',
          mileage: data.mileage,
          color: data.color,
          colorKo: data.color,
        });
      }
    } finally {
      setLoadingInspection(false);
    }
  };

  const handleRegister = async () => {
    if (!selectedBooking) return;
    try {
      const values = await form.validateFields();
      if (!values.priceKRW) { message.warning('판매가를 입력해주세요.'); return; }
      setRegistering(true);
      const photos = inspection?.photos ?? {};
      const body = {
        bookingId: selectedBooking.id,
        carNumber: selectedBooking.carNumber,
        ...values,
        priceUSD: Math.round(values.priceKRW / EXCHANGE_RATE),
        hasReport: true,
        location: 'Korea',
        doors: 5, seats: 5,
        inspectedAt: inspection?.completedAt
          ? new Date(inspection.completedAt).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        status: 'active',
        photos: {
          exterior: photos.exterior ?? [],
          interior: photos.interior ?? [],
          engine: [], wheel: [], undercarriage: [], damage: [], extra: [],
        },
        specs: [
          { label: 'Year', value: String(values.year) },
          { label: 'Mileage', value: `${(values.mileage || 0).toLocaleString()} KM` },
          { label: 'Fuel', value: values.fuel },
          { label: 'Transmission', value: values.transmission },
          { label: 'Color', value: values.colorKo || values.color || '' },
          { label: 'Displacement', value: values.displacement || '' },
        ].filter(s => s.value),
        options: [],
      };
      const res = await fetch(`${CAVIOR_BASE}/api/admin/store-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); message.error(err.error ?? '등록 실패'); return; }
      message.success('스토어에 등록되었습니다.');
      setRegisterModal(false);
      fetchData();
    } catch (e: any) {
      if (e?.errorFields) return; // validation error
      message.error('등록 중 오류 발생');
    } finally {
      setRegistering(false);
    }
  };

  const handleStatusChange = async (id: string, status: IStoreItem['status']) => {
    await fetch(`${CAVIOR_BASE}/api/admin/store-items?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setStoreItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    message.success('상태가 변경되었습니다.');
    setStatusModal(false);
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '스토어에서 삭제',
      content: '정말 삭제하시겠습니까?',
      okText: '삭제', okType: 'danger', cancelText: '취소',
      onOk: async () => {
        await fetch(`${CAVIOR_BASE}/api/admin/store-items?id=${id}`, { method: 'DELETE' });
        setStoreItems(prev => prev.filter(i => i.id !== id));
        message.success('삭제되었습니다.');
        fetchData();
      },
    });
  };

  const unregColumns: ColumnsType<IBooking> = [
    {
      title: '예약 ID', dataIndex: 'id', width: 90,
      render: (v: number) => <span className="font-mono text-blue-600">#{v}</span>,
    },
    { title: '차량번호', dataIndex: 'carNumber', render: (v: string) => <span className="font-bold">{v}</span> },
    { title: '차종', dataIndex: 'carModel', render: (v?: string) => v ?? <span className="text-gray-300">-</span> },
    { title: '차주', dataIndex: 'carOwner' },
    { title: '진단사', dataIndex: 'assignedDriverName', render: (v?: string) => v ?? <span className="text-gray-300">-</span> },
    {
      title: '완료일', key: 'date',
      render: (_, r: IBooking) => dayjs(r.completedAt ?? r.updatedAt).format('YYYY-MM-DD'),
    },
    {
      title: '지역', dataIndex: 'address',
      render: (v: string) => v?.split(' ')[0] ?? '-',
    },
    {
      title: '액션', key: 'action', align: 'right',
      render: (_, record: IBooking) => (
        <Button type="primary" size="small" onClick={() => openRegisterModal(record)}>
          스토어 등록
        </Button>
      ),
    },
  ];

  const regColumns: ColumnsType<IBooking> = [
    {
      title: '예약 ID', dataIndex: 'id', width: 90,
      render: (v: number) => <span className="font-mono text-blue-600">#{v}</span>,
    },
    { title: '차량번호', dataIndex: 'carNumber', render: (v: string) => <span className="font-bold">{v}</span> },
    { title: '차종', dataIndex: 'carModel', render: (v?: string) => v ?? '-' },
    { title: '차주', dataIndex: 'carOwner' },
    {
      title: '판매가', key: 'price',
      render: (_, r: IBooking) => {
        const item = storeItems.find(i => i.bookingId === r.id);
        return item ? <span className="font-bold text-green-600">{fmtKRW(item.priceKRW)}</span> : '-';
      },
    },
    {
      title: '상태', key: 'status',
      render: (_, r: IBooking) => {
        const item = storeItems.find(i => i.bookingId === r.id);
        if (!item) return null;
        const sc = STATUS_CONFIG[item.status];
        return <Tag color={sc.color}>{sc.text}</Tag>;
      },
    },
    {
      title: '등록일', key: 'regDate',
      render: (_, r: IBooking) => {
        const item = storeItems.find(i => i.bookingId === r.id);
        return item ? dayjs(item.registeredAt).format('YYYY-MM-DD') : '-';
      },
    },
    {
      title: '액션', key: 'action', align: 'right',
      render: (_, r: IBooking) => {
        const item = storeItems.find(i => i.bookingId === r.id);
        if (!item) return null;
        return (
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="small"
              icon={<Eye size={14} />}
              onClick={() => { setSelectedItem(item); setStatusModal(true); }}
            >
              관리
            </Button>
            <a href={`https://carvior.store/buy/${r.id}`} target="_blank" rel="noopener noreferrer">
              <Button size="small" type="link">상세보기</Button>
            </a>
            <Button size="small" danger onClick={() => handleDelete(item.id)}>삭제</Button>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <Statistic title="완료된 예약" value={bookings.length} loading={loading} />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <Statistic title="스토어 등록" value={storeItems.length} loading={loading} valueStyle={{ color: '#16a34a' }} />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <Statistic title="미등록 매물" value={Math.max(0, bookings.length - storeItems.length)} loading={loading} valueStyle={{ color: '#d97706' }} />
        </div>
      </div>

      {/* 탭 + 검색 */}
      <DefaultTableBtn className="justify-between mb-4">
        <div className="flex gap-2">
          <Button
            type={activeTab === 'unregistered' ? 'primary' : 'default'}
            onClick={() => setActiveTab('unregistered')}
          >
            미등록
          </Button>
          <Button
            type={activeTab === 'registered' ? 'primary' : 'default'}
            onClick={() => setActiveTab('registered')}
          >
            등록됨
          </Button>
          <Input
            placeholder="차량번호 / 차종 / 차주"
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ width: 220 }}
          />
        </div>
        <Button icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>새로고침</Button>
      </DefaultTableBtn>

      <DefaultTable<IBooking>
        columns={activeTab === 'unregistered' ? unregColumns : regColumns}
        dataSource={filtered}
        loading={loading}
        rowKey="id"
      />

      {/* 스토어 등록 모달 */}
      <Modal
        title={`스토어 등록 — ${selectedBooking?.carNumber}`}
        open={registerModal}
        onOk={handleRegister}
        onCancel={() => setRegisterModal(false)}
        confirmLoading={registering}
        okText="스토어에 등록"
        cancelText="취소"
        width={680}
      >
        {loadingInspection ? (
          <p className="text-center py-6 text-gray-400">진단 데이터 불러오는 중…</p>
        ) : inspection?.photos?.exterior?.length ? (
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">진단 사진 (외관)</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {inspection.photos.exterior.slice(0, 8).map((url, i) => (
                <img key={i} src={url} alt="" className="w-24 h-16 object-cover rounded-lg border flex-shrink-0" />
              ))}
            </div>
          </div>
        ) : null}

        <Form form={form} layout="vertical" size="middle">
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item label="차량명 (한국어)" name="titleKo" rules={[{ required: true }]}>
              <Input placeholder="예: 기아 더 뉴 쏘렌토" />
            </Form.Item>
            <Form.Item label="차량명 (영어)" name="titleEn">
              <Input placeholder="예: Kia Sorento" />
            </Form.Item>
            <Form.Item label="트림" name="trim">
              <Input placeholder="예: Noblesse" />
            </Form.Item>
            <Form.Item label="연식" name="year">
              <InputNumber className="w-full" />
            </Form.Item>
            <Form.Item label="주행거리 (km)" name="mileage">
              <InputNumber className="w-full" formatter={v => v ? `${Number(v).toLocaleString()}` : ''} />
            </Form.Item>
            <Form.Item label="배기량" name="displacement">
              <Input placeholder="예: 2,497cc" />
            </Form.Item>
            <Form.Item label="연료" name="fuel">
              <Select options={FUEL_OPTIONS.map(o => ({ value: o, label: o }))} />
            </Form.Item>
            <Form.Item label="변속기" name="transmission">
              <Select options={TRANS_OPTIONS.map(o => ({ value: o, label: o }))} />
            </Form.Item>
            <Form.Item label="색상 (한국어)" name="colorKo">
              <Input placeholder="예: 스노우 화이트 펄" />
            </Form.Item>
            <Form.Item label="카테고리" name="category">
              <Select options={CATEGORY_OPTIONS.map(o => ({ value: o, label: o }))} />
            </Form.Item>
            <Form.Item label="지역" name="region">
              <Input placeholder="예: 경기도" />
            </Form.Item>
            <Form.Item label="사고 이력" name="accident" valuePropName="checked">
              <input type="checkbox" /> <span className="ml-1 text-sm text-gray-600">사고 이력 있음</span>
            </Form.Item>
            <Form.Item label="판매가 (원)" name="priceKRW" rules={[{ required: true }]} className="col-span-2">
              <InputNumber
                className="w-full"
                placeholder="예: 36900000"
                formatter={v => v ? `${Number(v).toLocaleString()}` : ''}
              />
            </Form.Item>
            <Form.Item label="어드민 메모 (내부용)" name="adminMemo" className="col-span-2">
              <Input.TextArea rows={2} placeholder="내부 참고 메모 (외부 미노출)" />
            </Form.Item>
          </div>

          {inspection?.inspectionDetails && (
            <div className="bg-gray-50 rounded-lg p-4 mt-2 grid grid-cols-2 gap-3 text-sm">
              {Object.entries({
                '경고등': inspection.inspectionDetails.warningDesc,
                '누유': inspection.inspectionDetails.leakDesc,
                '옵션': inspection.inspectionDetails.optionsDesc,
                '주행': inspection.inspectionDetails.driveDesc,
              }).filter(([, v]) => v).map(([k, v]) => (
                <div key={k}>
                  <span className="text-gray-400 text-xs">{k}</span>
                  <p className="text-gray-700 mt-0.5 text-xs line-clamp-2">{v}</p>
                </div>
              ))}
            </div>
          )}
        </Form>
      </Modal>

      {/* 상태 관리 모달 */}
      <Modal
        title={`매물 관리 — ${selectedItem?.titleKo}`}
        open={statusModal}
        onCancel={() => setStatusModal(false)}
        footer={[
          <Button key="close" onClick={() => setStatusModal(false)}>닫기</Button>,
        ]}
      >
        {selectedItem && (
          <div className="space-y-4 py-4">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p><span className="text-gray-400">차량번호</span> <span className="font-semibold ml-2">{selectedItem.carNumber}</span></p>
              <p className="mt-1"><span className="text-gray-400">판매가</span> <span className="font-bold text-green-600 ml-2">{fmtKRW(selectedItem.priceKRW)}</span></p>
              <p className="mt-1"><span className="text-gray-400">등록일</span> <span className="ml-2">{dayjs(selectedItem.registeredAt).format('YYYY-MM-DD')}</span></p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 mb-2">상태 변경</p>
              <div className="flex gap-2 flex-wrap">
                {(['active', 'sold', 'hidden'] as const).map(s => {
                  const sc = STATUS_CONFIG[s];
                  return (
                    <Button
                      key={s}
                      type={selectedItem.status === s ? 'primary' : 'default'}
                      size="small"
                      onClick={() => handleStatusChange(selectedItem.id, s)}
                    >
                      {sc.text}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default React.memo(StoreList);
