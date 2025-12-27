import { TOKENS } from "@/composition/tokens";
import { container } from "tsyringe";

export const settingsObject = container.resolve(TOKENS.Settings);
/**
 * @deprecated Use new DI ISettings
 */
export default settingsObject;
