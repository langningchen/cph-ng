// This tempory code is used for backword compatibility

import { TOKENS } from "@/composition/tokens";
import { container } from "tsyringe";

export const settingsObject = container.resolve(TOKENS.Settings);
export default settingsObject;
