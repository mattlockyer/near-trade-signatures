import { wrap } from '../state/state';
import { Overlay } from '../components/Overlay';
import { sleep } from '../state/utils';
import { getNearSignature, getNearAccount } from '../utils/near';
import { transactions } from '../utils/transactions';

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

const BitcoinComp = ({ state, update, destination }) => {
    const updateOverlay = (msg) => update(msg, 'overlay');

    const { step, txString, pk } = state;

    const transaction = transactions[destination];

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

                            const tx = await transaction.getTransaction({
                                path: publicKey,
                                updateOverlay,
                            });

                            update({
                                txString: JSON.stringify(tx, undefined, 4),
                                address,
                                pk: publicKey,
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
                        value={txString}
                        onChange={(e) => update({ txString: e.target.value })}
                    ></textarea>
                    <br />
                    <button
                        onClick={async () => {
                            updateOverlay({
                                overlayMessage: 'Please sign TX in OKX Wallet',
                            });
                            const jsonMsg = JSON.parse(txString);
                            let sig;
                            try {
                                sig =
                                    await window.okxwallet.bitcoin.signMessage(
                                        JSON.stringify(jsonMsg),
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

                            transaction.completeTx({
                                methodName: 'bitcoin_to_near',
                                args: {
                                    pk,
                                    msg: JSON.stringify(jsonMsg),
                                    sig,
                                },
                                updateOverlay,
                                jsonTx: jsonMsg.transactions[0],
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
