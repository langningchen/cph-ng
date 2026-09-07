import { inject, injectable } from 'tsyringe';
import { KernelConfiguration } from '@/infrastructure/rpc/configuration';
import { AbstractLanguageStrategy } from './abstractLanguageStrategy';

@injectable()
export class LangCpp extends AbstractLanguageStrategy {
  public override readonly name = 'C++';
  public override readonly extensions = ['cpp', 'cc', 'cxx', 'c++'];
  public constructor(@inject(KernelConfiguration) configuration: KernelConfiguration) {
    super(configuration);
  }
}
