import { NextRouter } from "next/router";
import { ParsedUrlQueryInput } from "querystring";
import React from "react";
import NavMenu from "./nav-menu";
import style from "./nav.module.css";

interface INavProps {
  data: IMenu[];
}

export interface IMenu {
  id?: string /* 식별자 없으면 name으로 대체 */;
  name: string;
  link?: {
    path: string;
    query?: ParsedUrlQueryInput;
  };
  icon?: React.ReactNode;
  isActive?: (router: NextRouter, link: IMenu["link"]) => boolean;
  /** 메뉴 이름 옆에 띄울 숫자(처리 대기 건수 등). 0이거나 없으면 표시하지 않는다. */
  badge?: number;
  submenu?: IMenu[];
}

export const isEqualPath = (router: NextRouter, link: IMenu["link"]) => {
  return (
    router.pathname === link?.path &&
    Object.keys(link.query || {}).every((k) => String(link.query?.[k]) === router.query[k])
  );
};

const Nav = ({ data }: INavProps) => {
  return (
    <ul className={style.menu}>
      {data.map((menu) => {
        return <NavMenu key={menu.id || menu.name} menu={menu} />;
      })}
    </ul>
  );
};

export default React.memo(Nav);
