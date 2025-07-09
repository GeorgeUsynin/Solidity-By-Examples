import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('GeorgeCoin', (m) => {
  const georgeCoin = m.contract('GeorgeCoin', ['GeorgeCoin', 'GRC', 6, 6]);

  return { georgeCoin };
});
