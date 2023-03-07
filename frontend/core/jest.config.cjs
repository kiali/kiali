module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{js,jsx}'],
  coverageDirectory: 'coverage',
  testEnvironment: 'jsdom',
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