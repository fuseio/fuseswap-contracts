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
        tradeAmount = web3.utils.toWei("1", "mwei"); // 1*(10^6)

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
          await base.approve(swap.address, tradeAmount, { from: user });
        });

        it("pulls source funds from the user", async () => {
          let swapBaseTokenBalance = await base.balanceOf(swap.address);
          assert.equal(0, swapBaseTokenBalance);
          let userBaseTokenBalance = await base.balanceOf(user);
          assert.equal(depositAmount, userBaseTokenBalance);

          await swap.swap(tradeAmount, base.address, wrapped.address, {
            from: user,
          });

          swapBaseTokenBalance = await base.balanceOf(swap.address);
          assert.equal(tradeAmount, swapBaseTokenBalance);
          userBaseTokenBalance = await base.balanceOf(user);
          assert.equal(depositAmount - tradeAmount, userBaseTokenBalance);
        });

        it("sends target funds to the user", async () => {
          let swapWrappedTokenBalance = await wrapped.balanceOf(swap.address); // 100 eth
          assert.equal(depositAmount, swapWrappedTokenBalance);
          let userWrappedTokenBalance = await wrapped.balanceOf(user);
          assert.equal(0, userWrappedTokenBalance);

          await swap.swap(tradeAmount, base.address, wrapped.address, {
            from: user,
          });

          // swap 1 mwei base for 1 eth wrapped

          swapWrappedTokenBalance = await wrapped.balanceOf(swap.address); // 99 eth
          assert.equal(
            web3.utils.toWei("99", "ether"),
            swapWrappedTokenBalance
          );
          userWrappedTokenBalance = await wrapped.balanceOf(user); // 1 eth
          assert.equal(web3.utils.toWei("1", "ether"), userWrappedTokenBalance);
        });

        it("updates the swappable amount for the pair", async () => {
          let swappable = await swap.getSwappableAmount(
            base.address,
            wrapped.address
          ); // 100 eth
          assert.equal(depositAmount, swappable);

          await swap.swap(tradeAmount, base.address, wrapped.address, {
            from: user,
          });

          swappable = await swap.getSwappableAmount(
            base.address,
            wrapped.address
          ); // 99 eth
          assert.equal(web3.utils.toWei("99", "ether"), swappable);
        });

        it("updates the swappable amount for the inverse of the pair", async () => {
          let swappable = await swap.getSwappableAmount(
            wrapped.address,
            base.address
          ); // 0
          assert.equal(0, swappable.toNumber());

          await swap.swap(tradeAmount, base.address, wrapped.address, {
            from: user,
          });

          swappable = await swap.getSwappableAmount(
            wrapped.address,
            base.address
          ); // 1 mwei
          assert.equal(tradeAmount, swappable.toNumber());
        });

        it("reverts when amount is greater than liquidity", async () => {
          await assertActionThrows(async () => {
            await swap.swap(
              depositAmount + web3.utils.toWei("1", "ether"),
              wrapped.address,
              base.address,
              {
                from: user,
              }
            );
          });
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
          let swapBalance = await wrapped.balanceOf(swap.address); // 0 eth
          assert.equal(0, swapBalance);
          let userBalance = await wrapped.balanceOf(user); // 100 eth
          assert.equal(depositAmount, userBalance);

          await swap.swap(tradeAmount, wrapped.address, base.address, {
            from: user,
          });

          swapBalance = await wrapped.balanceOf(swap.address); // 1 eth
          assert.equal(tradeAmount, swapBalance);
          userBalance = await wrapped.balanceOf(user); // 99 eth
          assert.equal(depositAmount - tradeAmount, userBalance);
        });

        it("sends target funds to the user", async () => {
          let swapBalance = await base.balanceOf(swap.address); // 100 eth
          assert.equal(depositAmount, swapBalance);
          let userBalance = await base.balanceOf(user); // 0 mwei
          assert.equal(0, userBalance);

          await swap.swap(tradeAmount, wrapped.address, base.address, {
            from: user,
          });

          swapBalance = await base.balanceOf(swap.address); // 100 eth - 1 mwei
          assert.equal(
            depositAmount - web3.utils.toWei("1", "mwei"),
            swapBalance
          );
          userBalance = await base.balanceOf(user); // 1 mwei
          assert.equal(web3.utils.toWei("1", "mwei"), userBalance);
        });

        it("updates the swappable amount for the pair", async () => {
          let swappable = await swap.getSwappableAmount(
            wrapped.address,
            base.address
          ); // 100 eth
          assert.equal(depositAmount, swappable);

          await swap.swap(tradeAmount, wrapped.address, base.address, {
            from: user,
          });

          swappable = await swap.getSwappableAmount(
            wrapped.address,
            base.address
          ); // 100 eth - 1 mwei
          assert.equal(
            depositAmount - web3.utils.toWei("1", "mwei"),
            swappable
          );
        });

        it("updates the swappable amount for the inverse of the pair", async () => {
          let swappable = await swap.getSwappableAmount(
            base.address,
            wrapped.address
          ); // 0 eth
          assert.equal(0, swappable.toNumber());

          await swap.swap(tradeAmount, wrapped.address, base.address, {
            from: user,
          });

          swappable = await swap.getSwappableAmount(
            base.address,
            wrapped.address
          ); // 1 eth
          assert.equal(tradeAmount, swappable);
        });

        it("reverts when amount is greater than liquidity", async () => {
          await assertActionThrows(async () => {
            await swap.swap(
              depositAmount + web3.utils.toWei("1", "ether"),
              wrapped.address,
              base.address,
              {
                from: user,
              }
            );
          });
        });
      });

      describe("edge cases", async () => {
        beforeEach(async () => {
          await wrapped.approve(swap.address, depositAmount, { from: user });
        });

        it("reverts when trade amount is very small", async () => {
          await assertActionThrows(async () => {
            await swap.swap(
              web3.utils.toWei("1", "wei"),
              wrapped.address,
              base.address,
              {
                from: user,
              }
            );
          });
        });

        it("handles rounding 9999999999999999999 to 9999999", async () => {
          let swapBalance = await base.balanceOf(swap.address);
          assert.equal(depositAmount, swapBalance);
          let userBalance = await base.balanceOf(user);
          assert.equal(0, userBalance);

          await swap.swap(
            web3.utils.toWei("9999999999999999999", "wei"),
            wrapped.address,
            base.address,
            {
              from: user,
            }
          );

          swapBalance = await base.balanceOf(swap.address);
          assert.equal(
            web3.utils.toWei("99999999999990000001", "wei"),
            swapBalance
          );
          userBalance = await base.balanceOf(user);
          assert.equal(web3.utils.toWei("9999999", "wei"), userBalance);
        });

        it("handles rounding 9000001000000000000 to 9000001", async () => {
          let swapBalance = await base.balanceOf(swap.address);
          assert.equal(depositAmount, swapBalance);
          let userBalance = await base.balanceOf(user);
          assert.equal(0, userBalance);

          await swap.swap(
            web3.utils.toWei("9000001000000000000", "wei"),
            wrapped.address,
            base.address,
            {
              from: user,
            }
          );

          swapBalance = await base.balanceOf(swap.address);
          assert.equal(
            web3.utils.toWei("99999999999990999999", "wei"),
            swapBalance
          );
          userBalance = await base.balanceOf(user);
          assert.equal(web3.utils.toWei("9000001", "wei"), userBalance);
        })

        it("handles rounding 9000000100000000000 to 9000000", async () => {
          let swapBalance = await base.balanceOf(swap.address);
          assert.equal(depositAmount, swapBalance);
          let userBalance = await base.balanceOf(user);
          assert.equal(0, userBalance);

          await swap.swap(
            web3.utils.toWei("9000000100000000000", "wei"),
            wrapped.address,
            base.address,
            {
              from: user,
            }
          );

          swapBalance = await base.balanceOf(swap.address);
          assert.equal(
            web3.utils.toWei("99999999999991000000", "wei"),
            swapBalance
          );
          userBalance = await base.balanceOf(user);
          assert.equal(web3.utils.toWei("9000000", "wei"), userBalance);
        })

        it("handles rounding 9000000000000000001 to 9000000", async () => {
          let swapBalance = await base.balanceOf(swap.address);
          assert.equal(depositAmount, swapBalance);
          let userBalance = await base.balanceOf(user);
          assert.equal(0, userBalance);

          await swap.swap(
            web3.utils.toWei("9000000000000000001", "wei"),
            wrapped.address,
            base.address,
            {
              from: user,
            }
          );

          swapBalance = await base.balanceOf(swap.address);
          assert.equal(
            web3.utils.toWei("99999999999991000000", "wei"),
            swapBalance
          );
          userBalance = await base.balanceOf(user);
          assert.equal(web3.utils.toWei("9000000", "wei"), userBalance);
        })

        it("handles rounding 1000000000000 to 1", async () => {
          let swapBalance = await base.balanceOf(swap.address);
          assert.equal(depositAmount, swapBalance);
          let userBalance = await base.balanceOf(user);
          assert.equal(0, userBalance);

          await swap.swap(
            web3.utils.toWei("1000000000000", "wei"),
            wrapped.address,
            base.address,
            {
              from: user,
            }
          );

          swapBalance = await base.balanceOf(swap.address);
          assert.equal(
            web3.utils.toWei("99999999999999999999", "wei"),
            swapBalance
          );
          userBalance = await base.balanceOf(user);
          assert.equal(web3.utils.toWei("1", "wei"), userBalance);
        })
      });
    });
  });
});
