import { fetchJson } from './utils';
import { generateAddress } from './kdf';
import { tradeSignature } from './contract';
import * as bitcoinJs from 'bitcoinjs-lib';
import secp256k1 from 'secp256k1';

// faucet: https://coinfaucet.eu/en/btc-testnet/

const {
    REACT_APP_contractId: contractId,
    REACT_APP_mpcPublicKey: mpcPublicKey,
} = process.env;

// specific to UI

let hashToSign;

export const defaultBitcoinTx = {
    to: 'msVQwrAD9VgMwwAUrT29ACX2CrUBfW9G5g',
    value: '1',
};

export const getBitcoinAccount = async (path, updateOverlay) => {
    const { address, publicKey } = await generateAddress({
        publicKey: mpcPublicKey,
        accountId: contractId,
        path,
        chain: 'bitcoin',
    });
    return { address, publicKey };
};

export const getBitcoinTx = async ({ path, updateOverlay }) => {
    const { address, publicKey } = await getBitcoinAccount(path, updateOverlay);

    const { psbt, balance } = await constructPsbt(
        address,
        address,
        defaultBitcoinTx.value,
    );
    console.log('balance', balance);
    console.log('psbt', psbt);
    // console.log(
    //     Buffer.from(psbt.data.inputs[0].nonWitnessUtxo).toString('hex'),
    // );

    const { tx: unsignedTx } = psbt.data.globalMap.unsignedTx;
    const vin = unsignedTx.ins[0];
    const { outs } = unsignedTx;
    const tx = {
        version: 2,
        lock_time: 0,
        input: [
            {
                previous_output: {
                    txid: Buffer.from(vin.hash).toString('hex'),
                    vout: 0,
                },
                script_sig: [],
                sequence: vin.sequence,
                witness: [],
            },
        ],
        output: [
            {
                value: outs[0].value,
                script_pubkey: Buffer.from(outs[0].script).toString('hex'),
            },
            {
                value: outs[1].value,
                script_pubkey: Buffer.from(outs[1].script).toString('hex'),
            },
        ],
    };

    console.log('transaction json', JSON.stringify(tx));

    // stash the hash to sign, temporary solution until omni encodes psbt
    const keyPair = {
        publicKey: Buffer.from(publicKey, 'hex'),
        sign: async (transactionHash) => {
            hashToSign = Buffer.from(transactionHash).toString('hex');
            console.log(
                'transaction hash',
                Buffer.from(transactionHash).toString('hex'),
            );
            return Buffer.from(
                '0000000000000000000000000000000000000000000000000000000000000000',
            );
        },
    };
    await psbt.signInputAsync(0, keyPair);

    return { derivedAddress: address, balance, tx };
};

export const completeBitcoinTx = async ({ args, updateOverlay, jsonTx }) => {
    // special case for bitcoin, pass the hash directly through contract to MPC
    const res = await tradeSignature({
        ...args,
        hash: hashToSign,
    });

    console.log('MPC contract result', res);

    try {
    } catch (e) {
        console.log(e);
    }
};

// bitcoin helpers (generic)

