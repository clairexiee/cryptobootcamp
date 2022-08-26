import { ReactElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Web3 from "web3";

import storefrontAbi from "../lib/storefront-abi.json";
import getStorefrontContract from "../lib/get-storefront-contract";

// modify our global / window interface to include `ethereum`
// `ethereum` here would come from a browser wallet injected it
declare global {
  var ethereum: any;
}

// define our StoreItem structure
type StoreItem = {
  name: string;
  price: number;
  stock: number;
};

// lookup our decode parameters for use in `getItems` below
const ITEM_UPDATED_ABI_INPUT =
  storefrontAbi.find((item) => item.name === "ItemUpdated")?.inputs || [];

// try auto-initializing web3
// @NOTE: this will likely throw console errors if a wallet like Metamask is not installed
let web3: Web3 = new Web3(window.ethereum);

// define our storefront contract instance to interact with
const storefront = getStorefrontContract(web3);

// getItems does a quick index to check which items have been added on-chain
async function getItems(): Promise<StoreItem[]> {
  // look up the past logs related to updating / adding items
  const updateItemLogs = await web3.eth.getPastLogs({
    address: storefront.options.address,
    fromBlock: 0, // make sure to start from the beginning of block time
    topics: [web3.utils.sha3("ItemUpdated(string,uint256,uint256)")],
  });

  const items: StoreItem[] = [];

  // iterate through each of the logs
  for (const log of updateItemLogs) {
    // parse out the item name from the log data
    const { item: name }: Record<string, string> = web3.eth.abi.decodeLog(
      ITEM_UPDATED_ABI_INPUT,
      log.data,
      log.topics
    );

    // construct our StoreItem and add it to our "database"
    const item: StoreItem = {
      name,

      // look up the most current price and stock values
      price: parseInt(await storefront.methods.prices(name).call()),
      stock: parseInt(await storefront.methods.stock(name).call()),
    };
    items.push(item);
  }

  return items;
}

// Storefront sets up our UI for actually viewing items
function Storefront() {
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [isPurchasing, setIsPurchasing] = useState<boolean>(false);
  const [purchaseNote, setPurchaseNote] = useState<ReactElement>();

  // as we load the storefront, look up all the items
  useEffect(() => {
    // then set our local state as a temporary cache of those items
    getItems().then(setStoreItems);
  }, [setStoreItems]);

  // purchase attempts to actually buy the selected item
  async function purchase(storeItem: StoreItem) {
    // set our loading state
    setIsPurchasing(true);

    try {
      // trigger our browser wallet to submit the purchase transaction
      const receipt = await storefront.methods
        .purchase(storeItem.name, 1)
        .send({
          // make sure to explicitly set the `from` here
          from: (await web3.eth.getAccounts())[0],
          value: storeItem.price,
        });

      // upon success, provide a link to the transaction
      setPurchaseNote(
        <p style={{ color: "green" }}>
          [SUCCESS] Purchase confirmed in transaction{" "}
          <a href={`https://goerli.etherscan.io/tx/${receipt.transactionHash}`}>
            {receipt.transactionHash}
          </a>
        </p>
      );
    } catch (e) {
      // if there was an error, then display the provided reason
      setPurchaseNote(
        <p style={{ color: "red" }}>
          [FAILED] {`${(e as Error)?.message || e}`}
        </p>
      );
    }
  }

  // if we're in our loading state
  if (isPurchasing) {
    // then return the defined message or a generic loader
    return purchaseNote || <p>Purchase in progress...</p>;
  }

  // return our table of items
  return (
    <div>
      <table style={{ tableLayout: "auto", textAlign: "left", width: "100%" }}>
        <thead>
          <tr>
            <th>Item</th>
            <th>Price</th>
            <th>Stock</th>
          </tr>
        </thead>

        <tbody>
          {storeItems.map((storeItem, i) => (
            <tr
              key={storeItem.name}
              style={{
                backgroundColor: i % 2 !== 0 ? "" : "#f2f2f2",
                lineHeight: "2em",
              }}
            >
              <td style={{ paddingLeft: 10 }}>{storeItem.name}</td>
              <td style={{ paddingLeft: 10 }}>{storeItem.price} wei</td>
              <td style={{ paddingLeft: 10 }}>{storeItem.stock}</td>
              <td>
                {storeItem.stock <= 0 ? (
                  "Out of stock"
                ) : (
                  <u
                    style={{ cursor: "pointer" }}
                    onClick={() => purchase(storeItem)}
                  >
                    Buy Now
                  </u>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// App is our entry point for rendering
function App() {
  // keep track of our web3 connection status
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // on app load
  useEffect(() => {
    // check if the user has already connected previously by attempting to fetch accounts
    web3.eth.getAccounts().then((accounts) => {
      // if any accounts are returned, then the user is connected
      setIsConnected(accounts.length > 0);
    });
  }, [setIsConnected]);

  // connect offers an explicit hook to trigger the browser wallet connection process
  async function connect() {
    try {
      // first, trigger the connection
      await web3.eth.requestAccounts();
      // if it didn't error, then check for our account list again
      setIsConnected((await web3.eth.getAccounts()).length > 0);
    } catch (e) {
      // any error here is likely because the user rejected our connection request
      console.error(e);
    }
  }

  // return our actual JSX
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        maxWidth: 800,
        margin: "auto",
        marginTop: 100,
      }}
    >
      <h1>DeSneakerized</h1>
      <p>
        <i>A sample dApp storefront</i>
      </p>
      <hr />
      <br />

      {isConnected ? (
        <Storefront />
      ) : (
        <div>
          <u onClick={() => connect()} style={{ cursor: "pointer" }}>
            Connect
          </u>{" "}
          your wallet to browse the store
          <br />
        </div>
      )}
    </div>
  );
}

// make sure to actual
const container = document.getElementById("app");
const root = createRoot(container as HTMLElement);
root.render(<App />);
