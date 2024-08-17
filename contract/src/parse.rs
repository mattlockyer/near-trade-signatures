use near_sdk::serde_json::{from_str, Value};

pub fn get_transactions(data: &str) -> Value {
    // Parse the string of data into serde_json::Value.
    let v: Value = from_str(data).unwrap();
    v["transactions"].clone()
}

pub fn get_string(value: &Value) -> String {
    let str: String = value.to_string();
    let mut chars = str.chars();
    chars.next();
    chars.next_back();
    chars.as_str().to_string()
}

pub fn get_u128(value: &Value) -> u128 {
    let str: String = value.to_string();
    let mut chars = str.chars();
    chars.next();
    chars.next_back();
    chars.as_str().to_string().parse::<u128>().unwrap()
}

#[test]
fn test_parse() {
    let data = r#"
{
    "transactions": [
        {
            "receiver_id": "magical-part.testnet",
            "actions": [
                { "type": "Transfer", "amount": "1", "gas": "100000000000000" }
            ]
        },
        {
            "receiver_id": "magical-part.testnet",
            "actions": [
                { "type": "Transfer", "amount": "1", "gas": "100000000000000" }
            ]
        }
    ]
}
    "#;

    let transactions: Value = get_transactions(data);

    println!("transaction[0]: {}", transactions)
}
