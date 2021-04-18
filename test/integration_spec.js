require('./support/helpers')

const PegSwap = artifacts.require("PegSwap")
const FUSDToken = artifacts.require("Token677")
const USDCToken = artifacts.require("StandardTokenMock6")

const toWei = web3.utils.toWei

contract("PegSwap Integration", (accounts) => {
    let swap, owner, usdc, fusd, user, tradeAmount
    const totalIssuance = toWei('1000', 'ether')
    const depositAmount = toWei('100', 'ether')

    // amounts
    const oneHundredUsdc = toWei('100', 'mwei')
    const oneHundredFusd = toWei('100', 'ether')
    const oneFusdOneWei = toWei('1000000000000000001', 'wei')
    const oneUsdcOneWei = toWei('1000001', 'wei')
    const oneUsdc = toWei('1', 'mwei')
    const oneWei = toWei('1', 'wei')

    beforeEach(async () => {
        owner = accounts[0]
        user = accounts[1]
        usdc = await USDCToken.new(owner, totalIssuance, { from: owner })
        fusd = await FUSDToken.new(totalIssuance, { from: owner })
        swap = await PegSwap.new({ from: owner })
    })

    describe("swap usdc to fusd", () => {
        beforeEach(async () => {
            await usdc.transfer(user, depositAmount, { from: owner })
            await fusd.approve(swap.address, depositAmount, { from: owner })
            await swap.addLiquidity(depositAmount, usdc.address, fusd.address, { from: owner })
            await usdc.approve(swap.address, depositAmount, { from: user })
        })

        it('swapping 100 usdc to 100 fusd', async () => {
            let userFusdBalance = await fusd.balanceOf(user)
            assert.equal(userFusdBalance, 0)

            await swap.swap(oneHundredUsdc, usdc.address, fusd.address, {
                from: user
            })

            userFusdBalance = await fusd.balanceOf(user)
            assert.equal(userFusdBalance, oneHundredFusd)
        })

        it('swapping 1 usdc + 1 wei to 1 fusd', async () => {
            let userFusdBalance = await fusd.balanceOf(user)
            assert.equal(userFusdBalance, 0)

            await swap.swap(oneUsdcOneWei, usdc.address, fusd.address, {
                from: user
            })

            userFusdBalance = await fusd.balanceOf(user)
            assert.equal(userFusdBalance, toWei('1000001000000000000', 'wei'))
        })
    })

    describe('swap fusd to usdc', () => {
        beforeEach(async () => {
            await usdc.approve(swap.address, depositAmount, { from: owner })
            await swap.addLiquidity(depositAmount, fusd.address, usdc.address, { 
                from: owner
            })

            await fusd.transfer(user, depositAmount, { from: owner })
            await fusd.approve(swap.address, depositAmount, { from: user })
        })

        it('swapping (1wei) fusd to usdc',async  () => {
            await assertActionThrows(async () => {
                await swap.swap(oneWei, fusd.address, usdc.address, {
                    from: user
                })
            })
        })

        it('swapping 1 fusd + 1wei to usdc', async () => {
            let userUsdcBalance = await usdc.balanceOf(user)
            assert.equal(userUsdcBalance, 0)

            await swap.swap(oneFusdOneWei, fusd.address, usdc.address, {
                from: user
            })

            userUsdcBalance = await usdc.balanceOf(user)
            console.log(userUsdcBalance.toString(), oneUsdc.toString())
            assert.equal(userUsdcBalance, oneUsdc)
        })
    })

    describe('swap both ways', () => {
        beforeEach(async () => {
            await fusd.approve(swap.address, depositAmount, { from: owner })
            await usdc.approve(swap.address, depositAmount, { from: owner })
            
            await swap.addLiquidity(depositAmount, usdc.address, fusd.address, { from: owner })
            await swap.addLiquidity(depositAmount, fusd.address, usdc.address, { from: owner })
            
            await usdc.approve(swap.address, depositAmount, { from: user })
            await fusd.approve(swap.address, depositAmount, { from: user })
        })
        
        it('swapping 100 usdc to 100 fusd and back to 100 usdc', async () => {
            await usdc.transfer(user, depositAmount, { from: owner })
            
            await swap.swap(oneHundredUsdc, usdc.address, fusd.address, {
                from: user
            })

            const userFusdBalance = await fusd.balanceOf(user)
            assert.equal(userFusdBalance, oneHundredFusd)

            await swap.swap(oneHundredFusd, fusd.address, usdc.address, {
                from: user
            })
            
            const userUsdcBalance = await usdc.balanceOf(user)
            assert.equal(userUsdcBalance, depositAmount)
        })

        it('swapping 100 fusd to 100 usdc and back to 100 fusd', async () => {
            await fusd.transfer(user, depositAmount, { from: owner })

            await swap.swap(oneHundredFusd, fusd.address, usdc.address, {
                from: user
            })

            const userUsdcBalance = await usdc.balanceOf(user)
            assert.equal(userUsdcBalance, oneHundredUsdc)

            await swap.swap(oneHundredUsdc, usdc.address, fusd.address, {
                from: user
            })
            
            const userFusdBalance = await fusd.balanceOf(user)
            assert.equal(userFusdBalance, depositAmount)
        })
    })
})