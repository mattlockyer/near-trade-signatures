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

export const broadcast = async ({ pk, msg, sig }) => {
    const account = new Account(near.connection, accountId);
    const res = await account.functionCall({
        contractId,
        methodName: 'test',
        args: { pk, msg, sig },
    });
    console.log(res);
};
