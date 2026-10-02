import { inject, injectable } from 'tsyringe';
import { KernelConfiguration } from '@/infrastructure/rpc/configuration';
import { AbstractLanguageStrategy } from './abstractLanguageStrategy';

@injectable()
export class LangPython extends AbstractLanguageStrategy {
  public override readonly name = 'Python';
  public override readonly extensions = ['py'];
  public constructor(@inject(KernelConfiguration) configuration: KernelConfiguration) {
    super(configuration);
  }
}
