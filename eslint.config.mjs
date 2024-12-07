import globals from "globals";
import pluginJs from "@eslint/js";

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        chrome: true, 
        importScripts: true, 
      },
    },
  },
  pluginJs.configs.recommended,
];
