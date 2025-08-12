// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

error AddressMismatch();

contract D {
    uint public num;

    constructor(uint _num) {
        num = _num;
    }

    function addNumbers() public pure returns (uint) {
        return 8 + 7;
    }
}

contract AddressPrediction {
    bool public isEqualCreate;
    bool public isEqualCreate2;

    function createAndCompareAddress(uint arg) public {
        D d = new D(arg);
        address contractDAddress = address(d);
        uint8 nonce = 1;

        // When using CREATE, EVM is doing RLP([ sender_address , sender_nonce ])
        // RLP - Recursive Length Prefix
        // There are special rules to encode the list of arguments in RLP
        // In our case:
        // 1. If it is a string (bytes) of length 0-55, code = 0x80 + length.
        // 2. If it is a number is less than 0x7f (127), it is encoded in one byte without a prefix.
        // 3. If the total length of the elements is less than 55, the code = 0xc0 + the length of all_elements.
        address predictedAddress = address(
            uint160(
                uint(
                    keccak256(
                        abi.encodePacked(
                            // Elements length = 1 (address prefix) + 20 (address itself) + 1 (nonce) = 22
                            // List prefix = 0xc0 + 22 = 0xd6
                            bytes1(0xd6),
                            // Address = 20 bytes → length = 20
                            // Prefix for string = 0x80 + 20 = 0x94
                            bytes1(0x94),
                            address(this),
                            nonce
                        )
                    )
                )
            )
        );

        isEqualCreate = contractDAddress == predictedAddress;
    }

    function create2AndCompareAddress(bytes32 salt, uint arg) public {
        address predictedAddress = address(
            uint160(
                uint(
                    keccak256(
                        abi.encodePacked(
                            bytes1(0xff),
                            address(this),
                            salt,
                            keccak256(
                                abi.encodePacked(
                                    type(D).creationCode,
                                    abi.encode(arg)
                                )
                            )
                        )
                    )
                )
            )
        );

        D d = new D{salt: salt}(arg);

        isEqualCreate2 = address(d) == predictedAddress;
    }
}
