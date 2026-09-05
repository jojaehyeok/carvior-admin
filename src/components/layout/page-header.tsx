import React from "react";
import { IPageHeader } from "./default-layout";
import WebPushToggle from "./web-push-toggle";

interface IPageHeaderProps {
  value: IPageHeader;
}

const PageHeader = ({ value }: IPageHeaderProps) => {
  return (
    <div className="pt-7 px-5 sm:px-10">
      {/* 알림 켜기 버튼은 모든 화면 상단에 둔다 — 관리자가 어느 화면에서든 켤 수 있어야 하고,
          이미 켜둔 사람에겐 현재 상태(켜짐/차단됨) 표시 역할도 한다. */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center text-3xl text-gray-900">{value.title}</div>
        <WebPushToggle />
      </div>
    </div>
  );
};

export default React.memo(PageHeader);
