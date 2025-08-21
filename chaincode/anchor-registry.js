/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

/**
 * AnchorRegistryChaincode - Mainchain contract for anchoring Merkle roots from sidechains
 * Implements the core functionality for SCIMP (Scalable Merkle-Anchored Interblockchain Communication Protocol)
 */
class AnchorRegistryChaincode extends Contract {

    async initLedger(ctx) {
        console.log('============= START : Initialize AnchorRegistry Ledger ===========');
        
        // Initialize validator set
        const validators = [
            'validator1@org1.example.com',
            'validator2@org2.example.com',
            'validator3@org3.example.com'
        ];
        
        await ctx.stub.putState('VALIDATORS', Buffer.from(JSON.stringify(validators)));
        await ctx.stub.putState('REQUIRED_SIGNATURES', Buffer.from('2')); // Require 2 out of 3 signatures
        
        console.log('============= END : Initialize AnchorRegistry Ledger ===========');
    }

    /**
     * Anchor a Merkle root from a sidechain with validator signatures
     * @param {Context} ctx - The transaction context
     * @param {string} chainId - The sidechain identifier
     * @param {string} blockNumber - The block number on the sidechain
     * @param {string} merkleRoot - The Merkle root to anchor
     * @param {string} signatures - JSON string of validator signatures
     * @param {string} metadata - Additional block metadata
     */
    async anchorRoot(ctx, chainId, blockNumber, merkleRoot, signatures, metadata = '{}') {
        console.log(`Anchoring root for chain ${chainId}, block ${blockNumber}`);
        
        // Validate inputs
        if (!chainId || !blockNumber || !merkleRoot) {
            throw new Error('chainId, blockNumber, and merkleRoot are required');
        }
        
        const rootKey = this.createRootKey(chainId, blockNumber);
        
        // Check if root already exists
        const existingRoot = await ctx.stub.getState(rootKey);
        if (existingRoot && existingRoot.length > 0) {
            throw new Error(`Root already anchored for chain ${chainId}, block ${blockNumber}`);
        }
        
        // Parse and validate signatures
        let parsedSignatures;
        try {
            parsedSignatures = JSON.parse(signatures);
        } catch (error) {
            throw new Error('Invalid signatures format');
        }
        
        // Verify signatures
        const validatorsBuffer = await ctx.stub.getState('VALIDATORS');
        const requiredSigsBuffer = await ctx.stub.getState('REQUIRED_SIGNATURES');
        
        if (!validatorsBuffer || !requiredSigsBuffer) {
            throw new Error('Validators or required signatures not initialized');
        }
        
        const validators = JSON.parse(validatorsBuffer.toString());
        const requiredSignatures = parseInt(requiredSigsBuffer.toString());
        
        if (parsedSignatures.length < requiredSignatures) {
            throw new Error(`Insufficient signatures: got ${parsedSignatures.length}, required ${requiredSignatures}`);
        }
        
        // Verify signature validity (simplified for demo - in production, use proper cryptographic verification)
        const messageHash = this.createMessageHash(chainId, blockNumber, merkleRoot);
        const validSignatures = this.verifySignatures(messageHash, parsedSignatures, validators);
        
        if (validSignatures.length < requiredSignatures) {
            throw new Error(`Invalid signatures: only ${validSignatures.length} valid signatures found`);
        }
        
        // Create anchored root record
        const anchoredRoot = {
            chainId: chainId,
            blockNumber: parseInt(blockNumber),
            merkleRoot: merkleRoot,
            timestamp: new Date().toISOString(),
            txId: ctx.stub.getTxID(),
            validatorSignatures: validSignatures,
            metadata: JSON.parse(metadata),
            status: 'ANCHORED'
        };
        
        // Store the anchored root
        await ctx.stub.putState(rootKey, Buffer.from(JSON.stringify(anchoredRoot)));
        
        // Create index for querying
        const indexKey = `chain~${chainId}~${blockNumber}`;
        await ctx.stub.putState(indexKey, Buffer.from(rootKey));
        
        // Emit event
        const eventPayload = {
            chainId: chainId,
            blockNumber: parseInt(blockNumber),
            merkleRoot: merkleRoot,
            timestamp: anchoredRoot.timestamp,
            txId: ctx.stub.getTxID()
        };
        
        ctx.stub.setEvent('RootAnchored', Buffer.from(JSON.stringify(eventPayload)));
        
        console.log(`Successfully anchored root for chain ${chainId}, block ${blockNumber}`);
        return JSON.stringify(anchoredRoot);
    }
    
