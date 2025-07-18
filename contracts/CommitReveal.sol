// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

error NotAnOwner(address addr);
error VotingInProgress();
error VotingStopped();
error AlreadyVoted();
error ZeroAddress();
error HashMismatch();

contract CommitReveal {
    address owner;
    address[] public candidates;

    mapping (address => bytes32) public commits;
    mapping (address => uint) public votes;

    bool public votingStopped;

    modifier onlyOwner() {
        require(owner == msg.sender, NotAnOwner(msg.sender));
        _;
    }

    constructor(address[] memory _candidates) {
        owner = msg.sender;
        candidates = _candidates;
    }

    function commitVote(bytes32 _hashedVote) external {
        require(!votingStopped, VotingStopped());
        require(commits[msg.sender] == bytes32(0), AlreadyVoted());

        commits[msg.sender] = _hashedVote;
    }

    function revealVote(address _candidate, bytes32 _secret) external {
        require(_candidate != address(0), ZeroAddress());
        require(votingStopped, VotingInProgress());

        bytes32 hash = keccak256(abi.encodePacked(msg.sender, _candidate, _secret));
        require(hash == commits[msg.sender], HashMismatch());
        delete commits[msg.sender];

        votes[_candidate]++;
    }

    function stopVoting() external onlyOwner {
         require(!votingStopped, VotingStopped());

         votingStopped = true;
    }
}