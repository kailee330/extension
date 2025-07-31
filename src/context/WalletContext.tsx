import React, {
    createContext,
    useState,
    useEffect,
    ReactNode,
    useCallback,
} from "react";

import { getKeyFromPassword, encrypt, decrypt } from "dha-encryption";
import browser from "webextension-polyfill";
import * as bip39 from "bip39";
import { HDKey } from "@scure/bip32";
import * as bitcoin from 'bitcoinjs-lib';
import ecc from '@bitcoinerlab/secp256k1';
import { ECPairFactory } from 'ecpair';

interface WalletContextProps {
    seedPhrase: string | null;
    wallet: string | null;
    walletList: string[];
    nameList: string[];
    nodeList: string[];
    nodeNameList: string[];
    visibleWalletList: boolean[];
    selectedWalletIndex: number;
    selectedNodeIndex: number;
    password: string | null;
    name: string | null;
    tmpDestinationWallet: string | null;
    inputWordsBackup: string[];
    setName: (name: string) => void;
    setSeedPhrase: (seedPhrase: string) => void;
    setWallet: (wallet: string) => void;
    setPassword: (password: string) => void;
    setWalletList: (walletList: string[]) => void;
    setNodeList: (nodeList: string[]) => void;
    setNodeNameList: (nodeNameList: string[]) => void;
    setNameList: (nameList: string[]) => void;
    setSelectedNodeIndex: (selectedNodeIndex: number) => void;
    setVisibleWalletList: (visibleWalletList: boolean[]) => void;
    setSelectedWalletIndex: (selectedWalletIndex: number) => void;
    setInputWordsBackup: (inputWordsBackup: string[]) => void;
    clearWalletData: () => void;
    token: string | null;
    setToken: (token: string) => void;
    clearToken: () => void;
    accountPath: (index: number) => string;
    newWallet: () => void;
    addAccount: (name: string | null) => void;
    importWallet: (seedPhrase: string) => void;
    setWalletListState: (walletList: string[]) => void;
    setNodeListState: (nodeList: string[]) => void;
    setNodeNameListState: (nodeNameList: string[]) => void;
    setNameListState: (nameList: string[]) => void;
    setSelectedWalletIndexState: (selectedWalletIndex: number) => void;
    setSelectedNodeIndexState: (selectedNodeIndex: number) => void;
    setVisibleWalletListState: (visibleWalletList: boolean[]) => void;
    setTmpDestinationWalletState: (tmpDestinationWallet: string) => void;
    getPrivateKeyFromIndex: (index: number) => string;
};

const defaultNodeList = [
    '',
    '',
    ''
];

const defaultNodeNameList = [
    'polaire',
    'blu & Asia',
    'johnnyb Us East'
];

const chainNetwork = {
    messagePrefix: '\x19Shiba Signed Message:\n',
    bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
    },
    pubKeyHash: 0x3f,
    scriptHash: 0x05,
    wif: 0x80,
    bech32: '',
};

const derivationPrefix = "m/44'/2070'/0'/0";
const ECPair = ECPairFactory(ecc);

export const generateNewWallet = async (mnemonic: string) => {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const hdkey = HDKey.fromMasterSeed(seed);
    const child = hdkey.derive(derivationPrefix);

    const { address } = bitcoin.payments.p2pkh({
        pubkey: Buffer.from(child.publicKey as Uint8Array),
        network: chainNetwork,
    });

    if (!address) throw new Error('Create wallet failed');

    return {
        mnemonic,
        address
    };
};

const WalletContext = createContext<WalletContextProps | undefined>(undefined);

