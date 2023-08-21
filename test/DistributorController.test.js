const chai = require('chai')
const expect = chai.expect
// const ethers = require('ethers')
const { solidity, MockProvider, createFixtureLoader } = require('ethereum-waffle')
const helpers = require("@nomicfoundation/hardhat-network-helpers");
// const {solidityChai} = require('@nomiclabs/hardhat-chai-matchers')
const { ethers} = require('ethers')
const BigNumber = ethers.BigNumber;
const bigNumberify = ethers.BigNumber.from;

const { expandTo18Decimals, mineBlock, encodePrice } = require('./utils/utilities')
const { pairFixture, distributorFixture} = require('./utils/fixtures')
const exp = require("constants");
const {over} = require("lodash/util");
const {ADDRESS_ZERO} = require("./utils");
const { AddressZero } = ethers.constants.AddressZero

const MINIMUM_LIQUIDITY = bigNumberify(10).pow(3)

chai.use(solidity)

const overrides = {
    gasLimit: 10000000
}

const decimals = bigNumberify(10).pow(18)

describe('Alien Base Token', () => {

    const provider = new MockProvider({
        ganacheOptions : {
            gasLimit: 20000000,
        }
    });
    // const provider = new MockProvider({
    //     hardfork: 'istanbul',
    //     mnemonic: 'horn horn horn horn horn horn horn horn horn horn horn horn',
    //     gasLimit: 9999999
    // })
    const [wallet, other] = provider.getWallets()
    const loadFixture = createFixtureLoader(provider, wallet)
    let fixtures = {
        alb: null,
        masterChef: null,
        masterController: null
    };

    beforeEach(async () => {
       fixtures = await distributorFixture(provider, wallet, other)
    })

    it("Can add farm", async () => {

        // function add(
        //     uint256 _allocPoint,
        //     IBoringERC20 _lpToken,
        //     uint16 _depositFeeBP,
        //     uint256 _harvestInterval,
        //     IComplexRewarder[] calldata _rewarders)

        let farm = await fixtures.masterController.add(100, fixtures.alb.address, 0, 30, [])

        await expect((await fixtures.masterChef.poolInfo(0)).lpToken).to.eq(fixtures.alb.address)
    })

    it("Can't add farm with huge allocation", async () => {

        // function add(
        //     uint256 _allocPoint,
        //     IBoringERC20 _lpToken,
        //     uint16 _depositFeeBP,
        //     uint256 _harvestInterval,
        //     IComplexRewarder[] calldata _rewarders)

        let farm1 = await fixtures.masterController.add(799, fixtures.alb.address, 0, 30, [])
        let farm2 = await fixtures.masterController.add(700, fixtures.alb.address, 0, 30, [])

        console.log("totalAllo", (await fixtures.masterChef.totalAllocPoint()).toString())


        await expect(fixtures.masterController.add(3000, fixtures.alb.address, 0, 30, [])).to.be.revertedWith("MAX_ALLO");
    })

    it("Can set farm", async () => {

        // function add(
        //     uint256 _allocPoint,
        //     IBoringERC20 _lpToken,
        //     uint16 _depositFeeBP,
        //     uint256 _harvestInterval,
        //     IComplexRewarder[] calldata _rewarders)

        let farm1 = await fixtures.masterController.add(799, fixtures.alb.address, 0, 30, [])
        // let farm2 = await fixtures.masterController.add(700, fixtures.alb.address, 0, 30, [])

        await fixtures.masterController.prepareFunction(10);

        let time = (await provider.getBlock()).timestamp
        await provider.send("evm_mine", [time + (10*24*60*60)]);


        // console.log("totalAllo", (await fixtures.masterChef.totalAllocPoint()).toString())
        await fixtures.masterController.set(0, 400, 0, 30, [])

        await expect((await fixtures.masterChef.poolInfo(0, overrides)).allocPoint).to.eq(400)
    })

    it("Can't set farm to huge alloc & higher deposit after timelock", async () => {

        // function add(
        //     uint256 _allocPoint,
        //     IBoringERC20 _lpToken,
        //     uint16 _depositFeeBP,
        //     uint256 _harvestInterval,
        //     IComplexRewarder[] calldata _rewarders)

        let farm1 = await fixtures.masterController.add(799, fixtures.alb.address, 0, 30, [])
        let farm2 = await fixtures.masterController.add(700, fixtures.alb.address, 0, 30, [])

        await fixtures.masterController.prepareFunction(10);

        let time = (await provider.getBlock()).timestamp
        await provider.send("evm_mine", [time + (10*24*60*60)]);

        // console.log("totalAllo", (await fixtures.masterChef.totalAllocPoint()).toString())

        await expect(fixtures.masterController.set(0, 200, 10, 30, [])).to.be.revertedWith("MAX_DEPOSIT")

        await fixtures.masterController.prepareFunction(9);

        time = (await provider.getBlock()).timestamp
        await provider.send("evm_mine", [time + (10*24*60*60)]);

        await expect(fixtures.masterController.set(0, 3000, 0, 30, [])).to.be.revertedWith("MAX_ALLO")
    })


    it("Can't call set without timelock", async () => {

        // function add(
        //     uint256 _allocPoint,
        //     IBoringERC20 _lpToken,
        //     uint16 _depositFeeBP,
        //     uint256 _harvestInterval,
        //     IComplexRewarder[] calldata _rewarders)

        let farm1 = await fixtures.masterController.add(799, fixtures.alb.address, 0, 30, [])
        let farm2 = await fixtures.masterController.add(700, fixtures.alb.address, 0, 30, [])

        // console.log("totalAllo", (await fixtures.masterChef.totalAllocPoint()).toString())

        await expect(fixtures.masterController.set(0, 200, 0, 30, [wallet.address])).to.be.revertedWith("TIMELOCK")

    })


    it("Can set alloc alone", async () => {

        // function add(
        //     uint256 _allocPoint,
        //     IBoringERC20 _lpToken,
        //     uint16 _depositFeeBP,
        //     uint256 _harvestInterval,
        //     IComplexRewarder[] calldata _rewarders)

        let farm1 = await fixtures.masterController.add(799, fixtures.alb.address, 0, 30, [])
        // let farm2 = await fixtures.masterController.add(700, fixtures.alb.address, 0, 30, [])
        await fixtures.masterController.updateAllocPoint(0, 500)
        // console.log("totalAllo", (await fixtures.masterChef.totalAllocPoint()).toString())

        await expect((await fixtures.masterChef.poolInfo(0)).allocPoint).to.be.eq(500)
    })

    it("Can't update huge alloc", async () => {

        // function add(
        //     uint256 _allocPoint,
        //     IBoringERC20 _lpToken,
        //     uint16 _depositFeeBP,
        //     uint256 _harvestInterval,
        //     IComplexRewarder[] calldata _rewarders)

        let farm1 = await fixtures.masterController.add(799, fixtures.alb.address, 0, 30, [])
        let farm2 = await fixtures.masterController.add(700, fixtures.alb.address, 0, 30, [])

        // console.log("totalAllo", (await fixtures.masterChef.totalAllocPoint()).toString())

        await expect(fixtures.masterController.updateAllocPoint(0, 3000)).to.be.revertedWith("MAX_ALLO")
    })

    it("Can set larger alloc", async () => {

        // function add(
        //     uint256 _allocPoint,
        //     IBoringERC20 _lpToken,
        //     uint16 _depositFeeBP,
        //     uint256 _harvestInterval,
        //     IComplexRewarder[] calldata _rewarders)

        let farm1 = await fixtures.masterController.add(799, fixtures.alb.address, 0, 30, [])
        let farm2 = await fixtures.masterController.add(700, fixtures.alb.address, 0, 30, [])


        await fixtures.masterController.updateAllocPoint(0, 1000)

        await expect((await fixtures.masterChef.poolInfo(0)).allocPoint).to.be.eq(1000)
    })

    it("Owners + randos can't insta-set reward rate", async () => {

        // function add(
        //     uint256 _allocPoint,
        //     IBoringERC20 _lpToken,
        //     uint16 _depositFeeBP,
        //     uint256 _harvestInterval,
        //     IComplexRewarder[] calldata _rewarders)

        let farm1 = await fixtures.masterController.add(799, fixtures.alb.address, 0, 30, [])

        await expect(fixtures.randoController.updateEmissionRate(ethers.constants.MaxUint256)).to.be.revertedWith("Ownable: caller is not the owner")

        await expect(fixtures.masterController.updateEmissionRate(ethers.constants.MaxUint256)).to.be.revertedWith("TIMELOCK")
    })

    it("Can set reward rate after timelock, can't repeat, can't set too high", async () => {

        //enum Functions {
        //         UPDATE_EMISSIONS,
        //         SET_TEAM_ADDR,
        //         SET_TEAM_PERCENT,
        //         SET_TREASURY_ADDR,
        //         SET_TREASURY_PERCENT,
        //         SET_INVESTOR_ADDRESS,
        //         SET_INVESTOR_PERCENT,
        //         CHANGE_SELF_OWNER,
        //         CHANGE_MASTERCHEF_OWNER,
        //         CHANGE_DELAY
        //     }

        let farm1 = await fixtures.masterController.add(799, fixtures.alb.address, 0, 30, [])

        await fixtures.masterController.prepareFunction(0);

        let time = (await provider.getBlock()).timestamp
        await provider.send("evm_mine", [time + (10*24*60*60)]);

        await fixtures.masterController.updateEmissionRate(decimals.mul(25))

        await expect(await fixtures.masterChef.albPerSec()).to.eq(decimals.mul(25))

        await expect(fixtures.masterController.updateEmissionRate(decimals.mul(25))).to.be.revertedWith("TIMELOCK")

        await fixtures.masterController.prepareFunction(0);

        time = (await provider.getBlock()).timestamp
        await provider.send("evm_mine", [time + (10*24*60*60)]);

        await expect(fixtures.masterController.updateEmissionRate(decimals.mul(1000))).to.be.revertedWith("MAX_EMISSION")

    })


    it("Owners + randos can't insta-set reward rate", async () => {

        // function add(
        //     uint256 _allocPoint,
        //     IBoringERC20 _lpToken,
        //     uint16 _depositFeeBP,
        //     uint256 _harvestInterval,
        //     IComplexRewarder[] calldata _rewarders)

        let farm1 = await fixtures.masterController.add(799, fixtures.alb.address, 0, 30, [])

        await expect(fixtures.randoController.updateEmissionRate(ethers.constants.MaxUint256)).to.be.revertedWith("Ownable: caller is not the owner")

        await expect(fixtures.masterController.updateEmissionRate(ethers.constants.MaxUint256)).to.be.revertedWith("TIMELOCK")
    })

    it("Owner + randos can't insta-call privileged functions", async () => {


        //enum Functions {
        //         UPDATE_EMISSIONS,
        //         SET_TEAM_ADDR,
        //         SET_TEAM_PERCENT,
        //         SET_TREASURY_ADDR,
        //         SET_TREASURY_PERCENT,
        //         SET_INVESTOR_ADDRESS,
        //         SET_INVESTOR_PERCENT,
        //         CHANGE_SELF_OWNER,
        //         CHANGE_MASTERCHEF_OWNER,
        //         CHANGE_DELAY
        //     }

        // let farm1 = await fixtures.masterController.add(799, fixtures.alb.address, 0, 30, [])

        await expect(fixtures.randoController.transferOwnership(other.address)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(fixtures.masterController.transferOwnership(other.address)).to.be.revertedWith("TIMELOCK")

        await expect(fixtures.randoController.transferMasterChefOwnership(other.address)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(fixtures.masterController.transferMasterChefOwnership(other.address)).to.be.revertedWith("TIMELOCK")

        // await expect(fixtures.randoController.setTeamAddress(other.address)).to.be.revertedWith("Ownable: caller is not the owner")
        // await expect(fixtures.masterController.setTeamAddress(other.address)).to.be.revertedWith("TIMELOCK")
        //
        // await expect(fixtures.randoController.setTreasuryAddress(other.address)).to.be.revertedWith("Ownable: caller is not the owner")
        // await expect(fixtures.masterController.setTreasuryAddress(other.address)).to.be.revertedWith("TIMELOCK")
        //
        // await expect(fixtures.randoController.setInvestorAddress(other.address)).to.be.revertedWith("Ownable: caller is not the owner")
        // await expect(fixtures.masterController.setInvestorAddress(other.address)).to.be.revertedWith("TIMELOCK")

        await expect(fixtures.randoController.changeDelay(other.address)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(fixtures.masterController.changeDelay(other.address)).to.be.revertedWith("TIMELOCK")

        await expect(fixtures.randoController.setTeamPercent(500)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(fixtures.masterController.setTeamPercent(500)).to.be.revertedWith("TIMELOCK")

        await expect(fixtures.randoController.setInvestorPercent(500)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(fixtures.masterController.setInvestorPercent(500)).to.be.revertedWith("TIMELOCK")

        await expect(fixtures.randoController.setTreasuryPercent(500)).to.be.revertedWith("Ownable: caller is not the owner")
        await expect(fixtures.masterController.setTreasuryPercent(500)).to.be.revertedWith("TIMELOCK")
    })


    it("Can call privileged functions after timelock", async () => {

        //enum Functions {
        //         UPDATE_EMISSIONS,
        //         SET_TEAM_ADDR,
        //         SET_TEAM_PERCENT,
        //         SET_TREASURY_ADDR,
        //         SET_TREASURY_PERCENT,
        //         SET_INVESTOR_ADDRESS,
        //         SET_INVESTOR_PERCENT,
        //         CHANGE_SELF_OWNER,
        //         CHANGE_MASTERCHEF_OWNER,
        //         CHANGE_DELAY
        //     }

        let farm1 = await fixtures.masterController.add(799, fixtures.alb.address, 0, 30, [])

        for(let i = 1; i < 10; i++) {
            await fixtures.masterController.prepareFunction(i);
        }

        let time = (await provider.getBlock()).timestamp
        await provider.send("evm_mine", [time + (10*24*60*60)]);

        // await fixtures.masterController.setTeamAddress(other.address)
        // await fixtures.masterController.setTreasuryAddress(other.address)
        // await fixtures.masterController.setInvestorAddress(other.address)
        await fixtures.masterController.setTeamPercent(bigNumberify(50))
        await fixtures.masterController.setTreasuryPercent(50)
        await fixtures.masterController.setInvestorPercent(50)
        await fixtures.masterController.changeDelay(10000000)

        // await fixtures.masterController.transferOwnership(other.address)
        // await fixtures.masterController.transferMasterChefOwnership(other.address)

        console.log("team percent", (await fixtures.masterChef.teamPercent()))

        let _teamPercent = await fixtures.masterChef.teamPercent()
        let _investorPercent = await fixtures.masterChef.investorPercent()
        let _treasuryPercent = await fixtures.masterChef.treasuryPercent()
        let _delay = await fixtures.masterController.delay()

        await expect(_teamPercent).to.eq(50)
        await expect(_investorPercent).to.eq(50)
        await expect(_treasuryPercent).to.eq(50)
        await expect(_delay).to.eq(10000000)


    })

    it("Can change ownership after timelock", async () => {

        //enum Functions {
        //         UPDATE_EMISSIONS,
        //         SET_TEAM_ADDR,
        //         SET_TEAM_PERCENT,
        //         SET_TREASURY_ADDR,
        //         SET_TREASURY_PERCENT,
        //         SET_INVESTOR_ADDRESS,
        //         SET_INVESTOR_PERCENT,
        //         CHANGE_SELF_OWNER,
        //         CHANGE_MASTERCHEF_OWNER,
        //         CHANGE_DELAY
        //     }

        let farm1 = await fixtures.masterController.add(799, fixtures.alb.address, 0, 30, [])

        await fixtures.masterController.prepareFunction(8); //masterchef

        let time = (await provider.getBlock()).timestamp
        await provider.send("evm_mine", [time + (10*24*60*60)]);

        // await fixtures.masterController.transferOwnership(other.address)
        await fixtures.masterController.transferMasterChefOwnership(other.address)

        let chefOwner = await fixtures.masterChef.owner()

        console.log("chef owner, other", chefOwner, other.address)

        await expect(chefOwner).to.eq(other.address)

        await fixtures.masterController.prepareFunction(7); //self

        time = (await provider.getBlock()).timestamp
        await provider.send("evm_mine", [time + (10*24*60*60)]);

        await fixtures.masterController.transferOwnership(other.address)

        let controllerOwner = await fixtures.masterController.owner()

        console.log("controller owner", controllerOwner)

        await expect(controllerOwner).to.eq(other.address)


    })



//

    // it("Owner Can't insta-set minter", async () => {
    //
    //     const MINTER_ROLE = ethers.utils.id("MINTER_ROLE")
    //     console.log(await provider.getBlock())
    //     console.log((await albToken.MINT_DELAY()).toString())
    //     console.log("solidity minter", await albToken.MINTER_ROLE())
    //     console.log("ethers minter", MINTER_ROLE)
    //     await expect(albToken.grantRole(MINTER_ROLE, wallet.address))
    //         .to.be.revertedWith("MTE")
    // })
    //
    // it("Timelock locks", async () => {
    //
    //     const MINTER_ROLE = ethers.utils.id("MINTER_ROLE")
    //     await albToken.setUpMinter();
    //     await expect(albToken.grantRole(MINTER_ROLE, wallet.address))
    //         .to.be.revertedWith("MTE")
    // })
    //
    // it("Timelock unlocks", async () => {
    //
    //     const MINTER_ROLE = ethers.utils.id("MINTER_ROLE")
    //     await albToken.setUpMinter();
    //     let time = (await provider.getBlock()).timestamp
    //     await provider.send("evm_mine", [time + (10*24*60*60)]);
    //     console.log((await provider.getBlock()).timestamp)
    //     await expect(albToken.grantRole(MINTER_ROLE, wallet.address))
    //         .to.emit(albToken, "RoleGranted")
    // })
    //
    // it("Can't reinitialize", async() => {
    //
    //     await expect(albToken.initialize(ADDRESS_ZERO)).to.be.revertedWith("AI");
    //
    // })


})