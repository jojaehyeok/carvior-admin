import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import StoreList from "@/components/page/store/store-list";

const pageHeader: IPageHeader = {
  title: "스마트옥션 매물 관리",
};

const StoreManagementPage: IDefaultLayoutPage = () => {
  return (
    <div className="flex flex-col gap-6">
      <StoreList />
    </div>
  );
};

StoreManagementPage.getLayout = getDefaultLayout;
StoreManagementPage.pageHeader = pageHeader;

export default StoreManagementPage;
