import { getBitcoinAccount, defaultBitcoinTx, constructPsbt } from './bitcoin';
import {
    defaultEvmTx,
    getEvmAccount,
    getMaxFeePerGas,
    completeEvmTx,
} from './evm';
import {
    defaultNearTx,
    getNearAccount,
    completeNearTx,
    getNearBalance,
} from './near';

export const transactions = {
    bitcoin: {
        getTransaction: async ({ path, updateOverlay }) => {
            const { address, publicKey } = await getBitcoinAccount(
                path,
                updateOverlay,
            );

            console.log(address);
            console.log(publicKey);

            const psbt = await constructPsbt(
                address,
                address,
                defaultBitcoinTx.value,
            );
            console.log('psbt', psbt);

            console.log(
                Buffer.from(psbt.data.inputs[0].nonWitnessUtxo).toString('hex'),
            );

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
                        script_pubkey: Buffer.from(outs[0].script).toString(
                            'hex',
                        ),
                    },
                    {
                        value: outs[1].value,
                        script_pubkey: Buffer.from(outs[1].script).toString(
                            'hex',
                        ),
                    },
                ],
            };

            console.log('transaction json', JSON.stringify(tx));

            const keyPair = {
                publicKey: Buffer.from(publicKey, 'hex'),
                sign: async (transactionHash) => {
                    console.log(
                        'transaction hash',
                        Buffer.from(transactionHash).toString('hex'),
                    );
                },
            };

            await psbt.signInputAsync(0, keyPair);
        },
    },
    evm: {
        getTransaction: async ({ path, updateOverlay }) => {
            const { address, balance, nonce } = await getEvmAccount(
                path,
                updateOverlay,
            );

            // update the default tx with current info e.g. nonce
            const tx = JSON.parse(JSON.stringify(defaultEvmTx));

            tx.nonce = nonce.toString();
            tx.maxFeePerGas = await getMaxFeePerGas();

            return { derivedAddress: address, balance, tx };
        },
        completeTx: async ({ source, args, updateOverlay, jsonTx }) => {
            completeEvmTx({
                methodName: source + '_to_evm',
                args,
                updateOverlay,
                jsonTx,
            });
        },
    },
    near: {
        getTransaction: async ({ path, updateOverlay }) => {
            const { nonce, block_hash, accountId, nearSecpPublicKey } =
                await getNearAccount(path, updateOverlay);

            const balance = await getNearBalance({ accountId });

            // update the default tx with current info e.g. nonce and keys
            const tx = JSON.parse(JSON.stringify(defaultNearTx));
            tx.transactions[0].signer_id = accountId;
            tx.transactions[0].receiver_id = accountId;
            tx.transactions[0].signer_public_key = nearSecpPublicKey;
            // WARNING nonce must be below Number.MAX_SAFE_INTEGER
            tx.transactions[0].nonce = Number(nonce + BigInt(1));
            tx.transactions[0].block_hash = block_hash;

            return { derivedAddress: accountId, balance, tx };
        },
        completeTx: async ({ source, args, updateOverlay, jsonTx }) => {
            completeNearTx({
                methodName: source + '_to_near',
                args,
                updateOverlay,
                jsonTx,
            });
        },
    },
};
