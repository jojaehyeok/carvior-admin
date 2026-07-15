import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Button, Image, Modal, Rate, Tag, Divider, Statistic, Row, Col, Card } from "antd";
import { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { RefreshCw, Star } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

const ratingColor = (r: number) =>
  r >= 4 ? "green" : r === 3 ? "orange" : "red";

const ReviewListPage: IDefaultLayoutPage = () => {
  const [data, setData] = useState<IReview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<IReview | null>(null);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_ENDPOINT}/reviews`);
      const json = await res.json();
      setData(Array.isArray(json) ? json : []);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const todayReviews = data.filter(r => dayjs(r.createdAt).isSame(dayjs(), 'day'));
  const avgAll = data.length
    ? Math.round(data.reduce((s, r) => s + r.rating, 0) / data.length * 10) / 10
    : 0;
  const avgToday = todayReviews.length
    ? Math.round(todayReviews.reduce((s, r) => s + r.rating, 0) / todayReviews.length * 10) / 10
    : 0;

  const columns: ColumnsType<IReview> = [
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

  return (
    <div>
      {/* 요약 통계 */}
      <Row gutter={16} className="mb-6">
        <Col span={6}>
          <Card>
            <Statistic title="전체 리뷰" value={data.length} suffix="건" />
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
          <span className="text-sm text-slate-500">총 {data.length}건</span>
          <Button icon={<RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />}
            onClick={fetchReviews} loading={isLoading}>새로고침</Button>
        </div>

        <DefaultTable<IReview>
          columns={columns}
          dataSource={data}
          loading={isLoading}
          rowKey="id"
          rowClassName={(r) =>
            r.rating <= 2 ? "bg-red-50" : r.rating === 3 ? "bg-yellow-50" : ""
          }
        />
      </div>

      {/* 상세 모달 */}
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
    </div>
  );
};

ReviewListPage.getLayout = getDefaultLayout;
ReviewListPage.pageHeader = pageHeader;
export default ReviewListPage;
