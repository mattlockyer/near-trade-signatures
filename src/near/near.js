import * as nearAPI from 'near-api-js';
const { Near, Account, KeyPair, keyStores } = nearAPI;

const { REACT_APP_secretKey, REACT_APP_accountId, REACT_APP_contractId } =
    process.env;

const secretKey = REACT_APP_secretKey;
const accountId = REACT_APP_accountId;
const contractId = REACT_APP_contractId;

const networkId = 'testnet';
const keyPair = KeyPair.fromString(secretKey);
const keyStore = new keyStores.InMemoryKeyStore();
keyStore.setKey(networkId, accountId, keyPair);
const config = {
    networkId,
    keyStore,
    nodeUrl: 'https://rpc.testnet.near.org',
    walletUrl: 'https://testnet.mynearwallet.com/',
    helperUrl: 'https://helper.testnet.near.org',
    explorerUrl: 'https://testnet.nearblocks.io',
};
const near = new Near(config);
const { provider } = near.connection;

export const addKey = async ({ accountId, secretKey, publicKey }) => {
    const keyPair = KeyPair.fromString(secretKey);
    keyStore.setKey(networkId, accountId, keyPair);
    const account = new Account(near.connection, accountId);
    const res = await account.addKey(publicKey);
    console.log('addKey res', res);
};

export const getBlockHash = async () => {
    const block = await near.connection.provider.block({ finality: 'final' });
    return block.header.hash;
};

export const getKeys = async ({ accountId }) => {
    const account = new Account(near.connection, accountId);
    return await account.getAccessKeys();
};

export const mpcPublicKey = async () => {
    const account = new Account(near.connection, accountId);
    const res = await account.viewFunction({
        contractId: 'v1.signer-dev.testnet',
        methodName: 'public_key',
        args: {},
    });
    return res;
};

export const view = async ({ pk, msg, sig }) => {
    const account = new Account(near.connection, accountId);
    const res = await account.viewFunction({
        contractId,
        methodName: 'test_view',
        args: { pk, msg, sig },
    });
    console.log(res);
};

export const call = async ({ pk, msg, sig }) => {
    const account = new Account(near.connection, accountId);
    const res = await account.functionCall({
        contractId,
        methodName: 'test_call',
        args: { pk, msg, sig },
        gas: BigInt('300000000000000'),
    });
    return res;
};

export const buildTransactions = async ({ msg, sig }) => {
    const account = new Account(near.connection, accountId);
    const res = await account.viewFunction({
        contractId,
        methodName: 'build_transactions',
        args: { msg, sig },
    });
    return res;
};

export const broadcast = async (signedSerializedTx) => {
    const res = await provider.sendJsonRpc('broadcast_tx_commit', [
        Buffer.from(signedSerializedTx).toString('base64'),
    ]);
    return res;
};

// transaction fix for JSON for contracts, to JS

const { PublicKey } = nearAPI.utils;
const { base_decode } = nearAPI.utils.serialize;

const core2jsKeys = {
    signer_id: 'signerId',
    public_key: 'publicKey',
    receiver_id: 'receiverId',
    nonce: 'nonce',
    block_hash: 'blockHash',
    actions: 'actions',
};
const core2jsActions = {
    AddKey: 'addKey',
    Transfer: 'transfer',
};
export const core2jsTransaction = async (transaction) => {
    Object.entries(core2jsKeys).forEach(([k, v]) => {
        transaction[v] = transaction[k];
        if (v !== k) delete transaction[k];
        // pre-serialize types from json
        if (v === 'publicKey' && typeof transaction[v] === 'string') {
            transaction[v] = PublicKey.fromString(transaction[v]);
        }
        if (v === 'blockHash') {
            transaction[v] = base_decode(transaction[v]);
        }

        if (v === 'actions') {
            for (const action of transaction[v]) {
                const [k2] = Object.entries(action)[0];
                Object.entries(core2jsActions).forEach(([k, v]) => {
                    if (k !== k2) return;
                    action[v] = action[k];
                    delete action[k];
                    if (v === 'addKey') {
                        action[v] = {
                            publicKey: PublicKey.fromString(
                                action[v].public_key,
                            ),
                            accessKey: {
                                nonce: 0,
                                permission: {
                                    fullAccess: {},
                                },
                            },
                        };
                    }
                });
            }
        }
    });
    return transaction;
};
