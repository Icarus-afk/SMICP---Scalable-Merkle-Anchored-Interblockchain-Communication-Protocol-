/*
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

const { Contract } = require('fabric-contract-api');
const crypto = require('crypto');

/**
 * ScimpCoordinatorChaincode - Coordinates atomic cross-chain transactions using Two-Phase Commit
 */
class ScimpCoordinatorChaincode extends Contract {

    async initLedger(ctx) {
        console.log('============= START : Initialize SCIMP Coordinator ===========');
        
        const config = {
            coordinatorId: 'scimp-coordinator',
            maxParticipants: 10,
            defaultTimeout: 300000, // 5 minutes in milliseconds
            status: 'ACTIVE'
        };
        
        await ctx.stub.putState('CONFIG', Buffer.from(JSON.stringify(config)));
        await ctx.stub.putState('ACTIVE_EPOCHS', Buffer.from(JSON.stringify({})));
        
        console.log('============= END : Initialize SCIMP Coordinator ===========');
    }

    /**
     * Begin a new two-phase commit epoch
     * @param {Context} ctx - The transaction context
     * @param {string} epochId - Unique identifier for this epoch
     * @param {string} participants - JSON array of participant chain IDs
     * @param {string} timeout - Timeout in milliseconds
     * @param {string} metadata - Additional metadata for the transaction
     */
    async beginEpoch(ctx, epochId, participants, timeout = '300000', metadata = '{}') {
        console.log(`Beginning 2PC epoch ${epochId}`);
        
        if (!epochId || !participants) {
            throw new Error('epochId and participants are required');
        }
        
        // Parse participants
        let participantList;
        try {
            participantList = JSON.parse(participants);
        } catch (error) {
            throw new Error('Invalid participants format');
        }
        
        if (participantList.length === 0) {
            throw new Error('At least one participant is required');
        }
        
        // Check if epoch already exists
        const activeEpochsBuffer = await ctx.stub.getState('ACTIVE_EPOCHS');
        const activeEpochs = JSON.parse(activeEpochsBuffer.toString());
        
        if (activeEpochs[epochId]) {
            throw new Error(`Epoch ${epochId} already exists`);
        }
        
        // Create new epoch
        const epoch = {
            epochId: epochId,
            status: 'PREPARING',
            participants: participantList,
            preparations: {},
            votes: {},
            startTime: new Date().toISOString(),
            timeout: parseInt(timeout),
            coordinator: ctx.clientIdentity.getID(),
            metadata: JSON.parse(metadata),
            phase: 'PREPARE'
        };
        
        // Initialize participant states
        for (const participant of participantList) {
            epoch.preparations[participant] = {
                status: 'WAITING',
                timestamp: null,
                data: null
            };
            epoch.votes[participant] = null;
        }
        
        // Store epoch
        activeEpochs[epochId] = epoch;
        await ctx.stub.putState('ACTIVE_EPOCHS', Buffer.from(JSON.stringify(activeEpochs)));
        
        // Create individual epoch record for detailed tracking
        await ctx.stub.putState(`epoch~${epochId}`, Buffer.from(JSON.stringify(epoch)));
        
        // Emit event
        ctx.stub.setEvent('EpochBegun', Buffer.from(JSON.stringify({
            epochId: epochId,
            participants: participantList,
            startTime: epoch.startTime,
            coordinator: epoch.coordinator
        })));
        
        console.log(`Successfully began epoch ${epochId} with ${participantList.length} participants`);
        return JSON.stringify(epoch);
    }
    
