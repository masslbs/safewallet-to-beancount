import type { TransferResponse } from "@safe-global/api-kit";
import { convertToDecimal, type ProcessArgs, type TxAll } from "../utils.ts";

export function identify(tx: TxAll): boolean {
  return tx.transfers.length === 2;
}

export function process({ ethTx, beanTx, args }: ProcessArgs) {
  let transfer1: TransferResponse;
  let transfer2: TransferResponse;

  if (ethTx.transfers[0].to === args.address) {
    transfer1 = ethTx.transfers[1];
    transfer2 = ethTx.transfers[0];
  } else {
    transfer1 = ethTx.transfers[0];
    transfer2 = ethTx.transfers[1];
  }

  if (!transfer1.tokenInfo?.trusted || !transfer2.tokenInfo?.trusted) return;

  const amount1 = convertToDecimal(
    transfer1.value!,
    transfer1.tokenInfo!.decimals!,
  );

  const amount2 = convertToDecimal(
    transfer2.value!,
    transfer2.tokenInfo!.decimals!,
  );

  beanTx.args.narration = `${beanTx.args.narration} swapped ${
    transfer1.tokenInfo!.symbol.toUpperCase()
  } to ${transfer2.tokenInfo!.symbol.toUpperCase()}`;

  beanTx.args.postings = [
    {
      account: transfer1.from,
      amount: `-${amount1}`,
      currency: transfer1.tokenInfo!.symbol.toUpperCase(),
      totalCost: amount2.toString(),
      totalCostCurrency: transfer2.tokenInfo!.symbol.toUpperCase(),
    },
    {
      account: transfer2.to,
      amount: `${amount2}`,
      currency: transfer2.tokenInfo!.symbol.toUpperCase(),
    },
  ];
  return Promise.resolve(beanTx);
}
