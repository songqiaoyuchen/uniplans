"use client";

import { navbarLinkStyles } from "@/styles/navbarStyles";
import Button from "@mui/material/Button";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = pathname === href;

  return (
    <Link href={href} aria-current={isActive ? "page" : undefined}>
      <Button
        sx={(theme) => navbarLinkStyles(theme, isActive)}
      >
        {children}
      </Button>
    </Link>
  );
}
