import { wrap } from './state/state';
import * as nearAPI from 'near-api-js';
import { sha256, KeyPairSecp256k1 } from 'noble-hashes/lib/sha256';
let elliptic = require('elliptic');
let ec = new elliptic.ec('secp256k1');
import { base_encode, base_decode } from 'near-api-js/lib/utils/serialize';
import { Overlay } from './components/Overlay';
import { sleep } from './state/utils';

const { PublicKey } = nearAPI.utils;
import {
    broadcast,
    call,
    core2js,
    getKeys,
    getBlockHash,
    js2core,
    deleteAccount,
    createAccountWithSecpKey,
} from './near/near';
import './styles/app.scss';
import { generateAddress } from './near/kdf';
const { REACT_APP_contractId } = process.env;
const MPC_PUBLIC_KEY =
    'secp256k1:54hU5wcCmVUPFWLDALXMh1fFToZsVXrx9BbTbHzSfQq1Kd1rJZi52iPa4QQxo6s5TgjWqgpY8HamYuUDzG6fAaUq';

const sampleTX = {
    transactions: [
        {
            signer_id:
                '86a315fdc1c4211787aa2fd78a50041ee581c7fff6cec2535ebec14af5c40381',
            signer_public_key:
                'ed25519:A4ZsCYMqJ1oHFGR2g2mFrwhQvaWmyz8K5c5FvfxEPF52',
            nonce: 0,
            receiver_id:
                '86a315fdc1c4211787aa2fd78a50041ee581c7fff6cec2535ebec14af5c40381',
            block_hash: '4reLvkAWfqk5fsqio1KLudk46cqRz9erQdaHkWZKMJDZ',
            actions: [
                // transfers 0.1 NEAR
                { Transfer: { deposit: '100000000000000000000000' } },
                {
                    AddKey: {
                        public_key:
                            'ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp',
                        access_key: {
                            nonce: '0',
                            permission: 'FullAccess',
                        },
                    },
                },
                {
                    DeleteKey: {
                        public_key:
                            'ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp',
                    },
                },
            ],
        },
    ],
};

