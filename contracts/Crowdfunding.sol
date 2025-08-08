// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

error GoalShouldBeMoreThanZero();
error EndAtShouldBeBetween3And30Days();
error CampaignAlreadyEnded();
error CampaignStillInProgress();
error ZeroPledgeAmount();
error InsufficientAmount();
error NotAnOrganizer();
error GoalWasNotReached();
error GoalAlreadyClaimed();
error GoalWasReached();
error WrongContractAddress();
error NothingToRefund();

contract LowkickStarter {
    struct LowkickCampaign {
        Campaign targetContract;
        bool claimed;
    }
    mapping(uint => LowkickCampaign) public campaigns;
    uint private currentCampaignId;
    address owner;
    uint constant MIN_DURATION = 3 days;
    uint constant MAX_DURATION = 30 days;

    event CampaignStarted(uint id, uint goal, uint endsAt, address organizer);

    constructor() {
        owner = msg.sender;
    }

    function startCampaign(uint _goal, uint _endsAt) public {
        require(_goal > 0, GoalShouldBeMoreThanZero());
        require(
            _endsAt > block.timestamp + MIN_DURATION &&
                _endsAt <= block.timestamp + MAX_DURATION,
            EndAtShouldBeBetween3And30Days()
        );

        currentCampaignId += 1;

        // contract creation
        Campaign newCampaign = new Campaign(
            _endsAt,
            _goal,
            msg.sender,
            currentCampaignId
        );

        campaigns[currentCampaignId] = LowkickCampaign({
            targetContract: newCampaign,
            claimed: false
        });

        emit CampaignStarted(currentCampaignId, _goal, _endsAt, msg.sender);
    }

    function onClaimed(uint id) external {
        LowkickCampaign storage targetCampaign = campaigns[id];
        require(
            msg.sender == address(targetCampaign.targetContract),
            WrongContractAddress()
        );

        targetCampaign.claimed = true;
    }
}

contract Campaign {
    uint public endsAt;
    uint public goal;
    uint public id;
    uint public pledged;
    address public organizer;
    LowkickStarter parent;
    bool claimed;
    mapping(address => uint) public pledges;

    event Pledged(uint amount, address pledger);

    constructor(uint _endsAt, uint _goal, address _organizer, uint _id) {
        endsAt = _endsAt;
        goal = _goal;
        organizer = _organizer;
        // msg.sender will be LowkickStarter contract since he is creating Campaign contract using new keyword
        parent = LowkickStarter(msg.sender);
        id = _id;
    }

    function pledge() external payable {
        require(block.timestamp <= endsAt, CampaignAlreadyEnded());
        require(msg.value > 0, ZeroPledgeAmount());

        pledged += msg.value;
        pledges[msg.sender] += msg.value;

        emit Pledged(msg.value, msg.sender);
    }

    function refundPledge(uint _amount) external {
        require(block.timestamp <= endsAt, CampaignAlreadyEnded());
        require(_amount <= pledges[msg.sender], InsufficientAmount());

        pledges[msg.sender] -= _amount;
        pledged -= _amount;

        payable(msg.sender).transfer(_amount);
    }

    function claim() external {
        require(block.timestamp > endsAt, CampaignStillInProgress());
        require(msg.sender == organizer, NotAnOrganizer());
        require(pledged >= goal, GoalWasNotReached());
        require(!claimed, GoalAlreadyClaimed());

        claimed = true;
        payable(organizer).transfer(pledged);

        parent.onClaimed(id);
    }

    function fullRefund() external {
        require(block.timestamp > endsAt, CampaignStillInProgress());
        require(pledged < goal, GoalWasReached());

        uint refundAmount = pledges[msg.sender];
        require(refundAmount > 0, NothingToRefund());

        pledges[msg.sender] = 0;
        payable(msg.sender).transfer(refundAmount);
    }
}
