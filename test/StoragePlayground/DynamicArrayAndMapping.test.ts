import { loadFixture, ethers, expect } from '../setup';

const ARR = [10n, 20n] as [bigint, bigint];

describe('DynamicArrayAndMapping', function () {
  async function deploy() {
    const [owner] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('DynamicArrayAndMapping');
    const dynamicArrayAndMapping = await Factory.deploy(ARR);
    await dynamicArrayAndMapping.waitForDeployment();

    return { dynamicArrayAndMapping, owner };
  }

  it('shows values for dynamic array', async function () {
    const { dynamicArrayAndMapping } = await loadFixture(deploy);
    /**
     * Slot 1 (main slot) stores the **length** of the dynamic array.
     * --------------------------------------------------
     * To access the actual elements of the array, Solidity uses a calculated offset:
     *
     *    keccak256(p)
     *
     * where `p` is the storage slot number where the array is declared (in this case, slot 1).
     *
     * The result of `keccak256(p)` gives the **starting storage slot** for the array’s data.
     * Each subsequent element is stored at:
     *
     *    keccak256(p) + i
     *
     * where `i` is the index of the element.
     */
    const pos = ethers.solidityPackedKeccak256(['uint'], [1]);
    // Both variants are fine and show the same result
    const nexPositionAsInteger = ethers.toBigInt(pos) + 1n;
    const nextPosAsHex32 = ethers.toBeHex(nexPositionAsInteger, 32);

    const slots = [0, 1, pos, nextPosAsHex32];
    const expects = [100n, 2n, 10n, 20n];

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const expected = expects[i];

      const value = await ethers.provider.getStorage(
        dynamicArrayAndMapping.target,
        slot,
      );

      expect(value).to.eq(ethers.toBeHex(expected, 32));
    }
  });

  it('shows values for mapping', async function () {
    const { dynamicArrayAndMapping, owner } = await loadFixture(deploy);
    /**
     * Slot 2 (main slot) stores the **length** of the mapping !BUT! it will be always zero!!!.
     * --------------------------------------------------
     * To access the actual values of the mapping, Solidity uses a calculated offset:
     *
     *    keccak256(key CONCAT p)
     *
     * where `p` is the storage slot number where the mapping is declared (in this case, slot 2),
     * and key is the actual key of our mapping.
     *
     * The result of `keccak256(key CONCAT p)` gives the **storage slot** for the mappings’s data.
     */
    const pos = ethers.solidityPackedKeccak256(
      ['uint', 'uint'],
      [dynamicArrayAndMapping.target, 2],
    );

    const nonExistentPos = ethers.solidityPackedKeccak256(
      ['uint', 'uint'],
      [owner.address, 2],
    );

    const slots = [0, 1, 2, pos, nonExistentPos];
    const expects = [100n, 2n, 0, 100n, 0];

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const expected = expects[i];

      const value = await ethers.provider.getStorage(
        dynamicArrayAndMapping.target,
        slot,
      );

      expect(value).to.eq(ethers.toBeHex(expected, 32));
    }
  });
});
