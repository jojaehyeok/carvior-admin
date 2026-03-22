'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import DefaultTableBtn from "@/components/shared/ui/default-table-btn";
import { ISO8601DateTime } from "@/types/common";
import { Button, Divider, Input, Modal, Select, Tag, message } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Download, Eye, UserPlus } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

// --- 인터페이스 정의 ---
interface IDriver {
  accountId: string;
  name: string;
  status: string;
}

interface IBooking {
  id: number;
  carNumber: string;
  carOwner: string;
  dealerName: string;
  contact: string;
  address: string;
  preferredDateTime: string;
  status: 'PENDING' | 'ASSIGNED' | 'COMPLETED' | 'CANCELLED';
  adminMemo?: string;
  assignedDriverId?: string;    // ✅ 추가
  assignedDriverName?: string;  // ✅ 추가
  createdAt: ISO8601DateTime;
}

const BookingList = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [data, setData] = useState<IBooking[]>([]);
  const [drivers, setDrivers] = useState<IDriver[]>([]); // ✅ 진단사 목록 상태
  const [isLoading, setIsLoading] = useState(true);

  // --- 상세/수정 모달 상태 ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<IBooking | null>(null);
  const [tempMemo, setTempMemo] = useState("");
  const [tempStatus, setTempStatus] = useState<IBooking['status']>('PENDING');
  const [selectedDriver, setSelectedDriver] = useState<{ id: string, name: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:4000/api/v1';

  // 1. 신청 목록 가져오기
  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/external/request/list`);
      const result = await response.json();
      setData(result);
    } catch (err) {
      message.error("목록 로드 실패");
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE]);

  // 2. 진단사 목록 가져오기 (배정용)
  const fetchDrivers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/drivers`);
      const result = await response.json();
      // 승인된(APPROVED/ACTIVE) 진단사만 필터링해서 보여주면 더 좋습니다.
      setDrivers(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error("진단사 로드 실패", err);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchBookings();
    fetchDrivers();
  }, [fetchBookings, fetchDrivers]);

  // --- 💾 저장 로직 (상태 + 메모 + 진단사 배정 통합) ---
  const handleUpdate = async () => {
    if (!editingBooking) return;
    setIsUpdating(true);
    try {
      // ✅ 1. 상태 및 메모 업데이트
      const statusRes = await fetch(`${API_BASE}/external/request/${editingBooking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: tempStatus,
          adminMemo: tempMemo
        })
      });

      // ✅ 2. 진단사 배정 업데이트 (진단사가 선택된 경우만)
      if (selectedDriver && tempStatus === 'ASSIGNED') {
        await fetch(`${API_BASE}/external/request/${editingBooking.id}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedDriver.id,
            name: selectedDriver.name
          })
        });
      }

      if (statusRes.ok) {
        message.success("정보가 성공적으로 반영되었습니다.");
        setIsModalOpen(false);
        fetchBookings();
      }
    } catch (e) {
      message.error("저장 중 오류 발생");
    } finally {
      setIsUpdating(false);
    }
  };

  const statusConfig: any = {
    PENDING: { color: "orange", label: "대기중" },
    ASSIGNED: { color: "blue", label: "배정완료" },
    COMPLETED: { color: "green", label: "진단완료" },
    CANCELLED: { color: "red", label: "취소" },
  };

  const columns: ColumnsType<IBooking> = [
    {
      title: "관리",
      key: "action",
      width: 80,
      align: "center",
      render: (_, record) => (
        <Button
          size="small"
          icon={<Eye size={14} />}
          onClick={() => {
            setEditingBooking(record);
            setTempMemo(record.adminMemo || "");
            setTempStatus(record.status);
            setSelectedDriver(record.assignedDriverId ? { id: record.assignedDriverId, name: record.assignedDriverName || "" } : null);
            setIsModalOpen(true);
          }}
        >
          상세
        </Button>
      ),
    },
    {
      title: "접수일시",
      dataIndex: "createdAt",
      width: 130,
      render: (value: ISO8601DateTime) => (
        <div className="text-xs">
          <span className="block font-medium">{dayjs(value).format("YYYY-MM-DD")}</span>
          <span className="text-gray-400">{dayjs(value).format("HH:mm")}</span>
        </div>
      ),
    },
    {
      title: "차량번호",
      dataIndex: "carNumber",
      render: (value: string) => <span className="font-bold text-blue-600">{value}</span>,
    },
    {
      title: "배정 진단사",
      dataIndex: "assignedDriverName",
      render: (value: string) => value ? <Tag icon={<UserPlus size={12} />} color="processing">{value}</Tag> : <span className="text-gray-300">-</span>,
    },
    {
      title: "딜러/연락처",
      dataIndex: "dealerName",
      render: (value: string, record) => (
        <div>
          <span className="font-semibold">{value}</span>
          <span className="block text-xs text-gray-400">{record.contact}</span>
        </div>
      ),
    },
    {
      title: "상태",
      dataIndex: "status",
      align: "center",
      render: (status: string) => {
        const config = statusConfig[status] || { color: "default", label: status };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
  ];

  return (
    <>
      <DefaultTableBtn className="justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 ml-2">총 {data.length}건</span>
        </div>
        <div className="flex gap-2">
          <Button icon={<Download size={16} />}>엑셀</Button>
          <Button type="primary" onClick={fetchBookings}>새로고침</Button>
        </div>
      </DefaultTableBtn>

      <DefaultTable<IBooking>
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
        columns={columns}
        dataSource={data}
        loading={isLoading}
        rowKey="id"
        className="mt-3"
      />

      {/* --- 상세 정보 및 배정 모달 --- */}
      <Modal
        title={`신청 상세 정보 및 관리 (${editingBooking?.carNumber})`}
        open={isModalOpen}
        onOk={handleUpdate}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={isUpdating}
        okText="저장하기"
        cancelText="닫기"
        width={600}
      >
        <div className="py-4 flex flex-col gap-5">
          {/* 정보 요약 */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl">
            <div><p className="text-xs text-gray-400">딜러/상사</p><p className="font-bold">{editingBooking?.dealerName}</p></div>
            <div><p className="text-xs text-gray-400">연락처</p><p className="font-bold">{editingBooking?.contact}</p></div>
            <div className="col-span-2"><p className="text-xs text-gray-400">희망 일시 / 주소</p>
              <p className="font-medium text-sm">{editingBooking?.preferredDateTime}</p>
              <p className="text-gray-600 text-xs">{editingBooking?.address}</p>
            </div>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          {/* 진행 상태 */}
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-700">진행 상태</label>
            <Select
              className="w-full"
              size="large"
              value={tempStatus}
              onChange={(value) => setTempStatus(value)}
              options={[
                { value: 'PENDING', label: '대기중' },
                { value: 'ASSIGNED', label: '진단사배정' },
                { value: 'COMPLETED', label: '진단완료' },
                { value: 'CANCELLED', label: '신청취소' },
              ]}
            />
          </div>

          {/* 진단사 배정 (상태가 ASSIGNED일 때만 강조되거나 필요) */}
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-700">진단사 지정</label>
            <Select
              className="w-full"
              size="large"
              placeholder="배정할 진단사를 선택하세요"
              value={selectedDriver?.id}
              onChange={(val, option: any) => setSelectedDriver({ id: val, name: option.label })}
              options={drivers.map(d => ({ value: d.accountId, label: d.name }))}
              showSearch
              filterOption={(input, option) => (option?.label ?? '').includes(input)}
            />
          </div>

          {/* 관리자 메모 */}
          <div>
            <label className="block text-sm font-bold mb-2 text-slate-700">관리자 메모</label>
            <Input.TextArea
              rows={3}
              value={tempMemo}
              onChange={(e) => setTempMemo(e.target.value)}
              placeholder="참고사항을 입력하세요."
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

export default React.memo(BookingList);