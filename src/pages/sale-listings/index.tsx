import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import SaleListingsList from "@/components/page/sale-listings/sale-listings-list";

const pageHeader: IPageHeader = {
  title: "판매매물",
};

const SaleListingsPage: IDefaultLayoutPage = () => {
  return (
    <RequireSuperAdmin>
      <div className="flex flex-col gap-6">
        <p className="text-sm text-gray-400">
          차주 판매동의를 받아 딜러 입찰이 가능한 매물입니다. 딜러 경쟁입찰 기능은 다음 단계에서 이어서 구현됩니다.
        </p>
        <SaleListingsList />
      </div>
    </RequireSuperAdmin>
  );
};

SaleListingsPage.getLayout = getDefaultLayout;
SaleListingsPage.pageHeader = pageHeader;

export default SaleListingsPage;
