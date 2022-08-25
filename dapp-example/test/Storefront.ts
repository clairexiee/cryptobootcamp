import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

// @NOTE: the basis for much of this comes from running `npx hardhat`

describe("Storefront", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployStorefrontFixture() {
    // Contracts are deployed using the first signer / account by default
    const [owner, otherAccount] = await ethers.getSigners();

    // deploy our actual Storefront contract
    const name = "A Test Storefront";
    const Storefront = await ethers.getContractFactory("Storefront");
    const storefront = await Storefront.deploy(name);

    // return all our variables
    return { name, otherAccount, owner, storefront };
  }

  // test our deployment flow
  describe("deployment", function () {
    it("should set the right name", async function () {
      const { name, storefront } = await loadFixture(deployStorefrontFixture);
      expect(await storefront.name()).to.equal(name);
    });

    it("should set the right owner", async function () {
      const { owner, storefront } = await loadFixture(deployStorefrontFixture);
      expect(await storefront.owner()).to.equal(owner.address);
    });
  });

  // test our addItems function
  describe("addItems", function () {
    it("should check onlyOwner", async function () {
      const { otherAccount, storefront } = await loadFixture(
        deployStorefrontFixture
      );

      await expect(
        storefront.connect(otherAccount).addItems([], [], [])
      ).to.be.revertedWith("Nah uh - you are not the owner");
    });

    it("should check that we are providing correct parameters", async function () {
      const { storefront } = await loadFixture(deployStorefrontFixture);
      await expect(
        storefront.addItems(["item 1"], [], [])
      ).to.be.revertedWithoutReason();
      await expect(
        storefront.addItems(["item 1"], [100], [10, 5])
      ).to.be.revertedWithoutReason();
    });

    it("should update values and emit an event on success", async function () {
      const { storefront } = await loadFixture(deployStorefrontFixture);

      const item = "item 1";
      const price = 100;
      const stock = 10;

      await expect(storefront.addItems([item], [price], [stock]))
        .to.emit(storefront, "ItemUpdated")
        .withArgs(item, price, stock);

      expect(await storefront.prices(item)).to.equal(price);
      expect(await storefront.stock(item)).to.equal(stock);
    });

    it("should update new and existing items", async function () {
      const { storefront } = await loadFixture(deployStorefrontFixture);

      await storefront.addItems(["item 2", "item 3"], [200, 300], [2, 3]);
      expect(await storefront.prices("item 2")).to.equal(200);
      expect(await storefront.prices("item 3")).to.equal(300);
      expect(await storefront.stock("item 2")).to.equal(2);
      expect(await storefront.stock("item 3")).to.equal(3);

      await storefront.addItems(["item 4", "item 3"], [400, 300], [4, 3]);
      expect(await storefront.prices("item 3")).to.equal(300);
      expect(await storefront.prices("item 4")).to.equal(400);
      expect(await storefront.stock("item 3")).to.equal(3);
      expect(await storefront.stock("item 4")).to.equal(4);
    });
  });

  // test our purchase function
  describe("purchase", function () {
    it("should validate parameters", async function () {
      const { otherAccount, storefront } = await loadFixture(
        deployStorefrontFixture
      );

      const item = "sneakers";
      const price = 150;
      const stock = 5;
      await storefront.addItems([item], [price], [stock]);

      await expect(
        storefront.connect(otherAccount).purchase("invalid item", 1)
      ).to.be.revertedWith("This item is not in stock");
      await expect(
        storefront.connect(otherAccount).purchase(item, 0)
      ).to.be.revertedWith("No quantity specified");
      await expect(
        storefront.connect(otherAccount).purchase(item, 1, { value: 0 })
      ).to.be.revertedWith("Provided funds do not match current prices");
    });

    it("should enable purchasing and emit an event on success", async function () {
      const { otherAccount, storefront } = await loadFixture(
        deployStorefrontFixture
      );

      const item = "sneakers";
      const price = 150;
      const stock = 5;
      await storefront.addItems([item], [price], [stock]);

      await expect(
        storefront.connect(otherAccount).purchase(item, 2, { value: price * 2 })
      )
        .to.emit(storefront, "ItemPurchased")
        .withArgs(item, 2);

      expect(await storefront.stock(item)).to.be.equal(stock - 2);
    });
  });

  // test our withdraw function
  describe("withdraw", function () {
    it("should check onlyOwner", async function () {
      const { otherAccount, storefront } = await loadFixture(
        deployStorefrontFixture
      );

      await expect(
        storefront.connect(otherAccount).withdraw()
      ).to.be.revertedWith("Nah uh - you are not the owner");
    });

    it("should transfer the funds to the owner", async function () {
      const { owner, storefront } = await loadFixture(deployStorefrontFixture);

      const balance = await storefront.provider.getBalance(storefront.address);

      await expect(storefront.withdraw()).to.changeEtherBalances(
        [owner, storefront],
        [balance, -balance]
      );
    });
  });
});
