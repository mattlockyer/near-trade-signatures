
// Find all our documentation at https://docs.near.org
use hex::decode;
use near_sdk::{env, ext_contract, near, require, base64::prelude::*, Gas, NearToken, Promise};

const PUBLIC_RLP_ENCODED_METHOD_NAMES: [&'static str; 1] = ["6a627842000000000000000000000000"];
const MPC_CONTRACT_ACCOUNT_ID: &str = "v2.multichain-mpc.testnet";
const COST: NearToken = NearToken::from_near(1);

const PUBLIC_KEY: &str = "e506b36ec8ae9f3f4ff55eb2a41d1bb5db3fb447a1332943a27e51a3fb07108b";
const ADDRESS: &str = "bc1psgwpsrezcst8wrem7v0xxtrc4mr35jv05qkdujkhv5ksch8pr7hs7mn7sx";
const BITCOIN_SIGNED_MSG_PREFIX: &[u8] = b"Bitcoin Signed Message:\n";
const MSG: &str = "test";
const SIG: &str =
    "IKGHFEiQSVWXP8B8Cc6oEAZO6xeHzp8Q1q6fB9HnxbCOOYz9qmZbHTCBGhC33ZMPPhMaaAhow9WeU+qC9WbQAOk=";

// ecrecover stuff




#[test] 
pub fn main() {
    let mut msg: Vec<u8> = vec!();
    msg.push(BITCOIN_SIGNED_MSG_PREFIX.len() as u8);
    msg.append(&mut BITCOIN_SIGNED_MSG_PREFIX.to_vec());
    msg.push(MSG.len() as u8);
    msg.append(&mut MSG.as_bytes().to_vec());
    
    let hash = env::sha256(&msg);
    let msg_hash = env::sha256(&hash);
        let sig_bytes = BASE64_STANDARD.decode(&mut SIG.as_bytes()).unwrap().as_slice()[1..].to_vec();
    // println!("sig_bytes {:?}", sig_bytes);
    let pk_bytes = decode(PUBLIC_KEY).unwrap();
    println!("pk_bytes {:?}", pk_bytes);

    let mut recovered = env::ecrecover(&msg_hash, &sig_bytes, 1, true).unwrap().to_vec();
    recovered.truncate(32);
    println!("recovered {:?}", recovered);

}



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
    // proxy to call MPC_CONTRACT_ACCOUNT_ID method sign if COST is deposited
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
