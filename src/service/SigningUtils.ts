/*
 * Copyright 2021 NEM
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { LedgerNetworkType, SymbolLedger } from 'symbol-ledger-typescript/lib';
import { Account, Address, AggregateTransaction, Convert, KeyPair, NetworkType, SignedTransaction, Transaction, UInt64 } from 'symbol-sdk';
import { LogType } from '../logger';
import Logger from '../logger/Logger';
import LoggerFactory from '../logger/LoggerFactory';

const logger: Logger = LoggerFactory.getLogger(LogType.System);

/**
 * An account that knows how to asynchronously sign and co-sign transactions
 */
export interface SigningAccount {
    readonly publicKey: string;
    readonly address: Address;
    cosignTransaction(transaction: Transaction, transactionHash: string): Promise<string>;
    signTransaction(transaction: Transaction, generationHash: string): Promise<SignedTransaction>;
}

/**
 * Basic signing account that adapts the sdk's account.
 */
export class PrivateKeyAccount implements SigningAccount {
    public readonly address: Address;
    public readonly publicKey: string;
    constructor(private readonly account: Account) {
        this.address = account.address;
        this.publicKey = account.publicAccount.publicKey;
    }

    async cosignTransaction(transaction: Transaction, transactionHash: string): Promise<string> {
        const keyPairEncoded = KeyPair.createKeyPairFromPrivateKeyString(this.account.privateKey);
        return Convert.uint8ToHex(KeyPair.sign(keyPairEncoded, Convert.hexToUint8(transactionHash)));
    }

    async signTransaction(transaction: Transaction, generationHash: string): Promise<SignedTransaction> {
        return this.account.sign(transaction, generationHash);
    }
}

/**
 * Ledger account that can sign by connecting to the device.
 */
export class LedgerAccount implements SigningAccount {
    public readonly address: Address;

    constructor(
        private readonly ledger: SymbolLedger,
        networkType: LedgerNetworkType,
        private readonly path: string,
        public readonly publicKey: string,
        private readonly isOptinSymbolWallet: boolean,
    ) {
        this.address = Address.createFromPublicKey(publicKey, networkType as number as NetworkType);
    }

    async cosignTransaction(transaction: Transaction, transactionHash: string): Promise<string> {
        logger.info(`Co-signing transaction ${transactionHash} with Ledger account ${this.address.plain()}. Check your device!`);
        return await this.ledger.signCosignatureTransaction(
            this.path,
            transaction,
            transactionHash,
            this.publicKey,
            this.isOptinSymbolWallet,
        );
    }

    async signTransaction(transaction: Transaction, generationHash: string): Promise<SignedTransaction> {
        logger.info(`Signing transaction with Ledger account ${this.address.plain()}. Check your device!`);
        const { payload } = await this.ledger.signTransaction(this.path, transaction, generationHash, this.publicKey, false);
        const generationHashBytes = Array.from(Convert.hexToUint8(generationHash));
        return new SignedTransaction(
            payload,
            Transaction.createTransactionHash(payload, generationHashBytes),
            this.publicKey,
            transaction.type,
            transaction.networkType,
        );
    }
}

/**
 * Utility object to sign transactions asynchronously
 */
export class SigningUtils {
    public static async signTransactionWithCosignatories(
        initiatorAccount: SigningAccount,
        transaction: AggregateTransaction,
        cosignatories: SigningAccount[],
        generationHash: string,
    ): Promise<SignedTransaction> {
        const signedTransaction = await initiatorAccount.signTransaction(transaction, generationHash);
        let signedPayload = signedTransaction.payload;
        for (const cosigner of cosignatories) {
            const signature = await cosigner.cosignTransaction(transaction, signedTransaction.hash);
            Convert.validateHexString(signature, 128, 'Cosignature is not valid hex!');
            signedPayload += UInt64.fromUint(0).toHex() + cosigner.publicKey + signature;
        }
        // Calculate new size
        const size = `00000000${(signedPayload.length / 2).toString(16)}`;
        const formatedSize = size.substr(size.length - 8, size.length);
        const littleEndianSize =
            formatedSize.substr(6, 2) + formatedSize.substr(4, 2) + formatedSize.substr(2, 2) + formatedSize.substr(0, 2);
        signedPayload = littleEndianSize + signedPayload.substr(8, signedPayload.length - 8);
        return new SignedTransaction(
            signedPayload,
            signedTransaction.hash,
            initiatorAccount.publicKey,
            transaction.type,
            transaction.networkType,
        );
    }
}
