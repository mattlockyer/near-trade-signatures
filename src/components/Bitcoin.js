import { wrap } from '../state/state';
import { Overlay } from '../components/Overlay';
import { sleep } from '../state/utils';
import { getNearSignature, getNearAccount } from '../utils/near';
import '../styles/app.scss';

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

const BitcoinComp = ({ state, update }) => {
    const updateOverlay = (msg) => update(msg, 'overlay');

    const { step, msg, pk, sig, accountId, nearSecpPublicKey } = state;

    switch (step) {
        case 'connect':
            return (
                <>
                    <Overlay />
                    <h4>Connect BTC Wallet</h4>
                    <button
                        onClick={async () => {
                            if (typeof okxwallet === 'undefined') {
                                console.log('hello');
                                updateOverlay({
                                    overlayMessage:
                                        'Please install or enable OKX Wallet extension',
                                });
                                await sleep(1500);
                                updateOverlay({
                                    overlayMessage: '',
                                });
                                return;
                            }

                            const res = await okxwallet.bitcoin.connect();
                            if (!res.address) {
                                updateOverlay({
                                    overlayMessage:
                                        'Please accept the connection',
                                });
                                await sleep(1500);
                                updateOverlay({
                                    overlayMessage: '',
                                });
                            }
                            const { address, publicKey } = res;

                            const {
                                nonce,
                                block_hash,
                                accountId,
                                nearSecpPublicKey,
                                nearImplicitSecretKey,
                            } = await getNearAccount(publicKey, updateOverlay);

                            // modify the NEAR TX JSON withh the latest TX details, signing account ID and signing public key
                            const msg = JSON.parse(JSON.stringify(sampleTX));
                            msg.transactions[0].signer_id = accountId;
                            msg.transactions[0].receiver_id = accountId;
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
                            updateOverlay({
                                overlayMessage: 'Please sign TX in OKX Wallet',
                            });
                            let sig;
                            try {
                                sig =
                                    await window.okxwallet.bitcoin.signMessage(
                                        JSON.stringify(msg),
                                        'ecdsa',
                                    );
                            } catch (e) {
                                if (/denied/.test(JSON.stringify(e))) {
                                    updateOverlay({
                                        overlayMessage:
                                            'Rejected signature in OKX Wallet',
                                    });
                                    await sleep(3000);
                                    updateOverlay({
                                        overlayMessage: '',
                                    });
                                    return;
                                }
                                console.error(e);
                            }

                            await getNearSignature({
                                methodName: 'bitcoin_to_near',
                                args: {
                                    pk,
                                    msg: JSON.stringify(msg),
                                    sig,
                                },
                                updateOverlay,
                                jsonTx: msg.transactions[0],
                            });
                        }}
                    >
                        Sign
                    </button>
                </>
            );
    }
};

export const Bitcoin = wrap(BitcoinComp, ['bitcoin', 'overlay']);
