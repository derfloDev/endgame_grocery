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

function readCiJob(jobName) {
  const workflow = readRepoFile(".github/workflows/ci.yml");
  const job = workflow.match(new RegExp(`^ {2}${jobName}:\\n[\\s\\S]*?(?=^ {2}[a-z0-9-]+:|$(?![\\s\\S]))`, "m"));
  assert.ok(job, `expected CI job ${jobName}`);
  return job[0];
}

describe("arm64 smoke job", () => {
  it("ci.yml bounds the arm64 smoke job with a timeout", () => {
    assert.match(readCiJob("nginx-smoke-arm64"), /^ {4}timeout-minutes: 15$/m);
  });

  it("ci.yml builds the arm64 smoke image with build-push-action and the GHA cache", () => {
    const job = readCiJob("nginx-smoke-arm64");
    const buildStep = job.match(
      /^ {6}- uses: docker\/build-push-action@[0-9a-f]{40} # v7\n {8}with:\n(?: {10}.+\n)+/m
    );
    assert.ok(buildStep, "expected a pinned build-push-action step with inputs");
    const inputs = [
      "context: .",
      "platforms: linux/arm64",
      "load: true",
      "push: false",
      "tags: endgame-grocery:nginx-smoke-arm64",
      "cache-from: type=gha,scope=nginx-smoke-arm64",
      "cache-to: type=gha,scope=nginx-smoke-arm64,mode=max"
    ];
    for (const input of inputs) {
      assert.ok(buildStep[0].split("\n").includes(`          ${input}`), `missing build input: ${input}`);
    }
    assert.doesNotMatch(job, /docker buildx build/);
  });

  it("ci.yml keeps the arm64 architecture, bcrypt and nginx smoke checks", () => {
    const job = readCiJob("nginx-smoke-arm64");
    const orderedSteps = [
      "uses: actions/checkout@",
      "uses: docker/setup-qemu-action@",
      "uses: docker/setup-buildx-action@",
      "uses: docker/build-push-action@",
      "name: Check architecture and native bcrypt module",
      "bash docker/smoke-nginx.sh endgame-grocery:nginx-smoke-arm64"
    ];
    let previousIndex = -1;
    for (const step of orderedSteps) {
      const index = job.indexOf(step);
      assert.ok(index > previousIndex, `expected step in order: ${step}`);
      previousIndex = index;
    }
    assert.ok(job.includes("docker run --rm --platform linux/arm64 --entrypoint sh endgame-grocery:nginx-smoke-arm64"));
    assert.ok(job.includes('test "$(uname -m)" = aarch64'));
    assert.ok(job.includes('require(\\"bcrypt\\").hashSync(\\"smoke\\", 4)'));
    assert.match(job, /^ {10}DOCKER_DEFAULT_PLATFORM: linux\/arm64$/m);
  });

  it("ci.yml and docker-publish.yml pin the same build-push-action commit", () => {
    const pinPattern = /docker\/build-push-action@([0-9a-f]{40})/;
    const ciPin = readCiJob("nginx-smoke-arm64").match(pinPattern);
    const publishPin = readRepoFile(".github/workflows/docker-publish.yml").match(pinPattern);
    assert.ok(ciPin, "expected CI build-push-action pin");
    assert.ok(publishPin, "expected publish build-push-action pin");
    assert.equal(ciPin[1], publishPin[1]);
  });
});

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

  it("ci.yml type-checks the frontend in the lint job", () => {
    const workflow = readRepoFile(".github/workflows/ci.yml");
    const lintJob = workflow.split(/^ {2}unit-test:/m)[0];

    assert.match(lintJob, /- run: npm run typecheck\n/);
    // The check runs after lint and before the build so type errors fail fast.
    assert.ok(lintJob.indexOf("npm run lint") < lintJob.indexOf("npm run typecheck"));
    assert.ok(lintJob.indexOf("npm run typecheck") < lintJob.indexOf("npm run build"));
  });

  it("provides the typecheck script at the root and in the frontend workspace", () => {
    const rootScripts = JSON.parse(readRepoFile("package.json")).scripts;
    const frontendScripts = JSON.parse(readRepoFile("frontend/package.json")).scripts;

    assert.equal(frontendScripts.typecheck, "tsc --noEmit -p .");
    assert.equal(rootScripts.typecheck, "npm run typecheck --workspaces --if-present");
  });

  it("ci.yml only needs read access to the repository", () => {
    const workflow = readRepoFile(".github/workflows/ci.yml");

    assert.match(workflow, /^permissions:\n {2}contents: read\n/m);
    assert.doesNotMatch(workflow, /: write/);
  });
});
