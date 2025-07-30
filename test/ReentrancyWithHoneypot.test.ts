import { loadFixture, ethers, expect, time, mine } from './setup';

describe('ReentrancyWithHoneypot', function () {
  async function deploy() {
    const [owner, attacker] = await ethers.getSigners();

    const HoneypotFactory = await ethers.getContractFactory('Honeypot');
    const honeypot = await HoneypotFactory.deploy();
    await honeypot.waitForDeployment();

    const HoneypotBankFactory = await ethers.getContractFactory('Bank');
    const honeypotBank = await HoneypotBankFactory.deploy(honeypot.target);
    await honeypotBank.waitForDeployment();

    const HoneypotAttackBankFactory =
      await ethers.getContractFactory('AttackBank');
    const honeypotAttackBank = await HoneypotAttackBankFactory.connect(
      attacker,
    ).deploy(honeypotBank.target);
    await honeypotAttackBank.waitForDeployment();

    const LoggerFactory = await ethers.getContractFactory('Logger');
    const logger = await LoggerFactory.deploy();
    await logger.waitForDeployment();

    const BankFactory = await ethers.getContractFactory('Bank');
    const bank = await BankFactory.deploy(logger.target);
    await bank.waitForDeployment();

    const AttackBankFactory = await ethers.getContractFactory('AttackBank');
    const attackBank = await AttackBankFactory.connect(attacker).deploy(
      bank.target,
    );
    await attackBank.waitForDeployment();

    return {
      bank,
      attackBank,
      honeypotBank,
      honeypotAttackBank,
      owner,
      attacker,
    };
  }

  it('attacks', async function () {
    const { bank, attackBank, attacker } = await loadFixture(deploy);

    await bank.deposit({ value: ethers.parseEther('5.0') });
    expect(await bank.getBalance()).to.eq(ethers.parseEther('5.0'));

    const attackTx = await attackBank
      .connect(attacker)
      .attack({ value: ethers.parseEther('1.0') });
    await attackTx.wait();

    await expect(attackTx).to.changeEtherBalances(
      [bank.target, attackBank.target],
      [ethers.parseEther('-5.0'), ethers.parseEther('6.0')],
    );
  });

  it('shows `Hahahahoneypot!` error for attacker', async function () {
    const { honeypotBank, honeypotAttackBank, attacker } =
      await loadFixture(deploy);

    await honeypotBank.deposit({ value: ethers.parseEther('5.0') });
    expect(await honeypotBank.getBalance()).to.eq(ethers.parseEther('5.0'));

    await expect(
      honeypotAttackBank
        .connect(attacker)
        .attack({ value: ethers.parseEther('1.0') }),
    ).to.be.revertedWith('Hahahahoneypot!');
  });

  it('allows regular users to withdraw funds', async function () {
    const { honeypotBank, owner } = await loadFixture(deploy);

    await honeypotBank.deposit({ value: ethers.parseEther('5.0') });
    expect(await honeypotBank.getBalance()).to.eq(ethers.parseEther('5.0'));

    const withdrawTx = await honeypotBank.withdraw();
    await withdrawTx.wait();

    await expect(withdrawTx).to.changeEtherBalances(
      [owner, honeypotBank],
      [ethers.parseEther('5.0'), ethers.parseEther('-5.0')],
    );
  });
});
