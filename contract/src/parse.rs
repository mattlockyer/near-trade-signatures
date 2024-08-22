use crate::*;
use primitives::Transaction;

pub fn get_chars(str: &str) -> Chars {
    let first = str[0..1].to_owned();
    let mut chars = str.chars();
    // client side json escapes double quotes
    if first == "\"" {
        chars.next();
        chars.next_back();
    }
    chars
}

pub fn get_string(value: &Value) -> String {
    let str: String = value.to_string();
    let chars = get_chars(&str);
    chars.as_str().to_string()
}

pub fn vec_to_fixed<T, const N: usize>(v: Vec<T>) -> [T; N] {
    v.try_into()
        .unwrap_or_else(|v: Vec<T>| panic!("Expected a Vec of length {} but it was {}", N, v.len()))
}

pub fn get_transactions(data: &Value) -> Vec<Transaction> {
    let mut transactions: Vec<Transaction> = vec![];
    let json_transactions: Vec<Value> = data.as_array().unwrap().to_vec();

    for jtx in json_transactions.iter() {
        let mut transaction = Transaction {
            signer_id: get_string(&jtx["signer_id"]).parse::<AccountId>().unwrap(),
            public_key: from_str(&jtx["public_key"].to_string()).unwrap(),
            nonce: jtx["nonce"].as_u64().unwrap(),
            receiver_id: get_string(&jtx["receiver_id"])
                .parse::<AccountId>()
                .unwrap(),
            block_hash: bs58::decode(&get_string(&jtx["block_hash"]))
                .into_vec()
                .unwrap(),
            actions: vec![],
        };

        let json_actions: Vec<Value> = jtx["actions"].as_array().unwrap().to_vec();

        // TODO test multiple actions per promise. With mut promise?
        for json_action in json_actions.iter() {
            transaction
                .actions
                .push(from_str(&json_action.to_string()).unwrap())
        }

        transactions.push(transaction);
    }

    transactions
}

#[test]
fn test_get_transactions() {
    let data = r#"
{
    "transactions": [
        {
            "signer_id": "forgetful-parent.testnet",
            "public_key": "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp",
            "nonce": 1,
            "receiver_id": "forgetful-parent.testnet",
            "block_hash": "4reLvkAWfqk5fsqio1KLudk46cqRz9erQdaHkWZKMJDZ",
            "actions": [
                { "Transfer": { "deposit": "1" } },
                {
                    "AddKey": {
                        "public_key": "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp",
                        "access_key": {
                            "nonce": 0,
                            "permission": "FullAccess"
                        }
                    }
                }
            ]
        },
        {
            "signer_id": "forgetful-parent.testnet",
            "public_key": "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp",
            "nonce": 1,
            "receiver_id": "forgetful-parent.testnet",
            "block_hash": "4reLvkAWfqk5fsqio1KLudk46cqRz9erQdaHkWZKMJDZ",
            "actions": [
                { "Transfer": { "deposit": "1" } },
                {
                    "DeleteKey": {
                        "public_key": "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"
                    }
                }
            ]
        }
    ]
}
    "#;

    let data_value: Value = from_str(data).unwrap();
    let transactions = get_transactions(&data_value["transactions"]);

    for transaction in transactions {
        let encoded = borsh::to_vec(&transaction).expect("failed to serialize NEAR transaction");
        let tx_hash = sha256(&encoded);

        log!("encoded tx: {:?}", encoded);
        log!("tx_hash: {:?}", tx_hash);
    }
}
