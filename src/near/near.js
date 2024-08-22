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

    // const res = await account.functionCall({
    //     contractId: 'v1.signer-dev.testnet',
    //     methodName: 'sign',
    //     args: {
    //         request: {
    //             payload: Array.from({ length: 32 }, () =>
    //                 Math.floor(Math.random() * 255),
    //             ),
    //             path: 'bitcoin,1',
    //             key_version: 0,
    //         },
    //     },
    //     attachedDeposit: 1,
    //     gas: 250000000000000,
    // });
    // console.log(res);

    const res = await account.functionCall({
        contractId,
        methodName: 'test_call',
        args: { pk, msg, sig },
        gas: BigInt('300000000000000'),
    });
    console.log(res);
};

export const broadcast = async ({ pk, msg, sig }) => {
    const account = new Account(near.connection, accountId);
    const res = await account.functionCall({
        contractId,
        methodName: 'test',
        args: { pk, msg, sig },
    });
    console.log(res);
};
