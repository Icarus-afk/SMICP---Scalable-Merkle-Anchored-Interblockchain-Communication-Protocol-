// Deploy Solidity contracts in network/besu/contracts to Besu
const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const BN = require('bn.js');

async function compileContracts(contractsDir) {
  const sources = {};
  const files = fs.readdirSync(contractsDir).filter(f => f.endsWith('.sol'));
  for (const f of files) {
    const content = fs.readFileSync(path.join(contractsDir, f), 'utf8');
    sources[f] = { content };
  }

  const input = {
    language: 'Solidity',
    sources: {},
    settings: {
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode']
        }
      }
    }
  };

  for (const [fname, obj] of Object.entries(sources)) {
    input.sources[fname] = { content: obj.content };
  }

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const fatal = output.errors.filter(e => e.severity === 'error');
    for (const e of output.errors) console.warn(e.formattedMessage || e.message);
    if (fatal.length > 0) throw new Error('Compilation failed');
  }

  const contracts = {};
  for (const fname of Object.keys(output.contracts)) {
    for (const cname of Object.keys(output.contracts[fname])) {
      const c = output.contracts[fname][cname];
      contracts[cname] = {
        abi: c.abi,
        bytecode: '0x' + (c.evm.bytecode.object || '')
      };
    }
  }
  return contracts;
}

async function deployAll() {
  const rpc = process.env.BESU_RPC || 'http://127.0.0.1:8545';
  const web3 = new Web3(rpc);
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    console.error('Set PRIVATE_KEY env var to a funded account');
    process.exit(1);
  }
  const pk = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : '0x'+PRIVATE_KEY;
  const acct = web3.eth.accounts.privateKeyToAccount(pk);
  web3.eth.accounts.wallet.add(acct);
  const from = acct.address;

  const contractsDir = path.join(__dirname, 'contracts');
  if (!fs.existsSync(contractsDir)) throw new Error('contracts directory not found: ' + contractsDir);

  console.log('Compiling contracts in', contractsDir);
  const compiled = await compileContracts(contractsDir);
  console.log('Compiled contracts:', Object.keys(compiled));

  const results = {};

  // Prepare gas price and chainId
  const chainId = (await web3.eth.getChainId()) || Number(process.env.BESU_CHAIN_ID) || 1337;
  let gasPrice = await web3.eth.getGasPrice();
  if (typeof gasPrice === 'bigint') gasPrice = gasPrice.toString();
  if (BN.isBN && BN.isBN(gasPrice)) gasPrice = gasPrice.toString(10);
  gasPrice = new BN(gasPrice.toString());
  const gasPriceHex = '0x' + gasPrice.toString(16);

  let nonce = await web3.eth.getTransactionCount(from);

  for (const [name, info] of Object.entries(compiled)) {
    console.log('Deploying', name);
    const contract = new web3.eth.Contract(info.abi);
    // constructor args: AnchorRegistry expects (address[] validators, uint256 requiredSignatures)
    let args = [];
    if (name === 'AnchorRegistry') args = [[from], 1];

    const deploy = contract.deploy({ data: info.bytecode, arguments: args });
    const data = deploy.encodeABI();
    const gasEstimate = await deploy.estimateGas({ from }).catch(() => 3000000);

    const tx = {
      nonce: web3.utils.toHex(nonce++),
      gas: web3.utils.toHex(gasEstimate),
      gasPrice: gasPriceHex,
      data: data,
      from: from,
      chainId: Number(chainId)
    };

    const signed = await web3.eth.accounts.signTransaction(tx, pk);
    const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
    console.log(`${name} deployed at`, receipt.contractAddress);
    results[name] = receipt.contractAddress;
  }

  const resultsDir = path.join(__dirname, '..', '..', 'results');
  try { fs.mkdirSync(resultsDir, { recursive: true }); } catch (e) {}
  fs.writeFileSync(path.join(resultsDir, 'besu_deploy.json'), JSON.stringify(results, null, 2));
  console.log('Wrote results to', path.join(resultsDir, 'besu_deploy.json'));
}

deployAll().catch(err => { console.error(err); process.exit(1); });
