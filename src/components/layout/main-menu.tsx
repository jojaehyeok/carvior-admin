import { Divider } from "antd";
import { BarChart2, Home, MessageCircle, Monitor, Package2, Settings, ShoppingBag, Star } from "lucide-react";
import { useSession } from "next-auth/react";
import React from "react";
import Menu, { IMenu } from "./nav";

/** 슈퍼 관리자 메뉴 (전체 의뢰 + carvior-inspection 포함) */
const superAdminMenuData: IMenu[] = [
  {
    id: "home",
    name: "홈",
    icon: <Home className="w-5 h-5" />,
    link: { path: "/" },
  },
  {
    id: "diagnosis",
    name: "진단 관리",
    icon: <Package2 className="w-5 h-5" />,
    submenu: [
      {
        id: "bookingList",
        name: "전체 진단 신청목록",
        link: { path: "/diagnosis/bookings" },
      },
      {
        id: "anyoneMotorsList",
        name: "애니원 모터스",
        link: { path: "/diagnosis/anyone-motors" },
      },
      {
        id: "driverList",
        name: "진단사 계정 관리",
        link: { path: "/diagnosis/drivers" },
      },
      {
        id: "driverSchedule",
        name: "진단사 스케줄 관리",
        link: { path: "/diagnosis/schedule" },
      },
      {
        id: "driverMap",
        name: "실시간 지도 배정",
        link: { path: "/diagnosis/map" },
      },
    ],
  },
  {
    id: "consultation",
    name: "상담 신청",
    icon: <MessageCircle className="w-5 h-5" />,
    link: { path: "/diagnosis/consultations" },
  },
  {
    id: "store",
    name: "스마트옥션 관리",
    icon: <ShoppingBag className="w-5 h-5" />,
    link: { path: "/store/management" },
  },
  {
    id: "cs",
    name: "CS / 리뷰",
    icon: <Star className="w-5 h-5" />,
    link: { path: "/review" },
  },
  {
    id: "settings",
    name: "시스템 설정",
    icon: <Settings className="w-5 h-5" />,
    submenu: [
      {
        id: "adminAccount",
        name: "관리자 계정 관리",
        link: { path: "/admin/accounts" },
      },
      {
        id: "dealerApproval",
        name: "딜러 승인 관리",
        link: { path: "/admin/dealers" },
      },
      {
        id: "complianceRecords",
        name: "매매정보 보관 기록(3년)",
        link: { path: "/admin/compliance" },
      },
    ],
  },
  {
    id: "export",
    name: "수출 분석",
    icon: <BarChart2 className="w-5 h-5" />,
    submenu: [
      { id: "exportDashboard", name: "수출 대시보드", link: { path: "/export" } },
      { id: "exportUpload", name: "데이터 업로드", link: { path: "/export/upload" } },
      { id: "exportModels", name: "차량 데이터", link: { path: "/export/models" } },
      { id: "exportSimulator", name: "매입가 시뮬레이터", link: { path: "/export/simulator" } },
      { id: "exportSettings", name: "설정", link: { path: "/export/settings" } },
    ],
  },
];

/**
 * 발주사(COMPANY_ADMIN) 공통 메뉴 — 자사 의뢰만 조회/배정/CS 확인 가능.
 * bookingPath를 지정 안 하면 동적 라우트(/diagnosis/[company])로 자동 연결되므로,
 * "관리자 계정 관리"에서 새 발주사 계정을 만들면 코드 배포 없이 바로 메뉴가 동작한다.
 */
const buildCompanyMenu = (company: string, bookingPath?: string): IMenu[] => [
  {
    id: "home",
    name: "홈",
    icon: <Home className="w-5 h-5" />,
    link: { path: "/" },
  },
  {
    id: "diagnosis",
    name: "진단 관리",
    icon: <Package2 className="w-5 h-5" />,
    submenu: [
      {
        id: "companyBookingList",
        name: "진단 신청목록",
        link: { path: bookingPath ?? `/diagnosis/${company}` },
      },
      {
        id: "companySelfDiagnosisList",
        name: "자체 진단 목록",
        link: { path: `/diagnosis/self-diagnosis/${company}` },
      },
      {
        id: "companyMap",
        name: "실시간 지도 배정",
        link: { path: "/diagnosis/map" },
      },
    ],
  },
  {
    id: "cs",
    name: "CS / 리뷰",
    icon: <Star className="w-5 h-5" />,
    link: { path: "/review" },
  },
];

/**
 * company → 메뉴 데이터 매핑
 * 전용 페이지(예: /diagnosis/anyone-motors)가 따로 있는 발주사만 여기 추가하면 됨.
 * 없으면 아래 MainMenu에서 buildCompanyMenu(company)로 동적 라우트에 자동 연결됨.
 */
const COMPANY_MENUS: Record<string, IMenu[]> = {
  "anyone-motors": buildCompanyMenu("anyone-motors", "/diagnosis/anyone-motors"),
  "gwangmyeong-motors": buildCompanyMenu("gwangmyeong-motors", "/diagnosis/gwangmyeong-motors"),
};

const devMenuData: IMenu[] = [
  {
    id: "dev",
    name: "사용 가이드",
    icon: <Monitor className="w-5 h-5" />,
    submenu: [
      { name: "폼", link: { path: "/sample/form" } },
    ],
  },
];

const MainMenu = () => {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const company = session?.user?.company;

  let menuData: IMenu[];
  if (role === "COMPANY_ADMIN" && company) {
    // 전용 페이지가 있는 발주사는 COMPANY_MENUS 매핑을, 없으면(관리자 계정 관리에서
    // 새로 등록한 발주사) 동적 라우트로 자동 연결되는 메뉴를 생성한다.
    menuData = COMPANY_MENUS[company] ?? buildCompanyMenu(company);
  } else {
    menuData = superAdminMenuData;
  }

  return (
    <>
      <>
        <Divider orientation="left" plain>메인</Divider>
        <Menu data={menuData} />
      </>
      {role !== "COMPANY_ADMIN" && (
        <>
          <Divider orientation="left" plain>개발</Divider>
          <Menu data={devMenuData} />
        </>
      )}
    </>
  );
};

export default React.memo(MainMenu);
