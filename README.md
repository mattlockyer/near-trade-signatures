### ⚠️⚠️⚠️ Caution! This is beta / testnet technology ⚠️⚠️⚠️

[Chain Signatures Official Documentation](https://docs.near.org/build/chain-abstraction/chain-signatures)

# Overview

1. Use a Bitcoin Wallet (OKX Wallet) or an Ethereum Wallet (MM, OKX) to sign an unsigned transaction (UTX) of another chain (currently only NEAR).
1. The public key (or Ethereum address) is used as a NEAR Chain Signatures `path` offset to create a derived ECDSA public key and account (DA).
1. The DA is automatically created, funded and the necessary ECDSA signing key (secp256k1) is added to the account
1. The signature and UTX are sent to the NEAR contract (NC).
1. The NC verifies the signature and matches a recoved public key to the client provided public key (or Ethereum address).
1. The NC makes a cross contract call to the NEAR Chain Signatures contract to sign the hash of the UTX for the DA.
1. The ECDSA signature is returned to the client.
1. The UTX can now be broadcast to the chain with the ECDSA signature.

# Installation

`yarn`

# Create `.env` file in root of project

You will need your own NEAR dev account so you can fill in the env vars: `YOUR_NEAR_DEV_ACCOUNT_ID` and `YOUR_NEAR_DEV_ACCOUNT_SECRET_KEY`.

The easiest way to do this is by installing `cargo near` and using the command `cargo near create-dev-account`.

[Cargo Near](https://github.com/near/cargo-near)

```
REACT_APP_mpcContractId=v1.signer-dev.testnet
REACT_APP_contractId=forgetful-parent.testnet
REACT_APP_accountId=[YOUR_NEAR_DEV_ACCOUNT_ID]
REACT_APP_secretKey=[YOUR_NEAR_DEV_ACCOUNT_SECRET_KEY]
```

# Run the App

`yarn start`

1. You will be prompted to connect your OKX Wallet. Choose the Bitcoin wallet.
1. If your derived account does not exist, it will be automatically created. NOTE: YOUR_NEAR_DEV_ACCOUNT_ID must have at least 5 NEAR tokens.
1. Next you will see a TX payload, this is a sample NEAR transaction.
1. When you click sign, the same text will appear in your OKX Wallet extension. Sign this message.

# The NEAR Contract

Please see the Near contract for detailed comments.

### `near_tx.rs`

`get_near_sig` method calls the NEAR MPC contract and returns a Promise for each encoded and hashed NearTransaction. We chain this Promise to the previous Promise and finally return the whole Promise chain.