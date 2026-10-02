import type { UpdateSettingsMsg } from '@cph-ng/core';
import { inject, injectable } from 'tsyringe';
import type { IMsgHandle } from '@/application/useCases/webview/msgHandle';
import { KernelConfiguration } from '@/infrastructure/rpc/configuration';
@injectable()
export class UpdateSettings implements IMsgHandle<UpdateSettingsMsg> {
  public constructor(
    @inject(KernelConfiguration) private readonly configuration: KernelConfiguration,
  ) {}
  public async exec(msg: UpdateSettingsMsg): Promise<void> {
    await this.configuration.updateLanguage(msg.language, msg.payload);
  }
}
