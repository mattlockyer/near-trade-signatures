import { wrap } from '../state/state';
import { Overlay } from './Overlay';
import { sleep } from '../state/utils';
import { signTypedData, getEvm } from '../utils/evm';
import { transactions } from '../utils/transactions';

const EvmComp = ({ state, update, destination }) => {
  const updateOverlay = (msg) => update(msg, 'overlay');

  const { step, txString, address } = state;

  const transaction = transactions[destination];

  switch (step) {
    case 'connect':
      return (
        <>
          <Overlay />
          <h4>Connect MetaMask or OKX Wallet</h4>
          <button
            onClick={async () => {
              /// evm
              const res = await getEvm();

              if (!res.address) {
                updateOverlay({
                  overlayMessage:
                    'Please install Evm wallet (MM or OKX) and accept the connection',
                });
                await sleep(1500);
                updateOverlay({
                  overlayMessage: '',
                });
              }

              // evm address MUST be lowercase for NEAR Contract ecrecover
              const address = res.address.toLowerCase();

              const tx = await transaction.getTransaction({
                path: address,
                updateOverlay,
              });

              update({
                txString: JSON.stringify(tx, undefined, 4),
                address: address.toLowerCase(),
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
                overlayMessage: 'Please sign TX in wallet',
              });

              const jsonMsg = JSON.parse(txString);
              let sig;
              try {
                sig = await signTypedData({
                  intent: JSON.stringify(jsonMsg),
                });
              } catch (e) {
                if (/denied/.test(JSON.stringify(e))) {
                  updateOverlay({
                    overlayMessage: 'Rejected signature in wallet',
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
                methodName: 'evm_to_near',
                args: {
                  address,
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

export const Evm = wrap(EvmComp, ['evm', 'overlay']);
