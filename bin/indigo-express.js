#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const readline = require("readline");
const { existsSync, statSync } = require("fs");
const chalk = require("chalk"); // For colored console output

/**
 * CLI script for indigo-express project generator
 */

// Parse command line arguments
const args = process.argv.slice(2);
const targetDir = args[0]
  ? args[0] === "."
    ? process.cwd()
    : path.join(process.cwd(), args[0])
  : path.join(process.cwd(), "indigo-express-api");

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
 */
async function init() {
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
        const shouldOverwrite = await promptOverwrite(targetDir);
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

    // Derive a project name from the target directory so scaffolded
    // projects don't all share the template's placeholder name/DB.
    const projectName = path.basename(targetDir);
    await updatePackageName(targetDir, toPackageName(projectName));

    // Auto-generate .env file from .env.example
    const envExamplePath = path.join(targetDir, ".env.example");
    const envPath = path.join(targetDir, ".env");
    if (existsSync(envExamplePath)) {
      await fs.copyFile(envExamplePath, envPath);
      await updateEnvDbName(envPath, toDbName(projectName));
      console.log(chalk.green("✔ Auto-generated .env file"));
    }

    // Display success message
    displaySuccessMessage(targetDir);
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

  const pkg = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  pkg.name = packageName;
  await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
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
 * Displays success message with next steps
 * @param {string} dir - Project directory
 */
function displaySuccessMessage(dir) {
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

  console.log(`  ${chalk.cyan("npm install")}         # Install dependencies`);
  console.log(
    `  ${chalk.cyan("npm run dev")}          # Start development server\n`
  );
  console.log(chalk.blue("Happy coding! 🚀\n"));
}

// Run the initialization
init();
