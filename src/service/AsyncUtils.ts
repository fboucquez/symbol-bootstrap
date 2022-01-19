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

import { Logger } from '../logger';

/**
 * Async related utility methods.
 */
export class AsyncUtils {
    public static stopProcess = false;

    private static onProcessListener = (() => {
        process.on('SIGINT', () => {
            AsyncUtils.stopProcess = true;
        });
    })();

    public static sleep(ms: number): Promise<any> {
        // Create a promise that rejects in <ms> milliseconds
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                //@ts-ignore
                resolve();
            }, ms);
        });
    }

    public static poll(
        logger: Logger,
        promiseFunction: () => Promise<boolean>,
        totalPollingTime: number,
        pollIntervalMs: number,
    ): Promise<boolean> {
        const startTime = new Date().getMilliseconds();
        return promiseFunction().then(async (result) => {
            if (result) {
                return true;
            } else {
                if (AsyncUtils.stopProcess) {
                    return Promise.resolve(false);
                }
                const endTime = new Date().getMilliseconds();
                const newPollingTime: number = Math.max(totalPollingTime - pollIntervalMs - (endTime - startTime), 0);
                if (newPollingTime) {
                    logger.info(`Retrying in ${pollIntervalMs / 1000} seconds. Polling will stop in ${newPollingTime / 1000} seconds`);
                    await AsyncUtils.sleep(pollIntervalMs);
                    return this.poll(logger, promiseFunction, newPollingTime, pollIntervalMs);
                } else {
                    return false;
                }
            }
        });
    }
}
