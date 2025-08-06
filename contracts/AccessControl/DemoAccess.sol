// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

import './AccessControl.sol';

contract DemoAccess is AccessControl {
    bool public paused;
    // bytes32 public WITHDRAWER_ROLE = keccak256(bytes('WITHDRAWER_ROLE'));
    bytes32 public WITHDRAWER_ROLE =
        0x10dac8c06a04bec0b551627dad28bc00d6516b0caacd1c7b345fcdb5211334e4;
    // bytes32 public MINTER_ROLE = keccak256(bytes('MINTER_ROLE'));
    bytes32 public MINTER_ROLE =
        0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6;

    constructor(address _withdrawer) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(WITHDRAWER_ROLE, _withdrawer);

        // here we are setting DEFAULT_ADMIN_ROLE as an admin role for WITHDRAWER_ROLE
        // therefore only accounts with DEFAULT_ADMIN_ROLE can grant withdrawer roles to accounts
        _setRoleAdmin(WITHDRAWER_ROLE, DEFAULT_ADMIN_ROLE);
    }

    function withdraw() external onlyRole(WITHDRAWER_ROLE) {
        payable(msg.sender).transfer(address(this).balance);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        paused = true;
    }
}
