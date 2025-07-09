// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

import "./ERC20.sol";

contract GeorgeCoin is ERC20 {
    // Implements: IERC20, IERC20Metadata, IERC20Errors via ERC20

    address public owner;
    uint8 immutable _decimals;

    constructor(string memory _name, string memory _symbol, uint _amount, uint8 decimals_) ERC20(_name, _symbol) {
        owner = msg.sender;
        _decimals = decimals_ != 0 ? decimals_ : 18;
        _mint(owner, _amount * 10 ** _decimals);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "You are not an owner!");
        _;
    }

    function decimals() public view override returns(uint8){
        return _decimals;
    }

    function mint(address _account, uint _amount) external onlyOwner {
        _mint(_account, _amount);
    }

    function burn(address _account, uint _amount) external onlyOwner {
        _burn(_account, _amount);
    }
}