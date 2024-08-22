use near_sdk::ext_contract;
use near_sdk::serde::Serialize;

#[derive(Debug, Serialize)]
pub struct SignRequest {
    pub payload: [u8; 32],
    pub path: String,
    pub key_version: u32,
}

// Validator interface, for cross-contract calls
#[ext_contract(mpc_contract)]
trait MPCContract {
    fn sign(&self, request: SignRequest);
}
