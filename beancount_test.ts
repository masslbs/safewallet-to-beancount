import { assertEquals } from "@std/assert";
import { Transaction } from "./beancount.ts";

Deno.test("Transaction - Uncle Bob foreign currency collection", () => {
  const transaction = new Transaction({
    date: new Date("2014-07-12"),
    flag: "*",
    payee: "Uncle Bob gave me his foreign currency collection!",
    postings: [
      {
        account: "Income:Gifts",
        amount: "-117.00",
        currency: "ILS",
      },
      {
        account: "Income:Gifts",
        amount: "-3000.00",
        currency: "INR",
      },
      {
        account: "Income:Gifts",
        amount: "-800.00",
        currency: "JPY",
      },
      {
        account: "Assets:ForeignCash",
        amount: "",
        currency: "",
      },
    ],
  });

  const expected =
    `2014-07-12 * "Uncle Bob gave me his foreign currency collection!"
  Income:Gifts -117.00 ILS
  Income:Gifts -3000.00 INR
  Income:Gifts -800.00 JPY
  Assets:ForeignCash`;

  assertEquals(transaction.toString(), expected);
});

Deno.test("Transaction - Sold shares of S&P 500", () => {
  const transaction = new Transaction({
    date: new Date("2014-07-11"),
    flag: "*",
    payee: "Sold shares of S&P 500",
    postings: [
      {
        account: "Assets:ETrade:IVV",
        amount: "-10",
        currency: "IVV",
        cost: "183.07 USD",
        price: "197.90 USD",
      },
      {
        account: "Assets:ETrade:Cash",
        amount: "",
        currency: "",
      },
    ],
  });

  const expected = `2014-07-11 * "Sold shares of S&P 500"
  Assets:ETrade:IVV -10 IVV {183.07 USD} @ 197.90 USD
  Assets:ETrade:Cash`;

  assertEquals(transaction.toString(), expected);
});

Deno.test("Transaction - with narration and payee", () => {
  const transaction = new Transaction({
    date: new Date("2014-05-05"),
    flag: "*",
    payee: "Cafe Mogador",
    narration: "Lamb tagine with wine",
    postings: [
      {
        account: "Liabilities:CreditCard:CapitalOne",
        amount: "-37.45",
        currency: "USD",
      },
      {
        account: "Expenses:Restaurant",
        amount: "",
        currency: "",
      },
    ],
  });

  const expected = `2014-05-05 * "Cafe Mogador" "Lamb tagine with wine"
  Liabilities:CreditCard:CapitalOne -37.45 USD
  Expenses:Restaurant`;

  assertEquals(transaction.toString(), expected);
});

Deno.test("Transaction - with tags", () => {
  const transaction = new Transaction({
    date: new Date("2014-04-23"),
    flag: "*",
    payee: "Flight to Berlin",
    tags: ["berlin-trip-2014", "travel"],
    postings: [
      {
        account: "Expenses:Flights",
        amount: "-1230.27",
        currency: "USD",
      },
      {
        account: "Liabilities:CreditCard",
        amount: "",
        currency: "",
      },
    ],
  });

  const expected = `2014-04-23 * "Flight to Berlin" #berlin-trip-2014 #travel
  Expenses:Flights -1230.27 USD
  Liabilities:CreditCard`;

  assertEquals(transaction.toString(), expected);
});

Deno.test("Transaction - with metadata", () => {
  const transaction = new Transaction({
    date: new Date("2014-08-26"),
    flag: "*",
    payee: "Buying some shares of Hooli",
    metadata: {
      statement: "confirmation-826453.pdf",
      category: "investment",
    },
    postings: [
      {
        account: "Assets:BTrade:HOOLI",
        amount: "10",
        currency: "HOOL",
        cost: "498.45 USD",
        metadata: {
          decision: "scheduled",
        },
      },
      {
        account: "Assets:BTrade:Cash",
        amount: "",
        currency: "",
      },
    ],
  });

  const expected = `2014-08-26 * "Buying some shares of Hooli"
  statement: "confirmation-826453.pdf"
  category: "investment"
  Assets:BTrade:HOOLI 10 HOOL {498.45 USD}
    decision: "scheduled"
  Assets:BTrade:Cash`;

  assertEquals(transaction.toString(), expected);
});

