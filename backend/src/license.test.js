import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testFilePath = fileURLToPath(import.meta.url);
const backendSrcDir = path.dirname(testFilePath);
const repoRootDir = path.resolve(backendSrcDir, "../..");

describe("repository license metadata", () => {
  it("declares GPL-3.0-or-later in the root package.json", () => {
    const packageJsonPath = path.join(repoRootDir, "package.json");
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

    assert.equal(packageJson.license, "GPL-3.0-or-later");
  });

  it("ships the full GPL v3 license text at the repository root", () => {
    const licensePath = path.join(repoRootDir, "LICENSE");
    const licenseText = fs.readFileSync(licensePath, "utf8").replace(/\r\n/g, "\n");

    assert.ok(
      licenseText.startsWith(
        "                    GNU GENERAL PUBLIC LICENSE\n" +
          "                       Version 3, 29 June 2007\n"
      )
    );
    assert.match(licenseText, /END OF TERMS AND CONDITIONS/);
  });

  it("documents the GPL license in the README", () => {
    const readmePath = path.join(repoRootDir, "README.md");
    const readme = fs.readFileSync(readmePath, "utf8");

    assert.match(
      readme,
      /<a href="\.\/LICENSE">\s*<img src="https:\/\/img\.shields\.io\/badge\/License-GPL%20v3-blue\.svg" alt="License: GPL v3" \/>\s*<\/a>/
    );
    assert.match(readme, /## License\s+This project is licensed under the \[GNU General Public License v3\.0\]\(\.\/LICENSE\)\./);
  });
});
