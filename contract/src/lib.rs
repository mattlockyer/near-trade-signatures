use hex::{decode, encode};
use near_sdk::{
    env,
    env::{keccak256, sha256},
    log, near, require, Gas, NearToken, Promise,
};

mod bitcoin_owner;
mod ecdsa;
mod evm_owner;
mod evm_tx;
mod external;
mod near_tx;
mod utils;

const MPC_CONTRACT_ACCOUNT_ID: &str = "v1.signer-dev.testnet";
const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);
const GAS: Gas = Gas::from_tgas(250);

impl Default for Contract {
    fn default() -> Self {
        Self {}
    }
}

#[near(contract_state)]
pub struct Contract {}

#[near]
impl Contract {
    // to near
    pub fn bitcoin_to_near(&mut self, pk: String, msg: String, sig: String) -> Promise {
        bitcoin_owner::require(&pk, &msg, &sig);
        /*
        Logic would go here if building a protocol
        e.g. taking a fee by adding an action or additional NEAR TX to the msg
        see near_tx.rs for how to parse the msg into a NearTransaction
        simple to add an additional NearTransaction to the array and then request 2 signatures from MPC
        both signatures are returned to the client that can broadcast both transactions from the derived chain signature account
        NOTE: same approach for NEAR TXs can be used for Ethereum or Bitcoin TXs needed to satisfy protocol
        */
        near_tx::get_near_sigs(pk, msg)
    }

    pub fn ethereum_to_near(&mut self, address: String, msg: String, sig: String) -> Promise {
        evm_owner::require(&address, &msg, &sig);
        near_tx::get_near_sigs(address, msg)
    }

    // to evm
    pub fn bitcoin_to_evm(&mut self, pk: String, msg: String, sig: String) -> Promise {
        bitcoin_owner::require(&pk, &msg, &sig);
        evm_tx::get_evm_sig(pk, msg)
    }

    pub fn evm_to_evm(&mut self, address: String, msg: String, sig: String) -> Promise {
        evm_owner::require(&address, &msg, &sig);
        evm_tx::get_evm_sig(address, msg)
    }
}
