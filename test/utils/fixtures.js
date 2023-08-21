const { ethers, Contract} = require('ethers')
const { deployContract } = require('ethereum-waffle')
const fs = require('fs');

const { expandTo18Decimals, readJSON } = require('./utilities')
const {ADDRESS_ZERO} = require("./index");



const overrides = {
    gasLimit: 9999999
}

const factoryFixture = async function factoryFixture(Web3Provider, wallet) {
    let UniswapV2Factory = await readJSON('./artifacts/contracts/uniswapv2/UniswapV2Factory.sol/UniswapV2Factory.json')
    // console.log("UniFactory", UniswapV2Factory)
    return await deployContract(wallet, UniswapV2Factory, [wallet.address])
}

exports.factoryFixture = factoryFixture

exports.pairFixture = async function pairFixture(provider, wallet) {
    const factory = await factoryFixture(provider, wallet)

    let ERC20 = await readJSON('./artifacts/contracts/mock/MockERC20.sol/MockERC20.json')

    const tokenA = await deployContract(wallet, ERC20, ["TokenA", "TKA", expandTo18Decimals(10000)])
    const tokenB = await deployContract(wallet, ERC20, ["TokenB", "TKB", expandTo18Decimals(10000)])

    await factory.createPair(tokenA.address, tokenB.address)
    const pairAddress = await factory.getPair(tokenA.address, tokenB.address)
    let UniswapV2Pair = await readJSON('./artifacts/contracts/uniswapv2/UniswapV2Pair.sol/UniswapV2Pair.json')
    const pair = new Contract(pairAddress, JSON.stringify(UniswapV2Pair.abi), provider).connect(wallet)

    const token0Address = (await pair.token0()).address
    const token0 = tokenA.address === token0Address ? tokenA : tokenB
    const token1 = tokenA.address === token0Address ? tokenB : tokenA

    return { factory, token0, token1, pair }
}


exports.tokenFixture = async function tokenFixture(provider, wallet, other) {

    let AlienBase = await readJSON('./artifacts/contracts/alb/AlienBaseToken.sol/AlienBaseToken.json')

    let contract = await deployContract(wallet, AlienBase, [ADDRESS_ZERO])
    await contract.initialize(other.address)
    return contract


}

exports.distributorFixture = async function distributorFixture(provider, wallet, other) {

    let AlienBase = await readJSON('./artifacts/contracts/alb/AlienBaseToken.sol/AlienBaseToken.json')
    let MasterChef = await readJSON('./artifacts/contracts/farm/v2/BasedDistributorV2.sol/BasedDistributorV2.json')
    let DistributorController = await readJSON('./artifacts/contracts/farm/v2/DistributorController.sol/DistributorController.json')

    let alb = await deployContract(wallet, AlienBase, [ADDRESS_ZERO])

    //tokenInstance.address,
    //     //         '15000000000000000000', //7.5% monthly emission for 3 months
    //     //         "0xF277a4AD52f5fFa477699eD6B2E46B6A806b20e9", //Ledger
    //     //         "0xD9c14E5Ad86d06de762F0D179109661E5B60cC4d",   //also but different
    //     //         "0xD9c14E5Ad86d06de762F0D179109661E5B60cC4d",
    //     //         150,
    //     //         150,
    //     //         0

    let masterChef = await deployContract(wallet, MasterChef, [
        alb.address,
        '15000000000000000000',
        other.address,
        other.address,
        other.address,
        150,
        150,
        0
    ])

    let masterController = await deployContract(wallet, DistributorController, [masterChef.address]);
    let randoController = masterController.connect(other);
    await alb.initialize(masterChef.address)
    await masterChef.transferOwnership(masterController.address)
    return {alb, masterChef, masterController, randoController}

}

