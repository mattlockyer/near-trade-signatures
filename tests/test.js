import test from 'ava';
import * as dotenv from 'dotenv';
dotenv.config();
import * as nearAPI from 'near-api-js';
const { Near, Account, KeyPair, keyStores } = nearAPI;

// near config for all tests
const {
    REACT_APP_accountId: accountId,
    REACT_APP_secretKey: secretKey,
    REACT_APP_contractId: contractId,
} = process.env;
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

// tests

test('account and balance test', async (t) => {
    const account = new Account(near.connection, accountId);
    const balance = await account.getAccountBalance();
    console.log(balance);
    t.pass();
});

test('call contract test', async (t) => {
    let pk = 'e506b36ec8ae9f3f4ff55eb2a41d1bb5db3fb447a1332943a27e51a3fb07108b';
    let msg =
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec nec volutpat orci. Duis viverra tortor sed mi venenatis sagittis. Quisque ultricies ex sed odio malesuada, a viverra tortor volutpat. Suspendisse et risus et tellus fermentum sollicitudin duis.';
    let sig =
        'HzKPDWLnjzitKPbmYKMRCdNZQwjuVJJTIsMzJrhy5fleQHbtfTKQGH/tMaoe1nXwEfMXiJV6WnpafFsUX0ftZ4k=';

    const account = new Account(near.connection, accountId);
    const res = await account.functionCall({
        contractId,
        methodName: 'test',
        args: { pk, msg, sig },
    });
    console.log(res);
    t.pass();
});
