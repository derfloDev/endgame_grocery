import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["**/dist/**", "**/build/**", "**/coverage/**", "**/node_modules/**"]
  },
  {
    files: ["backend/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node
    },
    rules: {
      ...js.configs.recommended.rules
    }
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["frontend/**/*.ts", "frontend/**/*.tsx"]
  })),
  {
    files: ["frontend/**/*.ts", "frontend/**/*.tsx"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off",
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true
        }
      ],
      "react/react-in-jsx-scope": "off"
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  },
  {
    files: ["frontend/**/*.js", "frontend/**/*.jsx"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser
      }
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off",
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true
        }
      ],
      "react/react-in-jsx-scope": "off"
    },
    settings: {
      react: {
        version: "detect"
      }
    }
  }
];
