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
const { pairFixture, tokenFixture} = require('./utils/fixtures')
const exp = require("constants");
const {over} = require("lodash/util");
const {ADDRESS_ZERO} = require("./utils");
const { AddressZero } = ethers.constants.AddressZero

const MINIMUM_LIQUIDITY = bigNumberify(10).pow(3)

chai.use(solidity)

const overrides = {
    gasLimit: 10000000
}

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
    let albToken;

    beforeEach(async () => {
        albToken = await tokenFixture(provider, wallet, other)
    })

    it("Owner Can't mint", async () => {
        await expect(albToken.mint(wallet.address, bigNumberify(10).pow(30)))
            .to.be.reverted //error too long to use revertedWith
    })
    it("Owner Can't insta-set minter", async () => {

        const MINTER_ROLE = ethers.utils.id("MINTER_ROLE")
        console.log(await provider.getBlock())
        console.log((await albToken.MINT_DELAY()).toString())
        console.log("solidity minter", await albToken.MINTER_ROLE())
        console.log("ethers minter", MINTER_ROLE)
        await expect(albToken.grantRole(MINTER_ROLE, wallet.address))
            .to.be.revertedWith("MTE")
    })

    it("Timelock locks", async () => {

        const MINTER_ROLE = ethers.utils.id("MINTER_ROLE")
        await albToken.setUpMinter();
        await expect(albToken.grantRole(MINTER_ROLE, wallet.address))
            .to.be.revertedWith("MTE")
    })

    it("Timelock unlocks", async () => {

        const MINTER_ROLE = ethers.utils.id("MINTER_ROLE")
        await albToken.setUpMinter();
        let time = (await provider.getBlock()).timestamp
        await provider.send("evm_mine", [time + (10*24*60*60)]);
        console.log((await provider.getBlock()).timestamp)
        await expect(albToken.grantRole(MINTER_ROLE, wallet.address))
            .to.emit(albToken, "RoleGranted")
    })

    it("Can't reinitialize", async() => {

        await expect(albToken.initialize(ADDRESS_ZERO)).to.be.revertedWith("AI");

    })


})