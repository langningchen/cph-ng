import { parseArgsStringToArgv } from 'string-argv';

export const parseCommandArgs = (args: string): string[] => parseArgsStringToArgv(args);
