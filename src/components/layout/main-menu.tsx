import { Divider } from "antd";
import { Home, MessageCircle, Monitor, Package2, Star } from "lucide-react";
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
        link: { path: "/sample/product/BookingListPage" },
      },
      {
        id: "anyoneMotorsList",
        name: "애니원 모터스",
        link: { path: "/sample/product/AnyoneMotorsBookingPage" },
      },
      {
        id: "driverList",
        name: "진단사 계정 관리",
        link: { path: "/sample/product/DriverListPage" },
      },
    ],
  },
  {
    id: "consultation",
    name: "상담 신청",
    icon: <MessageCircle className="w-5 h-5" />,
    link: { path: "/sample/product/ConsultationListPage" },
  },
  {
    id: "cs",
    name: "CS / 리뷰",
    icon: <Star className="w-5 h-5" />,
    link: { path: "/sample/product/ReviewListPage" },
  },
];

/** 애니원 모터스 관리자 메뉴 (자사 의뢰만) */
const anyoneMotorsMenuData: IMenu[] = [
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
        id: "anyoneMotorsList",
        name: "진단 신청목록",
        link: { path: "/sample/product/AnyoneMotorsBookingPage" },
      },
    ],
  },
];

/**
 * company → 메뉴 데이터 매핑
 * 새 발주사 추가 시 여기에 추가하세요.
 */
const COMPANY_MENUS: Record<string, IMenu[]> = {
  "anyone-motors": anyoneMotorsMenuData,
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
  if (role === "COMPANY_ADMIN" && company && COMPANY_MENUS[company]) {
    menuData = COMPANY_MENUS[company];
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
