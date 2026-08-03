'use client';

import DefaultTable from "@/components/shared/ui/default-table";
import { Button, Divider, Image, Input, InputNumber, message, Modal, Popconfirm, Select, Statistic, Tag } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { CheckCircle, RefreshCw, UserCog, XCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

type DriverTier = 'general' | 'certified' | 'agent';

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
  tier?: DriverTier;
}

const TIER_CONFIG: Record<DriverTier, { color: string; label: string }> = {
  general: { color: "default", label: "일반" },
  certified: { color: "blue", label: "진단평가사" },
  agent: { color: "purple", label: "에이전트" },
};

interface ICancelStats {
  totalAssigned: number;
  totalCancelled: number;
  cancelRate: number;
  reasonCounts: Record<string, number>;
  recentLogs: { carNumber: string; carOwner: string; cancelReason: string; createdAt: string }[];
}

interface IDriverPenalty {
  id: number;
  driverId: string;
  driverName: string;
  type: 'penalty' | 'advantage';
  reason: string | null;
  bookingId: number | null;
  createdAt: string;
  expiresAt: string;
}

const DriverList = () => {
  const [data, setData] = useState<IDriver[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState<IDriver | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cancelStats, setCancelStats] = useState<ICancelStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [tempTier, setTempTier] = useState<DriverTier>('general');
  const [savingTier, setSavingTier] = useState(false);
  const [penalties, setPenalties] = useState<IDriverPenalty[]>([]);
  const [newPenaltyType, setNewPenaltyType] = useState<'penalty' | 'advantage'>('penalty');
  const [newPenaltyDays, setNewPenaltyDays] = useState(7);
  const [newPenaltyReason, setNewPenaltyReason] = useState('');
  const [savingPenalty, setSavingPenalty] = useState(false);

  const { data: session } = useSession();
  // 자동배정 페널티/우대 수동 부여는 슈퍼관리자만 — 발주사 계정에는 노출하지 않는다
  const isSuperAdmin = !session?.user?.company;

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
    setPenalties([]);
    setNewPenaltyReason('');
    setTempTier(driver.tier || 'general');
    setIsModalOpen(true);
    setStatsLoading(true);
    try {
      const res = await fetch(`${API}/external/request/driver/${driver.accountId}/cancel-stats`);
      if (res.ok) setCancelStats(await res.json());
    } catch { /* 통계 실패해도 모달은 열림 */ }
    finally { setStatsLoading(false); }
    fetchPenalties(driver);
  };

  // 페널티/우대는 driverId(문자열, Driver.id 기준)로 저장되므로 accountId가 아닌 id로 필터링
  const fetchPenalties = async (driver: IDriver) => {
    try {
      const res = await fetch(`${API}/external/request/driver-penalties`);
      if (!res.ok) return;
      const all: IDriverPenalty[] = await res.json();
      setPenalties(all.filter(p => String(p.driverId) === String(driver.id)));
    } catch { /* 조회 실패해도 모달은 정상 동작 */ }
  };

  const handleAddPenalty = async () => {
    if (!selectedDriver) return;
    setSavingPenalty(true);
    try {
      const res = await fetch(`${API}/external/request/driver-penalty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: String(selectedDriver.id),
          type: newPenaltyType,
          days: newPenaltyDays,
          reason: newPenaltyReason.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      message.success(newPenaltyType === 'penalty' ? '페널티를 부여했습니다.' : '우대를 부여했습니다.');
      setNewPenaltyReason('');
      fetchPenalties(selectedDriver);
    } catch {
      message.error('처리 중 오류가 발생했습니다.');
    } finally {
      setSavingPenalty(false);
    }
  };

  const handleDeletePenalty = async (id: number) => {
    try {
      const res = await fetch(`${API}/external/request/driver-penalty/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      message.success('삭제했습니다.');
      setPenalties(prev => prev.filter(p => p.id !== id));
    } catch {
      message.error('삭제 중 오류가 발생했습니다.');
    }
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

  // 등급 변경 — 진단비 정산(settlement-history)에서 등급별 기본 진단비를 정하는 기준이 됨
  const handleSaveTier = async () => {
    if (!selectedDriver) return;
    setSavingTier(true);
    try {
      const res = await fetch(`${API}/drivers/${selectedDriver.id}/tier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: tempTier }),
      });
      if (!res.ok) throw new Error();
      message.success('등급이 변경되었습니다.');
      fetchDrivers();
    } catch {
      message.error('등급 변경 중 오류가 발생했습니다.');
    } finally {
      setSavingTier(false);
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
      title: "등급",
      dataIndex: "tier",
      align: 'center',
      render: (tier?: DriverTier) => {
        const config = TIER_CONFIG[tier || 'general'];
        return <Tag color={config.color}>{config.label}</Tag>;
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

            {/* 등급 관리 — 정산(settlement-history)의 등급별 기본 진단비 기준이 됨 */}
            <Divider plain>등급 관리</Divider>
            <div className="flex items-center gap-2">
              <Select<DriverTier>
                className="flex-1"
                value={tempTier}
                onChange={setTempTier}
                options={(Object.keys(TIER_CONFIG) as DriverTier[]).map(t => ({ value: t, label: TIER_CONFIG[t].label }))}
              />
              <Button
                type="primary"
                loading={savingTier}
                disabled={tempTier === (selectedDriver.tier || 'general')}
                onClick={handleSaveTier}
              >
                저장
              </Button>
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

            {/* 자동배정 페널티 / 우대 — 페널티는 자동배정 로드밸런싱에서 가상 건수를 더해 뒤로 밀고,
                우대는 반대로 빼서 우선순위를 높인다. 부여/삭제는 슈퍼관리자만 가능. */}
            <Divider plain>자동배정 페널티 / 우대</Divider>
            <div className="space-y-3">
              {penalties.length > 0 ? (
                <div className="space-y-1.5">
                  {penalties.map(p => (
                    <div key={p.id} className="flex justify-between items-center text-xs bg-gray-50 rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Tag color={p.type === 'penalty' ? 'red' : 'blue'}>{p.type === 'penalty' ? '페널티' : '우대'}</Tag>
                        <span className="text-gray-600">{p.reason || (p.bookingId ? `건 #${p.bookingId} 재배정으로 자동 부여` : '-')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300">~{dayjs(p.expiresAt).format('MM/DD')}</span>
                        {isSuperAdmin && (
                          <Popconfirm title="삭제할까요?" onConfirm={() => handleDeletePenalty(p.id)} okText="삭제" cancelText="취소">
                            <Button size="small" danger type="text">삭제</Button>
                          </Popconfirm>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-300 text-sm">현재 적용 중인 페널티/우대가 없습니다.</p>
              )}

              {isSuperAdmin && (
                <div className="flex flex-wrap items-center gap-2 bg-gray-50 rounded-lg p-3">
                  <Select
                    value={newPenaltyType}
                    onChange={setNewPenaltyType}
                    style={{ width: 100 }}
                    options={[{ value: 'penalty', label: '페널티' }, { value: 'advantage', label: '우대' }]}
                  />
                  <InputNumber min={1} max={90} value={newPenaltyDays} onChange={(v) => setNewPenaltyDays(v || 7)} addonAfter="일" style={{ width: 110 }} />
                  <Input placeholder="사유 (선택)" value={newPenaltyReason} onChange={(e) => setNewPenaltyReason(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
                  <Button type="primary" loading={savingPenalty} onClick={handleAddPenalty}>부여</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DriverList;
