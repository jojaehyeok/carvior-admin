'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import DefaultTableBtn from "@/components/shared/ui/default-table-btn";
import { Button, Checkbox, Form, Input, InputNumber, message, Modal, Select, Statistic, Tag } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Edit, Eye, RefreshCw, Trash2 } from "lucide-react";
import { useRouter } from "next/router";
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
  status: 'active' | 'sold' | 'hidden' | 'pending';
  hidePrice?: boolean;
  registeredAt: string;
  photos?: Record<string, string[]>;
}


const EXCHANGE_RATE = 1350;
const FUEL_OPTIONS = ['가솔린', '디젤', '하이브리드', 'LPG', '전기'];
const TRANS_OPTIONS = ['자동', '수동'];
const CATEGORY_OPTIONS = ['SUV', '세단', '해치백', '경차', '소형차', '준중형', '중형', '대형', 'RV', '밴'];

const STATUS_CONFIG: Record<string, { color: string; text: string }> = {
  active:  { color: 'green',   text: '판매중'     },
  sold:    { color: 'default', text: '거래완료'   },
  hidden:  { color: 'orange',  text: '숨김'       },
  pending: { color: 'blue',    text: '입금확인중' },
};

function fmtKRW(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  return `${Math.round(n / 10_000)}만원`;
}

