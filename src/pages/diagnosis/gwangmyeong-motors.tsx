import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import BookingList from "@/components/page/booking/booking-list";
import BookingSearch from "@/components/page/booking/booking-search";

const pageHeader: IPageHeader = {
  title: "광명모터스 - 진단 신청 내역",
};

const GwangmyeongMotorsBookingPage: IDefaultLayoutPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <BookingSearch />
      {/* gwangmyeong-motors 출처 의뢰만 표시 */}
      <BookingList companyFilter="gwangmyeong-motors" />
    </div>
  );
};

GwangmyeongMotorsBookingPage.getLayout = getDefaultLayout;
GwangmyeongMotorsBookingPage.pageHeader = pageHeader;

export default GwangmyeongMotorsBookingPage;
