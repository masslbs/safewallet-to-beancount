import { parse } from "ts-command-line-args";
import { formatEther } from "@wevm/viem";
import { readFile } from "node:fs/promises";
import SafeApiKit, {
  type AllTransactionsListResponse,
  type EthereumTxWithTransfersResponse,
  type SafeModuleTransactionWithTransfersResponse,
  type SafeMultisigTransactionWithTransfersResponse,
  type TransferResponse,
} from "@safe-global/api-kit";
import { assert } from "@std/assert";
import { type Postings, Transaction } from "./beancount.ts";

interface ICopyFilesArguments {
  address: string;
  labels?: string;
  help?: boolean;
}

const args = parse<ICopyFilesArguments>(
  {
    address: {
      type: String,
      alias: "a",
      description: "The address of the Safe Wallet",
    },
    labels: {
      type: String,
      alias: "l",
      optional: true,
      description: "A map between Ethereum addresses and Beancount accounts",
    },
    help: {
      type: Boolean,
      optional: true,
      alias: "h",
      description: "Prints this usage guide",
    },
  },
  {
    helpArg: "help",
    headerContentSections: [
      {
        header: "Safe Wallet to Beancount tool",
        content:
          "Convert your Safe Wallet Transaction to Beancount journal entries",
      },
    ],
    footerContentSections: [
      { header: "Footer", content: `Copyright: MassLabs` },
    ],
  },
);

type Label = {
  [key: string]: string;
};
let labels: Label = {};
const usedLabels: Set<string> = new Set();

// @ts-ignore: SafeApiKit seems to be not typed correctly
// https://arethetypeswrong.github.io/?p=%40safe-global%2Fapi-kit%404.0.0
const apiKit = new SafeApiKit({
  chainId: 1n, // set the correct chainId
  txServiceUrl: "https://safe-transaction-mainnet.safe.global/api",
});

// creates an open account statement if the account is not already open
function openAccount(account: string, date: Date) {
  if (!usedLabels.has(account)) {
    usedLabels.add(account);
    const dateStr = date.toISOString().split("T")[0];
    console.log(`${dateStr} open ${account}`);
  }
}

function getAccount(address: string, date: Date) {
  const labeled = labels[address];
  if (labeled) {
    openAccount(labeled, date);
    return labeled;
  } else {
    return address;
  }
}

async function main() {
  // read the labels if we have any
  if (args.labels) {
    try {
      const contents = await readFile(args.labels, { encoding: "utf8" });
      labels = JSON.parse(contents);
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(err.message);
      }
    }
  }
  let fetching = true;
  let offset = 0;
  const limit = 20;
  while (fetching) {
    const transactions: AllTransactionsListResponse = await apiKit
      .getAllTransactions(args.address, {
        trusted: false,
        ordering: "timestamp",
        limit,
        offset,
      });
    transactions.results.forEach(txToEntry);
    if (!transactions.next) {
      fetching = false;
    }
    offset += limit;
  }
}

