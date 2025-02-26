export const loadEnv = (envName: string): string => {
    const value = process.env[envName];
    if (value === undefined || value === '') {
        throw new Error(`Environment variable ${envName} is not set.`);
    }
    return value;
};

export const getUnixTime = (date: Date): number => {
    return Math.floor(date.getTime() / 1000);
}

export const getNSecondsAgo = (n: number): Date => {
    return new Date(Date.now() - n * 1000);
}