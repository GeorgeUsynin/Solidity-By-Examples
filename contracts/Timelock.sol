// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

contract TestTimelock {
    string public message;
    uint public amount;

    function sendMsg(string calldata _msg) external payable{
        message = _msg;
        amount = msg.value;
    }
}

contract Timelock {
    uint constant MIN_DELAY = 10;
    uint constant MAX_DELAY = 1 days;
    uint constant GRACE_PERIOD = 1 days;
    address public owner;
    mapping(bytes32 => bool) public queue;


    event Queued(bytes32 txID);
    event Discarded(bytes32 txID);
    event Executed(bytes32 txID);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not an owner!");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function addToQueue(address _to, string calldata _func, bytes calldata _data, uint _value, uint _timestamp) external onlyOwner returns(bytes32){
        require(_timestamp > block.timestamp + MIN_DELAY && _timestamp < block.timestamp + MAX_DELAY, "Please adjust the _timestamp!");
        
        bytes32 txId = keccak256(
            abi.encode(
                _to,
                _func,
                _data,
                _value,
                _timestamp
            )
        );

        require(!queue[txId], "Transaction already in the queue!");

        queue[txId] = true;
        emit Queued(txId);
        return txId;
    }

    function execute(address _to, string calldata _func, bytes calldata _data, uint _value, uint _timestamp) external payable onlyOwner returns (bytes memory){
        require(block.timestamp > _timestamp, "Too early for execution!");
        require(block.timestamp < _timestamp + GRACE_PERIOD, "Transaction expired!");

        bytes32 txId = keccak256(
            abi.encode(
                _to,
                _func,
                _data,
                _value,
                _timestamp
            )
        );

        require(queue[txId], "No transaction in the queue!");
        queue[txId] = false;

        bytes memory data;

        if(bytes(_func).length > 0){
            data = abi.encodePacked(
                bytes4(keccak256(bytes(_func))),
                _data
            );
        } else {
            data = _data;
        }

        (bool success, bytes memory response) = _to.call{value: _value}(data);
        require(success, "Transaction execution failed!");
        emit Executed(txId);
        return response;
    }

    function discard(bytes32 _txId) external {
        require(queue[_txId], "Transaction is not in the queue!");
        queue[_txId] = false;
        emit Discarded(_txId);
    }
}