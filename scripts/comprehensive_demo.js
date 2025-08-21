const { ScimpMerkle } = require('../lib/merkle');
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive SCIMP Demo - All-in-One Demo with Results Export
 * Features: Performance testing, multi-chain scenarios, fault simulation, and full SCIMP workflow
 * Export formats: JSON, CSV, XML, TXT
 */
class ComprehensiveScimpDemo {
    constructor(config = {}) {
        this.merkle = new ScimpMerkle();
        this.connections = {};
        this.wallets = {};
        
        // Initialize results tracking
        this.results = {
            summary: {},
            performance: [],
            multiChain: {},
            faults: [],
            transactions: [],
            workflow: [],
            config: {},
            timestamp: new Date().toISOString(),
            executionId: `scimp_comprehensive_${Date.now()}`
        };
        
        // Configuration with sensible defaults
        this.config = {
            // Transaction parameters
            baseTransactionCount: config.baseTransactionCount || 64,
            transactionGap: config.transactionGap || 64,
            
            // Chain parameters
            chainCount: config.chainCount || 3,
            validatorCount: config.validatorCount || 3,
            requiredSignatures: config.requiredSignatures || 2,
            
            // Performance test volumes
            performanceVolumes: config.performanceVolumes || [64, 128, 256, 512, 1024],
            
            // Multi-chain test
            multiChainCount: config.multiChainCount || 5,
            
            // Export formats
            exportFormats: config.exportFormats || ['json', 'csv', 'txt']
        };

        // Metrics tracking
        this.metrics = {
            startTime: 0,
            totalTime: 0,
            totalTransactions: 0,
            totalVerifications: 0,
            verificationSuccessCount: 0,
            stepTimes: []
        };
    }

    /**
     * Initialize blockchain networks
     */
    async initializeNetworks() {
        console.log('🌐 Step 1: Initialize Blockchain Networks');
        const stepStart = Date.now();
        
        // Initialize mainchain
        console.log('  Initializing Mainchain...');
        this.connections.mainchain = { id: 'mainchain', initialized: true };
        
        // Initialize sidechains
        for (let i = 0; i < this.config.chainCount; i++) {
            const chainId = `chain${String.fromCharCode(65 + i)}`; // chainA, chainB, etc.
            console.log(`  Initializing ${chainId}...`);
            this.connections[chainId] = { id: chainId, initialized: true };
        }
        
        const stepTime = Date.now() - stepStart;
        this.metrics.stepTimes.push({ step: 1, name: 'Network Initialization', time: stepTime });
        
        console.log(`✓ Initialized ${this.config.chainCount + 1} networks in ${stepTime}ms`);
        this.results.workflow.push({
            step: 1,
            name: 'Network Initialization',
            time: `${stepTime}ms`,
            details: `Initialized ${this.config.chainCount + 1} networks`,
            performance: stepTime === 0 ? 'Instantaneous' : `${((this.config.chainCount + 1) / (stepTime / 1000)).toFixed(0)} networks/sec`
        });
    }

    /**
     * Performance testing with different transaction volumes
     */
    async performanceTest() {
        console.log('\n🚀 Step 2: Performance Testing');
        const stepStart = Date.now();
        
        for (const volume of this.config.performanceVolumes) {
            const testStart = Date.now();
            
            console.log(`  Testing volume: ${volume} transactions`);
            const batch = this.merkle.createBatch('testChain', 1000, volume);
            const proof = this.merkle.generateProof(batch, 0);
            // Use the built-in MerkleTree verify method which is more reliable
            const isValid = batch.tree.verify(proof.proof.map(p => p.hash), proof.transactionHash, batch.root);
            
            const testTime = Date.now() - testStart;
            const throughput = volume / (testTime / 1000);
            
            this.results.performance.push({
                volume: `${volume} transactions`,
                executionTime: `${testTime}ms`,
                isValid,
                proofElements: `${proof.proof.length} elements`,
                throughput: `${Math.round(throughput)} tx/sec`,
                proofDepth: `${Math.log2(volume).toFixed(0)} levels`
            });
            
            console.log(`    ✓ ${volume} txs: ${testTime}ms, Valid: ${isValid}, Throughput: ${Math.round(throughput)} tx/sec`);
            this.metrics.totalTransactions += volume;
        }
        
        const stepTime = Date.now() - stepStart;
        this.metrics.stepTimes.push({ step: 2, name: 'Performance Testing', time: stepTime });
        
        console.log(`✓ Performance testing completed in ${stepTime}ms`);
        this.results.workflow.push({
            step: 2,
            name: 'Performance Testing',
            time: `${stepTime}ms`,
            details: `Tested ${this.config.performanceVolumes.length} different volumes`,
            performance: `${Math.round(this.metrics.totalTransactions / (stepTime / 1000))} tx/sec overall`
        });
    }

