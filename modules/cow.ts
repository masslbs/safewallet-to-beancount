import { OrderBookApi, OrderStatus } from "@cowprotocol/cow-sdk";
import { createPublicClient, erc20Abi, http } from "@wevm/viem";
import { mainnet } from "@wevm/viem/chains";
import {
  convertToDecimal,
  isSafeMultiSigTx,
  type ProcessArgs,
  type TxAll,
} from "../utils.ts";

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// https://repo.sourcify.dev/1/0x9008D19f58AAbD9eD0D60971565AA8510560ab41
const GPv2Settlement = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41";

function getTradingPairInfo(a: string, b: string) {
  return publicClient.multicall({
    contracts: [
      {
        address: a,
        abi: erc20Abi,
        functionName: "symbol",
      },
      {
        address: a,
        abi: erc20Abi,
        functionName: "decimals",
      },
      {
        address: b,
        abi: erc20Abi,
        functionName: "symbol",
      },
      {
        address: b,
        abi: erc20Abi,
        functionName: "decimals",
      },
    ],
  });
}

const orderBookApi = new OrderBookApi({ chainId: 1 });

export function identify(tx: TxAll): boolean {
  return tx.to === GPv2Settlement;
}

export async function process(
  { ethTx, beanTx }: ProcessArgs,
) {
  if (
    isSafeMultiSigTx(ethTx) && ethTx.dataDecoded?.method === "setPreSignature"
  ) {
    const orderId = ethTx.dataDecoded?.parameters[0].value;
    beanTx.args.metadata!.orderLink =
      `https://explorer.cow.fi/orders/${orderId}`;
    const order = await orderBookApi.getOrder(orderId);
    if (order.status !== OrderStatus.FULFILLED) {
      return;
    }
    const pair = await getTradingPairInfo(order.sellToken, order.buyToken);
    const block = await orderBookApi.getTrades({ orderUid: orderId }).then(
      (trades) => {
        return publicClient.getBlock({
          blockNumber: BigInt(trades[0].blockNumber),
        });
      },
    );
    const [
      sellTokenSymbol,
      sellTokenDecimals,
      buyTokenSymbol,
      buyTokenDecimals,
    ] = pair;

    const fee = order.executedFee === "0"
      ? order.executedFeeAmount
      : order.executedFee;

    const feeAmount = convertToDecimal(
      fee!,
      sellTokenDecimals.result!,
    );

    const sellAmount = convertToDecimal(
      (BigInt(order.executedSellAmount) - BigInt(order.executedFee!))
        .toString(),
      sellTokenDecimals.result!,
    );
    const buyAmount = convertToDecimal(
      order.executedBuyAmount,
      buyTokenDecimals.result!,
    );

    const postings = [
      {
        account: order.owner,
        amount: `-${sellAmount}`,
        currency: sellTokenSymbol.result!,
        totalCost: buyAmount,
        totalCostCurrency: buyTokenSymbol.result!,
      },
      {
        account: order.receiver!,
        amount: buyAmount,
        currency: buyTokenSymbol.result!,
      },
      {
        account: order.owner,
        amount: `-${feeAmount}`,
        currency: sellTokenSymbol.result!,
      },
      {
        account: "Expenses:Fees:Crypto:Cow",
        amount: feeAmount,
        currency: sellTokenSymbol.result!,
      },
    ];

    beanTx.args.date = new Date(Number(block.timestamp) * 1000);
    beanTx.args.payee = "cowswap";
    beanTx.args.narration =
      `Swapped ${sellAmount} ${sellTokenSymbol.result} for ${buyAmount} ${buyTokenSymbol.result}`;
    beanTx.args.postings = postings;
  }
}
