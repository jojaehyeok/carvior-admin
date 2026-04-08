'use client';

import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import ConsultationList from "@/components/page/consultation/consultation-list";

const pageHeader: IPageHeader = {
  title: "상담 신청 내역",
};

const ConsultationListPage: IDefaultLayoutPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <ConsultationList />
    </div>
  );
};

ConsultationListPage.getLayout = getDefaultLayout;
ConsultationListPage.pageHeader = pageHeader;

export default ConsultationListPage;
