# SMICP - Scalable Merkle-Anchored Interblockchain Communication Protocol

A comprehensive implementation of SMICP using Hyperledger Fabric for secure, atomic, and privacy-preserving communication between multiple permissioned blockchains.

## Overview

SMICP enables secure cross-chain communication through:
- **Merkle Root Anchoring**: Cryptographic fingerprints of sidechain blocks anchored on mainchain
- **Cross-Chain Verification**: Lightweight verification using Merkle proofs
- **Atomic Transactions**: Two-Phase Commit protocol for atomic cross-chain operations
- **Fault Detection**: Comprehensive monitoring and fault handling
- **Privacy Preservation**: Minimal data exposure during verification

## Architecture

### Components

1. **Mainchain (AnchorRegistry)**
   - Stores Merkle roots from sidechains
   - Validates signatures from authorized validators
   - Provides tamper-evident audit trail

2. **Sidechains (SidechainVerifier)**
   - Process domain-specific transactions
   - Verify cross-chain transactions using Merkle proofs
   - Participate in atomic cross-chain transactions

3. **Coordinator (SMICPCoordinator)**
   - Manages Two-Phase Commit protocol
   - Ensures atomicity across multiple chains
   - Handles timeout and failure scenarios

4. **Merkle Library**
   - Generates Merkle trees from transaction batches
   - Creates and verifies Merkle proofs
   - Supports batch processing and optimization

## Process Flow

### 1. Transaction Processing on Sidechains
- Transactions are grouped into blocks
- Merkle tree is constructed from transaction hashes
- Block is finalized using Proof of Authority consensus
- Block header includes Merkle root and validator signatures

### 2. Merkle Root Anchoring on Mainchain
- Sidechain submits Merkle root with validator signatures
- Mainchain validates signatures and stores root
- Anchored root serves as cryptographic proof of sidechain state

### 3. Cross-Chain Verification
- Requesting chain obtains Merkle proof from source chain
- Verification performed against anchored root from mainchain
- Lightweight verification without accessing full transaction data

### 4. Atomic Cross-Chain Transactions (2PC)
- **Prepare Phase**: All participants validate and prepare transaction
- **Commit Phase**: Upon unanimous agreement, all chains commit atomically
- **Rollback**: Any failure triggers rollback across all participants

### 5. Fault Detection and Monitoring
- Continuous monitoring for signature mismatches
- Detection of invalid Merkle proofs
- Timeout handling and automatic rollback
- Comprehensive audit logging

## Installation

### Prerequisites
- Node.js 16+
- Docker and Docker Compose
- Hyperledger Fabric binaries (optional, for full deployment)

### Setup

```bash
# Install dependencies
npm install

# Make scripts executable
chmod +x network/start-network.sh
chmod +x network/stop-network.sh

# Start the demo network (simplified version)
npm run start-network

# Run the SMICP demonstration
npm run demo
```

## Project Structure

```
SMICP/
├── chaincode/                 # Smart contracts
│   ├── anchor-registry.js     # Mainchain anchor registry
│   ├── sidechain-verifier.js  # Sidechain verification logic
│   └── SMICP-coordinator.js   # Two-phase commit coordinator
├── lib/                       # Core libraries
│   └── merkle.js             # Merkle tree implementation
├── application/              # Client applications
│   └── gateway.js            # Fabric gateway interface
├── network/                  # Network configuration
│   ├── start-network.sh      # Network startup script
│   └── stop-network.sh       # Network cleanup script
├── scripts/                  # Demonstration scripts
│   └── demo_multichain_2pc.js # Complete SMICP demo
└── test/                     # Test files
```

## Usage

### Running the Demo

The complete SMICP demonstration showcases all protocol features:

```bash
npm run demo
```

This demo will:
1. Initialize mainchain and two sidechains
2. Process 256 transactions on each sidechain
3. Anchor Merkle roots on mainchain with validator signatures
4. Relay anchored roots to sidechains for verification
5. Demonstrate cross-chain transaction verification
6. Execute atomic cross-chain transaction using 2PC
7. Show fault detection and monitoring capabilities

### Individual Components

#### Starting Networks
```bash
# Start all networks
npm run start-network

# Stop and clean up
npm run stop-network
```

#### Interacting with Chaincode

```javascript
const SMICPGateway = require('./application/gateway');

// Connect to mainchain
const gateway = new SMICPGateway();
await gateway.connect('mainchain', 'admin');

// Anchor a Merkle root
const result = await gateway.anchorRoot(
    'chainA',
    1001,
    '0x123abc...',
    signatures,
    metadata
);
```

## Configuration

### Network Configuration
- Modify `network/docker-compose.yml` for custom network topology
- Update connection profiles in `application/gateway.js`
- Configure validator sets in chaincode initialization

### Chaincode Parameters
- Adjust timeout values for 2PC protocol
- Configure required signature thresholds
- Modify batch sizes for Merkle tree generation

## Security Features

### Cryptographic Security
- SHA-256 hashing for Merkle trees
- ECDSA signatures for validator authentication
- Tamper-evident storage on immutable ledger

### Network Security
- TLS encryption for all network communication
- Certificate-based authentication
- Network isolation using Docker containers

### Access Control
- Role-based access control (RBAC)
- Multi-signature validation requirements
- Administrative functions protected by ACL

## Performance Optimization

### Batch Processing
- Configurable transaction batch sizes
- Parallel processing of Merkle proof generation
- Optimized tree traversal algorithms

### Network Optimization
- Event-driven architecture for real-time updates
- Connection pooling for high throughput
- Asynchronous processing for non-blocking operations

## Monitoring and Logging

### Event Monitoring
- Real-time event streaming from chaincode
- Comprehensive audit trail
- Performance metrics collection

### Fault Detection
- Automated signature verification
- Merkle proof validation
- Timeout detection and handling
- System health monitoring

## Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run performance benchmarks
npm run test:performance
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement changes with tests
4. Submit a pull request

## License

This project is licensed under the Apache License 2.0.

## Contact

For questions or support, please open an issue on GitHub.

---

## Detailed Process Flow Reference

### Step 1: Sidechain Transaction Processing
```
Transactions → Block → Merkle Tree → PoA Consensus → Block Header
```

### Step 2: Mainchain Anchoring
```
Merkle Root + Signatures → Validation → Storage → Event Emission
```

### Step 3: Cross-Chain Verification
```
Transaction + Proof → Verification → Trust Validation → Confirmation
```

### Step 4: Atomic Cross-Chain Transaction
```
Begin → Prepare Phase → All Ready? → Commit Phase → Confirmation
```

### Step 5: Fault Handling
```
Monitor → Detect Fault → Classify → Response → Recovery → Log
```

This implementation provides a production-ready foundation for secure, scalable interblockchain communication using proven enterprise blockchain technology.
