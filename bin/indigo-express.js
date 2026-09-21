#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const readline = require("readline");
const { existsSync, statSync } = require("fs");
const { spawn, spawnSync } = require("child_process");
const { Command } = require("commander");
const chalk = require("chalk"); // For colored console output
const pkg = require("../package.json");

/**
 * CLI script for indigo-express project generator
 */

const templateDir = path.join(__dirname, "../template");

// Entries that don't count as "existing content" when checking whether a
// target directory is safe to scaffold into (e.g. a freshly cloned repo
// that only has a .git folder and maybe a README/LICENSE).
const BENIGN_ENTRIES = new Set([
  ".git",
  ".gitignore",
  ".gitattributes",
  ".DS_Store",
  "README.md",
  "LICENSE",
  "LICENSE.md",
]);

/**
 * Derives a valid npm package name from the target directory name.
 * @param {string} name - Raw directory basename
 * @returns {string} - A valid, lowercase, kebab-case package name
 */
function toPackageName(name) {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9-~]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");

  return sanitized || "indigo-express-api";
}

/**
 * Derives a valid Postgres database name from the target directory name.
 * @param {string} name - Raw directory basename
 * @returns {string} - A valid, lowercase, snake_case database name
 */
function toDbName(name) {
  let sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (/^[0-9]/.test(sanitized)) {
    sanitized = `db_${sanitized}`;
  }

  return sanitized || "indigo_db";
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

/**
 * Main function to start the process
 * @param {string | undefined} target - Raw target argument from the CLI
 * @param {{ skipInstall?: boolean, skipGit?: boolean, dbName?: string }} options
 */
async function init(target, options) {
  const targetDir = target
    ? target === "."
      ? process.cwd()
      : path.join(process.cwd(), target)
    : path.join(process.cwd(), "indigo-express-api");

  try {
    // Check if template directory exists
    if (!existsSync(templateDir)) {
      throw new Error(`Template directory ${templateDir} does not exist.`);
    }

    // Check if target directory exists
    const targetExists = existsSync(targetDir);

    if (targetExists) {
      // Handle existing directory. Ignore benign entries (.git, README,
      // LICENSE, etc.) so a freshly cloned/initialized repo isn't treated
      // as "non-empty".
      const existingEntries = await fs.readdir(targetDir);
      const conflictingEntries = existingEntries.filter(
        (entry) => !BENIGN_ENTRIES.has(entry)
      );
      const isEmpty = conflictingEntries.length === 0;

      if (!isEmpty) {
        const shouldOverwrite = options.yes || (await promptOverwrite(targetDir));
        if (!shouldOverwrite) {
          console.log(chalk.yellow("Operation cancelled."));
          return;
        }

        await cleanDirectory(targetDir);
      }
    } else {
      // Create target directory if it doesn't exist
      await fs.mkdir(targetDir, { recursive: true });
    }

    // Copy template files to target directory
    await copyRecursive(templateDir, targetDir);

    // npm strips any file named `.gitignore` (or `.npmignore`) from the
    // published package — it treats them as packaging metadata, not
    // content. The template ships it as a plain `gitignore` file and we
    // rename it back here so scaffolded projects still get one.
    const gitignoreSourcePath = path.join(targetDir, "gitignore");
    const gitignoreTargetPath = path.join(targetDir, ".gitignore");
    if (existsSync(gitignoreSourcePath)) {
      await fs.rename(gitignoreSourcePath, gitignoreTargetPath);
    }

    // Derive a project name from the target directory so scaffolded
    // projects don't all share the template's placeholder name/DB.
    const projectName = path.basename(targetDir);
    await updatePackageName(targetDir, toPackageName(projectName));

    // Auto-generate .env file from .env.example
    const envExamplePath = path.join(targetDir, ".env.example");
    const envPath = path.join(targetDir, ".env");
    if (existsSync(envExamplePath)) {
      await fs.copyFile(envExamplePath, envPath);
      const dbName = options.dbName ? toDbName(options.dbName) : toDbName(projectName);
      await updateEnvDbName(envPath, dbName);
      console.log(chalk.green("✔ Auto-generated .env file"));
    }

    const gitInitialized = options.skipGit ? false : runGitInit(targetDir);

    const installSucceeded = options.skipInstall
      ? false
      : await runNpmInstall(targetDir);

    // Display success message
    displaySuccessMessage(targetDir, { installSucceeded, gitInitialized });
  } catch (error) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  } finally {
    rl.close();
  }
}

/**
 * Prompts the user whether to overwrite an existing directory
 * @param {string} dir - Directory path
 * @returns {Promise<boolean>} - User's decision
 */
function promptOverwrite(dir) {
  const relativePath = path.relative(process.cwd(), dir);
  const dirName =
    relativePath === "" ? "Current directory" : `Directory '${relativePath}'`;

  return new Promise((resolve) => {
    rl.question(
      chalk.yellow(
        `${dirName} already exists and is not empty. Overwrite? (y/N): `
      ),
      (answer) => {
        resolve(answer.toLowerCase() === "y");
      }
    );
  });
}

