# Safe Wallet to Beancount Converter

A tool that converts Safe Wallet transactions into Beancount journal entries for
double-entry bookkeeping.

## Overview

This tool fetches transaction data from Safe Wallets (formerly Gnosis Safe)
using the Safe Global API and converts them into properly formatted Beancount
journal entries.

## Features

- **Safe Wallet Integration**: Fetches transaction history from Safe Wallets on
  Ethereum mainnet
- **Multiple Transaction Types**: Supports simple transfers, token swaps, and
  multisig transactions
- **Address Labeling**: Map Ethereum addresses to human-readable Beancount
  account names
- **Automatic Fee Tracking**: Includes transaction fees for multisig operations

## Running

### Using Nix (Recommended)

```bash
nix run github:massalabs/safe-to-beancount
```

### Using Deno

```bash
deno run --allow-env --allow-net main.ts [options]
```

## Usage

### Basic Usage

```bash
safe-to-beancount --address 0x1234567890123456789012345678901234567890
```

### With Address Labels

Create a JSON file mapping Ethereum addresses to Beancount account names:

```json
{
  "0x1234567890123456789012345678901234567890": "Assets:Crypto:Safe-Wallet",
  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd": "Assets:Crypto:Trading",
  "0x9876543210987654321098765432109876543210": "Income:Crypto:Staking"
}
```

Then run with the labels file:

```bash
./result/bin/safe-to-beancount --address 0x1234... --labels labels.json
```

### Command Line Options

- `-a, --address <address>`: The address of the Safe Wallet (required)
- `-l, --labels <file>`: JSON file mapping addresses to Beancount accounts
  (optional)
- `-h, --help`: Show help message

## Development

### Prerequisites

- Deno runtime
- Nix (optional, for development environment)

### Development Environment

```bash
nix develop
```

## License

GPL-2.0

## Contributing

is welcomed

## Support

For issues and feature requests, please use the project's issue tracker.
