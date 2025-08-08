import { loadFixture, ethers, expect, time, mine } from './setup';
import { Campaign__factory } from '../typechain-types';

describe('Crowdfunding', function () {
  async function deploy() {
    const [owner, organizer, pledger] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('LowkickStarter');
    const lowkickStarter = await Factory.deploy();
    await lowkickStarter.waitForDeployment();

    return { lowkickStarter, owner, organizer, pledger };
  }

  it('allows to pledge and claim', async function () {
    const { lowkickStarter, organizer, pledger } = await loadFixture(deploy);

    const goal = ethers.parseEther('2.0');
    const now = await time.latest();
    const endsAt = now + 259320;

    // creating campaign
    await lowkickStarter.connect(organizer).startCampaign(goal, endsAt);
    const campaignContract = (await lowkickStarter.campaigns(1)).targetContract;

    const campaignAsPledger = Campaign__factory.connect(
      campaignContract,
      pledger,
    );
    const campaignAsOrganizer = Campaign__factory.connect(
      campaignContract,
      organizer,
    );

    const pledgeTx = await campaignAsPledger.pledge({
      value: ethers.parseEther('2.5'),
    });
    await pledgeTx.wait();

    await expect(campaignAsOrganizer.claim()).to.be.revertedWithCustomError(
      campaignAsOrganizer,
      'CampaignStillInProgress',
    );

    await time.increase(259321);

    const claimTx = await campaignAsOrganizer.claim();
    await claimTx.wait();

    await expect(claimTx).to.changeEtherBalances(
      [campaignContract, organizer],
      [ethers.parseEther('-2.5'), ethers.parseEther('2.5')],
    );
    await expect(campaignAsOrganizer.claim()).to.be.revertedWithCustomError(
      campaignAsOrganizer,
      'GoalAlreadyClaimed',
    );
  });

  it('allows full refund if campaign does not reach the goal', async function () {
    const { lowkickStarter, organizer, pledger } = await loadFixture(deploy);

    const goal = ethers.parseEther('2.0');
    const now = await time.latest();
    const endsAt = now + 259320;

    // creating campaign
    await lowkickStarter.connect(organizer).startCampaign(goal, endsAt);
    const campaignContract = (await lowkickStarter.campaigns(1)).targetContract;

    const campaignAsPledger = Campaign__factory.connect(
      campaignContract,
      pledger,
    );
    const campaignAsOrganizer = Campaign__factory.connect(
      campaignContract,
      organizer,
    );

    const pledgeTx = await campaignAsPledger.pledge({
      value: ethers.parseEther('1.0'),
    });
    await pledgeTx.wait();

    await time.increase(259321);

    await expect(campaignAsOrganizer.claim()).to.be.revertedWithCustomError(
      campaignAsOrganizer,
      'GoalWasNotReached',
    );

    const fullRefundTx = await campaignAsPledger.fullRefund();
    await fullRefundTx.wait();

    await expect(fullRefundTx).to.changeEtherBalances(
      [campaignContract, pledger],
      [ethers.parseEther('-1.0'), ethers.parseEther('1.0')],
    );
    await expect(campaignAsPledger.fullRefund()).to.be.revertedWithCustomError(
      campaignAsPledger,
      'NothingToRefund',
    );
  });
});
