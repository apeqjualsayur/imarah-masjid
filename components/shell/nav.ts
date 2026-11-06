import { FileText, Heart, House, Menu, Settings, Users, Wallet, type LucideIcon } from "lucide-react";

export type NavKey = "utama" | "kewangan" | "kariah" | "khairat" | "laporan" | "tetapan" | "lagi";

export type NavItem = {
  key: NavKey;
  href: string;
  icon: LucideIcon;
};

const utama: NavItem = { key: "utama", href: "/", icon: House };
const kewangan: NavItem = { key: "kewangan", href: "/kewangan", icon: Wallet };
const kariah: NavItem = { key: "kariah", href: "/kariah", icon: Users };
const khairat: NavItem = { key: "khairat", href: "/khairat", icon: Heart };
const laporan: NavItem = { key: "laporan", href: "/laporan", icon: FileText };
const tetapan: NavItem = { key: "tetapan", href: "/tetapan", icon: Settings };
const lagi: NavItem = { key: "lagi", href: "/lagi", icon: Menu };

export const sidebarItems = [utama, kewangan, kariah, khairat, laporan, tetapan];
export const tabItems = [utama, kewangan, kariah, khairat, lagi];
export const moreItems = [laporan, tetapan];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
