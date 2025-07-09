import { loadFixture, ethers, expect } from './setup';

const TKN_NAME = 'GeorgeCoin';
const TKN_SYMBOL = 'GRC';
const PREMINT_AMOUNT = 6;
const DECIMALS = 6;

describe('GeorgeCoin', function () {
  async function deploy() {
    const [owner, user1, user2] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('GeorgeCoin');
    const georgeCoin = await Factory.deploy(
      TKN_NAME,
      TKN_SYMBOL,
      PREMINT_AMOUNT,
      DECIMALS,
    );
    await georgeCoin.waitForDeployment();

    return { georgeCoin, owner, user1, user2 };
  }

  it('creates proper ERC-20 contract', async function () {
    const { georgeCoin, owner } = await loadFixture(deploy);

    const tknName = await georgeCoin.name();
    const tknSymbol = await georgeCoin.symbol();
    const premintAmount = await georgeCoin.totalSupply();
    const decimals = await georgeCoin.decimals();

    expect(tknName).eq(TKN_NAME);
    expect(tknSymbol).eq(TKN_SYMBOL);
    expect(premintAmount).eq(PREMINT_AMOUNT * 10 ** DECIMALS);
    expect(decimals).eq(DECIMALS);

    const ownerBalance = await georgeCoin.balanceOf(owner.address);
    expect(ownerBalance).to.eq(premintAmount);
  });

  it('approves funds for a third-party account and transfers funds on behalf of the approver', async function () {
    const { georgeCoin, owner, user1, user2 } = await loadFixture(deploy);

    const amountAllowedToSpend = 1500n;

    // approving for user1 1500n tokens
    const approveTx = await georgeCoin.approve(
      user1.address,
      amountAllowedToSpend,
    );
    await approveTx.wait(1);

    const allowedAmount = await georgeCoin.allowance(
      owner.address,
      user1.address,
    );
    expect(allowedAmount).to.eq(amountAllowedToSpend);

    // user1 transfers user2 700n tokens on behalf of owner account
    const transferredAmount = 700n;
    const transferTx = await georgeCoin
      .connect(user1)
      .transferFrom(owner.address, user2.address, transferredAmount);
    await transferTx.wait(1);

    const newAllowedAmount = await georgeCoin.allowance(
      owner.address,
      user1.address,
    );

    expect(newAllowedAmount).to.eq(allowedAmount - transferredAmount);

    const premintAmount = await georgeCoin.totalSupply();
    const ownerBalance = await georgeCoin.balanceOf(owner.address);
    const user2Balance = await georgeCoin.balanceOf(user2.address);
    expect(ownerBalance).to.eq(premintAmount - transferredAmount);
    expect(user2Balance).to.eq(transferredAmount);
  });
});