    /**
     * Participant prepares for commit
     * @param {Context} ctx - The transaction context
     * @param {string} epochId - The epoch identifier
     * @param {string} participantId - The participant chain ID
     * @param {string} preparationData - Data required for preparation
     */
    async prepare(ctx, epochId, participantId, preparationData = '{}') {
        console.log(`Participant ${participantId} preparing for epoch ${epochId}`);
        
        if (!epochId || !participantId) {
            throw new Error('epochId and participantId are required');
        }
        
        // Get epoch
        const epochBuffer = await ctx.stub.getState(`epoch~${epochId}`);
        if (!epochBuffer || epochBuffer.length === 0) {
            throw new Error(`Epoch ${epochId} not found`);
        }
        
        const epoch = JSON.parse(epochBuffer.toString());
        
        // Validate epoch state
        if (epoch.status !== 'PREPARING') {
            throw new Error(`Cannot prepare: epoch ${epochId} is in ${epoch.status} state`);
        }
        
        // Validate participant
        if (!epoch.participants.includes(participantId)) {
            throw new Error(`${participantId} is not a participant in epoch ${epochId}`);
        }
        
        // Check if already prepared
        if (epoch.preparations[participantId].status !== 'WAITING') {
            throw new Error(`${participantId} has already prepared for epoch ${epochId}`);
        }
        
        // Check timeout
        const now = new Date();
        const startTime = new Date(epoch.startTime);
        if (now.getTime() - startTime.getTime() > epoch.timeout) {
            // Timeout - abort epoch
            await this.abortEpoch(ctx, epochId, 'TIMEOUT');
            throw new Error(`Epoch ${epochId} has timed out`);
        }
        
        // Update preparation
        epoch.preparations[participantId] = {
            status: 'PREPARED',
            timestamp: new Date().toISOString(),
            data: JSON.parse(preparationData)
        };
        
        // Check if all participants have prepared
        const allPrepared = epoch.participants.every(p => 
            epoch.preparations[p].status === 'PREPARED'
        );
        
        if (allPrepared) {
            epoch.status = 'PREPARED';
            epoch.phase = 'COMMIT';
        }
        
        // Update epoch
        await ctx.stub.putState(`epoch~${epochId}`, Buffer.from(JSON.stringify(epoch)));
        
        // Update active epochs
        const activeEpochsBuffer = await ctx.stub.getState('ACTIVE_EPOCHS');
        const activeEpochs = JSON.parse(activeEpochsBuffer.toString());
        activeEpochs[epochId] = epoch;
        await ctx.stub.putState('ACTIVE_EPOCHS', Buffer.from(JSON.stringify(activeEpochs)));
        
        // Emit event
        const eventData = {
            epochId: epochId,
            participantId: participantId,
            status: 'PREPARED',
            allPrepared: allPrepared
        };
        ctx.stub.setEvent('ParticipantPrepared', Buffer.from(JSON.stringify(eventData)));
        
        console.log(`${participantId} successfully prepared for epoch ${epochId}`);
        return JSON.stringify({
            epochId: epochId,
            participantId: participantId,
            status: 'PREPARED',
            allPrepared: allPrepared
        });
    }
    
