// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

/// @title ScimpCoordinator - simplified 2PC coordinator for SCIMP (for testing/perf on EVM)
contract ScimpCoordinator {
    enum EpochStatus { NONE, PREPARING, PREPARED, COMMITTED, ABORTED, COMPLETED }

    struct Epoch {
        bytes32 id;
        EpochStatus status;
        address coordinator;
        address[] participants;
        uint256 startTime;
        uint256 timeout; // milliseconds
        // participant states: 0 = waiting, 1 = prepared
        mapping(address => uint8) preparationState;
        // commit confirmations: 0 = pending, 1 = confirmed
        mapping(address => uint8) commitConfirmation;
        bool exists;
    }

    mapping(bytes32 => Epoch) private epochs;
    bytes32[] private activeEpochKeys;

    event EpochBegun(bytes32 indexed epochId, address indexed coordinator, address[] participants);
    event ParticipantPrepared(bytes32 indexed epochId, address indexed participant, bool allPrepared);
    event EpochCommitted(bytes32 indexed epochId);
    event EpochAborted(bytes32 indexed epochId, string reason);
    event CommitConfirmed(bytes32 indexed epochId, address indexed participant, bool allConfirmed);

    // Begin a new epoch. participants are EVM addresses for this simplified port.
    function beginEpoch(string calldata epochId, address[] calldata participants, uint256 timeoutMillis) external returns (bool) {
        require(bytes(epochId).length > 0, "epochId required");
        require(participants.length > 0, "at least one participant");

        bytes32 key = keccak256(abi.encodePacked(epochId));
        require(!epochs[key].exists, "epoch already exists");

        Epoch storage e = epochs[key];
        e.id = key;
        e.status = EpochStatus.PREPARING;
        e.coordinator = msg.sender;
        e.startTime = block.timestamp * 1000; // ms
        e.timeout = timeoutMillis;
        e.exists = true;

        for (uint i = 0; i < participants.length; i++) {
            e.participants.push(participants[i]);
            e.preparationState[participants[i]] = 0;
            e.commitConfirmation[participants[i]] = 0;
        }

        activeEpochKeys.push(key);
        emit EpochBegun(key, msg.sender, participants);
        return true;
    }

    // Participant calls prepare (use msg.sender) with optional data (ignored for now)
    function prepare(string calldata epochId) external returns (bool) {
        bytes32 key = keccak256(abi.encodePacked(epochId));
        require(epochs[key].exists, "epoch not found");
        Epoch storage e = epochs[key];
        require(e.status == EpochStatus.PREPARING, "epoch not in preparing state");

        // participant must be in participants
        bool found = false;
        for (uint i = 0; i < e.participants.length; i++) {
            if (e.participants[i] == msg.sender) { found = true; break; }
        }
        require(found, "sender not a participant");

        e.preparationState[msg.sender] = 1; // prepared

        // check if all prepared
        bool allPrepared = true;
        for (uint i = 0; i < e.participants.length; i++) {
            if (e.preparationState[e.participants[i]] != 1) { allPrepared = false; break; }
        }

        if (allPrepared) {
            e.status = EpochStatus.PREPARED;
        }

        emit ParticipantPrepared(key, msg.sender, allPrepared);
        return true;
    }

    // Coordinator commits the epoch (caller must be coordinator)
    function commit(string calldata epochId) external returns (bool) {
        bytes32 key = keccak256(abi.encodePacked(epochId));
        require(epochs[key].exists, "epoch not found");
        Epoch storage e = epochs[key];
        require(e.coordinator == msg.sender, "only coordinator can commit");
        require(e.status == EpochStatus.PREPARED, "epoch not prepared");

        e.status = EpochStatus.COMMITTED;
        // initialize commit confirmations to pending (already zeroed)
        emit EpochCommitted(key);
        return true;
    }

    function abort(string calldata epochId, string calldata reason) external returns (bool) {
        bytes32 key = keccak256(abi.encodePacked(epochId));
        require(epochs[key].exists, "epoch not found");
        Epoch storage e = epochs[key];
        // allow coordinator or any participant to abort for simplicity
        e.status = EpochStatus.ABORTED;
        emit EpochAborted(key, reason);
        return true;
    }

    function confirmCommit(string calldata epochId) external returns (bool) {
        bytes32 key = keccak256(abi.encodePacked(epochId));
        require(epochs[key].exists, "epoch not found");
        Epoch storage e = epochs[key];
        require(e.status == EpochStatus.COMMITTED, "epoch not committed");

        // only participants can confirm
        bool found = false;
        for (uint i = 0; i < e.participants.length; i++) {
            if (e.participants[i] == msg.sender) { found = true; break; }
        }
        require(found, "sender not a participant");

        e.commitConfirmation[msg.sender] = 1;

        // check all confirmed
        bool allConfirmed = true;
        for (uint i = 0; i < e.participants.length; i++) {
            if (e.commitConfirmation[e.participants[i]] != 1) { allConfirmed = false; break; }
        }

        if (allConfirmed) {
            e.status = EpochStatus.COMPLETED;
        }

        emit CommitConfirmed(key, msg.sender, allConfirmed);
        return true;
    }

    function getEpochStatus(string calldata epochId) external view returns (EpochStatus status, address coordinator, address[] memory participants) {
        bytes32 key = keccak256(abi.encodePacked(epochId));
        require(epochs[key].exists, "epoch not found");
        Epoch storage e = epochs[key];
        return (e.status, e.coordinator, e.participants);
    }

    function getActiveEpochs() external view returns (bytes32[] memory) {
        return activeEpochKeys;
    }

    function getConfig() external pure returns (string memory) {
        return "scimp-coordinator-simplified";
    }

    // Cleanup timed out epochs (caller may be anyone)
    function cleanupTimeouts() external returns (bytes32[] memory cleaned) {
        uint removed = 0;
        bytes32[] memory removedKeys = new bytes32[](activeEpochKeys.length);

        for (uint i = 0; i < activeEpochKeys.length; ) {
            bytes32 key = activeEpochKeys[i];
            Epoch storage e = epochs[key];
            if (e.exists && e.status == EpochStatus.PREPARING) {
                // check timeout
                uint256 elapsed = (block.timestamp * 1000) - e.startTime;
                if (elapsed > e.timeout) {
                    e.status = EpochStatus.ABORTED;
                    removedKeys[removed++] = key;
                    // remove from activeEpochKeys (swap-pop)
                    activeEpochKeys[i] = activeEpochKeys[activeEpochKeys.length - 1];
                    activeEpochKeys.pop();
                    continue; // don't increment i, re-evaluate swapped element
                }
            }
            i++;
        }

        // return trimmed array of removed keys
        bytes32[] memory ret = new bytes32[](removed);
        for (uint j = 0; j < removed; j++) ret[j] = removedKeys[j];
        return ret;
    }
}
