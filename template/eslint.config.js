import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

export default [
    {
        ignores: ["dist/**", "node_modules/**"],
    },
    {
        files: ["src/**/*.ts"],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
            },
        },
        plugins: {
            "@typescript-eslint": typescript,
        },
        rules: {
            "require-await": "warn",
            "no-console": ["warn", { allow: ["warn", "error"] }],
        },
    },
];
