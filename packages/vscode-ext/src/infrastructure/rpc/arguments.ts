/** Decode the legacy command-line text without invoking a shell. New configuration uses arrays. */
export function splitArguments(input: string): string[] {
  const result: string[] = [];
  let current = '';
  let quote = '';
  let started = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];
    if (
      char === '\\' &&
      quote !== "'" &&
      next !== undefined &&
      (next === '"' || next === '\\' || (!quote && (next === "'" || /\s/.test(next))))
    ) {
      current += next;
      started = true;
      i++;
    } else if (quote) {
      if (char === quote) quote = '';
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) {
        result.push(current);
        current = '';
        started = false;
      }
    } else {
      current += char;
      started = true;
    }
  }
  if (quote) throw new Error('Unclosed quote in compiler arguments');
  if (started) result.push(current);
  return result;
}

export const quoteArgument = (value: string): string =>
  value === '' || /[\s"'\\]/.test(value) ? `'${value.replaceAll("'", "'\\''")}'` : value;

/** Import only absent values so migration never overwrites a user's Rust configuration. */
export function missingValues(
  existing: Record<string, unknown>,
  imported: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(imported)) {
    if (!(key in existing)) patch[key] = value;
    else if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing[key] &&
      typeof existing[key] === 'object' &&
      !Array.isArray(existing[key])
    ) {
      const nested = missingValues(
        existing[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
      if (Object.keys(nested).length) patch[key] = nested;
    }
  }
  return patch;
}

/** Preserve syntax-check arguments without adding them to interpreter runtime arguments. */
export function completeLegacyToolchains(
  patch: Record<string, unknown>,
  effective: Record<string, { compiler?: string; interpreter?: string }>,
): Record<string, unknown> {
  if (!patch.languages || typeof patch.languages !== 'object' || Array.isArray(patch.languages))
    return patch;
  const languages = { ...(patch.languages as Record<string, unknown>) };
  for (const language of ['python', 'javascript']) {
    const settings = languages[language];
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) continue;
    const values = settings as Record<string, unknown>;
    if (
      !Array.isArray(values.compiler_args) ||
      values.compiler_args.length === 0 ||
      typeof values.compiler === 'string' ||
      effective[language]?.compiler
    )
      continue;
    const compiler =
      typeof values.interpreter === 'string'
        ? values.interpreter
        : effective[language]?.interpreter;
    if (compiler) languages[language] = { ...values, compiler };
  }
  return { ...patch, languages };
}
