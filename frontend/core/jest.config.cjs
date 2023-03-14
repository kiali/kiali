module.exports = {
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    "!<rootDir>/node_modules/"
  ],
  coverageThreshold: {
    global: {
      lines: 90,
      statements: 90,
      branch: 90
    }
  },
  coverageDirectory: '.coverage',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: [ "@testing-library/jest-dom/extend-expect" ],
  setupFiles: [
    './setupTests.ts'
  ],
  transform: {
    "^.+\\.(ts|tsx|js|jsx)$": [
      "ts-jest",
      {
        useESM: true,
      },
    ]
  },
  extensionsToTreatAsEsm: ['.ts','.tsx'], 
  transformIgnorePatterns: [
   'node_modules/(?!@patternfly)'
  ],
  moduleNameMapper: {
    '\\.(css|less)$': '<rootDir>/src/__mocks__/styleMock.cjs'
  },
  modulePathIgnorePatterns: ["<rootDir>/lib/"]
};