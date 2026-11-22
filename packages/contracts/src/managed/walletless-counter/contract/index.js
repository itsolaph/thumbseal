import * as __compactRuntime from '@midnight-ntwrk/compact-runtime';
__compactRuntime.checkRuntimeVersion('0.21.0');

const _descriptor_0 = new __compactRuntime.CompactTypeBytes(32);

const _descriptor_1 = new __compactRuntime.CompactTypeBytes(27);

const _descriptor_2 = __compactRuntime.CompactTypeBoolean;

const _descriptor_3 = new __compactRuntime.CompactTypeUnsignedInteger(65535n, 2);

const _descriptor_4 = __compactRuntime.CompactTypeSecp256r1Scalar;

class _Secp256r1EcdsaSignature_0 {
  alignment() {
    return _descriptor_4.alignment().concat(_descriptor_4.alignment());
  }
  fromValue(value_0) {
    return {
      r: _descriptor_4.fromValue(value_0),
      s: _descriptor_4.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_4.toValue(value_0.r).concat(_descriptor_4.toValue(value_0.s));
  }
}

const _descriptor_5 = new _Secp256r1EcdsaSignature_0();

const _descriptor_6 = new __compactRuntime.CompactTypeUnsignedInteger(31n, 1);

const _descriptor_7 = new __compactRuntime.CompactTypeBytes(4);

const _descriptor_8 = new __compactRuntime.CompactTypeUnsignedInteger(255n, 1);

const _descriptor_9 = new __compactRuntime.CompactTypeVector(32, _descriptor_8);

const _descriptor_10 = new __compactRuntime.CompactTypeUnsignedInteger(63n, 1);

const _descriptor_11 = new __compactRuntime.CompactTypeVector(43, _descriptor_10);

const _descriptor_12 = new __compactRuntime.CompactTypeUnsignedInteger(15n, 1);

const _descriptor_13 = new __compactRuntime.CompactTypeUnsignedInteger(3n, 1);

class _WebAuthnAssertion_0 {
  alignment() {
    return _descriptor_5.alignment().concat(_descriptor_2.alignment().concat(_descriptor_2.alignment().concat(_descriptor_2.alignment().concat(_descriptor_6.alignment().concat(_descriptor_7.alignment().concat(_descriptor_9.alignment().concat(_descriptor_11.alignment().concat(_descriptor_12.alignment().concat(_descriptor_13.alignment())))))))));
  }
  fromValue(value_0) {
    return {
      signature: _descriptor_5.fromValue(value_0),
      flagsUp: _descriptor_2.fromValue(value_0),
      flagsRfu1: _descriptor_2.fromValue(value_0),
      flagsUv: _descriptor_2.fromValue(value_0),
      flagsUpper: _descriptor_6.fromValue(value_0),
      signCount: _descriptor_7.fromValue(value_0),
      challengeBytes: _descriptor_9.fromValue(value_0),
      challengeSextets: _descriptor_11.fromValue(value_0),
      challengeTail4: _descriptor_12.fromValue(value_0),
      clientDataMode: _descriptor_13.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_5.toValue(value_0.signature).concat(_descriptor_2.toValue(value_0.flagsUp).concat(_descriptor_2.toValue(value_0.flagsRfu1).concat(_descriptor_2.toValue(value_0.flagsUv).concat(_descriptor_6.toValue(value_0.flagsUpper).concat(_descriptor_7.toValue(value_0.signCount).concat(_descriptor_9.toValue(value_0.challengeBytes).concat(_descriptor_11.toValue(value_0.challengeSextets).concat(_descriptor_12.toValue(value_0.challengeTail4).concat(_descriptor_13.toValue(value_0.clientDataMode))))))))));
  }
}

const _descriptor_14 = new _WebAuthnAssertion_0();

const _descriptor_15 = __compactRuntime.CompactTypeSecp256r1Point;

const _descriptor_16 = new __compactRuntime.CompactTypeBytes(16);

const _descriptor_17 = new __compactRuntime.CompactTypeVector(43, _descriptor_8);

const _descriptor_18 = __compactRuntime.CompactTypeSecp256r1Base;

const _descriptor_19 = new __compactRuntime.CompactTypeVector(2, _descriptor_0);

const _descriptor_20 = new __compactRuntime.CompactTypeBytes(36);

const _descriptor_21 = new __compactRuntime.CompactTypeBytes(12);

const _descriptor_22 = new __compactRuntime.CompactTypeBytes(131);

class _tuple_0 {
  alignment() {
    return _descriptor_20.alignment().concat(_descriptor_17.alignment().concat(_descriptor_21.alignment().concat(_descriptor_1.alignment().concat(_descriptor_22.alignment()))));
  }
  fromValue(value_0) {
    return [
      _descriptor_20.fromValue(value_0),
      _descriptor_17.fromValue(value_0),
      _descriptor_21.fromValue(value_0),
      _descriptor_1.fromValue(value_0),
      _descriptor_22.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_20.toValue(value_0[0]).concat(_descriptor_17.toValue(value_0[1]).concat(_descriptor_21.toValue(value_0[2]).concat(_descriptor_1.toValue(value_0[3]).concat(_descriptor_22.toValue(value_0[4])))));
  }
}

const _descriptor_23 = new _tuple_0();

class _tuple_1 {
  alignment() {
    return _descriptor_0.alignment().concat(_descriptor_8.alignment().concat(_descriptor_7.alignment().concat(_descriptor_0.alignment())));
  }
  fromValue(value_0) {
    return [
      _descriptor_0.fromValue(value_0),
      _descriptor_8.fromValue(value_0),
      _descriptor_7.fromValue(value_0),
      _descriptor_0.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0[0]).concat(_descriptor_8.toValue(value_0[1]).concat(_descriptor_7.toValue(value_0[2]).concat(_descriptor_0.toValue(value_0[3]))));
  }
}

const _descriptor_24 = new _tuple_1();

const _descriptor_25 = new __compactRuntime.CompactTypeBytes(22);

class _tuple_2 {
  alignment() {
    return _descriptor_20.alignment().concat(_descriptor_17.alignment().concat(_descriptor_21.alignment().concat(_descriptor_1.alignment().concat(_descriptor_25.alignment()))));
  }
  fromValue(value_0) {
    return [
      _descriptor_20.fromValue(value_0),
      _descriptor_17.fromValue(value_0),
      _descriptor_21.fromValue(value_0),
      _descriptor_1.fromValue(value_0),
      _descriptor_25.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_20.toValue(value_0[0]).concat(_descriptor_17.toValue(value_0[1]).concat(_descriptor_21.toValue(value_0[2]).concat(_descriptor_1.toValue(value_0[3]).concat(_descriptor_25.toValue(value_0[4])))));
  }
}

const _descriptor_26 = new _tuple_2();

const _descriptor_27 = new __compactRuntime.CompactTypeBytes(2);

class _tuple_3 {
  alignment() {
    return _descriptor_20.alignment().concat(_descriptor_17.alignment().concat(_descriptor_21.alignment().concat(_descriptor_1.alignment().concat(_descriptor_27.alignment()))));
  }
  fromValue(value_0) {
    return [
      _descriptor_20.fromValue(value_0),
      _descriptor_17.fromValue(value_0),
      _descriptor_21.fromValue(value_0),
      _descriptor_1.fromValue(value_0),
      _descriptor_27.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_20.toValue(value_0[0]).concat(_descriptor_17.toValue(value_0[1]).concat(_descriptor_21.toValue(value_0[2]).concat(_descriptor_1.toValue(value_0[3]).concat(_descriptor_27.toValue(value_0[4])))));
  }
}

const _descriptor_28 = new _tuple_3();

class _tuple_4 {
  alignment() {
    return _descriptor_16.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment())));
  }
  fromValue(value_0) {
    return [
      _descriptor_16.fromValue(value_0),
      _descriptor_0.fromValue(value_0),
      _descriptor_0.fromValue(value_0),
      _descriptor_0.fromValue(value_0)
    ]
  }
  toValue(value_0) {
    return _descriptor_16.toValue(value_0[0]).concat(_descriptor_0.toValue(value_0[1]).concat(_descriptor_0.toValue(value_0[2]).concat(_descriptor_0.toValue(value_0[3]))));
  }
}

const _descriptor_29 = new _tuple_4();

const _descriptor_30 = new __compactRuntime.CompactTypeUnsignedInteger(18446744073709551615n, 8);

class _Either_0 {
  alignment() {
    return _descriptor_2.alignment().concat(_descriptor_0.alignment().concat(_descriptor_0.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_2.fromValue(value_0),
      left: _descriptor_0.fromValue(value_0),
      right: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_2.toValue(value_0.is_left).concat(_descriptor_0.toValue(value_0.left).concat(_descriptor_0.toValue(value_0.right)));
  }
}

const _descriptor_31 = new _Either_0();

const _descriptor_32 = new __compactRuntime.CompactTypeUnsignedInteger(340282366920938463463374607431768211455n, 16);

class _ContractAddress_0 {
  alignment() {
    return _descriptor_0.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.bytes);
  }
}

const _descriptor_33 = new _ContractAddress_0();

class _UserAddress_0 {
  alignment() {
    return _descriptor_0.alignment();
  }
  fromValue(value_0) {
    return {
      bytes: _descriptor_0.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_0.toValue(value_0.bytes);
  }
}

const _descriptor_34 = new _UserAddress_0();

class _Either_1 {
  alignment() {
    return _descriptor_2.alignment().concat(_descriptor_33.alignment().concat(_descriptor_34.alignment()));
  }
  fromValue(value_0) {
    return {
      is_left: _descriptor_2.fromValue(value_0),
      left: _descriptor_33.fromValue(value_0),
      right: _descriptor_34.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_2.toValue(value_0.is_left).concat(_descriptor_33.toValue(value_0.left).concat(_descriptor_34.toValue(value_0.right)));
  }
}

const _descriptor_35 = new _Either_1();

class _Maybe_0 {
  alignment() {
    return _descriptor_2.alignment().concat(_descriptor_35.alignment());
  }
  fromValue(value_0) {
    return {
      is_some: _descriptor_2.fromValue(value_0),
      value: _descriptor_35.fromValue(value_0)
    }
  }
  toValue(value_0) {
    return _descriptor_2.toValue(value_0.is_some).concat(_descriptor_35.toValue(value_0.value));
  }
}

const _descriptor_36 = new _Maybe_0();

const _descriptor_37 = new __compactRuntime.CompactTypeUnsignedInteger(4294967295n, 4);

export class Contract {
  witnesses;
  constructor(...args_0) {
    if (args_0.length !== 1) {
      throw new __compactRuntime.CompactError(`Contract constructor: expected 1 argument, received ${args_0.length}`);
    }
    const witnesses_0 = args_0[0];
    if (typeof(witnesses_0) !== 'object') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor is not an object');
    }
    if (typeof(witnesses_0.localPasskeyPub) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named localPasskeyPub');
    }
    if (typeof(witnesses_0.localKeySalt) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named localKeySalt');
    }
    if (typeof(witnesses_0.localWebAuthnAssertion) !== 'function') {
      throw new __compactRuntime.CompactError('first (witnesses) argument to Contract constructor does not contain a function-valued field named localWebAuthnAssertion');
    }
    this.witnesses = witnesses_0;
    this.circuits = {
      increment: async (...args_1) => {
        if (args_1.length !== 2) {
          throw new __compactRuntime.CompactError(`increment: expected 2 arguments (as invoked from Typescript), received ${args_1.length}`);
        }
        const contextOrig_0 = args_1[0];
        const scopeId_0 = args_1[1];
        if (!(typeof(contextOrig_0) === 'object' && contextOrig_0.callContext.currentQueryContext != undefined)) {
          __compactRuntime.typeError('increment',
                                     'argument 1 (as invoked from Typescript)',
                                     'WalletlessCounter.compact line 29 char 1',
                                     'CircuitContext',
                                     contextOrig_0)
        }
        if (!(scopeId_0.buffer instanceof ArrayBuffer && scopeId_0.BYTES_PER_ELEMENT === 1 && scopeId_0.length === 32)) {
          __compactRuntime.typeError('increment',
                                     'argument 1 (argument 2 as invoked from Typescript)',
                                     'WalletlessCounter.compact line 29 char 1',
                                     'Bytes<32>',
                                     scopeId_0)
        }
        const context = __compactRuntime.copyCircuitContext(contextOrig_0);
        const partialProofData = {
          input: {
            value: _descriptor_0.toValue(scopeId_0),
            alignment: _descriptor_0.alignment()
          },
          output: undefined,
          publicTranscript: [],
          privateTranscriptOutputs: []
        };
        const result_0 = await this._increment_0(context,
                                                 partialProofData,
                                                 scopeId_0);
        partialProofData.output = { value: [], alignment: [] };
        __compactRuntime.finalizeCallProofData(context, partialProofData);
        return { result: result_0, context: context, gasCost: context.callContext.currentGasCost };
      }
    };
    this.impureCircuits = { increment: this.circuits.increment };
    this.provableCircuits = { increment: this.circuits.increment };
  }
  async initialState(...args_0) {
    if (args_0.length !== 4) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 4 arguments (as invoked from Typescript), received ${args_0.length}`);
    }
    const constructorContext_0 = args_0[0];
    const initRpIdHash_0 = args_0[1];
    const initOrigin_0 = args_0[2];
    const initOwnerCommit_0 = args_0[3];
    if (typeof(constructorContext_0) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'constructorContext' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!('initialPrivateState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialPrivateState' in argument 1 (as invoked from Typescript)`);
    }
    if (!('initialZswapLocalState' in constructorContext_0)) {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript)`);
    }
    if (typeof(constructorContext_0.initialZswapLocalState) !== 'object') {
      throw new __compactRuntime.CompactError(`Contract state constructor: expected 'initialZswapLocalState' in argument 1 (as invoked from Typescript) to be an object`);
    }
    if (!(initRpIdHash_0.buffer instanceof ArrayBuffer && initRpIdHash_0.BYTES_PER_ELEMENT === 1 && initRpIdHash_0.length === 32)) {
      __compactRuntime.typeError('Contract state constructor',
                                 'argument 1 (argument 2 as invoked from Typescript)',
                                 'WalletlessCounter.compact line 23 char 1',
                                 'Bytes<32>',
                                 initRpIdHash_0)
    }
    if (!(initOrigin_0.buffer instanceof ArrayBuffer && initOrigin_0.BYTES_PER_ELEMENT === 1 && initOrigin_0.length === 27)) {
      __compactRuntime.typeError('Contract state constructor',
                                 'argument 2 (argument 3 as invoked from Typescript)',
                                 'WalletlessCounter.compact line 23 char 1',
                                 'Bytes<27>',
                                 initOrigin_0)
    }
    if (!(initOwnerCommit_0.buffer instanceof ArrayBuffer && initOwnerCommit_0.BYTES_PER_ELEMENT === 1 && initOwnerCommit_0.length === 32)) {
      __compactRuntime.typeError('Contract state constructor',
                                 'argument 3 (argument 4 as invoked from Typescript)',
                                 'WalletlessCounter.compact line 23 char 1',
                                 'Bytes<32>',
                                 initOwnerCommit_0)
    }
    const state_0 = new __compactRuntime.ContractState();
    let stateValue_0 = __compactRuntime.StateValue.newArray();
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    stateValue_0 = stateValue_0.arrayPush(__compactRuntime.StateValue.newNull());
    state_0.data = new __compactRuntime.ChargedState(stateValue_0);
    state_0.setOperation('increment', new __compactRuntime.ContractOperation());
    const context = __compactRuntime.createCircuitContext({circuitId: 'constructor', contractAddress: __compactRuntime.dummyContractAddress(), coinPublicKeyOrZswapState: constructorContext_0.initialZswapLocalState.coinPublicKey, contractState: state_0.data, privateState: constructorContext_0.initialPrivateState});
    const partialProofData = {
      input: { value: [], alignment: [] },
      output: undefined,
      publicTranscript: [],
      privateTranscriptOutputs: []
    };
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_8.toValue(0n),
                                                                                              alignment: _descriptor_8.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_8.toValue(1n),
                                                                                              alignment: _descriptor_8.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(new Uint8Array(27)),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_8.toValue(2n),
                                                                                              alignment: _descriptor_8.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(new Uint8Array(32)),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_8.toValue(3n),
                                                                                              alignment: _descriptor_8.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_30.toValue(0n),
                                                                                              alignment: _descriptor_30.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_8.toValue(4n),
                                                                                              alignment: _descriptor_8.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newMap(
                                                          new __compactRuntime.StateMap()
                                                        ).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_8.toValue(0n),
                                                                                              alignment: _descriptor_8.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(initRpIdHash_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_8.toValue(1n),
                                                                                              alignment: _descriptor_8.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_1.toValue(initOrigin_0),
                                                                                              alignment: _descriptor_1.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_8.toValue(2n),
                                                                                              alignment: _descriptor_8.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(initOwnerCommit_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { ins: { cached: false, n: 1 } }]);
    state_0.data = new __compactRuntime.ChargedState(context.callContext.currentQueryContext.state.state);
    return {
      currentContractState: state_0,
      currentPrivateState: context.callContext.currentPrivateState,
      currentZswapLocalState: context.callContext.currentZswapLocalState
    }
  }
  _reverseBytes32_0(b_0) {
    const v_0 = Array.from(b_0, BigInt);
    return Uint8Array.from([v_0[31],
                            v_0[30],
                            v_0[29],
                            v_0[28],
                            v_0[27],
                            v_0[26],
                            v_0[25],
                            v_0[24],
                            v_0[23],
                            v_0[22],
                            v_0[21],
                            v_0[20],
                            v_0[19],
                            v_0[18],
                            v_0[17],
                            v_0[16],
                            v_0[15],
                            v_0[14],
                            v_0[13],
                            v_0[12],
                            v_0[11],
                            v_0[10],
                            v_0[9],
                            v_0[8],
                            v_0[7],
                            v_0[6],
                            v_0[5],
                            v_0[4],
                            v_0[3],
                            v_0[2],
                            v_0[1],
                            v_0[0]],
                           Number);
  }
  _secp256r1EcdsaVerify_0(msgHash_0, sig_0, pk_0) {
    __compactRuntime.assert(!this._equal_0(pk_0,
                                           ({x: 0n, y: 0n, identity: true})),
                            'Secp256r1Point identity is not a permitted secp256r1EcdsaVerify verification key');
    const z_0 = __compactRuntime.convertBytesToField(115792089210356248762697446949407573529996955224135760342422259061068512044368n,
                                                     32,
                                                     this._reverseBytes32_0(msgHash_0),
                                                     'Secp256r1Scalar',
                                                     '<standard library>');
    const __compact_pattern_tmp2_0 = sig_0;
    const r_0 = __compact_pattern_tmp2_0.r;
    const s_0 = __compact_pattern_tmp2_0.s;
    const w_0 = this._inv_0(s_0);
    const u1_0 = __compactRuntime.secp256r1ScalarMul(z_0, w_0);
    const u2_0 = __compactRuntime.secp256r1ScalarMul(r_0, w_0);
    const point_0 = this._ecAdd_0(this._ecMulGenerator_0(u1_0),
                                  this._ecMul_0(pk_0, u2_0));
    return __compactRuntime.convertBytesToField(115792089210356248762697446949407573529996955224135760342422259061068512044368n,
                                                32,
                                                __compactRuntime.convertBigintToBytes(32,
                                                                                      this._secp256r1PointX_0(point_0),
                                                                                      '<standard library>'),
                                                'Secp256r1Scalar',
                                                '<standard library>')
           ===
           r_0;
  }
  _persistentHash_0(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_29, value_0);
    return result_0;
  }
  _persistentHash_1(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_26, value_0);
    return result_0;
  }
  _persistentHash_2(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_28, value_0);
    return result_0;
  }
  _persistentHash_3(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_23, value_0);
    return result_0;
  }
  _persistentHash_4(value_0) {
    const result_0 = __compactRuntime.persistentHash(_descriptor_24, value_0);
    return result_0;
  }
  _persistentCommit_0(value_0, rand_0) {
    const result_0 = __compactRuntime.persistentCommit(_descriptor_19,
                                                       value_0,
                                                       rand_0);
    return result_0;
  }
  _inv_0(s_0) {
    const result_0 = __compactRuntime.secp256r1ScalarInv(s_0);
    return result_0;
  }
  _secp256r1PointX_0(pt_0) {
    const result_0 = __compactRuntime.secp256r1PointX(pt_0);
    return result_0;
  }
  _secp256r1PointY_0(pt_0) {
    const result_0 = __compactRuntime.secp256r1PointY(pt_0);
    return result_0;
  }
  _ecAdd_0(a_0, b_0) {
    const result_0 = __compactRuntime.secp256r1Add(a_0, b_0);
    return result_0;
  }
  _ecMul_0(a_0, b_0) {
    const result_0 = __compactRuntime.secp256r1Mul(a_0, b_0);
    return result_0;
  }
  _ecMulGenerator_0(b_0) {
    const result_0 = __compactRuntime.secp256r1MulGenerator(b_0);
    return result_0;
  }
  _sextetToBase64UrlAscii_0(s_0) {
    if (s_0 < 26n) {
      return s_0 + 65n;
    } else {
      if (s_0 < 52n) {
        return s_0 + 71n;
      } else {
        if (s_0 < 62n) {
          return __compactRuntime.assert(s_0 >= 4n,
                                         'result of subtraction would be negative'),
                 s_0 - 4n;
        } else {
          if (s_0 === 62n) { return 45n; } else { return 95n; }
        }
      }
    }
  }
  _verifyAndEncodeChallengeBase64Url_0(expectedChallenge_0,
                                       challengeBytes_0,
                                       sextets_0,
                                       tail4_0)
  {
    __compactRuntime.assert(this._equal_1(Uint8Array.from(challengeBytes_0,
                                                          Number),
                                          expectedChallenge_0),
                            'Challenge witness bytes do not match expected challenge');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(challengeBytes_0[0],
                                                                                                          65536n),
                                                                                __compactRuntime.mulField(challengeBytes_0[1],
                                                                                                          256n)),
                                                      challengeBytes_0[2])
                            ===
                            __compactRuntime.addField(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(sextets_0[0],
                                                                                                                                    262144n),
                                                                                                          __compactRuntime.mulField(sextets_0[1],
                                                                                                                                    4096n)),
                                                                                __compactRuntime.mulField(sextets_0[2],
                                                                                                          64n)),
                                                      sextets_0[3]),
                            'Base64url triplet 0 mismatch');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(challengeBytes_0[3],
                                                                                                          65536n),
                                                                                __compactRuntime.mulField(challengeBytes_0[4],
                                                                                                          256n)),
                                                      challengeBytes_0[5])
                            ===
                            __compactRuntime.addField(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(sextets_0[4],
                                                                                                                                    262144n),
                                                                                                          __compactRuntime.mulField(sextets_0[5],
                                                                                                                                    4096n)),
                                                                                __compactRuntime.mulField(sextets_0[6],
                                                                                                          64n)),
                                                      sextets_0[7]),
                            'Base64url triplet 1 mismatch');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(challengeBytes_0[6],
                                                                                                          65536n),
                                                                                __compactRuntime.mulField(challengeBytes_0[7],
                                                                                                          256n)),
                                                      challengeBytes_0[8])
                            ===
                            __compactRuntime.addField(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(sextets_0[8],
                                                                                                                                    262144n),
                                                                                                          __compactRuntime.mulField(sextets_0[9],
                                                                                                                                    4096n)),
                                                                                __compactRuntime.mulField(sextets_0[10],
                                                                                                          64n)),
                                                      sextets_0[11]),
                            'Base64url triplet 2 mismatch');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(challengeBytes_0[9],
                                                                                                          65536n),
                                                                                __compactRuntime.mulField(challengeBytes_0[10],
                                                                                                          256n)),
                                                      challengeBytes_0[11])
                            ===
                            __compactRuntime.addField(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(sextets_0[12],
                                                                                                                                    262144n),
                                                                                                          __compactRuntime.mulField(sextets_0[13],
                                                                                                                                    4096n)),
                                                                                __compactRuntime.mulField(sextets_0[14],
                                                                                                          64n)),
                                                      sextets_0[15]),
                            'Base64url triplet 3 mismatch');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(challengeBytes_0[12],
                                                                                                          65536n),
                                                                                __compactRuntime.mulField(challengeBytes_0[13],
                                                                                                          256n)),
                                                      challengeBytes_0[14])
                            ===
                            __compactRuntime.addField(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(sextets_0[16],
                                                                                                                                    262144n),
                                                                                                          __compactRuntime.mulField(sextets_0[17],
                                                                                                                                    4096n)),
                                                                                __compactRuntime.mulField(sextets_0[18],
                                                                                                          64n)),
                                                      sextets_0[19]),
                            'Base64url triplet 4 mismatch');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(challengeBytes_0[15],
                                                                                                          65536n),
                                                                                __compactRuntime.mulField(challengeBytes_0[16],
                                                                                                          256n)),
                                                      challengeBytes_0[17])
                            ===
                            __compactRuntime.addField(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(sextets_0[20],
                                                                                                                                    262144n),
                                                                                                          __compactRuntime.mulField(sextets_0[21],
                                                                                                                                    4096n)),
                                                                                __compactRuntime.mulField(sextets_0[22],
                                                                                                          64n)),
                                                      sextets_0[23]),
                            'Base64url triplet 5 mismatch');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(challengeBytes_0[18],
                                                                                                          65536n),
                                                                                __compactRuntime.mulField(challengeBytes_0[19],
                                                                                                          256n)),
                                                      challengeBytes_0[20])
                            ===
                            __compactRuntime.addField(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(sextets_0[24],
                                                                                                                                    262144n),
                                                                                                          __compactRuntime.mulField(sextets_0[25],
                                                                                                                                    4096n)),
                                                                                __compactRuntime.mulField(sextets_0[26],
                                                                                                          64n)),
                                                      sextets_0[27]),
                            'Base64url triplet 6 mismatch');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(challengeBytes_0[21],
                                                                                                          65536n),
                                                                                __compactRuntime.mulField(challengeBytes_0[22],
                                                                                                          256n)),
                                                      challengeBytes_0[23])
                            ===
                            __compactRuntime.addField(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(sextets_0[28],
                                                                                                                                    262144n),
                                                                                                          __compactRuntime.mulField(sextets_0[29],
                                                                                                                                    4096n)),
                                                                                __compactRuntime.mulField(sextets_0[30],
                                                                                                          64n)),
                                                      sextets_0[31]),
                            'Base64url triplet 7 mismatch');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(challengeBytes_0[24],
                                                                                                          65536n),
                                                                                __compactRuntime.mulField(challengeBytes_0[25],
                                                                                                          256n)),
                                                      challengeBytes_0[26])
                            ===
                            __compactRuntime.addField(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(sextets_0[32],
                                                                                                                                    262144n),
                                                                                                          __compactRuntime.mulField(sextets_0[33],
                                                                                                                                    4096n)),
                                                                                __compactRuntime.mulField(sextets_0[34],
                                                                                                          64n)),
                                                      sextets_0[35]),
                            'Base64url triplet 8 mismatch');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(challengeBytes_0[27],
                                                                                                          65536n),
                                                                                __compactRuntime.mulField(challengeBytes_0[28],
                                                                                                          256n)),
                                                      challengeBytes_0[29])
                            ===
                            __compactRuntime.addField(__compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(sextets_0[36],
                                                                                                                                    262144n),
                                                                                                          __compactRuntime.mulField(sextets_0[37],
                                                                                                                                    4096n)),
                                                                                __compactRuntime.mulField(sextets_0[38],
                                                                                                          64n)),
                                                      sextets_0[39]),
                            'Base64url triplet 9 mismatch');
    __compactRuntime.assert(__compactRuntime.addField(__compactRuntime.mulField(challengeBytes_0[30],
                                                                                256n),
                                                      challengeBytes_0[31])
                            ===
                            __compactRuntime.addField(__compactRuntime.addField(__compactRuntime.mulField(sextets_0[40],
                                                                                                          1024n),
                                                                                __compactRuntime.mulField(sextets_0[41],
                                                                                                          16n)),
                                                      tail4_0),
                            'Base64url tail mismatch');
    __compactRuntime.assert(sextets_0[42]
                            ===
                            ((t1) => {
                              if (t1 > 63n) {
                                throw new __compactRuntime.CompactError('PasskeyAuth.compact line 122 char 22: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 63');
                              }
                              return t1;
                            })(tail4_0 * 4n),
                            'Non-canonical base64url trailing bits');
    return this._mapper_0((...args_0) =>
                            this._sextetToBase64UrlAscii_0(...args_0),
                          sextets_0);
  }
  _commitPasskey_0(pk_0, salt_0) {
    __compactRuntime.assert(!this._equal_2(pk_0,
                                           ({x: 0n, y: 0n, identity: true})),
                            'Identity secp256r1 point is not a valid passkey');
    const xBytes_0 = __compactRuntime.convertBigintToBytes(32,
                                                           this._secp256r1PointX_0(pk_0),
                                                           'PasskeyAuth.compact line 133 char 31');
    const yBytes_0 = __compactRuntime.convertBigintToBytes(32,
                                                           this._secp256r1PointY_0(pk_0),
                                                           'PasskeyAuth.compact line 134 char 31');
    return this._persistentCommit_0([xBytes_0, yBytes_0], salt_0);
  }
  _deriveChallenge_0(domainTag_0, rpIdHash_0, scopeId_0, actionTag_0) {
    return this._persistentHash_0([domainTag_0,
                                   rpIdHash_0,
                                   scopeId_0,
                                   actionTag_0]);
  }
  _deriveScopedNullifier_0(keyCommit_0, rpIdHash_0, scopeId_0) {
    return this._persistentHash_0([new Uint8Array([116, 104, 117, 109, 98, 115, 101, 97, 108, 58, 110, 102, 58, 118, 49, 0]),
                                   keyCommit_0,
                                   rpIdHash_0,
                                   scopeId_0]);
  }
  _verifyWebAuthnAssertion_0(pk_0,
                             rpIdHash_0,
                             origin_0,
                             expectedChallenge_0,
                             requireUv_0,
                             assertion_0)
  {
    __compactRuntime.assert(!this._equal_3(pk_0,
                                           ({x: 0n, y: 0n, identity: true})),
                            'Identity secp256r1 point rejected');
    __compactRuntime.assert(assertion_0.flagsUp,
                            'WebAuthn User Presence (UP) flag must be set');
    if (requireUv_0) {
      __compactRuntime.assert(assertion_0.flagsUv,
                              'WebAuthn User Verification (UV) flag required');
    }
    let t_0;
    __compactRuntime.assert((t_0 = assertion_0.flagsUpper, t_0 < 4n),
                            'Unsupported authenticatorData flags');
    let t_1;
    __compactRuntime.assert((t_1 = assertion_0.clientDataMode, t_1 < 3n),
                            'Unsupported clientDataJSON mode');
    const upVal_0 = assertion_0.flagsUp ? 1n : 0n;
    const rfu1Val_0 = assertion_0.flagsRfu1 ? 2n : 0n;
    const uvVal_0 = assertion_0.flagsUv ? 4n : 0n;
    const upperVal_0 = ((t1) => {
                         if (t1 > 255n) {
                           throw new __compactRuntime.CompactError('PasskeyAuth.compact line 190 char 31: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 255');
                         }
                         return t1;
                       })(assertion_0.flagsUpper * 8n);
    const authFlags_0 = ((t1) => {
                          if (t1 > 255n) {
                            throw new __compactRuntime.CompactError('PasskeyAuth.compact line 191 char 32: cast from Field or Uint value to smaller Uint value failed: ' + t1 + ' is greater than 255');
                          }
                          return t1;
                        })(upVal_0 + rfu1Val_0 + uvVal_0 + upperVal_0);
    const chalB64_0 = this._verifyAndEncodeChallengeBase64Url_0(expectedChallenge_0,
                                                                assertion_0.challengeBytes,
                                                                assertion_0.challengeSextets,
                                                                assertion_0.challengeTail4);
    const jsonPrefix_0 = new Uint8Array([123, 34, 116, 121, 112, 101, 34, 58, 34, 119, 101, 98, 97, 117, 116, 104, 110, 46, 103, 101, 116, 34, 44, 34, 99, 104, 97, 108, 108, 101, 110, 103, 101, 34, 58, 34]);
    const jsonMid_0 = new Uint8Array([34, 44, 34, 111, 114, 105, 103, 105, 110, 34, 58, 34]);
    const suffixCross_0 = new Uint8Array([34, 44, 34, 99, 114, 111, 115, 115, 79, 114, 105, 103, 105, 110, 34, 58, 102, 97, 108, 115, 101, 125]);
    const suffixPlain_0 = new Uint8Array([34, 125]);
    const suffixGrease_0 = new Uint8Array([34, 44, 34, 99, 114, 111, 115, 115, 79, 114, 105, 103, 105, 110, 34, 58, 102, 97, 108, 115, 101, 44, 34, 111, 116, 104, 101, 114, 95, 107, 101, 121, 115, 95, 99, 97, 110, 95, 98, 101, 95, 97, 100, 100, 101, 100, 95, 104, 101, 114, 101, 34, 58, 34, 100, 111, 32, 110, 111, 116, 32, 99, 111, 109, 112, 97, 114, 101, 32, 99, 108, 105, 101, 110, 116, 68, 97, 116, 97, 74, 83, 79, 78, 32, 97, 103, 97, 105, 110, 115, 116, 32, 97, 32, 116, 101, 109, 112, 108, 97, 116, 101, 46, 32, 83, 101, 101, 32, 104, 116, 116, 112, 115, 58, 47, 47, 103, 111, 111, 46, 103, 108, 47, 121, 97, 98, 80, 101, 120, 34, 125]);
    const hashCross_0 = this._persistentHash_1([jsonPrefix_0,
                                                chalB64_0,
                                                jsonMid_0,
                                                origin_0,
                                                suffixCross_0]);
    const hashPlain_0 = this._persistentHash_2([jsonPrefix_0,
                                                chalB64_0,
                                                jsonMid_0,
                                                origin_0,
                                                suffixPlain_0]);
    const hashGrease_0 = this._persistentHash_3([jsonPrefix_0,
                                                 chalB64_0,
                                                 jsonMid_0,
                                                 origin_0,
                                                 suffixGrease_0]);
    const clientDataHash_0 = assertion_0.clientDataMode === 0n ?
                             hashCross_0 :
                             assertion_0.clientDataMode === 1n ?
                             hashPlain_0 :
                             hashGrease_0;
    const signingDigest_0 = this._persistentHash_4([rpIdHash_0,
                                                    authFlags_0,
                                                    assertion_0.signCount,
                                                    clientDataHash_0]);
    __compactRuntime.assert(this._secp256r1EcdsaVerify_0(signingDigest_0,
                                                         assertion_0.signature,
                                                         pk_0),
                            'Invalid secp256r1 WebAuthn signature');
    return [];
  }
  _localPasskeyPub_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.callContext.currentQueryContext.state), context.callContext.currentPrivateState, context.callContext.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.localPasskeyPub(witnessContext_0);
    context.callContext.currentPrivateState = nextPrivateState_0;
    if (!(__compactRuntime.isValidSecp256r1Point(result_0))) {
      __compactRuntime.typeError('localPasskeyPub',
                                 'return value',
                                 'WalletlessCounter.compact line 19 char 1',
                                 'Secp256r1Point',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_15.toValue(result_0),
      alignment: _descriptor_15.alignment()
    });
    return result_0;
  }
  _localKeySalt_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.callContext.currentQueryContext.state), context.callContext.currentPrivateState, context.callContext.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.localKeySalt(witnessContext_0);
    context.callContext.currentPrivateState = nextPrivateState_0;
    if (!(result_0.buffer instanceof ArrayBuffer && result_0.BYTES_PER_ELEMENT === 1 && result_0.length === 32)) {
      __compactRuntime.typeError('localKeySalt',
                                 'return value',
                                 'WalletlessCounter.compact line 20 char 1',
                                 'Bytes<32>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_0.toValue(result_0),
      alignment: _descriptor_0.alignment()
    });
    return result_0;
  }
  _localWebAuthnAssertion_0(context, partialProofData) {
    const witnessContext_0 = __compactRuntime.createWitnessContext(ledger(context.callContext.currentQueryContext.state), context.callContext.currentPrivateState, context.callContext.currentQueryContext.address);
    const [nextPrivateState_0, result_0] = this.witnesses.localWebAuthnAssertion(witnessContext_0);
    context.callContext.currentPrivateState = nextPrivateState_0;
    if (!(typeof(result_0) === 'object' && typeof(result_0.signature) === 'object' && typeof(result_0.signature.r) === 'bigint' && result_0.signature.r >= 0 && result_0.signature.r <= __compactRuntime.MAX_SECP256R1_SCALAR && typeof(result_0.signature.s) === 'bigint' && result_0.signature.s >= 0 && result_0.signature.s <= __compactRuntime.MAX_SECP256R1_SCALAR && typeof(result_0.flagsUp) === 'boolean' && typeof(result_0.flagsRfu1) === 'boolean' && typeof(result_0.flagsUv) === 'boolean' && typeof(result_0.flagsUpper) === 'bigint' && result_0.flagsUpper >= 0n && result_0.flagsUpper <= 31n && result_0.signCount.buffer instanceof ArrayBuffer && result_0.signCount.BYTES_PER_ELEMENT === 1 && result_0.signCount.length === 4 && Array.isArray(result_0.challengeBytes) && result_0.challengeBytes.length === 32 && result_0.challengeBytes.every((t) => typeof(t) === 'bigint' && t >= 0n && t <= 255n) && Array.isArray(result_0.challengeSextets) && result_0.challengeSextets.length === 43 && result_0.challengeSextets.every((t) => typeof(t) === 'bigint' && t >= 0n && t <= 63n) && typeof(result_0.challengeTail4) === 'bigint' && result_0.challengeTail4 >= 0n && result_0.challengeTail4 <= 15n && typeof(result_0.clientDataMode) === 'bigint' && result_0.clientDataMode >= 0n && result_0.clientDataMode <= 3n)) {
      __compactRuntime.typeError('localWebAuthnAssertion',
                                 'return value',
                                 'WalletlessCounter.compact line 21 char 1',
                                 'struct WebAuthnAssertion<signature: struct Secp256r1EcdsaSignature<r: Secp256r1Scalar, s: Secp256r1Scalar>, flagsUp: Boolean, flagsRfu1: Boolean, flagsUv: Boolean, flagsUpper: Uint<0..32>, signCount: Bytes<4>, challengeBytes: Vector<32, Uint<0..256>>, challengeSextets: Vector<43, Uint<0..64>>, challengeTail4: Uint<0..16>, clientDataMode: Uint<0..4>>',
                                 result_0)
    }
    partialProofData.privateTranscriptOutputs.push({
      value: _descriptor_14.toValue(result_0),
      alignment: _descriptor_14.alignment()
    });
    return result_0;
  }
  async _increment_0(context, partialProofData, scopeId_0) {
    const pk_0 = this._localPasskeyPub_0(context, partialProofData);
    const salt_0 = this._localKeySalt_0(context, partialProofData);
    const assertion_0 = this._localWebAuthnAssertion_0(context, partialProofData);
    __compactRuntime.assert(this._equal_4(this._commitPasskey_0(pk_0, salt_0),
                                          _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                    partialProofData,
                                                                                                    [
                                                                                                     { dup: { n: 0 } },
                                                                                                     { idx: { cached: false,
                                                                                                              pushPath: false,
                                                                                                              path: [
                                                                                                                     { tag: 'value',
                                                                                                                       value: { value: _descriptor_8.toValue(2n),
                                                                                                                                alignment: _descriptor_8.alignment() } }] } },
                                                                                                     { popeq: { cached: false,
                                                                                                                result: undefined } }]).value)),
                            'Passkey does not match counter owner');
    const challenge_0 = this._deriveChallenge_0(new Uint8Array([116, 104, 117, 109, 98, 115, 101, 97, 108, 58, 99, 110, 116, 58, 118, 49]),
                                                _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                          partialProofData,
                                                                                                          [
                                                                                                           { dup: { n: 0 } },
                                                                                                           { idx: { cached: false,
                                                                                                                    pushPath: false,
                                                                                                                    path: [
                                                                                                                           { tag: 'value',
                                                                                                                             value: { value: _descriptor_8.toValue(0n),
                                                                                                                                      alignment: _descriptor_8.alignment() } }] } },
                                                                                                           { popeq: { cached: false,
                                                                                                                      result: undefined } }]).value),
                                                scopeId_0,
                                                new Uint8Array([105, 110, 99, 114, 101, 109, 101, 110, 116, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    this._verifyWebAuthnAssertion_0(pk_0,
                                    _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                              partialProofData,
                                                                                              [
                                                                                               { dup: { n: 0 } },
                                                                                               { idx: { cached: false,
                                                                                                        pushPath: false,
                                                                                                        path: [
                                                                                                               { tag: 'value',
                                                                                                                 value: { value: _descriptor_8.toValue(0n),
                                                                                                                          alignment: _descriptor_8.alignment() } }] } },
                                                                                               { popeq: { cached: false,
                                                                                                          result: undefined } }]).value),
                                    _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                              partialProofData,
                                                                                              [
                                                                                               { dup: { n: 0 } },
                                                                                               { idx: { cached: false,
                                                                                                        pushPath: false,
                                                                                                        path: [
                                                                                                               { tag: 'value',
                                                                                                                 value: { value: _descriptor_8.toValue(1n),
                                                                                                                          alignment: _descriptor_8.alignment() } }] } },
                                                                                               { popeq: { cached: false,
                                                                                                          result: undefined } }]).value),
                                    challenge_0,
                                    false,
                                    assertion_0);
    const nf_0 = this._deriveScopedNullifier_0(_descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                         partialProofData,
                                                                                                         [
                                                                                                          { dup: { n: 0 } },
                                                                                                          { idx: { cached: false,
                                                                                                                   pushPath: false,
                                                                                                                   path: [
                                                                                                                          { tag: 'value',
                                                                                                                            value: { value: _descriptor_8.toValue(2n),
                                                                                                                                     alignment: _descriptor_8.alignment() } }] } },
                                                                                                          { popeq: { cached: false,
                                                                                                                     result: undefined } }]).value),
                                               _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                                         partialProofData,
                                                                                                         [
                                                                                                          { dup: { n: 0 } },
                                                                                                          { idx: { cached: false,
                                                                                                                   pushPath: false,
                                                                                                                   path: [
                                                                                                                          { tag: 'value',
                                                                                                                            value: { value: _descriptor_8.toValue(0n),
                                                                                                                                     alignment: _descriptor_8.alignment() } }] } },
                                                                                                          { popeq: { cached: false,
                                                                                                                     result: undefined } }]).value),
                                               scopeId_0);
    const pubNf_0 = nf_0;
    __compactRuntime.assert(!_descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                                       partialProofData,
                                                                                       [
                                                                                        { dup: { n: 0 } },
                                                                                        { idx: { cached: false,
                                                                                                 pushPath: false,
                                                                                                 path: [
                                                                                                        { tag: 'value',
                                                                                                          value: { value: _descriptor_8.toValue(4n),
                                                                                                                   alignment: _descriptor_8.alignment() } }] } },
                                                                                        { push: { storage: false,
                                                                                                  value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(pubNf_0),
                                                                                                                                               alignment: _descriptor_0.alignment() }).encode() } },
                                                                                        'member',
                                                                                        { popeq: { cached: true,
                                                                                                   result: undefined } }]).value),
                            'Increment scope already used');
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_8.toValue(4n),
                                                                  alignment: _descriptor_8.alignment() } }] } },
                                       { push: { storage: false,
                                                 value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(pubNf_0),
                                                                                              alignment: _descriptor_0.alignment() }).encode() } },
                                       { push: { storage: true,
                                                 value: __compactRuntime.StateValue.newNull().encode() } },
                                       { ins: { cached: false, n: 1 } },
                                       { ins: { cached: true, n: 1 } }]);
    const tmp_0 = 1n;
    __compactRuntime.queryLedgerState(context,
                                      partialProofData,
                                      [
                                       { idx: { cached: false,
                                                pushPath: true,
                                                path: [
                                                       { tag: 'value',
                                                         value: { value: _descriptor_8.toValue(3n),
                                                                  alignment: _descriptor_8.alignment() } }] } },
                                       { addi: { immediate: parseInt(__compactRuntime.valueToBigInt(
                                                              { value: _descriptor_3.toValue(tmp_0),
                                                                alignment: _descriptor_3.alignment() }
                                                                .value
                                                            )) } },
                                       { ins: { cached: true, n: 1 } }]);
    return [];
  }
  _equal_0(x0, y0) {
    if (x0.identity) { return y0.identity; }
    if (y0.identity || x0.x != y0.x || x0.y != y0.y) {
      return false;
    }
    return true;
  }
  _equal_1(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
  _mapper_0(f, a0) {
    let a = [];
    for (let i = 0; i < 43; i++) { a[i] = f(a0[i]); }
    return a;
  }
  _equal_2(x0, y0) {
    if (x0.identity) { return y0.identity; }
    if (y0.identity || x0.x != y0.x || x0.y != y0.y) {
      return false;
    }
    return true;
  }
  _equal_3(x0, y0) {
    if (x0.identity) { return y0.identity; }
    if (y0.identity || x0.x != y0.x || x0.y != y0.y) {
      return false;
    }
    return true;
  }
  _equal_4(x0, y0) {
    if (!x0.every((x, i) => y0[i] === x)) { return false; }
    return true;
  }
}
export function ledger(stateOrChargedState) {
  const state = stateOrChargedState instanceof __compactRuntime.StateValue ? stateOrChargedState : stateOrChargedState.state;
  const chargedState = stateOrChargedState instanceof __compactRuntime.StateValue ? new __compactRuntime.ChargedState(stateOrChargedState) : stateOrChargedState;
  const context = {
    callContext: { currentQueryContext: new __compactRuntime.QueryContext(chargedState, __compactRuntime.dummyContractAddress()), currentGasCost: __compactRuntime.emptyRunningCost() },
    costModel: __compactRuntime.CostModel.initialCostModel()
  };
  const partialProofData = {
    input: { value: [], alignment: [] },
    output: undefined,
    publicTranscript: [],
    privateTranscriptOutputs: []
  };
  return {
    get rpIdHash() {
      return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_8.toValue(0n),
                                                                                                   alignment: _descriptor_8.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get origin() {
      return _descriptor_1.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_8.toValue(1n),
                                                                                                   alignment: _descriptor_8.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get ownerCommit() {
      return _descriptor_0.fromValue(__compactRuntime.queryLedgerState(context,
                                                                       partialProofData,
                                                                       [
                                                                        { dup: { n: 0 } },
                                                                        { idx: { cached: false,
                                                                                 pushPath: false,
                                                                                 path: [
                                                                                        { tag: 'value',
                                                                                          value: { value: _descriptor_8.toValue(2n),
                                                                                                   alignment: _descriptor_8.alignment() } }] } },
                                                                        { popeq: { cached: false,
                                                                                   result: undefined } }]).value);
    },
    get round() {
      return _descriptor_30.fromValue(__compactRuntime.queryLedgerState(context,
                                                                        partialProofData,
                                                                        [
                                                                         { dup: { n: 0 } },
                                                                         { idx: { cached: false,
                                                                                  pushPath: false,
                                                                                  path: [
                                                                                         { tag: 'value',
                                                                                           value: { value: _descriptor_8.toValue(3n),
                                                                                                    alignment: _descriptor_8.alignment() } }] } },
                                                                         { popeq: { cached: true,
                                                                                    result: undefined } }]).value);
    },
    usedNonces: {
      isEmpty(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`isEmpty: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_8.toValue(4n),
                                                                                                     alignment: _descriptor_8.alignment() } }] } },
                                                                          'size',
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_30.toValue(0n),
                                                                                                                                 alignment: _descriptor_30.alignment() }).encode() } },
                                                                          'eq',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      size(...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`size: expected 0 arguments, received ${args_0.length}`);
        }
        return _descriptor_30.fromValue(__compactRuntime.queryLedgerState(context,
                                                                          partialProofData,
                                                                          [
                                                                           { dup: { n: 0 } },
                                                                           { idx: { cached: false,
                                                                                    pushPath: false,
                                                                                    path: [
                                                                                           { tag: 'value',
                                                                                             value: { value: _descriptor_8.toValue(4n),
                                                                                                      alignment: _descriptor_8.alignment() } }] } },
                                                                           'size',
                                                                           { popeq: { cached: true,
                                                                                      result: undefined } }]).value);
      },
      member(...args_0) {
        if (args_0.length !== 1) {
          throw new __compactRuntime.CompactError(`member: expected 1 argument, received ${args_0.length}`);
        }
        const elem_0 = args_0[0];
        if (!(elem_0.buffer instanceof ArrayBuffer && elem_0.BYTES_PER_ELEMENT === 1 && elem_0.length === 32)) {
          __compactRuntime.typeError('member',
                                     'argument 1',
                                     'WalletlessCounter.compact line 17 char 1',
                                     'Bytes<32>',
                                     elem_0)
        }
        return _descriptor_2.fromValue(__compactRuntime.queryLedgerState(context,
                                                                         partialProofData,
                                                                         [
                                                                          { dup: { n: 0 } },
                                                                          { idx: { cached: false,
                                                                                   pushPath: false,
                                                                                   path: [
                                                                                          { tag: 'value',
                                                                                            value: { value: _descriptor_8.toValue(4n),
                                                                                                     alignment: _descriptor_8.alignment() } }] } },
                                                                          { push: { storage: false,
                                                                                    value: __compactRuntime.StateValue.newCell({ value: _descriptor_0.toValue(elem_0),
                                                                                                                                 alignment: _descriptor_0.alignment() }).encode() } },
                                                                          'member',
                                                                          { popeq: { cached: true,
                                                                                     result: undefined } }]).value);
      },
      [Symbol.iterator](...args_0) {
        if (args_0.length !== 0) {
          throw new __compactRuntime.CompactError(`iter: expected 0 arguments, received ${args_0.length}`);
        }
        const self_0 = state.asArray()[4];
        return self_0.asMap().keys().map((elem) => _descriptor_0.fromValue(elem.value))[Symbol.iterator]();
      }
    }
  };
}
const _emptyContext = {
  callContext: { currentQueryContext: new __compactRuntime.QueryContext(new __compactRuntime.ContractState().data, __compactRuntime.dummyContractAddress()), currentGasCost: __compactRuntime.emptyRunningCost() }
};
const _dummyContract = new Contract({
  localPasskeyPub: (...args) => undefined,
  localKeySalt: (...args) => undefined,
  localWebAuthnAssertion: (...args) => undefined
});
export const pureCircuits = {};
export const expectedVk = {
  'increment': '784b8258babf952ef88a4da488c0afa4d3a1ec4e44e4a0b2dcc2fddc77bf239d',
};

export const circuitSignatures = {
  'increment': {pure: false, provable: true, argumentTypes: [{tag: 'Bytes', length: 32}], resultType: {tag: 'Tuple', types: []}},
};

export const declaredInterfaces = {};

//# sourceMappingURL=index.js.map
