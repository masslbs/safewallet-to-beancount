import { parse } from "ts-command-line-args";
import { formatEther } from "viem";
import { readFile } from "node:fs/promises";

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

const safeEndpoint = "https://safe-transaction-mainnet.safe.global";
type Label = {
  [key: string]: string;
};
let labels: Label = {};
const usedLabels: Set<string> = new Set();

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
    } catch (err: any) {
      console.error(err.message);
    }
  }

  let fetching = true;
  let offset = 0;
  while (fetching) {
    const url = `${safeEndpoint}/api/v1/safes/${args.address}/all-transactions/?ordering=execution_date&limit=20&offset=${offset}&trusted=true`;
    const transactions = await fetch(url).then((res) => res.json());
    transactions.results.forEach(txToEntry);
    if (!transactions.next) {
      fetching = false;
    }
    offset += 20;
  }
}

function trimDate(date: string) {
  return date.slice(0, 10);
}

function txToEntry(tx: any) {
  const date = trimDate(tx.executionDate);
  let title = "";
  let transaction: string = "";
  // some dapp interaction
  if (tx.origin?.length > 2) {
    const origin = JSON.parse(tx.origin);
    title = `${origin.name} (${origin.url})`;
  }
  if (tx.dataDecoded) {
    title = `${title} called ${tx.dataDecoded.method}`;
  }

  if (tx.transfers.length === 2) {
    // generally if there are two transfers, it's a swap
    let transfer1: any;
    let transfer2: any;

    if (tx.transfers[0].to === args.address) {
      transfer1 = tx.transfers[1];
      transfer2 = tx.transfers[0];
    } else {
      transfer1 = tx.transfers[0];
      transfer2 = tx.transfers[1];
    }

    const amount1 =
      BigInt(transfer1.value) / 10n ** BigInt(transfer1.tokenInfo.decimals);
    const amount2 =
      BigInt(transfer2.value) / 10n ** BigInt(transfer2.tokenInfo.decimals);

    if (title === "")
      title = `swaped ${transfer1.tokenInfo.symbol.toUpperCase()} to ${transfer2.tokenInfo.symbol.toUpperCase()}`;
    transaction = `  ${getAccount(
      transfer1.from,
      transfer1.executionDate,
    )}  -${amount1} ${transfer1.tokenInfo.symbol.toUpperCase()} @@ ${amount2} ${transfer2.tokenInfo.symbol.toUpperCase()}
  ${getAccount(
    transfer2.to,
    transfer2.executionDate,
  )}  ${amount2} ${transfer2.tokenInfo.symbol.toUpperCase()}`;
  } else if (tx.transfers.length === 1) {
    // a simple transfer
    // if the token is not trusted, we don't want to track it
    if (!tx.transfers[0].tokenInfo.trusted) return;
    if (tx.transfers[0].to === args.address) {
      title = `received ${tx.transfers[0].tokenInfo.symbol}`;
    } else {
      title = `sent ${tx.transfers[0].tokenInfo.symbol}`;
    }

    const transfer = tx.transfers[0];
    const amount =
      BigInt(transfer.value) / 10n ** BigInt(transfer.tokenInfo.decimals);
    transaction = `  ${getAccount(
      transfer.from,
      transfer.executionDate,
    )}  -${amount} ${transfer.tokenInfo.symbol}
  ${getAccount(
    transfer.to,
    transfer.executionDate,
  )}  ${amount} ${transfer.tokenInfo.symbol.toUpperCase()}`;
  }
  const description = `${date} * "${title}"`;

  let result = `${description}`;
  // if we created the tx then we paid the fee
  if (tx.transactionHash) {
    result = result.concat(`\n  tx: "${tx.transactionHash}"`);
  } else {
    result = result.concat(`\n  tx: "${tx.txHash}"`);
  }

  if (tx.txType === "MULTISIG_TRANSACTION") {
    result = result.concat(`\n  nonce: ${tx.nonce}`);
    const fee = formatEther(tx.fee);
    result = result.concat(
      `\n  ${getAccount(tx.executor, tx.executionDate)}  -${fee} ETH
  ${getAccount("Expenses:Fees:Crypto", tx.executionDate)}  ${fee} ETH`,
    );
  }

  if (transaction !== "") result = result.concat(`\n${transaction}`);
  console.log(result + "\n");
}

main();
