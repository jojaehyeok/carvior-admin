import { useRouter } from "next/router";
import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import BookingList from "@/components/page/booking/booking-list";
import BookingSearch from "@/components/page/booking/booking-search";

const pageHeader: IPageHeader = { title: "자체 진단 목록" };

// source가 "self-{company}"(예: self-anyone-motors)로 접수된 건만 필터링해서 보여줌 —
// 발주사가 외부 딜러 신청이 아니라 자체적으로 접수한 진단 건 전용.
const SelfDiagnosisPage: IDefaultLayoutPage = () => {
  const router = useRouter();
  const company = typeof router.query.company === "string" ? router.query.company : undefined;

  return (
    <div className="flex flex-col gap-6">
      <BookingSearch />
      <BookingList companyFilter={company ? `self-${company}` : undefined} />
    </div>
  );
};

SelfDiagnosisPage.getLayout = getDefaultLayout;
SelfDiagnosisPage.pageHeader = pageHeader;
export default SelfDiagnosisPage;
