import { loadFixture, ethers, expect, time, mine } from './setup';
import type { AbiCoder, EventLog } from 'ethers';
import type { TestTimelock } from '../typechain-types';

describe('Timelock', function () {
  async function deploy() {
    const [owner, user1, user2] = await ethers.getSigners();
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    const timeLockFactory = await ethers.getContractFactory('Timelock');
    const timelock = await timeLockFactory.deploy();
    await timelock.waitForDeployment();

    const testTimelockFactory = await ethers.getContractFactory('TestTimelock');
    const testTimelock = await testTimelockFactory.deploy();
    await testTimelock.waitForDeployment();

    return { timelock, testTimelock, owner, user1, user2, abiCoder };
  }

  async function getCurrentTimestamp() {
    const blockNumber = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNumber);
    return block!.timestamp;
  }

  async function buildTxParams(
    testTimelock: TestTimelock,
    abiCoder: AbiCoder,
    timestampOffset = 0,
  ) {
    const to = testTimelock.target;
    const func = 'sendMsg(string)';
    const value = 1500;
    const encodedData = abiCoder.encode(['string'], ['Hello George!']);
    const timestamp = (await getCurrentTimestamp()) + timestampOffset;
    return { to, func, encodedData, value, timestamp };
  }

  it('adds and executes transaction', async function () {
    const { timelock, testTimelock, abiCoder, owner } =
      await loadFixture(deploy);

    const { to, func, encodedData, value, timestamp } = await buildTxParams(
      testTimelock,
      abiCoder,
      100,
    );

    expect(await testTimelock.message()).to.eq('');
    expect(await testTimelock.amount()).to.eq(0);

    await timelock.addToQueue(to, func, encodedData, value, timestamp);

    await expect(
      timelock.addToQueue(to, func, encodedData, value, timestamp),
    ).to.be.revertedWithCustomError(timelock, 'TransactionAlreadyQueued');

    await time.increase(200);
    await mine();

    const execTx = await timelock.execute(
      to,
      func,
      encodedData,
      value,
      timestamp,
      { value },
    );
    await execTx.wait();

    expect(await testTimelock.message()).to.eq('Hello George!');
    expect(await testTimelock.amount()).to.eq(value);
    await expect(execTx).to.changeEtherBalance(owner, -value);

    await expect(
      timelock.execute(to, func, encodedData, value, timestamp, { value }),
    ).to.be.revertedWithCustomError(timelock, 'NoTransactionInTheQueue');
  });

  it('reverts transaction with `Too early for execution!` or `Transaction expired!` error', async function () {
    const { timelock, testTimelock, abiCoder } = await loadFixture(deploy);

    const { to, func, encodedData, value, timestamp } = await buildTxParams(
      testTimelock,
      abiCoder,
      100,
    );

    await timelock.addToQueue(to, func, encodedData, value, timestamp);

    await time.increase(50);
    await mine();

    await expect(
      timelock.execute(to, func, encodedData, value, timestamp, { value }),
    ).to.be.revertedWithCustomError(timelock, 'TooEarlyExecution');

    await time.increase(87400);
    await mine();

    await expect(
      timelock.execute(to, func, encodedData, value, timestamp, { value }),
    ).to.be.revertedWithCustomError(timelock, 'TransactionExpired');
  });

  it('discards transaction from the queue', async function () {
    const { timelock, testTimelock, abiCoder } = await loadFixture(deploy);

    const { to, func, encodedData, value, timestamp } = await buildTxParams(
      testTimelock,
      abiCoder,
      100,
    );

    const tx = await timelock.addToQueue(
      to,
      func,
      encodedData,
      value,
      timestamp,
    );
    const receipt = await tx.wait();
    const eventLogs = receipt?.logs;
    const txId = (
      eventLogs?.find(
        (log) =>
          (log as EventLog).fragment.type === 'event' &&
          (log as EventLog).fragment.name === 'Queued',
      )! as EventLog
    ).args[0];

    expect(await timelock.queue(txId)).to.eq(true);

    await timelock.discard(txId);

    expect(await timelock.queue(txId)).to.eq(false);

    await expect(timelock.discard(txId))
      .to.be.revertedWithCustomError(timelock, 'NoTransactionInTheQueue')
      .withArgs(txId);
  });

  it('checks that only owner can run the function', async function () {
    const { timelock, testTimelock, abiCoder, user1 } =
      await loadFixture(deploy);

    const { to, func, encodedData, value, timestamp } = await buildTxParams(
      testTimelock,
      abiCoder,
      100,
    );

    await expect(
      timelock
        .connect(user1)
        .addToQueue(to, func, encodedData, value, timestamp),
    )
      .to.be.revertedWithCustomError(timelock, 'InvalidOwner')
      .withArgs(user1.address);
  });
});
