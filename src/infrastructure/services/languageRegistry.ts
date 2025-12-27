import { extname } from 'node:path';
import { container, inject, injectable } from 'tsyringe';
import type { ILanguageStrategy } from '@/application/ports/problems/ILanguageStrategy';
import type { ILanguageRegistry } from '@/application/ports/services/ILanguageRegistry';
import type { ILogger } from '@/application/ports/vscode/ILogger';
import { TOKENS } from '@/composition/tokens';
import { LangC } from '@/core/langs/c';
import { LangJava } from '@/core/langs/java';
import { LangJavascript } from '@/core/langs/javascript';
import type { Lang } from '@/core/langs/lang';
import { LangPython } from '@/core/langs/python';
import { LangCpp } from '@/infrastructure/problems/langs/cpp';

@injectable()
export class LanguageRegistry implements ILanguageRegistry {
  private readonly langs: (Lang | ILanguageStrategy)[];
  private readonly logger: ILogger;

  constructor(@inject(TOKENS.Logger) logger: ILogger) {
    this.logger = logger.withScope('LanguageRegistry');
    this.langs = [
      container.resolve(LangCpp),
      new LangC(),
      new LangJava(),
      new LangPython(),
      new LangJavascript(),
    ];
  }

  getLang(filePath: string): Lang | undefined {
    const ext = extname(filePath).toLowerCase().slice(1);
    const lang = this.langs.find((lang) => lang.extensions.includes(ext));
    lang
      ? this.logger.debug('Detected language for', {
          filePath,
          lang: lang.name,
        })
      : this.logger.debug('No language detected for', { filePath });
    return lang as Lang;
  }
}
