import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Button, Image, Modal, Rate, Tag, Divider, Statistic, Row, Col, Card, Tabs } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import DefaultTable from "@/components/shared/ui/default-table";

const pageHeader: IPageHeader = { title: "CS 관리 / 리뷰" };

interface IReview {
  id: number;
  bookingId: number;
  driverId: string;
  driverName: string;
  carNumber: string;
  carOwner: string;
  rating: number;
  comment: string;
  photoUrls: string[];
  createdAt: string;
}

interface ICancelLog {
  id: number;
  driverId: string;
  driverName: string;
  bookingId: number;
  carNumber: string;
  carOwner: string;
  cancelReason: string;
  createdAt: string;
}

interface IAssignLogBooking {
  id: number;
  carNumber: string;
  address: string;
  assignedDriverName: string | null;
  autoAssignLog: Record<string, any> | null;
  createdAt: string;
}

const ratingColor = (r: number) =>
  r >= 4 ? "green" : r === 3 ? "orange" : "red";

const ReviewListPage: IDefaultLayoutPage = () => {
  const { data: session } = useSession();
  // COMPANY_ADMIN은 자사 의뢰만, SUPER_ADMIN(company: null)은 전체를 본다.
  const company = session?.user?.company ?? null;
  const API = process.env.NEXT_PUBLIC_API_ENDPOINT;

  // --- 리뷰 ---
  const [reviews, setReviews] = useState<IReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [selected, setSelected] = useState<IReview | null>(null);

  const fetchReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const url = new URL(`${API}/reviews`);
      if (company) url.searchParams.set('source', company);
      const res = await fetch(url.toString());
      const json = await res.json();
      setReviews(Array.isArray(json) ? json : []);
    } catch { /* ignore */ }
    finally { setReviewsLoading(false); }
  }, [API, company]);

  // --- CS(취소 로그) ---
  const [cancelLogs, setCancelLogs] = useState<ICancelLog[]>([]);
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchCancelLogs = useCallback(async () => {
    setCancelLoading(true);
    try {
      const url = new URL(`${API}/external/request/cancel-logs`);
      if (company) url.searchParams.set('source', company);
      const res = await fetch(url.toString());
      const json = await res.json();
      setCancelLogs(Array.isArray(json) ? json : []);
    } catch { /* ignore */ }
    finally { setCancelLoading(false); }
  }, [API, company]);

  // --- 배정 근거 ---
  const [assignLogBookings, setAssignLogBookings] = useState<IAssignLogBooking[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignLogTarget, setAssignLogTarget] = useState<IAssignLogBooking | null>(null);

  const fetchAssignLogs = useCallback(async () => {
    setAssignLoading(true);
    try {
      const url = new URL(`${API}/external/request/list`);
      if (company) url.searchParams.set('source', company);
      const res = await fetch(url.toString());
      const json = await res.json();
      const all: IAssignLogBooking[] = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
      setAssignLogBookings(all.filter(b => !!b.autoAssignLog).sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf()));
    } catch { /* ignore */ }
    finally { setAssignLoading(false); }
  }, [API, company]);

  useEffect(() => { fetchReviews(); fetchCancelLogs(); fetchAssignLogs(); }, [fetchReviews, fetchCancelLogs, fetchAssignLogs]);

  const todayReviews = reviews.filter(r => dayjs(r.createdAt).isSame(dayjs(), 'day'));
  const avgAll = reviews.length
    ? Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length * 10) / 10
    : 0;
  const avgToday = todayReviews.length
    ? Math.round(todayReviews.reduce((s, r) => s + r.rating, 0) / todayReviews.length * 10) / 10
    : 0;

  const reviewColumns: ColumnsType<IReview> = [
    {
      title: "상세",
      key: "action",
      width: 80,
      align: "center",
      render: (_, r) => (
        <Button size="small" onClick={() => setSelected(r)}>보기</Button>
      ),
    },
    {
      title: "별점",
      dataIndex: "rating",
      width: 120,
      align: "center",
      render: (v) => <Rate disabled defaultValue={v} style={{ fontSize: 14 }} />,
      sorter: (a, b) => a.rating - b.rating,
    },
    { title: "진단사", dataIndex: "driverName", render: (v) => v || "-" },
    { title: "차량번호", dataIndex: "carNumber" },
    { title: "차주", dataIndex: "carOwner", render: (v) => v || "-" },
    {
      title: "포토",
      dataIndex: "photoUrls",
      width: 60,
      align: "center",
      render: (urls: string[]) =>
        urls?.length ? <Tag color="blue">{urls.length}장</Tag> : <span className="text-gray-300">-</span>,
    },
    {
      title: "한줄평",
      dataIndex: "comment",
      render: (v) => <span className="text-sm text-slate-600">{v || "-"}</span>,
    },
    {
      title: "작성일",
      dataIndex: "createdAt",
      width: 120,
      render: (d) => dayjs(d).format("MM-DD HH:mm"),
    },
  ];

  const cancelColumns: ColumnsType<ICancelLog> = [
    { title: "진단사", dataIndex: "driverName", render: (v) => v || "-" },
    { title: "차량번호", dataIndex: "carNumber", render: (v) => v || "-" },
    { title: "차주", dataIndex: "carOwner", render: (v) => v || "-" },
    {
      title: "취소 사유",
      dataIndex: "cancelReason",
      render: (v) => <span className="text-sm text-slate-600">{v || "-"}</span>,
    },
    {
      title: "취소 일시",
      dataIndex: "createdAt",
      width: 140,
      render: (d) => dayjs(d).format("MM-DD HH:mm"),
    },
  ];

  const assignColumns: ColumnsType<IAssignLogBooking> = [
    { title: "차량번호", dataIndex: "carNumber", render: (v) => v || "-" },
    { title: "배정 진단사", dataIndex: "assignedDriverName", render: (v) => v || "-" },
    { title: "신청 주소", dataIndex: "address", render: (v) => <span className="text-sm text-slate-600">{v || "-"}</span> },
    {
      title: "선정 사유",
      key: "reason",
      render: (_, r) => <span className="text-sm text-slate-500">{String(r.autoAssignLog?.reason ?? "-")}</span>,
    },
    {
      title: "접수일",
      dataIndex: "createdAt",
      width: 140,
      render: (d) => dayjs(d).format("MM-DD HH:mm"),
    },
    {
      title: "상세",
      key: "action",
      width: 80,
      align: "center",
      render: (_, r) => <Button size="small" onClick={() => setAssignLogTarget(r)}>보기</Button>,
    },
  ];

  return (
    <div>
      <Tabs
        defaultActiveKey="cs"
        items={[
          {
            key: "cs",
            label: "CS",
            children: (
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-slate-500">총 {cancelLogs.length}건 (진단사 예약 취소 로그)</span>
                  <Button icon={<RefreshCw size={14} className={cancelLoading ? "animate-spin" : ""} />}
                    onClick={fetchCancelLogs} loading={cancelLoading}>새로고침</Button>
                </div>
                <DefaultTable<ICancelLog>
                  columns={cancelColumns}
                  dataSource={cancelLogs}
                  loading={cancelLoading}
                  rowKey="id"
                />
              </div>
            ),
          },
          {
            key: "review",
            label: "리뷰",
            children: (
              <div>
                <Row gutter={16} className="mb-6">
                  <Col span={6}>
                    <Card>
                      <Statistic title="전체 리뷰" value={reviews.length} suffix="건" />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic title="전체 평균 별점" value={avgAll} suffix="/ 5" precision={1}
                        valueStyle={{ color: avgAll >= 4 ? '#3f8600' : avgAll >= 3 ? '#cf6800' : '#cf1322' }} />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic title="오늘 리뷰" value={todayReviews.length} suffix="건" />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic title="오늘 평균 별점" value={avgToday} suffix="/ 5" precision={1}
                        valueStyle={{ color: avgToday >= 4 ? '#3f8600' : avgToday >= 3 ? '#cf6800' : '#cf1322' }} />
                    </Card>
                  </Col>
                </Row>

                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-slate-500">총 {reviews.length}건</span>
                    <Button icon={<RefreshCw size={14} className={reviewsLoading ? "animate-spin" : ""} />}
                      onClick={fetchReviews} loading={reviewsLoading}>새로고침</Button>
                  </div>

                  <DefaultTable<IReview>
                    columns={reviewColumns}
                    dataSource={reviews}
                    loading={reviewsLoading}
                    rowKey="id"
                    rowClassName={(r) =>
                      r.rating <= 2 ? "bg-red-50" : r.rating === 3 ? "bg-yellow-50" : ""
                    }
                  />
                </div>
              </div>
            ),
          },
          {
            key: "assign",
            label: "배정근거",
            children: (
              <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-slate-500">총 {assignLogBookings.length}건 (자동배정된 건만 표시)</span>
                  <Button icon={<RefreshCw size={14} className={assignLoading ? "animate-spin" : ""} />}
                    onClick={fetchAssignLogs} loading={assignLoading}>새로고침</Button>
                </div>
                <DefaultTable<IAssignLogBooking>
                  columns={assignColumns}
                  dataSource={assignLogBookings}
                  loading={assignLoading}
                  rowKey="id"
                />
              </div>
            ),
          },
        ]}
      />

      {/* 리뷰 상세 모달 */}
      <Modal
        title={`리뷰 상세 — ${selected?.carNumber}`}
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={<Button onClick={() => setSelected(null)}>닫기</Button>}
        width={560}
      >
        {selected && (
          <div className="py-2 space-y-4">
            <div className="flex items-center gap-4">
              <Rate disabled value={selected.rating} />
              <Tag color={ratingColor(selected.rating)}>
                {selected.rating}점
              </Tag>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">진단사</span><p className="font-semibold">{selected.driverName || "-"}</p></div>
              <div><span className="text-gray-400">차주</span><p className="font-semibold">{selected.carOwner || "-"}</p></div>
              <div><span className="text-gray-400">차량번호</span><p className="font-semibold">{selected.carNumber}</p></div>
              <div><span className="text-gray-400">작성일</span><p className="font-semibold">{dayjs(selected.createdAt).format("YYYY-MM-DD HH:mm")}</p></div>
            </div>
            {selected.comment && (
              <>
                <Divider plain>한줄평</Divider>
                <p className="text-slate-700 bg-gray-50 rounded p-3">{selected.comment}</p>
              </>
            )}
            {selected.photoUrls?.length > 0 && (
              <>
                <Divider plain>포토리뷰</Divider>
                <Image.PreviewGroup>
                  <div className="flex gap-2 flex-wrap">
                    {selected.photoUrls.map((url, i) => (
                      <Image key={i} src={url} width={150} height={150}
                        style={{ objectFit: "cover", borderRadius: 8 }} />
                    ))}
                  </div>
                </Image.PreviewGroup>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* 배정 근거 상세 모달 */}
      <Modal
        title={`배정 근거 — ${assignLogTarget?.carNumber}`}
        open={!!assignLogTarget}
        onCancel={() => setAssignLogTarget(null)}
        footer={<Button onClick={() => setAssignLogTarget(null)}>닫기</Button>}
        width={640}
      >
        {assignLogTarget?.autoAssignLog && (
          <div className="space-y-3 text-sm">
            <p className="text-gray-500">
              신청 주소: {String(assignLogTarget.autoAssignLog.bookingAddress ?? '-')}
            </p>
            {assignLogTarget.autoAssignLog.nearestKm != null && (
              <p className="text-gray-500">
                가장 가까운 진단사 기준 {String(assignLogTarget.autoAssignLog.nearestKm)}km, 반경 +{String(assignLogTarget.autoAssignLog.radiusKm)}km 이내 후보끼리 비교
              </p>
            )}
            <table className="w-full text-xs border border-gray-100 rounded overflow-hidden">
              <thead>
                <tr className="bg-gray-50 text-gray-500">
                  <th className="p-2 text-left">진단사</th>
                  <th className="p-2 text-right">거리</th>
                  <th className="p-2 text-right">오늘 배정건수</th>
                  <th className="p-2 text-center">비고</th>
                </tr>
              </thead>
              <tbody>
                {(assignLogTarget.autoAssignLog.candidates as Array<Record<string, any>> || []).map((c, idx) => (
                  <tr
                    key={idx}
                    className={`border-t border-gray-50 ${c.driverId === assignLogTarget.autoAssignLog?.chosenDriverId ? 'bg-purple-50 font-bold' : ''}`}
                  >
                    <td className="p-2">{c.driverName}</td>
                    <td className="p-2 text-right">{c.km != null ? `${c.km}km` : '-'}</td>
                    <td className="p-2 text-right">{c.todayCount}건</td>
                    <td className="p-2 text-center">
                      {c.driverId === assignLogTarget.autoAssignLog?.chosenDriverId
                        ? <Tag color="purple">선정</Tag>
                        : c.atCap ? <Tag color="default">마감</Tag> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-gray-600">
              <span className="font-bold">선정 사유:</span> {String(assignLogTarget.autoAssignLog.reason ?? '-')}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

ReviewListPage.getLayout = getDefaultLayout;
ReviewListPage.pageHeader = pageHeader;
export default ReviewListPage;
