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
  localKeyPath(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, { leaf: Uint8Array,
                                                                             path: { sibling: { field: bigint
                                                                                              },
                                                                                     goes_left: boolean
                                                                                   }[]
                                                                           }];
  localWebAuthnAssertion(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, PA_WebAuthnAssertion];
  localBackupPasskeyPub(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, __compactRuntime.Secp256r1Point];
  localBackupKeySalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  registerPasskey(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  authorizeAction(context: __compactRuntime.CircuitContext<PS>,
                  scopeId_0: Uint8Array,
                  actionTag_0: Uint8Array,
                  requireBiometric_0: boolean): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  enrollBackupPasskey(context: __compactRuntime.CircuitContext<PS>,
                      scopeId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
}

export type ProvableCircuits<PS> = {
  registerPasskey(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  authorizeAction(context: __compactRuntime.CircuitContext<PS>,
                  scopeId_0: Uint8Array,
                  actionTag_0: Uint8Array,
                  requireBiometric_0: boolean): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  enrollBackupPasskey(context: __compactRuntime.CircuitContext<PS>,
                      scopeId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  registerPasskey(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  authorizeAction(context: __compactRuntime.CircuitContext<PS>,
                  scopeId_0: Uint8Array,
                  actionTag_0: Uint8Array,
                  requireBiometric_0: boolean): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
  enrollBackupPasskey(context: __compactRuntime.CircuitContext<PS>,
                      scopeId_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, Uint8Array>>;
}

export type Ledger = {
  readonly rpIdHash: Uint8Array;
  readonly origin: Uint8Array;
  readonly defaultRequireUv: boolean;
  keyTree: {
    isFull(): boolean;
    checkRoot(rt_0: { field: bigint }): boolean;
    root(): __compactRuntime.MerkleTreeDigest;
    firstFree(): bigint;
    pathForLeaf(index_0: bigint, leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array>;
    findPathForLeaf(leaf_0: Uint8Array): __compactRuntime.MerkleTreePath<Uint8Array> | undefined;
    history(): Iterator<__compactRuntime.MerkleTreeDigest>
  };
  registeredKeys: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  usedNullifiers: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  receipts: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Uint8Array;
    [Symbol.iterator](): Iterator<[Uint8Array, Uint8Array]>
  };
  readonly registeredCount: bigint;
  readonly authorizedCount: bigint;
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
               initRequireUv_0: boolean): Promise<__compactRuntime.ConstructorResult<PS>>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
export declare const expectedVk: Record<string, string>;
export declare const circuitSignatures: __compactRuntime.CircuitSignatures;
export declare const declaredInterfaces: __compactRuntime.DeclaredInterfaces;
