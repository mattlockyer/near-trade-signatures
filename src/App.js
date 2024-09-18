import { wrap } from './state/state';
import { Bitcoin } from './components/Bitcoin';
import { Ethereum } from './components/Ethereum';

const AppComp = ({ state, update }) => {
    const { source } = state;

    switch (source) {
        case 'bitcoin':
            return <Bitcoin />;
        case 'ethereum':
            return <Ethereum />;
        default:
            return (
                <>
                    <h4>Choose Your Source Wallet</h4>
                    <br />
                    <button onClick={() => update({ source: 'bitcoin' })}>
                        Bitcoin (OKX Wallet)
                    </button>
                    <br />
                    <br />
                    <button onClick={() => update({ source: 'ethereum' })}>
                        Ethereum (MM or OKX Wallet)
                    </button>
                </>
            );
    }
};

export const App = wrap(AppComp, ['app']);
