import type Web3 from "web3";
import type { AbiItem } from "web3-utils";
import type { Contract } from "web3-eth-contract";

import storefrontAbi from "./storefront-abi.json";

export default function getStorefrontContract(web3: Web3): Contract {
  // make sure that we have our environment setup correctly
  if (!process.env.STOREFRONT_ADDRESS) {
    throw new Error(
      "No STOREFRONT_ADDRESS configured. Please setup a .env file with that variable"
    );
  }

  return new web3.eth.Contract(
    storefrontAbi as AbiItem[],
    process.env.STOREFRONT_ADDRESS
  );
}