function txToEntry(
  tx:
    | SafeModuleTransactionWithTransfersResponse
    | SafeMultisigTransactionWithTransfersResponse
    | EthereumTxWithTransfersResponse,
) {
  assert(tx.executionDate, "Execution date is required");
  const date = new Date(tx.executionDate);
  let title = "";

  // some dapp interaction
  if ("origin" in tx && tx.origin?.length > 2) {
    try {
      const origin = JSON.parse(tx.origin);
      title = `${origin.name} (${origin.url})`;
    } catch {
      title = tx.origin;
    }
  }
  if ("dataDecoded" in tx && tx.dataDecoded) {
    title = `${title} called ${tx.dataDecoded.method}`;
  }

  let postings: Postings[] = [];
  const metadata: Record<string, string> = {};

  // Handle different transaction hash property names based on transaction type
  if ("transactionHash" in tx && tx.transactionHash) {
    metadata.tx = tx.transactionHash;
  } else if ("txHash" in tx && tx.txHash) {
    metadata.tx = tx.txHash;
  }

  if (tx.txType === "MULTISIG_TRANSACTION") {
    metadata.nonce = tx.nonce?.toString();
  }

  // generally if there are two transfers, it's a swap
  if (tx.transfers.length === 2) {
    let transfer1: TransferResponse;
    let transfer2: TransferResponse;

    if (tx.transfers[0].to === args.address) {
      transfer1 = tx.transfers[1];
      transfer2 = tx.transfers[0];
    } else {
      transfer1 = tx.transfers[0];
      transfer2 = tx.transfers[1];
    }

    const amount1 = BigInt(transfer1.value!) /
      10n ** BigInt(transfer1.tokenInfo!.decimals!);
    const amount2 = BigInt(transfer2.value!) /
      10n ** BigInt(transfer2.tokenInfo!.decimals!);

    if (title === "") {
      title = `swapped ${transfer1.tokenInfo!.symbol.toUpperCase()} to ${
        transfer2.tokenInfo!.symbol.toUpperCase()
      }`;
    }

    postings = [
      {
        account: getAccount(transfer1.from, date),
        amount: `-${amount1}`,
        currency: transfer1.tokenInfo!.symbol.toUpperCase(),
        totalCost: `${amount2} ${transfer2.tokenInfo!.symbol.toUpperCase()}`,
      },
      {
        account: getAccount(transfer2.to, date),
        amount: `${amount2}`,
        currency: transfer2.tokenInfo!.symbol.toUpperCase(),
      },
    ];
  } else if (tx.transfers.length === 1) {
    // a simple transfer
    // if the token is not trusted, we don't want to track it
    const transfer = tx.transfers[0];
    if (!transfer.tokenInfo?.trusted) return;

    if (transfer.to === args.address) {
      title = `received ${transfer.tokenInfo.symbol}`;
    } else {
      title = `sent ${transfer.tokenInfo.symbol}`;
    }

    const amount = BigInt(transfer.value!) /
      10n ** BigInt(transfer.tokenInfo.decimals!);

    postings = [
      {
        account: getAccount(transfer.from, date),
        amount: `-${amount}`,
        currency: transfer.tokenInfo.symbol.toUpperCase(),
      },
      {
        account: getAccount(transfer.to, date),
        amount: `${amount}`,
        currency: transfer.tokenInfo.symbol.toUpperCase(),
      },
    ];
  } else if (tx.transfers.length > 2) {
    title += ` Cleanup`;

    for (const transfer of tx.transfers) {
      const amount = BigInt(transfer.value!) /
        10n ** BigInt(transfer.tokenInfo?.decimals!);

      postings.push({
        account: getAccount(transfer.from, date),
        amount: `-${amount}`,
        currency: transfer.tokenInfo?.symbol.toUpperCase() || "",
      });

      postings.push({
        account: getAccount(transfer.to, date),
        amount: `${amount}`,
        currency: transfer.tokenInfo?.symbol.toUpperCase() || "",
      });
    }
  }

  // Add fee postings for multisig transactions
  if (tx.txType === "MULTISIG_TRANSACTION") {
    assert(tx.fee, "Fee is not defined");
    assert(tx.executor, "Executor is not defined");
    const fee = formatEther(BigInt(tx.fee));

    postings.push({
      account: getAccount(tx.executor, date),
      amount: `-${fee}`,
      currency: "ETH",
    });

    postings.push({
      account: getAccount("Expenses:Fees:Crypto", date),
      amount: fee,
      currency: "ETH",
    });
  }

  // Only create transaction if we have postings or it's a special case
  if (postings.length > 0) {
    const transaction = new Transaction({
      date,
      flag: "*",
      payee: title,
      metadata,
      postings,
    });

    console.log(transaction.toString() + "\n");
  }
}

main();
