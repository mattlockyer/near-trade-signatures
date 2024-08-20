use hex::decode;
use near_crypto::PublicKey;
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

#[derive(BorshSerialize)]
pub struct SignRequest {
    pub payload: [u8; 32],
    pub path: String,
    pub key_version: u32,
}
#[derive(BorshSerialize)]
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
        owner::require_btc_owner(&pk, &msg, &sig);

        let data_value: Value = from_str(&msg).unwrap();
        let transactions = parse::get_transactions(&data_value["transactions"]);
        let mut payloads: Vec<Vec<u8>> = vec![];
        let mut promise = Promise::new(env::current_account_id());

        for transaction in transactions {
            let encoded =
                borsh::to_vec(&transaction).expect("failed to serialize NEAR transaction");
            let payload = sha256(&encoded);
            payloads.push(payload);
        }

        for payload in payloads {
            // call mpc sign and return promise
            let request = Request {
                request: SignRequest {
                    payload: parse::vec_to_fixed(payload),
                    path: "bitcoin,1".to_string(),
                    key_version: 0,
                },
            };
            let args = borsh::to_vec(&request).expect("failred to serialize args");
            let next_promise = Promise::new(MPC_CONTRACT_ACCOUNT_ID.parse().unwrap())
                .function_call("sign".to_owned(), args, ONE_YOCTO, GAS);

            promise = promise.and(next_promise);
        }

        promise
    }
}
