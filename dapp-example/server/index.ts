import "dotenv/config";
import Web3 from "web3";
import type { AbiItem } from "web3-utils";
import type { Log } from "web3-core";

import storefrontAbi from "../lib/storefront-abi.json";

// define the structure for the purchase receipt data we want to know about
type PurchaseReceipt = {
  from: string;
  item: string;
  quantity: number;
  total: number;
  transactionId: string;
};

// emulate a database in memory using a map
const STOREFRONT_PURCHASES: Record<string, PurchaseReceipt> = {};

// make sure that we have our environment setup correctly
if (!process.env.STOREFRONT_ADDRESS) {
  throw new Error(
    "No STOREFRONT_ADDRESS configured. Please setup a .env file with that variable"
  );
}
if (!process.env.WEB3_URI) {
  throw new Error(
    "No WEB3_URI configured. Please setup a .env file with that variable"
  );
}

// lookup our decode parameters for use in `processPurchases` below
const ITEM_PURCHASED_ABI_INPUT =
  storefrontAbi.find((item) => item.name === "ItemPurchased")?.inputs || [];

// define some globals for our web3 and storefront instantiations
const web3 = new Web3(process.env.WEB3_URI);
const storefront = new web3.eth.Contract(
  storefrontAbi as AbiItem[],
  process.env.STOREFRONT_ADDRESS
);

// define our base search parameters for finding purchases on-chain
const PURCHASE_FILTER = {
  address: storefront.options.address,
  topics: [web3.utils.sha3("ItemPurchased(string,uint256)")],
};

// processPurchases handles parsing and storing purchase data
async function processPurchases(purchaseLogs: Log[]): Promise<void> {
  // iterate through each of our purchaseLogs
  for (const log of purchaseLogs) {
    // parse out the purchase data
    const { item, quantity }: Record<string, string> = web3.eth.abi.decodeLog(
      ITEM_PURCHASED_ABI_INPUT,
      log.data,
      log.topics
    );

    // look up the transaction info
    const tx = await web3.eth.getTransaction(log.transactionHash);

    // construct our receipt
    const receipt: PurchaseReceipt = {
      from: tx.from,
      item,
      quantity: parseInt(quantity),
      total: parseInt(tx.value),
      transactionId: tx.hash,
    };

    // and add it to our "database"
    STOREFRONT_PURCHASES[tx.hash] = receipt;

    console.log(
      `[${tx.hash}] ${quantity} of "${item}" were purchased by ${tx.from} for ${tx.value} wei`
    );
  }
}

// indexPastPurchases provides a way for us to quickly go back in time to pick up past purchases
async function indexPastPurchases(latestBlock: number): Promise<void> {
  // we're going to check 500,000 blocks at a time
  for (let i = 0; i < latestBlock; i += 500000) {
    const fromBlock = i;
    const toBlock = fromBlock + 500000;

    // check past blocks for `ItemPurchased` events, filtered by our storefront address
    const purchaseLogs = await web3.eth.getPastLogs({
      ...PURCHASE_FILTER,
      fromBlock,
      toBlock,
    });

    // process each of those purchases
    await processPurchases(purchaseLogs);
  }
}

// start provides an async wrapper for starting our server
async function start() {
  // check our web3 connection by getting the current, latest block number
  const currentBlockNumber = await web3.eth.getBlockNumber();
  console.log(`Connected to web3 🚀 Current block is ${currentBlockNumber}`);

  // listen to the blockchain for new purchases
  web3.eth.subscribe("logs", PURCHASE_FILTER, (err, newPurchase) => {
    if (err) {
      throw err;
    }

    // process the new purchase log
    processPurchases([newPurchase]);
  });

  // index past purchases
  await indexPastPurchases(currentBlockNumber);
}

start();