    /**
     * Commit the two-phase commit transaction
     * @param {Context} ctx - The transaction context
     * @param {string} epochId - The epoch identifier
     */
    async commit(ctx, epochId) {
        console.log(`Committing epoch ${epochId}`);
        
        if (!epochId) {
            throw new Error('epochId is required');
        }
        
        // Get epoch
        const epochBuffer = await ctx.stub.getState(`epoch~${epochId}`);
        if (!epochBuffer || epochBuffer.length === 0) {
            throw new Error(`Epoch ${epochId} not found`);
        }
        
        const epoch = JSON.parse(epochBuffer.toString());
        
        // Validate epoch state
        if (epoch.status !== 'PREPARED') {
            throw new Error(`Cannot commit: epoch ${epochId} is in ${epoch.status} state`);
        }
        
        // Verify all participants are prepared
        const allPrepared = epoch.participants.every(p => 
            epoch.preparations[p].status === 'PREPARED'
        );
        
        if (!allPrepared) {
            throw new Error(`Cannot commit: not all participants are prepared`);
        }
        
        // Update epoch to committed
        epoch.status = 'COMMITTED';
        epoch.phase = 'COMPLETED';
        epoch.commitTime = new Date().toISOString();
        
        // Initialize commit confirmations
        epoch.commitConfirmations = {};
        for (const participant of epoch.participants) {
            epoch.commitConfirmations[participant] = {
                status: 'PENDING',
                timestamp: null
            };
        }
        
        // Update epoch
        await ctx.stub.putState(`epoch~${epochId}`, Buffer.from(JSON.stringify(epoch)));
        
        // Remove from active epochs and add to completed
        const activeEpochsBuffer = await ctx.stub.getState('ACTIVE_EPOCHS');
        const activeEpochs = JSON.parse(activeEpochsBuffer.toString());
        delete activeEpochs[epochId];
        await ctx.stub.putState('ACTIVE_EPOCHS', Buffer.from(JSON.stringify(activeEpochs)));
        
        // Add to completed epochs
        const completedEpochsBuffer = await ctx.stub.getState('COMPLETED_EPOCHS') || Buffer.from('{}');
        const completedEpochs = JSON.parse(completedEpochsBuffer.toString());
        completedEpochs[epochId] = epoch;
        await ctx.stub.putState('COMPLETED_EPOCHS', Buffer.from(JSON.stringify(completedEpochs)));
        
        // Emit event
        ctx.stub.setEvent('EpochCommitted', Buffer.from(JSON.stringify({
            epochId: epochId,
            commitTime: epoch.commitTime,
            participants: epoch.participants
        })));
        
        console.log(`Successfully committed epoch ${epochId}`);
        return JSON.stringify(epoch);
    }
    
    /**
     * Abort the two-phase commit transaction
     * @param {Context} ctx - The transaction context
     * @param {string} epochId - The epoch identifier
     * @param {string} reason - Reason for abort
     */
    async abort(ctx, epochId, reason = 'MANUAL_ABORT') {
        return await this.abortEpoch(ctx, epochId, reason);
    }
    
    /**
     * Internal method to abort an epoch
     */
    async abortEpoch(ctx, epochId, reason) {
        console.log(`Aborting epoch ${epochId}, reason: ${reason}`);
        
        // Get epoch
        const epochBuffer = await ctx.stub.getState(`epoch~${epochId}`);
        if (!epochBuffer || epochBuffer.length === 0) {
            throw new Error(`Epoch ${epochId} not found`);
        }
        
        const epoch = JSON.parse(epochBuffer.toString());
        
        // Update epoch to aborted
        epoch.status = 'ABORTED';
        epoch.phase = 'COMPLETED';
        epoch.abortTime = new Date().toISOString();
        epoch.abortReason = reason;
        
        // Update epoch
        await ctx.stub.putState(`epoch~${epochId}`, Buffer.from(JSON.stringify(epoch)));
        
        // Remove from active epochs
        const activeEpochsBuffer = await ctx.stub.getState('ACTIVE_EPOCHS');
        const activeEpochs = JSON.parse(activeEpochsBuffer.toString());
        delete activeEpochs[epochId];
        await ctx.stub.putState('ACTIVE_EPOCHS', Buffer.from(JSON.stringify(activeEpochs)));
        
        // Add to aborted epochs
        const abortedEpochsBuffer = await ctx.stub.getState('ABORTED_EPOCHS') || Buffer.from('{}');
        const abortedEpochs = JSON.parse(abortedEpochsBuffer.toString());
        abortedEpochs[epochId] = epoch;
        await ctx.stub.putState('ABORTED_EPOCHS', Buffer.from(JSON.stringify(abortedEpochs)));
        
        // Emit event
        ctx.stub.setEvent('EpochAborted', Buffer.from(JSON.stringify({
            epochId: epochId,
            abortTime: epoch.abortTime,
            reason: reason,
            participants: epoch.participants
        })));
        
        console.log(`Successfully aborted epoch ${epochId}`);
        return JSON.stringify(epoch);
    }
    
