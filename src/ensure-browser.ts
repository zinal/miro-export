import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Browser, computeExecutablePath, install } from "@puppeteer/browsers";
import puppeteer from "puppeteer";

function getPuppeteerRuntime() {
  return puppeteer as unknown as {
    configuration: { cacheDirectory: string };
    browserVersion: string;
  };
}

function listCachedChromeBuildIds(cacheDir: string): string[] {
  const chromeDir = join(cacheDir, "chrome");
  if (!existsSync(chromeDir)) {
    return [];
  }

  return readdirSync(chromeDir)
    .filter((name) => /^(linux|mac|mac_arm|win32|win64)-/.test(name))
    .map((name) => name.replace(/^(linux|mac|mac_arm|win32|win64)-/, ""));
}

export function formatChromeInstallHelp(): string {
  const { configuration, browserVersion } = getPuppeteerRuntime();
  return [
    `miro-export requires Chrome ${browserVersion} (cache: ${configuration.cacheDirectory}).`,
    "Install the matching build with:",
    "  npx miro-export install-browser",
    "",
    'Do not use bare "npx puppeteer browsers install" — that uses the latest Puppeteer',
    "and downloads a different Chrome version, which miro-export cannot use."
  ].join("\n");
}

/**
 * Ensures the Chrome build that Puppeteer expects is available.
 * `npx` installs dependencies without running lifecycle scripts, so
 * Puppeteer's postinstall may not have downloaded Chrome yet.
 */
export async function ensureBrowserInstalled(options?: {
  verbose?: boolean;
}): Promise<void> {
  const { configuration, browserVersion: buildId } = getPuppeteerRuntime();
  const cacheDir = configuration.cacheDirectory;
  const executablePath = computeExecutablePath({
    cacheDir,
    browser: Browser.CHROME,
    buildId
  });

  if (existsSync(executablePath)) {
    if (options?.verbose) {
      console.log(`Chrome ${buildId} is ready (${executablePath})`);
    }
    return;
  }

  const otherVersions = listCachedChromeBuildIds(cacheDir).filter(
    (version) => version !== buildId
  );
  if (otherVersions.length > 0) {
    console.error(
      `Found Chrome ${otherVersions.join(", ")} in ${cacheDir}, but miro-export needs Chrome ${buildId}.`
    );
    console.error(
      'This often happens after "npx puppeteer browsers install", which downloads the latest Chrome—not the version bundled with miro-export.'
    );
  }

  console.error(`Downloading Chrome ${buildId} (one-time setup)…`);

  await install({
    browser: Browser.CHROME,
    buildId,
    cacheDir
  });
}

export function isChromeNotFoundError(err: unknown): boolean {
  return err instanceof Error && err.message.includes("Could not find Chrome");
}

export function diagnoseBrowser(): {
  requiredBuildId: string;
  cacheDirectory: string;
  executablePath: string;
  executableExists: boolean;
  cachedBuildIds: string[];
  env: { PUPPETEER_CACHE_DIR?: string; HOME?: string };
} {
  const { configuration, browserVersion: requiredBuildId } =
    getPuppeteerRuntime();
  const cacheDirectory = configuration.cacheDirectory;
  const executablePath = computeExecutablePath({
    cacheDir: cacheDirectory,
    browser: Browser.CHROME,
    buildId: requiredBuildId
  });

  return {
    requiredBuildId,
    cacheDirectory,
    executablePath,
    executableExists: existsSync(executablePath),
    cachedBuildIds: listCachedChromeBuildIds(cacheDirectory),
    env: {
      PUPPETEER_CACHE_DIR: process.env.PUPPETEER_CACHE_DIR,
      HOME: process.env.HOME
    }
  };
}

export function printBrowserDiagnosis(): void {
  const d = diagnoseBrowser();
  console.log("miro-export Chrome diagnostics\n");
  console.log(`Required Chrome build:  ${d.requiredBuildId}`);
  console.log(`Puppeteer cache dir:    ${d.cacheDirectory}`);
  console.log(`Expected executable:    ${d.executablePath}`);
  console.log(`Executable exists:      ${d.executableExists ? "yes" : "NO"}`);
  console.log(
    `Cached Chrome builds:   ${d.cachedBuildIds.length ? d.cachedBuildIds.join(", ") : "(none)"}`
  );
  console.log(
    `PUPPETEER_CACHE_DIR:    ${d.env.PUPPETEER_CACHE_DIR ?? "(not set)"}`
  );
  console.log(`HOME:                   ${d.env.HOME ?? "(not set)"}`);

  if (!d.executableExists) {
    console.log("\nFix:");
    console.log("  npx miro-export install-browser");
    console.log("  # or, for npm 1.3.2:");
    console.log(`  npx -y puppeteer@24.43.1 browsers install chrome`);
    if (
      d.cachedBuildIds.length > 0 &&
      !d.cachedBuildIds.includes(d.requiredBuildId)
    ) {
      console.log(
        `\nNote: You have Chrome ${d.cachedBuildIds.join(", ")} cached, but not ${d.requiredBuildId}.`
      );
      console.log(
        'Bare "npx puppeteer browsers install" installs the latest Chrome, not this version.'
      );
    }
  }
}
