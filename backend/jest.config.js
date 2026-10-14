// backend/jest.config.js
// Mirrors the root jest.config.js so `npm test` behaves identically whether
// it is invoked from the repo root or from backend/. Owned by Ammar
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js'
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
  testTimeout: 20000
};