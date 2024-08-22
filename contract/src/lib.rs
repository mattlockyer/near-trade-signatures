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

mod owner;
mod parse;
mod primitives;

#[derive(Debug, BorshSerialize)]
pub struct SignRequest {
    pub payload: [u8; 32],
    pub path: String,
    pub key_version: u32,
}
#[derive(Debug, BorshSerialize)]
pub struct Request {
    pub request: SignRequest,
}

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
            let request = Request {
                request: SignRequest {
                    payload: parse::vec_to_fixed(payload),
                    path: pk.clone(),
                    key_version: 0,
                },
            };
            log!("request {:?}", request);
            let args = borsh::to_vec(&request).expect("failed to serialize args");
            // batch promises with .and
            let next_promise = Promise::new(MPC_CONTRACT_ACCOUNT_ID.parse().unwrap())
                .function_call("sign".to_owned(), args, ONE_YOCTO, GAS);
            promise = promise.then(next_promise);
        }

        // return all promise calls
        promise
    }
}
