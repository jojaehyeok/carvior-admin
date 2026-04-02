'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import { Button, Divider, Image, message, Modal, Statistic, Tag } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { CheckCircle, RefreshCw, UserCog, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface IDriver {
  id: number;
  accountId: string;
  name: string;
  phone: string;
  region: string;
  experience: string;
  status: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'BANNED' | 'REJECTED';
  licenseImageUrl: string;
  createdAt: string;
}

interface ICancelStats {
  totalAssigned: number;
  totalCancelled: number;
  cancelRate: number;
  reasonCounts: Record<string, number>;
  recentLogs: { carNumber: string; carOwner: string; cancelReason: string; createdAt: string }[];
}

const DriverList = () => {
  const [data, setData] = useState<IDriver[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<IDriver | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cancelStats, setCancelStats] = useState<ICancelStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_ENDPOINT;

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API}/drivers`);
      if (!response.ok) throw new Error();
      const result = await response.json();
      setData(Array.isArray(result) ? result : (result.data || []));
    } catch {
      message.error("드라이버 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [API]);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  const openModal = async (driver: IDriver) => {
    setSelectedDriver(driver);
    setCancelStats(null);
    setIsModalOpen(true);
    setStatsLoading(true);
    try {
      const res = await fetch(`${API}/external/request/driver/${driver.accountId}/cancel-stats`);
      if (res.ok) setCancelStats(await res.json());
    } catch { /* 통계 실패해도 모달은 열림 */ }
    finally { setStatsLoading(false); }
  };

  const handleUpdateStatus = async (id: number, status: 'approve' | 'reject') => {
    try {
      const res = await fetch(`${API}/drivers/${id}/${status}`, { method: 'PATCH' });
      if (res.ok) {
        message.success(`${status === 'approve' ? '승인' : '거절'} 처리 완료`);
        setIsModalOpen(false);
        fetchDrivers();
      } else {
        message.error("처리 실패");
      }
    } catch {
      message.error("통신 오류 발생");
    }
  };

  const columns: ColumnsType<IDriver> = [
    {
      title: "관리",
      key: "action",
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Button size="small" icon={<UserCog size={14} />} onClick={() => openModal(record)}>
          상세보기
        </Button>
      ),
    },
    { title: "번호", dataIndex: "id", width: 70, align: 'center' },
    { title: "아이디", dataIndex: "accountId", className: "font-medium text-slate-700" },
    { title: "성함", dataIndex: "name", className: "font-bold" },
    { title: "연락처", dataIndex: "phone" },
    {
      title: "상태",
      dataIndex: "status",
      align: 'center',
      render: (status: string) => {
        const config: Record<string, { color: string; text: string }> = {
          PENDING: { color: "orange", text: "승인대기" },
          APPROVED: { color: "blue", text: "승인완료" },
          ACTIVE: { color: "green", text: "활동중" },
          BANNED: { color: "red", text: "활동정지" },
          REJECTED: { color: "volcano", text: "거절됨" },
        };
        const s = config[status] || { color: "default", text: status };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    {
      title: "등록일",
      dataIndex: "createdAt",
      render: (date) => dayjs(date).format("YYYY-MM-DD"),
    },
  ];

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm text-slate-500">총 {data.length}명</span>
        <Button icon={<RefreshCw size={14} />} onClick={fetchDrivers} loading={isLoading}>새로고침</Button>
      </div>

      <DefaultTable<IDriver> columns={columns} dataSource={data} loading={isLoading} rowKey="id" />

      <Modal
        title={`${selectedDriver?.name} 진단사 상세 정보`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        width={600}
        footer={[
          <Button key="close" onClick={() => setIsModalOpen(false)}>닫기</Button>,
          <Button key="reject" danger icon={<XCircle size={14} />} onClick={() => handleUpdateStatus(selectedDriver!.id, 'reject')}>거절</Button>,
          <Button key="approve" type="primary" icon={<CheckCircle size={14} />} onClick={() => handleUpdateStatus(selectedDriver!.id, 'approve')}>승인하기</Button>,
        ]}
      >
        {selectedDriver && (
          <div className="py-4 space-y-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <div><p className="text-gray-400 text-xs">아이디</p><p className="font-semibold">{selectedDriver.accountId}</p></div>
              <div><p className="text-gray-400 text-xs">연락처</p><p className="font-semibold">{selectedDriver.phone}</p></div>
              <div><p className="text-gray-400 text-xs">활동 지역</p><p className="font-semibold">{selectedDriver.region || '-'}</p></div>
              <div><p className="text-gray-400 text-xs">경력 사항</p><p className="font-semibold whitespace-pre-wrap">{selectedDriver.experience || '-'}</p></div>
            </div>

            <Divider plain>자격증 / 경력 사진</Divider>
            <div className="flex justify-center bg-gray-50 p-4 rounded-lg">
              <Image
                alt="자격증 이미지"
                src={selectedDriver.licenseImageUrl?.startsWith('https://') ? selectedDriver.licenseImageUrl : selectedDriver.licenseImageUrl ? `${API!.replace('/api/v1', '')}/${selectedDriver.licenseImageUrl}` : undefined}
                fallback="https://via.placeholder.com/400x250?text=No+Image"
                className="max-h-[300px] object-contain shadow-md"
              />
            </div>

            {/* 취소 통계 */}
            <Divider plain>예약 수락 / 취소 통계</Divider>
            {statsLoading ? (
              <p className="text-center text-gray-400 text-sm">통계 불러오는 중...</p>
            ) : cancelStats ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-lg p-3">
                  <Statistic title="총 배정" value={cancelStats.totalAssigned} suffix="건" />
                  <Statistic title="취소" value={cancelStats.totalCancelled} suffix="건" valueStyle={{ color: cancelStats.totalCancelled > 0 ? '#cf1322' : undefined }} />
                  <Statistic title="취소율" value={cancelStats.cancelRate} suffix="%" valueStyle={{ color: cancelStats.cancelRate >= 30 ? '#cf1322' : cancelStats.cancelRate >= 10 ? '#d46b08' : '#3f8600' }} />
                </div>
                {Object.keys(cancelStats.reasonCounts).length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2 font-bold">취소 사유</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(cancelStats.reasonCounts).map(([reason, count]) => (
                        <Tag key={reason} color="red">{reason} ({count}건)</Tag>
                      ))}
                    </div>
                  </div>
                )}
                {cancelStats.recentLogs.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-2 font-bold">최근 취소 이력</p>
                    <div className="space-y-1">
                      {cancelStats.recentLogs.map((log, i) => (
                        <div key={i} className="flex justify-between items-center text-xs bg-red-50 rounded px-3 py-1.5">
                          <span className="font-medium">{log.carNumber} · {log.carOwner}</span>
                          <span className="text-gray-400">{log.cancelReason}</span>
                          <span className="text-gray-300">{dayjs(log.createdAt).format('MM/DD')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {cancelStats.totalCancelled === 0 && (
                  <p className="text-center text-green-600 text-sm font-medium">✅ 취소 이력 없음</p>
                )}
              </div>
            ) : (
              <p className="text-center text-gray-300 text-sm">통계를 불러올 수 없습니다.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DriverList;
