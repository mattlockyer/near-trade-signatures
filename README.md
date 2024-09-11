### ⚠️⚠️⚠️ Caution! This is beta / testnet technology ⚠️⚠️⚠️

[Chain Signatures Official Documentation](https://docs.near.org/build/chain-abstraction/chain-signatures)

# Overview

1. Use a Bitcoin Wallet (OKX Wallet) to sign an unsigned transaction (UTX) of another chain (NEAR implemented for now).
1. The signature and UTX are sent to the NEAR contract (NC).
1. The NC verifies the signature and a recovered public key (RPK).
1. The RPK is used as a NEAR Chain Signatures `path` offset to create a derived ECDSA public key and account (DA).
1. The NC makes a cross contract call to the NEAR Chain Signatures contract to sign the hash of the UTX for the DA.
1. The signature is returned to the client.
1. The UTX can now be broadcast to the chain with a signature.

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

# Unpacking the Contract

```rust
pub fn test_call(&mut self, pk: String, msg: String, sig: String) -> Promise {
	owner::require_btc_owner(&pk, &msg, &sig);
```

We have a method called `test_call` that returns a NEAR Promise.

The first line in this method calls `owner::require_btc_owner(&pk, &msg, &sig);`. To see code, open `contract/owner.rs` (commented).

```rust
	let data_value: Value = from_str(&msg).unwrap();
	let transactions = parse::get_transactions(&data_value["transactions"]);
	let mut promise = Promise::new(env::current_account_id());
```

Next, the contract will parse the JSON into an array of NearTransaction objects.

```rust
	for transaction in transactions {
		let encoded =
			borsh::to_vec(&transaction).expect("failed to serialize NEAR transaction");

		let payload = sha256(&encoded);

		// mpc sign call args
		let request = SignRequest {
			payload: parse::vec_to_fixed(payload),
			path: pk.clone(),
			key_version: 0,
		};
		// batch promises with .and
		let next_promise = mpc_contract::ext(MPC_CONTRACT_ACCOUNT_ID.parse().unwrap())
			.with_static_gas(GAS)
			.with_attached_deposit(ONE_YOCTO)
			.sign(request);
```

Finally, we loop through each transaction, get the encoded payload, hash this payload and request a signature from the NEAR Chain Signatures MPC contract.

```rust
		promise = promise.then(next_promise);
	}

	promise
}
```

This cross contract call returns a Promise. We chain this Promise to the previous Promise and finally return the whole Promise chain.

**NOTE:** currently you can only call the NEAR Chain Signatures MPC contract once because the minimum gas for this call is 250 Tgas, out of a total NEAR TX gas limit of 300 Tgas.
