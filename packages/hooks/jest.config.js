module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^root/(.*)$': '<rootDir>/../../$1',
    '^@mongozest/([^/]+)$': '<rootDir>/../$1/src'
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/test/tsconfig.json'
    }
  }
};
