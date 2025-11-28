export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'chore', 'ci', 'style', 'revert'],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
  },
};
