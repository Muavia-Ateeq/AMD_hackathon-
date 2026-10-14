// jest.config.js - root test runner configuration. Owned by Ammar
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/backend/tests/**/*.test.js'],
  // Tests import from backend/src, which resolves backend/node_modules.
  moduleDirectories: ['node_modules', '<rootDir>/backend/node_modules'],
  // The API suite exercises the webhook route, which must never be left
  // fail-open. Pin an explicit secret so the auth path is deterministic.
  setupFiles: ['<rootDir>/backend/tests/setupEnv.js'],
  collectCoverageFrom: [
    'backend/src/**/*.js',
    '!backend/src/index.js'
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
  testTimeout: 20000
};