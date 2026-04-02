import { execSync } from "child_process";

export function getVersion(): string {
  try {
    // Get git commit hash (short) and date
    const gitInfo = execSync('git log -1 --format="%h|%ad" --date=format:"%Y.%m.%d"', {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"], // Suppress stderr
    }).trim();

    const [hash, date] = gitInfo.split("|");
    
    // Format: v{date}-{hash}
    return `v${date}-${hash}`;
  } catch (error) {
    // Fallback if git is not available (e.g., in some CI environments)
    const now = new Date();
    const date = now.toISOString().split("T")[0].replace(/-/g, ".");
    return `v${date}-local`;
  }
}

export function getVersionInfo() {
  try {
    const hash = execSync('git log -1 --format="%h"', {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    const date = execSync('git log -1 --format="%ad" --date=format:"%Y.%m.%d"', {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    const message = execSync('git log -1 --format="%s"', {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    return {
      version: `v${date}-${hash}`,
      hash,
      date,
      message,
    };
  } catch (error) {
    const now = new Date();
    const date = now.toISOString().split("T")[0].replace(/-/g, ".");
    return {
      version: `v${date}-local`,
      hash: "local",
      date,
      message: "Local build",
    };
  }
}