const AppComp = ({ state, update }) => {
    const { step, msg, pk, sig, accountId, nearSecpPublicKey } = state;

    switch (step) {
        case 'connect':
            return (
                <>
                    <Overlay />
                    <h4>Connect BTC Wallet</h4>
                    <button
                        onClick={async () => {
                            const res = await okxwallet.bitcoin.connect();
                            if (!res.address) {
                                update({
                                    overlayMessage:
                                        'Please accept the connection',
                                });
                                sleep(1500);
                                update({
                                    overlayMessage: '',
                                });
                            }
                            const { address, publicKey } = res;

                            const {
                                address: accountId,
                                nearSecpPublicKey,
                                nearImplicitSecretKey,
                            } = await generateAddress({
                                publicKey: MPC_PUBLIC_KEY,
                                accountId: REACT_APP_contractId,
                                path: publicKey,
                                chain: 'near',
                            });

                            console.log('implicit accountId', accountId);
                            console.log('nearSecpPublicKey', nearSecpPublicKey);

                            // console.log('DELETING ACCOUNT', accountId);
                            // await deleteAccount({
                            //     accountId,
                            //     secretKey: nearImplicitSecretKey,
                            // });

                            // update default tx to sign with the latest information
                            let accessKeys = await getKeys({
                                accountId,
                            });
                            // console.log('accessKeys', accessKeys);
                            if (accessKeys.length === 0) {
                                update({
                                    overlayMessage: 'Creating NEAR Account',
                                });
                                await createAccountWithSecpKey({
                                    accountId,
                                    secretKey: nearImplicitSecretKey,
                                    keyToAdd: nearSecpPublicKey,
                                });
                                update({
                                    overlayMessage: '',
                                });
                                accessKeys = await getKeys({
                                    accountId,
                                });
                            }
                            const secpKey = accessKeys.find(
                                (k) => k.public_key.indexOf('secp256k1') === 0,
                            );
                            const { nonce } = secpKey.access_key;
                            const block_hash = await getBlockHash();
                            const msg = JSON.parse(JSON.stringify(sampleTX));
                            msg.transactions[0].signer_id = accountId;
                            msg.transactions[0].signer_public_key =
                                nearSecpPublicKey;
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
                                step: 'sign',
                            });
                        }}
                    >
                        Connect
                    </button>
                </>
            );
        case 'sign':
            return (
                <>
                    <Overlay />
                    <h4>Sign Message</h4>
                    <textarea
                        rows={16}
                        cols={120}
                        defaultValue={JSON.stringify(msg, undefined, 4)}
                    ></textarea>
                    <br />
                    <button
                        onClick={async () => {
                            update({
                                overlayMessage: 'Please sign TX in OKX Wallet',
                            });

                            try {
                                const sig =
                                    await window.okxwallet.bitcoin.signMessage(
                                        JSON.stringify(msg),
                                        'ecdsa',
                                    );

                                update({
                                    overlayMessage: 'Requesting NEAR Signature',
                                });

                                const res = await call({
                                    pk,
                                    msg: JSON.stringify(msg),
                                    sig,
                                });

                                update({
                                    overlayMessage:
                                        'Received NEAR Signature. Broadcasting NEAR Transaction.',
                                });

                                const sigRes = JSON.parse(
                                    Buffer.from(
                                        res.status.SuccessValue,
                                        'base64',
                                    ).toString(),
                                );
                                console.log('sigRes', sigRes);

                                const transaction = await core2js(
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

                                // ECDSA pubKeyRecovered

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

                                // ECDSA SIG VERIFY

                                var ecKey = ec.keyFromPublic(
                                    pubKeyRecovered.encode('hex'),
                                    'hex',
                                );

                                console.log(
                                    'verified signature',
                                    ecKey.verify(serializedTxHash, {
                                        r: Buffer.from(
                                            sigRes.big_r.affine_point.substring(
                                                2,
                                            ),
                                            'hex',
                                        ),
                                        s: Buffer.from(sigRes.s.scalar, 'hex'),
                                    }),
                                );

                                // End of verification tests

                                const publicKey = PublicKey.fromString(
                                    'secp256k1:' +
                                        base_encode(
                                            Buffer.from(
                                                pubKeyRecovered
                                                    .encode('hex')
                                                    .substring(2),
                                                'hex',
                                            ),
                                        ),
                                );

                                const signature =
                                    new nearAPI.transactions.Signature({
                                        keyType: 1,
                                        data: Buffer.concat([
                                            Buffer.from(
                                                sigRes.big_r.affine_point.substring(
                                                    2,
                                                ),
                                                'hex',
                                            ),
                                            Buffer.from(sigRes.s.scalar, 'hex'),
                                            Buffer.from(
                                                sigRes.big_r.affine_point.substring(
                                                    0,
                                                    2,
                                                ),
                                                'hex',
                                            ),
                                        ]),
                                    });

                                // TODO ISSUE IN NAJ? Calling .subarray on signature type not signature.data
                                // publicKey.verify(serializedTx, signature);
                                // console.log('verified', verified);

                                const signedTransaction =
                                    new nearAPI.transactions.SignedTransaction({
                                        transaction,
                                        signature,
                                    });

                                console.log(signedTransaction);
                                // encodes transaction to serialized Borsh (required for all transactions)
                                const signedSerializedTx =
                                    signedTransaction.encode();
                                // sends transaction to NEAR blockchain via JSON RPC call and records the result
                                const result = await broadcast(
                                    signedSerializedTx,
                                );

                                update({
                                    overlayMessage:
                                        'NEAR Transaction Successful',
                                });
                                await sleep(1500);

                                console.log('result', result);

                                update({
                                    overlayMessage: (
                                        <>
                                            <a
                                                href={
                                                    `https://testnet.nearblocks.io/txns/` +
                                                    result.transaction.hash
                                                }
                                                target="_blank"
                                            >
                                                Explorer Link
                                            </a>
                                            <br />
                                            <br />
                                            <button
                                                onClick={() =>
                                                    update({
                                                        overlayMessage: '',
                                                    })
                                                }
                                            >
                                                Close
                                            </button>
                                        </>
                                    ),
                                });
                            } catch (e) {
                                console.log(e);
                                if (/denied/.test(JSON.stringify(e))) {
                                    update({
                                        overlayMessage:
                                            'Rejected signature in OKX Wallet',
                                    });
                                    await sleep(3000);
                                    update({
                                        overlayMessage: '',
                                    });
                                }
                            }
                        }}
                    >
                        Sign
                    </button>
                </>
            );
    }
};

export const App = wrap(AppComp, ['app']);
