import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.CACTI_SCREENSHOT_URL ?? "http://127.0.0.1:3002";
const outputDirectory = resolve("docs/screenshots");

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});

try {
  const page = await context.newPage();

  await page.goto(`${baseUrl}/about`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: resolve(outputDirectory, "the-cacti-overview.png"),
    fullPage: false,
  });

  await page.goto(`${baseUrl}/newspaper`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: resolve(outputDirectory, "the-cacti-newspaper.png"),
    fullPage: false,
  });
} finally {
  await context.close();
  await browser.close();
}

console.log(`Screenshots written to ${outputDirectory}`);
