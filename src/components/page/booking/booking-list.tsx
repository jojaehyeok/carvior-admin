'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import DefaultTableBtn from "@/components/shared/ui/default-table-btn";
import { ISO8601DateTime } from "@/types/common";
import { Button, Input, Modal, Select, Tag, message } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Eye, RefreshCw, UserPlus } from "lucide-react";
// import { useRouter } from "next/router"; // ❌ 오류의 주범! 삭제합니다.
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
  assignedDriverId?: string;
  assignedDriverName?: string;
  createdAt: ISO8601DateTime;
}

const BookingList = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [data, setData] = useState<IBooking[]>([]);
  const [drivers, setDrivers] = useState<IDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- 상세/수정 모달 상태 ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<IBooking | null>(null);
  const [tempMemo, setTempMemo] = useState("");
  const [tempStatus, setTempStatus] = useState<IBooking['status']>('PENDING');
  const [selectedDriver, setSelectedDriver] = useState<{ id: string, name: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // API 주소 체크 (환경변수 없으면 4000번 강제)
  const API_BASE = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:4000/api/v1';

  // 1. 신청 목록 가져오기
  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/external/request/list`);
      if (!response.ok) throw new Error();
      const result = await response.json();
      setData(result);
    } catch (err) {
      message.error("신청 목록 로드 실패");
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE]);

  // 2. 진단사 목록 가져오기
  const fetchDrivers = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/drivers`);
      const result = await response.json();
      setDrivers(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error("진단사 로드 실패", err);
    }
  }, [API_BASE]);

  useEffect(() => {
    fetchBookings();
    fetchDrivers();
  }, [fetchBookings, fetchDrivers]);

  // --- 💾 저장 로직 (상태 + 배정 통합) ---
  const handleUpdate = async () => {
    if (!editingBooking) return;
    setIsUpdating(true);
    try {
      // 1. 상태 및 메모 업데이트
      await fetch(`${API_BASE}/external/request/${editingBooking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: tempStatus, adminMemo: tempMemo })
      });

      // 2. 진단사 배정 (상태가 ASSIGNED이거나 드라이버가 선택된 경우)
      if (selectedDriver) {
        await fetch(`${API_BASE}/external/request/${editingBooking.id}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedDriver.id, name: selectedDriver.name })
        });
      }

      message.success("성공적으로 변경되었습니다.");
      setIsModalOpen(false);
      fetchBookings();
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
      title: "차량번호",
      dataIndex: "carNumber",
      render: (value: string) => <span className="font-bold text-blue-600">{value}</span>,
    },
    {
      title: "배정 진단사", // ✅ 배정된 사람이 누구인지 바로 보이게!
      dataIndex: "assignedDriverName",
      render: (value: string) => value ? <Tag icon={<UserPlus size={12} />} color="blue">{value}</Tag> : <span className="text-gray-300">미배정</span>,
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
    {
      title: "접수일",
      dataIndex: "createdAt",
      render: (value: ISO8601DateTime) => dayjs(value).format("YYYY-MM-DD"),
    },
    {
      title: "진단 리포트",
      key: "report",
      width: 120,
      align: "center",
      render: (_, record) => {
        // 진단 완료(COMPLETED) 상태일 때만 버튼을 활성화할지, 
        // 아니면 관리자니까 작업 중에도 미리 볼 수 있게 할지 결정하면 됩니다.
        const isCompleted = record.status === 'COMPLETED';

        return (
          <Button
            size="small"
            type="primary"
            ghost
            // 💡 팁: 관리자는 작업 중에도 보고 싶을 수 있으니 disabled를 아예 빼는 것도 방법입니다!
            disabled={!isCompleted}
            icon={<Eye size={14} />}
            onClick={() => {
              // ✅ 우리가 만든 리포트 페이지 경로(/reports/[id])로 연결
              window.open(`/reports/${record.id}`, '_blank');
            }}
          >
            리포트 보기
          </Button>
        );
      },
    },
  ];

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <DefaultTableBtn className="justify-between mb-4">
        <span className="text-gray-500">전체 {data.length}건</span>
        <Button type="primary" icon={<RefreshCw size={14} />} onClick={fetchBookings} loading={isLoading}>새로고침</Button>
      </DefaultTableBtn>

      <DefaultTable<IBooking>
        columns={columns}
        dataSource={data}
        loading={isLoading}
        rowKey="id"
      />

      <Modal
        title={`진단 관리 - ${editingBooking?.carNumber}`}
        open={isModalOpen}
        onOk={handleUpdate}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={isUpdating}
        okText="변경사항 저장"
        cancelText="취소"
      >
        <div className="space-y-4 py-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <p>딜러: {editingBooking?.dealerName} ({editingBooking?.contact})</p>
            <p>주소: {editingBooking?.address}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">상태 변경</label>
            <Select
              className="w-full"
              value={tempStatus}
              onChange={setTempStatus}
              options={Object.keys(statusConfig).map(key => ({ value: key, label: statusConfig[key].label }))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">진단사 배정</label>
            <Select
              className="w-full"
              placeholder="진단사 선택"
              value={selectedDriver?.id}
              onChange={(val, opt: any) => setSelectedDriver({ id: val, name: opt.label })}
              options={drivers.map(d => ({ value: d.accountId, label: d.name }))}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">관리자 메모</label>
            <Input.TextArea value={tempMemo} onChange={e => setTempMemo(e.target.value)} rows={3} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default React.memo(BookingList);