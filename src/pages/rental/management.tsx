import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import RentalList from "@/components/page/rental/rental-list";

const pageHeader: IPageHeader = {
  title: "렌트카 승계 관리 (베타)",
};

const RentalManagementPage: IDefaultLayoutPage = () => {
  return (
    <RequireSuperAdmin>
      <div className="flex flex-col gap-6">
        <RentalList />
      </div>
    </RequireSuperAdmin>
  );
};

RentalManagementPage.getLayout = getDefaultLayout;
RentalManagementPage.pageHeader = pageHeader;

export default RentalManagementPage;
