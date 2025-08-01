#!/usr/bin/env deno run

import { Transaction } from "./beancount.ts";

console.log("=== Beancount Transaction Examples ===\n");

// Example 1: Simple expense transaction
console.log("1. Simple Expense Transaction:");
const expenseTransaction = new Transaction({
  date: new Date("2024-01-15"),
  flag: "*",
  payee: "Coffee Shop",
  narration: "Morning coffee",
  postings: [
    {
      account: "Assets:Checking",
      amount: "-4.50",
      currency: "USD",
    },
    {
      account: "Expenses:Food:Coffee",
      amount: "4.50",
      currency: "USD",
    },
  ],
});
console.log(expenseTransaction.toString());
console.log("");

// Example 2: Investment purchase with cost
console.log("2. Stock Purchase with Cost:");
const stockPurchase = new Transaction({
  date: new Date("2024-01-20"),
  flag: "*",
  payee: "E*TRADE",
  narration: "Bought AAPL shares",
  tags: ["investing"],
  postings: [
    {
      account: "Assets:Brokerage:AAPL",
      amount: "10",
      currency: "AAPL",
      cost: "150.00 USD",
    },
    {
      account: "Assets:Brokerage:Cash",
      amount: "-1500.00",
      currency: "USD",
    },
  ],
});
console.log(stockPurchase.toString());
console.log("");

// Example 3: Stock sale with cost and price
console.log("3. Stock Sale with Capital Gains:");
const stockSale = new Transaction({
  date: new Date("2024-02-15"),
  flag: "*",
  payee: "E*TRADE",
  narration: "Sold AAPL shares",
  tags: ["investing"],
  postings: [
    {
      account: "Assets:Brokerage:AAPL",
      amount: "-5",
      currency: "AAPL",
      cost: "150.00 USD",
      price: "180.00 USD",
    },
    {
      account: "Assets:Brokerage:Cash",
      amount: "900.00",
      currency: "USD",
    },
    {
      account: "Income:Capital-Gains",
      amount: "-150.00",
      currency: "USD",
    },
  ],
});
console.log(stockSale.toString());
console.log("");

// Example 4: Multi-currency transaction
console.log("4. Multi-Currency Transaction:");
const currencyExchange = new Transaction({
  date: new Date("2024-01-25"),
  flag: "*",
  payee: "Currency Exchange",
  narration: "USD to EUR exchange",
  postings: [
    {
      account: "Assets:Cash:USD",
      amount: "-1000.00",
      currency: "USD",
      price: "0.85 EUR",
    },
    {
      account: "Assets:Cash:EUR",
      amount: "850.00",
      currency: "EUR",
    },
  ],
});
console.log(currencyExchange.toString());
console.log("");

// Example 5: Transaction with metadata and comments
console.log("5. Transaction with Metadata and Comments:");
const complexTransaction = new Transaction({
  date: new Date("2024-01-30"),
  flag: "*",
  payee: "Online Store",
  narration: "Business equipment purchase",
  comment: "Invoice #12345, deductible expense",
  tags: ["business", "equipment"],
  metadata: {
    invoice: "INV-12345",
    category: "business-expense",
    deductible: "true",
  },
  postings: [
    {
      account: "Assets:Checking",
      amount: "-299.99",
      currency: "USD",
      comment: "Business checking account",
      metadata: {
        check_number: "1001",
      },
    },
    {
      flag: "!",
      account: "Expenses:Business:Equipment",
      amount: "299.99",
      currency: "USD",
      comment: "Needs receipt for tax records",
      metadata: {
        tax_deductible: "true",
      },
    },
  ],
});
console.log(complexTransaction.toString());
console.log("");

// Example 6: Salary with multiple deductions
console.log("6. Salary with Multiple Deductions:");
const salaryTransaction = new Transaction({
  date: new Date("2024-01-31"),
  flag: "*",
  payee: "Acme Corp",
  narration: "Monthly salary",
  postings: [
    {
      account: "Assets:Checking",
      amount: "3500.00",
      currency: "USD",
      comment: "Net pay after deductions",
    },
    {
      account: "Income:Salary",
      amount: "-5000.00",
      currency: "USD",
      comment: "Gross salary",
    },
    {
      account: "Expenses:Taxes:Federal",
      amount: "800.00",
      currency: "USD",
    },
    {
      account: "Expenses:Taxes:State",
      amount: "300.00",
      currency: "USD",
    },
    {
      account: "Expenses:Taxes:Social-Security",
      amount: "310.00",
      currency: "USD",
    },
    {
      account: "Expenses:Insurance:Health",
      amount: "90.00",
      currency: "USD",
    },
  ],
});
console.log(salaryTransaction.toString());
console.log("");

console.log("=== All examples generated successfully! ===");
