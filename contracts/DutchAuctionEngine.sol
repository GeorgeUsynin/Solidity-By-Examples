// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

// Dutch auction
contract DutchAuctionEngine {
    address public owner;
    uint constant DURATION = 2 days;
    uint constant FEE = 10;

    struct Auction{
        address payable seller;
        uint startingPrice;
        uint finalPrice;
        uint startsAt;
        uint endsAt;
        uint discountRate;
        string item;
        bool stopped;
    }

    Auction[] public auctions;

    event AuctionCreated(uint index, string itemName, uint startingPrice, uint duration);
    event AuctionEnded(uint index, uint finalPrice, address winner);

    constructor () {
        owner = msg.sender;
    }

    function createAuction(uint _startingPrice, uint _discountRate, string memory _item, uint _duration) external {
        uint duration = _duration == 0 ? DURATION : _duration;

        require(_startingPrice >= _discountRate * duration, "Incorrect starting price!");

        Auction memory newAuction = Auction({
            seller: payable(msg.sender),
            startingPrice: _startingPrice,
            finalPrice: _startingPrice,
            startsAt: block.timestamp,
            endsAt: block.timestamp + duration,
            discountRate: _discountRate,
            item: _item,
            stopped: false
        });

        auctions.push(newAuction);

        emit AuctionCreated(auctions.length - 1, _item, _startingPrice, duration);
    }

    function getPriceFor(uint _index) public view returns(uint) {
        Auction memory cAuction = auctions[_index];
        require(!cAuction.stopped, "The auction is already over!");
        uint elapsed = block.timestamp - cAuction.startsAt;
        uint discount = elapsed * cAuction.discountRate;
        return cAuction.startingPrice - discount;
    }

    function buy(uint _index) external payable {
        Auction storage cAuction = auctions[_index];

        require(!cAuction.stopped, "The auction is already over!");
        require(block.timestamp < cAuction.endsAt, "The auction is already ended!");

        uint cPrice = getPriceFor(_index);

        require(msg.value >= cPrice, "Not enough funds!");

        cAuction.stopped = true;
        cAuction.finalPrice = cPrice;

        uint refund = msg.value - cPrice;
        if(refund > 0) {
            payable(msg.sender).transfer(refund);
        }

        cAuction.seller.transfer(cPrice - ((cPrice * FEE) / 100));

        emit AuctionEnded(_index, cPrice, msg.sender);
    }
}