import { spawnSync } from "node:child_process";

const argumentsToForward = process.argv.slice(2);
const dockerComposeProbe = spawnSync("docker", ["compose", "version"], { stdio: "ignore" });
const command = dockerComposeProbe.status === 0 ? "docker" : "docker-compose";
const prefix = command === "docker" ? ["compose"] : [];
const result = spawnSync(command, [...prefix, ...argumentsToForward], { stdio: "inherit" });

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
