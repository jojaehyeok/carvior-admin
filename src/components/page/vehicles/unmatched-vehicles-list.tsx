'use client';

import { Button, Form, Input, InputNumber, message, Modal, Table, Tag } from "antd";
import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? '';
const INTERNAL_HEADERS = { 'x-internal-key': INTERNAL_KEY };
const REPORT_BASE = 'https://carvior.store/report';

interface IVehicle {
  id: number;
  carNumber: string;
  latestInspectionId: number | null;
  requesterName: string | null;
  requesterContact: string | null;
  ownerName: string | null;
  ownerContact: string | null;
  requesterIsOwner: boolean | null;
  saleStatus: string;
  ownerContactedAt: string | null;
  ownerRespondedAt: string | null;
  adminMemo: string | null;
  updatedAt: string;
  inspectionCarModel?: string | null;
  inspectionMileage?: number | null;
  inspectionCompletedAt?: string | null;
  inspectionCarHash?: string | null;
  bookingCarOwner?: string | null;
  bookingContact?: string | null;
  bookingCustomerContact?: string | null;
}

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  UNMATCHED_INSPECTED: { text: '연락 대기', color: 'default' },
  OWNER_CONTACT_PENDING: { text: '연락 시도중', color: 'blue' },
  OWNER_CONTACTED: { text: '연락 완료', color: 'cyan' },
  OWNER_DECLINED_TO_SELL: { text: '판매 거절', color: 'red' },
  OWNER_AGREED_TO_SELL: { text: '판매 동의', color: 'green' },
};

