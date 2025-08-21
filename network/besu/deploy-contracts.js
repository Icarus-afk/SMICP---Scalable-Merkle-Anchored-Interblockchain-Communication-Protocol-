const Web3 = require('web3');
const fs = require('fs');
const { Transaction } = require('@ethereumjs/tx');
// tolerate either ESM default or CJS export for @ethereumjs/common
const CommonModule = require('@ethereumjs/common');
const Common = CommonModule && (CommonModule.default || CommonModule);

const Web3Ctor = Web3.default || Web3;
const BN = require('bn.js');

async function main() {
  const rpc = process.env.BESU_RPC || 'http://127.0.0.1:8545';
  const web3 = new Web3Ctor(rpc);

  const resultsDir = '../../results';
  try { fs.mkdirSync(resultsDir, { recursive: true }); } catch (e) { }

  const accounts = await web3.eth.getAccounts();
  console.log('RPC:', rpc);
  console.log('Accounts from node:', accounts);

  let from;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  let pk = null;
  if (PRIVATE_KEY) {
    pk = PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : '0x' + PRIVATE_KEY;
    const acct = web3.eth.accounts.privateKeyToAccount(pk);
    web3.eth.accounts.wallet.add(acct);
    from = acct.address;
    console.log('Using PRIVATE_KEY account:', from);
  } else if (accounts && accounts.length > 0) {
    from = accounts[0];
    console.log('Using node account:', from);
  } else {
    console.error('No accounts available from node and no PRIVATE_KEY provided.');
    console.error('Options:');
    console.error('  1) Fund an account in genesis and restart the network (recommended for testing).');
    console.error('  2) Set PRIVATE_KEY env var to a funded account and run again:');
    console.error('     PRIVATE_KEY=<hexkey> node deploy-contracts.js');
    process.exit(1);
  }

  // placeholder: deploy simple contract to test connectivity
  const abi = [{ "inputs": [], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [], "name": "ping", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }];
  const bytecode = '0x6080604052348015600f57600080fd5b50603e80601d6000396000f3fe6080604052600080fdfea2646970667358221220e3b2c8f8c7f2e90f3b2d6f1a3e6c9a52a9a2a1c2b3c4d5e6f7a8b9c0d1e2f3a64736f6c63430008040033';

  const Contract = new web3.eth.Contract(abi);
  const deploy = Contract.deploy({ data: bytecode });

  const gasEstimate = await deploy.estimateGas({ from }).catch(() => 3000000);
  console.log('Estimated gas:', gasEstimate);

  // Prepare transaction options with EIP-1559 detection and legacy fallback
  const latestBlock = await web3.eth.getBlock('latest');
  const txOptions = { from, gas: gasEstimate };

  // Ensure we include the correct chainId so signatures are created appropriately
  try {
    const cid = await web3.eth.getChainId();
    txOptions.chainId = Number(cid);
  } catch (e) {
    // fallback to configured chainId
    txOptions.chainId = process.env.BESU_CHAIN_ID ? Number(process.env.BESU_CHAIN_ID) : 1337;
  }

  if (latestBlock && latestBlock.baseFeePerGas) {
    // Network supports EIP-1559
    const base = new BN(latestBlock.baseFeePerGas.toString());
    const maxPriority = new BN(web3.utils.toWei('1', 'gwei').toString());
    const maxFee = base.mul(new BN(2)).add(maxPriority);
    txOptions.maxPriorityFeePerGas = '0x' + maxPriority.toString(16);
    txOptions.maxFeePerGas = '0x' + maxFee.toString(16);
    console.log('Using EIP-1559 tx options', txOptions.maxPriorityFeePerGas, txOptions.maxFeePerGas, 'chainId=', txOptions.chainId);
  } else {
    // Fallback to legacy gasPrice
    let gasPrice = await web3.eth.getGasPrice();
    // Normalize BigInt or BN to string
    if (typeof gasPrice === 'bigint') gasPrice = gasPrice.toString();
    // ensure string
    if (BN.isBN && BN.isBN(gasPrice)) gasPrice = gasPrice.toString(10);
    txOptions.gasPrice = gasPrice.toString();
    console.log('Using legacy gasPrice:', gasPrice, 'chainId=', txOptions.chainId);
  }

  // If we have a PRIVATE_KEY sign the tx locally and send raw
  if (pk) {
    const nonce = await web3.eth.getTransactionCount(from);
    let data = deploy.encodeABI();
    // Ensure hex data has even length (each byte = 2 hex chars). If odd, pad with a trailing 0.
    if (typeof data === 'string' && data.startsWith('0x') && ((data.length - 2) % 2 !== 0)) {
      console.warn('Deploy bytecode has odd hex length — padding with a trailing 0 to form valid hex');
      data = data + '0';
    }

    const txData = {
      nonce: web3.utils.toHex(nonce),
      gasLimit: web3.utils.toHex(txOptions.gas),
      data: data,
      value: '0x0',
      chainId: txOptions.chainId
    };

    if (txOptions.gasPrice) txData.gasPrice = '0x' + new BN(txOptions.gasPrice.toString()).toString(16);

    // prefer web3 signing first because it produces raw txs Besu accepts for this setup
    if (web3.eth.accounts && typeof web3.eth.accounts.signTransaction === 'function') {
      const txForSign = {
        nonce: web3.utils.toHex(nonce),
        gas: web3.utils.toHex(txOptions.gas),
        data: data,
        value: '0x0',
        chainId: txOptions.chainId
      };
      if (txOptions.gasPrice) txForSign.gasPrice = '0x' + new BN(txOptions.gasPrice.toString()).toString(16);
      if (txOptions.maxPriorityFeePerGas) txForSign.maxPriorityFeePerGas = txOptions.maxPriorityFeePerGas;
      if (txOptions.maxFeePerGas) txForSign.maxFeePerGas = txOptions.maxFeePerGas;

      const signed = await web3.eth.accounts.signTransaction(txForSign, pk);
      receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
    } else if (Common && typeof Common.forCustomChain === 'function') {
      // fallback to @ethereumjs/tx signing when web3 signing not available
      const common = Common.forCustomChain('mainnet', { name: 'custom', chainId: txOptions.chainId, networkId: txOptions.chainId }, 'london');
      const tx = Transaction.fromTxData(txData, { common });
      const signed = tx.sign(Buffer.from(pk.replace(/^0x/, ''), 'hex'));
      const serialized = '0x' + signed.serialize().toString('hex');
      receipt = await web3.eth.sendSignedTransaction(serialized); 
    } else {
      throw new Error('No suitable local signing method available: install @ethereumjs/tx & @ethereumjs/common or use a node with unlocked accounts');
    }

    console.log('Deployment txHash:', receipt.transactionHash);
    const contractAddress = receipt.contractAddress || (await web3.eth.getTransactionReceipt(receipt.transactionHash)).contractAddress;
    console.log('Deployed contract at', contractAddress);
    fs.writeFileSync(`${resultsDir}/besu_deploy.json`, JSON.stringify({ address: contractAddress }, null, 2));

  } else {
    // Use node to deploy (unlocked account)
    const deployed = await deploy.send(txOptions);
    console.log('Deployed contract at', deployed.options.address);
    fs.writeFileSync(`${resultsDir}/besu_deploy.json`, JSON.stringify({ address: deployed.options.address }, null, 2));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
