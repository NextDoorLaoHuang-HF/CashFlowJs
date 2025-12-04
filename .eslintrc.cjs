module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module"
  },
  plugins: ["@typescript-eslint", "prettier"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ],
  ignorePatterns: ["dist", "node_modules", "baselines/legacy-v0/**", "js/**", "css/**"],
  rules: {
    "prettier/prettier": "error",
    "@typescript-eslint/no-explicit-any": "off"
  }
};