/**
 * Recursively copies files from source to destination
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 */
async function copyRecursive(src, dest) {
  const stats = statSync(src);

  if (stats.isDirectory()) {
    // Ensure destination directory exists
    if (!existsSync(dest)) {
      await fs.mkdir(dest, { recursive: true });
    }

    // Copy each item in the directory
    const entries = await fs.readdir(src);

    for (const entry of entries) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);

      await copyRecursive(srcPath, destPath);
    }
  } else {
    // Copy file
    await fs.copyFile(src, dest);
  }
}

/**
 * Sets the "name" field in the scaffolded project's package.json.
 * @param {string} dir - Target project directory
 * @param {string} packageName - Derived package name
 */
async function updatePackageName(dir, packageName) {
  const packageJsonPath = path.join(dir, "package.json");
  if (!existsSync(packageJsonPath)) return;

  const scaffoldedPkg = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  scaffoldedPkg.name = packageName;
  await fs.writeFile(
    packageJsonPath,
    `${JSON.stringify(scaffoldedPkg, null, 2)}\n`
  );
}

/**
 * Replaces the DB_NAME value in the scaffolded project's .env file.
 * @param {string} envPath - Path to the .env file
 * @param {string} dbName - Derived database name
 */
async function updateEnvDbName(envPath, dbName) {
  const content = await fs.readFile(envPath, "utf8");
  const updated = content.replace(/^DB_NAME=.*$/m, `DB_NAME=${dbName}`);
  await fs.writeFile(envPath, updated);
}

/**
 * Removes all contents from a directory, preserving .git so scaffolding
 * into an existing repo never destroys its history.
 * @param {string} dir - Directory to clean
 */
async function cleanDirectory(dir) {
  const entries = await fs.readdir(dir);

  for (const entry of entries) {
    if (entry === ".git") continue;

    const entryPath = path.join(dir, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      await fs.rm(entryPath, { recursive: true, force: true });
    } else {
      await fs.unlink(entryPath);
    }
  }
}

/**
 * Runs `git init` in the target directory, unless it's already inside a
 * git work tree (its own .git, or an ancestor's) or git isn't installed.
 * @param {string} dir - Target project directory
 * @returns {boolean} - Whether a new repo was actually initialized
 */
function runGitInit(dir) {
  const alreadyInRepo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: dir,
    stdio: "ignore",
  });

  if (alreadyInRepo.error) {
    console.log(chalk.yellow("⚠ git not found — skipping git init"));
    return false;
  }

  if (alreadyInRepo.status === 0) {
    return false;
  }

  const result = spawnSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  if (result.error || result.status !== 0) {
    console.log(chalk.yellow("⚠ git init failed — skipping"));
    return false;
  }

  console.log(chalk.green("✔ Initialized a git repository"));
  return true;
}

/**
 * Runs `npm install` in the target directory, streaming output live.
 * @param {string} dir - Target project directory
 * @returns {Promise<boolean>} - Whether install succeeded
 */
function runNpmInstall(dir) {
  console.log(chalk.cyan("\nInstalling dependencies with npm install...\n"));

  return new Promise((resolve) => {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(npmCommand, ["install"], { cwd: dir, stdio: "inherit" });

    child.on("error", () => {
      console.log(chalk.yellow("\n⚠ npm install failed to start — skipping"));
      resolve(false);
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(chalk.green("\n✔ Dependencies installed"));
        resolve(true);
      } else {
        console.log(chalk.yellow("\n⚠ npm install failed — you can run it manually"));
        resolve(false);
      }
    });
  });
}

/**
 * Displays success message with next steps
 * @param {string} dir - Project directory
 * @param {{ installSucceeded: boolean, gitInitialized: boolean }} status
 */
function displaySuccessMessage(dir, { installSucceeded, gitInitialized }) {
  const relativePath = path.relative(process.cwd(), dir);
  const dirDisplay =
    relativePath === "" ? "current directory" : `'${relativePath}'`;

  console.log(
    chalk.green(`\n✨ Project created successfully in ${dirDisplay}! ✨\n`)
  );
  console.log("Next steps:");

  if (relativePath !== "") {
    console.log(`  ${chalk.cyan("cd")} ${relativePath}`);
  }

  if (!installSucceeded) {
    console.log(`  ${chalk.cyan("npm install")}         # Install dependencies`);
  }

  console.log(
    `  ${chalk.cyan("npm run dev")}          # Start development server\n`
  );

  if (gitInitialized) {
    console.log(chalk.dim("A git repository was initialized for you.\n"));
  }

  console.log(chalk.blue("Happy coding! 🚀\n"));
}

const program = new Command();

program
  .name("indigo-express")
  .description(pkg.description)
  .version(pkg.version, "-v, --version", "print the installed version")
  .argument(
    "[target]",
    "directory to scaffold into ('.' for the current directory)"
  )
  .option("--skip-install", "don't run npm install after scaffolding")
  .option("--skip-git", "don't run git init after scaffolding")
  .option(
    "-y, --yes",
    "don't prompt before overwriting a non-empty directory"
  )
  .option(
    "--db-name <name>",
    "override the auto-derived database name (used in .env)"
  )
  .action(init);

program.parse();
