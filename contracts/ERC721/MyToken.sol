//SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import './ERC721.sol';
import './ERC721URIStorage.sol';

contract MyToken is ERC721, ERC721URIStorage {
    address public owner;
    uint currentTokenId;

    constructor() ERC721('MyToken', 'MTK') {
        owner = msg.sender;
    }

    function safeMint(address to, string calldata tokenId) public {
        require(owner == msg.sender, NotAnOwner(msg.sender));

        _safeMint(to, currentTokenId);
        _setTokenURI(currentTokenId, tokenId);

        currentTokenId++;
    }

    function _baseURI() internal pure override returns (string memory) {
        return 'ipfs://';
    }

    function _burn(uint tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    function tokenURI(
        uint tokenId
    ) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
}
