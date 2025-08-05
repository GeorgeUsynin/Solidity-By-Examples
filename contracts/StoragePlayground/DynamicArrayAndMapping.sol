// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

contract DynamicArrayAndMapping {
    uint a = 100; // slot 0
    uint[] arr; // slot 1
    mapping(address => uint) balances; // slot 2
    string longStr = 'thisIsVeryLongStringAndWeCanDoThis'; // slot 3
    string shortStr = 'test'; //slot 4

    constructor(uint[2] memory _arr) {
        arr.push(_arr[0]);
        arr.push(_arr[1]);
        balances[address(this)] = a;
    }
}
