import type {
  EthereumTxWithTransfersResponse,
  SafeModuleTransactionWithTransfersResponse,
  SafeMultisigTransactionWithTransfersResponse,
} from "@safe-global/api-kit";
import type { Transaction } from "./beancount.ts";

export interface ICopyFilesArguments {
  address: string;
  settings: string | undefined;
  noOpen: boolean;
}

export type TxAll =
  | SafeModuleTransactionWithTransfersResponse
  | SafeMultisigTransactionWithTransfersResponse
  | EthereumTxWithTransfersResponse;

export type ProcessArgs = {
  ethTx: TxAll;
  beanTx: Transaction;
  args: ICopyFilesArguments;
};

export function isSafeMultiSigTx(
  tx: TxAll,
): tx is SafeMultisigTransactionWithTransfersResponse {
  return tx.txType === "MULTISIG_TRANSACTION";
}

export function convertToDecimal(value: string, decimals: number): string {
  if (decimals === 0) {
    return value;
  }

  // If we need more decimal places than we have digits, pad with leading zeros
  let paddedValue = value;
  if (value.length < decimals) {
    paddedValue = "0".repeat(decimals - value.length) + value;
  }

  const arr = paddedValue.split("");
  const insertIndex = arr.length - decimals;
  arr.splice(insertIndex, 0, ".");

  let result = arr.join("");

  // Handle case where decimal point is at the beginning
  if (result.startsWith(".")) {
    result = "0" + result;
  }

  // Remove trailing zeros after decimal point
  if (result.includes(".")) {
    result = result.replace(/\.?0+$/, "");
    // If we removed everything after decimal, remove the decimal too
    if (result.endsWith(".")) {
      result = result.slice(0, -1);
    }
  }

  // Handle all-zero case (convert "000" to "0")
  if (/^0+$/.test(result)) {
    result = "0";
  }

  return result;
}
