// Find all our documentation at https://docs.near.org
use hex::decode;
use near_sdk::{env, ext_contract, near, require, Gas, NearToken, Promise};

use bitcoin::secp256k1;
use bitcoin::sign_message::{signed_msg_hash, MessageSignature};
use bitcoin::{Address, CompressedPublicKey, Network};
use bitcoin_hashes::sha256d::Hash;

const PUBLIC_RLP_ENCODED_METHOD_NAMES: [&'static str; 1] = ["6a627842000000000000000000000000"];
const MPC_CONTRACT_ACCOUNT_ID: &str = "v2.multichain-mpc.testnet";
const COST: NearToken = NearToken::from_near(1);

const ADDRESS: &str = "bc1q358gyrc8rf7nknq7nfwxl23mut5sesmx7djz50";
const MSG: &str = "transactions:[{receiver_id:'testnet',actions:[{type:'FunctionCall',method_name:'create_account',args:obj2hex({new_account_id:'meowmeow-85739302.testnet',new_public_key:publicKey,}),amount:parseNearAmount('0.02'),gas:'100000000000000',},]}]";
const SIG: &str =
    "HyHq2/iCgg1LjGyUgKCjuWAI7pkPd7G/rSpVNUoNyEBSFY09LsH6b/oGiYmF1QUYIgoRT2HEosz4N3YqS07QXhs=";

fn main() {
    let signature: MessageSignature = MessageSignature::from_base64(SIG).unwrap();
    println!("signature: {:?}", signature);

    let msg_hash: Hash = signed_msg_hash(MSG);
    println!("msg_hash: {:?}", msg_hash);
    let secp_ctx = secp256k1::Secp256k1::new();

    let pubkey: CompressedPublicKey = signature
        .recover_pubkey(&secp_ctx, msg_hash)
        .unwrap()
        .try_into()
        .unwrap();

    let p2wpkh = Address::p2wpkh(&pubkey, Network::Bitcoin);
    println!("p2wpkh: {:?}", p2wpkh);

    println!("match: {}", ADDRESS == format!("{}", p2wpkh));
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
        main();

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
