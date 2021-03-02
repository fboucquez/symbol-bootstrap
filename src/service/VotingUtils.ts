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

import { Convert, Crypto, KeyPair } from 'symbol-sdk';

export class VotingUtils {
    public static insert(result: Uint8Array, value: Uint8Array, index: number): number {
        result.set(value, index);
        return index + value.length;
    }
    public static createVotingFile(secret: string, votingKeyStartEpoch: number, votingKeyEndEpoch: number): Uint8Array {
        const items = votingKeyEndEpoch - votingKeyStartEpoch + 1;
        const headerSize = 64 + 16;
        const itemSize = 32 + 64;
        const totalSize = headerSize + items * itemSize;
        const rootPrivateKey = KeyPair.createKeyPairFromPrivateKeyString(secret);
        const result = new Uint8Array(totalSize);
        //start-epoch (8b),
        let index = 0;
        index = this.insert(result, Convert.numberToUint8Array(votingKeyStartEpoch, 8), index);

        //end-epoch (8b),
        index = this.insert(result, Convert.numberToUint8Array(votingKeyEndEpoch, 8), index);

        // could it have other values????
        //last key identifier (8b) - for fresh file this is 0xFFFF'FFFF'FFFF'FFFF (a.k.a. Invalid_Id)
        index = this.insert(result, Convert.hexToUint8('FFFFFFFFFFFFFFFF'), index);

        //last wipe key identifier (8b) - again, for fresh file this is 0xFFFF'FFFF'FFFF'FFFF (Invalid_Id)
        index = this.insert(result, Convert.hexToUint8('FFFFFFFFFFFFFFFF'), index);

        // root public key (32b) - this is root public key that is getting announced via vote link tx
        index = this.insert(result, rootPrivateKey.publicKey, index);
        // start-epoch (8b), \ those two are exactly same one, as top level, reason is this was earlier a tree,
        index = this.insert(result, Convert.numberToUint8Array(votingKeyStartEpoch, 8), index);

        //end-epoch (8b), / and each level holds this separately, so we left it as is
        index = this.insert(result, Convert.numberToUint8Array(votingKeyEndEpoch, 8), index);
        /// what follows are bound keys, there are (end - start + 1) of them.

        // each key is:
        for (let i = 0; i < items; i++) {
            // random PRIVATE key (32b)
            const randomPrivateKey = Crypto.randomBytes(32);
            const randomKeyPar = KeyPair.createKeyPairFromPrivateKeyString(Convert.uint8ToHex(randomPrivateKey));
            index = this.insert(result, randomPrivateKey, index);
            // signature (64b)
            // now the signature is usual signature done using ROOT private key on a following data:
            //   (public key (32b), identifier (8b))
            //
            //   identifier is simply epoch, but, most importantly keys are written in REVERSE order.
            //
            //   i.e. say your start-epoch = 2, end-epoch = 42
            const identifier = Convert.numberToUint8Array(votingKeyEndEpoch - i, 8);
            const signature = KeyPair.sign(rootPrivateKey, Uint8Array.from([...randomKeyPar.publicKey, ...identifier]));
            index = this.insert(result, signature, index);
        }
        //
        // root private key is discarded after file is created.
        // header:
        //   2, 42, ff.., ff..., (root pub), 2, 42
        // keys:
        //   (priv key 42, sig 42), (priv key 41, sig 31), ..., (priv key 2, sig 2)
        //
        // every priv key should be cryptographically random,

        return result;
    }
}
