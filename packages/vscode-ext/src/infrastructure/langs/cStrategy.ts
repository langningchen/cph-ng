import { inject, injectable } from 'tsyringe';
import { KernelConfiguration } from '@/infrastructure/rpc/configuration';
import { AbstractLanguageStrategy } from './abstractLanguageStrategy';

@injectable()
export class LangC extends AbstractLanguageStrategy {
  public override readonly name = 'C';
  public override readonly extensions = ['c'];
  public constructor(@inject(KernelConfiguration) configuration: KernelConfiguration) {
    super(configuration);
  }
}
