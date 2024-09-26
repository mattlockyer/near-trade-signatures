import {
    defaultEvmTx,
    getEvmAccount,
    getMaxFeePerGas,
    completeEvmTx,
} from './evm';
import { defaultNearTx, getNearAccount, completeNearTx } from './near';

export const transactions = {
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

            // update the default tx with current info e.g. nonce and keys
            const tx = JSON.parse(JSON.stringify(defaultNearTx));
            tx.transactions[0].signer_id = accountId;
            tx.transactions[0].receiver_id = accountId;
            tx.transactions[0].signer_public_key = nearSecpPublicKey;
            // WARNING nonce must be below Number.MAX_SAFE_INTEGER
            tx.transactions[0].nonce = Number(nonce + BigInt(1));
            tx.transactions[0].block_hash = block_hash;

            return tx;
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
