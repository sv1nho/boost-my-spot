import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactPlugin from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import security from "eslint-plugin-security";

const reactRecommended = reactPlugin.configs["recommended-typescript"];

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "server/generated/**",
      "eslint.config.js",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.server.json"],
        sourceType: "module",
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        console: "readonly",
        HTMLCanvasElement: "readonly",
        DOMParser: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...tsPlugin.configs["recommended-type-checked"].rules,
      ...tsPlugin.configs.strict.rules,
      "new-cap": "off",
      "camelcase": "off",
      "no-void": ["error", { allowAsStatement: true }],
      "no-unused-vars": "off",
      "no-use-before-define": "off",
      "no-console": "warn",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  
  {
    files: [
      "server/**/*.ts",
      "prisma/**/*.ts",
      "scripts/**/*.ts",
      "e2e/**/*.ts",
      "prisma.config.ts",
      "vite.config.ts",
      "playwright.config.ts",
    ],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        fetch: "readonly",
        Headers: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        performance: "readonly",
      },
    },
    plugins: { security },
    rules: {
      ...security.configs.recommended.rules,
      "security/detect-object-injection": "off",
      "security/detect-non-literal-fs-filename": "off",
      "no-restricted-properties": [
        "error",
        {
          object: "prisma",
          property: "$queryRawUnsafe",
          message: "Build the query with the tagged template, so the values stay parameters.",
        },
        {
          object: "prisma",
          property: "$executeRawUnsafe",
          message: "Build the query with the tagged template, so the values stay parameters.",
        },
      ],
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  
  {
    files: ["prisma/__tests__/schema.test.ts"],
    rules: { "no-restricted-properties": "off" },
  },

  {
    files: ["**/*.tsx"],
    plugins: {
      ...reactRecommended.plugins,
      "react-hooks": reactHooks,
    },
    settings: reactRecommended.settings,
    rules: {
      ...reactRecommended.rules,
      ...reactHooks.configs.recommended.rules,
      
      "@eslint-react/rules-of-hooks": "off",
      "@eslint-react/exhaustive-deps": "off",
      "@eslint-react/set-state-in-effect": "off",
      "@eslint-react/set-state-in-render": "off",
      "@eslint-react/use-memo": "off",
    },
  },
];
