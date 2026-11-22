import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type PA_WebAuthnAssertion = { signature: { r: bigint, s: bigint };
                                     flagsUp: boolean;
                                     flagsRfu1: boolean;
                                     flagsUv: boolean;
                                     flagsUpper: bigint;
                                     signCount: Uint8Array;
                                     challengeBytes: bigint[];
                                     challengeSextets: bigint[];
                                     challengeTail4: bigint;
                                     clientDataMode: bigint
                                   };

export type Witnesses<PS> = {
  localPasskeyPub(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, __compactRuntime.Secp256r1Point];
  localKeySalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
  localWebAuthnAssertion(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, PA_WebAuthnAssertion];
}

export type ImpureCircuits<PS> = {
  increment(context: __compactRuntime.CircuitContext<PS>, scopeId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type ProvableCircuits<PS> = {
  increment(context: __compactRuntime.CircuitContext<PS>, scopeId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  increment(context: __compactRuntime.CircuitContext<PS>, scopeId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, []>>;
}

export type Ledger = {
  readonly rpIdHash: Uint8Array;
  readonly origin: Uint8Array;
  readonly ownerCommit: Uint8Array;
  readonly round: bigint;
  usedNonces: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
}

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>,
               initRpIdHash_0: Uint8Array,
               initOrigin_0: Uint8Array,
               initOwnerCommit_0: Uint8Array): Promise<__compactRuntime.ConstructorResult<PS>>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
export declare const expectedVk: Record<string, string>;
export declare const circuitSignatures: __compactRuntime.CircuitSignatures;
export declare const declaredInterfaces: __compactRuntime.DeclaredInterfaces;
