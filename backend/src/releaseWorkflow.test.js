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
    // Actions are pinned to a full commit SHA; the comment records the release line.
    assert.match(workflow, /uses: actions\/checkout@[0-9a-f]{40} # v6/);
    assert.match(workflow, /uses: docker\/login-action@[0-9a-f]{40} # v4/);
    assert.match(workflow, /uses: docker\/metadata-action@[0-9a-f]{40} # v6/);
    assert.match(workflow, /images: ghcr\.io\/derfloDev\/endgame-grocery/);
    assert.match(
      workflow,
      /type=semver,pattern=\{\{version\}\},value=\$\{\{ github\.event\.release\.tag_name \}\}/
    );
    assert.match(workflow, /type=raw,value=latest/);
    assert.match(workflow, /uses: docker\/build-push-action@[0-9a-f]{40} # v7/);
    assert.match(workflow, /push: true/);
  });
});

describe("workflow hardening", () => {
  const workflowFiles = fs
    .readdirSync(path.join(repoRootDir, ".github/workflows"))
    .filter((file) => file.endsWith(".yml"));

  it("finds the workflow files", () => {
    assert.deepEqual(workflowFiles.sort(), ["ci.yml", "docker-publish.yml", "release-please.yml"]);
  });

  for (const file of workflowFiles) {
    it(`${file} declares workflow-level permissions`, () => {
      const workflow = readRepoFile(`.github/workflows/${file}`);

      assert.match(workflow, /^permissions:\n(?: {2}[a-z-]+: (?:read|write)\n)+/m);
    });

    it(`${file} pins every action to a full commit SHA`, () => {
      const workflow = readRepoFile(`.github/workflows/${file}`);
      const uses = workflow.match(/^\s*(?:- )?uses: .+$/gm) ?? [];

      assert.ok(uses.length > 0, "expected at least one action");
      for (const line of uses) {
        assert.match(
          line,
          /uses: [\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+(\.\d+)*$/,
          `not pinned to a SHA with a tag comment: ${line.trim()}`
        );
      }
    });
  }

  it("ci.yml only needs read access to the repository", () => {
    const workflow = readRepoFile(".github/workflows/ci.yml");

    assert.match(workflow, /^permissions:\n {2}contents: read\n/m);
    assert.doesNotMatch(workflow, /: write/);
  });
});
