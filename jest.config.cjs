// jest.config.js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",
  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: ["src/**/*.{ts,tsx}", ".*(!\\.d\\.ts)$"],
  transform: {
    // Reintroduce babelConfig to ensure ts-jest uses Babel for JSX
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        useESM: true,
        babelConfig: {
          presets: [
            "@babel/preset-env",
            ["@babel/preset-react", { runtime: "automatic" }],
            "@babel/preset-typescript",
          ],
        },
      },
    ],
    // Keep this transform for the specific ESM modules
    "node_modules/(remark-parse|remark-slate|unified|micromark.*|mdast-util-.*|decode-named-character-reference|character-entities|bail|unist-util-.*)/.*\\.js$":
      [
        "babel-jest",
        {
          presets: ["@babel/preset-env"],
          plugins: ["@babel/plugin-transform-modules-commonjs"],
        },
      ],
  },
  // Update transformIgnorePatterns to NOT ignore these ESM modules
  transformIgnorePatterns: [
    // Ignore node_modules EXCEPT the ones listed below
    "/node_modules/(?!(remark-parse|remark-slate|unified|micromark.*|mdast-util-.*|decode-named-character-reference|character-entities|bail|unist-util-.*)/)",
  ],
  // Add this section to handle .js imports in ESM/TS projects
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
};
