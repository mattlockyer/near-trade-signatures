import * as ethers from 'ethers';
import detectEvmProvider from '@metamask/detect-provider';
import { generateAddress } from './kdf';

const {
  REACT_APP_contractId: contractId,
  REACT_APP_mpcPublicKey: mpcPublicKey,
} = process.env;

export const defaultEvmTx = {
  to: '0x525521d79134822a342d330bd91DA67976569aF1',
  nonce: 1,
  value: '0x038d7ea4c68000',
  gasLimit: 21000,
  gasPrice: 51354867146,
  chainId: 11155111,
};

// const baseTx = {
//     to: '0x525521d79134822a342d330bd91DA67976569aF1',
//     nonce: 1,
//     value: '0x038d7ea4c68000',
//     gasLimit: 21000,
//     gasPrice: 51354867146,
//     chainId: 11155111,
// };
// const baseTx2 = {
//     to: '0x525521d79134822a342d330bd91DA67976569aF1',
//     nonce: 1,
//     data: '0x6a627842000000000000000000000000525521d79134822a342d330bd91DA67976569aF1',
//     value: '0',
//     gasLimit: 21000,
//     gasPrice: 51354867146,
//     chainId: 11155111,
// };
// const baseTx3 = {
//     type: 2,
//     to: '0x525521d79134822a342d330bd91DA67976569aF1',
//     nonce: 1,
//     value: '0x038d7ea4c68000',
//     maxPriorityFeePerGas: '0x1',
//     maxFeePerGas: '0x1',
//     gasLimit: 21000,
//     chainId: 11155111,
// };
// const baseTx4 = {
//     type: 2,
//     to: '0x525521d79134822a342d330bd91DA67976569aF1',
//     nonce: 1,
//     data: '0x6a627842000000000000000000000000525521d79134822a342d330bd91DA67976569aF1',
//     value: '0',
//     maxPriorityFeePerGas: '0x1',
//     maxFeePerGas: '0x1',
//     gasLimit: 21000,
//     chainId: 11155111,
// };

// chain signatures account

export const getEvmAccount = async (path, updateOverlay) => {
  const { address } = await generateAddress({
    publicKey: mpcPublicKey,
    accountId: contractId,
    path,
    chain: 'evm',
  });

  const provider = getSepoliaProvider();
  const nonce = await provider.getTransactionCount(address);
  return { nonce };
};

// signing with evm wallet

const domain = {
  name: 'NEAR Trade Signatures',
  version: '1',
  chainId: 11155111,
};

let signer;

export const signTypedData = async (json) => {
  const Transaction = [];
  const types = { Transaction };
  Object.entries(json).forEach(([k]) => {
    types.Transaction.push({
      type: 'string',
      name: k,
    });
  });
  const sig = await signer.signTypedData(domain, types, json);
  return sig;
};

export const getEvm = async () => {
  const provider = await detectEvmProvider();

  if (!provider) {
    return alert('Please install/activate MetaMask and try again.');
  }

  try {
    await window.evm.request({
      method: 'wallet_switchEvmChain',
      params: [{ chainId: '0x' + domain.chainId.toString(16) }],
    });
  } catch (e) {
    const code = e?.code || e?.data?.originalError?.code;
    if (code !== 4902) {
      throw e;
    }

    try {
      await window.evm.request({
        method: 'wallet_addEvmChain',
        params: [
          {
            chainId: '0x' + domain.chainId.toString(16),
            chainName: 'Aurora Mainnet',
            nativeCurrency: {
              name: 'Evm',
              symbol: 'ETH',
              decimals: 18,
            },
            blockExplorerUrls: ['https://explorer.mainnet.aurora.dev/'],
            fallbackRpcUrls: ['https://mainnet.aurora.dev'],
          },
        ],
      });
    } catch (e2) {
      alert(
        'Error adding chain. Please click "Choose Evm Account" and add the Aurora Network to continue.',
      );
      throw e2;
    }
  }

  const ethersProvider = new ethers.BrowserProvider(window.evm);
  const accounts = await ethersProvider.listAccounts();
  if (accounts.length === 0) {
    await ethersProvider.send('eth_requestAccounts', []);
  }
  signer = await ethersProvider.getSigner();

  return { signer, address: await signer.getAddress() };
};

export const switchEvm = async () => {
  const provider = await detectEvmProvider();
  await provider.send('wallet_requestPermissions', [{ eth_accounts: {} }]);
  const ethersProvider = new ethers.providers.Web3Provider(window.evm);
  const signer = ethersProvider.getSigner();
  return { signer, address: await signer.getAddress() };
};

const getSepoliaProvider = () => {
  return new ethers.JsonRpcProvider('https://evm-sepolia.publicnode.com');
};
