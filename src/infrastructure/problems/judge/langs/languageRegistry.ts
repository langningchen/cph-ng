import { extname } from 'node:path';
import { inject, injectAll, injectable } from 'tsyringe';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ILanguageStrategy } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';

@injectable()
export class LanguageRegistry implements ILanguageRegistry {
  constructor(
    @inject(TOKENS.logger) private readonly logger: ILogger,
    @injectAll(TOKENS.languageStrategy) private readonly langs: ILanguageStrategy[],
  ) {
    this.logger = logger.withScope('LanguageRegistry');
  }

  getLang(filePath: string): ILanguageStrategy | undefined {
    const ext = extname(filePath).toLowerCase().slice(1);
    const lang = this.langs.find((lang) => lang.extensions.includes(ext));
    if (lang) this.logger.debug('Detected language for', { filePath, lang: lang.name });
    else this.logger.debug('No language detected for', { filePath });
    return lang;
  }
}
