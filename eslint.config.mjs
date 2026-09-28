import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Planning docs that contain illustrative .ts snippets, not production code.
    "docs/**",
  ]),
  {
    // Project-wide rule overrides
    rules: {
      // Underscore-prefixed args/vars are an intentional "I know this is unused"
      // signal (e.g., function signature must match an interface, but the body
      // does not need the param). Match TypeScript's own convention.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // OpenUI Lang's defineComponent({ component: ({ props }) => ... }) pattern
    // declares React components inside an object literal, so eslint's hooks
    // rule cannot recognize them as components and reports false positives on
    // every useState / useEffect call inside. The inner functions ARE real
    // React components — the rule just cannot see the convention.
    files: ["src/lib/openui/components.tsx"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
]);

export default eslintConfig;
