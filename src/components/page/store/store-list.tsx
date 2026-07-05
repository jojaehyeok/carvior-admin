'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import DefaultTableBtn from "@/components/shared/ui/default-table-btn";
import { Button, Checkbox, Form, Input, InputNumber, message, Modal, Select, Statistic, Tag } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Edit, Eye, RefreshCw, Trash2 } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

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
  hidePrice?: boolean;
  registeredAt: string;
}

interface IInspection {
  carModel?: string;
  mileage?: number;
  color?: string;
  images?: {
    exterior?: string[];
    interior?: string[];
    engine?: string[];
    wheel?: string[];
    undercarriage?: string[];
    damage?: string[];
    extra?: string[];
    dashboard?: string[];
    registration?: string[];
    vin?: string[];
  };
  inspectionDetails?: { warningDesc?: string; leakDesc?: string; optionsDesc?: string; driveDesc?: string };
  completedAt?: string;
}

const EXCHANGE_RATE = 1350;
const FUEL_OPTIONS = ['가솔린', '디젤', '하이브리드', 'LPG', '전기'];
const TRANS_OPTIONS = ['자동', '수동'];
const CATEGORY_OPTIONS = ['SUV', '세단', '해치백', '경차', '소형차', '준중형', '중형', '대형', 'RV', '밴'];

const STATUS_CONFIG: Record<string, { color: string; text: string }> = {
  active: { color: 'green',   text: '판매중'   },
  sold:   { color: 'default', text: '거래완료' },
  hidden: { color: 'orange',  text: '숨김'     },
};

function fmtKRW(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  return `${Math.round(n / 10_000)}만원`;
}

