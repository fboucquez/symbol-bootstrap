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
import * as _ from 'lodash';
import { Crypto } from 'symbol-sdk';

export class CryptoUtils {
    private static readonly ENCRYPT_PREFIX = 'ENCRYPTED:';

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static encrypt(value: any, password: string, fieldName?: string): any {
        if (!value) {
            return value;
        }
        if (_.isArray(value)) {
            return value.map((v) => this.encrypt(v, password));
        }

        if (_.isObject(value)) {
            return _.mapValues(value, (value: any, name: string) => CryptoUtils.encrypt(value, password, name));
        }

        if (_.isString(value) && fieldName && fieldName.toLowerCase().indexOf('privatekey') > -1) {
            return CryptoUtils.ENCRYPT_PREFIX + Crypto.encrypt(value, password);
        }
        return value;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static decrypt(value: any, password: string, fieldName?: string): any {
        if (!value) {
            return value;
        }
        if (_.isArray(value)) {
            return value.map((v) => this.decrypt(v, password));
        }

        if (_.isObject(value)) {
            return _.mapValues(value, (value: any, name: string) => CryptoUtils.decrypt(value, password, name));
        }
        if (
            _.isString(value) &&
            fieldName &&
            fieldName.toLowerCase().indexOf('privatekey') > -1 &&
            value.startsWith(CryptoUtils.ENCRYPT_PREFIX)
        ) {
            let decryptedValue;
            try {
                const encryptedValue = value.substring(CryptoUtils.ENCRYPT_PREFIX.length);
                decryptedValue = Crypto.decrypt(encryptedValue, password);
            } catch (e) {
                throw Error('Value could not be decrypted!');
            }
            if (!decryptedValue) {
                throw Error('Value could not be decrypted!');
            }
            return decryptedValue;
        }
        return value;
    }

    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    public static encryptedCount(value: any, fieldName?: string): number {
        if (!value) {
            return 0;
        }
        if (_.isArray(value)) {
            return _.sum(value.map((v) => this.encryptedCount(v)));
        }

        if (_.isObject(value)) {
            return _.sum(Object.entries(value).map(([fieldName, value]) => this.encryptedCount(value, fieldName)));
        }
        if (
            _.isString(value) &&
            fieldName &&
            fieldName.toLowerCase().indexOf('privatekey') > -1 &&
            value.startsWith(CryptoUtils.ENCRYPT_PREFIX)
        ) {
            return 1;
        }
        return 0;
    }
}
