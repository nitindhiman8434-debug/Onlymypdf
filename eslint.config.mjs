import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".next-local-preview/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated / snapshot artifacts — not source code
    ".snapshots/**",
    "coverage/**",
  ]),
  {
    files: ["**/*.cjs"],
    rules: {
      // These Node runner scripts intentionally use CommonJS.
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    rules: {
      // React Compiler rules flag common, valid patterns (mount fetches, hydration).
      // Disabled so CI reflects fixable issues; revisit when migrating to Compiler.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
    },
  },
  {
    files: ["src/components/tools/**/*.{ts,tsx}", "src/app/(tools)/**/*.{ts,tsx}"],
    rules: {
      // PDF/image tool previews use blob: URLs — next/image is unsuitable here.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
