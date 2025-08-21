// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

/// @title AnchorRegistry - stores Merkle roots anchored from sidechains with validator signatures
contract AnchorRegistry {
    struct Anchor {
        bytes32 root;
        uint64 chainId;
        uint64 blockNumber;
        uint256 timestamp;
        address submitter;
    }

    mapping(bytes32 => Anchor) public anchors; // key = keccak256(chainId, blockNumber)
    mapping(address => bool) public isValidator;
    uint256 public requiredSignatures;
    address[] public validatorsList;

    event RootAnchored(uint64 indexed chainId, uint64 indexed blockNumber, bytes32 merkleRoot, address indexed submitter);
    event ValidatorAdded(address validator);
    event ValidatorRemoved(address validator);

    constructor(address[] memory _validators, uint256 _requiredSignatures) {
        require(_validators.length > 0, "must provide validators");
        require(_requiredSignatures > 0 && _requiredSignatures <= _validators.length, "invalid required signatures");
        requiredSignatures = _requiredSignatures;
        for (uint i = 0; i < _validators.length; i++) {
            address v = _validators[i];
            require(v != address(0), "invalid validator");
            if (!isValidator[v]) {
                isValidator[v] = true;
                validatorsList.push(v);
            }
        }
    }

    // Anchor a merkle root. signatures: array of 65-byte signatures (r(32)|s(32)|v(1)) over the message hash
    function anchorRoot(uint64 chainId, uint64 blockNumber, bytes32 merkleRoot, bytes[] calldata signatures) external {
        bytes32 key = keccak256(abi.encodePacked(chainId, blockNumber));
        require(anchors[key].timestamp == 0, "root already anchored for this chain/block");
        require(signatures.length >= requiredSignatures, "not enough signatures");

        bytes32 message = keccak256(abi.encodePacked(chainId, blockNumber, merkleRoot));

        // verify signatures and count unique valid validators
        uint256 valid = 0;
        // Solidity doesn't allow mapping in memory; use temporary array to track seen addresses
        address[] memory seenAddrs = new address[](signatures.length);
        uint256 seenCount = 0;

        for (uint i = 0; i < signatures.length; i++) {
            bytes memory sig = signatures[i];
            if (sig.length != 65) continue;
            address signer = recoverSigner(message, sig);
            if (signer == address(0)) continue;
            if (!isValidator[signer]) continue;
            bool already = false;
            for (uint j = 0; j < seenCount; j++) {
                if (seenAddrs[j] == signer) { already = true; break; }
            }
            if (already) continue;
            seenAddrs[seenCount++] = signer;
            valid++;
            if (valid >= requiredSignatures) break;
        }

        require(valid >= requiredSignatures, "insufficient valid signatures");

        anchors[key] = Anchor({
            root: merkleRoot,
            chainId: chainId,
            blockNumber: blockNumber,
            timestamp: block.timestamp,
            submitter: msg.sender
        });

        emit RootAnchored(chainId, blockNumber, merkleRoot, msg.sender);
    }

    function getAnchor(uint64 chainId, uint64 blockNumber) external view returns (bytes32 root, uint256 timestamp, address submitter) {
        bytes32 key = keccak256(abi.encodePacked(chainId, blockNumber));
        Anchor storage a = anchors[key];
        return (a.root, a.timestamp, a.submitter);
    }

    function addValidator(address v) external {
        require(v != address(0));
        if (!isValidator[v]) {
            isValidator[v] = true;
            validatorsList.push(v);
            emit ValidatorAdded(v);
        }
    }

    function removeValidator(address v) external {
        if (isValidator[v]) {
            isValidator[v] = false;
            // remove from list (linear search)
            for (uint i = 0; i < validatorsList.length; i++) {
                if (validatorsList[i] == v) {
                    validatorsList[i] = validatorsList[validatorsList.length - 1];
                    validatorsList.pop();
                    break;
                }
            }
            emit ValidatorRemoved(v);
        }
    }

    function validators() external view returns (address[] memory) {
        return validatorsList;
    }

    // recover signer from 65-byte signature
    function recoverSigner(bytes32 hash, bytes memory sig) public pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        // adjust v
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        // prefixed hash to match eth_sign semantics
        bytes32 prefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
        return ecrecover(prefixed, v, r, s);
    }
}
