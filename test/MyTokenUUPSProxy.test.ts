import { loadFixture, ethers, expect, upgrades } from './setup';

describe('MyTokenUUPSProxy', function () {
  async function deploy() {
    const [owner] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('MyTokenUUPSProxy');
    // deployProxy will deploy MyTokenTransparentProxy contract and appropriate proxy for this MyTokenUUPSProxy contract
    // basically `token` - is our proxy contract that will delegate invocation on MyTokenUUPSProxy contract in context of proxy contract
    const token = await upgrades.deployProxy(Factory, [owner.address], {
      initializer: 'initialize',
      kind: 'uups',
    });
    await token.waitForDeployment();

    return { owner, token };
  }

  it('works', async function () {
    const { token, owner } = await loadFixture(deploy);

    const mintTx = await token.safeMint(owner.address, 0, 'myUri');
    await mintTx.wait();

    expect(await token.balanceOf(owner.address)).to.eq(1);

    const FactoryV2 = await ethers.getContractFactory('MyTokenUUPSProxyV2');

    // upgrading our implementation to `MyTokenTransparentProxyV2`
    const token2 = await upgrades.upgradeProxy(token.target, FactoryV2);
    expect(await token.balanceOf(owner.address)).to.eq(1);
    expect(await token2.demo()).to.eq(true);

    // proxy contract still have the same address!!!
    expect(token.target).to.eq(token2.target);
  });
});
