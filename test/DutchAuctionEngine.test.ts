import { loadFixture, ethers, expect, time, mine } from './setup';

describe('DutchAuctionEngine', function () {
  async function deploy() {
    const [owner, seller, buyer] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('DutchAuctionEngine');
    const aucEngine = await Factory.deploy();
    await aucEngine.waitForDeployment();

    return { aucEngine, owner, seller, buyer };
  }

  async function getCurrentBlock() {
    const currentBlock = await ethers.provider.getBlock(
      await ethers.provider.getBlockNumber(),
    );
    return currentBlock;
  }

  it('sets owner', async function () {
    const { aucEngine, owner } = await loadFixture(deploy);
    const currentOwner = await aucEngine.owner();

    expect(currentOwner).to.eq(owner);
  });

  it('creates auction correctly', async function () {
    const { aucEngine, seller } = await loadFixture(deploy);
    const startingPrice = ethers.parseEther('0.0001');
    const discountRate = 4; //wei
    const durationInSeconds = 120;
    const itemName = 'Car';
    const auctionIndex = 0;

    const tx = await aucEngine
      .connect(seller)
      .createAuction(startingPrice, discountRate, itemName, durationInSeconds);

    await tx.wait(1);

    const cBlock = await getCurrentBlock();
    const cAuction = await aucEngine.auctions(auctionIndex);

    expect(cAuction.item).to.eq(itemName);
    expect(cAuction.endsAt).to.eq(
      (cBlock?.timestamp as number) + durationInSeconds,
    );
  });

  it('allows to buy', async function () {
    const { aucEngine, seller, buyer } = await loadFixture(deploy);
    const startingPrice = ethers.parseEther('0.0001');
    const discountRate = 4; //wei
    const durationInSeconds = 120;
    const itemName = 'Car';
    const auctionIndex = 0;

    await aucEngine
      .connect(seller)
      .createAuction(startingPrice, discountRate, itemName, durationInSeconds);

    // way to wait n seconds
    await time.increase(20);
    await mine();

    const buyTx = await aucEngine
      .connect(buyer)
      .buy(0, { value: ethers.parseEther('0.0001') });

    const cAuction = await aucEngine.auctions(auctionIndex);
    const finalPrice = cAuction.finalPrice;

    // checking owner and buyer(with refund) balances
    await expect(buyTx).to.changeEtherBalances(
      [seller, buyer],
      [finalPrice - (finalPrice * 10n) / 100n, -finalPrice],
    );

    await expect(buyTx)
      .to.emit(aucEngine, 'AuctionEnded')
      .withArgs(auctionIndex, finalPrice, buyer.address);

    await expect(
      aucEngine.connect(buyer).buy(0, { value: ethers.parseEther('0.0001') }),
    ).to.be.revertedWith('The auction is already over!');
  });
});
