import { wrap } from './state/state';
import * as nearAPI from 'near-api-js';
import { sha256, KeyPairSecp256k1 } from 'noble-hashes/lib/sha256';
let elliptic = require('elliptic');
let ec = new elliptic.ec('secp256k1');

const { KeyPair } = nearAPI;
import {
    broadcast,
    call,
    core2jsTransaction,
    buildTransactions,
    getKeys,
    getBlockHash,
    mpcPublicKey,
} from './near/near';
import './styles/app.scss';
import { generateAddress } from './near/kdf';
const { REACT_APP_contractId } = process.env;
const MPC_PUBLIC_KEY =
    'secp256k1:54hU5wcCmVUPFWLDALXMh1fFToZsVXrx9BbTbHzSfQq1Kd1rJZi52iPa4QQxo6s5TgjWqgpY8HamYuUDzG6fAaUq';

const defaultMsg = {
    transactions: [
        {
            signer_id:
                '86a315fdc1c4211787aa2fd78a50041ee581c7fff6cec2535ebec14af5c40381',
            public_key: 'ed25519:A4ZsCYMqJ1oHFGR2g2mFrwhQvaWmyz8K5c5FvfxEPF52',
            nonce: 172237399000001,
            receiver_id: 'forgetful-parent.testnet',
            block_hash: '4reLvkAWfqk5fsqio1KLudk46cqRz9erQdaHkWZKMJDZ',
            actions: [
                { Transfer: { deposit: 1 } },
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

                                const res = await call({
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
                                // const sigRes = JSON.parse(
                                //     `{"big_r":{"affine_point":"026514FBA456D74D7773E0BBFCA7458E1DBC63C524E593B7A8391BDF6AFFB1AA04"},"s":{"scalar":"3D0C03B2A1F754DE1B553F9B3B6CC18F47B446E6A21DB2B4710C02B653956749"},"recovery_id":1}`,
                                // );
                                console.log('sigRes', sigRes);

                                const transaction = await core2jsTransaction(
                                    msg.transactions[0],
                                );

                                const serializedTx =
                                    nearAPI.utils.serialize.serialize(
                                        nearAPI.transactions.SCHEMA.Transaction,
                                        transaction,
                                    );
                                console.log('serializedTx', serializedTx);
                                const serializedTxHash = sha256(serializedTx);
                                console.log(
                                    'serializedTxHash',
                                    serializedTxHash,
                                );

                                let pubKeyRecovered = ec.recoverPubKey(
                                    serializedTxHash,
                                    {
                                        r: Buffer.from(
                                            sigRes.big_r.affine_point.substring(
                                                2,
                                            ),
                                            'hex',
                                        ),
                                        s: Buffer.from(sigRes.s.scalar, 'hex'),
                                    },
                                    sigRes.recovery_id,
                                    'hex',
                                );
                                console.log(
                                    'pubKeyRecovered',
                                    pubKeyRecovered.encode('hex'),
                                );

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
                                const result = await broadcast(
                                    signedSerializedTx,
                                );

                                console.log('result', result);

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

                            console.log('implicit accountId', accountId);
                            console.log('nearSecpPublicKey', nearSecpPublicKey);

                            const accessKeys = await getKeys({
                                accountId,
                            });
                            const secpKey = accessKeys.find(
                                (k) => k.public_key.indexOf('secp256k1') === 0,
                            );
                            const { nonce } = secpKey.access_key;
                            const block_hash = await getBlockHash();

                            // update default message to sign with the latest information
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
