require("./support/helpers.js");

const PegSwap = artifacts.require("PegSwap");
const Token677 = artifacts.require("Token677");
const StandardTokenMock_6 = artifacts.require("StandardTokenMock6");
const Token20_6 = StandardTokenMock_6;

contract("PegSwap", (accounts) => {
  let swap, owner, base, wrapped, user, tradeAmount;
  const totalIssuance = web3.utils.toWei("1000", "ether");
  const depositAmount = web3.utils.toWei("100", "ether");

  beforeEach(async () => {
    owner = accounts[0];
    user = accounts[1];
    base = await Token20_6.new(owner, totalIssuance, { from: owner });
    wrapped = await Token677.new(totalIssuance, { from: owner });
    swap = await PegSwap.new({ from: owner });
  });

  describe("swap(uint256,address,address)", () => {
    describe("direct", () => {
      beforeEach(async () => {
        tradeAmount = web3.utils.toWei("1", "mwei");

        await base.transfer(user, depositAmount, { from: owner });
        await wrapped.approve(swap.address, depositAmount, { from: owner });
        await swap.addLiquidity(depositAmount, base.address, wrapped.address, {
          from: owner,
        });
      });

      it("reverts if enough funds have not been approved before", async () => {
        await assertActionThrows(async () => {
          await swap.swap(tradeAmount, base.address, wrapped.address, {
            from: user,
          });
        });
      });

      describe("after the user has approved the contract", () => {
        beforeEach(async () => {
          await base.approve(swap.address, depositAmount, { from: user });
        });

        it("pulls source funds from the user", async () => {
          let swapBalance = await base.balanceOf(swap.address);
          assert.equal(0, swapBalance);
          let userBalance = await base.balanceOf(user);
          assert.equal(depositAmount, userBalance);

          await swap.swap(tradeAmount, base.address, wrapped.address, {
            from: user,
          });

          swapBalance = await base.balanceOf(swap.address);
          assert.equal(tradeAmount, swapBalance);
          userBalance = await base.balanceOf(user);
          assert.equal(depositAmount - tradeAmount, userBalance);
        });

        it("sends target funds to the user", async () => {
          let swapBalance = await wrapped.balanceOf(swap.address);
          assert.equal(depositAmount, swapBalance);
          let userBalance = await wrapped.balanceOf(user);
          assert.equal(0, userBalance);

          await swap.swap(tradeAmount, base.address, wrapped.address, {
            from: user,
          });

          swapBalance = await wrapped.balanceOf(swap.address);
          assert.equal(web3.utils.toWei("99", "ether"), swapBalance);
          userBalance = await wrapped.balanceOf(user);
          assert.equal(web3.utils.toWei("1", "ether"), userBalance);
        });

        it("updates the swappable amount for the pair", async () => {
          let swappable = await swap.getSwappableAmount(
            base.address,
            wrapped.address
          );
          assert.equal(depositAmount, swappable);

          await swap.swap(tradeAmount, base.address, wrapped.address, {
            from: user,
          });

          swappable = await swap.getSwappableAmount(
            base.address,
            wrapped.address
          );
          assert.equal(web3.utils.toWei("99", "ether"), swappable);
        });

        it("updates the swappable amount for the inverse of the pair", async () => {
          let swappable = await swap.getSwappableAmount(
            wrapped.address,
            base.address
          );
          assert.equal(0, swappable.toNumber());

          await swap.swap(tradeAmount, base.address, wrapped.address, {
            from: user,
          });

          swappable = await swap.getSwappableAmount(
            wrapped.address,
            base.address
          );
          assert.equal(tradeAmount, swappable.toNumber());
        });
      });
    });
    describe("inverse", () => {
      beforeEach(async () => {
        tradeAmount = web3.utils.toWei("1", "ether");

        await wrapped.transfer(user, depositAmount, { from: owner });
        await base.approve(swap.address, depositAmount, { from: owner });
        await swap.addLiquidity(depositAmount, wrapped.address, base.address, {
          from: owner,
        });
      });

      it("reverts if enough funds have not been approved before", async () => {
        await assertActionThrows(async () => {
          await swap.swap(tradeAmount, wrapped.address, base.address, {
            from: user,
          });
        });
      });

      describe("after the user has approved the contract", () => {
        beforeEach(async () => {
          await wrapped.approve(swap.address, depositAmount, { from: user });
        });

        it("pulls source funds from the user", async () => {
          let swapBalance = await wrapped.balanceOf(swap.address);
          assert.equal(0, swapBalance);
          let userBalance = await wrapped.balanceOf(user);
          assert.equal(depositAmount, userBalance);

          await swap.swap(tradeAmount, wrapped.address, base.address, {
            from: user,
          });

          swapBalance = await wrapped.balanceOf(swap.address);
          assert.equal(tradeAmount, swapBalance);
          userBalance = await wrapped.balanceOf(user);
          assert.equal(depositAmount - tradeAmount, userBalance);
        });

        it("sends target funds to the user", async () => {
          let swapBalance = await base.balanceOf(swap.address);
          assert.equal(depositAmount, swapBalance);
          let userBalance = await base.balanceOf(user);
          assert.equal(0, userBalance);

          await swap.swap(tradeAmount, wrapped.address, base.address, {
            from: user,
          });

          swapBalance = await base.balanceOf(swap.address);
          assert.equal(
            depositAmount - web3.utils.toWei("1", "mwei"),
            swapBalance
          );
          userBalance = await base.balanceOf(user);
          assert.equal(web3.utils.toWei("1", "mwei"), userBalance);
        });

        it("updates the swappable amount for the pair", async () => {
          let swappable = await swap.getSwappableAmount(
            wrapped.address,
            base.address
          );
          assert.equal(depositAmount, swappable);

          await swap.swap(tradeAmount, wrapped.address, base.address, {
            from: user,
          });

          swappable = await swap.getSwappableAmount(
            wrapped.address,
            base.address
          );
          assert.equal(depositAmount - web3.utils.toWei("1", "mwei"), swappable);
        });

        it("updates the swappable amount for the inverse of the pair", async () => {
          let swappable = await swap.getSwappableAmount(
            base.address,
            wrapped.address
          );
          assert.equal(0, swappable.toNumber());

          await swap.swap(tradeAmount, wrapped.address, base.address, {
            from: user,
          });

          swappable = await swap.getSwappableAmount(
            base.address,
            wrapped.address
          );
          assert.equal(tradeAmount, swappable);
        });
      });
    });
  });
});
