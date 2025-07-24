import { loadFixture, ethers, expect, mine, time } from './setup';
import { GovernToken } from '../typechain-types';
import type { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import type { AddressLike, EventLog } from 'ethers';

async function transferWithDecimals(
  token: GovernToken,
  sender: SignerWithAddress,
  receiver: AddressLike,
  baseAmount: bigint,
) {
  const decimals = await token.decimals();

  const transferTx = await token
    .connect(sender)
    .transfer(receiver, baseAmount * 10n ** decimals);
  await transferTx.wait();
}
describe('GeorgeGovernor', function () {
  async function deploy() {
    const [admin, user1, user2] = await ethers.getSigners();

    const tokenName = 'GeorgeCoin';
    const tokenSymbol = 'GRC';

    // deploying our own token which we will use as a voting power
    const GovernToken = await ethers.getContractFactory('GovernToken');
    const governToken = await GovernToken.deploy(tokenName, tokenSymbol);
    await governToken.waitForDeployment();

    // deploying timelock controller with minDelay = 3600 seconds
    const TimelockGovernance =
      await ethers.getContractFactory('TimelockGovernance');
    const timelockGovernance = await TimelockGovernance.deploy(
      3600,
      [],
      [],
      admin.address,
    );
    await timelockGovernance.waitForDeployment();

    // deploying governor contract
    const GeorgeGovernor = await ethers.getContractFactory('GeorgeGovernor');
    const georgeGovernor = await GeorgeGovernor.deploy(
      governToken.target,
      timelockGovernance.target,
    );
    await georgeGovernor.waitForDeployment();

    // granting proposer role to governor contract, to be sure that only governor contract can queue proposal
    const grantPropRole = await timelockGovernance.grantRole(
      await timelockGovernance.PROPOSER_ROLE(),
      georgeGovernor.target,
    );
    await grantPropRole.wait();

    // setting zero address as an executor because it's safe to execute proposal (because under the hood we validate all cases (min delay, etc.))
    const grantExecRole = await timelockGovernance.grantRole(
      await timelockGovernance.EXECUTOR_ROLE(),
      ethers.ZeroAddress,
    );
    await grantExecRole.wait();

    // renounce admin role that admin can't queue transactions and somehow affect on timelock contract
    const renounceAdminRole = await timelockGovernance.renounceRole(
      await timelockGovernance.DEFAULT_ADMIN_ROLE(),
      admin.address,
    );
    await renounceAdminRole.wait();

    const MyContract = await ethers.getContractFactory('MyContract');
    const myContract = await MyContract.deploy(timelockGovernance.target, {
      value: ethers.parseEther('2.0'),
    });
    await myContract.waitForDeployment();

    return {
      governToken,
      timelockGovernance,
      georgeGovernor,
      myContract,
      admin,
      user1,
      user2,
    };
  }

  it('works', async function () {
    const {
      governToken,
      timelockGovernance,
      georgeGovernor,
      myContract,
      admin,
      user1,
      user2,
    } = await loadFixture(deploy);

    const storageBalance = ethers.parseEther('2.0');
    expect(await ethers.provider.getBalance(myContract.target)).to.eq(
      storageBalance,
    );

    // transfer GRC tokens to users
    await transferWithDecimals(governToken, admin, user1.address, 15n);
    await transferWithDecimals(governToken, admin, user2.address, 25n);

    // users should delegate their tokens in order to vote for proposal
    // without delegation they can't vote because during delegate we are doing snapshot of user's tokens amount
    // in that case we will be sure that the user will not somehow cheat with his voting power (token amount)
    // P.S. user can delegate his tokens to other users
    const del1 = await governToken.connect(user1).delegate(user1.address);
    await del1.wait();

    const del2 = await governToken.connect(user2).delegate(user2.address);
    await del2.wait();

    const del3 = await governToken.connect(admin).delegate(user2.address);
    await del3.wait();

    // after delegation we can check number of checkpoints (number of delegations) to particular user
    expect(await governToken.numCheckpoints(user1.address)).to.eq(1);
    expect(await governToken.numCheckpoints(user2.address)).to.eq(2);

    const storeValueFuncCall = myContract.interface.encodeFunctionData(
      'storeValue',
      [43],
    );
    const sendMoneyFuncCall = myContract.interface.encodeFunctionData(
      'sendMoney',
      [user2.address, storageBalance],
    );

    const targets = [myContract.target, myContract.target];
    const values = [0, 0];
    const calldatas = [storeValueFuncCall, sendMoneyFuncCall];
    const description = "Let's store 43 and send money to user2!";
    const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(description));

    // making a proposal
    const proposeTx = await georgeGovernor.propose(
      targets,
      values,
      calldatas,
      description,
    );
    const proposalReceipt = await proposeTx.wait();
    const proposalId = (proposalReceipt?.logs[0] as EventLog).args[0];

    // checking validity of proposalId
    const expectedProposalId = await georgeGovernor.hashProposal(
      targets,
      values,
      calldatas,
      descriptionHash,
    );
    expect(expectedProposalId).to.eq(proposalId);

    // since voting didn't start yet, we will see a custom error GovernorUnexpectedProposalState, where 0 => Pending
    await expect(
      georgeGovernor
        .connect(user1)
        .castVoteWithReason(proposalId, 1, 'I like it!'),
    )
      .to.be.revertedWithCustomError(
        georgeGovernor,
        'GovernorUnexpectedProposalState',
      )
      .withArgs(
        proposalId,
        0,
        '0x0000000000000000000000000000000000000000000000000000000000000002',
      );

    // waiting for initialVotingDelay + 1
    await mine((await georgeGovernor.votingDelay()) + 1n);

    // voting
    const vote1 = await georgeGovernor
      .connect(user1)
      .castVoteWithReason(proposalId, 1, 'I like it!');
    await vote1.wait();
    const vote2 = await georgeGovernor
      .connect(user2)
      .castVoteWithReason(proposalId, 1, 'I like it!');
    await vote2.wait();

    expect(await georgeGovernor.hasVoted(proposalId, user1.address)).to.eq(
      true,
    );

    // how to check voting power using proposalSnapshot
    const proposalSnapshot = await georgeGovernor.proposalSnapshot(proposalId);
    const user1VotingPower = await georgeGovernor.getVotes(
      user1.address,
      proposalSnapshot,
    );
    const user2VotingPower = await georgeGovernor.getVotes(
      user2.address,
      proposalSnapshot,
    );
    // console.log('user1VotingPower: ', user1VotingPower);
    // console.log('user2VotingPower: ', user2VotingPower);

    await mine((await georgeGovernor.votingPeriod()) + 1n);

    // checking that the voting was succeeded 0 => Succeeded
    expect(await georgeGovernor.state(proposalId)).to.eq(4);

    // queuing proposal
    const queueTx = await georgeGovernor.queue(
      targets,
      values,
      calldatas,
      descriptionHash,
    );
    await queueTx.wait();

    // after queuing proposal our executor will be TimeLock contract
    // expecting custom error because we have 3600 seconds delay before proposal execution
    await expect(
      georgeGovernor
        .connect(user1)
        .execute(targets, values, calldatas, descriptionHash),
    ).to.be.revertedWithCustomError(
      timelockGovernance,
      'TimelockUnexpectedOperationState',
    );

    // let's wait for 3600 seconds and execute proposal
    // since executor can be any address we will pick user1 as an executor

    await time.increase((await timelockGovernance.getMinDelay()) + 1n);
    const executeTx = await georgeGovernor
      .connect(user1)
      .execute(targets, values, calldatas, descriptionHash);
    await executeTx.wait();

    // let's check the values in our myContract, prooving that proposal was executed right
    expect(await myContract.readValue()).to.eq(43);
    await expect(executeTx).to.changeEtherBalances(
      [myContract.target, user2.address],
      [-storageBalance, storageBalance],
    );
  });
});
