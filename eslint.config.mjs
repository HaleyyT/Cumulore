import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      ".local/**",
      ".venv/**",
      "**/__pycache__/**",
      ".mypy_cache/**",
      ".pytest_cache/**",
      ".ruff_cache/**",
    ],
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: { URL: "readonly", console: "readonly" },
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
);
