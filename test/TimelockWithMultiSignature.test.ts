import { loadFixture, ethers, expect, time, mine } from './setup';
import type { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import type { AbiCoder, EventLog, Addressable } from 'ethers';
import type {
  TestTimelockWithMultiSignature,
  TimelockWithMultiSignature,
} from '../typechain-types';

type TParams = {
  to: string | Addressable;
  func: string;
  encodedData: string;
  value: number;
  timestamp: number;
};

describe('TimelockWithMultiSignature', function () {
  async function deploy() {
    const [owner, owner1, owner2, user1] = await ethers.getSigners();
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    const timelockWMSFactory = await ethers.getContractFactory(
      'TimelockWithMultiSignature',
    );
    const timelockWMS = await timelockWMSFactory.deploy([
      owner.address,
      owner1.address,
      owner2.address,
    ]);
    await timelockWMS.waitForDeployment();

    const testTimelockWMSFactory = await ethers.getContractFactory(
      'TestTimelockWithMultiSignature',
    );
    const testTimelockWMS = await testTimelockWMSFactory.deploy();
    await testTimelockWMS.waitForDeployment();

    return {
      timelockWMS,
      testTimelockWMS,
      owners: [owner, owner1, owner2],
      user1,
      abiCoder,
    };
  }

  async function getCurrentTimestamp() {
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    return block!.timestamp;
  }

  async function buildTxParams(
    testTimelockWMS: TestTimelockWithMultiSignature,
    abiCoder: AbiCoder,
    timestampOffset = 0,
  ) {
    const to = testTimelockWMS.target;
    const func = 'sendMsg(string)';
    const value = 1500;
    const encodedData = abiCoder.encode(['string'], ['Hello George!']);
    const timestamp = (await getCurrentTimestamp()) + timestampOffset;
    return { to, func, encodedData, value, timestamp };
  }

  async function addTxToQueue(
    timelockWMS: TimelockWithMultiSignature,
    owners: HardhatEthersSigner[],
    params: TParams,
    confirmations = 0,
  ) {
    const { to, func, encodedData, value, timestamp } = params;
    const tx = await timelockWMS.addToQueue(
      to,
      func,
      encodedData,
      value,
      timestamp,
    );
    const receipt = await tx.wait();
    const eventLogs = receipt?.logs;
    const transactionEventArgs = (
      eventLogs?.find(
        (log) =>
          (log as EventLog).fragment.type === 'event' &&
          (log as EventLog).fragment.name === 'Queued',
      )! as EventLog
    ).args[0];

    for (let i = 0; i < confirmations; i++) {
      await timelockWMS.connect(owners[i]).confirm(transactionEventArgs[0]);
    }

    return transactionEventArgs;
  }

  async function executeTx(
    timelockWMS: TimelockWithMultiSignature,
    params: TParams,
  ) {
    const { to, func, encodedData, value, timestamp } = params;
    const execTx = await timelockWMS.execute(
      to,
      func,
      encodedData,
      value,
      timestamp,
      { value },
    );

    return execTx;
  }

  it('adds and executes transaction with enough confirmations', async function () {
    const { timelockWMS, testTimelockWMS, abiCoder, owners } =
      await loadFixture(deploy);

    const params = await buildTxParams(testTimelockWMS, abiCoder, 100);
    const confirmationsNumber = 3;

    expect(await testTimelockWMS.message()).to.eq('');
    expect(await testTimelockWMS.amount()).to.eq(0);

    const [txId] = await addTxToQueue(
      timelockWMS,
      owners,
      params,
      confirmationsNumber,
    );

    await expect(
      addTxToQueue(timelockWMS, owners, params, 3),
    ).to.be.revertedWithCustomError(timelockWMS, 'TransactionAlreadyQueued');

    await time.increase(200);
    await mine();

    const execTx = await executeTx(timelockWMS, params);
    await execTx.wait();

    expect(await testTimelockWMS.message()).to.eq('Hello George!');
    expect(await testTimelockWMS.amount()).to.eq(params.value);
    await expect(execTx).to.changeEtherBalance(owners[0], -params.value);

    await expect(executeTx(timelockWMS, params)).to.be.revertedWithCustomError(
      timelockWMS,
      'NoTransactionInTheQueue',
    );
  });

  it('reverts transaction with `TooEarlyForExecution` or `TransactionExpired` error', async function () {
    const { timelockWMS, testTimelockWMS, abiCoder, owners } =
      await loadFixture(deploy);

    const params = await buildTxParams(testTimelockWMS, abiCoder, 100);
    const confirmationsNumber = 3;

    await addTxToQueue(timelockWMS, owners, params, confirmationsNumber);

    await time.increase(50);
    await mine();

    await expect(executeTx(timelockWMS, params)).to.be.revertedWithCustomError(
      timelockWMS,
      'TooEarlyForExecution',
    );

    await time.increase(87400);
    await mine();

    await expect(executeTx(timelockWMS, params)).to.be.revertedWithCustomError(
      timelockWMS,
      'TransactionExpired',
    );
  });

  it('reverts transaction if there are not enough confirmations (<3)', async function () {
    const { timelockWMS, testTimelockWMS, abiCoder, owners } =
      await loadFixture(deploy);

    const params = await buildTxParams(testTimelockWMS, abiCoder, 100);
    const confirmationsNumber = 2;

    await addTxToQueue(timelockWMS, owners, params, confirmationsNumber);

    await time.increase(200);
    await mine();

    await expect(executeTx(timelockWMS, params))
      .to.be.revertedWithCustomError(timelockWMS, 'NotEnoughConfirmations')
      .withArgs(confirmationsNumber);
  });

  it('discards transaction from the queue', async function () {
    const { timelockWMS, testTimelockWMS, abiCoder, owners } =
      await loadFixture(deploy);

    const params = await buildTxParams(testTimelockWMS, abiCoder, 100);
    const confirmationsNumber = 3;

    const [txId] = await addTxToQueue(
      timelockWMS,
      owners,
      params,
      confirmationsNumber,
    );

    expect((await timelockWMS.txs(txId)).queued).to.eq(true);
    // discarding tx
    await timelockWMS.discard(txId);
    expect((await timelockWMS.txs(txId)).queued).to.eq(false);
    await expect(timelockWMS.discard(txId)).to.be.revertedWithCustomError(
      timelockWMS,
      'NoTransactionInTheQueue',
    );
  });
});