    /**
     * Get anchored root information
     * @param {Context} ctx - The transaction context
     * @param {string} chainId - The sidechain identifier
     * @param {string} blockNumber - The block number
     */
    async getAnchoredRoot(ctx, chainId, blockNumber) {
        const rootKey = this.createRootKey(chainId, blockNumber);
        const rootBuffer = await ctx.stub.getState(rootKey);
        
        if (!rootBuffer || rootBuffer.length === 0) {
            throw new Error(`Root not found for chain ${chainId}, block ${blockNumber}`);
        }
        
        return rootBuffer.toString();
    }
    
    /**
     * Check if a root is anchored
     * @param {Context} ctx - The transaction context
     * @param {string} chainId - The sidechain identifier
     * @param {string} blockNumber - The block number
     */
    async isRootAnchored(ctx, chainId, blockNumber) {
        const rootKey = this.createRootKey(chainId, blockNumber);
        const rootBuffer = await ctx.stub.getState(rootKey);
        
        return (rootBuffer && rootBuffer.length > 0).toString();
    }
    
    /**
     * Get all anchored roots for a specific chain
     * @param {Context} ctx - The transaction context
     * @param {string} chainId - The sidechain identifier
     */
    async getRootsByChain(ctx, chainId) {
        const query = {
            selector: {
                chainId: chainId,
                status: 'ANCHORED'
            }
        };
        
        const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
        const results = [];
        
        let result = await iterator.next();
        while (!result.done) {
            const strValue = Buffer.from(result.value.value).toString('utf8');
            results.push(JSON.parse(strValue));
            result = await iterator.next();
        }
        
        await iterator.close();
        return JSON.stringify(results);
    }
    
    /**
     * Add a new validator (admin function)
     * @param {Context} ctx - The transaction context
     * @param {string} validatorId - The validator identifier
     */
    async addValidator(ctx, validatorId) {
        // In production, add proper access control
        const validatorsBuffer = await ctx.stub.getState('VALIDATORS');
        const validators = JSON.parse(validatorsBuffer.toString());
        
        if (validators.includes(validatorId)) {
            throw new Error('Validator already exists');
        }
        
        validators.push(validatorId);
        await ctx.stub.putState('VALIDATORS', Buffer.from(JSON.stringify(validators)));
        
        // Emit event
        ctx.stub.setEvent('ValidatorAdded', Buffer.from(validatorId));
        
        return `Validator ${validatorId} added successfully`;
    }
    
    /**
     * Get all validators
     * @param {Context} ctx - The transaction context
     */
    async getValidators(ctx) {
        const validatorsBuffer = await ctx.stub.getState('VALIDATORS');
        return validatorsBuffer.toString();
    }
    
    // Helper methods
    
    createRootKey(chainId, blockNumber) {
        return `root~${chainId}~${blockNumber}`;
    }
    
    createMessageHash(chainId, blockNumber, merkleRoot) {
        const message = `${chainId}:${blockNumber}:${merkleRoot}`;
        return crypto.createHash('sha256').update(message).digest('hex');
    }
    
    verifySignatures(messageHash, signatures, validators) {
        // Simplified signature verification for demo
        // In production, implement proper cryptographic signature verification
        const validSignatures = [];
        
        for (const sig of signatures) {
            if (sig.validator && validators.includes(sig.validator) && sig.signature) {
                // Simulate signature verification
                const expectedSig = crypto.createHash('sha256')
                    .update(messageHash + sig.validator)
                    .digest('hex');
                
                if (sig.signature.length > 0) { // Simplified check
                    validSignatures.push(sig);
                }
            }
        }
        
        return validSignatures;
    }
    
    /**
     * Get transaction history for auditing
     * @param {Context} ctx - The transaction context
     * @param {string} chainId - The sidechain identifier
     * @param {string} blockNumber - The block number
     */
    async getTransactionHistory(ctx, chainId, blockNumber) {
        const rootKey = this.createRootKey(chainId, blockNumber);
        const historyIterator = await ctx.stub.getHistoryForKey(rootKey);
        const results = [];
        
        let result = await historyIterator.next();
        while (!result.done) {
            const record = {
                txId: result.value.txId,
                timestamp: result.value.timestamp,
                isDelete: result.value.isDelete,
                value: result.value.value.toString()
            };
            results.push(record);
            result = await historyIterator.next();
        }
        
        await historyIterator.close();
        return JSON.stringify(results);
    }
}

module.exports = AnchorRegistryChaincode;
