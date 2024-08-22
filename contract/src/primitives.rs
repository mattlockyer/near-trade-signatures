use crate::*;
use near_sdk::serde::{Deserialize, Deserializer};
use parse::vec_to_fixed;
use serde_big_array::BigArray;
use std::io::{Error, Write}; // 1.0.94

extern crate serde;

pub const ED25519_PUBLIC_KEY_LENGTH: usize = 32;
pub const SECP256K1_PUBLIC_KEY_LENGTH: usize = 64;

#[derive(Debug, Deserialize, BorshSerialize)]
pub enum Action {
    Transfer(TransferAction),
    AddKey(Box<AddKeyAction>),
    DeleteKey(Box<DeleteKeyAction>),
}
#[derive(Debug, Deserialize, BorshSerialize)]
pub enum AccessKeyPermission {
    FullAccess,
}
#[derive(Debug, Deserialize, BorshSerialize)]
pub struct AccessKey {
    pub nonce: u64,
    pub permission: AccessKeyPermission,
}
#[derive(Debug, Deserialize, BorshSerialize)]
pub struct AddKeyAction {
    /// A public key which will be associated with an access_key
    pub public_key: PublicKey,
    /// An access key with the permission
    pub access_key: AccessKey,
}
#[derive(Debug, Deserialize, BorshSerialize)]
pub struct DeleteKeyAction {
    /// A public key associated with the access_key to be deleted.
    pub public_key: PublicKey,
}
#[derive(Debug, Deserialize, BorshSerialize)]
pub struct TransferAction {
    pub deposit: U128,
}

#[derive(Debug, BorshSerialize, Deserialize)]
pub struct Transaction {
    /// An account on which behalf transaction is signed
    pub signer_id: AccountId,
    /// A public key of the access key which was used to sign an account.
    /// Access key holds permissions for calling certain kinds of actions.
    pub public_key: PublicKey,
    /// Nonce is used to determine order of transaction in the pool.
    /// It increments for a combination of `signer_id` and `public_key`
    pub nonce: u64,
    /// Receiver account for this transaction
    pub receiver_id: AccountId,
    /// The hash of the block in the blockchain on top of which the given transaction is valid
    pub block_hash: Vec<u8>,
    /// A list of actions to be applied
    pub actions: Vec<Action>,
}

// Public Key

#[derive(Debug, Clone, Eq, Ord, PartialEq, PartialOrd, Deserialize)]
pub struct Secp256K1PublicKey(#[serde(with = "BigArray")] pub [u8; SECP256K1_PUBLIC_KEY_LENGTH]);

#[derive(Debug, Clone, Eq, Ord, PartialEq, PartialOrd, Deserialize)]
pub struct ED25519PublicKey(pub [u8; ED25519_PUBLIC_KEY_LENGTH]);

#[derive(Debug, Clone, PartialEq, PartialOrd, Ord, Eq)]
pub enum PublicKey {
    ED25519(ED25519PublicKey),
    SECP256K1(Secp256K1PublicKey),
}

fn split_key_type_data(value: &str) -> (&str, &str) {
    value.split_once(':').unwrap()
}

impl<'de> Deserialize<'de> for PublicKey {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let str: &str = Deserialize::deserialize(deserializer)?;
        let (key_type, key_data) = split_key_type_data(&str);
        Ok(match key_type {
            "ed25519" => PublicKey::ED25519(ED25519PublicKey(vec_to_fixed(
                bs58::decode(key_data).into_vec().unwrap(),
            ))),
            "secp256k1" => PublicKey::SECP256K1(Secp256K1PublicKey(vec_to_fixed(
                bs58::decode(key_data).into_vec().unwrap(),
            ))),
            _ => PublicKey::ED25519(ED25519PublicKey(vec_to_fixed(
                bs58::decode(key_data).into_vec().unwrap(),
            ))),
        })
    }
}

impl BorshSerialize for PublicKey {
    fn serialize<W: Write>(&self, writer: &mut W) -> Result<(), Error> {
        match self {
            Self::ED25519(public_key) => {
                BorshSerialize::serialize(&0u8, writer)?;
                writer.write_all(&public_key.0)?;
            }
            Self::SECP256K1(public_key) => {
                BorshSerialize::serialize(&1u8, writer)?;
                writer.write_all(&public_key.0)?;
            }
        }
        Ok(())
    }
}

impl From<[u8; 64]> for Secp256K1PublicKey {
    fn from(data: [u8; 64]) -> Self {
        Self(data)
    }
}
