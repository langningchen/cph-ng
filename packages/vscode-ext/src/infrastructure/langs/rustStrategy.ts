import { inject, injectable } from 'tsyringe';
import { KernelConfiguration } from '@/infrastructure/rpc/configuration';
import { AbstractLanguageStrategy } from './abstractLanguageStrategy';

@injectable()
export class LangRust extends AbstractLanguageStrategy {
  public override readonly name = 'Rust';
  public override readonly extensions = ['rs'];
  public constructor(@inject(KernelConfiguration) configuration: KernelConfiguration) {
    super(configuration);
  }
}
