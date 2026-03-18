'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import DefaultTableBtn from "@/components/shared/ui/default-table-btn";
import { ISO8601DateTime } from "@/types/common";
import { Button, Dropdown, Input, Modal, Select, Tag, message } from "antd"; // Modal, Input, Select, message 추가
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { Download, Eye } from "lucide-react";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useState } from "react";

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
  createdAt: ISO8601DateTime;
}

const BookingList = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [data, setData] = useState<IBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const router = useRouter();

  // --- 팝업 제어를 위한 상태 ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<IBooking | null>(null);
  const [tempMemo, setTempMemo] = useState("");
  const [tempStatus, setTempStatus] = useState<IBooking['status']>('PENDING');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:4000/api/v1/external/request/list');
      const result = await response.json();
      setData(result);
      setError(false);
    } catch (err) {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  // --- 💾 업데이트 저장 로직 ---
  const handleUpdate = async () => {
    if (!editingBooking) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`http://localhost:4000/api/v1/external/request/${editingBooking.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: tempStatus,
          adminMemo: tempMemo
        })
      });

      if (res.ok) {
        message.success("변경사항이 저장되었습니다.");
        setIsModalOpen(false);
        fetchBookings(); // 목록 새로고침
      } else {
        message.error("저장에 실패했습니다.");
      }
    } catch (e) {
      message.error("서버 통신 오류");
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
    {
      title: "관리자 메모",
      dataIndex: "adminMemo",
      ellipsis: true,
      render: (value: string) => <span className="text-xs text-gray-400">{value || "-"}</span>,
    },
  ];

  return (
    <>
      <DefaultTableBtn className="justify-between">
        <div className="flex items-center gap-2">
          <Dropdown disabled={selectedRowKeys.length === 0} menu={{ items: [{ key: '1', label: '일괄 변경' }] }}>
            <Button size="middle">일괄작업</Button>
          </Dropdown>
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

      {/* --- 상세 정보 및 관리자 메모 수정 모달 --- */}
      <Modal
        title={`진단 신청 상세 정보 (${editingBooking?.carNumber})`}
        open={isModalOpen}
        onOk={handleUpdate}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={isUpdating}
        okText="저장하기"
        cancelText="닫기"
        width={600}
      >
        <div className="py-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-xl">
            <div><p className="text-xs text-gray-400">딜러/상사</p><p className="font-bold">{editingBooking?.dealerName}</p></div>
            <div><p className="text-xs text-gray-400">연락처</p><p className="font-bold">{editingBooking?.contact}</p></div>
            <div className="col-span-2"><p className="text-xs text-gray-400">주소</p><p className="font-bold">{editingBooking?.address}</p></div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">진행 상태 변경</label>
            <Select
              className="w-full"
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

          <div>
            <label className="block text-sm font-medium mb-1">관리자 메모</label>
            <Input.TextArea
              rows={4}
              value={tempMemo}
              onChange={(e) => setTempMemo(e.target.value)}
              placeholder="진단사 정보 등을 입력하세요."
            />
          </div>
        </div>
      </Modal>
    </>
  );
};

export default React.memo(BookingList);