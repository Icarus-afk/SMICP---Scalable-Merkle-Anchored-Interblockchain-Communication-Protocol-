/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

/**
 * SidechainVerifierChaincode - Sidechain contract for verifying cross-chain transactions
 * Uses Merkle proofs to verify transactions from other sidechains
 */
class SidechainVerifierChaincode extends Contract {

    async initLedger(ctx) {
        console.log('============= START : Initialize Sidechain Verifier ===========');
        
        // Initialize sidechain configuration
        const config = {
            chainId: process.env.CHAIN_ID || 'sidechain1',
            trustedMainchain: 'mainchain',
            trustedChains: [],
            status: 'ACTIVE'
        };
        
        await ctx.stub.putState('CONFIG', Buffer.from(JSON.stringify(config)));
        await ctx.stub.putState('TRUSTED_ROOTS', Buffer.from(JSON.stringify({})));
        
        console.log('============= END : Initialize Sidechain Verifier ===========');
    }

    /**
     * Set a trusted Merkle root from the mainchain
     * @param {Context} ctx - The transaction context
     * @param {string} sourceChain - The source chain identifier
     * @param {string} blockNumber - The block number
     * @param {string} merkleRoot - The trusted Merkle root
     * @param {string} proof - Proof of anchoring from mainchain
     */
    async setTrustedRoot(ctx, sourceChain, blockNumber, merkleRoot, proof = '{}') {
        console.log(`Setting trusted root for chain ${sourceChain}, block ${blockNumber}`);
        
        if (!sourceChain || !blockNumber || !merkleRoot) {
            throw new Error('sourceChain, blockNumber, and merkleRoot are required');
        }
        
        // Get current trusted roots
        const trustedRootsBuffer = await ctx.stub.getState('TRUSTED_ROOTS');
        const trustedRoots = JSON.parse(trustedRootsBuffer.toString());
        
        // Create key for this root
        const rootKey = `${sourceChain}:${blockNumber}`;
        
        // Store trusted root information
        const rootInfo = {
            sourceChain: sourceChain,
            blockNumber: parseInt(blockNumber),
            merkleRoot: merkleRoot,
            timestamp: new Date().toISOString(),
            proof: JSON.parse(proof),
            status: 'TRUSTED',
            verifiedTransactions: []
        };
        
        trustedRoots[rootKey] = rootInfo;
        await ctx.stub.putState('TRUSTED_ROOTS', Buffer.from(JSON.stringify(trustedRoots)));
        
        // Emit event
        const eventPayload = {
            sourceChain: sourceChain,
            blockNumber: parseInt(blockNumber),
            merkleRoot: merkleRoot,
            timestamp: rootInfo.timestamp
        };
        
        ctx.stub.setEvent('TrustedRootSet', Buffer.from(JSON.stringify(eventPayload)));
        
        console.log(`Successfully set trusted root for chain ${sourceChain}, block ${blockNumber}`);
        return JSON.stringify(rootInfo);
    }
    
    /**
     * Verify a cross-chain transaction using Merkle proof
     * @param {Context} ctx - The transaction context
     * @param {string} sourceChain - The source chain identifier
     * @param {string} blockNumber - The block number
     * @param {string} transactionData - The transaction data to verify
     * @param {string} merkleProof - The Merkle proof (array of hashes)
     */
    async verifyTransaction(ctx, sourceChain, blockNumber, transactionData, merkleProof) {
        console.log(`Verifying transaction from chain ${sourceChain}, block ${blockNumber}`);
        
        if (!sourceChain || !blockNumber || !transactionData || !merkleProof) {
            throw new Error('All parameters are required for verification');
        }
        
        // Get trusted roots
        const trustedRootsBuffer = await ctx.stub.getState('TRUSTED_ROOTS');
        const trustedRoots = JSON.parse(trustedRootsBuffer.toString());
        
        const rootKey = `${sourceChain}:${blockNumber}`;
        const trustedRoot = trustedRoots[rootKey];
        
        if (!trustedRoot) {
            throw new Error(`No trusted root found for chain ${sourceChain}, block ${blockNumber}`);
        }
        
        // Parse Merkle proof
        let proof;
        try {
            proof = JSON.parse(merkleProof);
        } catch (error) {
            throw new Error('Invalid Merkle proof format');
        }
        
        // Verify the Merkle proof
        const transactionHash = crypto.createHash('sha256').update(transactionData).digest('hex');
        const isValid = this.verifyMerkleProof(transactionHash, proof, trustedRoot.merkleRoot);
        
        if (!isValid) {
            throw new Error('Merkle proof verification failed');
        }
        
        // Record the verified transaction
        const verificationRecord = {
            transactionHash: transactionHash,
            sourceChain: sourceChain,
            blockNumber: parseInt(blockNumber),
            transactionData: transactionData,
            timestamp: new Date().toISOString(),
            verifier: ctx.clientIdentity.getID(),
            status: 'VERIFIED'
        };
        
        // Store verification record
        const verificationKey = `verification~${transactionHash}`;
        await ctx.stub.putState(verificationKey, Buffer.from(JSON.stringify(verificationRecord)));
        
        // Update trusted root with verified transaction
        trustedRoot.verifiedTransactions.push(transactionHash);
        trustedRoots[rootKey] = trustedRoot;
        await ctx.stub.putState('TRUSTED_ROOTS', Buffer.from(JSON.stringify(trustedRoots)));
        
        // Emit event
        ctx.stub.setEvent('TransactionVerified', Buffer.from(JSON.stringify(verificationRecord)));
        
        console.log(`Successfully verified transaction ${transactionHash}`);
        return JSON.stringify(verificationRecord);
    }
    
