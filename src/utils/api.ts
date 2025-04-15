import { dot } from "@polkadot-api/descriptors";
import { createClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";

// setup ws to polkadot relay chain
const provider = getWsProvider("wss://rpc.polkadot.io");

// create client using provider
export const client = createClient(provider);

// creating typedApi from the descriptors
export const typedApi = client.getTypedApi(dot);

/**
 * format a raw DOT amount (in plancks) to a human-readable DOT string
 * 
 * polkadot stores token values as integers in the smallest unit (plancks)
 * 1 DOT = 10^10 plancks (10 billion)
 * 
 * @param amount - amount in plancks (smallest unit)
 * @returns formatted string with DOT value and symbol
 */
export const formatDOT = (amount: bigint): string => {
    // divide by 10^10 to convert plancks to DOT
    const dotAmount = Number(amount) / 1e10;

    // format with thousands separators and max 2 decimal places
    return dotAmount.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' DOT';
};