    /**
     * Multi-chain scenario testing
     */
    async multiChainTest() {
        console.log('\n🌐 Step 3: Multi-Chain Scenario Testing');
        const stepStart = Date.now();
        
        const chains = [];
        for (let i = 0; i < this.config.multiChainCount; i++) {
            chains.push(`chain${String.fromCharCode(65 + i)}`);
        }
        
        const batches = {};
        
        // Generate batches for all chains
        console.log(`  Creating batches for ${chains.length} chains...`);
        for (const chain of chains) {
            batches[chain] = this.merkle.createBatch(chain, 2000, 100);
            console.log(`    ✓ ${chain}: 100 txs, root: ${batches[chain].root.substring(0, 12)}...`);
        }
        
        // Cross-verify transactions
        const sourceChain = chains[0];
        const targetChain = chains[1];
        const txIndex = Math.floor(Math.random() * 100);
        
        console.log(`  Cross-chain verification: ${sourceChain} → ${targetChain}`);
        const proof = this.merkle.generateProof(batches[sourceChain], txIndex);
        const isValid = batches[sourceChain].tree.verify(
            proof.proof.map(p => p.hash), 
            proof.transactionHash, 
            batches[sourceChain].root
        );
        
        const stepTime = Date.now() - stepStart;
        this.metrics.stepTimes.push({ step: 3, name: 'Multi-Chain Testing', time: stepTime });
        this.metrics.totalVerifications++;
        if (isValid) this.metrics.verificationSuccessCount++;
        
        console.log(`    ✓ Verification result: ${isValid}`);
        console.log(`✓ Multi-chain testing completed in ${stepTime}ms`);
        
        this.results.multiChain = {
            chains: `${chains.length} chains`,
            totalTransactions: `${chains.length * 100} transactions`,
            executionTime: `${stepTime}ms`,
            crossChainVerification: isValid ? 'SUCCESS' : 'FAILED',
            avgTransactionsPerChain: `${100} tx/chain`,
            batches: chains.map(chain => ({
                chainId: chain,
                transactionCount: `100 transactions`,
                root: batches[chain].root,
                rootLength: `${batches[chain].root.length} characters`
            }))
        };
        
        this.results.workflow.push({
            step: 3,
            name: 'Multi-Chain Testing',
            time: `${stepTime}ms`,
            details: `Tested ${chains.length} chains with cross-chain verification`,
            performance: `${Math.round((chains.length * 100) / (stepTime / 1000))} tx/sec`
        });
    }

