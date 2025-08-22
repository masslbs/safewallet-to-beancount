import { assertEquals } from "@std/assert";
import {
  convertToDecimal,
  type ICopyFilesArguments,
  isSafeMultiSigTx,
  type TxAll,
} from "./utils.ts";

Deno.test("convertToDecimal - basic conversion", () => {
  assertEquals(convertToDecimal("123456", 2), "1234.56");
  assertEquals(convertToDecimal("100", 2), "1");
  assertEquals(convertToDecimal("1000000", 6), "1");
  assertEquals(convertToDecimal("1234567890", 8), "12.3456789");
});

Deno.test("convertToDecimal - removes trailing zeros", () => {
  assertEquals(convertToDecimal("30000000", 5), "300");
  assertEquals(convertToDecimal("12340000", 4), "1234");
  assertEquals(convertToDecimal("100500", 3), "100.5");
  assertEquals(convertToDecimal("100050", 3), "100.05");
  assertEquals(convertToDecimal("100000", 3), "100");
});

Deno.test("convertToDecimal - edge cases", () => {
  // All zeros
  assertEquals(convertToDecimal("000000", 3), "0");

  // Single digit
  assertEquals(convertToDecimal("5", 1), "0.5");
  assertEquals(convertToDecimal("0", 1), "0");

  // No decimals
  assertEquals(convertToDecimal("123", 0), "123");

  // More decimals than digits
  assertEquals(convertToDecimal("1", 3), "0.001");
  assertEquals(convertToDecimal("12", 5), "0.00012");
});

Deno.test("convertToDecimal - preserves significant decimal digits", () => {
  assertEquals(convertToDecimal("123450", 4), "12.345");
  assertEquals(convertToDecimal("100100", 4), "10.01");
  assertEquals(convertToDecimal("100010", 4), "10.001");
  assertEquals(convertToDecimal("100001", 4), "10.0001");
});

Deno.test("convertToDecimal - handles large numbers", () => {
  assertEquals(convertToDecimal("1000000000000000000", 18), "1");
  assertEquals(convertToDecimal("1500000000000000000", 18), "1.5");
  assertEquals(
    convertToDecimal("123456789012345678", 18),
    "0.123456789012345678",
  );
});

Deno.test("isSafeMultiSigTx - identifies multisig transactions", () => {
  const multisigTx = {
    txType: "MULTISIG_TRANSACTION" as const,
  } as TxAll;

  assertEquals(isSafeMultiSigTx(multisigTx), true);
});

Deno.test("isSafeMultiSigTx - identifies module transactions", () => {
  const moduleTx = {
    txType: "MODULE_TRANSACTION" as const,
  } as TxAll;

  assertEquals(isSafeMultiSigTx(moduleTx), false);
});

Deno.test("isSafeMultiSigTx - identifies ethereum transactions", () => {
  const ethTx = {
    txType: "ETHEREUM_TRANSACTION" as const,
  } as TxAll;

  assertEquals(isSafeMultiSigTx(ethTx), false);
});

Deno.test("Type definitions - ICopyFilesArguments with settings undefined", () => {
  const args: ICopyFilesArguments = {
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
    settings: undefined,
    noOpen: false,
  };
  assertEquals(args.address, "0xabcdef1234567890abcdef1234567890abcdef12");
  assertEquals(args.settings, undefined);
  assertEquals(args.noOpen, false);
});
