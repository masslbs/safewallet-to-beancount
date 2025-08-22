/**
 * Safe Wallet to Beancount Converter
 *
 * This tool converts Safe Wallet transactions into Beancount journal entries.
 * It fetches transaction data from the Safe Transaction Service API and processes
 * different types of transactions (COW Protocol, token swaps, sends, etc.) into
 * properly formatted double-entry bookkeeping entries.
 *
 * @author MassLabs
 * @license GPL2
 *
 * ## Usage
 * ```bash
 * deno run --allow-read --allow-net --allow-env main.ts -a <SAFE_ADDRESS> [-s <SETTINGS_FILE>]
 * ```
 *
 * ## Arguments
 * - `-a, --address`: The Ethereum address of the Safe Wallet (required)
 * - `-s, --settings`: JSON file mapping addresses to account names (optional)
 * - `--no-open`: Disable automatic generation of account open statements (optional)
 *   Use this when accounts are already opened or when you want to manage account
 *   opening separately (e.g., when appending to existing Beancount files)
 * - `--help`: Show help information
 *
 * ## Settings File Format
 * ```json
 * {
 *   "labels": {
 *     "0x1234...": "Assets:Crypto:ETH:MyWallet",
 *     "0xabcd...": "Assets:Crypto:USDC:Exchange"
 *   }
 * }
 * ```
 *
 * ## Architecture
 * The tool uses a modular architecture with transaction processing modules:
 * - COW Protocol swaps
 * - Token sends/transfers
 * - Generic swaps
 * - Catch-all for unmatched transactions
 *
 * Each module can identify specific transaction types and convert them into
 * appropriate Beancount postings with proper asset movements and fees.
 *
 * ## Output
 * Beancount journal entries are written to stdout, including:
 * - Account open statements (generated automatically, unless --no-open is used)
 * - Transaction entries with proper double-entry bookkeeping
 * - Transaction fees and gas costs
 * - Metadata with transaction hashes and nonces
 */

import { run } from "@optique/run";
import { object, option, optional } from "@optique/core/parser";
import { string } from "@optique/core/valueparser";
import { message } from "@optique/core/message";
import { formatEther } from "@wevm/viem";
import { readFile } from "node:fs/promises";
import SafeApiKit, {
  type AllTransactionsListResponse,
} from "@safe-global/api-kit";
import { assert } from "@std/assert";
import { type Posting, Transaction } from "./beancount.ts";
import { isSafeMultiSigTx, type TxAll } from "./utils.ts";

import * as Cow from "./modules/cow.ts";
import * as Send from "./modules/sends.ts";
import * as Swap from "./modules/swap.ts";
import * as CatchAll from "./modules/catchall.ts";

/**
 * Transaction processing modules in order of priority.
 * Each module can identify and process specific transaction types.
 * CatchAll should always be last as it handles any unmatched transactions.
 */
const mods = [Cow, Send, Swap, CatchAll];

/**
 * Command line argument parser configuration using Optique.
 * Defines the CLI interface with required address and optional settings file.
 */
const parser = object({
  address: option("-a", "--address", string({ metavar: "ADDRESS" }), {
    description: message`The address of the Safe Wallet`,
  }),
  settings: optional(option("-s", "--settings", string({ metavar: "FILE" }), {
    description:
      message`A map between Ethereum addresses and Beancount accounts`,
  })),
  noOpen: option("--no-open", {
    description:
      message`Disable automatic generation of account open statements`,
  }),
});

/**
 * Parse command line arguments and run the application.
 * Enables automatic help generation with --help option.
 */
const args = run(parser, {
  programName: "safe-to-beancount",
  help: "option",
});

/**
 * Configuration structure for address-to-account mappings.
 * The settings file should contain a JSON object with a "labels" property
 * mapping Ethereum addresses (lowercase) to Beancount account names.
 */
type Settings = {
  "labels": {
    [key: string]: string;
  };
};

let settings: Settings;

/** Track which accounts have been opened to avoid duplicate open statements */
const usedLabels: Set<string> = new Set();

/**
 * Safe API client for fetching transaction data from Ethereum mainnet.
 * Uses the official Safe Transaction Service API.
 *
 * @see https://arethetypeswrong.github.io/?p=%40safe-global%2Fapi-kit%404.0.0
 */
// @ts-ignore: SafeApiKit seems to be not typed correctly
const apiKit = new SafeApiKit({
  chainId: 1n, // Ethereum mainnet
  txServiceUrl: "https://safe-transaction-mainnet.safe.global/api",
});

