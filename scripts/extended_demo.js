const { ScimpMerkle } = require('../lib/merkle');
const fs = require('fs');
const path = require('path');

/**
 * Extended SCIMP Demo - Experiment with different scenarios and export results
 */
class ExtendedScimpDemo {
    constructor() {
        this.merkle = new ScimpMerkle();
        this.results = {
            performance: [],
            multiChain: {},
            faults: [],
            timestamp: new Date().toISOString(),
            executionId: `extended_${Date.now()}`
        };
    }

    /**
     * Test different transaction volumes and measure performance
     */
    async performanceTest() {
        console.log('🚀 SCIMP Performance Testing');
        
        const volumes = [64, 128, 256, 512, 1024];
        
        for (const volume of volumes) {
            const startTime = Date.now();
            console.time(`Batch-${volume}`);
            
            const batch = this.merkle.createBatch('testChain', 1000, volume);
            const proof = this.merkle.generateProof(batch, 0);
            // Use the correct verification method
            const isValid = batch.tree.verify(proof.proof.map(p => p.hash), proof.transactionHash, batch.root);
            
            const endTime = Date.now();
            const executionTime = endTime - startTime;
            
            console.timeEnd(`Batch-${volume}`);
            console.log(`  Volume: ${volume}, Valid: ${isValid}, Proof Elements: ${proof.proof.length}`);
            
            // Store results
            this.results.performance.push({
                volume,
                executionTime,
                isValid,
                proofElements: proof.proof.length,
                throughput: volume / (executionTime / 1000)
            });
        }
    }

    /**
     * Test multi-chain scenario with 5 chains
     */
    async multiChainTest() {
        console.log('\n🌐 Multi-Chain Scenario (5 Chains)');
        
        const chains = ['chainA', 'chainB', 'chainC', 'chainD', 'chainE'];
        const batches = {};
        const startTime = Date.now();
        
        // Generate batches for all chains
        for (const chain of chains) {
            batches[chain] = this.merkle.createBatch(chain, 2000, 100);
            console.log(`✓ ${chain}: ${batches[chain].transactionCount} txs, root: ${batches[chain].root.substring(0, 10)}...`);
        }
        
        // Cross-verify random transactions
        const sourceChain = chains[0];
        const targetChain = chains[1];
        const txIndex = Math.floor(Math.random() * 100);
        
        const proof = this.merkle.generateProof(batches[sourceChain], txIndex);
        const isValid = this.merkle.verifyProof(
            proof.transactionHash, 
            proof.proof, 
            batches[sourceChain].root
        );
        
        const endTime = Date.now();
        
        console.log(`✓ Cross-chain verification: ${sourceChain} → ${targetChain}: ${isValid}`);
        
        // Store results
        this.results.multiChain = {
            chains: chains.length,
            totalTransactions: chains.length * 100,
            executionTime: endTime - startTime,
            crossChainVerification: isValid,
            batches: Object.keys(batches).map(chain => ({
                chainId: chain,
                transactionCount: batches[chain].transactionCount,
                root: batches[chain].root
            }))
        };
    }

    /**
     * Test fault scenarios
     */
    async faultTest() {
        console.log('\n⚠️ Fault Scenario Testing');
        
        const batch = this.merkle.createBatch('faultChain', 3000, 128);
        const proof = this.merkle.generateProof(batch, 50);
        
        const faultTests = [];
        
        // Test 1: Valid proof
        const validResult = this.merkle.verifyProof(proof.transactionHash, proof.proof, batch.root);
        console.log(`✓ Valid proof: ${validResult}`);
        faultTests.push({ type: 'valid_proof', result: validResult });
        
        // Test 2: Tampered proof
        const tamperedProof = [...proof.proof];
        tamperedProof[0].hash = 'tampered_hash';
        const tamperedResult = this.merkle.verifyProof(proof.transactionHash, tamperedProof, batch.root);
        console.log(`✗ Tampered proof: ${tamperedResult}`);
        faultTests.push({ type: 'tampered_proof', result: tamperedResult });
        
        // Test 3: Wrong root
        const wrongRoot = 'wrong_root_hash';
        const wrongRootResult = this.merkle.verifyProof(proof.transactionHash, proof.proof, wrongRoot);
        console.log(`✗ Wrong root: ${wrongRootResult}`);
        faultTests.push({ type: 'wrong_root', result: wrongRootResult });
        
        // Store results
        this.results.faults = faultTests;
    }

    /**
     * Export results in multiple formats
     */
    async exportResults(formats = ['json', 'csv']) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseFilename = `extended_scimp_results_${timestamp}`;
        const outputDir = path.join(__dirname, '..', 'results');
        
        // Ensure results directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const exportedFiles = [];

        if (formats.includes('json')) {
            const jsonFile = path.join(outputDir, `${baseFilename}.json`);
            fs.writeFileSync(jsonFile, JSON.stringify(this.results, null, 2));
            exportedFiles.push(jsonFile);
            console.log(`📄 JSON results saved: ${jsonFile}`);
        }

        if (formats.includes('csv')) {
            const csvFile = path.join(outputDir, `${baseFilename}.csv`);
            const csvContent = this.generateCSV();
            fs.writeFileSync(csvFile, csvContent);
            exportedFiles.push(csvFile);
            console.log(`📄 CSV results saved: ${csvFile}`);
        }

        return exportedFiles;
    }

    /**
     * Generate CSV format for extended demo results
     */
    generateCSV() {
        let csv = '';
        
        // Header
        csv += 'SCIMP Extended Demo Results\n';
        csv += `Execution ID,${this.results.executionId}\n`;
        csv += `Timestamp,${this.results.timestamp}\n\n`;

        // Performance results
        csv += 'Performance Test Results\n';
        csv += 'Volume,Execution Time (ms),Valid,Proof Elements,Throughput (tx/sec)\n';
        this.results.performance.forEach(perf => {
            csv += `${perf.volume},${perf.executionTime},${perf.isValid},${perf.proofElements},${perf.throughput.toFixed(2)}\n`;
        });
        csv += '\n';

        // Multi-chain results
        csv += 'Multi-Chain Test Results\n';
        csv += 'Chains,Total Transactions,Execution Time (ms),Cross-Chain Verification\n';
        csv += `${this.results.multiChain.chains},${this.results.multiChain.totalTransactions},${this.results.multiChain.executionTime},${this.results.multiChain.crossChainVerification}\n\n`;

        // Fault test results
        csv += 'Fault Test Results\n';
        csv += 'Test Type,Result\n';
        this.results.faults.forEach(fault => {
            csv += `${fault.type},${fault.result}\n`;
        });

        return csv;
    }

    async runExtendedDemo() {
        await this.performanceTest();
        await this.multiChainTest();
        await this.faultTest();
        
        // Export results
        console.log('\n📊 Exporting Extended Demo Results...');
        const exportedFiles = await this.exportResults(['json', 'csv']);
        console.log(`✅ Results exported to ${exportedFiles.length} files:`);
        exportedFiles.forEach(file => console.log(`   📄 ${file}`));
    }
}

// Run if called directly
if (require.main === module) {
    const demo = new ExtendedScimpDemo();
    demo.runExtendedDemo().catch(console.error);
}

module.exports = ExtendedScimpDemo;
