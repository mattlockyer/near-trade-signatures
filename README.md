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
REACT_APP_mpcPublicKey=secp256k1:54hU5wcCmVUPFWLDALXMh1fFToZsVXrx9BbTbHzSfQq1Kd1rJZi52iPa4QQxo6s5TgjWqgpY8HamYuUDzG6fAaUq
REACT_APP_mpcContractId=v1.signer-dev.testnet
REACT_APP_contractId=forgetful-parent.testnet
```

.env vars you need to provide

_Note: NEAR dev account secret key is NOT the seed phrase)_

```
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

Each contract method is broken down into two parts:

1. Proving that the source chain wallet signed the message
1. Getting the correct signature for the derived account on the destination chain

Example from a message (msg) signed with a Bitcoin wallet to an EVM ECDSA signature:

```rust
pub fn bitcoin_to_evm(&mut self, pk: String, msg: String, sig: String) -> Promise {
	bitcoin_owner::require(&pk, &msg, &sig);
	evm_tx::get_evm_sig(pk, msg)
}
```

First, `bitcoin_owner::require(...)` is called. Second, `evm_tx::get_evm_sig(...)` is called and the signature is returned to the client calling the contract.

### `ecdsa.rs`

This is where the cross contact call to the NEAR Chain Signatures contract is.

### `evm_tx.rs`

This file has the `get_evm_sig(...)` method which takes the JSON msg that was signed and parses it using the Omni library. Once we have an `EVMTransaction` object we can get an RLP encoding of the transaction by calling `build_for_signing()`. Finally, we can get the transaction hash that needs signing by the NEAR Chain Signature MPC Contract call (`ecdsa.rs`) by taking the `keccak256` hash of the RLP encoded EVM transactions.

### `near_tx.rs`

Similar to `evm_tx.rs`