    /**
     * Fault scenario testing
     */
    async faultTest() {
        console.log('\n⚠️ Step 4: Fault Scenario Testing');
        const stepStart = Date.now();
        
        const batch = this.merkle.createBatch('faultChain', 3000, 128);
        const proof = this.merkle.generateProof(batch, 50);
        const faultTests = [];
        
        // Test 1: Valid proof
        console.log('  Testing valid proof...');
        const validResult = batch.tree.verify(proof.proof.map(p => p.hash), proof.transactionHash, batch.root);
        console.log(`    ✓ Valid proof: ${validResult}`);
        faultTests.push({ type: 'valid_proof', result: validResult });
        
        // Test 2: Tampered proof
        console.log('  Testing tampered proof...');
        const tamperedProofHashes = proof.proof.map(p => p.hash);
        if (tamperedProofHashes.length > 0) {
            tamperedProofHashes[0] = 'tampered_hash';
        }
        const tamperedResult = batch.tree.verify(tamperedProofHashes, proof.transactionHash, batch.root);
        console.log(`    ✗ Tampered proof: ${tamperedResult}`);
        faultTests.push({ type: 'tampered_proof', result: tamperedResult });
        
        // Test 3: Wrong root
        console.log('  Testing wrong root...');
        const wrongRootResult = batch.tree.verify(proof.proof.map(p => p.hash), proof.transactionHash, 'wrong_root_hash');
        console.log(`    ✗ Wrong root: ${wrongRootResult}`);
        faultTests.push({ type: 'wrong_root', result: wrongRootResult });
        
        const stepTime = Date.now() - stepStart;
        this.metrics.stepTimes.push({ step: 4, name: 'Fault Testing', time: stepTime });
        
        console.log(`✓ Fault testing completed in ${stepTime}ms`);
        
        this.results.faults = faultTests.map(test => ({
            type: test.type.replace('_', ' ').toUpperCase(),
            result: test.result ? 'PASS' : 'FAIL',
            expected: test.type === 'valid_proof' ? 'PASS' : 'FAIL',
            status: (test.result && test.type === 'valid_proof') || (!test.result && test.type !== 'valid_proof') ? 'CORRECT' : 'INCORRECT'
        }));
        this.results.workflow.push({
            step: 4,
            name: 'Fault Testing',
            time: `${stepTime}ms`,
            details: `Tested ${faultTests.length} fault scenarios`,
            performance: stepTime === 0 ? 'Instantaneous' : `${Math.round(faultTests.length / (stepTime / 1000))} tests/sec`
        });
    }

    /**
     * Two-Phase Commit demonstration
     */
    async twoPCDemo() {
        console.log('\n🔄 Step 5: Two-Phase Commit Demonstration');
        const stepStart = Date.now();
        
        const participants = ['chainA', 'chainB', 'chainC'];
        const epochId = `epoch_${Date.now()}`;
        
        console.log(`  Initiating 2PC with ${participants.length} participants: ${participants.join(', ')}`);
        
        // Phase 1: Prepare
        console.log('  Phase 1: Prepare...');
        const prepareResults = [];
        for (const participant of participants) {
            const prepared = true; // Simulate preparation
            prepareResults.push({ participant, prepared });
            console.log(`    ✓ ${participant} prepared`);
        }
        
        // Phase 2: Commit
        const allPrepared = prepareResults.every(r => r.prepared);
        if (allPrepared) {
            console.log('  Phase 2: Commit...');
            for (const participant of participants) {
                console.log(`    ✓ ${participant} committed`);
            }
            console.log(`    ✓ Transaction committed: tx_${Date.now()}`);
        }
        
        const stepTime = Date.now() - stepStart;
        this.metrics.stepTimes.push({ step: 5, name: 'Two-Phase Commit', time: stepTime });
        
        console.log(`✓ 2PC demonstration completed in ${stepTime}ms`);
        
        this.results.workflow.push({
            step: 5,
            name: 'Two-Phase Commit',
            time: `${stepTime}ms`,
            details: `${participants.length} participants, all committed successfully`,
            performance: stepTime === 0 ? 'Instantaneous' : `${Math.round(participants.length / (stepTime / 1000))} participants/sec`
        });
    }

    /**
     * Export results in multiple formats
     */
    async exportResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseFilename = `scimp_comprehensive_${timestamp}`;
        const outputDir = path.join(__dirname, '..', 'results');
        
        // Ensure results directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Finalize results
        this.results.config = this.config;
        
        // Calculate average performance from numerical values
        const avgThroughput = this.results.performance.length > 0 ?
            this.results.performance.reduce((sum, p) => {
                const numValue = parseInt(p.throughput.replace(/[^0-9]/g, ''));
                return sum + (isNaN(numValue) ? 0 : numValue);
            }, 0) / this.results.performance.length : 0;
        
        this.results.summary = {
            executionTime: `${this.metrics.totalTime}ms`,
            totalTransactions: this.metrics.totalTransactions,
            totalVerifications: this.metrics.totalVerifications,
            successRate: `${this.metrics.totalVerifications > 0 ? 
                (this.metrics.verificationSuccessCount / this.metrics.totalVerifications * 100).toFixed(2) : 0}%`,
            avgPerformance: `${Math.round(avgThroughput)} tx/sec`,
            avgStepTime: `${Math.round(this.metrics.stepTimes.reduce((sum, step) => sum + step.time, 0) / this.metrics.stepTimes.length)}ms`
        };

