/*
 * Copyright 2022 Fernando Boucquez
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

import { KnownError } from './BootstrapUtils';
import { OSUtils } from './OSUtils';

/**
 * Random utility methods that don't fit other place.
 */
export class Utils {
    public static secureString(text: string): string {
        const regex = new RegExp('[0-9a-fA-F]{64}', 'g');
        return text.replace(regex, 'HIDDEN_KEY');
    }

    public static validateIsDefined(value: unknown, message: string): void {
        if (value === undefined || value === null) {
            throw new Error(message);
        }
    }

    public static validateIsTrue(value: boolean, message: string): void {
        if (!value) {
            throw new Error(message);
        }
    }
    public static logSameLineMessage(message: string): void {
        process.stdout.write(OSUtils.isWindows() ? '\x1b[0G' : '\r');
        process.stdout.write(message);
    }
    public static validatePassword(password: string): string {
        const passwordMinSize = 4;
        if (password.length < passwordMinSize) {
            throw new KnownError(`Password is too short. It should have at least ${passwordMinSize} characters!`);
        }
        return password;
    }
}
