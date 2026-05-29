import { existsSync } from "node:fs";
import { Browser, computeExecutablePath, install } from "@puppeteer/browsers";
import puppeteer from "puppeteer";

/**
 * Ensures the Chrome build that Puppeteer expects is available.
 * `npx` installs dependencies without running lifecycle scripts, so
 * Puppeteer's postinstall may not have downloaded Chrome yet.
 */
export async function ensureBrowserInstalled(): Promise<void> {
  const puppeteerNode = puppeteer as unknown as {
    configuration: { cacheDirectory: string };
    browserVersion: string;
  };
  const cacheDir = puppeteerNode.configuration.cacheDirectory;
  const buildId = puppeteerNode.browserVersion;
  const executablePath = computeExecutablePath({
    cacheDir,
    browser: Browser.CHROME,
    buildId
  });

  if (existsSync(executablePath)) {
    return;
  }

  console.error(
    `Chrome ${buildId} is not installed. Downloading browser (one-time setup)…`
  );

  await install({
    browser: Browser.CHROME,
    buildId,
    cacheDir
  });
}
