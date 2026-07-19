import { useRouter } from "next/router";
import { getDefaultLayout, IDefaultLayoutPage } from "@/components/layout/default-layout";
import BookingList from "@/components/page/booking/booking-list";
import BookingSearch from "@/components/page/booking/booking-search";

// "관리자 계정 관리"에서 발주사 코드를 넣어 새 COMPANY_ADMIN 계정을 만들면,
// 코드 배포 없이 바로 이 동적 라우트로 자기 회사 의뢰만 조회 가능해진다.
// (anyone-motors, gwangmyeong-motors처럼 전용 페이지가 따로 있으면 그쪽이 우선 매칭됨)
const CompanyBookingPage: IDefaultLayoutPage = () => {
  const router = useRouter();
  const company = typeof router.query.company === "string" ? router.query.company : undefined;

  return (
    <div className="flex flex-col gap-6">
      <BookingSearch />
      <BookingList companyFilter={company} />
    </div>
  );
};

CompanyBookingPage.getLayout = getDefaultLayout;
export default CompanyBookingPage;
