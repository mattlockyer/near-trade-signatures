use hex::decode;
use near_sdk::{
    env, ext_contract, log, near, require, serde_json::Value, AccountId, Gas, NearToken, Promise,
};
use parse::get_transactions;

const PUBLIC_RLP_ENCODED_METHOD_NAMES: [&'static str; 1] = ["6a627842000000000000000000000000"];
const MPC_CONTRACT_ACCOUNT_ID: &str = "v2.multichain-mpc.testnet";
const COST: NearToken = NearToken::from_near(1);

mod owner;
mod parse;

// interface for cross contract call to mpc contract
#[ext_contract(mpc)]
trait MPC {
    fn sign(&self, payload: [u8; 32], path: String, key_version: u32) -> Promise;
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
    // transfer Near if bitcoin signature is valid
    pub fn test_view(&self, pk: String, msg: String, sig: String) -> String {
        owner::require_btc_owner(&pk, &msg, &sig);

        let transactions: Vec<Value> = get_transactions(&msg).as_array().unwrap().to_vec();

        let mut receivers = "".to_string();
        for transaction in transactions.iter() {
            receivers.push_str(&transaction["receiver_id"].to_string())
        }

        receivers

        // let batch = Promise::new(env::current_account_id()).transfer(NearToken::from_yoctonear(1));

        // batch
    }

    pub fn test_call(&mut self, pk: String, msg: String, sig: String) -> Promise {
        owner::require_btc_owner(&pk, &msg, &sig);

        let mut promise = Promise::new(env::current_account_id());
        let transactions: Vec<Value> = get_transactions(&msg).as_array().unwrap().to_vec();

        log!("transactions {:?}", transactions);

        for transaction in transactions.iter() {
            let receiver_id = transaction["receiver_id"].to_string();
            let receiver_id_slice = parse::remove_first_and_last(&receiver_id);

            let mut next_promise = Promise::new(receiver_id_slice.parse::<AccountId>().unwrap());
            let actions: Vec<Value> = transaction["actions"].as_array().unwrap().to_vec();

            // TODO test multiple actions per promise. With mut promise?
            for action in actions.iter() {
                match action["type"].to_string().as_bytes() {
                    b"Transfer" => {
                        let amount = action["amount"].as_u64().unwrap() as u128;
                        next_promise = next_promise.transfer(NearToken::from_yoctonear(amount));
                    }
                    _ => {}
                }
            }

            promise = promise.then(next_promise);
        }

        promise
    }

    // DEPRECATED REFERENCE ONLY: proxy to call MPC_CONTRACT_ACCOUNT_ID method sign if COST is deposited
    #[payable]
    pub fn sign(&mut self, rlp_payload: String, path: String, key_version: u32) -> Promise {
        let owner = env::predecessor_account_id() == env::current_account_id();

        // check if rlp encoded eth transaction is calling a public method name
        let mut public = false;
        for n in PUBLIC_RLP_ENCODED_METHOD_NAMES {
            if rlp_payload.find(n).is_some() {
                public = true
            }
        }

        // only the Near contract owner can call sign of arbitrary payloads for chain signature accounts based on env::current_account_id()
        if !public {
            require!(
                owner,
                "only contract owner can sign arbitrary EVM transactions"
            );
        }

        // hash and reverse rlp encoded payload
        let payload: [u8; 32] = env::keccak256_array(&decode(rlp_payload).unwrap())
            .into_iter()
            .rev()
            .collect::<Vec<u8>>()
            .try_into()
            .unwrap();

        // check deposit requirement, contract owner doesn't pay
        let deposit = env::attached_deposit();
        if !owner {
            require!(deposit >= COST, "pay the piper");
        }

        // call mpc sign and return promise
        mpc::ext(MPC_CONTRACT_ACCOUNT_ID.parse().unwrap())
            .with_static_gas(Gas::from_tgas(100))
            .sign(payload, path, key_version)
    }
}
