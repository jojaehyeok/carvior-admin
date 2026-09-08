'use client';

// /diagnosis/drivers 의 옛 샘플 사본 — 실제 운영 화면은 pages/diagnosis/drivers.tsx다.
// 두 벌을 따로 손보면 한쪽만 고쳐지므로 같은 배선을 그대로 유지한다.
import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import DriverList from "@/components/page/driver/driver-list";
import DriverSearch, { EMPTY_DRIVER_FILTERS, type IDriverFilters } from "@/components/page/driver/driver-search";
import { useState } from "react";

const pageHeader: IPageHeader = {
  title: "진단사 계정 관리",
};

const DriverManagePage: IDefaultLayoutPage = () => {
  const [filters, setFilters] = useState<IDriverFilters>(EMPTY_DRIVER_FILTERS);

  return (
    <div className="flex flex-col gap-4">
      <DriverSearch onSearch={setFilters} />
      <DriverList filters={filters} />
    </div>
  );
};

DriverManagePage.getLayout = getDefaultLayout;
DriverManagePage.pageHeader = pageHeader;

export default DriverManagePage;
