import { Divider } from "antd";
import { Home, Monitor, Package2, Star } from "lucide-react";
import React from "react";
import Menu, { IMenu } from "./nav";

const mainMenuData: IMenu[] = [
  {
    id: "home",
    name: "홈",
    icon: <Home className="w-5 h-5" />,
    link: {
      path: "/",
    },
  },
  {
    id: "diagnosis",
    name: "진단 관리",
    icon: <Package2 className="w-5 h-5" />,
    submenu: [
      {
        id: "bookingList",
        name: "진단 신청목록",
        link: { path: "/sample/product/BookingListPage" }, // 원래 있던 거
      },
      {
        id: "driverList",
        name: "진단사 계정 관리",
        link: { path: "/sample/product/DriverListPage" },
      },
    ],
  },
  {
    id: "cs",
    name: "CS / 리뷰",
    icon: <Star className="w-5 h-5" />,
    link: { path: "/sample/product/ReviewListPage" },
  },
];

const devMenuData: IMenu[] = [
  {
    id: "dev",
    name: "사용 가이드",
    icon: <Monitor className="w-5 h-5" />,
    submenu: [
      {
        name: "폼",
        link: {
          path: "/sample/form",
        },
      },
    ],
  },
];

const MainMenu = () => {
  return (
    <>
      <>
        <Divider orientation="left" plain>
          메인
        </Divider>

        <Menu data={mainMenuData} />
      </>
      <>
        <Divider orientation="left" plain>
          개발
        </Divider>

        <Menu data={devMenuData} />
      </>
    </>
  );
};

export default React.memo(MainMenu);
