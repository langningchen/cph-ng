// biome-ignore-all lint/style/useNamingConvention: DTO fields follow the Rust wire schema.
import type { ProblemDto } from './problemService';

/** Convert Rust canonical paths to the ordinary fsPath representation used by VS Code. */
export function editorPath(path: string): string {
  if (process.platform !== 'win32') return path;
  if (path.startsWith('\\\\?\\UNC\\')) path = `\\\\${path.slice(8)}`;
  else if (/^\\\\\?\\[a-z]:\\/i.test(path)) path = path.slice(4);
  return path.replaceAll('/', '\\').replace(/^[A-Z]:/, (drive) => drive.toLowerCase());
}

export function editorProblem(dto: ProblemDto): ProblemDto {
  return {
    ...dto,
    source_path: editorPath(dto.source_path),
    checker: dto.checker === null ? null : editorPath(dto.checker),
    interactor: dto.interactor === null ? null : editorPath(dto.interactor),
    generator: dto.generator === null ? null : editorPath(dto.generator),
    brute_force: dto.brute_force === null ? null : editorPath(dto.brute_force),
  };
}
