const {NODE_ENV = 'development'} = process.env;

const moduleNameMapperOptions = {
  moduleNameMapper: {
    '^src/(.*)': '<pkgDir>/src/$1',
    '^test/(.*)': '<pkgDir>/test/$1',
    '^root/(.*)': '<pkgDir>/../../$1',
    '^workspace/(.*)': '<pkgDir>/../../$1'
  }
};

const presets = [
  '@babel/preset-typescript',
  [
    '@babel/preset-env',
    {
      targets: {
        node: '8' // maintenance lts @link https://nodejs.org/en/about/releases/
      },
      loose: true
    }
  ]
];
const plugins = [
  ['babel-plugin-module-name-mapper', moduleNameMapperOptions],
  ['@babel/plugin-proposal-class-properties', {loose: true}],
  '@babel/plugin-transform-runtime'
];

if (NODE_ENV !== 'production') {
  moduleNameMapperOptions.moduleNameMapper['^@mongozest/([^/]+)$'] = '<pkgDir>/../$1/src';
}

module.exports = {
  presets,
  plugins
};
