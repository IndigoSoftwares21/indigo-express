"use strict";

// Runs the real bin/indigo-express.js as a subprocess against throwaway temp
// directories — this exercises exactly what a user invokes (`npx
// indigo-express ...`), not internals, so it stays valid across refactors.
//
// Every scaffold here passes --skip-install (npm install is slow/network
// dependent — proven separately, not in this fast unit suite) and --skip-git
// unless the test is specifically about one of those behaviors.

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CLI_PATH = path.join(__dirname, "..", "bin", "indigo-express.js");
const pkg = require("../package.json");

function mkTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "indigo-express-test-"));
}

function runCli(args, { cwd, input } = {}) {
    return spawnSync(process.execPath, [CLI_PATH, ...args], {
        cwd,
        input,
        encoding: "utf8",
    });
}

test("--version prints the package version", () => {
    const result = runCli(["--version"]);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), pkg.version);
});

test("--help prints usage", () => {
    const result = runCli(["--help"]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage:/);
    assert.match(result.stdout, /--skip-install/);
    assert.match(result.stdout, /--skip-git/);
    assert.match(result.stdout, /--db-name/);
});

test("scaffolds into a truly empty directory via '.'", () => {
    const dir = mkTmpDir();

    const result = runCli([".", "--skip-install", "--skip-git"], { cwd: dir });

    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(dir, "package.json")));
    assert.ok(fs.existsSync(path.join(dir, "src", "app.ts")));
    assert.ok(fs.existsSync(path.join(dir, ".gitignore")));
    assert.ok(fs.existsSync(path.join(dir, ".env")));

    fs.rmSync(dir, { recursive: true, force: true });
});

test("a directory containing only .git is treated as empty (no prompt)", () => {
    const dir = mkTmpDir();
    fs.mkdirSync(path.join(dir, ".git"));
    fs.writeFileSync(path.join(dir, ".git", "HEAD"), "ref: refs/heads/main\n");

    // No stdin input provided — if the CLI wrongly prompted for overwrite,
    // it would hang waiting for input and this would time out/fail.
    const result = runCli([".", "--skip-install", "--skip-git"], { cwd: dir });

    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /already exists and is not empty/);
    assert.ok(fs.existsSync(path.join(dir, "package.json")));
    assert.ok(fs.existsSync(path.join(dir, ".git", "HEAD")), ".git must survive");

    fs.rmSync(dir, { recursive: true, force: true });
});

test("overwriting a non-empty directory preserves .git", () => {
    const dir = mkTmpDir();
    fs.mkdirSync(path.join(dir, ".git"));
    fs.writeFileSync(path.join(dir, ".git", "HEAD"), "ref: refs/heads/main\n");
    fs.writeFileSync(path.join(dir, "stale-file.txt"), "old content");

    const result = runCli([".", "--skip-install", "--skip-git"], {
        cwd: dir,
        input: "y\n",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(dir, ".git", "HEAD")), ".git must survive");
    assert.ok(!fs.existsSync(path.join(dir, "stale-file.txt")));
    assert.ok(fs.existsSync(path.join(dir, "package.json")));

    fs.rmSync(dir, { recursive: true, force: true });
});

test("declining the overwrite prompt cancels without touching the directory", () => {
    const dir = mkTmpDir();
    fs.writeFileSync(path.join(dir, "stale-file.txt"), "old content");

    const result = runCli([".", "--skip-install", "--skip-git"], {
        cwd: dir,
        input: "n\n",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Operation cancelled/);
    assert.ok(fs.existsSync(path.join(dir, "stale-file.txt")));
    assert.ok(!fs.existsSync(path.join(dir, "package.json")));

    fs.rmSync(dir, { recursive: true, force: true });
});

test("package name and DB name are derived and sanitized from the target directory name", () => {
    const parent = mkTmpDir();
    const dir = path.join(parent, "My Cool_API 2.0");
    fs.mkdirSync(dir);

    const result = runCli([".", "--skip-install", "--skip-git"], { cwd: dir });

    assert.equal(result.status, 0, result.stderr);

    const scaffoldedPkg = JSON.parse(
        fs.readFileSync(path.join(dir, "package.json"), "utf8"),
    );
    assert.equal(scaffoldedPkg.name, "my-cool-api-2-0");

    const env = fs.readFileSync(path.join(dir, ".env"), "utf8");
    assert.match(env, /^DB_NAME=my_cool_api_2_0$/m);

    fs.rmSync(parent, { recursive: true, force: true });
});

test("--db-name overrides the auto-derived database name", () => {
    const dir = mkTmpDir();

    const result = runCli(
        [".", "--skip-install", "--skip-git", "--db-name", "Custom DB!"],
        { cwd: dir },
    );

    assert.equal(result.status, 0, result.stderr);

    const env = fs.readFileSync(path.join(dir, ".env"), "utf8");
    assert.match(env, /^DB_NAME=custom_db$/m);

    fs.rmSync(dir, { recursive: true, force: true });
});

test("with no target argument, scaffolds into ./indigo-express-api", () => {
    const dir = mkTmpDir();

    const result = runCli(["--skip-install", "--skip-git"], { cwd: dir });

    assert.equal(result.status, 0, result.stderr);

    const projectDir = path.join(dir, "indigo-express-api");
    assert.ok(fs.existsSync(path.join(projectDir, "package.json")));

    const scaffoldedPkg = JSON.parse(
        fs.readFileSync(path.join(projectDir, "package.json"), "utf8"),
    );
    assert.equal(scaffoldedPkg.name, "indigo-express-api");

    fs.rmSync(dir, { recursive: true, force: true });
});

test("--skip-git leaves no .git directory", () => {
    const dir = mkTmpDir();

    const result = runCli([".", "--skip-install", "--skip-git"], { cwd: dir });

    assert.equal(result.status, 0, result.stderr);
    assert.ok(!fs.existsSync(path.join(dir, ".git")));

    fs.rmSync(dir, { recursive: true, force: true });
});

test("by default (no --skip-git), a git repo is initialized", () => {
    const dir = mkTmpDir();

    const result = runCli([".", "--skip-install"], { cwd: dir });

    assert.equal(result.status, 0, result.stderr);
    assert.ok(fs.existsSync(path.join(dir, ".git")));
    assert.match(result.stdout, /Initialized a git repository/);

    fs.rmSync(dir, { recursive: true, force: true });
});

test("git init is skipped (not re-run) when already inside a git repo", () => {
    const dir = mkTmpDir();
    const initResult = spawnSync("git", ["init"], { cwd: dir });
    if (initResult.error) {
        // git isn't available in this environment — nothing to verify.
        fs.rmSync(dir, { recursive: true, force: true });
        return;
    }

    const result = runCli([".", "--skip-install"], { cwd: dir });

    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /Initialized a git repository/);

    fs.rmSync(dir, { recursive: true, force: true });
});