const StoreList = () => {
  const [bookings,    setBookings]    = useState<IBooking[]>([]);
  const [storeItems,  setStoreItems]  = useState<IStoreItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<'unregistered' | 'registered'>('unregistered');
  const [search,      setSearch]      = useState('');

  // 등록 모달
  const [registerModal,    setRegisterModal]    = useState(false);
  const [selectedBooking,  setSelectedBooking]  = useState<IBooking | null>(null);
  const [inspection,       setInspection]       = useState<IInspection | null>(null);
  const [loadingInspection, setLoadingInspection] = useState(false);
  const [registering,      setRegistering]      = useState(false);
  const [registerForm]  = Form.useForm();

  // 수정 모달
  const [editModal,    setEditModal]    = useState(false);
  const [editingItem,  setEditingItem]  = useState<IStoreItem | null>(null);
  const [updating,     setUpdating]     = useState(false);
  const [editForm]  = Form.useForm();

  // ── fetch ──────────────────────────────────────────────────────
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
    if (activeTab === 'registered'   && !isReg) return false;
    if (search) {
      const q = search.toLowerCase();
      return b.carNumber?.toLowerCase().includes(q)
          || (b.carModel ?? '').toLowerCase().includes(q)
          || b.carOwner?.toLowerCase().includes(q);
    }
    return true;
  });

  // ── CREATE: 등록 ───────────────────────────────────────────────
  const openRegisterModal = async (booking: IBooking) => {
    setSelectedBooking(booking);
    setInspection(null);
    registerForm.resetFields();
    registerForm.setFieldsValue({
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
        registerForm.setFieldsValue({
          titleKo: data.carModel ?? booking.carModel ?? '',
          mileage: data.mileage,
          color:   data.color,
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
      const values = await registerForm.validateFields();
      if (!values.priceKRW) { message.warning('판매가를 입력해주세요.'); return; }
      setRegistering(true);

      const imgs = inspection?.images ?? {};

      // 블러 처리할 카테고리 (자동차등록증 제외)
      const rawPhotos = {
        exterior:      imgs.exterior      ?? [] as string[],
        interior:      imgs.interior      ?? [] as string[],
        engine:        imgs.engine        ?? [] as string[],
        wheel:         imgs.wheel         ?? [] as string[],
        undercarriage: imgs.undercarriage ?? [] as string[],
        damage:        imgs.damage        ?? [] as string[],
        extra:         imgs.extra         ?? [] as string[],
        dashboard:     imgs.dashboard     ?? [] as string[],
      };

      const categoryOrder = Object.keys(rawPhotos) as (keyof typeof rawPhotos)[];
      const allUrls = categoryOrder.flatMap(k => rawPhotos[k]);

      let blurredUrls = allUrls;
      if (allUrls.length > 0) {
        message.loading({ content: `사진 블러 처리 중… (${allUrls.length}장)`, key: 'blur', duration: 0 });
        try {
          const blurRes = await fetch(`${CAVIOR_BASE}/api/v1/admin/blur/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls: allUrls }),
          });
          if (blurRes.ok) {
            const data = await blurRes.json();
            blurredUrls = data.urls ?? allUrls;
          }
        } catch {
          console.warn('[Blur] 블러 처리 실패 — 원본 사진 사용');
        }
        message.destroy('blur');
      }

      // 블러 URL을 카테고리별로 재분류
      let cursor = 0;
      const blurredPhotos = {} as typeof rawPhotos;
      for (const k of categoryOrder) {
        const len = rawPhotos[k].length;
        blurredPhotos[k] = blurredUrls.slice(cursor, cursor + len) as string[];
        cursor += len;
      }

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
        hidePrice: false,
        photos: blurredPhotos,
        specs: [
          { label: 'Year',         value: String(values.year) },
          { label: 'Mileage',      value: `${(values.mileage || 0).toLocaleString()} KM` },
          { label: 'Fuel',         value: values.fuel },
          { label: 'Transmission', value: values.transmission },
          { label: 'Color',        value: values.colorKo || values.color || '' },
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
      if (e?.errorFields) return;
      message.error('등록 중 오류 발생');
    } finally {
      setRegistering(false);
    }
  };

  // ── UPDATE: 수정 ───────────────────────────────────────────────
  const openEditModal = (item: IStoreItem) => {
    setEditingItem(item);
    editForm.setFieldsValue({
      titleKo:      item.titleKo,
      titleEn:      item.titleEn,
      trim:         item.trim,
      year:         item.year,
      mileage:      item.mileage,
      fuel:         item.fuel,
      displacement: item.displacement,
      transmission: item.transmission,
      colorKo:      item.colorKo,
      category:     item.category,
      region:       item.region,
      priceKRW:     item.priceKRW,
      accident:     item.accident,
      adminMemo:    item.adminMemo,
      status:       item.status,
      hidePrice:    item.hidePrice ?? false,
    });
    setEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editingItem) return;
    try {
      const values = await editForm.validateFields();
      setUpdating(true);
      const patch = {
        ...values,
        priceUSD: Math.round((values.priceKRW || 0) / EXCHANGE_RATE),
      };
      const res = await fetch(`${CAVIOR_BASE}/api/admin/store-items?id=${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) { message.error('수정 실패'); return; }
      message.success('수정되었습니다.');
      setEditModal(false);
      fetchData();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('수정 중 오류 발생');
    } finally {
      setUpdating(false);
    }
  };

  // ── DELETE: 등록 취소 ──────────────────────────────────────────
  const handleDelete = (id: string, title: string) => {
    Modal.confirm({
      title: '등록 취소',
      content: `"${title}" 을(를) 스토어에서 삭제하시겠습니까?`,
      okText: '삭제', okType: 'danger', cancelText: '취소',
      onOk: async () => {
        await fetch(`${CAVIOR_BASE}/api/admin/store-items?id=${id}`, { method: 'DELETE' });
        setStoreItems(prev => prev.filter(i => i.id !== id));
        message.success('등록이 취소되었습니다.');
      },
    });
  };

  // ── 테이블 컬럼 ────────────────────────────────────────────────
  const unregColumns: ColumnsType<IBooking> = [
    {
      title: '예약 ID', dataIndex: 'id', width: 90,
      render: (v: number) => <span className="font-mono text-blue-600">#{v}</span>,
    },
    { title: '차량번호', dataIndex: 'carNumber', render: (v: string) => <span className="font-bold">{v}</span> },
    { title: '차종',     dataIndex: 'carModel',  render: (v?: string) => v ?? <span className="text-gray-300">-</span> },
    { title: '차주',     dataIndex: 'carOwner' },
    { title: '진단사',   dataIndex: 'assignedDriverName', render: (v?: string) => v ?? <span className="text-gray-300">-</span> },
    {
      title: '완료일', key: 'date',
      render: (_: any, r: IBooking) => dayjs(r.completedAt ?? r.updatedAt).format('YYYY-MM-DD'),
    },
    {
      title: '지역', dataIndex: 'address',
      render: (v: string) => v?.split(' ')[0] ?? '-',
    },
    {
      title: '액션', key: 'action', align: 'right',
      render: (_: any, record: IBooking) => (
        <Button type="primary" size="small" onClick={() => openRegisterModal(record)}>
          스토어 등록
        </Button>
      ),
    },
  ];

  const regColumns: ColumnsType<IStoreItem> = [
    {
      title: '차량번호', dataIndex: 'carNumber',
      render: (v: string) => <span className="font-bold">{v}</span>,
    },
    { title: '차량명', dataIndex: 'titleKo' },
    {
      title: '판매가', key: 'price',
      render: (_: any, item: IStoreItem) => {
        if (item.hidePrice || item.status === 'sold') return <span className="text-gray-400 text-xs">가격 미표시</span>;
        if (!item.priceKRW) return <span className="text-gray-300 text-xs">-</span>;
        return <span className="font-bold text-green-600">{fmtKRW(item.priceKRW)}</span>;
      },
    },
    {
      title: '상태', dataIndex: 'status',
      render: (v: string) => {
        const sc = STATUS_CONFIG[v] ?? { color: 'default', text: v };
        return <Tag color={sc.color}>{sc.text}</Tag>;
      },
    },
    {
      title: '등록일', dataIndex: 'registeredAt',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: '액션', key: 'action', align: 'right', width: 180,
      render: (_: any, item: IStoreItem) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            size="small"
            icon={<Eye size={13} />}
            onClick={() => window.open(`https://carvior.store/buy/${item.id}`, '_blank')}
          >
            보기
          </Button>
          <Button
            size="small"
            icon={<Edit size={13} />}
            onClick={() => openEditModal(item)}
          >
            수정
          </Button>
          <Button
            size="small"
            danger
            icon={<Trash2 size={13} />}
            onClick={() => handleDelete(item.id, item.titleKo)}
          >
            취소
          </Button>
        </div>
      ),
    },
  ];

  // ── 공통 폼 필드 ───────────────────────────────────────────────
  const ItemFormFields = () => (
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
        <Checkbox>사고 이력 있음</Checkbox>
      </Form.Item>
      <Form.Item label="판매가 (원)" name="priceKRW" rules={[{ required: true }]} className="col-span-2">
        <InputNumber
          className="w-full"
          placeholder="예: 36900000"
          formatter={v => v ? `${Number(v).toLocaleString()}` : ''}
        />
      </Form.Item>
      <Form.Item label="어드민 메모" name="adminMemo" className="col-span-2">
        <Input.TextArea rows={2} placeholder="내부 참고 메모 (외부 미노출)" />
      </Form.Item>
    </div>
  );

  // ── render ─────────────────────────────────────────────────────
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
          <Statistic
            title="미등록 매물"
            value={Math.max(0, bookings.length - storeItems.length)}
            loading={loading}
            valueStyle={{ color: '#d97706' }}
          />
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

      {activeTab === 'unregistered' ? (
        <DefaultTable<IBooking>
          columns={unregColumns}
          dataSource={filtered}
          loading={loading}
          rowKey="id"
        />
      ) : (
        <DefaultTable<IStoreItem>
          columns={regColumns as any}
          dataSource={storeItems}
          loading={loading}
          rowKey="id"
        />
      )}

      {/* ── 등록 모달 (CREATE) ── */}
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
        ) : inspection?.images?.exterior?.length ? (
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">진단 사진 (외관)</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {inspection.images.exterior.slice(0, 8).map((url: string, i: number) => (
                <img key={i} src={url} alt="" className="w-24 h-16 object-cover rounded-lg border flex-shrink-0" />
              ))}
            </div>
          </div>
        ) : null}
        <Form form={registerForm} layout="vertical" size="middle">
          <ItemFormFields />
          {inspection?.inspectionDetails && (
            <div className="bg-gray-50 rounded-lg p-4 mt-2 grid grid-cols-2 gap-3 text-sm">
              {Object.entries({
                '경고등': inspection.inspectionDetails.warningDesc,
                '누유':   inspection.inspectionDetails.leakDesc,
                '옵션':   inspection.inspectionDetails.optionsDesc,
                '주행':   inspection.inspectionDetails.driveDesc,
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

      {/* ── 수정 모달 (UPDATE) ── */}
      <Modal
        title={`매물 수정 — ${editingItem?.titleKo}`}
        open={editModal}
        onOk={handleUpdate}
        onCancel={() => setEditModal(false)}
        confirmLoading={updating}
        okText="저장"
        cancelText="취소"
        width={680}
      >
        <Form form={editForm} layout="vertical" size="middle">
          {/* 상태 + 가격 미표시 */}
          <div className="flex gap-4 mb-2">
            <Form.Item label="판매 상태" name="status" className="flex-1 mb-0">
              <Select
                options={[
                  { value: 'active', label: '판매중' },
                  { value: 'sold',   label: '거래완료' },
                  { value: 'hidden', label: '숨김' },
                ]}
              />
            </Form.Item>
            <Form.Item label="가격 미표시" name="hidePrice" valuePropName="checked" className="mb-0 pt-7">
              <Checkbox>거래완료 시 가격 숨기기</Checkbox>
            </Form.Item>
          </div>
          <div className="border-b border-gray-100 mb-4" />
          <ItemFormFields />
        </Form>
      </Modal>
    </div>
  );
};

export default React.memo(StoreList);
