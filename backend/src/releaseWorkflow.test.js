import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testFilePath = fileURLToPath(import.meta.url);
const backendSrcDir = path.dirname(testFilePath);
const repoRootDir = path.resolve(backendSrcDir, "../..");

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRootDir, relativePath), "utf8").replace(/\r\n/g, "\n");
}

describe("release workflows", () => {
  it("keeps release-please focused on creating release PRs", () => {
    const workflow = readRepoFile(".github/workflows/release-please.yml");

    assert.doesNotMatch(workflow, /^\s{2}docker-publish:\s*$/m);
    assert.doesNotMatch(workflow, /^\s{4}release_created:\s+/m);
    assert.doesNotMatch(workflow, /^\s{4}tag_name:\s+/m);
    assert.match(workflow, /token: \$\{\{ secrets\.RELEASE_PLEASE_TOKEN \}\}/);
  });

  it("publishes Docker images from the release published event", () => {
    const workflow = readRepoFile(".github/workflows/docker-publish.yml");

    assert.match(workflow, /^on:\n {2}release:\n {4}types: \[published\]\n/m);
    assert.match(workflow, /^jobs:\n {2}docker-publish:\n/m);
    assert.match(workflow, /uses: actions\/checkout@v6/);
    assert.match(workflow, /uses: docker\/login-action@v4/);
    assert.match(workflow, /uses: docker\/metadata-action@v6/);
    assert.match(workflow, /images: ghcr\.io\/derfloDev\/endgame-grocery/);
    assert.match(
      workflow,
      /type=semver,pattern=\{\{version\}\},value=\$\{\{ github\.event\.release\.tag_name \}\}/
    );
    assert.match(workflow, /type=raw,value=latest/);
    assert.match(workflow, /uses: docker\/build-push-action@v7/);
    assert.match(workflow, /push: true/);
  });
});
