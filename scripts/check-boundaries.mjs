import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const allowed = new Map([
  ["@cloud-arena/domain", []],
  ["@cloud-arena/contracts", ["@cloud-arena/domain"]],
  ["@cloud-arena/catalog", ["@cloud-arena/contracts", "@cloud-arena/domain"]],
  ["@cloud-arena/assumptions", ["@cloud-arena/contracts", "@cloud-arena/domain"]],
  ["@cloud-arena/pricing", ["@cloud-arena/contracts", "@cloud-arena/domain"]],
  ["@cloud-arena/scoring", ["@cloud-arena/contracts", "@cloud-arena/domain"]],
  [
    "@cloud-arena/recommendation",
    [
      "@cloud-arena/assumptions",
      "@cloud-arena/catalog",
      "@cloud-arena/contracts",
      "@cloud-arena/domain",
      "@cloud-arena/pricing",
      "@cloud-arena/scoring",
    ],
  ],
  [
    "@cloud-arena/provider-aws",
    ["@cloud-arena/contracts", "@cloud-arena/domain", "@cloud-arena/pricing"],
  ],
  [
    "@cloud-arena/provider-azure",
    ["@cloud-arena/contracts", "@cloud-arena/domain", "@cloud-arena/pricing"],
  ],
  [
    "@cloud-arena/provider-gcp",
    ["@cloud-arena/contracts", "@cloud-arena/domain", "@cloud-arena/pricing"],
  ],
  ["@cloud-arena/database", ["@cloud-arena/contracts", "@cloud-arena/pricing"]],
  ["@cloud-arena/web", ["@cloud-arena/contracts"]],
  [
    "@cloud-arena/api",
    [
      "@cloud-arena/assumptions",
      "@cloud-arena/catalog",
      "@cloud-arena/contracts",
      "@cloud-arena/database",
      "@cloud-arena/domain",
      "@cloud-arena/pricing",
      "@cloud-arena/provider-aws",
      "@cloud-arena/provider-azure",
      "@cloud-arena/provider-gcp",
      "@cloud-arena/recommendation",
      "@cloud-arena/scoring",
    ],
  ],
]);

const packageRoots = ["apps", "packages", "packages/providers"];
const packageDirectories = packageRoots.flatMap((parent) => {
  const path = join(root, parent);
  if (!existsSync(path)) return [];

  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(path, entry.name, "package.json")))
    .map((entry) => join(path, entry.name));
});

const failures = [];

function sourceFiles(directory) {
  if (!existsSync(directory)) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [path] : [];
  });
}

for (const directory of packageDirectories) {
  const manifest = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
  const permitted = new Set(allowed.get(manifest.name) ?? []);
  const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };

  for (const dependency of Object.keys(dependencies).filter((name) =>
    name.startsWith("@cloud-arena/"),
  )) {
    if (!permitted.has(dependency)) {
      failures.push(`${manifest.name} declares forbidden dependency ${dependency}`);
    }
  }

  for (const file of sourceFiles(join(directory, "src"))) {
    const source = readFileSync(file, "utf8");
    const imports = [...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)].map(
      (match) => match[1],
    );

    for (const imported of imports) {
      if (imported.startsWith("@cloud-arena/") && !permitted.has(imported)) {
        failures.push(`${relative(root, file)} imports forbidden package ${imported}`);
      }

      if (
        manifest.name === "@cloud-arena/domain" &&
        !imported.startsWith(".") &&
        !imported.startsWith("node:")
      ) {
        failures.push(
          `${relative(root, file)} imports external framework/provider package ${imported}`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Dependency boundaries verified for ${packageDirectories.length} packages.`);
}
