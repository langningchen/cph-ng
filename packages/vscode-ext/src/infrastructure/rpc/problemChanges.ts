// biome-ignore-all lint/style/useNamingConvention: Problem fields follow the Rust wire schema.
import { RpcRemoteError } from './client';
import type { ProblemDto } from './problemService';
import { rpcErrorCode } from './protocol';

export const problemFields = [
  'name',
  'url',
  'time_limit_ms',
  'memory_limit_mb',
  'checker',
  'interactor',
  'generator',
  'brute_force',
] as const;
type Case = ProblemDto['testcases'][number];
export interface ProblemChanges {
  details: Record<string, unknown>;
  deleted: string[];
  added: Case[];
  updated: Array<{ id: string; stdin?: string; answer?: string }>;
  order?: string[];
}
const sameOrder = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);
const sameCase = (a: Case, b: Case) => a.stdin === b.stdin && a.answer === b.answer;
const conflict = (what: string): never => {
  throw new RpcRemoteError(
    rpcErrorCode.conflict,
    `${what} changed in another window. Reopen the problem before saving this change.`,
  );
};

export function sameProblemData(a: ProblemDto, b: ProblemDto): boolean {
  return (
    problemFields.every((key) => a[key] === b[key]) &&
    a.testcases.length === b.testcases.length &&
    a.testcases.every(
      (testcase, i) => testcase.id === b.testcases[i].id && sameCase(testcase, b.testcases[i]),
    )
  );
}

/** Three-way comparison: base is what this window saw, local is its draft, remote is current Rust data. */
export function problemChanges(
  base: ProblemDto,
  local: ProblemDto,
  remote: ProblemDto,
): ProblemChanges {
  const change: ProblemChanges = { details: {}, deleted: [], added: [], updated: [] };
  for (const key of problemFields) {
    if (local[key] === base[key]) continue;
    if (remote[key] !== base[key] && remote[key] !== local[key]) conflict(`Problem ${key}`);
    if (remote[key] !== local[key]) change.details[key] = local[key];
  }
  const old = new Map(base.testcases.map((testcase) => [testcase.id, testcase]));
  const wanted = new Map(local.testcases.map((testcase) => [testcase.id, testcase]));
  const current = new Map(remote.testcases.map((testcase) => [testcase.id, testcase]));
  for (const previous of base.testcases) {
    if (wanted.has(previous.id)) continue;
    const existing = current.get(previous.id);
    if (!existing) continue;
    if (!sameCase(previous, existing)) conflict(`Testcase ${previous.id}`);
    change.deleted.push(previous.id);
  }
  for (const testcase of local.testcases) {
    const previous = old.get(testcase.id);
    const existing = current.get(testcase.id);
    if (!previous) {
      if (!existing) change.added.push(testcase);
      else if (!sameCase(testcase, existing)) conflict(`Testcase ${testcase.id}`);
      continue;
    }
    if (sameCase(previous, testcase)) continue;
    if (!existing) return conflict(`Testcase ${testcase.id}`);
    const update: { id: string; stdin?: string; answer?: string } = { id: testcase.id };
    for (const field of ['stdin', 'answer'] as const) {
      if (testcase[field] === previous[field]) continue;
      if (existing[field] !== previous[field] && existing[field] !== testcase[field])
        conflict(`Testcase ${testcase.id} ${field}`);
      if (existing[field] !== testcase[field]) update[field] = testcase[field];
    }
    if ('stdin' in update || 'answer' in update) change.updated.push(update);
  }
  const deleted = new Set(change.deleted);
  const remoteOrder = remote.testcases
    .map((testcase) => testcase.id)
    .filter((id) => !deleted.has(id));
  const added = new Set(change.added.map((testcase) => testcase.id));
  const afterWrites = [...remoteOrder, ...added];
  const available = new Set(afterWrites);
  const inserted = new Set(
    local.testcases
      .map((testcase) => testcase.id)
      .filter((id) => !old.has(id) && available.has(id)),
  );
  const common = new Set(
    base.testcases
      .map((testcase) => testcase.id)
      .filter((id) => wanted.has(id) && available.has(id)),
  );
  const baseCommon = base.testcases.map((testcase) => testcase.id).filter((id) => common.has(id));
  const localCommon = local.testcases.map((testcase) => testcase.id).filter((id) => common.has(id));
  const remoteCommon = remoteOrder.filter((id) => common.has(id));
  let order = [...afterWrites];
  if (!sameOrder(baseCommon, localCommon)) {
    if (!sameOrder(baseCommon, remoteCommon) && !sameOrder(localCommon, remoteCommon))
      conflict('Testcase order');
    // Reorder the IDs known to this window, keeping remote-only additions in their slots.
    const known = local.testcases.map((testcase) => testcase.id).filter((id) => available.has(id));
    const slots = new Set(known);
    let index = 0;
    order = order.map((id) => (slots.has(id) ? known[index++] : id));
  } else if (inserted.size) {
    // Inserts do not undo a reorder made by another window. Append when no later local anchor exists.
    order = remoteOrder.filter((id) => !inserted.has(id));
    const desiredOrder = local.testcases.map((testcase) => testcase.id);
    for (let i = 0; i < desiredOrder.length; i++) {
      const id = desiredOrder[i];
      if (!inserted.has(id)) continue;
      const next = desiredOrder.slice(i + 1).find((candidate) => order.includes(candidate));
      order.splice(next === undefined ? order.length : order.indexOf(next), 0, id);
    }
  }
  if (!sameOrder(order, afterWrites)) change.order = order;
  return change;
}
