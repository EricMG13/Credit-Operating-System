// ESLint flat config — next/core-web-vitals + next/typescript via FlatCompat
// (`next lint` is deprecated; lint runs through the ESLint CLI: npm run lint).
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/", "out/", "node_modules/", "next-env.d.ts"],
  },
  {
    rules: {
      // Underscore prefix marks intentional discards (e.g. rest-destructuring
      // out a property: `const { g: _g, ...rest } = p`).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];
