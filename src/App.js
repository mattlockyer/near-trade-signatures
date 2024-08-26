import { wrap } from './state/state';
import * as nearAPI from 'near-api-js';
const { PublicKey } = nearAPI.utils;
const { base_decode } = nearAPI.utils.serialize;
import { broadcast, call, view, getKeys, getBlockHash } from './near/near';
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
                                const res =
                                    // {
                                    //     status: {
                                    //         SuccessValue:
                                    //             'eyJiaWdfciI6eyJhZmZpbmVfcG9pbnQiOiIwMjcxMTI3QkNDMkNCQzFBM0JENEVDOTFBNEJFRTc3NTc2REI1QjhDNUU0MjREMjhCMUY3NEFFRjBCNTA2QkI4Q0UifSwicyI6eyJzY2FsYXIiOiIxMzIyRTQyNjc4ODhBRjMxNTNBMzVGRTU5Nzc3RDAxOTVDNjcyRjcyMTA2MTVEQjI1NDk2NzkyRDAwNjYzQ0M2In0sInJlY292ZXJ5X2lkIjowfQ==',
                                    //     },
                                    // } ||
                                    await call({
                                        pk,
                                        msg: JSON.stringify(msg),
                                        sig,
                                    });

                                const sigRes = JSON.parse(
                                    Buffer.from(
                                        res.status.SuccessValue,
                                        'base64',
                                    ).toString(),
                                );
                                console.log('sigRes', sigRes);

                                const transaction = JSON.parse(
                                    JSON.stringify(msg.transactions[0]),
                                );
                                Object.entries(core2jsKeys).forEach(
                                    ([k, v]) => {
                                        transaction[v] = transaction[k];
                                        if (v !== k) delete transaction[k];
                                        // pre-serialize types from json
                                        if (v === 'publicKey') {
                                            transaction[v] =
                                                PublicKey.fromString(
                                                    transaction[v],
                                                );
                                        }
                                        if (v === 'blockHash') {
                                            transaction[v] = base_decode(
                                                transaction[v],
                                            );
                                        }

                                        if (v === 'actions') {
                                            for (const action of transaction[
                                                v
                                            ]) {
                                                const [k2] =
                                                    Object.entries(action)[0];
                                                Object.entries(
                                                    core2jsActions,
                                                ).forEach(([k, v]) => {
                                                    if (k !== k2) return;
                                                    action[v] = action[k];
                                                    delete action[k];
                                                    if (v === 'addKey') {
                                                        action[v] = {
                                                            publicKey:
                                                                PublicKey.fromString(
                                                                    action[v]
                                                                        .public_key,
                                                                ),
                                                            accessKey: {
                                                                nonce: 0,
                                                                permission: {
                                                                    fullAccess:
                                                                        {},
                                                                },
                                                            },
                                                        };
                                                    }
                                                });
                                            }
                                        }
                                    },
                                );

                                // console.log('transaction', transaction);

                                // test transaction will serialize
                                // const serializedTx =
                                //     nearAPI.utils.serialize.serialize(
                                //         nearAPI.transactions.SCHEMA.Transaction,
                                //         transaction,
                                //     );
                                // console.log('serializedTx', serializedTx);

                                const signedTransaction =
                                    new nearAPI.transactions.SignedTransaction({
                                        transaction,
                                        signature:
                                            new nearAPI.transactions.Signature({
                                                keyType: 1,
                                                data: Buffer.concat([
                                                    Buffer.from(
                                                        sigRes.big_r
                                                            .affine_point,
                                                        'hex',
                                                    ),
                                                    Buffer.from(
                                                        sigRes.s.scalar,
                                                        'hex',
                                                    ),
                                                ]),
                                            }),
                                    });

                                console.log(signedTransaction);
                                // encodes transaction to serialized Borsh (required for all transactions)
                                const signedSerializedTx =
                                    signedTransaction.encode();
                                // sends transaction to NEAR blockchain via JSON RPC call and records the result
                                const result = broadcast(signedSerializedTx);

                                update({ sig });
                            } catch (e) {
                                console.log(e);
                                return alert('accept signature');
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
