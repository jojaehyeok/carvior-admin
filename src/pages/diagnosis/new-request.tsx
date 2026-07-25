import { getDefaultLayout, IDefaultLayoutPage, IPageHeader } from "@/components/layout/default-layout";
import { useSession } from "next-auth/react";

const pageHeader: IPageHeader = {
  title: "신규 접수",
};

// 발주사 계정이 대시보드를 벗어나지 않고 바로 간편신청 폼을 쓸 수 있도록,
// 원래 딜러들이 쓰는 공개 접수 폼(cavior)을 회사 코드로 그대로 iframe에 띄운다.
const NewRequestPage: IDefaultLayoutPage = () => {
  const { data: session } = useSession();
  const company = session?.user?.company;

  if (!company) {
    return (
      <div className="p-6 text-sm text-gray-500 bg-white rounded-lg shadow-sm">
        이 화면은 발주사 계정 전용입니다. 슈퍼 관리자는 기존 접수 흐름(대시보드 예약 관리)을 이용해주세요.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden" style={{ height: "calc(100vh - 160px)" }}>
      <iframe
        src={`https://carvior.store/marketing/simple-request/${company}`}
        title="신규 접수"
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    </div>
  );
};

NewRequestPage.getLayout = getDefaultLayout;
NewRequestPage.pageHeader = pageHeader;

export default NewRequestPage;
