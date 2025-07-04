// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

contract MerkleTree {
    bytes32[] public hashes;

    constructor(string[] memory _transactionsArr){
        for(uint i = 0; i < _transactionsArr.length; i++){
            hashes.push(makeHash(_transactionsArr[i]));
        }

        uint count = _transactionsArr.length;
        uint offset = 0;

        while(count > 1) {
            for(uint i = 0; i < count; i += 2){
                hashes.push(keccak256(
                    abi.encodePacked(hashes[offset + i], hashes[offset + i + 1])
                    ));
            }

            offset += count;
            count = count / 2;
        }
    }

    function verify(string memory _transaction, uint _index, bytes32 _root, bytes32[] memory _proof) public pure returns (bool) {
        bytes32 hash = makeHash(_transaction);

        for(uint i = 0; i < _proof.length; i++){
            bytes32 element = _proof[i];
            if(_index % 2 == 0){
                hash = keccak256(abi.encodePacked(hash, element));
            } else {
                hash = keccak256(abi.encodePacked(element, hash));
            }

            _index = _index / 2;
        }

        return hash == _root;
    }

    function makeHash(string memory _input) private pure returns(bytes32) {
        return keccak256(abi.encodePacked(_input));
    }
}
