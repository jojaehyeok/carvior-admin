'use client';

import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import DriverList from "@/components/page/driver/driver-list";
import DriverSearch, { EMPTY_DRIVER_FILTERS, type IDriverFilters } from "@/components/page/driver/driver-search";
import { useState } from "react";

const pageHeader: IPageHeader = {
  title: "진단사 계정 관리",
};

const DriverManagePage: IDefaultLayoutPage = () => {
  // 검색 폼과 목록이 따로 놀고 있어서 조회가 아무 동작도 하지 않았다 —
  // 조건을 여기서 들고 있다가 [조회하기]를 누른 시점에만 목록으로 내려준다.
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