export const constructPsbt = async (address, to, amount) => {
    const networkId = 'testnet';
    const bitcoinRpc = `https://blockstream.info/${
        networkId === 'testnet' ? 'testnet' : ''
    }/api`;

    if (!address) return console.log('must provide a sending address');

    const { getBalance } = bitcoin;
    const sats = parseInt(amount);

    // Get UTXOs
    const utxos = await getBalance({ address, getUtxos: true });
    if (!utxos || utxos.length === 0)
        throw new Error('No utxos detected for address: ', address);

    // Check balance (TODO include fee in check)
    if (utxos[0].value < sats) {
        return console.log('insufficient funds');
    }

    const psbt = new bitcoinJs.Psbt({
        network:
            networkId === 'testnet'
                ? bitcoinJs.networks.testnet
                : bitcoinJs.networks.bitcoin,
    });

    let totalInput = 0;

    await Promise.all(
        utxos.map(async (utxo) => {
            totalInput += utxo.value;

            const transaction = await fetchTransaction(utxo.txid);
            let inputOptions;

            const scriptHex =
                transaction.outs[utxo.vout].script.toString('hex');
            console.log(`UTXO script type: ${scriptHex}`);

            if (scriptHex.startsWith('76a914')) {
                console.log('legacy');
                const nonWitnessUtxo = await fetch(
                    `${bitcoinRpc}/tx/${utxo.txid}/hex`,
                ).then((result) => result.text());

                console.log('nonWitnessUtxo hex:', nonWitnessUtxo);
                // Legacy P2PKH input (non-SegWit)
                inputOptions = {
                    hash: utxo.txid,
                    index: utxo.vout,
                    nonWitnessUtxo: Buffer.from(nonWitnessUtxo, 'hex'), // Provide the full transaction hex
                    // sequence: 4294967295, // Enables RBF
                };
            } else if (scriptHex.startsWith('0014')) {
                console.log('segwit');

                inputOptions = {
                    hash: utxo.txid,
                    index: utxo.vout,
                    witnessUtxo: {
                        script: transaction.outs[utxo.vout].script,
                        value: utxo.value, // Amount in satoshis
                    },
                };
            } else if (
                scriptHex.startsWith('0020') ||
                scriptHex.startsWith('5120')
            ) {
                console.log('taproot');

                // Taproot (P2TR) input
                inputOptions = {
                    hash: utxo.txid,
                    index: utxo.vout,
                    witnessUtxo: {
                        script: transaction.outs[utxo.vout].script,
                        value: utxo.value,
                    },
                    tapInternalKey: 'taprootInternalPubKey', // Add your Taproot internal public key here
                };
            } else {
                throw new Error('Unknown script type');
            }

            // Add the input to the PSBT
            psbt.addInput(inputOptions);
        }),
    );

    // Add output to the recipient
    psbt.addOutput({
        address: to,
        value: sats,
    });

    // Calculate fee (replace with real fee estimation)
    const feeRate = await fetchJson(`${bitcoinRpc}/fee-estimates`);
    const estimatedSize = utxos.length * 148 + 2 * 34 + 10;
    const fee = estimatedSize * (feeRate[6] + 3);
    const change = totalInput - sats - fee;

    // Add change output if necessary
    if (change > 0) {
        psbt.addOutput({
            address: address,
            value: Math.floor(change),
        });
    }

    // Return the constructed PSBT and UTXOs for signing
    return { psbt, balance: utxos[0].value };
};

export const bitcoin = {
    name: 'Bitcoin Testnet',
    currency: 'sats',
    explorer: 'https://blockstream.info/testnet',
    getBalance: async ({ address, getUtxos = false }) => {
        const networkId = 'testnet';

        try {
            const res = await fetchJson(
                `https://blockstream.info${
                    networkId === 'testnet' ? '/testnet' : ''
                }/api/address/${address}/utxo`,
            );

            if (!res) return;

            let utxos = res.map((utxo) => ({
                txid: utxo.txid,
                vout: utxo.vout,
                value: utxo.value,
            }));

            let maxValue = 0;
            utxos.forEach((utxo) => {
                if (utxo.value > maxValue) maxValue = utxo.value;
            });
            utxos = utxos.filter((utxo) => utxo.value === maxValue);

            if (!utxos || !utxos.length) {
                console.log(
                    'no utxos for address',
                    address,
                    'please fund address and try again',
                );
            }

            return getUtxos ? utxos : maxValue;
        } catch (e) {
            console.log('e', e);
        }
    },
    getAndBroadcastSignature: async ({
        from: address,
        publicKey,
        to,
        amount,
        path,
    }) => {
        console.log('About to call getSignature...');
        const sig = await bitcoin.getSignature({
            from: address,
            publicKey,
            to,
            amount,
            path,
        });

        // Check if the signature was successfully generated
        if (!sig) {
            console.error('Failed to generate signature');
            return;
        }

        // @ts-ignore
        const broadcastResult = await bitcoin.broadcast({
            from: address,
            publicKey: publicKey,
            to,
            amount,
            path,
            sig,
        });

        return broadcastResult;
    },
    getSignature: async ({ from: address, publicKey, to, amount, path }) => {
        const result = await constructPsbt(address, to, amount);
        if (!result) return;
        const [utxos, psbt] = result;

        let signature;
        const keyPair = {
            publicKey: Buffer.from(publicKey, 'hex'),
            // sign: async (transactionHash) => {
            //   // const sighash = psbt.getHashForWitnessV0(index, script, value, bitcoinJs.Transaction.SIGHASH_ALL);

            //   const payload = Object.values(ethers.utils.arrayify(transactionHash));

            //   signature = await sign(payload, path);
            // },
            sign: async (transactionHash) => {
                const utxo = utxos[0]; // The UTXO being spent
                const value = utxo.value; // The value in satoshis of the UTXO being spent

                if (isNaN(value)) {
                    throw new Error(
                        `Invalid value for UTXO at index ${transactionHash}: ${utxo.value}`,
                    );
                }

                const payload = Object.values(
                    Buffer.from(transactionHash, 'hex'),
                );

                // Sign the payload using the external `sign` method (e.g., NEAR signature)
                signature = await sign(payload, path);
            },
        };

        try {
            // Sign each input manually
            await Promise.all(
                utxos.map(async (_, index) => {
                    try {
                        await psbt.signInputAsync(index, keyPair);
                        console.log(`Input ${index} signed successfully`);
                    } catch (e) {
                        console.warn(`Error signing input ${index}:`, e);
                    }
                }),
            );
        } catch (e) {
            console.error('Error signing inputs:', e);
        }

        console.log('Returning signature:', signature);
        return signature; // Return the generated signature
    },
    broadcast: async ({ from: address, publicKey, to, amount, path, sig }) => {
        const result = await constructPsbt(address, to, amount);
        if (!result) return;
        const [utxos, psbt, explorer] = result;

        const keyPair = {
            publicKey: Buffer.from(publicKey, 'hex'),
            sign: () => {
                const rHex = sig.big_r.affine_point.slice(2); // Remove the "03" prefix
                let sHex = sig.s.scalar;

                // Pad s if necessary
                if (sHex.length < 64) {
                    sHex = sHex.padStart(64, '0');
                }

                const rBuf = Buffer.from(rHex, 'hex');
                const sBuf = Buffer.from(sHex, 'hex');

                // Combine r and s
                const rawSignature = Buffer.concat([rBuf, sBuf]);

                return rawSignature;
            },
        };

        await Promise.all(
            utxos.map(async (_, index) => {
                console.log('utxo:', _);
                try {
                    await psbt.signInputAsync(index, keyPair);
                } catch (e) {
                    console.warn(e, 'not signed');
                }
            }),
        );

        try {
            psbt.finalizeAllInputs();
        } catch (e) {
            console.log('e', e);
        }

        const networkId = 'testnet';
        const bitcoinRpc = `https://blockstream.info/${
            networkId === 'testnet' ? 'testnet' : ''
        }/api`;

        // broadcast tx
        try {
            const res = await fetch(`https://corsproxy.io/?${bitcoinRpc}/tx`, {
                method: 'POST',
                body: psbt.extractTransaction().toHex(),
            });
            if (res.status === 200) {
                const hash = await res.text();
                console.log('tx hash', hash);
                console.log('explorer link', `${explorer}/tx/${hash}`);
                console.log(
                    'NOTE: it might take a minute for transaction to be included in mempool',
                );

                return hash;
            } else {
                return res;
            }
        } catch (e) {
            console.log('error broadcasting bitcoin tx', JSON.stringify(e));
        }
        return 'failed';
    },
};

