import { convertToDecimal, type ProcessArgs, type TxAll } from "../utils.ts";

export function identify(tx: TxAll): boolean {
  return tx.transfers.length === 1;
}

export function process({ ethTx, beanTx, args }: ProcessArgs) {
  const transfer = ethTx.transfers[0];
  if (!transfer.tokenInfo?.trusted || transfer.value === "0") return;

  if (transfer.to === args.address) {
    beanTx.args.narration = `received ${transfer.tokenInfo.symbol}`;
  } else {
    beanTx.args.narration = `sent ${transfer.tokenInfo.symbol}`;
  }

  const amount = convertToDecimal(
    transfer.value!,
    transfer.tokenInfo.decimals!,
  );

  beanTx.args.postings = [
    {
      account: transfer.from,
      amount: `-${amount}`,
      currency: transfer.tokenInfo.symbol.toUpperCase(),
    },
    {
      account: transfer.to,
      amount: `${amount}`,
      currency: transfer.tokenInfo.symbol.toUpperCase(),
    },
  ];
}
