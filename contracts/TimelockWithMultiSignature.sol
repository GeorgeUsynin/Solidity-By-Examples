// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

error InvalidOwner(address owner);
error NotEnoughOwners();
error TransactionAlreadyQueued(bytes32 txId);
error NoTransactionInTheQueue(bytes32 txId);
error ConfirmationAlreadyExists(address owner);
error ConfirmationAlreadyCanceled(address owner);
error NotEnoughConfirmations(uint8 currentCount);
error TooEarlyForExecution();
error TransactionExpired();
error TransactionFailed(bytes32 txId);
error TimestampIsNoInTheRange();
error ZeroAddress();
error DuplicatedOwner(address owner);

contract TestTimelockWithMultiSignature {
    string public message;
    uint public amount;

    function sendMsg(string calldata _msg) external payable{
        message = _msg;
        amount = msg.value;
    }
}

contract TimelockWithMultiSignature {
    uint constant MIN_DELAY = 10;
    uint constant MAX_DELAY = 1 days;
    uint constant GRACE_PERIOD = 1 days;
    uint constant CONFIRMATIONS_REQUIRED = 3;
    mapping(bytes32 => Transaction) public txs;
    mapping(bytes32 => mapping(address => bool)) public confirmations;
    mapping(address => bool) public isOwner;

    struct Transaction {
        bytes32 uid;
        address to;
        uint value;
        bytes data;
        string func;
        uint timestamp;
        bool queued;
        uint8 confirmations;
    }

    event Queued(Transaction tx);
    event Discarded(bytes32 txID);
    event Executed(bytes32 txID);

    modifier onlyOwner() {
        require(isOwner[msg.sender], InvalidOwner(msg.sender));
        _;
    }

    constructor(address[] memory _owners) {
        require(_owners.length >= CONFIRMATIONS_REQUIRED, NotEnoughOwners());

        for(uint i = 0; i < _owners.length; i++){
            require(_owners[i] != address(0), ZeroAddress());
            require(!isOwner[_owners[i]], DuplicatedOwner(_owners[i]));
            isOwner[_owners[i]] = true;
        }
    }

    function addToQueue(address _to, string calldata _func, bytes calldata _data, uint _value, uint _timestamp) external onlyOwner returns(bytes32){
        require(_timestamp > block.timestamp + MIN_DELAY && _timestamp < block.timestamp + MAX_DELAY, TimestampIsNoInTheRange());
        
        bytes32 txId = keccak256(
            abi.encode(
                _to,
                _func,
                _data,
                _value,
                _timestamp
            )
        );

        require(!txs[txId].queued, TransactionAlreadyQueued(txId));

        txs[txId] = Transaction({
            uid: txId,
            to: _to,
            value: _value,
            data: _data,
            func: _func,
            timestamp: _timestamp,
            queued: true,
            confirmations: 0
        });
        
        emit Queued(txs[txId]);
        return txId;
    }

    function confirm(bytes32 _txId) external onlyOwner {
        require(txs[_txId].queued, NoTransactionInTheQueue(_txId));
        require(!confirmations[_txId][msg.sender], ConfirmationAlreadyExists(msg.sender));
        txs[_txId].confirmations++;
        confirmations[_txId][msg.sender] = true;
    }

    function cancelConfirmation(bytes32 _txId) external onlyOwner {
        require(txs[_txId].queued, NoTransactionInTheQueue(_txId));
        require(confirmations[_txId][msg.sender], ConfirmationAlreadyCanceled(msg.sender));
        txs[_txId].confirmations--;
        confirmations[_txId][msg.sender] = false;
    }

    function execute(address _to, string calldata _func, bytes calldata _data, uint _value, uint _timestamp) external payable onlyOwner returns (bytes memory){
        require(block.timestamp > _timestamp, TooEarlyForExecution());
        require(block.timestamp < _timestamp + GRACE_PERIOD, TransactionExpired());

        bytes32 txId = keccak256(
            abi.encode(
                _to,
                _func,
                _data,
                _value,
                _timestamp
            )
        );

        require(txs[txId].queued, NoTransactionInTheQueue(txId));
        require(txs[txId].confirmations >= CONFIRMATIONS_REQUIRED, NotEnoughConfirmations(txs[txId].confirmations));

        txs[txId].queued = false;

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
        require(success, TransactionFailed(txId));
        emit Executed(txId);
        return response;
    }

    function discard(bytes32 _txId) external onlyOwner{
        require(txs[_txId].queued, NoTransactionInTheQueue(_txId));
        txs[_txId].queued = false;
        emit Discarded(_txId);
    }
}