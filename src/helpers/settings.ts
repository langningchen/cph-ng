import { TOKENS } from "@/composition/tokens";
import { container } from "tsyringe";

export const settingsObject = new Proxy({} as any, {
  get: (_target, prop, receiver) => {
    const realSettings = container.resolve(TOKENS.Settings);
    return Reflect.get(realSettings, prop, receiver);
  },
  set: (_target, prop, value, receiver) => {
    const realSettings = container.resolve(TOKENS.Settings);
    return Reflect.set(realSettings, prop, value, receiver);
  }
});

/**
 * @deprecated Use new DI ISettings
 */
export default settingsObject;
