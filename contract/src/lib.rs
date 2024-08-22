use external::{mpc_contract, SignRequest};
use hex::decode;
use near_sdk::borsh::{self, BorshSerialize};
use near_sdk::env::sha256;
use near_sdk::json_types::U128;
use near_sdk::serde_json::{from_str, Value};
use near_sdk::{env, log, near, require, AccountId, Gas, NearToken, Promise};
use std::str::Chars;

const MPC_CONTRACT_ACCOUNT_ID: &str = "v1.signer-dev.testnet";
const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);
const GAS: Gas = Gas::from_tgas(250);

mod external;
mod owner;
mod parse;
mod primitives;

// automatically init the contract
impl Default for Contract {
    fn default() -> Self {
        Self {}
    }
}

#[near(contract_state)]
pub struct Contract {}

#[near]
impl Contract {
    pub fn test_call(&mut self, pk: String, msg: String, sig: String) -> Promise {
        log!("gas paid {:?}", env::prepaid_gas());
        owner::require_btc_owner(&pk, &msg, &sig);
        let data_value: Value = from_str(&msg).unwrap();
        let transactions = parse::get_transactions(&data_value["transactions"]);
        let mut promise = Promise::new(env::current_account_id());

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
            log!("request {:?}", request);
            // batch promises with .and
            let next_promise = mpc_contract::ext(MPC_CONTRACT_ACCOUNT_ID.parse().unwrap())
                .with_static_gas(GAS)
                .with_attached_deposit(ONE_YOCTO)
                .sign(request);

            promise = promise.then(next_promise);
        }

        // return all promise calls
        promise
    }
}
