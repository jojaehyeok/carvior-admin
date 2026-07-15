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
const FUEL_OPTIONS = ['媛?붾┛', '?붿젮', '?섏씠釉뚮━??, 'LPG', '?꾧린'];
const TRANS_OPTIONS = ['?먮룞', '?섎룞'];
const CATEGORY_OPTIONS = ['SUV', '?몃떒', '?댁튂諛?, '寃쎌감', '?뚰삎李?, '以以묓삎', '以묓삎', '???, 'RV', '諛?];

const STATUS_CONFIG: Record<string, { color: string; text: string }> = {
  active:  { color: 'green',   text: '?먮ℓ以?     },
  sold:    { color: 'default', text: '嫄곕옒?꾨즺'   },
  hidden:  { color: 'orange',  text: '?④?'       },
  pending: { color: 'blue',    text: '?낃툑?뺤씤以? },
};

function fmtKRW(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}??;
  return `${Math.round(n / 10_000)}留뚯썝`;
}

const StoreList = () => {
  const router = useRouter();
  const [bookings,    setBookings]    = useState<IBooking[]>([]);
  const [storeItems,  setStoreItems]  = useState<IStoreItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<'unregistered' | 'registered' | 'selfregister'>('unregistered');
  const [search,      setSearch]      = useState('');

  // ?섏젙 紐⑤떖
  const [editModal,    setEditModal]    = useState(false);
  const [editingItem,  setEditingItem]  = useState<IStoreItem | null>(null);
  const [updating,     setUpdating]     = useState(false);
  const [editForm]  = Form.useForm();

  // 吏곸젒 ?깅줉 紐⑤떖
  const [blurringId,     setBlurringId]     = useState<string | null>(null);
  const [directModal,    setDirectModal]    = useState(false);
  const [directForm]  = Form.useForm();
  const [directing,      setDirecting]      = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({
    exterior: '', interior: '', engine: '', extra: '',
  });

  // ?? fetch ??????????????????????????????????????????????????????
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
      message.error('?곗씠??濡쒕뱶 ?ㅽ뙣');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 誘몃벑濡? ?꾩쭅 storeItem ?녿뒗 ?꾨즺???덉빟
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

  // ??꾨벑濡? 怨좉컼 吏곸젒 ?깅줉 以??꾩쭅 ?낃툑 誘명솗??(pending)
  const TIMESTAMP_THRESHOLD = 10_000_000;
  const selfRegistered = storeItems.filter(i => i.bookingId > TIMESTAMP_THRESHOLD && i.status === 'pending');

  // ?깅줉?? 紐⑤뱺 ?ㅽ넗??留ㅻЪ (異쒖쿂 臾닿?, 寃???곸슜)
  const registeredItems = storeItems.filter(i => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (i.carNumber ?? '').toLowerCase().includes(q)
        || (i.titleKo ?? '').toLowerCase().includes(q);
  });

  // ?? UPDATE: ?섏젙 ???????????????????????????????????????????????
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
      if (!res.ok) { message.error('?섏젙 ?ㅽ뙣'); return; }
      message.success('?섏젙?섏뿀?듬땲??');
      setEditModal(false);
      fetchData();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('?섏젙 以??ㅻ쪟 諛쒖깮');
    } finally {
      setUpdating(false);
    }
  };

  // ?? DIRECT CREATE: 吏곸젒 ?깅줉 ??????????????????????????????????
  const handleDirectRegister = async () => {
    try {
      const values = await directForm.validateFields();
      if (!values.priceKRW) { message.warning('?먮ℓ媛瑜??낅젰?댁＜?몄슂.'); return; }
      setDirecting(true);

      // ?ъ쭊 URL ?뚯떛 (以꾨컮轅?or ?쇳몴 援щ텇)
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
      if (!res.ok) { const err = await res.json(); message.error(err.error ?? '?깅줉 ?ㅽ뙣'); return; }
      message.success('吏곸젒 ?깅줉 ?꾨즺! ?ㅽ넗?댁뿉 ?몄텧?⑸땲??');
      setDirectModal(false);
      directForm.resetFields();
      setPhotoUrls({ exterior: '', interior: '', engine: '', extra: '' });
      fetchData();
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('?깅줉 以??ㅻ쪟 諛쒖깮');
    } finally {
      setDirecting(false);
    }
  };

  // ?? BLUR: 踰덊샇?먃룹뼹援??섎룞 釉붾윭 ??????????????????????????????????
  const handleBlur = async (item: IStoreItem) => {
    if (!item.photos || typeof item.photos !== 'object') {
      message.warning('?ъ쭊 ?곗씠?곌? ?놁뒿?덈떎.');
      return;
    }
    setBlurringId(item.id);
    try {
      const photos = item.photos as Record<string, string[]>;
      const categoryOrder = Object.keys(photos);
      const allUrls = categoryOrder.flatMap(k => photos[k] ?? []);
      if (!allUrls.length) { message.warning('泥섎━???ъ쭊???놁뒿?덈떎.'); return; }

      const categoryMap = categoryOrder.map(k => ({ category: k, count: (photos[k] ?? []).length }));

      message.loading({ content: `踰덊샇??blur 泥섎━ ?쒖옉??(${allUrls.length}?? 諛깃렇?쇱슫??泥섎━)`, key: 'blur', duration: 3 });
      const res = await fetch(`${CAVIOR_BASE}/api/v1/admin/blur/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: allUrls, storeItemId: item.id, categoryMap }),
      });
      if (!res.ok) throw new Error(`blur ?묐떟 ?ㅻ쪟: ${res.status}`);
      message.success('釉붾윭 泥섎━媛 諛깃렇?쇱슫?쒖뿉??吏꾪뻾 以묒엯?덈떎. 1~2遺????덈줈怨좎묠?섏꽭??');
    } catch (e: any) {
      message.error(`blur ?ㅽ뙣: ${e?.message ?? '?????녿뒗 ?ㅻ쪟'}`);
    } finally {
      setBlurringId(null);
      message.destroy('blur');
    }
  };

  // ?? DELETE: ?깅줉 痍⑥냼 ??????????????????????????????????????????
  const handleDelete = (id: string, title: string) => {
    Modal.confirm({
      title: '?깅줉 痍⑥냼',
      content: `"${title}" ??瑜? ?ㅽ넗?댁뿉????젣?섏떆寃좎뒿?덇퉴?`,
      okText: '??젣', okType: 'danger', cancelText: '痍⑥냼',
      onOk: async () => {
        await fetch(`${CAVIOR_BASE}/api/admin/store-items?id=${id}`, { method: 'DELETE' });
        setStoreItems(prev => prev.filter(i => i.id !== id));
        message.success('?깅줉??痍⑥냼?섏뿀?듬땲??');
      },
    });
  };

  // ?? ?뚯씠釉?而щ읆 ????????????????????????????????????????????????
  const unregColumns: ColumnsType<IBooking> = [
    {
      title: '?덉빟 ID', dataIndex: 'id', width: 90,
      render: (v: number) => <span className="font-mono text-blue-600">#{v}</span>,
    },
    { title: '李⑤웾踰덊샇', dataIndex: 'carNumber', render: (v: string) => <span className="font-bold">{v}</span> },
    { title: '李⑥쥌',     dataIndex: 'carModel',  render: (v?: string) => v ?? <span className="text-gray-300">-</span> },
    { title: '李⑥＜',     dataIndex: 'carOwner' },
    { title: '吏꾨떒??,   dataIndex: 'assignedDriverName', render: (v?: string) => v ?? <span className="text-gray-300">-</span> },
    {
      title: '?꾨즺??, key: 'date',
      render: (_: any, r: IBooking) => dayjs(r.completedAt ?? r.updatedAt).format('YYYY-MM-DD'),
    },
    {
      title: '吏??, dataIndex: 'address',
      render: (v: string) => v?.split(' ')[0] ?? '-',
    },
    {
      title: '?≪뀡', key: 'action', align: 'right',
      render: (_: any, record: IBooking) => (
        <Button
          type="primary"
          size="small"
          onClick={() => router.push(`/store/register?bookingId=${record.id}`)}
        >
          ?ㅽ넗???깅줉
        </Button>
      ),
    },
  ];

  const regColumns: ColumnsType<IStoreItem> = [
    {
      title: '李⑤웾踰덊샇', dataIndex: 'carNumber',
      render: (v: string) => <span className="font-bold">{v}</span>,
    },
    { title: '李⑤웾紐?, dataIndex: 'titleKo' },
    {
      title: '?먮ℓ媛', key: 'price',
      render: (_: any, item: IStoreItem) => {
        if (item.hidePrice || item.status === 'sold') return <span className="text-gray-400 text-xs">媛寃?誘명몴??/span>;
        if (!item.priceKRW) return <span className="text-gray-300 text-xs">-</span>;
        return <span className="font-bold text-green-600">{fmtKRW(item.priceKRW)}</span>;
      },
    },
    {
      title: '?곹깭', dataIndex: 'status',
      render: (v: string) => {
        const sc = STATUS_CONFIG[v] ?? { color: 'default', text: v };
        return <Tag color={sc.color}>{sc.text}</Tag>;
      },
    },
    {
      title: '?깅줉??, dataIndex: 'registeredAt',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD'),
    },
    {
      title: '?≪뀡', key: 'action', align: 'right', width: 180,
      render: (_: any, item: IStoreItem) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            size="small"
            icon={<Eye size={13} />}
            onClick={() => window.open(`https://carvior.store/buy/${item.id}`, 'preview', 'width=1200,height=850,scrollbars=yes,resizable=yes')}
          >
            蹂닿린
          </Button>
          <Button
            size="small"
            icon={<Edit size={13} />}
            onClick={() => router.push(`/store/register?storeItemId=${item.id}`)}
          >
            ?섏젙
          </Button>
          <Button
            size="small"
            loading={blurringId === item.id}
            onClick={() => handleBlur(item)}
          >
            踰덊샇??          </Button>
          {item.status !== 'pending' && (
            <Button
              size="small"
              onClick={async () => {
                await fetch(`${CAVIOR_BASE}/api/admin/store-items?id=${item.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'pending' }),
                });
                message.success('pending?쇰줈 蹂듦뎄?섏뿀?듬땲??');
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
            痍⑥냼
          </Button>
        </div>
      ),
    },
  ];

  // ?? 怨듯넻 ???꾨뱶 ???????????????????????????????????????????????
  const ItemFormFields = () => (
    <div className="grid grid-cols-2 gap-x-4">
      <Form.Item label="李⑤웾紐?(?쒓뎅??" name="titleKo" rules={[{ required: true }]}>
        <Input placeholder="?? 湲곗븘 ?????섎젋?? />
      </Form.Item>
      <Form.Item label="李⑤웾紐?(?곸뼱)" name="titleEn">
        <Input placeholder="?? Kia Sorento" />
      </Form.Item>
      <Form.Item label="?몃┝" name="trim">
        <Input placeholder="?? Noblesse" />
      </Form.Item>
      <Form.Item label="?곗떇" name="year">
        <InputNumber className="w-full" />
      </Form.Item>
      <Form.Item label="二쇳뻾嫄곕━ (km)" name="mileage">
        <InputNumber className="w-full" formatter={v => v ? `${Number(v).toLocaleString()}` : ''} />
      </Form.Item>
      <Form.Item label="諛곌린?? name="displacement">
        <Input placeholder="?? 2,497cc" />
      </Form.Item>
      <Form.Item label="?곕즺" name="fuel">
        <Select options={FUEL_OPTIONS.map(o => ({ value: o, label: o }))} />
      </Form.Item>
      <Form.Item label="蹂?띻린" name="transmission">
        <Select options={TRANS_OPTIONS.map(o => ({ value: o, label: o }))} />
      </Form.Item>
      <Form.Item label="?됱긽 (?쒓뎅??" name="colorKo">
        <Input placeholder="?? ?ㅻ끂???붿씠???? />
      </Form.Item>
      <Form.Item label="移댄뀒怨좊━" name="category">
        <Select options={CATEGORY_OPTIONS.map(o => ({ value: o, label: o }))} />
      </Form.Item>
      <Form.Item label="吏?? name="region">
        <Input placeholder="?? 寃쎄린?? />
      </Form.Item>
      <Form.Item label="?ш퀬 ?대젰" name="accident" valuePropName="checked">
        <Checkbox>?ш퀬 ?대젰 ?덉쓬</Checkbox>
      </Form.Item>
      <Form.Item label="?먮ℓ媛 (??" name="priceKRW" rules={[{ required: true }]} className="col-span-2">
        <InputNumber
          className="w-full"
          placeholder="?? 36900000"
          formatter={v => v ? `${Number(v).toLocaleString()}` : ''}
        />
      </Form.Item>
      <Form.Item label="?대뱶誘?硫붾え" name="adminMemo" className="col-span-2">
        <Input.TextArea rows={2} placeholder="?대? 李멸퀬 硫붾え (?몃? 誘몃끂異?" />
      </Form.Item>
    </div>
  );

  // ?? render ?????????????????????????????????????????????????????
  return (
    <div>
      {/* ?듦퀎 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <Statistic title="?꾨즺???덉빟" value={bookings.length} loading={loading} />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <Statistic title="?ㅽ넗???깅줉" value={storeItems.length} loading={loading} valueStyle={{ color: '#16a34a' }} />
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <Statistic
            title="??꾨벑濡?(?낃툑?뺤씤 ?꾩슂)"
            value={selfRegistered.filter(i => i.status === 'pending').length}
            loading={loading}
            valueStyle={{ color: '#1677ff' }}
          />
        </div>
      </div>

      {/* ??+ 寃??*/}
      <DefaultTableBtn className="justify-between mb-4">
        <div className="flex gap-2">
          <Button
            type={activeTab === 'unregistered' ? 'primary' : 'default'}
            onClick={() => setActiveTab('unregistered')}
          >
            誘몃벑濡?          </Button>
          <Button
            type={activeTab === 'registered' ? 'primary' : 'default'}
            onClick={() => setActiveTab('registered')}
          >
            ?깅줉??          </Button>
          <Button
            type={activeTab === 'selfregister' ? 'primary' : 'default'}
            onClick={() => setActiveTab('selfregister')}
            style={activeTab !== 'selfregister' && selfRegistered.filter(i => i.status === 'pending').length > 0 ? { borderColor: '#1677ff', color: '#1677ff' } : {}}
          >
            ??꾨벑濡?{selfRegistered.filter(i => i.status === 'pending').length > 0 && `(${selfRegistered.filter(i => i.status === 'pending').length})`}
          </Button>
          <Input
            placeholder="李⑤웾踰덊샇 / 李⑥쥌 / 李⑥＜"
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
              directForm.setFieldsValue({ fuel: '媛?붾┛', transmission: '?먮룞', category: 'SUV', region: '?쒖슱' });
              setPhotoUrls({ exterior: '', interior: '', engine: '', extra: '' });
              setDirectModal(true);
            }}
          >
            + 吏곸젒 ?깅줉
          </Button>
          <Button icon={<RefreshCw size={14} />} onClick={fetchData} loading={loading}>?덈줈怨좎묠</Button>
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

      {/* ?? ?섏젙 紐⑤떖 (UPDATE) ?? */}
      <Modal
        title={`留ㅻЪ ?섏젙 ??${editingItem?.titleKo}`}
        open={editModal}
        onOk={handleUpdate}
        onCancel={() => setEditModal(false)}
        confirmLoading={updating}
        okText="???
        cancelText="痍⑥냼"
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
                      message.success('?뱀씤?섏뿀?듬땲?? ?ㅽ넗?댁뿉 ?몄텧?⑸땲??');
                      setEditModal(false);
                      fetchData();
                    }}
                  >
                    ???낃툑?뺤씤 ???뱀씤
                  </Button>
                  <Button
                    danger
                    onClick={async () => {
                      await fetch(`${CAVIOR_BASE}/api/admin/store-items?id=${editingItem.id}`, {
                        method: 'DELETE',
                      });
                      message.success('嫄곗젅 諛???젣 ?꾨즺');
                      setEditModal(false);
                      fetchData();
                    }}
                  >
                    ??嫄곗젅 (??젣)
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
        {/* ??꾨벑濡??ъ쭊 誘몃━蹂닿린 */}
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

        {/* adminMemo ?쒖떆 (??꾨벑濡??곕씫泥??? */}
        {editingItem?.adminMemo && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 mb-4 text-xs text-blue-700">
            {editingItem.adminMemo}
          </div>
        )}

        <Form form={editForm} layout="vertical" size="middle">
          {/* ?곹깭 + 媛寃?誘명몴??*/}
          <div className="flex gap-4 mb-2">
            <Form.Item label="?먮ℓ ?곹깭" name="status" className="flex-1 mb-0">
              <Select
                options={[
                  { value: 'pending', label: '?낃툑?뺤씤以? },
                  { value: 'active',  label: '?먮ℓ以? },
                  { value: 'sold',    label: '嫄곕옒?꾨즺' },
                  { value: 'hidden',  label: '?④?' },
                ]}
              />
            </Form.Item>
            <Form.Item label="媛寃?誘명몴?? name="hidePrice" valuePropName="checked" className="mb-0 pt-7">
              <Checkbox>嫄곕옒?꾨즺 ??媛寃??④린湲?/Checkbox>
            </Form.Item>
          </div>
          <div className="border-b border-gray-100 mb-4" />
          {editingItem?.status === 'active' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700 font-semibold mb-4">
              ?좑툘 寃뚯떆??留ㅻЪ? ?곹깭 蹂寃쎈쭔 媛?ν빀?덈떎. ?댁슜 ?섏젙???꾩슂?섎㈃ 癒쇱? pending?쇰줈 ?섎룎由ъ꽭??
            </div>
          ) : (
            <ItemFormFields />
          )}
        </Form>
      </Modal>
      {/* ?? 吏곸젒 ?깅줉 紐⑤떖 ?? */}
      <Modal
        title="吏곸젒 ?깅줉 ??S3 ?ъ쭊 URL 遺숈뿬?ｊ린"
        open={directModal}
        onOk={handleDirectRegister}
        onCancel={() => setDirectModal(false)}
        confirmLoading={directing}
        okText="?ㅽ넗?댁뿉 ?깅줉"
        cancelText="痍⑥냼"
        width={740}
      >
        <Form form={directForm} layout="vertical" size="middle">
          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item label="李⑤웾踰덊샇" name="carNumber">
              <Input placeholder="?? 12媛3456" />
            </Form.Item>
            <Form.Item label="李⑤웾紐?(?쒓뎅??" name="titleKo" rules={[{ required: true }]}>
              <Input placeholder="?? 湲곗븘 ?????섎젋?? />
            </Form.Item>
            <Form.Item label="李⑤웾紐?(?곸뼱)" name="titleEn">
              <Input placeholder="?? Kia Sorento" />
            </Form.Item>
            <Form.Item label="?몃┝" name="trim">
              <Input placeholder="?? Noblesse" />
            </Form.Item>
            <Form.Item label="?곗떇" name="year">
              <InputNumber className="w-full" placeholder="2024" />
            </Form.Item>
            <Form.Item label="二쇳뻾嫄곕━ (km)" name="mileage">
              <InputNumber className="w-full" formatter={v => v ? `${Number(v).toLocaleString()}` : ''} />
            </Form.Item>
            <Form.Item label="?곕즺" name="fuel">
              <Select options={FUEL_OPTIONS.map(o => ({ value: o, label: o }))} />
            </Form.Item>
            <Form.Item label="蹂?띻린" name="transmission">
              <Select options={TRANS_OPTIONS.map(o => ({ value: o, label: o }))} />
            </Form.Item>
            <Form.Item label="諛곌린?? name="displacement">
              <Input placeholder="?? 2,497cc" />
            </Form.Item>
            <Form.Item label="?됱긽" name="colorKo">
              <Input placeholder="?? ?ㅻ끂???붿씠???? />
            </Form.Item>
            <Form.Item label="移댄뀒怨좊━" name="category">
              <Select options={CATEGORY_OPTIONS.map(o => ({ value: o, label: o }))} />
            </Form.Item>
            <Form.Item label="吏?? name="region">
              <Input placeholder="?? 寃쎄린?? />
            </Form.Item>
            <Form.Item label="?먮ℓ媛 (??" name="priceKRW" rules={[{ required: true }]} className="col-span-2">
              <InputNumber
                className="w-full"
                placeholder="?? 36900000"
                formatter={v => v ? `${Number(v).toLocaleString()}` : ''}
              />
            </Form.Item>
            <Form.Item label="?대뱶誘?硫붾え" name="adminMemo" className="col-span-2">
              <Input.TextArea rows={2} placeholder="?대? 李멸퀬 硫붾え" />
            </Form.Item>
          </div>

          <div className="border-t border-gray-100 pt-4 mt-2">
            <p className="text-xs font-bold text-gray-500 mb-3">?벜 S3 ?ъ쭊 URL (以꾨컮轅??먮뒗 ?쇳몴濡??щ윭 ???낅젰)</p>
            <div className="space-y-3">
              {[
                { key: 'exterior', label: '?멸? ?ъ쭊 ?슅' },
                { key: 'interior', label: '?닿? ?ъ쭊 ?뮱' },
                { key: 'engine',   label: '?붿쭊 ?ъ쭊 ?뵩' },
                { key: 'extra',    label: '湲고? ?ъ쭊 ?벜' },
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

