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
      // Handle existing directory
      const isEmpty = (await fs.readdir(targetDir)).length === 0;

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
 * Removes all contents from a directory
 * @param {string} dir - Directory to clean
 */
async function cleanDirectory(dir) {
  const entries = await fs.readdir(dir);

  for (const entry of entries) {
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
    `  ${chalk.cyan("cp .env.example .env")} # Create environment file`
  );
  console.log(
    `  ${chalk.cyan("npm run dev")}          # Start development server\n`
  );
  console.log(chalk.blue("Happy coding! 🚀\n"));
}

// Run the initialization
init();
