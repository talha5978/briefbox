#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [, , pkg, target] = process.argv;

if (!pkg || !target) {
	console.warn("\x1b[33m--> Usage: add <package> <workspace-folder-or-name>\x1b[0m");
	process.exit(1);
}

/**
 * Find workspace packages by reading all package.json files
 * from pnpm workspace
 */
function getWorkspacePackages() {
	const output = execSync(`pnpm -r list --depth -1 --json`, {
		encoding: "utf8",
	});

	return JSON.parse(output);
}

/**
 * Resolve workspace by folder or name match
 */
function resolveWorkspace(target) {
	const pkgs = getWorkspacePackages();

	const match = pkgs.find((p) => {
		const dir = path.basename(p.path);
		return dir === target || p.name.endsWith(target);
	});

	if (!match) {
		console.error(`Cannot find workspace matching: ${target}`);
		process.exit(1);
	}

	return match.name;
}

const targetPkg = resolveWorkspace(target);

// support both scoped and unscoped input
const fullPkg = pkg.includes("@") ? pkg : `@workspace/${pkg}`;

const cmd = `pnpm add ${fullPkg} --filter ${targetPkg} --workspace`;

console.log(`Running: ${cmd}`);

execSync(cmd, { stdio: "inherit" });
