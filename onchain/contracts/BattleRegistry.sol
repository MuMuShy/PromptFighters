// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BattleRegistry
 * @notice Minimal on-chain attestation for battle results.
 *         Stores event logs and a lightweight mapping to prevent duplicates.
 *         Owner-only write to avoid spam; off-chain provides IPFS CID + hash.
 */
contract BattleRegistry {
    address public owner;

    event BattleRecorded(
        bytes32 indexed battleId,
        address indexed fighter1,
        address indexed fighter2,
        address winner,
        bytes32 resultHash,
        string ipfsCid,
        uint256 timestamp
    );

    mapping(bytes32 => bool) public recorded; // prevent duplicates

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        owner = newOwner;
    }

    /**
     * @dev Record a battle result attestation.
     * @param battleId Off-chain battle UUID mapped to bytes32 (e.g., keccak of UUID string)
     * @param fighter1 Player1 wallet (optional, 0x0 if unknown)
     * @param fighter2 Player2 wallet (optional, 0x0 if unknown)
     * @param winner Winner wallet (optional, 0x0 if unknown)
     * @param resultHash keccak256 of full battle JSON
     * @param ipfsCid IPFS CID of the JSON
     */
    function recordBattle(
        bytes32 battleId,
        address fighter1,
        address fighter2,
        address winner,
        bytes32 resultHash,
        string calldata ipfsCid
    ) external onlyOwner {
        require(!recorded[battleId], "Already recorded");
        recorded[battleId] = true;

        emit BattleRecorded(
            battleId,
            fighter1,
            fighter2,
            winner,
            resultHash,
            ipfsCid,
            block.timestamp
        );
    }
}


