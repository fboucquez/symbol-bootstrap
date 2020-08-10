export const sleep = (ms: number): Promise<any> => {
    // Create a promise that rejects in <ms> milliseconds
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, ms);
    });
};
