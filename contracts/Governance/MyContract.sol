// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

import '@openzeppelin/contracts/access/Ownable.sol';

contract MyContract is Ownable {
    uint value;

    constructor(address initialOwner) payable Ownable(initialOwner) {}

    function storeValue(uint _value) external {
        value = _value;
    }

    function readValue() external view returns (uint) {
        return value;
    }

    function sendMoney(address payable _to, uint _amount) external {
        _to.transfer(_amount);
    }
}
