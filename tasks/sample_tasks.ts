import { task, types } from 'hardhat/config';

task('accounts', 'Displays all accounts addresses').setAction(
  async (_, hre) => {
    const accounts = await hre.ethers.getSigners();

    for (let account of accounts) {
      console.log('Account address: ', account.address);
    }
  },
);

task('decimals', 'Returns decimals of GeorgeCoin token')
  .addParam('address', 'Contract address')
  //   .addOptionalParam(
  //     'address',
  //     'Contract address',
  //     '0x0000000000000000000000000000000000000000',
  //     types.string,
  //   )
  .setAction(async (taskArgs, { ethers }) => {
    // const contract = await ethers.getContractAt('GeorgeCoin', taskArgs.address);
    const deployer = (await ethers.getSigners())[0];
    /** 
    Use dynamic import to prevent errors during `npx hardhat test` in CI environments
    like GitHub Actions, where `typechain-types` may not exist at the time the config
    and tasks are loaded. This avoids premature import of generated types.
    */
    const { GeorgeCoin__factory } = await import(
      '../typechain-types/factories/ERC20'
    );
    const contract = GeorgeCoin__factory.connect(taskArgs.address, deployer);

    console.log('Decimals: ', await contract.decimals());
  });
