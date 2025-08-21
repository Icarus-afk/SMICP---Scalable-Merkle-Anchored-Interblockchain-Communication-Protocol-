// Demo: create a Merkle batch, sign it with the validator key, anchor it in AnchorRegistry, and verify the proof on-chain
const Web3 = require('web3');
const Web3Ctor = Web3.default || Web3;
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { ScimpMerkle } = require('../../lib/merkle');

async function compileContracts(contractsDir) {
  const sources = {};
  const files = fs.readdirSync(contractsDir).filter(f => f.endsWith('.sol'));
  for (const f of files) sources[f] = { content: fs.readFileSync(path.join(contractsDir, f), 'utf8') };

  const input = { language: 'Solidity', sources: {}, settings: { outputSelection: { '*': { '*': ['abi'] } } } };
  for (const [fname, obj] of Object.entries(sources)) input.sources[fname] = { content: obj.content };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    for (const e of output.errors) console.warn(e.formattedMessage || e.message);
  }
  const abis = {};
  for (const fname of Object.keys(output.contracts || {})) {
    for (const cname of Object.keys(output.contracts[fname] || {})) {
      abis[cname] = output.contracts[fname][cname].abi;
    }
  }
  return abis;
}

async function main() {
  const rpc = process.env.BESU_RPC || 'http://127.0.0.1:8545';
  const web3 = new Web3Ctor(rpc);
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) { console.error('Set PRIVATE_KEY env var'); process.exit(1); }
  const pk = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : '0x' + PRIVATE_KEY;
  const acct = web3.eth.accounts.privateKeyToAccount(pk);
  web3.eth.accounts.wallet.add(acct);
  const from = acct.address;

  const resultsPath = path.join(__dirname, '..', '..', 'results', 'besu_deploy.json');
  if (!fs.existsSync(resultsPath)) { console.error('No deployment results found at', resultsPath); process.exit(1); }
  const addrs = JSON.parse(fs.readFileSync(resultsPath,'utf8'));
  if (!addrs.AnchorRegistry || !addrs.SidechainVerifier) { console.error('Missing AnchorRegistry or SidechainVerifier addresses in', resultsPath); process.exit(1); }

  const contractsDir = path.join(__dirname, 'contracts');
  const abis = await compileContracts(contractsDir);
  if (!abis.AnchorRegistry || !abis.SidechainVerifier) { console.error('Compilation failed to return ABIs'); process.exit(1); }

  const anchor = new web3.eth.Contract(abis.AnchorRegistry, addrs.AnchorRegistry);
  const verifier = new web3.eth.Contract(abis.SidechainVerifier, addrs.SidechainVerifier);

  // Create a batch using the existing merkle helper
  const m = new ScimpMerkle();
  const chainId = process.env.DEMO_CHAIN_ID ? process.env.DEMO_CHAIN_ID : '1';
  const blockNumber = process.env.DEMO_BLOCK_NUMBER ? Number(process.env.DEMO_BLOCK_NUMBER) : 1;
  const batch = m.createBatch(chainId, blockNumber, 32);
  console.log('Batch root:', batch.root);

  // Generate a proof for transaction 0
  const proofObj = m.generateProof(batch, 0);
  const leafHex = proofObj.transactionHash.startsWith('0x') ? proofObj.transactionHash : ('0x' + proofObj.transactionHash);
  const proofHexes = proofObj.proof.map(p => (p.hash.startsWith('0x') ? p.hash : ('0x'+p.hash)));
  const lefts = proofObj.proof.map(p => p.left);

  // compute message hash matching AnchorRegistry: keccak256(abi.encodePacked(chainId, blockNumber, merkleRoot))
  const message = web3.utils.soliditySha3(
    { t: 'uint64', v: chainId },
    { t: 'uint64', v: blockNumber },
    { t: 'bytes32', v: batch.root }
  );
  console.log('Message hash:', message);

  // Sign the message with validator key (we deployed AnchorRegistry with validator = deployer)
  const sig = web3.eth.accounts.sign(message, pk).signature;
  console.log('Signature:', sig);

  // Call anchorRoot
  const gas = await anchor.methods.anchorRoot(chainId, blockNumber, batch.root, [sig]).estimateGas({ from });
  console.log('Estimated gas for anchorRoot:', gas);
  const tx = await anchor.methods.anchorRoot(chainId, blockNumber, batch.root, [sig]).send({ from, gas: Math.floor(gas * 1.2) });
  console.log('Anchor tx hash:', tx.transactionHash);

  // Read anchor back
  const stored = await anchor.methods.getAnchor(chainId, blockNumber).call();
  console.log('Stored anchor:', stored);

  // Verify proof via on-chain verifier
  const ok = await verifier.methods.verifyProof(leafHex, proofHexes, lefts, batch.root).call();
  console.log('On-chain proof verification result:', ok);
}

main().catch(err => { console.error(err); process.exit(1); });
