import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...compat.config({
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // Disable `any` type rule
      "@typescript-eslint/no-unused-vars": "off", // Disable unused vars rule
      "react/display-name": "off", // Disable missing display name warning
    },
  })
];

export default eslintConfig;