export default function UnmatchedVehiclesList() {
  const [vehicles, setVehicles] = useState<IVehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [editing, setEditing] = useState<IVehicle | null>(null);
  const [editForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [listing, setListing] = useState<IVehicle | null>(null);
  const [listingForm] = Form.useForm();
  const [creatingListing, setCreatingListing] = useState(false);

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/vehicles/unmatched`, { headers: INTERNAL_HEADERS });
      const data = await res.json();
      setVehicles(Array.isArray(data) ? data : []);
    } catch {
      message.error('미매칭 검차차량 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const updateStatus = async (vehicle: IVehicle, saleStatus: string) => {
    setUpdatingId(vehicle.id);
    try {
      const res = await fetch(`${API}/admin/vehicles/${vehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
        body: JSON.stringify({ saleStatus }),
      });
      if (!res.ok) throw new Error();
      message.success('상태가 변경되었습니다.');
      fetchVehicles();
    } catch {
      message.error('상태 변경에 실패했습니다.');
    } finally {
      setUpdatingId(null);
    }
  };

  const openEdit = (vehicle: IVehicle) => {
    setEditing(vehicle);
    editForm.setFieldsValue({
      ownerName: vehicle.ownerName ?? '',
      ownerContact: vehicle.ownerContact ?? '',
      adminMemo: vehicle.adminMemo ?? '',
    });
  };

  const handleSaveEdit = async (values: { ownerName?: string; ownerContact?: string; adminMemo?: string }) => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/admin/vehicles/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error();
      message.success('저장되었습니다.');
      setEditing(null);
      fetchVehicles();
    } catch {
      message.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const openListingModal = (vehicle: IVehicle) => {
    setListing(vehicle);
    listingForm.resetFields();
  };

  const handleCreateListing = async (values: { askingPrice: number; minimumAcceptablePrice?: number }) => {
    if (!listing) return;
    setCreatingListing(true);
    try {
      const res = await fetch(`${API}/admin/vehicles/${listing.id}/create-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || '매물 전환 실패');
      }
      message.success('판매매물로 전환되었습니다. "판매매물" 메뉴에서 확인하세요.');
      setListing(null);
      fetchVehicles();
    } catch (e: any) {
      message.error(e?.message || '매물 전환에 실패했습니다.');
    } finally {
      setCreatingListing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <Table
        dataSource={vehicles}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 20 }}
        locale={{ emptyText: '미매칭 검차차량이 없습니다.' }}
        columns={[
          {
            title: '차량정보',
            render: (_: any, v: IVehicle) => (
              <div>
                <p className="font-bold">{v.carNumber}</p>
                <p className="text-xs text-gray-400">
                  {v.inspectionCarModel ?? '-'} · {v.inspectionMileage != null ? `${v.inspectionMileage.toLocaleString()}km` : '-'}
                </p>
              </div>
            ),
          },
          {
            title: '검차',
            render: (_: any, v: IVehicle) => (
              <div className="text-xs">
                <p>{v.inspectionCompletedAt ? new Date(v.inspectionCompletedAt).toLocaleDateString('ko-KR') : '-'}</p>
                {v.inspectionCarHash ? (
                  <a href={`${REPORT_BASE}/${v.inspectionCarHash}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    리포트 보기
                  </a>
                ) : <span className="text-gray-300">리포트 없음</span>}
              </div>
            ),
          },
          {
            title: '검차 신청자 (최초 구매예정자)',
            render: (_: any, v: IVehicle) => (
              <div className="text-xs">
                <p>{v.requesterName ?? v.bookingCarOwner ?? '-'}</p>
                <p className="text-gray-400">{v.requesterContact ?? v.bookingContact ?? '-'}</p>
              </div>
            ),
          },
          {
            title: '실제 차주',
            render: (_: any, v: IVehicle) => (
              <div className="text-xs">
                <p>{v.ownerName ?? <span className="text-gray-300">미확인</span>}</p>
                <p className="text-gray-400">{v.ownerContact ?? (v.bookingCustomerContact ? `${v.bookingCustomerContact} (접수시 확인)` : '-')}</p>
              </div>
            ),
          },
          {
            title: '차주 연락상태 · 판매의사',
            dataIndex: 'saleStatus',
            render: (v: string) => {
              const s = STATUS_LABEL[v] ?? { text: v, color: 'default' };
              return <Tag color={s.color}>{s.text}</Tag>;
            },
          },
          {
            title: '작업',
            render: (_: any, v: IVehicle) => (
              <div className="flex flex-col gap-1.5">
                <Button size="small" onClick={() => openEdit(v)}>차주정보/메모 수정</Button>
                <div className="flex gap-1.5 flex-wrap">
                  {v.saleStatus === 'UNMATCHED_INSPECTED' && (
                    <Button size="small" type="primary" loading={updatingId === v.id}
                      onClick={() => updateStatus(v, 'OWNER_CONTACT_PENDING')}>
                      연락 시작
                    </Button>
                  )}
                  {v.saleStatus === 'OWNER_CONTACT_PENDING' && (
                    <Button size="small" type="primary" loading={updatingId === v.id}
                      onClick={() => updateStatus(v, 'OWNER_CONTACTED')}>
                      연락 완료
                    </Button>
                  )}
                  {v.saleStatus === 'OWNER_CONTACTED' && (
                    <>
                      <Button size="small" type="primary" loading={updatingId === v.id}
                        onClick={() => updateStatus(v, 'OWNER_AGREED_TO_SELL')}>
                        판매 동의
                      </Button>
                      <Button size="small" danger loading={updatingId === v.id}
                        onClick={() => updateStatus(v, 'OWNER_DECLINED_TO_SELL')}>
                        판매 거절
                      </Button>
                    </>
                  )}
                  {v.saleStatus === 'OWNER_DECLINED_TO_SELL' && (
                    <Button size="small" loading={updatingId === v.id}
                      onClick={() => updateStatus(v, 'OWNER_CONTACT_PENDING')}>
                      다시 연락하기
                    </Button>
                  )}
                  {v.saleStatus === 'OWNER_AGREED_TO_SELL' && (
                    <Button size="small" type="primary" onClick={() => openListingModal(v)}>
                      판매매물로 전환
                    </Button>
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={`차주 정보 수정 — ${editing?.carNumber ?? ''}`}
        open={!!editing}
        onCancel={() => setEditing(null)}
        footer={null}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" onFinish={handleSaveEdit} className="pt-2">
          <Form.Item label="실제 차주 이름" name="ownerName">
            <Input placeholder="확인된 실제 차주 이름" />
          </Form.Item>
          <Form.Item label="실제 차주 연락처" name="ownerContact">
            <Input placeholder="010-0000-0000" />
          </Form.Item>
          <Form.Item label="메모" name="adminMemo">
            <Input.TextArea rows={4} placeholder="연락 채널, 협의 내용 등" />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setEditing(null)}>취소</Button>
            <Button type="primary" htmlType="submit" loading={saving}>저장</Button>
          </div>
        </Form>
      </Modal>

      <Modal
        title={`판매매물로 전환 — ${listing?.carNumber ?? ''}`}
        open={!!listing}
        onCancel={() => setListing(null)}
        footer={null}
        destroyOnClose
      >
        <p className="text-xs text-gray-400 mb-4">
          차주가 판매에 동의한 차량입니다. 통화로 확인한 희망가격을 입력하면 딜러 입찰이 가능한 판매매물로 전환됩니다.
        </p>
        <Form form={listingForm} layout="vertical" onFinish={handleCreateListing} className="pt-2">
          <Form.Item label="차주 희망가격 (원)" name="askingPrice" rules={[{ required: true, message: '희망가격을 입력해주세요.' }]}>
            <InputNumber className="w-full" min={0} step={100000} placeholder="예: 20000000"
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => Number((v ?? '').replace(/,/g, '')) as any} />
          </Form.Item>
          <Form.Item label="최저 수용가격 (선택)" name="minimumAcceptablePrice">
            <InputNumber className="w-full" min={0} step={100000} placeholder="이 금액 밑으로는 승인 안 함(선택)"
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => Number((v ?? '').replace(/,/g, '')) as any} />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setListing(null)}>취소</Button>
            <Button type="primary" htmlType="submit" loading={creatingListing}>매물 생성</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
