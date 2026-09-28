import { getMenus } from "@/lib/menu";

// The full scraped menu (with ingredients) as JSON, re-scraped every 15 minutes.
export const dynamic = "force-static";
export const revalidate = 900;

export async function GET() {
  const menu = await getMenus({ ingredients: true });
  return Response.json(menu);
}
