import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { Button, Input, Spin, message } from "antd";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_ENDPOINT || 'https://carvior.store/api/v1';
const INTERNAL_KEY = process.env.NEXT_PUBLIC_STORE_ITEMS_INTERNAL_KEY ?? '';
const INTERNAL_HEADERS = { 'x-internal-key': INTERNAL_KEY };

const pageHeader: IPageHeader = { title: "리포트 수정" };

const ReportEditPage: IDefaultLayoutPage = () => {
  const router = useRouter();
  const { bookingId } = router.query;
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    carNumber: '', carModel: '', mileage: '', color: '', repairCost: '',
    memo: '', warningDesc: '', leakDesc: '', optionsDesc: '', driveDesc: '',
  });

  useEffect(() => {
    if (!bookingId) return;
    setLoading(true);
    fetch(`${API_BASE}/external/inspection/report/${bookingId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { setNotFound(true); return; }
        setForm({
          carNumber: data?.car_info?.number ?? '',
          carModel: data?.car_info?.type ?? '',
          mileage: data?.car_info?.mileage != null ? String(data.car_info.mileage) : '',
          color: data?.car_info?.color ?? '',
          repairCost: data?.car_info?.repairCost != null ? String(data.car_info.repairCost) : '',
          memo: data?.evaluation?.memo ?? '',
          warningDesc: data?.evaluation?.warningDesc ?? '',
          leakDesc: data?.evaluation?.leakDesc ?? '',
          optionsDesc: data?.evaluation?.optionsDesc ?? '',
          driveDesc: data?.evaluation?.driveDesc ?? '',
        });
      })
      .catch(() => message.error('리포트 조회 실패'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  const handleSave = async () => {
    if (!bookingId) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/external/inspection/${bookingId}/report-fields`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...INTERNAL_HEADERS },
        body: JSON.stringify({
          carNumber: form.carNumber,
          carModel: form.carModel,
          mileage: form.mileage ? Number(form.mileage) : undefined,
          color: form.color,
          repairCost: form.repairCost ? Number(form.repairCost) : undefined,
          memo: form.memo,
          inspectionDetails: {
            warningDesc: form.warningDesc,
            leakDesc: form.leakDesc,
            optionsDesc: form.optionsDesc,
            driveDesc: form.driveDesc,
          },
        }),
      });
      if (!res.ok) throw new Error();
      message.success('리포트가 수정되었습니다.');
      router.back();
    } catch {
      message.error('리포트 수정 실패');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Spin size="large" tip="로딩 중…" /></div>;
  }
  if (notFound) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>진단 내역을 찾을 수 없습니다.</p>
        <Button className="mt-4" onClick={() => router.back()}>← 돌아가기</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Button onClick={() => router.back()} size="small">← 목록</Button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">
            리포트 수정 — <span className="text-violet-600">{form.carNumber || '차량번호 미상'}</span>
          </h1>
          <p className="text-xs text-gray-400">진단 완료 후 4시간까지만 수정 가능합니다.</p>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* 왼쪽: 차량 기본 정보 */}
        <div className="w-[35%] flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-bold text-gray-500 mb-3">차량 기본 정보</p>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">차량번호</label>
                <Input value={form.carNumber} onChange={e => setForm(f => ({ ...f, carNumber: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">차종/모델</label>
                <Input value={form.carModel} onChange={e => setForm(f => ({ ...f, carModel: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">주행거리 (km)</label>
                <Input value={form.mileage} onChange={e => setForm(f => ({ ...f, mileage: e.target.value.replace(/[^0-9]/g, '') }))} />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">색상</label>
                <Input value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">수리비 (원)</label>
                <Input value={form.repairCost} onChange={e => setForm(f => ({ ...f, repairCost: e.target.value.replace(/[^0-9]/g, '') }))} />
              </div>
            </div>
          </div>
        </div>

        {/* 오른쪽: 평가 내용 */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 p-5 sticky top-4">
          <p className="text-xs font-bold text-gray-500 mb-3">평가 내용</p>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">경고등</label>
              <Input.TextArea rows={2} value={form.warningDesc} onChange={e => setForm(f => ({ ...f, warningDesc: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">누유</label>
              <Input.TextArea rows={2} value={form.leakDesc} onChange={e => setForm(f => ({ ...f, leakDesc: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">옵션</label>
              <Input.TextArea rows={2} value={form.optionsDesc} onChange={e => setForm(f => ({ ...f, optionsDesc: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">주행</label>
              <Input.TextArea rows={2} value={form.driveDesc} onChange={e => setForm(f => ({ ...f, driveDesc: e.target.value }))} />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider mb-1.5 block">진단 메모</label>
              <Input.TextArea rows={3} value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 mt-4">
            <Button
              type="primary"
              size="large"
              block
              loading={saving}
              onClick={handleSave}
              style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
            >
              저장
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

ReportEditPage.getLayout = getDefaultLayout;
ReportEditPage.pageHeader = pageHeader;

export default ReportEditPage;
