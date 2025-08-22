import type { ProcessArgs, TxAll } from "../utils.ts";

export function identify(_tx: TxAll): boolean {
  return true;
}

export function process({ ethTx }: ProcessArgs) {
  return Promise.resolve(ethTx);
}