    /**
     * Get verification record for a transaction
     * @param {Context} ctx - The transaction context
     * @param {string} transactionHash - The transaction hash
     */
    async getVerificationRecord(ctx, transactionHash) {
        const verificationKey = `verification~${transactionHash}`;
        const recordBuffer = await ctx.stub.getState(verificationKey);
        
        if (!recordBuffer || recordBuffer.length === 0) {
            throw new Error(`Verification record not found for transaction ${transactionHash}`);
        }
        
        return recordBuffer.toString();
    }
    
    /**
     * Get all trusted roots
     * @param {Context} ctx - The transaction context
     */
    async getTrustedRoots(ctx) {
        const trustedRootsBuffer = await ctx.stub.getState('TRUSTED_ROOTS');
        return trustedRootsBuffer.toString();
    }
    
    /**
     * Get trusted root for specific chain and block
     * @param {Context} ctx - The transaction context
     * @param {string} sourceChain - The source chain identifier
     * @param {string} blockNumber - The block number
     */
    async getTrustedRoot(ctx, sourceChain, blockNumber) {
        const trustedRootsBuffer = await ctx.stub.getState('TRUSTED_ROOTS');
        const trustedRoots = JSON.parse(trustedRootsBuffer.toString());
        
        const rootKey = `${sourceChain}:${blockNumber}`;
        const trustedRoot = trustedRoots[rootKey];
        
        if (!trustedRoot) {
            throw new Error(`No trusted root found for chain ${sourceChain}, block ${blockNumber}`);
        }
        
        return JSON.stringify(trustedRoot);
    }
    
    /**
     * Process a batch of transactions for verification
     * @param {Context} ctx - The transaction context
     * @param {string} batchData - JSON string containing batch of transactions to verify
     */
    async verifyTransactionBatch(ctx, batchData) {
        let batch;
        try {
            batch = JSON.parse(batchData);
        } catch (error) {
            throw new Error('Invalid batch data format');
        }
        
        const results = [];
        
        for (const tx of batch.transactions) {
            try {
                const result = await this.verifyTransaction(
                    ctx,
                    tx.sourceChain,
                    tx.blockNumber,
                    tx.transactionData,
                    JSON.stringify(tx.merkleProof)
                );
                results.push({ success: true, result: JSON.parse(result) });
            } catch (error) {
                results.push({ success: false, error: error.message, transaction: tx });
            }
        }
        
        return JSON.stringify({
            batchId: batch.batchId || crypto.randomUUID(),
            totalTransactions: batch.transactions.length,
            successfulVerifications: results.filter(r => r.success).length,
            failedVerifications: results.filter(r => !r.success).length,
            results: results
        });
    }
    
    // Helper methods
    
    /**
     * Verify Merkle proof against a root hash
     * @param {string} leaf - The leaf hash to verify
     * @param {Array} proof - Array of proof hashes
     * @param {string} root - The root hash to verify against
     */
    verifyMerkleProof(leaf, proof, root) {
        let computedHash = leaf;
        
        for (const proofElement of proof) {
            if (proofElement.left) {
                // Current element is on the left
                computedHash = crypto.createHash('sha256')
                    .update(computedHash + proofElement.hash)
                    .digest('hex');
            } else {
                // Current element is on the right
                computedHash = crypto.createHash('sha256')
                    .update(proofElement.hash + computedHash)
                    .digest('hex');
            }
        }
        
        return computedHash === root;
    }
    
    /**
     * Get sidechain configuration
     * @param {Context} ctx - The transaction context
     */
    async getConfig(ctx) {
        const configBuffer = await ctx.stub.getState('CONFIG');
        return configBuffer.toString();
    }
    
    /**
     * Update sidechain configuration (admin function)
     * @param {Context} ctx - The transaction context
     * @param {string} newConfig - New configuration as JSON string
     */
    async updateConfig(ctx, newConfig) {
        // In production, add proper access control
        let config;
        try {
            config = JSON.parse(newConfig);
        } catch (error) {
            throw new Error('Invalid configuration format');
        }
        
        await ctx.stub.putState('CONFIG', Buffer.from(JSON.stringify(config)));
        
        ctx.stub.setEvent('ConfigUpdated', Buffer.from(JSON.stringify(config)));
        
        return `Configuration updated successfully`;
    }
}

module.exports = SidechainVerifierChaincode;
