// ESLint flat config — Next 16 exports native flat presets. Consuming those
// directly avoids passing their plugin objects back through FlatCompat, which
// fails schema serialization under ESLint 9.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: [".next/", "out/", "node_modules/", "next-env.d.ts"],
  },
  {
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      // Next 16's native preset enables the React Compiler diagnostic suite.
      // This repository has not adopted the compiler yet; preserve the prior
      // lint contract (Rules of Hooks + exhaustive deps) instead of turning a
      // dependency restore into a 200-file compiler migration.
      "react-hooks/static-components": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/void-use-memo": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/incompatible-library": "off",
      "react-hooks/immutability": "off",
      "react-hooks/globals": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-render": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/config": "off",
      "react-hooks/gating": "off",
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
