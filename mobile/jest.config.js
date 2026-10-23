module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-native/.*)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-safe-area-context)/',
    'node_modules/\\.pnpm/(?!(@react-native|react-native|expo)).*',
  ],
  setupFilesAfterEnv: [
    '@testing-library/react-native/extend-expect',
<<<<<<< HEAD
    '<rootDir>/jest.setup.js',
=======
    './jest.setup.js',
>>>>>>> d72fe692fe0d6f86c2bf8d9eb6108fbd0c0c4afd
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/assets/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
