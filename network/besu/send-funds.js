const Web3Module = require('web3');
const Web3 = Web3Module.default || Web3Module;
const fs = require('fs');

async function main() {
  const rpc = process.env.BESU_RPC || 'http://127.0.0.1:8545';
  const web3 = new Web3(rpc);

  const FROM_PK = process.env.FROM_PK;
  const TO = process.env.TO;
  const AMT = process.env.AMT || '10';

  if (!FROM_PK || !TO) {
    console.error('Usage: FROM_PK=0xb1f638036921f3664801b0d66b3d5386c641c5020783d14fe6fa1706583e3577 TO=0xDe54DdbBfd6631e8AA1a041df3062B791E3aB877 [AMT=10] BESU_RPC=http://127.0.0.1:8545 node send-funds.js');
    process.exit(1);
  }

  const acct = web3.eth.accounts.privateKeyToAccount(FROM_PK.startsWith('0x') ? FROM_PK : '0x'+FROM_PK);
  const from = acct.address;
  console.log('Sending from', from, 'to', TO, 'amount', AMT, 'ETH');

  const nonce = await web3.eth.getTransactionCount(from);
  const chainId = await web3.eth.getChainId();
  const gasPrice = await web3.eth.getGasPrice();

  const tx = {
    nonce: web3.utils.toHex(nonce),
    to: TO,
    value: web3.utils.toHex(web3.utils.toWei(AMT, 'ether')),
    gas: web3.utils.toHex(21000),
    gasPrice: web3.utils.toHex(gasPrice),
    chainId: Number(chainId)
  };

  console.log('Signing tx:', tx);
  const signed = await acct.signTransaction(tx);
  const sent = await web3.eth.sendSignedTransaction(signed.rawTransaction);
  console.log('Transaction sent:', sent.transactionHash);
  console.log('Receipt:', sent);
}

main().catch(e => { console.error(e); process.exit(1); });