const ENCRYPTION_KEY = import.meta.env.VITE_APP_ENCRYPTION_KEY || "encryption_key";

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [seedPhrase, setSeedPhraseState] = useState<string | null>(null);
    const [wallet, setWalletState] = useState<string | null>(null);
    const [password, setPasswordState] = useState<string | null>(null);
    const [name, setNameState] = useState<string | null>(null);
    const [walletList, setWalletListState] = useState<string[]>([]);
    const [selectedWalletIndex, setSelectedWalletIndexState] = useState<number>(0);
    const [selectedNodeIndex, setSelectedNodeIndexState] = useState<number>(0);
    const [nameList, setNameListState] = useState<string[]>([]);
    const [nodeList, setNodeListState] = useState<string[]>([]);
    const [nodeNameList, setNodeNameListState] = useState<string[]>([]);
    const [token, setTokenState] = useState<string | null>(null);
    const [visibleWalletList, setVisibleWalletListState] = useState<boolean[]>([]);
    const [tmpDestinationWallet, setTmpDestinationWalletState] = useState<string | null>(null);
    const [inputWordsBackup, setInputWordsBackupState] = useState<string[]>([]);

    const arrayBufferToHex = (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer);
        return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('');
    }

    const hexToArrayBuffer = (hex: string): ArrayBuffer => {
        const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        return bytes.buffer;
    }

    const saveToBrowserStorage = async (key: string, value: string | null): Promise<void> => {
        try {
            const keyObject = await getKeyFromPassword(ENCRYPTION_KEY);
            const encryptedValue = value ? await encrypt(value, keyObject) : null;
            const hexValue = encryptedValue ? arrayBufferToHex(encryptedValue) : null;

            browser.storage.local.set({ [key]: hexValue }).then(() => {
                console.log(`${key} saved to browser storage`);
            }).catch((error: unknown) => {
                console.error(`Error saving ${key} to browser storage:`, error);
            });
        } catch (error) {
            console.error(`Error saving ${key} to browser storage:`, error);
        }
    };

    const decryptValue = async (value: string | undefined): Promise<string | null> => {
        const keyObject = await getKeyFromPassword(ENCRYPTION_KEY);
        const arrayBuffer = value ? hexToArrayBuffer(value) : null;
        const decryptedValue = arrayBuffer ? await decrypt(arrayBuffer, keyObject) : null;
        return decryptedValue;
    };

    const setInputWordsBackup = (inputWordsBackup: string[]): void => {
        setInputWordsBackupState(inputWordsBackup);
        saveToBrowserStorage("inputWordsBackup", inputWordsBackup.join(","));
    };

    const loadFromChromeStorage = useCallback((key: string, callback: (value: string | null) => void): void => {
        try {
            browser.storage.local.get(key).then((result: Record<string, unknown>) => {
                console.log("***** result", result);
                decryptValue(result[key] as string | undefined).then((decryptedValue) => {
                    callback(decryptedValue);
                }).catch((error: unknown) => {
                    console.error(`Error decrypting ${key} from browser storage:`, error);
                });
            }).catch((error: unknown) => {
                console.error(`Error loading ${key} from browser storage:`, error);
            });
        } catch (error) {
            console.error(`Error loading ${key} from browser storage:`, error);
        }
    }, []);

    const accountPath = (index: number): string => {
        const path = `${derivationPrefix}/${index}`;
        return path;
    }

    const newWallet = async (): Promise<void> => {
        try {
            console.log("-------------- newWallet --------------");
            // mnemonic 12 words
            const mnemonic = bip39.generateMnemonic();
            const wallet = await generateNewWallet(mnemonic);
            const address = wallet.address;
            console.log("***** newWallet address", address);

            // save to storage
            setSeedPhrase(mnemonic);
            setWallet(address);
            setWalletList([address]);
            setNameList(["Account 0"]);
            setVisibleWalletList([true]);
            setSelectedWalletIndex(0);
            setNodeList(defaultNodeList);
            setNodeNameList(defaultNodeNameList);
            setName("Account 0");
            console.log("***** walletList length", walletList.length);

            console.log("-------------- End of newWallet --------------");

        } catch (error) {
            console.log("Error creating new wallet:", error);
        }
    };

    const addAccount = async (name: string | null): Promise<void> => {
        try {
            const mnemonic = bip39.generateMnemonic();
            const wallet = await generateNewWallet(mnemonic);
            const address = wallet.address;
            console.log("***** addAccount address", address);
            const index = walletList.length;

            // save to storage
            setWallet(address);
            setWalletList([...walletList, address]);
            setNameList([...nameList, name || `Account ${index}`]);
            setVisibleWalletList([...visibleWalletList, true]);
            setSelectedWalletIndex(index);
            setName(name || `Account ${index}`);
            console.log("***** walletList length", walletList.length);

            console.log("-------------- End of add account --------------");

        } catch (error) {
            console.log("Error adding new account:", error);
        }
    }

    const importWallet = async (seedPhrase: string): Promise<void> => {
        console.log("-------------- importWallet --------------");
        // mnemonic 12 words
        const mnemonic = seedPhrase;
        const wallet =  await generateNewWallet(mnemonic);
        const address = wallet.address;
        console.log("***** importWallet address", address);

        // save to storage
        setSeedPhrase(mnemonic);
        setWallet(address);
        setWalletList([address]);
        setNameList(["Account 0"]);
        setVisibleWalletList([true]);
        setSelectedWalletIndex(0);
        setNodeList(defaultNodeList);
        setNodeNameList(defaultNodeNameList);
        console.log("defaultNodeList", defaultNodeList)
        setName("Account 0");
        console.log("***** walletList length", walletList.length);

        console.log("-------------- End of importWallet --------------");
    }

    const setToken = (token: string): void => {
        setTokenState(token);
        const expirationTime = Date.now() + 3600 * 1000; // 1 hour
        saveToBrowserStorage("token", token);
        saveToBrowserStorage("tokenExpiration", expirationTime.toString());
    };

    const clearToken = (): void => {
        setTokenState(null);
        browser.storage.local.remove(["token", "tokenExpiration"]).then(() => {
            console.log("Token and token expiration removed");
        }).catch((error: unknown) => {
            console.error("Error removing token and token expiration:", error);
        });
    };

    const getPrivateKeyFromIndex = (index: number): string => {
        if (!seedPhrase) {
            throw new Error("Missing seed phrase");
        }
        const seed = bip39.mnemonicToSeedSync(seedPhrase);
        const hdkey = HDKey.fromMasterSeed(seed);
        const child = hdkey.derive(derivationPrefix);

        if (!child.privateKey) {
            throw new Error("Private key not found at index " + index);
        }
        const keyPair = ECPair.fromPrivateKey(child.privateKey, { network: chainNetwork });
        const wif = keyPair.toWIF();
        return wif;
    };

    const setSeedPhrase = (seedPhrase: string): void => {
        setSeedPhraseState(seedPhrase);
        saveToBrowserStorage("seedPhrase", seedPhrase);
    };

    const setWallet = (wallet: string): void => {
        setWalletState(wallet);
        saveToBrowserStorage("wallet", wallet);
    };

    const setWalletList = (walletList: string[]): void => {
        setWalletListState(walletList);
        saveToBrowserStorage("walletList", walletList.join(","));
    };

    const setNodeList = (nodeList: string[]): void => {
        setNodeListState(nodeList);
        saveToBrowserStorage("nodeList", nodeList.join(","));
    }

    const setNodeNameList = (nodeNameList: string[]): void => {
        setNodeNameListState(nodeNameList);
        saveToBrowserStorage("nodeNameList", nodeNameList.join(","));
    }

    const setNameList = (nameList: string[]): void => {
        setNameListState(nameList);
        saveToBrowserStorage("nameList", nameList.join(","));
    };

    const setSelectedWalletIndex = (selectedWalletIndex: number): void => {
        setSelectedWalletIndexState(selectedWalletIndex);
        saveToBrowserStorage("selectedWalletIndex", selectedWalletIndex.toString());
    };

    const setSelectedNodeIndex = (selectedNodeIndex: number): void => {
        setSelectedNodeIndexState(selectedNodeIndex);
        saveToBrowserStorage("selectedNodeIndex", selectedNodeIndex.toString());
    }

    const setPassword = (password: string): void => {
        setPasswordState(password);
        saveToBrowserStorage("password", password);
    };

    const setName = (name: string): void => {
        setNameState(name);
        saveToBrowserStorage("name", name);
    };

    const setVisibleWalletList = (visibleWalletList: boolean[]): void => {
        setVisibleWalletListState(visibleWalletList);
        saveToBrowserStorage("visibleWalletList", visibleWalletList.join(","));
    };

    const clearWalletData = (): void => {
        setSeedPhraseState(null);
        setWalletState(null);
        setPasswordState(null);
        setNameState(null);
        browser.storage.local.remove(["seedPhrase", "wallet", "password", "name"]).then(() => {
            console.log("Seed phrase, wallet, password, and name removed");
        }).catch((error: unknown) => {
            console.error("Error removing seed phrase, wallet, password, and name:", error);
        });
    };

    useEffect(() => {
        loadFromChromeStorage("seedPhrase", setSeedPhraseState);
        loadFromChromeStorage("wallet", setWalletState);
        loadFromChromeStorage("walletList", (walletList) => setWalletListState(walletList ? walletList.split(",") : []));
        loadFromChromeStorage("nameList", (nameList) => setNameListState(nameList ? nameList.split(",") : []));
        loadFromChromeStorage("nodeList", (nodeList) => setNodeListState(nodeList ? nodeList.split(",") : []));
        loadFromChromeStorage("nodeNameList", (nodeNameList) => setNodeNameListState(nodeNameList ? nodeNameList.split(",") : []));
        loadFromChromeStorage("visibleWalletList", (visibleWalletList) => {
            const boolArray = visibleWalletList ? visibleWalletList.split(",").map(val => val === "true") : [];
            setVisibleWalletListState(boolArray);
        });
        loadFromChromeStorage("selectedWalletIndex", (selectedWalletIndex) => setSelectedWalletIndexState(selectedWalletIndex ? parseInt(selectedWalletIndex, 10) : 0));
        loadFromChromeStorage("selectedNodeIndex", (selectedNodeIndex) => setSelectedNodeIndexState(selectedNodeIndex ? parseInt(selectedNodeIndex, 10) : 0));
        loadFromChromeStorage("password", setPasswordState);
        loadFromChromeStorage("name", setNameState);
        loadFromChromeStorage("token", setTokenState);
    }, [loadFromChromeStorage]);

    useEffect(() => {
        const interval = setInterval(() => {
            loadFromChromeStorage("tokenExpiration", (expiration) => {
                const expirationTime = expiration ? parseInt(expiration, 10) : 0;
                if (Date.now() >= expirationTime) {
                    clearToken();
                }
            });
        }, 1000 * 60);
        return () => clearInterval(interval);
    }, [loadFromChromeStorage]);

    return (
        <WalletContext.Provider
            value={{
                seedPhrase,
                wallet,
                password,
                name,
                token,
                walletList,
                nodeList,
                nodeNameList,
                nameList,
                selectedWalletIndex,
                selectedNodeIndex,
                visibleWalletList,
                tmpDestinationWallet,
                inputWordsBackup,
                accountPath,
                setSeedPhrase,
                setWallet,
                setPassword,
                setName,
                setWalletList,
                setNodeList,
                setNodeNameList,
                setNameList,
                setVisibleWalletList,
                setSelectedWalletIndex,
                setSelectedNodeIndex,
                clearWalletData,
                setToken,
                clearToken,
                newWallet,
                addAccount,
                setWalletListState,
                setNodeListState,
                setNodeNameListState,
                setNameListState,
                setSelectedWalletIndexState,
                setSelectedNodeIndexState,
                setVisibleWalletListState,
                setTmpDestinationWalletState,
                getPrivateKeyFromIndex,
                importWallet,
                setInputWordsBackup
            }}
        >
            {children}
        </WalletContext.Provider>
    );
};

export default WalletContext;