/**
 * Creates a Beancount open account statement if the account hasn't been opened yet.
 * In Beancount, accounts must be explicitly opened before they can be used.
 * This function respects the --no-open flag to disable automatic account opening.
 *
 * @param account - The Beancount account name to open
 * @param date - The date when the account should be opened
 */
function openAccount(account: string, date: Date) {
  if (!args.noOpen && !usedLabels.has(account)) {
    usedLabels.add(account);
    const dateStr = date.toISOString().split("T")[0];
    console.log(`${dateStr} open ${account}`);
  }
}

/**
 * Converts an Ethereum address to a Beancount account name using the settings mapping.
 * If no mapping exists, returns the original address. Optionally opens the account.
 *
 * @param address - The Ethereum address to convert
 * @param date - The date for account opening (if needed)
 * @param open - Whether to automatically open the account (default: true)
 * @returns The mapped account name or original address
 */
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

/**
 * Main application entry point.
 * Loads settings, fetches transactions from the Safe API, and processes them.
 */
async function main() {
  // Load and parse the optional settings file for address-to-account mappings
  if (args.settings) {
    try {
      const contents = await readFile(args.settings, { encoding: "utf8" });
      settings = JSON.parse(contents);

      // Convert all address keys to lowercase for consistent lookups
      // (Ethereum addresses are case-insensitive for comparison purposes)
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

  // Fetch all transactions from the Safe API using pagination
  // The API returns transactions in batches, so we need to iterate through all pages
  let fetching = true;
  let offset = 0;
  const limit = 20; // API pagination limit

  while (fetching) {
    const transactions: AllTransactionsListResponse = await apiKit
      .getAllTransactions(args.address, {
        trusted: true, // Only fetch transactions that have been confirmed
        ordering: "timestamp", // Order chronologically by execution time
        limit,
        offset,
      });

    // Convert each transaction to a Beancount journal entry
    for (const tx of transactions.results) {
      await txToEntry(tx);
    }

    // Continue fetching if there are more pages available
    if (!transactions.next) {
      fetching = false;
    }
    offset += limit;
  }
}

/**
 * Converts a Safe transaction into a Beancount journal entry.
 * Handles transaction metadata, fees, and delegates processing to appropriate modules.
 *
 * @param tx - The Safe transaction to convert
 */
async function txToEntry(
  tx: TxAll,
) {
  assert(tx.executionDate, "Execution date is required");
  const date = new Date(tx.executionDate);
  let narration = ""; // Transaction description for the Beancount entry

  // Extract narration from DApp interaction metadata
  if ("origin" in tx && tx.origin?.length > 2) {
    try {
      const origin = JSON.parse(tx.origin);
      narration = `${origin.name} (${origin.url})`;
    } catch {
      // Fallback to raw origin string if JSON parsing fails
      narration = tx.origin;
    }
  }

  // Add method call information to narration
  if ("dataDecoded" in tx && tx.dataDecoded) {
    narration = `${narration} called ${tx.dataDecoded.method}`;
  }

  // Collect transaction metadata for the Beancount entry
  const metadata: Record<string, string> = {};

  // Handle different transaction hash property names based on transaction type
  if ("transactionHash" in tx && tx.transactionHash) {
    metadata.tx = tx.transactionHash;
  } else if ("txHash" in tx && tx.txHash) {
    metadata.tx = tx.txHash;
  }

  // Prepare fee postings for multisig transactions
  const feePostings: Posting[] = [];

  if (isSafeMultiSigTx(tx)) {
    metadata.nonce = tx.nonce?.toString();

    // Add fee postings for multisig transactions
    // Fees are paid by the executor and recorded as crypto expenses
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

  // Create the base Beancount transaction
  const beanTx = new Transaction({
    date,
    payee: tx.to ? getAccount(tx.to, date, false) : "Created",
    flag: "*", // Complete transaction flag
    narration,
    metadata,
    postings: [],
  });

  // Find the first module that can identify and process this transaction type
  // Modules are checked in order: COW, Send, Swap, CatchAll
  const mod = mods.find((mod) => mod.identify(tx));
  await mod!.process({ ethTx: tx, beanTx, args });

  // Combine transaction-specific postings with fee postings
  const postings = beanTx.args.postings;
  postings.push(...feePostings);

  // Convert all Ethereum addresses in postings to Beancount account names
  beanTx.args.postings = postings.map((posting: Posting) => {
    posting.account = getAccount(posting.account, date);
    return posting;
  });

  // Only output transactions that have actual postings (asset movements)
  // Empty transactions are skipped to keep the output clean
  if (beanTx.args.postings.length > 0) {
    console.log(beanTx.toString() + "\n");
  }
}

// Start the application
main();
