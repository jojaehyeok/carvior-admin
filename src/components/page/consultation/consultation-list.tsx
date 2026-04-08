'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import DefaultTableBtn from "@/components/shared/ui/default-table-btn";
import { ISO8601DateTime } from "@/types/common";
import { Button, Input, Modal, Select, Tag, message } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Eye, RefreshCw, UserPlus } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

interface IDriver {
  accountId: string;
  name: string;
  status: string;
}

interface IConsultation {
  id: number;
  status: string;
  buyerName: string;
  contact: string;
  address: string;
  detailAddress?: string;
  preferredDateTime: string;
  desiredPrice?: string;
  additionalMemo?: string;
  source: string;
  assignedDriverId?: string | null;
  assignedDriverName?: string | null;
  adminMemo?: string;
  createdAt: ISO8601DateTime;
}

const statusConfig: Record<string, { color: string; label: string }> = {
  PENDING:    { color: "orange", label: "대기중" },
  CONSULTING: { color: "purple", label: "상담중" },
  ASSIGNED:   { color: "blue",   label: "배정완료" },
  COMPLETED:  { color: "green",  label: "완료" },
  CANCELLED:  { color: "red",    label: "취소" },
};

const ConsultationList = () => {
  const [data, setData] = useState<IConsultation[]>([]);
  const [drivers, setDrivers] = useState<IDriver[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<IConsultation | null>(null);
  const [tempStatus, setTempStatus] = useState("PENDING");
  const [tempMemo, setTempMemo] = useState("");
  const [selectedDriver, setSelectedDriver] = useState<{ id: string; name: string } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_ENDPOINT || 'http://localhost:4000/api/v1';

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/external/buyer-request/list`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      message.error("상담 목록 로드 실패");
    } finally {
      setIsLoading(false);
    }
  }, [API_BASE]);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/drivers`);
      const result = await res.json();
      setDrivers(Array.isArray(result) ? result : []);
    } catch {}
  }, [API_BASE]);

  useEffect(() => {
    fetchData();
    fetchDrivers();
  }, [fetchData, fetchDrivers]);

  const openModal = (record: IConsultation) => {
    setEditing(record);
    setTempStatus(record.status);
    setTempMemo(record.adminMemo || "");
    setSelectedDriver(record.assignedDriverId ? { id: record.assignedDriverId, name: record.assignedDriverName || "" } : null);
    setIsModalOpen(true);
  };

  const handleUpdate = async () => {
    if (!editing) return;
    setIsUpdating(true);
    try {
      await fetch(`${API_BASE}/external/buyer-request/${editing.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: tempStatus, adminMemo: tempMemo }),
      });

      if (selectedDriver && selectedDriver.id !== editing.assignedDriverId) {
        await fetch(`${API_BASE}/external/buyer-request/${editing.id}/assign`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedDriver.id, name: selectedDriver.name }),
        });
      }

      message.success("저장되었습니다.");
      setIsModalOpen(false);
      fetchData();
    } catch {
      message.error("저장 중 오류 발생");
    } finally {
      setIsUpdating(false);
    }
  };

  const columns: ColumnsType<IConsultation> = [
    {
      title: "관리",
      key: "action",
      width: 80,
      align: "center",
      render: (_, record) => (
        <Button size="small" icon={<Eye size={14} />} onClick={() => openModal(record)}>상세</Button>
      ),
    },
    {
      title: "신청자",
      dataIndex: "buyerName",
      render: (v: string) => <span className="font-bold">{v}</span>,
    },
    {
      title: "연락처",
      dataIndex: "contact",
    },
    {
      title: "차량 위치",
      dataIndex: "address",
      render: (v: string) => <span className="text-sm text-gray-600">{v}</span>,
    },
    {
      title: "희망 방문일",
      dataIndex: "preferredDateTime",
      render: (v: string) => <span className="text-sm">{v}</span>,
    },
    {
      title: "희망 가격",
      dataIndex: "desiredPrice",
      render: (v?: string) => v ? <span className="text-blue-600 font-medium">{v}</span> : <span className="text-gray-300">-</span>,
    },
    {
      title: "출처",
      dataIndex: "source",
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: "배정 진단사",
      dataIndex: "assignedDriverName",
      render: (v?: string) => v
        ? <Tag icon={<UserPlus size={12} />} color="blue">{v}</Tag>
        : <span className="text-gray-300">미배정</span>,
    },
    {
      title: "상태",
      dataIndex: "status",
      align: "center",
      render: (v: string) => {
        const c = statusConfig[v] || { color: "default", label: v };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: "접수일",
      dataIndex: "createdAt",
      render: (v: ISO8601DateTime) => dayjs(v).format("YYYY-MM-DD"),
    },
  ];

  return (
    <div className="p-4 bg-white rounded-lg shadow-sm">
      <DefaultTableBtn className="justify-between mb-4">
        <span className="text-gray-500">전체 {data.length}건</span>
        <Button type="primary" icon={<RefreshCw size={14} />} onClick={fetchData} loading={isLoading}>새로고침</Button>
      </DefaultTableBtn>

      <DefaultTable<IConsultation>
        columns={columns}
        dataSource={data}
        loading={isLoading}
        rowKey="id"
      />

      <Modal
        title={`상담 관리 - ${editing?.buyerName}`}
        open={isModalOpen}
        onOk={handleUpdate}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={isUpdating}
        okText="저장"
        cancelText="취소"
        width={520}
      >
        <div className="space-y-4 py-4">
          {/* 기본 정보 */}
          <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
            <p className="font-medium">{editing?.buyerName} ({editing?.contact})</p>
            <p className="text-gray-500">위치: {editing?.address} {editing?.detailAddress}</p>
            <p className="text-gray-500">방문 희망: {editing?.preferredDateTime}</p>
            {editing?.desiredPrice && <p className="text-blue-600">희망 가격: {editing.desiredPrice}</p>}
            {editing?.additionalMemo && (
              <p className="text-gray-500 mt-2 border-t pt-2">요청사항: {editing.additionalMemo}</p>
            )}
            <p className="text-gray-400">출처: <Tag>{editing?.source}</Tag></p>
          </div>

          {/* 상태 변경 */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">상태 변경</label>
            <Select
              className="w-full"
              value={tempStatus}
              onChange={setTempStatus}
              options={Object.keys(statusConfig).map(k => ({ value: k, label: statusConfig[k].label }))}
            />
          </div>

          {/* 진단사 배정 */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">진단사 배정</label>
            <Select
              className="w-full"
              placeholder="진단사 선택"
              value={selectedDriver?.id}
              onChange={(val, opt: any) => setSelectedDriver({ id: val, name: opt.label })}
              options={drivers.filter(d => d.status === 'APPROVED').map(d => ({ value: d.accountId, label: d.name }))}
              allowClear
              onClear={() => setSelectedDriver(null)}
            />
          </div>

          {/* 관리자 메모 */}
          <div>
            <label className="block text-xs font-bold text-gray-400 mb-1">관리자 메모</label>
            <Input.TextArea
              value={tempMemo}
              onChange={e => setTempMemo(e.target.value)}
              rows={3}
              placeholder="메모를 입력하세요."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default React.memo(ConsultationList);
