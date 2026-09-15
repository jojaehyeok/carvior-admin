import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/router";
import React from "react";
import { IMenu, isEqualPath } from ".";

interface INavItemProps {
  item: IMenu;
}

const NavItem = ({ item }: INavItemProps) => {
  const router = useRouter();

  return (
    <li>
      <Link
        href={{
          pathname: item.link?.path ?? "/",
          query: item.link?.query,
        }}
        className={(item.isActive || isEqualPath)(router, item.link) ? "active" : ""}
      >
        {item.icon}
        <span className="cursor-pointer grow">{item.name}</span>
        {!!item.badge && item.badge > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold leading-5 text-center">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
        <ChevronRight className="w-6 h-6 text-white active-check" />
      </Link>
    </li>
  );
};

export default React.memo(NavItem);
