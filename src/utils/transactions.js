import { defaultEvmTx, getEthereumAccount } from './ethereum';
import { defaultNearTx, getNearAccount, completeNearTx } from './near';

export const transactions = {
    evm: {
        getTransaction: async ({ path, updateOverlay }) => {
            const { nonce } = await getEthereumAccount(path, updateOverlay);

            // update the default tx with current info e.g. nonce
            const tx = JSON.parse(JSON.stringify(defaultEvmTx));
            tx.nonce = nonce + 1;

            return tx;
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
        completeTx: async ({ methodName, args, updateOverlay, jsonTx }) => {
            completeNearTx({ methodName, args, updateOverlay, jsonTx });
        },
    },
};
