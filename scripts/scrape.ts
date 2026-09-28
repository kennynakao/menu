/**
 * Run the scraper from the command line:
 *   npm run scrape            → summary of every hall, day and meal
 *   npm run scrape -- --json  → also writes menu.json
 */
import { writeFile } from "node:fs/promises";
import { scrapeMenus } from "../lib/scraper";

async function main() {
  const started = Date.now();
  const menu = await scrapeMenus();

  for (const hall of menu.halls) {
    console.log(`\n${hall.name}${hall.error ? `  ✗ ${hall.error}` : ""}`);
    for (const day of hall.days) {
      const counts = day.meals.map((meal) => `${meal.name} ${meal.zones.reduce((n, z) => n + z.dishes.length, 0)}`);
      console.log(`  ${day.date}  ${counts.join("  ·  ")}`);
    }
  }

  const bytes = Buffer.byteLength(JSON.stringify(menu));
  console.log(
    `\n${menu.dishes.length} unique dishes · ${(bytes / 1024).toFixed(0)} KB JSON · ${Date.now() - started} ms`,
  );

  if (process.argv.includes("--json")) {
    await writeFile("menu.json", JSON.stringify(menu, null, 2));
    console.log("Wrote menu.json");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
