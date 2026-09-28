import { MenuApp } from "@/components/menu-app";
import { getMenus } from "@/lib/menu";

// Serve a cached page instantly and re-scrape UC Davis in the background at
// most every 15 minutes (keep in sync with MENU_TTL).
export const revalidate = 900;

export default async function Page() {
  const menu = await getMenus();
  return <MenuApp menu={menu} />;
}
