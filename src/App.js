import { wrap } from './state/state';
import * as nearAPI from 'near-api-js';
const { PublicKey } = nearAPI.utils;
const { base_decode } = nearAPI.utils.serialize;
import {
    broadcast,
    call,
    buildTransactions,
    getKeys,
    getBlockHash,
} from './near/near';
import './styles/app.scss';
import { generateAddress } from './near/kdf';
const { REACT_APP_contractId } = process.env;
const MPC_PUBLIC_KEY =
    'secp256k1:54hU5wcCmVUPFWLDALXMh1fFToZsVXrx9BbTbHzSfQq1Kd1rJZi52iPa4QQxo6s5TgjWqgpY8HamYuUDzG6fAaUq';

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

const defaultMsg = {
    transactions: [
        {
            signer_id: 'forgetful-parent.testnet',
            public_key: 'ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp',
            nonce: 1,
            receiver_id: 'forgetful-parent.testnet',
            block_hash: '4reLvkAWfqk5fsqio1KLudk46cqRz9erQdaHkWZKMJDZ',
            actions: [
                { Transfer: { deposit: '1' } },
                {
                    AddKey: {
                        public_key:
                            'ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp',
                        access_key: {
                            nonce: 0,
                            permission: 'FullAccess',
                        },
                    },
                },
            ],
        },
        // {
        //     "signer_id": "forgetful-parent.testnet",
        //     "public_key": "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp",
        //     "nonce": 1,
        //     "receiver_id": "forgetful-parent.testnet",
        //     "block_hash": "4reLvkAWfqk5fsqio1KLudk46cqRz9erQdaHkWZKMJDZ",
        //     "actions": [
        //         { "Transfer": { "deposit": "1" } },
        //         {
        //             "DeleteKey": {
        //                 "public_key": "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"
        //             }
        //         }
        //     ]
        // }
    ],
};

const AppComp = ({ state, update }) => {
    const {
        msg,
        address,
        pk,
        sig,
        accountId,
        nearSecpPublicKey,
        nonce,
        blockHash,
    } = state;

    const step = (!!address && 1) + (!!sig && 1);

    switch (step) {
        case 2:
            return (
                <>
                    <h4>Broadcast Message</h4>
                    <button
                        onClick={async () => {
                            const res = await broadcast({ pk, msg, sig });
                            console.log(res);
                        }}
                    >
                        Broadcast
                    </button>
                </>
            );
        case 1:
            return (
                <>
                    <h4>Sign Message</h4>
                    <textarea
                        rows={16}
                        cols={60}
                        defaultValue={JSON.stringify(msg)}
                    ></textarea>
                    <br />
                    <button
                        onClick={async () => {
                            try {
                                const sig =
                                    await window.okxwallet.bitcoin.signMessage(
                                        JSON.stringify(msg),
                                        'ecdsa',
                                    );

                                // TESTING
                                // const res =
                                //     // {
                                //     //     status: {
                                //     //         SuccessValue:
                                //     //             'eyJiaWdfciI6eyJhZmZpbmVfcG9pbnQiOiIwMjcxMTI3QkNDMkNCQzFBM0JENEVDOTFBNEJFRTc3NTc2REI1QjhDNUU0MjREMjhCMUY3NEFFRjBCNTA2QkI4Q0UifSwicyI6eyJzY2FsYXIiOiIxMzIyRTQyNjc4ODhBRjMxNTNBMzVGRTU5Nzc3RDAxOTVDNjcyRjcyMTA2MTVEQjI1NDk2NzkyRDAwNjYzQ0M2In0sInJlY292ZXJ5X2lkIjowfQ==',
                                //     //     },
                                //     // } ||
                                //     await call({
                                //         pk,
                                //         msg: JSON.stringify(msg),
                                //         sig,
                                //     });

                                // const sigRes = JSON.parse(
                                //     Buffer.from(
                                //         res.status.SuccessValue,
                                //         'base64',
                                //     ).toString(),
                                // );
                                // console.log('sigRes', sigRes);

                                const signedSerializedTx =
                                    await buildTransactions({
                                        msg: JSON.stringify(msg),
                                        sig: `{"big_r":{"affine_point":"0282EF82B8EE5BA52EC356F7BBEE935B70A67D635F7F8D887FFDC70D2D943088FC"},"s":{"scalar":"6062C50A8A7806284A0C3886E53BA9F2DB23693912F3127ED902020923DD4A8E"},"recovery_id":1}`, //JSON.stringify(sigRes),
                                    });
                                console.log(
                                    'signedSerializedTx',
                                    signedSerializedTx[0],
                                );

                                // sends transaction to NEAR blockchain via JSON RPC call and records the result
                                const result = broadcast(signedSerializedTx[0]);

                                update({ sig });
                            } catch (e) {
                                console.log(e);
                            }
                        }}
                    >
                        Sign
                    </button>
                </>
            );
        default:
            return (
                <>
                    <h4>Connect BTC Wallet</h4>
                    <button
                        onClick={async () => {
                            const res = await okxwallet.bitcoin.connect();
                            if (!res.address) {
                                return alert('accept connection');
                            }
                            const { address, publicKey } = res;

                            const { address: accountId, nearSecpPublicKey } =
                                await generateAddress({
                                    publicKey: MPC_PUBLIC_KEY,
                                    accountId: REACT_APP_contractId,
                                    path: publicKey,
                                    chain: 'near',
                                });

                            const accessKeys = await getKeys({
                                accountId,
                            });
                            const secpKey = accessKeys.find(
                                (k) => k.public_key.indexOf('secp256k1') === 0,
                            );
                            const { nonce } = secpKey.access_key;
                            const block_hash = await getBlockHash();

                            // update the default message to sign with the latest information
                            const msg = JSON.parse(JSON.stringify(defaultMsg));
                            msg.transactions[0].signer_id = accountId;
                            msg.transactions[0].public_key = nearSecpPublicKey;
                            // WARNING nonce must be below Number.MAX_SAFE_INTEGER
                            msg.transactions[0].nonce = Number(
                                nonce + BigInt(1),
                            );
                            msg.transactions[0].block_hash = block_hash;

                            update({
                                msg,
                                address,
                                pk: publicKey,
                                accountId,
                                nearSecpPublicKey,
                                nonce,
                                blockHash,
                            });
                        }}
                    >
                        Connect
                    </button>
                </>
            );
    }
};

export const App = wrap(AppComp, ['app']);
