import { RuleConfigSeverity, type UserConfig } from '@commitlint/types';

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      RuleConfigSeverity.Error,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'chore', 'ci', 'style', 'revert', 'test'],
    ],
    'type-case': [RuleConfigSeverity.Error, 'always', 'lower-case'],
    'subject-full-stop': [RuleConfigSeverity.Error, 'never', '.'],
  },
} satisfies UserConfig;
