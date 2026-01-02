import { extname } from 'node:path';
import { container, inject, injectable } from 'tsyringe';
import type { ILanguageRegistry } from '@/application/ports/problems/judge/langs/ILanguageRegistry';
import type { ILanguageStrategy } from '@/application/ports/problems/judge/langs/ILanguageStrategy';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import { LangC } from '@/infrastructure/problems/judge/langs/c';
import { LangCpp } from '@/infrastructure/problems/judge/langs/cpp';
import { LangJava } from '@/infrastructure/problems/judge/langs/java';
import { LangJavascript } from '@/infrastructure/problems/judge/langs/javascript';
import { LangPython } from '@/infrastructure/problems/judge/langs/python';

@injectable()
export class LanguageRegistry implements ILanguageRegistry {
  private readonly langs: ILanguageStrategy[];
  private readonly logger: ILogger;

  constructor(@inject(TOKENS.Logger) logger: ILogger) {
    this.logger = logger.withScope('LanguageRegistry');
    this.langs = [
      container.resolve(LangC),
      container.resolve(LangCpp),
      container.resolve(LangJava),
      container.resolve(LangJavascript),
      container.resolve(LangPython),
    ];
  }

  getLang(filePath: string): ILanguageStrategy | undefined {
    const ext = extname(filePath).toLowerCase().slice(1);
    const lang = this.langs.find((lang) => lang.extensions.includes(ext));
    if (lang) this.logger.debug('Detected language for', { filePath, lang: lang.name });
    else this.logger.debug('No language detected for', { filePath });
    return lang;
  }
}
