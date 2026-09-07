import { afterEach, describe, expect, it } from 'vitest';
import { KernelRpcClient, RpcRemoteError } from '@/infrastructure/rpc/client';
import { rpcErrorCode, rpcEventMethod, rpcMethod } from '@/infrastructure/rpc/protocol';

const clients: KernelRpcClient[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.dispose()));
});
const program = `
const readline = require('node:readline');
const rpcMethod = ${JSON.stringify(rpcMethod)};
const rpcErrorCode = ${JSON.stringify(rpcErrorCode)};
const rpcEventMethod = ${JSON.stringify(rpcEventMethod)};
const send = (value) => process.stdout.write(JSON.stringify({jsonrpc:'2.0', ...value})+'\\n');
send({method:rpcEventMethod.serverReady,params:{protocol_version:'1.0'}});
let canceled = false;
readline.createInterface({input:process.stdin}).on('line', line => {
 const request=JSON.parse(line); const {id,method}=request;
 const ok=result=>send({id,result});
 if(method===rpcMethod.systemHello) return ok({protocol_version:'1.0'});
 if(method===rpcMethod.systemShutdown) {ok({accepted:true}); return process.exit(0);}
 if(request.params.remoteError) return send({id,error:request.params.remoteError});
 if(method===rpcMethod.systemPing) return setTimeout(()=>ok({ok:true}), request.params.delay || 0);
 if(method===rpcMethod.judgeRun) { send({method:rpcEventMethod.taskFinished,params:{task_id:'task',sequence:2,state:'succeeded',result:{verdict:'accepted'}}}); return ok({task_id:'task',state:'queued'}); }
 if(method===rpcMethod.stressStart) return ok({task_id:'stress',state:'queued'});
 if(method===rpcMethod.taskCancel) {canceled=true; return ok({task_id:'stress',state:'running'});}
 if(method===rpcMethod.taskEventsSince) return ok(request.params.task_id==='task' ? [{task_id:'task',sequence:2,state:'succeeded',result:{verdict:'accepted'}}] : []);
 if(method===rpcMethod.taskGet && request.params.task_id==='task') return ok({task_id:'task',state:'succeeded',result:{verdict:'accepted'}});
 if(method===rpcMethod.taskGet) return ok({task_id:'stress',state:canceled?'canceled':'running',error:canceled?{code:rpcErrorCode.taskState,message:'Task canceled'}:undefined});
 send({id,error:{code:rpcErrorCode.methodNotFound,message:'Method not found'}});
});`;
function create() {
  const client = new KernelRpcClient({
    command: process.execPath,
    args: ['-e', program],
    timeoutMs: 2000,
  });
  clients.push(client);
  return client;
}
describe('kernel RPC client', () => {
  it('correlates out-of-order responses and maps structured errors', async () => {
    const client = create();
    const slow = client.request(rpcMethod.systemPing, { delay: 50 });
    const fast = client.request(rpcMethod.systemPing);
    expect(await fast).toEqual({ ok: true });
    expect(await slow).toEqual({ ok: true });
    await expect(client.request(rpcMethod.systemCapabilities)).rejects.toMatchObject({
      code: rpcErrorCode.methodNotFound,
    });
  });
  it('preserves unknown remote error codes and structured details', async () => {
    const client = create();
    const remoteError = {
      code: -32123,
      message: 'Future kernel error',
      data: { retryAfterMs: 50 },
    };
    await expect(client.request(rpcMethod.systemPing, { remoteError })).rejects.toMatchObject(
      remoteError,
    );
  });
  it('recovers a final event delivered before the task response', async () => {
    const client = create();
    const task = await client.runTask(rpcMethod.judgeRun, {});
    expect(task.state).toBe('succeeded');
    expect(task.result?.verdict).toBe('accepted');
  });
  it('propagates AbortSignal to the server and awaits durable cancellation', async () => {
    const client = create();
    const ac = new AbortController();
    const task = client.runTask(rpcMethod.stressStart, {}, ac.signal);
    setTimeout(() => ac.abort(), 50);
    await expect(task).rejects.toBeInstanceOf(RpcRemoteError);
  });
  it('rejects oversized frames without accumulating an unbounded buffer', async () => {
    const client = new KernelRpcClient({
      command: process.execPath,
      args: ['-e', "process.stdout.write('x'.repeat(1000));setTimeout(()=>{},1000)"],
      maxMessageBytes: 128,
      timeoutMs: 1000,
    });
    clients.push(client);
    await expect(client.connect()).rejects.toThrow('exceeds limit');
  });
});
