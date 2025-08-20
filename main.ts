import { parse } from "ts-command-line-args";
import { formatEther } from "@wevm/viem";
import { readFile } from "node:fs/promises";
import SafeApiKit, {
  type AllTransactionsListResponse,
} from "@safe-global/api-kit";
import { assert } from "@std/assert";
import { type Posting, Transaction } from "./beancount.ts";
import {
  type ICopyFilesArguments,
  isSafeMultiSigTx,
  type TxAll,
} from "./utils.ts";

import * as Cow from "./modules/cow.ts";
import * as Send from "./modules/sends.ts";
import * as Swap from "./modules/swap.ts";
import * as CatchAll from "./modules/catchall.ts";

const mods = [Cow, Send, Swap, CatchAll];

const args = parse<ICopyFilesArguments>(
  {
    address: {
      type: String,
      alias: "a",
      description: "The address of the Safe Wallet",
    },
    settings: {
      type: String,
      alias: "s",
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

type Settings = {
  "labels": {
    [key: string]: string;
  };
};
let settings: Settings;
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

function getAccount(address: string, date: Date, open: boolean = true) {
  const labeled = settings.labels[address.toLowerCase()];
  if (labeled) {
    if (open) {
      openAccount(labeled, date);
    }
    return labeled;
  } else {
    return address;
  }
}

async function main() {
  // read the settings if we have any
  if (args.settings) {
    try {
      const contents = await readFile(args.settings, { encoding: "utf8" });
      // keys are converted to lowercase
      //
      settings = JSON.parse(contents);
      settings.labels = Object.fromEntries(
        Object.entries(settings.labels).map((
          [k, v],
        ) => [k.toLowerCase(), v]),
      );
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
        trusted: true,
        ordering: "timestamp",
        limit,
        offset,
      });
    for (const tx of transactions.results) {
      await txToEntry(tx);
    }
    if (!transactions.next) {
      fetching = false;
    }
    offset += limit;
  }
}

async function txToEntry(
  tx: TxAll,
) {
  assert(tx.executionDate, "Execution date is required");
  const date = new Date(tx.executionDate);
  let narration = "";
  // some dapp interaction
  if ("origin" in tx && tx.origin?.length > 2) {
    try {
      const origin = JSON.parse(tx.origin);
      narration = `${origin.name} (${origin.url})`;
    } catch {
      narration = tx.origin;
    }
  }

  if ("dataDecoded" in tx && tx.dataDecoded) {
    narration = `${narration} called ${tx.dataDecoded.method}`;
  }

  const metadata: Record<string, string> = {};
  // Handle different transaction hash property names based on transaction type
  if ("transactionHash" in tx && tx.transactionHash) {
    metadata.tx = tx.transactionHash;
  } else if ("txHash" in tx && tx.txHash) {
    metadata.tx = tx.txHash;
  }

  const feePostings: Posting[] = [];

  if (isSafeMultiSigTx(tx)) {
    metadata.nonce = tx.nonce?.toString();
    // Add fee postings for multisig transactions
    assert(tx.fee, "Fee is not defined");
    assert(tx.executor, "Executor is not defined");
    const fee = formatEther(BigInt(tx.fee));

    feePostings.push({
      account: tx.executor,
      amount: `-${fee}`,
      currency: "ETH",
    });

    feePostings.push({
      account: "Expenses:Fees:Crypto",
      amount: fee,
      currency: "ETH",
    });
  }

  const beanTx = new Transaction({
    date,
    payee: tx.to ? getAccount(tx.to, date, false) : "Created",
    flag: "*",
    narration,
    metadata,
    postings: [],
  });

  const mod = mods.find((mod) => mod.identify(tx));
  await mod!.process({ ethTx: tx, beanTx, args });
  const postings = beanTx.args.postings;
  // add the tx fee postings
  postings.push(...feePostings);
  beanTx.args.postings = postings.map((posting: Posting) => {
    posting.account = getAccount(posting.account, date);
    return posting;
  });

  if (beanTx.args.postings.length > 0) {
    console.log(beanTx.toString() + "\n");
  }
}

main();
