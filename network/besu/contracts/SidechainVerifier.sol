// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

/// @title SidechainVerifier - verifies Merkle inclusion proofs (sha256) for SCIMP
contract SidechainVerifier {
    // Verify inclusion proof where leaves and proof elements are bytes32 hex hashes
    function verifyProof(bytes32 leaf, bytes32[] calldata proof, bool[] calldata lefts, bytes32 expectedRoot) external pure returns (bool) {
        bytes32 computed = leaf;
        for (uint i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            if (lefts[i]) {
                computed = sha256(abi.encodePacked(p, computed));
            } else {
                computed = sha256(abi.encodePacked(computed, p));
            }
        }
        return computed == expectedRoot;
    }

    // Convenience wrapper to hash a serialized transaction (must match merkle.js hashing)
    function hashTransaction(string calldata json) external pure returns (bytes32) {
        // merkle.js uses sha256 of JSON string; solidity sha256 returns bytes32
        return sha256(abi.encodePacked(json));
    }
}
