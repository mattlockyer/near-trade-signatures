

use crate::*;

const PUBLIC_KEY: &str = "e506b36ec8ae9f3f4ff55eb2a41d1bb5db3fb447a1332943a27e51a3fb07108b";
const BITCOIN_SIGNED_MSG_PREFIX: &[u8] = b"Bitcoin Signed Message:\n";
const MSG: &str = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec nec volutpat orci. Duis viverra tortor sed mi venenatis sagittis. Quisque ultricies ex sed odio malesuada, a viverra tortor volutpat. Suspendisse et risus et tellus fermentum sollicitudin duis.";
const SIG: &str =
    "HzKPDWLnjzitKPbmYKMRCdNZQwjuVJJTIsMzJrhy5fleQHbtfTKQGH/tMaoe1nXwEfMXiJV6WnpafFsUX0ftZ4k=";

// ecrecover stuff
fn owner() {
    let mut msg: Vec<u8> = vec!();
    msg.push(BITCOIN_SIGNED_MSG_PREFIX.len() as u8);
    msg.append(&mut BITCOIN_SIGNED_MSG_PREFIX.to_vec());

	// TODO handle variable encoding size: https://en.bitcoin.it/wiki/Protocol_documentation#Variable_length_integer
	let msg_size_bytes = (MSG.len() as u16).to_le_bytes();
    println!("msg_size_bytes {:?}", msg_size_bytes.to_vec());
	msg.push(253);
    msg.append(&mut msg_size_bytes.to_vec());
    msg.append(&mut MSG.as_bytes().to_vec());
    
    let hash = env::sha256(&msg);
    let msg_hash = env::sha256(&hash);

	let sig_bytes = BASE64_STANDARD.decode(&mut SIG.as_bytes()).unwrap();
	let sig = sig_bytes.as_slice()[1..].to_vec();
	let mal_flag = sig_bytes.as_slice()[0] - 31;
    println!("mal_flag {:?}", mal_flag);

    let pk_bytes = decode(PUBLIC_KEY).unwrap();
    println!("pk_bytes {:?}", pk_bytes);

    let mut recovered = env::ecrecover(&msg_hash, &sig, 0, true).unwrap().to_vec();
    recovered.truncate(32);
    println!("recovered {:?}", recovered);

}

// debugging: cargo test -- --nocapture

#[test]
fn test_owner() {
	owner();
}
