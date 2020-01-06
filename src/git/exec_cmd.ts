import { collect } from 'bluestream';
import { spawn, SpawnOptionsWithoutStdio } from 'child_process';
import fwd from 'spawn-error-forwarder';
import { Readable } from 'stream';

export function execute(command: string, args: ReadonlyArray<string>, options: SpawnOptionsWithoutStdio): Readable {
  return fwd(spawn(command, args, options), function (code: string, stderr: string) {
    throw new Error(`Execution of command [${command}] with args [${args.join(" ")}] failed with exit code [${code}] and the following error [${stderr}]`);
  }).stdout;
}

export async function executeToString(command: string, args: ReadonlyArray<string>, options: SpawnOptionsWithoutStdio): Promise<string> {
  const res = await collect(execute(command, args, options));
  if (res == null) {
    return '';
  }
  return res.toString();
}
