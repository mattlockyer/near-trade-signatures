use external::{mpc_contract, SignRequest};
use hex::decode;
use near_sdk::borsh::{self, BorshSerialize};
use near_sdk::env::sha256;
use near_sdk::json_types::U128;
use near_sdk::serde_json::{from_str, Value};
use near_sdk::{env, log, near, require, AccountId, Gas, NearToken, Promise, PromiseError};
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
            // batch promises with .and
            let next_promise = mpc_contract::ext(MPC_CONTRACT_ACCOUNT_ID.parse().unwrap())
                .with_static_gas(GAS)
                .with_attached_deposit(ONE_YOCTO)
                .sign(request);

            promise = promise.then(next_promise);
        }

        // return all promise calls
        return promise.then(
            // Create a promise to callback query_greeting_callback
            Self::ext(env::current_account_id())
                .with_static_gas(Gas::from_tgas(5))
                .test_call_callback(),
        );
    }

    #[private]
    pub fn test_call_callback(
        &self,
        #[callback_result] call_result: Result<Value, PromiseError>,
    ) -> String {
        if call_result.is_err() {
            log!("There was an error in the callback");
            return "".to_string();
        }

        let result: Value = call_result.unwrap();

        let big_r: String = parse::get_string(&result["big_r"]["affine_point"]);
        log!("big_r: {:?}", big_r);
        let s: String = parse::get_string(&result["s"]["scalar"]);
        log!("s: {:?}", s);
        let recovery_id: u8 = result["recovery_id"].as_u64().unwrap() as u8;
        log!("recovery_id: {:?}", recovery_id);

        return "success".to_string();
    }
}
