module.exports = {
  extends: ['airbnb-typescript/base'],
  parserOptions: {
    project: './tsconfig.eslint.json',
  },
  rules: {
    'import/prefer-default-export': 0,
    'no-plusplus': 0,
    'no-await-in-loop': 0,
    'func-names': 0,
    'no-console': 0,
  },
};
