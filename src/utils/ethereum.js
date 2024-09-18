import * as ethers from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';

/// ethereum

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

export const getEthereum = async () => {
    const provider = await detectEthereumProvider();

    if (!provider) {
        return alert('Please install/activate MetaMask and try again.');
    }

    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + domain.chainId.toString(16) }],
        });
    } catch (e) {
        const code = e?.code || e?.data?.originalError?.code;
        if (code !== 4902) {
            throw e;
        }

        try {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [
                    {
                        chainId: '0x' + domain.chainId.toString(16),
                        chainName: 'Aurora Mainnet',
                        nativeCurrency: {
                            name: 'Ethereum',
                            symbol: 'ETH',
                            decimals: 18,
                        },
                        blockExplorerUrls: [
                            'https://explorer.mainnet.aurora.dev/',
                        ],
                        fallbackRpcUrls: ['https://mainnet.aurora.dev'],
                    },
                ],
            });
        } catch (e2) {
            alert(
                'Error adding chain. Please click "Choose Ethereum Account" and add the Aurora Network to continue.',
            );
            throw e2;
        }
    }

    const ethersProvider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await ethersProvider.listAccounts();
    if (accounts.length === 0) {
        await ethersProvider.send('eth_requestAccounts', []);
    }
    signer = await ethersProvider.getSigner();

    return { signer, address: await signer.getAddress() };
};

export const switchEthereum = async () => {
    const provider = await detectEthereumProvider();
    await provider.send('wallet_requestPermissions', [{ eth_accounts: {} }]);
    const ethersProvider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = ethersProvider.getSigner();
    return { signer, address: await signer.getAddress() };
};
