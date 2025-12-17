import { container } from 'tsyringe';
import type { ExtensionContext } from 'vscode';
import RunSingleTc from '@/application/usecases/RunSingleTc';
import CompilerAdapter from '@/infrastructure/compiler/compilerAdapter';
import ProblemRepository from '@/infrastructure/problems/problemRepository';
import RunnerAdapter from '@/infrastructure/runner/runnerAdapter';
import { TOKENS } from './tokens';

// Composition Root: register adapters and use cases here.
// Phase 0: minimal wiring to ensure DI container is initialized without changing behavior.

export function setupContainer(context: ExtensionContext): void {
  // Register VS Code extension context for adapters that may need it later.
  container.registerInstance(TOKENS.ExtensionContext, context);

  // Ports / adapters
  container.registerSingleton(TOKENS.Runner, RunnerAdapter);
  container.registerSingleton(TOKENS.ProblemRepository, ProblemRepository);
  container.registerSingleton(TOKENS.Compiler, CompilerAdapter);

  // Register use cases (currently only a thin wrapper to existing TcRunner logic)
  container.register(TOKENS.RunSingleTc, { useClass: RunSingleTc });

  // Note: Adapters and use cases will be registered incrementally in later phases
  // to avoid changing runtime behavior right now.
}