const StoreList = () => {
  const router = useRouter();
  const [bookings,    setBookings]    = useState<IBooking[]>([]);
  const [storeItems,  setStoreItems]  = useState<IStoreItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<'unregistered' | 'registered' | 'selfregister'>('unregistered');
  const [search,      setSearch]      = useState('');

  // 수정 모달
  const [editModal,    setEditModal]    = useState(false);
  const [editingItem,  setEditingItem]  = useState<IStoreItem | null>(null);
  const [updating,     setUpdating]     = useState(false);
  const [editForm]  = Form.useForm();

  // 직접 등록 모달
  const [blurringId,     setBlurringId]     = useState<string | null>(null);
  const [directModal,    setDirectModal]    = useState(false);
  const [directForm]  = Form.useForm();
  const [directing,      setDirecting]      = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({
    exterior: '', interior: '', engine: '', extra: '',
  });

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

  // 미등록: 아직 storeItem 없는 완료된 예약
  const registeredIds = new Set(storeItems.map(i => i.bookingId));
  const filtered = bookings.filter(b => {
    if (registeredIds.has(b.id)) return false;
    if (search) {
      const q = search.toLowerCase();
      return b.carNumber?.toLowerCase().includes(q)
          || (b.carModel ?? '').toLowerCase().includes(q)
          || b.carOwner?.toLowerCase().includes(q);
    }
    return true;
  });

  // 셀프등록: 고객 직접 등록 중 아직 입금 미확인 (pending)
  const TIMESTAMP_THRESHOLD = 10_000_000;
  const selfRegistered = storeItems.filter(i => i.bookingId > TIMESTAMP_THRESHOLD && i.status === 'pending');

  // 등록됨: 모든 스토어 매물 (출처 무관, 검색 적용)
  const registeredItems = storeItems.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (i.carNumber ?? '').toLowerCase().includes(q)
        || (i.titleKo ?? '').toLowerCase().includes(q);
  });

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

  // ── DIRECT CREATE: 직접 등록 ──────────────────────────────────
  const handleDirectRegister = async () => {
    try {
      const values = await directForm.validateFields();
      if (!values.priceKRW) { message.warning('판매가를 입력해주세요.'); return; }
      setDirecting(true);

      // 사진 URL 파싱 (줄바꿈 or 쉼표 구분)
      const parseUrls = (raw: string) =>
        raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

      const photos: Record<string, string[]> = {};
      for (const [cat, raw] of Object.entries(photoUrls)) {
        const urls = parseUrls(raw);
        if (urls.length) photos[cat] = urls;
      }

      const body = {
        bookingId: Date.now(),
        carNumber: values.carNumber ?? '',
        ...values,
        priceUSD: Math.round(values.priceKRW / EXCHANGE_RATE),
        hasReport: values.hasReport ?? false,
        location: 'Korea',
        doors: 5, seats: 5,
        inspectedAt: new Date().toISOString().split('T')[0],
        status: 'active',
        hidePrice: false,
        photos,
        specs: [
          { label: 'Year',         value: String(values.year ?? '') },
          { label: 'Mileage',      value: values.mileage ? `${Number(values.mileage).toLocaleString()} KM` : '' },
          { label: 'Fuel',         value: values.fuel ?? '' },
          { label: 'Transmission', value: values.transmission ?? '' },
          { label: 'Color',        value: values.colorKo ?? '' },
          { label: 'Displacement', value: values.displacement ?? '' },
        ].filter(s => s.value),
        options: [],
      };

      const res = await fetch(`${CAVIOR_BASE}/api/admin/store-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); message.error(err.error ?? '등록 실패'); return; }
      message.success('직접 등록 완료! 스토어에 노출됩니다.');
      setDirectModal(false);
      directForm.resetFields();
      setPhotoUrls({ exterior: '', interior: '', engine: '', extra: '' });
      fetchData();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('등록 중 오류 발생');
    } finally {
      setDirecting(false);
    }
  };

  // ── BLUR: 번호판·얼굴 수동 블러 ──────────────────────────────────
  const handleBlur = async (item: IStoreItem) => {
    if (!item.photos || typeof item.photos !== 'object') {
      message.warning('사진 데이터가 없습니다.');
      return;
    }
    setBlurringId(item.id);
    try {
      const photos = item.photos as Record<string, string[]>;
      const categoryOrder = Object.keys(photos);
      const allUrls = categoryOrder.flatMap(k => photos[k] ?? []);
      if (!allUrls.length) { message.warning('처리할 사진이 없습니다.'); return; }

      const categoryMap = categoryOrder.map(k => ({ category: k, count: (photos[k] ?? []).length }));

      message.loading({ content: `번호판 blur 처리 시작… (${allUrls.length}장, 백그라운드 처리)`, key: 'blur', duration: 3 });
      const res = await fetch(`${CAVIOR_BASE}/api/v1/admin/blur/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: allUrls, storeItemId: item.id, categoryMap }),
      });
      if (!res.ok) throw new Error(`blur 응답 오류: ${res.status}`);
      message.success('블러 처리가 백그라운드에서 진행 중입니다. 1~2분 후 새로고침하세요.');
    } catch (e: any) {
      message.error(`blur 실패: ${e?.message ?? '알 수 없는 오류'}`);
    } finally {
      setBlurringId(null);
      message.destroy('blur');
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
        <Button
          type="primary"
          size="small"
          onClick={() => router.push(`/store/register?bookingId=${record.id}`)}
        >
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
            onClick={() => window.open(`https://carvior.store/buy/${item.id}`, 'preview', 'width=1200,height=850,scrollbars=yes,resizable=yes')}
          >
            보기
          </Button>
          <Button
            size="small"
            icon={<Edit size={13} />}
            onClick={() => router.push(`/store/register?storeItemId=${item.id}`)}
          >
            수정
          </Button>
          <Button
            size="small"
            loading={blurringId === item.id}
            onClick={() => handleBlur(item)}
          >
            번호판
          </Button>
          {item.status !== 'pending' && (
            <Button
              size="small"
              onClick={async () => {
                await fetch(`${CAVIOR_BASE}/api/admin/store-items?id=${item.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'pending' }),
                });
                message.success('pending으로 복구되었습니다.');
                fetchData();
              }}
            >
              pending
            </Button>
          )}
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
            title="셀프등록 (입금확인 필요)"
            value={selfRegistered.filter(i => i.status === 'pending').length}
            loading={loading}
            valueStyle={{ color: '#1677ff' }}
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
          <Button
            type={activeTab === 'selfregister' ? 'primary' : 'default'}
            onClick={() => setActiveTab('selfregister')}
            style={activeTab !== 'selfregister' && selfRegistered.filter(i => i.status === 'pending').length > 0 ? { borderColor: '#1677ff', color: '#1677ff' } : {}}
          >
            셀프등록 {selfRegistered.filter(i => i.status === 'pending').length > 0 && `(${selfRegistered.filter(i => i.status === 'pending').length})`}
          </Button>
          <Input
            placeholder="차량번호 / 차종 / 차주"
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ width: 220 }}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="primary"
            style={{ background: '#7c3aed' }}
            onClick={() => {
              directForm.resetFields();
              directForm.setFieldsValue({ fuel: '가솔린', transmission: '자동', category: 'SUV', region: '서울' });
              setPhotoUrls({ exterior: '', interior: '', engine: '', extra: '' });
              setDirectModal(true);
            }}
          >
            + 직접 등록
          </Button>
          <Button icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>새로고침</Button>
        </div>
      </DefaultTableBtn>

      {activeTab === 'unregistered' ? (
        <DefaultTable<IBooking>
          columns={unregColumns}
          dataSource={filtered}
          loading={loading}
          rowKey="id"
        />
      ) : activeTab === 'selfregister' ? (
        <DefaultTable<IStoreItem>
          columns={regColumns as any}
          dataSource={selfRegistered}
          loading={loading}
          rowKey="id"
        />
      ) : (
        <DefaultTable<IStoreItem>
          columns={regColumns as any}
          dataSource={registeredItems}
          loading={loading}
          rowKey="id"
        />
      )}

      {/* ── 수정 모달 (UPDATE) ── */}
      <Modal
        title={`매물 수정 — ${editingItem?.titleKo}`}
        open={editModal}
        onOk={handleUpdate}
        onCancel={() => setEditModal(false)}
        confirmLoading={updating}
        okText="저장"
        cancelText="취소"
        width={760}
        footer={(_, { OkBtn, CancelBtn }) => (
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {editingItem?.status === 'pending' && (
                <>
                  <Button
                    type="primary"
                    onClick={async () => {
                      await fetch(`${CAVIOR_BASE}/api/admin/store-items?id=${editingItem.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'active' }),
                      });
                      message.success('승인되었습니다. 스토어에 노출됩니다.');
                      setEditModal(false);
                      fetchData();
                    }}
                  >
                    ✅ 입금확인 후 승인
                  </Button>
                  <Button
                    danger
                    onClick={async () => {
                      await fetch(`${CAVIOR_BASE}/api/admin/store-items?id=${editingItem.id}`, {
                        method: 'DELETE',
                      });
                      message.success('거절 및 삭제 완료');
                      setEditModal(false);
                      fetchData();
                    }}
                  >
                    ❌ 거절 (삭제)
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <CancelBtn />
              <OkBtn />
            </div>
          </div>
        )}
      >
        {/* 셀프등록 사진 미리보기 */}
        {editingItem?.photos && Object.keys(editingItem.photos).length > 0 && (
          <div className="mb-4">
            {Object.entries(editingItem.photos as Record<string, string[]>).map(([cat, urls]) =>
              urls?.length ? (
                <div key={cat} className="mb-3">
                  <p className="text-xs text-gray-400 mb-1.5 font-bold uppercase">{cat}</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {urls.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" className="w-28 h-20 object-cover rounded-lg border flex-shrink-0 hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              ) : null
            )}
            <div className="border-b border-gray-100 mb-4" />
          </div>
        )}

        {/* adminMemo 표시 (셀프등록 연락처 등) */}
        {editingItem?.adminMemo && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 mb-4 text-xs text-blue-700">
            {editingItem.adminMemo}
          </div>
        )}

        <Form form={editForm} layout="vertical" size="middle">
          {/* 상태 + 가격 미표시 */}
          <div className="flex gap-4 mb-2">
            <Form.Item label="판매 상태" name="status" className="flex-1 mb-0">
              <Select
                options={[
                  { value: 'pending', label: '입금확인중' },
                  { value: 'active',  label: '판매중' },
                  { value: 'sold',    label: '거래완료' },
                  { value: 'hidden',  label: '숨김' },
                ]}
              />
            </Form.Item>
            <Form.Item label="가격 미표시" name="hidePrice" valuePropName="checked" className="mb-0 pt-7">
              <Checkbox>거래완료 시 가격 숨기기</Checkbox>
            </Form.Item>
          </div>
          <div className="border-b border-gray-100 mb-4" />
          {editingItem?.status === 'active' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700 font-semibold mb-4">
              ⚠️ 게시된 매물은 상태 변경만 가능합니다. 내용 수정이 필요하면 먼저 pending으로 되돌리세요.
            </div>
          ) : (
            <ItemFormFields />
          )}
        </Form>
      </Modal>
      {/* ── 직접 등록 모달 ── */}
      <Modal
        title="직접 등록 — S3 사진 URL 붙여넣기"
        open={directModal}
        onOk={handleDirectRegister}
        onCancel={() => setDirectModal(false)}
        confirmLoading={directing}
        okText="스토어에 등록"
        cancelText="취소"
        width={740}
      >
        <Form form={directForm} layout="vertical" size="middle">
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item label="차량번호" name="carNumber">
              <Input placeholder="예: 12가3456" />
            </Form.Item>
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
              <InputNumber className="w-full" placeholder="2024" />
            </Form.Item>
            <Form.Item label="주행거리 (km)" name="mileage">
              <InputNumber className="w-full" formatter={v => v ? `${Number(v).toLocaleString()}` : ''} />
            </Form.Item>
            <Form.Item label="연료" name="fuel">
              <Select options={FUEL_OPTIONS.map(o => ({ value: o, label: o }))} />
            </Form.Item>
            <Form.Item label="변속기" name="transmission">
              <Select options={TRANS_OPTIONS.map(o => ({ value: o, label: o }))} />
            </Form.Item>
            <Form.Item label="배기량" name="displacement">
              <Input placeholder="예: 2,497cc" />
            </Form.Item>
            <Form.Item label="색상" name="colorKo">
              <Input placeholder="예: 스노우 화이트 펄" />
            </Form.Item>
            <Form.Item label="카테고리" name="category">
              <Select options={CATEGORY_OPTIONS.map(o => ({ value: o, label: o }))} />
            </Form.Item>
            <Form.Item label="지역" name="region">
              <Input placeholder="예: 경기도" />
            </Form.Item>
            <Form.Item label="판매가 (원)" name="priceKRW" rules={[{ required: true }]} className="col-span-2">
              <InputNumber
                className="w-full"
                placeholder="예: 36900000"
                formatter={v => v ? `${Number(v).toLocaleString()}` : ''}
              />
            </Form.Item>
            <Form.Item label="어드민 메모" name="adminMemo" className="col-span-2">
              <Input.TextArea rows={2} placeholder="내부 참고 메모" />
            </Form.Item>
          </div>

          <div className="border-t border-gray-100 pt-4 mt-2">
            <p className="text-xs font-bold text-gray-500 mb-3">📷 S3 사진 URL (줄바꿈 또는 쉼표로 여러 장 입력)</p>
            <div className="space-y-3">
              {[
                { key: 'exterior', label: '외관 사진 🚗' },
                { key: 'interior', label: '내관 사진 💺' },
                { key: 'engine',   label: '엔진 사진 🔧' },
                { key: 'extra',    label: '기타 사진 📷' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <Input.TextArea
                    rows={2}
                    placeholder={`https://carvior-bucket.s3.ap-northeast-2.amazonaws.com/...`}
                    value={photoUrls[key]}
                    onChange={e => setPhotoUrls(prev => ({ ...prev, [key]: e.target.value }))}
                    className="font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        </Form>
      </Modal>

    </div>
  );
};

export default React.memo(StoreList);
