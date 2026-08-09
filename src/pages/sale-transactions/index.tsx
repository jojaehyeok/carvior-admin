import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import SaleTransactionsList from "@/components/page/sale-transactions/sale-transactions-list";

const pageHeader: IPageHeader = {
  title: "거래관리",
};

const SaleTransactionsPage: IDefaultLayoutPage = () => {
  return (
    <RequireSuperAdmin>
      <div className="flex flex-col gap-6">
        <p className="text-sm text-gray-400">
          낙찰 확정된 거래의 에스크로 입금·탁송·정산 진행상황을 관리합니다. 실제 PG/에스크로 연동 전까지는
          Mock으로 동작하며, 각 단계는 관리자가 직접 확인 후 진행합니다.
        </p>
        <SaleTransactionsList />
      </div>
    </RequireSuperAdmin>
  );
};

SaleTransactionsPage.getLayout = getDefaultLayout;
SaleTransactionsPage.pageHeader = pageHeader;

export default SaleTransactionsPage;
