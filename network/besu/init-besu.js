const fs = require('fs');
const path = require('path');
const ethUtil = require('ethereumjs-util');
const rlp = require('rlp');
const crypto = require('crypto');

const baseDir = __dirname;
const nodes = ['node1','node2','node3'];

function toBuffer(hex) {
  return Buffer.from(hex.replace(/^0x/, ''), 'hex');
}

function pubKeyToEnode(pubKeyHex, ip, port) {
  // pubKeyHex should be uncompressed public key (64 bytes) without 0x04 prefix
  return `enode://${pubKeyHex}@${ip}:${port}`;
}

async function main() {
  console.log('Generating node keys and genesis for Clique...');
  if (!fs.existsSync(path.join(baseDir, 'genesis'))) fs.mkdirSync(path.join(baseDir, 'genesis'));

  const validators = [];
  const publics = [];

  for (let i = 0; i < nodes.length; i++) {
    const nodeDir = path.join(baseDir, nodes[i]);
    if (!fs.existsSync(nodeDir)) fs.mkdirSync(nodeDir, { recursive: true });

    // generate private key
    const privKey = crypto.randomBytes(32);
    const privHex = privKey.toString('hex');
    // derive public key (uncompressed without 0x04)
    const pubKey = ethUtil.privateToPublic(privKey); // 64 bytes
    const pubHex = pubKey.toString('hex');
    // derive address
    const addr = ethUtil.pubToAddress(pubKey).toString('hex');

    // write nodekey expected by Besu (32 bytes hex)
    fs.writeFileSync(path.join(nodeDir, 'nodekey'), privHex);
    // also save for reference
    fs.writeFileSync(path.join(nodeDir, 'address'), '0x' + addr);

    validators.push('0x' + addr);
    publics.push(pubHex);

    console.log(`Generated ${nodes[i]} -> address=0x${addr}`);
  }

  // Build extraData for Clique: 32 bytes vanity + RLP(list of validator addresses) + 65 bytes empty signature
  const vanity = Buffer.alloc(32).toString('hex');
  const addrBuffers = validators.map(a => Buffer.from(a.replace(/^0x/, ''), 'hex'));
  const rlpEncoded = rlp.encode(addrBuffers).toString('hex');
  const signature = Buffer.alloc(65).toString('hex');
  const extraData = '0x' + vanity + rlpEncoded + signature;

  // Build genesis
  const genesis = {
    config: {
      chainId: 1337,
      clique: {
        period: 2,
        epoch: 30000
      }
    },
    difficulty: '1',
    gasLimit: '0x1fffffffffffff',
    alloc: {},
    extraData
  };

  fs.writeFileSync(path.join(baseDir, 'genesis', 'genesis.json'), JSON.stringify(genesis, null, 2));
  console.log('Wrote genesis/genesis.json');

  // Create static-nodes.json with enode URLs using public keys and mapped ports
  // assume node1:30303, node2:30304, node3:30305
  const enodes = [];
  for (let i = 0; i < publics.length; i++) {
    const pub = publics[i];
    const ip = '127.0.0.1';
    const port = 30303 + i; // 30303,30304,30305
    enodes.push(pubKeyToEnode(pub, ip, port));
  }
  fs.writeFileSync(path.join(baseDir, 'static-nodes.json'), JSON.stringify(enodes, null, 2));
  console.log('Wrote static-nodes.json');

  // Create docker-compose override config files per node
  // Copy genesis to top-level genesis path used by docker-compose
  fs.writeFileSync(path.join(baseDir, 'genesis.json'), JSON.stringify(genesis, null, 2));

  console.log('\nInitialization complete. Next steps:');
  console.log('  1) cd network/besu');
  console.log('  2) npm install ethereumjs-util rlp web3');
  console.log('  3) ./start-besu.sh  # will run docker-compose up -d');
  console.log('  4) Wait for nodes to start, then run deploy-contracts.js to deploy contracts.');
}

main().catch(err => { console.error(err); process.exit(1); });
