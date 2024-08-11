import { wrap } from './state/state';
import { broadcast, call, view } from './near/near';
import './styles/app.scss';

// 10000000000000 gas is 10 Tgas
const msg = `
{
    "transactions": [
        {
            "receiver_id": "magical-part.testnet",
            "actions": [
                { "type": "Transfer", "amount": "1", "gas": "10000000000000" }
            ]
        },
        {
            "receiver_id": "magical-part.testnet",
            "actions": [
                { "type": "Transfer", "amount": "1", "gas": "10000000000000" }
            ]
        },
        {
            "receiver_id": "magical-part.testnet",
            "actions": [
                { "type": "Transfer", "amount": "1", "gas": "10000000000000" }
            ]
        }
    ]
}
`;

const AppComp = ({ state, update }) => {
    const { address, pk, sig } = state;

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
                    <textarea rows={16} cols={60}>
                        {msg}
                    </textarea>
                    <br />
                    <button
                        onClick={async () => {
                            try {
                                const sig =
                                    await window.okxwallet.bitcoin.signMessage(
                                        msg,
                                        'ecdsa',
                                    );

                                // TESTING
                                (async () => {
                                    const res = await call({
                                        pk,
                                        msg,
                                        sig,
                                    });
                                    console.log(res);
                                })();

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
                            update({ address, pk: publicKey });
                        }}
                    >
                        Connect
                    </button>
                </>
            );
    }
};

export const App = wrap(AppComp, ['app']);
