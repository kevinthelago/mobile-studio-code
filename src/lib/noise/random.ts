import * as Crypto from 'expo-crypto';
import type { Rng } from './noise';

// CSPRNG for the Noise module on device. Hermes has no global
// crypto.getRandomValues, so bytes come from expo-crypto. (The Noise module
// takes the RNG as a parameter so it stays pure/testable; the Node self-test
// injects node:crypto instead.)
export const rng: Rng = (bytes: number): Uint8Array => Crypto.getRandomBytes(bytes);