Deno.test("Transaction - with posting flags and comments", () => {
  const transaction = new Transaction({
    date: new Date("2014-05-05"),
    flag: "*",
    payee: "Transfer from Savings account",
    postings: [
      {
        account: "Assets:MyBank:Checking",
        amount: "-400.00",
        currency: "USD",
        comment: "Transfer out",
      },
      {
        flag: "!",
        account: "Assets:MyBank:Savings",
        amount: "",
        currency: "",
        comment: "Needs verification",
      },
    ],
  });

  const expected = `2014-05-05 * "Transfer from Savings account"
  Assets:MyBank:Checking -400.00 USD ; Transfer out
  ! Assets:MyBank:Savings ; Needs verification`;

  assertEquals(transaction.toString(), expected);
});

Deno.test("Transaction - with transaction comment", () => {
  const transaction = new Transaction({
    date: new Date("2015-01-01"),
    flag: "*",
    payee: "Taxi home from concert in Brooklyn",
    comment: "I paid and left the taxi, forgot to take change, it was cold.",
    postings: [
      {
        account: "Assets:Cash",
        amount: "-20",
        currency: "USD",
        comment: "inline comment",
      },
      {
        account: "Expenses:Taxi",
        amount: "",
        currency: "",
      },
    ],
  });

  const expected =
    `; I paid and left the taxi, forgot to take change, it was cold.
2015-01-01 * "Taxi home from concert in Brooklyn"
  Assets:Cash -20 USD ; inline comment
  Expenses:Taxi`;

  assertEquals(transaction.toString(), expected);
});

Deno.test("Transaction - with total cost", () => {
  const transaction = new Transaction({
    date: new Date("2012-11-03"),
    flag: "*",
    payee: "Transfer to account in Canada",
    postings: [
      {
        account: "Assets:MyBank:Checking",
        amount: "-400.00",
        currency: "USD",
        totalCost: "436.01",
        totalCostCurrency: "CAD",
      },
      {
        account: "Assets:FR:SocGen:Checking",
        amount: "436.01",
        currency: "CAD",
      },
    ],
  });

  const expected = `2012-11-03 * "Transfer to account in Canada"
  Assets:MyBank:Checking -400.00 USD @@ 436.01 CAD
  Assets:FR:SocGen:Checking 436.01 CAD`;

  assertEquals(transaction.toString(), expected);
});

Deno.test("Transaction - exclamation flag", () => {
  const transaction = new Transaction({
    date: new Date("2014-05-05"),
    flag: "!",
    payee: "Incomplete transaction",
    postings: [
      {
        account: "Assets:Checking",
        amount: "-100.00",
        currency: "USD",
      },
      {
        account: "Expenses:Unknown",
        amount: "",
        currency: "",
      },
    ],
  });

  const expected = `2014-05-05 ! "Incomplete transaction"
  Assets:Checking -100.00 USD
  Expenses:Unknown`;

  assertEquals(transaction.toString(), expected);
});

Deno.test("Transaction - minimal transaction with just narration", () => {
  const transaction = new Transaction({
    date: new Date("2014-05-05"),
    flag: "*",
    payee: "",
    narration: "Simple transaction",
    postings: [
      {
        account: "Assets:Cash",
        amount: "-50.00",
        currency: "USD",
      },
      {
        account: "Expenses:Food",
        amount: "",
        currency: "",
      },
    ],
  });

  const expected = `2014-05-05 * "" "Simple transaction"
  Assets:Cash -50.00 USD
  Expenses:Food`;

  assertEquals(transaction.toString(), expected);
});