    /**
     * Confirm commit completion by participant
     * @param {Context} ctx - The transaction context
     * @param {string} epochId - The epoch identifier
     * @param {string} participantId - The participant chain ID
     */
    async confirmCommit(ctx, epochId, participantId) {
        console.log(`${participantId} confirming commit for epoch ${epochId}`);
        
        // Get epoch from completed epochs
        const completedEpochsBuffer = await ctx.stub.getState('COMPLETED_EPOCHS') || Buffer.from('{}');
        const completedEpochs = JSON.parse(completedEpochsBuffer.toString());
        
        const epoch = completedEpochs[epochId];
        if (!epoch) {
            throw new Error(`Committed epoch ${epochId} not found`);
        }
        
        if (epoch.status !== 'COMMITTED') {
            throw new Error(`Epoch ${epochId} is not in committed state`);
        }
        
        // Update confirmation
        if (epoch.commitConfirmations[participantId]) {
            epoch.commitConfirmations[participantId] = {
                status: 'CONFIRMED',
                timestamp: new Date().toISOString()
            };
        }
        
        // Check if all participants confirmed
        const allConfirmed = epoch.participants.every(p => 
            epoch.commitConfirmations[p].status === 'CONFIRMED'
        );
        
        if (allConfirmed) {
            epoch.status = 'COMPLETED';
            epoch.completionTime = new Date().toISOString();
        }
        
        // Update epoch
        completedEpochs[epochId] = epoch;
        await ctx.stub.putState('COMPLETED_EPOCHS', Buffer.from(JSON.stringify(completedEpochs)));
        await ctx.stub.putState(`epoch~${epochId}`, Buffer.from(JSON.stringify(epoch)));
        
        // Emit event
        ctx.stub.setEvent('CommitConfirmed', Buffer.from(JSON.stringify({
            epochId: epochId,
            participantId: participantId,
            allConfirmed: allConfirmed
        })));
        
        return JSON.stringify({
            epochId: epochId,
            participantId: participantId,
            confirmed: true,
            allConfirmed: allConfirmed
        });
    }
    
    /**
     * Get epoch status
     * @param {Context} ctx - The transaction context
     * @param {string} epochId - The epoch identifier
     */
    async getEpochStatus(ctx, epochId) {
        // Try active epochs first
        const activeEpochsBuffer = await ctx.stub.getState('ACTIVE_EPOCHS');
        const activeEpochs = JSON.parse(activeEpochsBuffer.toString());
        
        if (activeEpochs[epochId]) {
            return JSON.stringify(activeEpochs[epochId]);
        }
        
        // Try epoch record
        const epochBuffer = await ctx.stub.getState(`epoch~${epochId}`);
        if (epochBuffer && epochBuffer.length > 0) {
            return epochBuffer.toString();
        }
        
        throw new Error(`Epoch ${epochId} not found`);
    }
    
    /**
     * Get all active epochs
     * @param {Context} ctx - The transaction context
     */
    async getActiveEpochs(ctx) {
        const activeEpochsBuffer = await ctx.stub.getState('ACTIVE_EPOCHS');
        return activeEpochsBuffer.toString();
    }
    
    /**
     * Get coordinator configuration
     * @param {Context} ctx - The transaction context
     */
    async getConfig(ctx) {
        const configBuffer = await ctx.stub.getState('CONFIG');
        return configBuffer.toString();
    }
    
    /**
     * Clean up timed out epochs
     * @param {Context} ctx - The transaction context
     */
    async cleanupTimeouts(ctx) {
        const activeEpochsBuffer = await ctx.stub.getState('ACTIVE_EPOCHS');
        const activeEpochs = JSON.parse(activeEpochsBuffer.toString());
        
        const now = new Date();
        const timedOutEpochs = [];
        
        for (const [epochId, epoch] of Object.entries(activeEpochs)) {
            const startTime = new Date(epoch.startTime);
            if (now.getTime() - startTime.getTime() > epoch.timeout) {
                timedOutEpochs.push(epochId);
                await this.abortEpoch(ctx, epochId, 'TIMEOUT');
            }
        }
        
        return JSON.stringify({
            cleanedUp: timedOutEpochs.length,
            epochs: timedOutEpochs
        });
    }
}

module.exports = ScimpCoordinatorChaincode;
