module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  projects: ['<rootDir>/packages/*'],
  setupFiles: ['<rootDir>/test/setup.ts']
};
