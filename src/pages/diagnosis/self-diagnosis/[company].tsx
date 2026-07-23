import { useRouter } from "next/router";
import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import BookingList from "@/components/page/booking/booking-list";
import BookingSearch from "@/components/page/booking/booking-search";

const pageHeader: IPageHeader = { title: "자체 진단 목록" };

// 일단은 진단 신청목록과 동일한 내용(같은 BookingList/BookingSearch) — 나중에
// "자체 진단"만 따로 구분해서 보여주도록 필터링 로직을 추가할 예정.
const SelfDiagnosisPage: IDefaultLayoutPage = () => {
  const router = useRouter();
  const company = typeof router.query.company === "string" ? router.query.company : undefined;

  return (
    <div className="flex flex-col gap-6">
      <BookingSearch />
      <BookingList companyFilter={company} />
    </div>
  );
};

SelfDiagnosisPage.getLayout = getDefaultLayout;
SelfDiagnosisPage.pageHeader = pageHeader;
export default SelfDiagnosisPage;