        const exportedFiles = [];

        // Export in requested formats
        for (const format of this.config.exportFormats) {
            let content = '';
            let filename = '';
            
            switch (format) {
                case 'json':
                    filename = `${baseFilename}.json`;
                    content = JSON.stringify(this.results, null, 2);
                    break;
                    
                case 'csv':
                    filename = `${baseFilename}.csv`;
                    content = this.generateCSV();
                    break;
                    
                case 'xml':
                    filename = `${baseFilename}.xml`;
                    content = this.generateXML();
                    break;
                    
                case 'txt':
                    filename = `${baseFilename}.txt`;
                    content = this.generateTXT();
                    break;
            }
            
            if (content) {
                const filePath = path.join(outputDir, filename);
                fs.writeFileSync(filePath, content);
                exportedFiles.push(filePath);
                console.log(`📄 ${format.toUpperCase()} results saved: ${filePath}`);
            }
        }

        return exportedFiles;
    }

    /**
     * Generate CSV format
     */
    generateCSV() {
        let csv = 'SCIMP Comprehensive Demo Results\n';
        csv += `Execution ID,${this.results.executionId}\n`;
        csv += `Timestamp,${this.results.timestamp}\n\n`;

        // Summary
        csv += 'Summary\n';
        csv += 'Metric,Value\n';
        csv += `Total Execution Time,${this.results.summary.executionTime}\n`;
        csv += `Total Transactions,${this.results.summary.totalTransactions}\n`;
        csv += `Success Rate,${this.results.summary.successRate}\n`;
        csv += `Average Performance,${this.results.summary.avgPerformance}\n`;
        csv += `Average Step Time,${this.results.summary.avgStepTime}\n\n`;

        // Performance results
        csv += 'Performance Test Results\n';
        csv += 'Volume,Execution Time,Valid,Proof Elements,Throughput,Proof Depth\n';
        this.results.performance.forEach(perf => {
            csv += `${perf.volume},${perf.executionTime},${perf.isValid},${perf.proofElements},${perf.throughput},${perf.proofDepth}\n`;
        });
        csv += '\n';

        // Multi-chain results
        csv += 'Multi-Chain Test Results\n';
        csv += 'Total Chains,Total Transactions,Execution Time,Cross-Chain Verification,Avg per Chain\n';
        csv += `${this.results.multiChain.chains},${this.results.multiChain.totalTransactions},${this.results.multiChain.executionTime},${this.results.multiChain.crossChainVerification},${this.results.multiChain.avgTransactionsPerChain}\n\n`;

        // Fault test results
        csv += 'Fault Test Results\n';
        csv += 'Test Type,Result,Expected,Status\n';
        this.results.faults.forEach(fault => {
            csv += `${fault.type},${fault.result},${fault.expected},${fault.status}\n`;
        });
        csv += '\n';

        // Workflow steps
        csv += 'Workflow Steps\n';
        csv += 'Step,Name,Time,Details,Performance\n';
        this.results.workflow.forEach(step => {
            csv += `${step.step},${step.name},${step.time},"${step.details}",${step.performance}\n`;
        });

        return csv;
    }

    /**
     * Generate XML format
     */
    generateXML() {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<scimpResults>\n';
        xml += `  <executionId>${this.results.executionId}</executionId>\n`;
        xml += `  <timestamp>${this.results.timestamp}</timestamp>\n`;
        
        xml += '  <summary>\n';
        Object.entries(this.results.summary).forEach(([key, value]) => {
            xml += `    <${key}>${value}</${key}>\n`;
        });
        xml += '  </summary>\n';

        xml += '  <performance>\n';
        this.results.performance.forEach(perf => {
            xml += '    <test>\n';
            xml += `      <volume>${perf.volume}</volume>\n`;
            xml += `      <executionTime>${perf.executionTime}</executionTime>\n`;
            xml += `      <throughput>${perf.throughput}</throughput>\n`;
            xml += '    </test>\n';
        });
        xml += '  </performance>\n';

        xml += '</scimpResults>\n';
        return xml;
    }

    /**
     * Generate TXT format
     */
    generateTXT() {
        let txt = '='.repeat(80) + '\n';
        txt += 'SCIMP Comprehensive Demo Results\n';
        txt += '='.repeat(80) + '\n';
        txt += `Execution ID: ${this.results.executionId}\n`;
        txt += `Timestamp: ${this.results.timestamp}\n\n`;

        txt += 'SUMMARY\n';
        txt += '-'.repeat(40) + '\n';
        Object.entries(this.results.summary).forEach(([key, value]) => {
            txt += `${key.padEnd(25)}: ${value}\n`;
        });
        txt += '\n';

        txt += 'PERFORMANCE RESULTS\n';
        txt += '-'.repeat(40) + '\n';
        this.results.performance.forEach(perf => {
            txt += `Volume ${perf.volume}: ${perf.throughput} tx/sec (${perf.executionTime}ms)\n`;
        });
        txt += '\n';

        txt += 'WORKFLOW STEPS\n';
        txt += '-'.repeat(40) + '\n';
        this.results.workflow.forEach(step => {
            txt += `Step ${step.step}: ${step.name} - ${step.time}ms\n`;
            txt += `  ${step.details}\n`;
        });

        return txt;
    }

    /**
     * Run the complete comprehensive demo
     */
    async runDemo() {
        console.log('🚀 Starting SCIMP Comprehensive Demo');
        console.log('══════════════════════════════════════════════════════════════════');
        console.log(`Configuration: ${this.config.chainCount} chains, ${this.config.baseTransactionCount} base transactions`);
        console.log(`Performance volumes: ${this.config.performanceVolumes.join(', ')}`);
        console.log(`Export formats: ${this.config.exportFormats.join(', ')}`);
        console.log('══════════════════════════════════════════════════════════════════\n');

        this.metrics.startTime = Date.now();

        try {
            await this.initializeNetworks();
            await this.performanceTest();
            await this.multiChainTest();
            await this.faultTest();
            await this.twoPCDemo();
            
            // Finalize metrics
            this.metrics.totalTime = Date.now() - this.metrics.startTime;
            
            console.log('\n📊 Demo Summary');
            console.log('══════════════════════════════════════════════════════════════════');
            console.log(`Total execution time: ${this.metrics.totalTime}ms`);
            console.log(`Total transactions processed: ${this.metrics.totalTransactions}`);
            console.log(`Total verifications: ${this.metrics.totalVerifications}`);
            console.log(`Success rate: ${this.metrics.totalVerifications > 0 ? 
                (this.metrics.verificationSuccessCount / this.metrics.totalVerifications * 100).toFixed(2) : 0}%`);
            
            // Export results
            console.log('\n📄 Exporting Results...');
            const exportedFiles = await this.exportResults();
            console.log(`✅ Results exported to ${exportedFiles.length} files:`);
            exportedFiles.forEach(file => console.log(`   📄 ${file}`));
            
            console.log('\n🎉 SCIMP Comprehensive Demo Completed Successfully!');
            
        } catch (error) {
            console.error('❌ Demo encountered an error:', error.message);
            console.error(error.stack);
        }
    }
}

// Configuration presets
const PRESETS = {
    quick: {
        chainCount: 2,
        performanceVolumes: [64, 128],
        multiChainCount: 3,
        exportFormats: ['json', 'csv']
    },
    standard: {
        chainCount: 3,
        performanceVolumes: [64, 128, 256, 512],
        multiChainCount: 5,
        exportFormats: ['json', 'csv', 'txt']
    },
    comprehensive: {
        chainCount: 5,
        performanceVolumes: [64, 128, 256, 512, 1024, 2048],
        multiChainCount: 7,
        exportFormats: ['json', 'csv', 'xml', 'txt']
    }
};

// Run demo
if (require.main === module) {
    const preset = process.argv[2] || 'standard';
    const config = PRESETS[preset] || PRESETS.standard;
    
    console.log(`Using preset: ${preset}`);
    const demo = new ComprehensiveScimpDemo(config);
    demo.runDemo().catch(console.error);
}

module.exports = { ComprehensiveScimpDemo, PRESETS };
