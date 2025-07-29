// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

import './IERC721Metadata.sol';
import './IERC721Receiver.sol';
import './ERC165.sol';
import './Strings.sol';

error TokenNotMinted(uint tokenId);
error NotAnOwnerOrApproved();
error NotAnOwner(address account);
error ZeroAddress();
error NonERC721Receiver();
error CannotApproveToSelf();
error TokenAlreadyExists(uint tokenId);

contract ERC721 is ERC165, IERC721Metadata {
    using Strings for uint;
    string private _name;
    string private _symbol;

    mapping(address => uint) _balances;
    mapping(uint => address) _owners;
    mapping(uint => address) _tokenApprovals;
    mapping(address => mapping(address => bool)) _operatorApprovals;

    modifier _requireMinted(uint _tokenId) {
        require(_exists(_tokenId), TokenNotMinted(_tokenId));
        _;
    }

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function tokenURI(
        uint tokenId
    ) public view virtual _requireMinted(tokenId) returns (string memory) {
        string memory baseURI = _baseURI();

        return
            bytes(baseURI).length > 0
                ? string(abi.encodePacked(baseURI, tokenId.toString()))
                : '';
    }

    function balanceOf(address _owner) external view returns (uint256) {
        require(_owner != address(0), ZeroAddress());
        return _balances[_owner];
    }

    function ownerOf(
        uint256 _tokenId
    ) public view _requireMinted(_tokenId) returns (address) {
        return _owners[_tokenId];
    }

    function isApprovedForAll(
        address _owner,
        address _operator
    ) public view returns (bool) {
        return _operatorApprovals[_owner][_operator];
    }

    function setApprovalForAll(
        address _operator,
        bool _approved
    ) public virtual {
        require(msg.sender != _operator, CannotApproveToSelf());

        _operatorApprovals[msg.sender][_operator] = _approved;

        emit ApprovalForAll(msg.sender, _operator, _approved);
    }

    function getApproved(
        uint256 _tokenId
    ) public view _requireMinted(_tokenId) returns (address) {
        return _tokenApprovals[_tokenId];
    }

    function approve(address _approved, uint256 _tokenId) public payable {
        address owner = ownerOf(_tokenId);
        require(
            msg.sender == owner || isApprovedForAll(owner, msg.sender),
            NotAnOwner(msg.sender)
        );
        require(owner != _approved, CannotApproveToSelf());

        _tokenApprovals[_tokenId] = _approved;

        emit Approval(owner, _approved, _tokenId);
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external payable {
        require(
            _isApprovedOrOwner(msg.sender, _tokenId),
            NotAnOwnerOrApproved()
        );

        _transfer(_from, _to, _tokenId);
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId
    ) external payable {
        require(
            _isApprovedOrOwner(msg.sender, _tokenId),
            NotAnOwnerOrApproved()
        );

        _safeTransfer(_from, _to, _tokenId, '');
    }

    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory data
    ) external payable {
        require(
            _isApprovedOrOwner(msg.sender, _tokenId),
            NotAnOwnerOrApproved()
        );

        _safeTransfer(_from, _to, _tokenId, data);
    }

    function burn(uint256 _tokenId) public virtual {
        require(
            _isApprovedOrOwner(msg.sender, _tokenId),
            NotAnOwner(msg.sender)
        );

        _burn(_tokenId);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override returns (bool) {
        return
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function _burn(uint _tokenId) internal virtual {
        address owner = ownerOf(_tokenId);

        _beforeTokenTransfer(owner, address(0), _tokenId);

        delete _tokenApprovals[_tokenId];
        _balances[owner]--;
        delete _owners[_tokenId];

        emit Transfer(owner, address(0), _tokenId);

        _afterTokenTransfer(owner, address(0), _tokenId);
    }

    function _mint(address _to, uint _tokenId) internal virtual {
        require(_to != address(0), ZeroAddress());
        require(!_exists(_tokenId), TokenAlreadyExists(_tokenId));

        _beforeTokenTransfer(address(0), _to, _tokenId);

        _owners[_tokenId] = _to;
        _balances[_to]++;

        emit Transfer(address(0), _to, _tokenId);

        _afterTokenTransfer(address(0), _to, _tokenId);
    }

    function _safeTransfer(
        address _from,
        address _to,
        uint256 _tokenId,
        bytes memory data
    ) internal {
        _transfer(_from, _to, _tokenId);

        require(
            _checkOnERC721Received(_from, _to, _tokenId, data),
            NonERC721Receiver()
        );
    }

    function _safeMint(address _to, uint _tokenId) internal virtual {
        _safeMint(_to, _tokenId, '');
    }

    function _safeMint(
        address _to,
        uint _tokenId,
        bytes memory data
    ) internal virtual {
        _mint(_to, _tokenId);

        require(
            _checkOnERC721Received(msg.sender, _to, _tokenId, data),
            NonERC721Receiver()
        );
    }

    // checking that NFT receiver can manage NFTs
    function _checkOnERC721Received(
        address _from,
        address _to,
        uint _tokenId,
        bytes memory data
    ) private returns (bool) {
        // if code.length > 0 => smart contract
        if (_to.code.length > 0) {
            try
                IERC721Receiver(_to).onERC721Received(
                    msg.sender,
                    _from,
                    _tokenId,
                    data
                )
            returns (bytes4 ret) {
                return ret == IERC721Receiver.onERC721Received.selector;
            } catch (bytes memory reason) {
                if (reason.length == 0) {
                    // when receiver not implements interface IERC721Receiver
                    // and doesn't have function onERC721Received
                    revert('Non ERC721 Receiver!');
                } else {
                    assembly {
                        // revert(ptr, size)
                        // ptr: the memory address from which to read the error data
                        // size: the number of bytes to take from that memory location
                        revert(add(32, reason), mload(reason))
                    }
                }
            }
        } else {
            return true;
        }
    }

    function _transfer(address _from, address _to, uint256 _tokenId) internal {
        require(_from == ownerOf(_tokenId), NotAnOwner(_from));
        require(_to != address(0), ZeroAddress());

        _beforeTokenTransfer(_from, _to, _tokenId);

        _balances[_from]--;
        _balances[_to]++;
        _owners[_tokenId] = _to;

        emit Transfer(_from, _to, _tokenId);

        _afterTokenTransfer(_from, _to, _tokenId);
    }

    function _isApprovedOrOwner(
        address _spender,
        uint _tokenId
    ) internal view returns (bool) {
        address owner = ownerOf(_tokenId);
        return (_spender == owner ||
            isApprovedForAll(owner, _spender) ||
            getApproved(_tokenId) == _spender);
    }

    function _exists(uint _tokenId) internal view returns (bool) {
        return _owners[_tokenId] != address(0);
    }

    function _beforeTokenTransfer(
        address _from,
        address _to,
        uint256 _tokenId
    ) internal virtual {}

    function _afterTokenTransfer(
        address _from,
        address _to,
        uint256 _tokenId
    ) internal virtual {}

    function _baseURI() internal pure virtual returns (string memory) {
        return '';
    }
}
