import { loadFixture, ethers, expect, time, mine } from './setup';

describe('Payments', function () {
  async function deploy() {
    const [owner, receiver] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('Payments');
    const payments = await Factory.deploy({
      value: ethers.parseUnits('50', 'ether'),
    });
    await payments.waitForDeployment();

    return { payments, owner, receiver };
  }

  it('signs and claims the funds', async function () {
    const { payments, owner, receiver } = await loadFixture(deploy);

    const amount = ethers.parseUnits('20', 'ether');
    const nonce = 1;

    const hash = ethers.solidityPackedKeccak256(
      ['address', 'uint256', 'uint256', 'address'],
      [receiver.address, amount, nonce, payments.target],
    );

    //If the %%message%% is a string, it is signed as UTF-8 encoded bytes. It is not interpreted as a [[BytesLike]]; so the string "0x1234" is signed as six characters, not two bytes.
    //To sign that example as two bytes, the Uint8Array should be used (i.e. new Uint8Array([ 0x12, 0x34 ])) or ethers.getBytes).
    const signature = await owner.signMessage(ethers.getBytes(hash));

    const tx = await payments.connect(receiver).claim(amount, nonce, signature);
    await tx.wait();

    await expect(tx).to.changeEtherBalance(receiver, amount);

    await expect(
      payments.connect(receiver).claim(amount, nonce, signature),
    ).to.be.revertedWithCustomError(payments, 'NonceAlreadyInUse');
  });
});
