import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import BookingList from "@/components/page/booking/booking-list";
import BookingSearch from "@/components/page/booking/booking-search";

const pageHeader: IPageHeader = {
  title: "애니원 모터스 - 진단 신청 내역",
};

const AnyoneMotorsBookingPage: IDefaultLayoutPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <BookingSearch />
      {/* anyone-motors 출처 의뢰만 표시 */}
      <BookingList companyFilter="anyone-motors" />
    </div>
  );
};

AnyoneMotorsBookingPage.getLayout = getDefaultLayout;
AnyoneMotorsBookingPage.pageHeader = pageHeader;

export default AnyoneMotorsBookingPage;
