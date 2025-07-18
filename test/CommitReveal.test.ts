import { loadFixture, ethers, expect, time, mine } from './setup';

const secret = 'abracadabra';
const candidates = [
  '0xfee31c09fa5e9cdbc1f80c90b42b58640be91ddf',
  '0xb423b53d9076b325c0248d62ef74b11adc211020',
  '0xcf0475d9b0a29975bc5132a3066010ec898d8cab',
];
const encodedSecret = ethers.encodeBytes32String(secret);

describe('CommitReveal', function () {
  async function deploy() {
    const [owner, ...users] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('CommitReveal');
    const commitReveal = await Factory.deploy(candidates);
    await commitReveal.waitForDeployment();

    return { commitReveal, owner, users };
  }

  function hashVote(
    senderAddress: string,
    candidateAddress: string,
    secret: string,
  ) {
    const encodedStr = ethers.encodeBytes32String(secret);

    return ethers.solidityPackedKeccak256(
      ['address', 'address', 'bytes32'],
      [senderAddress, candidateAddress, encodedStr],
    );
  }

  it('shows proper voting results', async function () {
    const { commitReveal, owner, users } = await loadFixture(deploy);

    const hashedVote1 = hashVote(owner.address, candidates[1], secret);
    const hashedVote2 = hashVote(users[0].address, candidates[1], secret);
    const hashedVote3 = hashVote(users[1].address, candidates[2], secret);

    // committing votes
    await commitReveal.commitVote(hashedVote1);
    await commitReveal.connect(users[0]).commitVote(hashedVote2);
    await commitReveal.connect(users[1]).commitVote(hashedVote3);

    // stopping voting
    await commitReveal.stopVoting();

    // revealing votes
    await commitReveal.revealVote(candidates[1], encodedSecret);
    await commitReveal
      .connect(users[0])
      .revealVote(candidates[1], encodedSecret);
    await commitReveal
      .connect(users[1])
      .revealVote(candidates[2], encodedSecret);

    expect(await commitReveal.votes(candidates[1])).to.eq(2);
    expect(await commitReveal.votes(candidates[2])).to.eq(1);
  });

  it('shows `AlreadyVoted` error if the user wants to vote again', async function () {
    const { commitReveal, owner } = await loadFixture(deploy);

    const hashedVote1 = hashVote(owner.address, candidates[1], secret);
    await commitReveal.commitVote(hashedVote1);

    await expect(
      commitReveal.commitVote(hashedVote1),
    ).to.be.revertedWithCustomError(commitReveal, 'AlreadyVoted');
  });

  it('shows `HashMismatch` error if the user reveals with different vote', async function () {
    const { commitReveal, owner } = await loadFixture(deploy);

    const hashedVote1 = hashVote(owner.address, candidates[1], secret);
    await commitReveal.commitVote(hashedVote1);

    await commitReveal.stopVoting();

    await expect(
      commitReveal.revealVote(candidates[0], encodedSecret),
    ).to.be.revertedWithCustomError(commitReveal, 'HashMismatch');
  });
});
