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
REACT_APP_mpcPublicKey=secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3
REACT_APP_mpcContractId=v1.signer-prod.testnet
REACT_APP_contractId=forgetful-parent.testnet
```

.env vars you need to provide

_Note: NEAR dev account secret key is NOT the seed phrase)_

```
REACT_APP_accountId=[YOUR_NEAR_DEV_ACCOUNT_ID]
REACT_APP_secretKey=[YOUR_NEAR_DEV_ACCOUNT_SECRET_KEY]
```

### REACT_APP_mpcContractId & REACT_APP_mpcPublicKey

The MPC contract for testnet may change from time to time. If you are having difficulties with the contract e.g. timeouts, signatures not being returned / ready, or any other issues with the contract address, reach out in the following Telegram group: https://t.me/chain_abstraction

The MPC public key corresponds to the MPC contract, but also may change from time to time as nodes are added and removed from the MPC network or the network is rebooted. Please verify the latest MPC public key for the contract you are using by using `near-cli` and the following command:

```
near view v1.signer-prod.testnet public_key
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
1. Getting a signature for the derived account on the destination chain

Taking a look at the method signature for trade_signature, the contract's public method:

```rust
pub fn trade_signature(
	&mut self,
	// public key (bitcoin) or address (evm)
	owner: String,
	msg: String,
	sig: String,
	source: String,
	destination: String,
	hash: Option<String>,
) -> PromiseOrValue<u8> {
```

Given arguments for source `bitcoin` and destination `evm`:

First, `bitcoin_owner::require(owner, msg, sig)` is called. This method will verify that the `owner` (a bitcoin public key) can be recovered from the `msg` signed by the provided `signature`.

Second, `evm_tx::get_evm_sig(owner, msg)` is called. The `msg` is parsed and encoded into an evm transaction. A cross contract call is made to the NEAR Chain Signatures contract with the path variable of `owner` creating a signature for a unique derived account. The cross contract call returns the promise to the contract and on to the client.

### `ecdsa.rs`

This is where the cross contact call to the NEAR Chain Signatures contract is.

### `evm_tx.rs`

This file has the `get_evm_sig(...)` method which takes the JSON msg that was signed and parses it using the Omni library. Once we have an `EVMTransaction` object we can get an RLP encoding of the transaction by calling `build_for_signing()`. Finally, we can get the transaction hash that needs signing by the NEAR Chain Signature MPC Contract call (`ecdsa.rs`) by taking the `keccak256` hash of the RLP encoded EVM transactions.

### `near_tx.rs`

Similar to `evm_tx.rs`
