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
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": "warn",
      "no-restricted-syntax": [
        "warn",
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message: "Use env from @/lib/config/env instead of process.env",
        },
      ],
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["../../../*"],
              message: "Use @/ path aliases instead of deep relative imports",
            },
          ],
        },
      ],
    }
  },
  {
    files: ["**/__tests__/**", "**/*.test.*", "**/__mocks__/**"],
    rules: {
      "no-console": "off",
    },
  }
];

export default eslintConfig;
