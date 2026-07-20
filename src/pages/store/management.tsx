import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import StoreList from "@/components/page/store/store-list";

const pageHeader: IPageHeader = {
  title: "스마트옥션 매물 관리",
};

const StoreManagementPage: IDefaultLayoutPage = () => {
  return (
    <RequireSuperAdmin>
      <div className="flex flex-col gap-6">
        <StoreList />
      </div>
    </RequireSuperAdmin>
  );
};

StoreManagementPage.getLayout = getDefaultLayout;
StoreManagementPage.pageHeader = pageHeader;

export default StoreManagementPage;
