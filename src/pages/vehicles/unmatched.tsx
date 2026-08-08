import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import RequireSuperAdmin from "@/components/shared/require-super-admin";
import UnmatchedVehiclesList from "@/components/page/vehicles/unmatched-vehicles-list";

const pageHeader: IPageHeader = {
  title: "미매칭 검차차량",
};

const UnmatchedVehiclesPage: IDefaultLayoutPage = () => {
  return (
    <RequireSuperAdmin>
      <div className="flex flex-col gap-6">
        <p className="text-sm text-gray-400">
          검차는 완료됐지만 아직 판매매물로 전환되지 않은 차량입니다. 검차 신청자가 실제 차주가 아닐 수 있으니,
          차주에게 직접 연락해 판매 의사를 확인한 뒤에만 판매매물로 전환하세요.
        </p>
        <UnmatchedVehiclesList />
      </div>
    </RequireSuperAdmin>
  );
};

UnmatchedVehiclesPage.getLayout = getDefaultLayout;
UnmatchedVehiclesPage.pageHeader = pageHeader;

export default UnmatchedVehiclesPage;