async function fetchTransaction(transactionId) {
    const networkId = 'testnet';
    const bitcoinRpc = `https://blockstream.info/${
        networkId === 'testnet' ? 'testnet' : ''
    }/api`;

    const data = await fetchJson(`${bitcoinRpc}/tx/${transactionId}`);
    const tx = new bitcoinJs.Transaction();

    if (!data || !tx) throw new Error('Failed to fetch transaction');
    tx.version = data.version;
    tx.locktime = data.locktime;

    data.vin.forEach((vin) => {
        const txHash = Buffer.from(vin.txid, 'hex').reverse();
        const vout = vin.vout;
        const sequence = vin.sequence;
        const scriptSig = vin.scriptsig
            ? Buffer.from(vin.scriptsig, 'hex')
            : undefined;
        tx.addInput(txHash, vout, sequence, scriptSig);
    });

    data.vout.forEach((vout) => {
        const value = vout.value;
        const scriptPubKey = Buffer.from(vout.scriptpubkey, 'hex');
        tx.addOutput(scriptPubKey, value);
    });

    data.vin.forEach((vin, index) => {
        if (vin.witness && vin.witness.length > 0) {
            const witness = vin.witness.map((w) => Buffer.from(w, 'hex'));
            tx.setWitness(index, witness);
        }
    });

    return tx;
}

export const recoverPubkeyFromSignature = (transactionHash, rawSignature) => {
    let pubkeys = [];
    [0, 1].forEach((num) => {
        const recoveredPubkey = secp256k1.recover(
            transactionHash, // 32 byte hash of message
            rawSignature, // 64 byte signature of message (not DER, 32 byte R and 32 byte S with 0x00 padding)
            num, // number 1 or 0. This will usually be encoded in the base64 message signature
            false, // true if you want result to be compressed (33 bytes), false if you want it uncompressed (65 bytes) this also is usually encoded in the base64 signature
        );
        console.log('recoveredPubkey', recoveredPubkey);
        const buffer = Buffer.from(recoveredPubkey);
        // Convert the Buffer to a hexadecimal string
        const hexString = buffer.toString('hex');
        pubkeys.push(hexString);
    });
    return pubkeys;
};
