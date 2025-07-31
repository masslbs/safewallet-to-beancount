import { parse } from "ts-command-line-args";
import { formatEther } from "@wevm/viem";
import { readFile } from "node:fs/promises";
import SafeApiKit, {
  type SafeMultisigTransactionWithTransfersResponse,
  type TransferResponse,
} from "@safe-global/api-kit";
import { assert } from "@std/assert";

interface ICopyFilesArguments {
  address: string;
  labels?: string;
  help?: boolean;
}

export const args = parse<ICopyFilesArguments>(
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

const apiKit = new SafeApiKit({
  chainId: 1n, // set the correct chainId
  txServiceUrl: "https://safe-transaction-mainnet.safe.global/api",
});

// creates an open account statement if the account is not already open
function openAccount(account: string, date: string) {
  if (!usedLabels.has(account)) {
    usedLabels.add(account);
    console.log(`${trimDate(date)} open ${account}`);
  }
}

function getAccount(address: string, date: string) {
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
    const transactions = await apiKit.getAllTransactions(args.address, {
      trusted: true,
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

function trimDate(date: string) {
  return date.slice(0, 10);
}
// ether doesn't have any token info associated with it so we must add it here
// function unifyTransferFormat(transfers: any) {
//   return transfers.map((trans: any) => {
//     if (trans.type === "ETHER_TRANSFER") {
//       trans.tokenInfo = { symbol: "ETH", decimals: 18 };
//     }
//     return trans;
//   });
// }

function txToEntry(tx: SafeMultisigTransactionWithTransfersResponse) {
  // console.log(tx);
  // const transfers = unifyTransferFormat(tx.transfers);
  assert(tx.executionDate, "Execution date is required");
  const date = trimDate(tx.executionDate);
  let title = "";
  let transaction: string = "";
  // some dapp interaction
  if (tx.origin?.length > 2) {
    try {
      const origin = JSON.parse(tx.origin);
      title = `${origin.name} (${origin.url})`;
    } catch {
      title = tx.origin;
    }
  }
  if (tx.dataDecoded) {
    title = `${title} called ${tx.dataDecoded.method}`;
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
    transaction = `  ${
      getAccount(
        transfer1.from,
        transfer1.executionDate,
      )
    }  -${amount1} ${transfer1.tokenInfo!.symbol.toUpperCase()} @@ ${amount2} ${
      transfer2.tokenInfo!.symbol.toUpperCase()
    }
  ${
      getAccount(
        transfer2.to,
        transfer2.executionDate,
      )
    }  ${amount2} ${transfer2.tokenInfo!.symbol.toUpperCase()}`;
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
    transaction = `  ${
      getAccount(
        transfer.from,
        transfer.executionDate,
      )
    }  -${amount} ${transfer.tokenInfo.symbol}
  ${
      getAccount(
        transfer.to,
        transfer.executionDate,
      )
    }  ${amount} ${transfer.tokenInfo.symbol.toUpperCase()}`;
  }
  const description = `${date} * "${title}"`;

  let result = `${description}`;
  result = result.concat(`\n  tx: "${tx.transactionHash}"`);

  if (tx.txType === "MULTISIG_TRANSACTION") {
    result = result.concat(`\n  nonce: ${tx.nonce}`);
    assert(tx.fee, "Fee is not defined");
    const fee = formatEther(BigInt(tx.fee));
    assert(tx.executor, "Executor is not defined");
    result = result.concat(
      `\n  ${getAccount(tx.executor, tx.executionDate)}  -${fee} ETH
  ${getAccount("Expenses:Fees:Crypto", tx.executionDate)}  ${fee} ETH`,
    );
  }

  if (transaction !== "") result = result.concat(`\n${transaction}`);
  console.log(result + "\n");
}

main();
