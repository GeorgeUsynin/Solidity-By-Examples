// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

error NonceAlreadyInUse(uint nonce);
error InvalidSignature();
error InvalidSignatureLength();
error NoValueForDeposit();

contract Payments {
    address owner;
    mapping(address => mapping(uint => bool)) nonces;

    constructor() payable {
        require(msg.value > 0, NoValueForDeposit());
        owner = msg.sender;
    }

    function claim(uint amount, uint nonce, bytes memory signature) external {
        require(!nonces[msg.sender][nonce], NonceAlreadyInUse(nonce));

        nonces[msg.sender][nonce] = true;

        bytes32 message = _withPrefix(
            keccak256(
                abi.encodePacked(msg.sender, amount, nonce, address(this))
            )
        );

        require(
            _recoverSigner(message, signature) == owner,
            InvalidSignature()
        );

        payable(msg.sender).transfer(amount);
    }

    function _withPrefix(bytes32 hash) private pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked('\x19Ethereum Signed Message:\n32', hash)
            );
    }

    function _recoverSigner(
        bytes32 message,
        bytes memory signature
    ) private pure returns (address) {
        (uint8 v, bytes32 r, bytes32 s) = _splitSignature(signature);

        return ecrecover(message, v, r, s);
    }

    function _splitSignature(
        bytes memory signature
    ) private pure returns (uint8 v, bytes32 r, bytes32 s) {
        require(signature.length == 65, InvalidSignatureLength());

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
    }
}
