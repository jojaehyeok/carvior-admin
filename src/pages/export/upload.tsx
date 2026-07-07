import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Alert, Button, Card, Popconfirm, Table, Tag, Typography, Upload } from "antd";
import { InboxIcon, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

const CLASSIFY_API = "https://carvior.store/classify-api";
const { Dragger } = Upload;

const pageHeader: IPageHeader = { title: "수출 데이터 업로드" };

interface UploadRecord {
  id: number;
  filename: string;
  row_count: number;
  uploaded_at: string;
}

const ExportUploadPage: IDefaultLayoutPage = () => {
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchUploads = () => {
    fetch(`${CLASSIFY_API}/export/uploads`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => { if (Array.isArray(d)) setUploads(d); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setMessage(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${CLASSIFY_API}/export/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMessage({ type: "success", text: `✅ ${data.filename} — ${data.row_count}건 업로드 완료` });
        fetchUploads();
      } else {
        setMessage({ type: "error", text: data.detail || "업로드 실패" });
      }
    } catch {
      setMessage({ type: "error", text: "서버 연결 실패" });
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`${CLASSIFY_API}/export/uploads/${id}`, { method: "DELETE" });
      fetchUploads();
    } catch {}
  };

  const columns = [
    { title: "파일명", dataIndex: "filename", key: "filename" },
    { title: "건수", dataIndex: "row_count", key: "row_count", render: (v: number) => <Tag color="blue">{v}건</Tag> },
    {
      title: "업로드 일시",
      dataIndex: "uploaded_at",
      key: "uploaded_at",
      render: (v: string) => new Date(v).toLocaleString("ko-KR"),
    },
    {
      title: "",
      key: "actions",
      render: (_: any, record: UploadRecord) => (
        <Popconfirm title="이 업로드를 삭제하면 모든 차량 데이터가 함께 삭제됩니다." onConfirm={() => handleDelete(record.id)} okText="삭제" cancelText="취소">
          <Button danger size="small" icon={<Trash2 className="w-3 h-3" />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card title="엑셀 파일 업로드" size="small">
        <Typography.Paragraph type="secondary" className="mb-4">
          수출 원데이터 엑셀(.xlsx, .xls)을 업로드하세요. 브랜드, 모델, 연식, 주행거리, 매입가, 수출가, 수출국 등의 컬럼을 자동으로 인식합니다.
        </Typography.Paragraph>

        <Dragger
          accept=".xlsx,.xls"
          showUploadList={false}
          beforeUpload={handleUpload}
          disabled={uploading}
          style={{ padding: "20px" }}
        >
          <p className="ant-upload-drag-icon">
            <InboxIcon className="w-12 h-12 mx-auto text-purple-400" />
          </p>
          <p className="ant-upload-text">클릭하거나 파일을 드래그하여 업로드</p>
          <p className="ant-upload-hint">.xlsx 또는 .xls 파일만 허용됩니다</p>
        </Dragger>

        {message && (
          <Alert
            className="mt-4"
            type={message.type}
            message={message.text}
            closable
            onClose={() => setMessage(null)}
          />
        )}
      </Card>

      <Card title="업로드 이력" size="small">
        <Table
          dataSource={uploads}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: "업로드된 파일이 없습니다" }}
        />
      </Card>

      <Card title="컬럼 매핑 안내" size="small">
        <Typography.Paragraph type="secondary">
          아래 컬럼명(또는 유사한 이름)이 있으면 자동으로 인식됩니다:
        </Typography.Paragraph>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
          {[
            ["브랜드", "브랜드, 제조사, 메이커"],
            ["모델", "모델, 모델명, 차종"],
            ["연식", "연식, 연도, 제조연도"],
            ["트림", "트림, 등급, 세부모델"],
            ["주행거리", "주행거리, km, 키로수"],
            ["색상", "색상, 차색"],
            ["연료", "연료, 연료종류"],
            ["사고유무", "사고, 사고유무"],
            ["매입가", "매입가, 구매가, 매입금액"],
            ["수출가", "수출가, 수출금액, 판매가"],
            ["수출국", "수출국, 국가, destination"],
            ["수출일", "수출일, 수출날짜, 계약일"],
          ].map(([field, aliases]) => (
            <div key={field} className="border rounded p-2">
              <div className="font-semibold text-purple-700">{field}</div>
              <div className="text-gray-400 text-xs">{aliases}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

ExportUploadPage.getLayout = getDefaultLayout;
ExportUploadPage.pageHeader = pageHeader;

export default ExportUploadPage;
