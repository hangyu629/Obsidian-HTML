import { access, readFile } from "node:fs/promises";

const requiredArtifacts = ["main.js", "manifest.json", "styles.css"];
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const versions = JSON.parse(await readFile("versions.json", "utf8"));

const failures = [];

if (manifest.id !== "obsidian-html") {
  failures.push("manifest.id must be obsidian-html");
}
if (manifest.version !== packageJson.version) {
  failures.push("manifest.version must match package.json version");
}
if (versions[manifest.version] !== manifest.minAppVersion) {
  failures.push("versions.json must map the release to manifest.minAppVersion");
}
if (manifest.isDesktopOnly !== false) {
  failures.push("manifest.isDesktopOnly must be false for mobile support");
}

for (const artifact of requiredArtifacts) {
  try {
    await access(artifact);
  } catch {
    failures.push(`missing release artifact: ${artifact}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Validated HTML Preview ${manifest.version}: ${requiredArtifacts.join(", ")}`
  );
}
