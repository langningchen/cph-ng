import { loggerMock } from '@t/infrastructure/vscode/loggerMock';
import { settingsMock } from '@t/infrastructure/vscode/settingsMock';
import { translatorMock } from '@t/infrastructure/vscode/translatorMock';
import { mock } from '@t/mock';
import { container } from 'tsyringe';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MockProxy } from 'vitest-mock-extended';
import type { IFileSystem } from '@/application/ports/node/IFileSystem';
import type { IPathResolver } from '@/application/ports/services/IPathResolver';
import type { IUi } from '@/application/ports/vscode/IUi';
import { TOKENS } from '@/composition/tokens';
import { Problem } from '@/domain/entities/problem';
import { TemplateRenderer } from '@/infrastructure/services/templateRenderer';

describe('TemplateRenderer', () => {
  let renderer: TemplateRenderer;
  let fsMock: MockProxy<IFileSystem>;
  let pathResolverMock: MockProxy<IPathResolver>;
  let uiMock: MockProxy<IUi>;

  beforeEach(() => {
    fsMock = mock<IFileSystem>();
    pathResolverMock = mock<IPathResolver>();
    uiMock = mock<IUi>();
    uiMock.alert.mockResolvedValue(undefined);

    container.registerInstance(TOKENS.fileSystem, fsMock);
    container.registerInstance(TOKENS.logger, loggerMock);
    container.registerInstance(TOKENS.pathResolver, pathResolverMock);
    container.registerInstance(TOKENS.settings, settingsMock);
    container.registerInstance(TOKENS.translator, translatorMock);
    container.registerInstance(TOKENS.ui, uiMock);

    renderer = container.resolve(TemplateRenderer);
  });

  const makeProblem = () => {
    const p = new Problem('A + B', '/src/main.cpp');
    p.url = 'https://codeforces.com/contest/1/problem/A';
    p.overrides = { timeLimitMs: 2000, memoryLimitMb: 256 };
    return p;
  };

  it('should return empty string when no template file configured', async () => {
    settingsMock.problem.templateFile = '';
    const result = await renderer.render(makeProblem());
    expect(result).toBe('');
  });

  it('should return empty string when path resolution fails', async () => {
    settingsMock.problem.templateFile = '/template.cpp';
    // biome-ignore lint/suspicious/noExplicitAny: testing invalid return type
    pathResolverMock.renderPathWithFile.mockReturnValue(null as any);

    const result = await renderer.render(makeProblem());
    expect(result).toBe('');
  });

  it('should render template with variable substitution', async () => {
    settingsMock.problem.templateFile = '/template.cpp';
    pathResolverMock.renderPathWithFile.mockReturnValue('/resolved/template.cpp');
    fsMock.readFile.mockResolvedValue(
      // biome-ignore lint/suspicious/noTemplateCurlyInString: template content
      '// Title: ${title}\n// Time: ${timeLimit}ms\n// Memory: ${memoryLimit}MB\n// URL: ${url}\n',
    );

    const result = await renderer.render(makeProblem());

    expect(result).toBe(
      '// Title: A + B\n// Time: 2000ms\n// Memory: 256MB\n// URL: https://codeforces.com/contest/1/problem/A\n',
    );
  });

  it('should use defaults when overrides are not set', async () => {
    settingsMock.problem.templateFile = '/template.cpp';
    pathResolverMock.renderPathWithFile.mockReturnValue('/resolved/template.cpp');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: template content
    fsMock.readFile.mockResolvedValue('${timeLimit} ${memoryLimit}');

    const p = new Problem('test', '/src/main.cpp');
    const result = await renderer.render(p);

    expect(result).toBe('0 0');
  });

  it('should return empty string and show alert when reading template fails', async () => {
    settingsMock.problem.templateFile = '/template.cpp';
    pathResolverMock.renderPathWithFile.mockReturnValue('/resolved/template.cpp');
    fsMock.readFile.mockRejectedValue(new Error('ENOENT'));

    const result = await renderer.render(makeProblem());

    expect(result).toBe('');
    expect(uiMock.alert).toHaveBeenCalledWith('warn', expect.stringContaining('ENOENT'));
  });
});
