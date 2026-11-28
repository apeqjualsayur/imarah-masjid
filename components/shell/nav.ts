import { FileText, Heart, House, Menu, QrCode, Settings, Users, Wallet, type LucideIcon } from "lucide-react";
import { can, type Capability, type Role } from "@/lib/permissions";

export type NavKey = "utama" | "kewangan" | "kariah" | "khairat" | "derma" | "laporan" | "tetapan" | "lagi";

export type NavItem = {
  key: NavKey;
  href: string;
  icon: LucideIcon;
  /** Who may open it. No capability means every signed-in member. */
  capability?: Capability;
};

const utama: NavItem = { key: "utama", href: "/", icon: House, capability: "dashboard.view" };
const kewangan: NavItem = { key: "kewangan", href: "/kewangan", icon: Wallet, capability: "finance.view" };
const kariah: NavItem = { key: "kariah", href: "/kariah", icon: Users, capability: "kariah.view" };
const khairat: NavItem = { key: "khairat", href: "/khairat", icon: Heart, capability: "khairat.view" };
const derma: NavItem = { key: "derma", href: "/derma", icon: QrCode, capability: "dashboard.view" };
const laporan: NavItem = { key: "laporan", href: "/laporan", icon: FileText, capability: "reports.prepare" };
const tetapan: NavItem = { key: "tetapan", href: "/tetapan", icon: Settings };
const lagi: NavItem = { key: "lagi", href: "/lagi", icon: Menu };

export const sidebarItems = [utama, kewangan, kariah, khairat, derma, laporan, tetapan];
export const tabItems = [utama, kewangan, kariah, khairat, lagi];
export const moreItems = [derma, laporan, tetapan];

export function allowedItems(items: NavItem[], role: Role) {
  return items.filter((item) => !item.capability || can(role, item.capability));
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
