'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import { Button, Divider, Image, message, Modal, Tag } from "antd";
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

const DriverList = () => {
  const [data, setData] = useState<IDriver[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ 모달 상태 관리
  const [selectedDriver, setSelectedDriver] = useState<IDriver | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. 데이터 호출
  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_ENDPOINT}/drivers`);
      if (!response.ok) throw new Error('서버 응답 에러');
      const result = await response.json();
      const finalData = Array.isArray(result) ? result : (result.data || []);
      setData(finalData);
    } catch (err) {
      console.error(err);
      message.error("드라이버 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrivers(); }, [fetchDrivers]);

  // 2. 승인/거절 처리 함수
  const handleUpdateStatus = async (id: number, status: 'approve' | 'reject') => {
    try {
      // 백엔드 엔드포인트: /api/v1/drivers/:id/approve (아까 로그에서 확인된 경로)
      const endpoint = `${process.env.NEXT_PUBLIC_API_ENDPOINT}/drivers/${id}/${status}`;
      const response = await fetch(endpoint, { method: 'PATCH' });

      if (response.ok) {
        message.success(`${status === 'approve' ? '승인' : '거절'} 처리가 완료되었습니다.`);
        setIsModalOpen(false);
        fetchDrivers(); // 목록 새로고침
      } else {
        message.error("처리 실패");
      }
    } catch (err) {
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
        <Button
          size="small"
          icon={<UserCog size={14} />}
          onClick={() => {
            setSelectedDriver(record);
            setIsModalOpen(true);
          }}
        >
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
        const config: { [key: string]: { color: string; text: string } } = {
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
        <Button
          icon={<RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />}
          onClick={fetchDrivers}
          loading={isLoading}
        >
          새로고침
        </Button>
      </div>

      <DefaultTable<IDriver>
        columns={columns}
        dataSource={data}
        loading={isLoading}
        rowKey="id"
      />

      {/* ✅ 상세 보기 및 승인/거절 모달 */}
      <Modal
        title={`${selectedDriver?.name} 진단사 상세 정보`}
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setIsModalOpen(false)}>닫기</Button>,
          <Button key="reject" danger icon={<XCircle size={14} />} onClick={() => handleUpdateStatus(selectedDriver!.id, 'reject')}>
            거절
          </Button>,
          <Button key="approve" type="primary" icon={<CheckCircle size={14} />} onClick={() => handleUpdateStatus(selectedDriver!.id, 'approve')}>
            승인하기
          </Button>,
        ]}
      >
        {selectedDriver && (
          <div className="py-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-gray-400 text-xs">아이디</p>
                <p className="font-semibold">{selectedDriver.accountId}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">연락처</p>
                <p className="font-semibold">{selectedDriver.phone}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">활동 지역</p>
                <p className="font-semibold">{selectedDriver.region || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">경력 사항</p>
                <p className="font-semibold whitespace-pre-wrap">{selectedDriver.experience || '-'}</p>
              </div>
            </div>
            <Divider plain>자격증 / 경력 사진</Divider>
            <div className="flex justify-center bg-gray-50 p-4 rounded-lg">
              <Image
                alt="자격증 이미지"
                src={
                  selectedDriver.licenseImageUrl?.startsWith('https://')
                    ? selectedDriver.licenseImageUrl
                    : selectedDriver.licenseImageUrl
                      ? `${process.env.NEXT_PUBLIC_API_ENDPOINT!.replace('/api/v1', '')}/${selectedDriver.licenseImageUrl}`
                      : undefined
                }
                fallback="https://via.placeholder.com/400x250?text=No+Image"
                className="max-h-[300px] object-contain shadow-md"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DriverList;