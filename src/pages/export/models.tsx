import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Alert, Card, Input, Skeleton, Table, Tag } from "antd";
import { useEffect, useState } from "react";

const CLASSIFY_API = "https://carvior.store/classify-api";

const pageHeader: IPageHeader = { title: "차량 수출 데이터" };

interface Car {
  id: number;
  brand: string | null;
  model: string | null;
  year: number | null;
  trim: string | null;
  mileage: number | null;
  color: string | null;
  fuel: string | null;
  accident: boolean;
  purchase_price_krw: number | null;
  export_price_usd: number | null;
  export_country: string | null;
  export_date: string | null;
  profit_usd: number | null;
  notes: string | null;
}

interface CarResponse {
  total: number;
  page: number;
  page_size: number;
  cars: Car[];
}

const ExportModelsPage: IDefaultLayoutPage = () => {
  const [data, setData] = useState<CarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [country, setCountry] = useState("");
  const [page, setPage] = useState(1);

  const fetchCars = (p = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), page_size: "50" });
    if (brand) params.append("brand", brand);
    if (model) params.append("model", model);
    if (country) params.append("country", country);

    fetch(`${CLASSIFY_API}/export/cars?${params}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => {
        if (d && Array.isArray(d.cars)) { setData(d); setError(false); }
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCars(page);
  }, [page]);

  const handleSearch = () => {
    setPage(1);
    fetchCars(1);
  };

  const columns = [
    { title: "브랜드", dataIndex: "brand", key: "brand", render: (v: string) => v || "-" },
    { title: "모델", dataIndex: "model", key: "model", render: (v: string) => <strong>{v || "-"}</strong> },
    { title: "연식", dataIndex: "year", key: "year", render: (v: number) => v || "-" },
    { title: "트림", dataIndex: "trim", key: "trim", render: (v: string) => v || "-" },
    {
      title: "주행거리",
      dataIndex: "mileage",
      key: "mileage",
      render: (v: number) => v ? `${v.toLocaleString()}km` : "-",
    },
    { title: "연료", dataIndex: "fuel", key: "fuel", render: (v: string) => v || "-" },
    {
      title: "사고",
      dataIndex: "accident",
      key: "accident",
      render: (v: boolean) => v ? <Tag color="red">사고</Tag> : <Tag color="green">무사고</Tag>,
    },
    {
      title: "매입가 (KRW)",
      dataIndex: "purchase_price_krw",
      key: "purchase_price_krw",
      render: (v: number) => v ? `₩${v.toLocaleString()}` : "-",
    },
    {
      title: "수출가 (USD)",
      dataIndex: "export_price_usd",
      key: "export_price_usd",
      render: (v: number) => v ? `$${v.toLocaleString()}` : "-",
    },
    { title: "수출국", dataIndex: "export_country", key: "export_country", render: (v: string) => v || "-" },
    { title: "수출일", dataIndex: "export_date", key: "export_date", render: (v: string) => v || "-" },
    {
      title: "수익 (USD)",
      dataIndex: "profit_usd",
      key: "profit_usd",
      render: (v: number) => {
        if (!v) return "-";
        return <Tag color={v >= 0 ? "green" : "red"}>${v.toLocaleString()}</Tag>;
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card size="small">
        <div className="flex flex-wrap gap-3 mb-4">
          <Input
            placeholder="브랜드"
            value={brand}
            onChange={e => setBrand(e.target.value)}
            style={{ width: 140 }}
            onPressEnter={handleSearch}
          />
          <Input
            placeholder="모델명"
            value={model}
            onChange={e => setModel(e.target.value)}
            style={{ width: 160 }}
            onPressEnter={handleSearch}
          />
          <Input
            placeholder="수출국"
            value={country}
            onChange={e => setCountry(e.target.value)}
            style={{ width: 140 }}
            onPressEnter={handleSearch}
          />
          <button
            onClick={handleSearch}
            className="px-4 py-1.5 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
          >
            검색
          </button>
        </div>

        {error && <Alert type="error" message="데이터를 불러오지 못했습니다" className="mb-4" />}

        {loading ? (
          <Skeleton active />
        ) : (
          <Table
            dataSource={data?.cars ?? []}
            columns={columns}
            rowKey="id"
            size="small"
            scroll={{ x: 1200 }}
            pagination={{
              total: data?.total ?? 0,
              pageSize: 50,
              current: page,
              onChange: p => setPage(p),
              showTotal: total => `총 ${total}건`,
            }}
          />
        )}
      </Card>
    </div>
  );
};

ExportModelsPage.getLayout = getDefaultLayout;
ExportModelsPage.pageHeader = pageHeader;

export default ExportModelsPage;
