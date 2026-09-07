// biome-ignore-all lint/style/useNamingConvention: Configuration fields follow the Rust wire schema.
import { describe, expect, it } from 'vitest';
import {
  completeLegacyToolchains,
  missingValues,
  quoteArgument,
  splitArguments,
} from '@/infrastructure/rpc/arguments';

describe('legacy configuration migration', () => {
  it('preserves existing scalar values and arrays while importing absent nested fields', () => {
    const existing = {
      languages: { cpp: { compiler: '/custom/clang++', compiler_args: ['-O3'] } },
      compilation_timeout_ms: 5000,
    };
    const imported = {
      languages: {
        cpp: { compiler: 'g++', compiler_args: ['-O0'] },
        python: { interpreter: 'python3' },
      },
      compilation_timeout_ms: 10000,
      problem: { memory_limit: 512 },
    };
    expect(missingValues(existing, imported)).toEqual({
      languages: { python: { interpreter: 'python3' } },
      problem: { memory_limit: 512 },
    });
    expect(existing.languages.cpp.compiler_args).toEqual(['-O3']);
  });

  it('keeps explicitly configured false and zero values', () => {
    expect(missingValues({ enabled: false, limit: 0 }, { enabled: true, limit: 20 })).toEqual({});
  });

  it('round trips empty arguments, quoted macros and executable paths containing spaces', () => {
    const args = ['', '-O2', '-DNAME="a b"', 'C:\\Program Files\\SDK', "a'b"];
    expect(splitArguments(args.map(quoteArgument).join(' '))).toEqual(args);
  });

  it('preserves UNC paths, repeated backslashes and literal control characters', () => {
    const args = [
      String.raw`\\server\share`,
      String.raw`-DREGEX=\\d+`,
      'line\nbreak',
      'tab\tvalue',
      "a'b",
    ];
    expect(splitArguments(args.map(quoteArgument).join(' '))).toEqual(args);
  });

  it('keeps Windows path separators and refuses incomplete quotes before migration', () => {
    expect(splitArguments(String.raw`-I C:\SDK\include -DLOCAL`)).toEqual([
      '-I',
      String.raw`C:\SDK\include`,
      '-DLOCAL',
    ]);
    expect(() => splitArguments('"unfinished')).toThrow('Unclosed quote');
  });
  it('keeps migrated syntax-check flags separate from runtime flags', () => {
    const patch = { languages: { python: { compiler_args: ['-X', 'utf8'] } } };
    expect(completeLegacyToolchains(patch, { python: { interpreter: '/bin/python3' } })).toEqual({
      languages: { python: { compiler: '/bin/python3', compiler_args: ['-X', 'utf8'] } },
    });
    expect(patch.languages.python).not.toHaveProperty('compiler');
    const existingCompiler = {
      python: { compiler: '/custom/python', interpreter: '/bin/python3' },
    };
    expect(completeLegacyToolchains(patch, existingCompiler)).toEqual(patch);
    expect(
      completeLegacyToolchains(
        {
          languages: {
            javascript: { interpreter: '/custom/node', compiler_args: ['--trace-warnings'] },
          },
        },
        { javascript: { interpreter: '/bin/node' } },
      ),
    ).toEqual({
      languages: {
        javascript: {
          compiler: '/custom/node',
          interpreter: '/custom/node',
          compiler_args: ['--trace-warnings'],
        },
      },
    });
  });
});
