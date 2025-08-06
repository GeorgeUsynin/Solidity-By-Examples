import { loadFixture, ethers, expect } from '../setup';

describe('DemoAccess', function () {
  async function deploy() {
    const [admin, withdrawer, user1, user2] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('DemoAccess');
    const demoAccess = await Factory.deploy(withdrawer.address);
    await demoAccess.waitForDeployment();

    const WITHDRAWER_ROLE = await demoAccess.WITHDRAWER_ROLE();
    const DEFAULT_ADMIN_ROLE = await demoAccess.DEFAULT_ADMIN_ROLE();

    return {
      demoAccess,
      admin,
      withdrawer,
      user1,
      user2,
      WITHDRAWER_ROLE,
      DEFAULT_ADMIN_ROLE,
    };
  }

  it('allows withdrawer to withdraw funds', async function () {
    const { demoAccess, withdrawer, user1 } = await loadFixture(deploy);

    const withdrawTx = await demoAccess.connect(withdrawer).withdraw();
    await withdrawTx.wait();

    await expect(
      demoAccess.connect(user1).withdraw(),
    ).to.be.revertedWithCustomError(demoAccess, 'NoSuchRole');
  });

  it('only admin grants withdrawer roles', async function () {
    const { demoAccess, withdrawer, user1, user2, WITHDRAWER_ROLE } =
      await loadFixture(deploy);

    const grantWithdrawerTx = await demoAccess.grantRole(
      WITHDRAWER_ROLE,
      user1.address,
    );
    await grantWithdrawerTx.wait();

    const withdrawTx = await demoAccess.connect(user1).withdraw();
    await withdrawTx.wait();

    await expect(
      demoAccess.connect(withdrawer).grantRole(WITHDRAWER_ROLE, user2.address),
    ).to.be.revertedWithCustomError(demoAccess, 'NoSuchRole');
  });

  it('cannot revoke yourself from the role if you are the last one member', async function () {
    const { demoAccess, admin, DEFAULT_ADMIN_ROLE } = await loadFixture(deploy);

    await expect(
      demoAccess.revokeRole(DEFAULT_ADMIN_ROLE, admin.address),
    ).to.be.revertedWithCustomError(demoAccess, 'TransferRoleToAnotherAccount');
  });
});
