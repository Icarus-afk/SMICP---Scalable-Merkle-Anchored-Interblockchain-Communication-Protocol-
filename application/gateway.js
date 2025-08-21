const { Gateway, Wallets } = require('fabric-network');
const path = require('path');
const fs = require('fs');

/**
 * SCIMP Application Gateway
 * Provides high-level interface for interacting with SCIMP chaincode
 */
class ScimpGateway {
    constructor() {
        this.gateway = null;
        this.wallet = null;
        this.contracts = {};
    }

    /**
     * Initialize connection to Fabric network
     * @param {string} networkName - Name of the network (mainchain, chainA, chainB)
     * @param {string} userId - User identity
     */
    async connect(networkName, userId = 'admin') {
        try {
            // Create wallet
            const walletPath = path.join(__dirname, '..', 'wallet', networkName);
            this.wallet = await Wallets.newFileSystemWallet(walletPath);

            // Check if user exists in wallet
            const identity = await this.wallet.get(userId);
            if (!identity) {
                throw new Error(`Identity ${userId} not found in wallet`);
            }

            // Create gateway
            this.gateway = new Gateway();

            // Load connection profile
            const connectionProfile = this.loadConnectionProfile(networkName);
            
            const connectionOptions = {
                wallet: this.wallet,
                identity: userId,
                discovery: { enabled: true, asLocalhost: true }
            };

            await this.gateway.connect(connectionProfile, connectionOptions);

            // Get network and contracts
            await this.loadContracts(networkName);

            console.log(`✓ Connected to ${networkName} network as ${userId}`);
        } catch (error) {
            console.error(`Failed to connect to ${networkName}:`, error);
            throw error;
        }
    }

    /**
     * Load connection profile for network
     */
    loadConnectionProfile(networkName) {
        // In a real implementation, load actual connection profile
        // For demo purposes, return a mock profile
        return {
            name: `${networkName}-network`,
            version: '1.0.0',
            client: {
                organization: 'Org1'
            },
            organizations: {
                Org1: {
                    mspid: 'Org1MSP',
                    peers: [`peer0.${networkName}.example.com`]
                }
            },
            orderers: {
                'orderer.example.com': {
                    url: 'grpc://localhost:7050'
                }
            },
            peers: {
                [`peer0.${networkName}.example.com`]: {
                    url: 'grpc://localhost:7051'
                }
            },
            channels: {
                [`${networkName}-channel`]: {
                    orderers: ['orderer.example.com'],
                    peers: {
                        [`peer0.${networkName}.example.com`]: {}
                    }
                }
            }
        };
    }

    /**
     * Load contracts for the network
     */
    async loadContracts(networkName) {
        const network = await this.gateway.getNetwork(`${networkName}-channel`);

        switch (networkName) {
            case 'mainchain':
                this.contracts.anchorRegistry = network.getContract('anchor-registry');
                break;
            case 'chainA':
            case 'chainB':
                this.contracts.sidechainVerifier = network.getContract('sidechain-verifier');
                this.contracts.coordinator = network.getContract('scimp-coordinator');
                break;
        }
    }

    /**
     * Anchor a Merkle root on the mainchain
     */
    async anchorRoot(chainId, blockNumber, merkleRoot, signatures, metadata = {}) {
        if (!this.contracts.anchorRegistry) {
            throw new Error('AnchorRegistry contract not loaded');
        }

        try {
            const result = await this.contracts.anchorRegistry.submitTransaction(
                'anchorRoot',
                chainId,
                blockNumber.toString(),
                merkleRoot,
                JSON.stringify(signatures),
                JSON.stringify(metadata)
            );

            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to anchor root:', error);
            throw error;
        }
    }

    /**
     * Get anchored root information
     */
    async getAnchoredRoot(chainId, blockNumber) {
        if (!this.contracts.anchorRegistry) {
            throw new Error('AnchorRegistry contract not loaded');
        }

        try {
            const result = await this.contracts.anchorRegistry.evaluateTransaction(
                'getAnchoredRoot',
                chainId,
                blockNumber.toString()
            );

            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to get anchored root:', error);
            throw error;
        }
    }

    /**
     * Set trusted root on sidechain
     */
    async setTrustedRoot(sourceChain, blockNumber, merkleRoot, proof = {}) {
        if (!this.contracts.sidechainVerifier) {
            throw new Error('SidechainVerifier contract not loaded');
        }

        try {
            const result = await this.contracts.sidechainVerifier.submitTransaction(
                'setTrustedRoot',
                sourceChain,
                blockNumber.toString(),
                merkleRoot,
                JSON.stringify(proof)
            );

            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to set trusted root:', error);
            throw error;
        }
    }

    /**
     * Verify cross-chain transaction
     */
    async verifyTransaction(sourceChain, blockNumber, transactionData, merkleProof) {
        if (!this.contracts.sidechainVerifier) {
            throw new Error('SidechainVerifier contract not loaded');
        }

        try {
            const result = await this.contracts.sidechainVerifier.submitTransaction(
                'verifyTransaction',
                sourceChain,
                blockNumber.toString(),
                JSON.stringify(transactionData),
                JSON.stringify(merkleProof)
            );

            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to verify transaction:', error);
            throw error;
        }
    }

    /**
     * Begin two-phase commit epoch
     */
    async beginEpoch(epochId, participants, timeout = 300000, metadata = {}) {
        if (!this.contracts.coordinator) {
            throw new Error('Coordinator contract not loaded');
        }

        try {
            const result = await this.contracts.coordinator.submitTransaction(
                'beginEpoch',
                epochId,
                JSON.stringify(participants),
                timeout.toString(),
                JSON.stringify(metadata)
            );

            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to begin epoch:', error);
            throw error;
        }
    }

    /**
     * Prepare for commit
     */
    async prepare(epochId, participantId, preparationData = {}) {
        if (!this.contracts.coordinator) {
            throw new Error('Coordinator contract not loaded');
        }

        try {
            const result = await this.contracts.coordinator.submitTransaction(
                'prepare',
                epochId,
                participantId,
                JSON.stringify(preparationData)
            );

            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to prepare:', error);
            throw error;
        }
    }

    /**
     * Commit epoch
     */
    async commit(epochId) {
        if (!this.contracts.coordinator) {
            throw new Error('Coordinator contract not loaded');
        }

        try {
            const result = await this.contracts.coordinator.submitTransaction('commit', epochId);
            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to commit epoch:', error);
            throw error;
        }
    }

    /**
     * Get epoch status
     */
    async getEpochStatus(epochId) {
        if (!this.contracts.coordinator) {
            throw new Error('Coordinator contract not loaded');
        }

        try {
            const result = await this.contracts.coordinator.evaluateTransaction('getEpochStatus', epochId);
            return JSON.parse(result.toString());
        } catch (error) {
            console.error('Failed to get epoch status:', error);
            throw error;
        }
    }

    /**
     * Listen for contract events
     */
    async startEventListener(contractName, eventName, callback) {
        const contract = this.contracts[contractName];
        if (!contract) {
            throw new Error(`Contract ${contractName} not loaded`);
        }

        try {
            const listener = await contract.addContractListener(eventName, callback);
            console.log(`✓ Started listening for ${eventName} events on ${contractName}`);
            return listener;
        } catch (error) {
            console.error(`Failed to start event listener:`, error);
            throw error;
        }
    }

    /**
     * Disconnect from the gateway
     */
    async disconnect() {
        if (this.gateway) {
            await this.gateway.disconnect();
            console.log('✓ Disconnected from gateway');
        }
    }
}

module.exports = ScimpGateway;
