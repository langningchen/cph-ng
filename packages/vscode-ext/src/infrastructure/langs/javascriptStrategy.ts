import { inject, injectable } from 'tsyringe';
import { KernelConfiguration } from '@/infrastructure/rpc/configuration';
import { AbstractLanguageStrategy } from './abstractLanguageStrategy';

@injectable()
export class LangJavascript extends AbstractLanguageStrategy {
  public override readonly name = 'JavaScript';
  public override readonly extensions = ['js', 'mjs', 'cjs'];
  public constructor(@inject(KernelConfiguration) configuration: KernelConfiguration) {
    super(configuration);
  }
}
