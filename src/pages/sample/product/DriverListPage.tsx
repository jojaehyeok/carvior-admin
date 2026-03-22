'use client';

import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import DriverList from "@/components/page/driver/driver-list";
import DriverSearch from "@/components/page/driver/driver-search";

const pageHeader: IPageHeader = {
  title: "진단사 계정 관리",
};

const DriverManagePage: IDefaultLayoutPage = () => {
  return (
    <div className="flex flex-col gap-4">
      <DriverSearch />
      <DriverList />
    </div>
  );
};

DriverManagePage.getLayout = getDefaultLayout;
DriverManagePage.pageHeader = pageHeader;

export default DriverManagePage;