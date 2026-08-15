import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export default defineConfig([
    { files: ["**/*.{js,mjs,cjs,ts}"] },
    {
        files: ["**/*.{js,mjs,cjs,ts}"],
        languageOptions: { globals: globals.node },
        rules: {
            eqeqeq: "off",
            "no-unused-vars": "error",
            "prefer-const": ["error", { ignoreReadBeforeAssign: true }],
        },
    },
    {
        files: ["**/*.{js,mjs,cjs,ts}"],
        plugins: { js },
        extends: ["js/recommended"],
    },
    tseslint.configs.recommended,
