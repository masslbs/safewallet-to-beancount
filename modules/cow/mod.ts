import type {
  EthereumTxWithTransfersResponse,
  SafeModuleTransactionWithTransfersResponse,
  SafeMultisigTransactionWithTransfersResponse,
} from "@safe-global/api-kit";
import { OrderBookApi } from "@cowprotocol/cow-sdk";
import { createPublicClient, erc20Abi, http } from "@wevm/viem";
import { mainnet } from "@wevm/viem/chains";
import { Transaction } from "../../beancount.ts";

export const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// https://repo.sourcify.dev/1/0x9008D19f58AAbD9eD0D60971565AA8510560ab41
const GPv2Settlement = "0x9008D19f58AAbD9eD0D60971565AA8510560ab41";
type TxAll =
  | SafeModuleTransactionWithTransfersResponse
  | SafeMultisigTransactionWithTransfersResponse
  | EthereumTxWithTransfersResponse;

function isSafeMultiSigTx(
  tx: TxAll,
): tx is SafeMultisigTransactionWithTransfersResponse {
  return tx.txType === "MULTISIG_TRANSACTION";
}

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

function convertToDecimal(value: string, decimals: number): string {
  const arr = value.split("");
  arr.splice(-decimals, 0, ".");
  return arr.join("");
}

const orderBookApi = new OrderBookApi({ chainId: 1 });

export class Cow {
  constructor(public name: string) {}

  identify(tx: TxAll): boolean {
    return tx.to === GPv2Settlement;
  }

  async process(tx: TxAll) {
    if (isSafeMultiSigTx(tx) && tx.dataDecoded?.method === "setPreSignature") {
      const orderId = tx.dataDecoded?.parameters[0].value;
      const [block, orderInfo] = await Promise.all([
        orderBookApi.getTrades({ orderUid: orderId }).then((trades) => {
          return publicClient.getBlock({
            blockNumber: BigInt(trades[0].blockNumber),
          });
        }),
        orderBookApi.getOrder(orderId).then(async (order) => {
          return {
            order,
            pair: await getTradingPairInfo(order.sellToken, order.buyToken),
          };
        }),
      ]);
      const [
        sellTokenSymbol,
        sellTokenDecimals,
        buyTokenSymbol,
        buyTokenDecimals,
      ] = orderInfo.pair;
      const order = orderInfo.order;

      const feeAmount = convertToDecimal(
        order.executedFee!,
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
          amount: feeAmount,
          currency: sellTokenSymbol.result!,
        },
        {
          account: "Crypto:Fees:Cow",
          amount: `-${feeAmount}`,
          currency: sellTokenSymbol.result!,
        },
      ];

      return new Transaction({
        // should get date from block timestamop
        date: new Date(Number(block.timestamp) * 1000),
        flag: "*",
        payee: "cowswap",
        narration:
          `Swapped ${sellAmount} ${sellTokenSymbol.result} for ${buyAmount} ${buyTokenSymbol.result}`,
        postings,
      });
    }
  }
}
