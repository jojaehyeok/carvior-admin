import { Divider } from "antd";
import { BarChart2, Building2, Car, Home, KeyRound, MessageCircle, Monitor, Package2, Settings, ShoppingBag, Star } from "lucide-react";
import { useSession } from "next-auth/react";
import React, { useEffect, useState } from "react";
import Menu, { IMenu } from "./nav";

const API = process.env.NEXT_PUBLIC_API_ENDPOINT;

// 전용 페이지(자체 브랜딩 타이틀 등)가 따로 있는 발주사만 여기 추가하면 됨.
// 없으면 동적 라우트(/diagnosis/[company])로 자동 연결된다.
const COMPANY_BOOKING_PAGES: Record<string, string> = {
  "anyone-motors": "/diagnosis/anyone-motors",
  "gwangmyeong-motors": "/diagnosis/gwangmyeong-motors",
};

// 발주사를 거치지 않고 /inspection(구매동행 검차 서비스)에서 고객이 직접 신청한 건 —
// 등록된 발주사 계정이 없어 /users/admins 목록엔 안 잡히니 "발주사 관리" 맨 앞에 고정으로 붙인다.
// source=CARVIOR_INSPECTION만 넘기면 기존 동적 라우트(/diagnosis/[company])가 그대로 필터링해줌.
const CARVIOR_DIRECT_LINK: IMenu = {
  id: "company-carvior-direct",
  name: "카비어(고객 직접신청)",
  link: { path: "/diagnosis/CARVIOR_INSPECTION" },
};

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
    // submenu는 빈 배열로 시작해서 MainMenu가 /users/admins 조회 결과로 채운다 —
    // "발주사 승인 관리"에서 새 발주사 계정을 승인하면 코드 수정 없이 여기 바로 추가됨.
    id: "companyList",
    name: "발주사 관리",
    icon: <Building2 className="w-5 h-5" />,
    submenu: [],
  },
  {
    id: "consultation",
    name: "상담 신청",
    icon: <MessageCircle className="w-5 h-5" />,
    link: { path: "/diagnosis/consultations" },
  },
  {
    id: "unmatchedVehicles",
    name: "미매칭 검차차량",
    icon: <Car className="w-5 h-5" />,
    link: { path: "/vehicles/unmatched" },
  },
  {
    id: "store",
    name: "스마트옥션 관리",
    icon: <ShoppingBag className="w-5 h-5" />,
    link: { path: "/store/management" },
  },
  {
    id: "rental",
    name: "렌트카 승계 (베타)",
    icon: <KeyRound className="w-5 h-5" />,
    link: { path: "/rental/management" },
  },
  {
    id: "settlement",
    name: "발주사 정산",
    icon: <BarChart2 className="w-5 h-5" />,
    link: { path: "/store/settlement" },
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
        id: "companyApproval",
        name: "발주사 승인 관리",
        link: { path: "/admin/companies" },
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
        id: "companyNewRequest",
        name: "신규 접수",
        link: { path: "/diagnosis/new-request" },
      },
      {
        id: "companyBookingList",
        name: "진단 신청목록",
        link: { path: bookingPath ?? `/diagnosis/${company}` },
      },
      {
        id: "companyContractWriterMissing",
        name: "계약서 미작성 목록",
        link: { path: bookingPath ?? `/diagnosis/${company}`, query: { contractWriterMissing: "true" } },
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
  const [companyLinks, setCompanyLinks] = useState<IMenu[]>([]);

  // 슈퍼 관리자 세션에서만 필요 — 등록된 발주사 관리자 계정 목록을 조회해서
  // "발주사 관리" 서브메뉴를 채운다. "발주사 승인 관리"에서 새 계정을 승인하면
  // 메뉴 코드를 손대지 않아도 다음 로드 때 여기 자동으로 나타난다.
  useEffect(() => {
    if (role === "COMPANY_ADMIN") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/users/admins`);
        const data = await res.json();
        // 같은 발주사 코드로 계정을 여러 개 만드는 경우(예: 사무장 전용 계정)가 있어서,
        // "발주사 관리" 메뉴에는 회사당 하나만 — 가장 먼저 생성된(원본) 계정 기준으로 노출한다.
        const admins: { name: string; company: string; createdAt?: string }[] = (Array.isArray(data) ? data : [])
          .filter((u: { company?: string | null }) => !!u.company);
        const earliestByCompany = new Map<string, { name: string; company: string; createdAt?: string }>();
        for (const u of admins) {
          const existing = earliestByCompany.get(u.company);
          if (!existing || (u.createdAt && existing.createdAt && u.createdAt < existing.createdAt)) {
            earliestByCompany.set(u.company, u);
          }
        }
        const links: IMenu[] = Array.from(earliestByCompany.values()).map((u) => ({
          id: `company-${u.company}`,
          name: u.name || u.company,
          link: { path: COMPANY_BOOKING_PAGES[u.company] ?? `/diagnosis/${u.company}` },
        }));
        if (!cancelled) setCompanyLinks(links);
      } catch {
        if (!cancelled) setCompanyLinks([]);
      }
    })();
    return () => { cancelled = true; };
  }, [role]);

  let menuData: IMenu[];
  if (role === "COMPANY_ADMIN" && company) {
    // 전용 페이지가 있는 발주사는 COMPANY_MENUS 매핑을, 없으면(관리자 계정 관리에서
    // 새로 등록한 발주사) 동적 라우트로 자동 연결되는 메뉴를 생성한다.
    menuData = COMPANY_MENUS[company] ?? buildCompanyMenu(company);
  } else {
    menuData = superAdminMenuData.map((item) =>
      item.id === "companyList" ? { ...item, submenu: [CARVIOR_DIRECT_LINK, ...companyLinks] } : item
    );
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
