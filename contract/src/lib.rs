use hex::{decode, encode};
use near_sdk::{env, log, near, require, Promise};

mod bitcoin_owner;
mod ethereum_owner;
mod external;
mod near_tx;
mod utils;

impl Default for Contract {
    fn default() -> Self {
        Self {}
    }
}

#[near(contract_state)]
pub struct Contract {}

#[near]
impl Contract {
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
        near_tx::get_near_sig(pk, msg)
    }
    pub fn ethereum_to_near(&mut self, address: String, msg: String, sig: String) -> Promise {
        ethereum_owner::require(&address, &msg, &sig);
        // see comment in bitcoin_to_near
        near_tx::get_near_sig(address, msg)
    }
}
