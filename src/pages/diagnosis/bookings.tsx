'use client';

import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import BookingList from "@/components/page/booking/booking-list"; // 새로 만들 컴포넌트
import BookingSearch from "@/components/page/booking/booking-search"; // 새로 만들 컴포넌트

const pageHeader: IPageHeader = {
  title: "진단 신청 내역 관리",
};

const BookingListPage: IDefaultLayoutPage = () => {
  return (
    <div className="flex flex-col gap-6">
      {/* 검색 필터 영역 (날짜, 차량번호, 딜러명 등) */}
      <BookingSearch />

      {/* 실제 DB 데이터가 뿌려질 테이블 영역 */}
      <BookingList />
    </div>
  );
};

BookingListPage.getLayout = getDefaultLayout;
BookingListPage.pageHeader = pageHeader;

export default BookingListPage;