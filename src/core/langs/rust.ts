// Copyright (C) 2026
// Rust language support for cph-ng

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { type } from 'os';
import { basename, dirname, extname, join } from 'path';
import Logger from '@/helpers/logger';
import Settings from '@/helpers/settings';
import { FileWithHash } from '@/types';
import { KnownResult, UnknownResult } from '@/utils/result';
import {
  CompileAdditionalData,
  DefaultCompileAdditionalData,
  Lang,
  LangCompileResult,
} from './lang';

export class LangRust extends Lang {
  private logger: Logger = new Logger('langsRust');
  public readonly name = 'Rust';
  public readonly extensions = ['rs'];
  public readonly enableRunner = true;

  protected async _compile(
    src: FileWithHash,
    ac: AbortController,
    forceCompile: boolean | null,
    {
      compilationSettings,
    }: CompileAdditionalData = DefaultCompileAdditionalData,
  ): Promise<LangCompileResult> {
    this.logger.trace('compile', { src, forceCompile });

    const outputPath = join(
      Settings.cache.directory,
      basename(src.path, extname(src.path)) +
        (type() === 'Windows_NT' ? '.exe' : ''),
    );

    const compiler =
      compilationSettings?.compiler ??
      Settings.compilation.rustCompiler ??
      'rustc';
    const args =
      compilationSettings?.compilerArgs ?? Settings.compilation.rustArgs ?? '';

    const { skip, hash } = await Lang.checkHash(
      src,
      outputPath,
      compiler + args,
      forceCompile,
    );
    if (skip) {
      return new UnknownResult({ outputPath, hash });
    }

    // Search for Cargo.toml in current dir and parent
    const srcDir = dirname(src.path);
    const parentDir = dirname(srcDir);
    let cargoManifestDir: string | null = null;
    if (existsSync(join(srcDir, 'Cargo.toml'))) {
      cargoManifestDir = srcDir;
    } else if (existsSync(join(parentDir, 'Cargo.toml'))) {
      cargoManifestDir = parentDir;
    }

    // If Cargo.toml exists, use cargo build. Otherwise, create a temporary manifest under cache and use cargo with --manifest-path
    let usedCargo = false;
    let builtPath: string | null = null;
    if (cargoManifestDir) {
      // Build with cargo in that project
      const binName = basename(src.path, extname(src.path));
      const cmd = [
        'cargo',
        'build',
        '--release',
        '--manifest-path',
        join(cargoManifestDir, 'Cargo.toml'),
      ];
      const res = await this._executeCompiler(cmd, ac);
      if (res instanceof KnownResult) {
        return new KnownResult(res.verdict, res.msg, { outputPath, hash });
      }
      builtPath = join(
        cargoManifestDir,
        'target',
        'release',
        binName + (type() === 'Windows_NT' ? '.exe' : ''),
      );
      usedCargo = true;
    } else {
      // Create temporary cargo project manifest in cache
      try {
        const tmpDir = join(Settings.cache.directory, 'rust_temp_projects');
        if (!existsSync(tmpDir)) {
          mkdirSync(tmpDir, { recursive: true });
        }
        const projectName = `cphng_${basename(src.path, extname(src.path))}`;
        const manifestPath = join(tmpDir, projectName + '_Cargo.toml');
        const relSrcPath = src.path; // cargo accepts absolute paths in [[bin]] path
        const manifest = ` [package]\nname = "${projectName}"\nversion = "0.1.0"\nedition = "2021"\n\n[[bin]]\nname = "${basename(src.path, extname(src.path))}"\npath = "${relSrcPath}"\n`;
        writeFileSync(manifestPath, manifest, 'utf-8');
        const cmd = [
          'cargo',
          'build',
          '--release',
          '--manifest-path',
          manifestPath,
        ];
        const res = await this._executeCompiler(cmd, ac);
        if (res instanceof KnownResult) {
          return new KnownResult(res.verdict, res.msg, { outputPath, hash });
        }
        builtPath = join(
          tmpDir,
          'target',
          'release',
          basename(src.path, extname(src.path)) +
            (type() === 'Windows_NT' ? '.exe' : ''),
        );
        // Note: cargo will by default use manifest's directory for target; when manifest is a file in tmpDir, target is under tmpDir/target
        usedCargo = true;
      } catch (e) {
        this.logger.error('failed to create temporary manifest', e);
      }
    }

    // If cargo was used, locate built binary and copy to outputPath
    if (usedCargo) {
      if (!builtPath || !existsSync(builtPath)) {
        // try debug target as fallback
        const debugPath =
          builtPath?.replace(join('release'), join('debug')) ?? null;
        if (debugPath && existsSync(debugPath)) {
          builtPath = debugPath;
        }
      }
      if (builtPath && existsSync(builtPath)) {
        try {
          copyFileSync(builtPath, outputPath);
        } catch (e) {
          this.logger.error('Failed to copy built binary to cache', e);
          return new KnownResult(0 as any, 'Failed to copy binary', {
            outputPath,
            hash,
          });
        }
        return new UnknownResult({ outputPath, hash });
      }
      return new KnownResult(
        0 as any,
        'Cargo build succeeded but binary not found',
        { outputPath, hash },
      );
    }

    // Fallback: direct rustc invocation
    const rustcArgs = args.split(/\s+/).filter(Boolean);
    const cmd = [compiler, src.path, ...rustcArgs, '-o', outputPath];
    const result = await this._executeCompiler(cmd, ac);
    if (result instanceof KnownResult) {
      return new KnownResult(result.verdict, result.msg, { outputPath, hash });
    }
    return new UnknownResult({ outputPath, hash });
  }

  public async getRunCommand(target: string): Promise<string[]> {
    this.logger.trace('runCommand', { target });
    return [target];
  }
}
