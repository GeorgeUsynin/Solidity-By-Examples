import { loadFixture, ethers, expect } from './setup';

const VERIFIED_TRANSACTION = 'TX3: George => Bob';
const TRANSACTIONS = [
  'TX1: John => Mary',
  'TX2: Mary => John',
  VERIFIED_TRANSACTION,
  'TX4: Bob => George',
];
const INVALID_TRANSACTION = 'TX3: George => Bob!';
const VERIFIED_TRANSACTION_INDEX = 2;

describe('MerkleTree', function () {
  async function deploy() {
    await ethers.getSigners();

    const Factory = await ethers.getContractFactory('MerkleTree');
    const merkleTree = await Factory.deploy(TRANSACTIONS);
    await merkleTree.waitForDeployment();

    return { merkleTree };
  }

  it('verifies TX3 transaction', async function () {
    const { merkleTree } = await loadFixture(deploy);

    const [rootHash, TX4Hash, TX1_2Hash] = await Promise.all([
      merkleTree.hashes(6),
      merkleTree.hashes(3),
      merkleTree.hashes(4),
    ]);
    const proofArr = [TX4Hash, TX1_2Hash];

    const isValid = await merkleTree.verify(
      VERIFIED_TRANSACTION,
      VERIFIED_TRANSACTION_INDEX,
      rootHash,
      proofArr,
    );

    expect(isValid).to.eq(true);
  });

  it('verifies INVALID transaction', async function () {
    const { merkleTree } = await loadFixture(deploy);

    const [rootHash, TX4Hash, TX1_2Hash] = await Promise.all([
      merkleTree.hashes(6),
      merkleTree.hashes(3),
      merkleTree.hashes(4),
    ]);
    const proofArr = [TX4Hash, TX1_2Hash];

    const isValid = await merkleTree.verify(
      INVALID_TRANSACTION,
      VERIFIED_TRANSACTION_INDEX,
      rootHash,
      proofArr,
    );

    expect(isValid).to.eq(false);
  });
});
