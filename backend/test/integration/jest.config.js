// ADR-021 — integration tests config (RBAC intrusion specs).
//
// Distinct from the inline unit-test config in package.json :
//   - rootDir = test/integration (not src/) so we don't run unit specs.
//   - Higher timeout : booting AppModule + Prisma migrations is slower
//     than mocked unit tests.
//   - Always --runInBand (set via package.json script) so seed fixtures
//     are not raced between specs.

/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  // @scure/* and @noble/* (transitive of otplib via @otplib/plugin-base32-scure
  // and @otplib/plugin-crypto-noble) are ESM-only — Jest's default
  // transformIgnorePatterns excludes node_modules from transformation,
  // so we whitelist these scopes to be transpiled by ts-jest.
  // The `.*` in the lookahead matches both top-level paths
  // (node_modules/@scure/...) and nested ones
  // (node_modules/@otplib/plugin-crypto-noble/node_modules/@noble/...) — npm
  // hoisting may install nested copies on version conflicts.
  transformIgnorePatterns: ['/node_modules/(?!.*(@scure|@noble)/)'],
  testEnvironment: 'node',
  testTimeout: 30000,
  // ts-jest needs to know where the backend tsconfig is — point at the
  // backend tsconfig so relative imports of src/* resolve.
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/../../tsconfig.json',
    },
  },
  // No setup/teardown DB hooks here ; each spec is responsible for
  // calling seedRbac / wipeRbac in beforeAll / afterAll. Keeps specs
  // self-contained and grep-able.
};
