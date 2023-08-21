const {
    ethers,
    BigNumber,
    getAddress,
    keccak256,
    defaultAbiCoder,
    toUtf8Bytes,
    solidityPack
} = require('ethers')
const fs = require("fs").promises;

const bigNumberify = ethers.BigNumber.from

const PERMIT_TYPEHASH = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
);

exports.expandTo18Decimals = function expandTo18Decimals(n) {
    return bigNumberify(n).mul(bigNumberify(10).pow(18))
}

function getDomainSeparator(name, tokenAddress) {
    return ethers.utils.keccak256(
        defaultAbiCoder.encode(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [
                ethers.utils.keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
                ethers.utils.keccak256(toUtf8Bytes(name)),
                ethers.utils.keccak256(toUtf8Bytes('1')),
                1,
                tokenAddress
            ]
        )
    )
}

exports.getCreate2Address = function getCreate2Address(
    factoryAddress,
    [tokenA, tokenB],
    bytecode
) {
    const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]
    const create2Inputs = [
        '0xff',
        factoryAddress,
        ethers.utils.keccak256(solidityPack(['address', 'address'], [token0, token1])),
        ethers.utils.keccak256(bytecode)
    ]
    const sanitizedInputs = `0x${create2Inputs.map(i => i.slice(2)).join('')}`
    return getAddress(`0x${keccak256(sanitizedInputs).slice(-40)}`)
}

exports.getApprovalDigest =  async function getApprovalDigest(
    token,
    approve,
    nonce,
    deadline
) {
    const name = await token.name()
    const DOMAIN_SEPARATOR = getDomainSeparator(name, token.address)
    return ethers.utils.keccak256(
        solidityPack(
            ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
            [
                '0x19',
                '0x01',
                DOMAIN_SEPARATOR,
                ethers.utils.keccak256(
                    defaultAbiCoder.encode(
                        ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                        [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
                    )
                )
            ]
        )
    )
}

exports.mineBlock = async function mineBlock(provider, timestamp) {
    await new Promise(async (resolve, reject) => {
        provider._web3Provider.sendAsync(
            { jsonrpc: '2.0', method: 'evm_mine', params: [timestamp] }
        )
    })
}

exports.encodePrice = function encodePrice(reserve0, reserve1) {
    return [reserve1.mul(bigNumberify(2).pow(112)).div(reserve0), reserve0.mul(bigNumberify(2).pow(112)).div(reserve1)]
}


exports.readJSON = async function readJSON(path) {

// Read the content of the JSON file
    let file = await fs.readFile(path, 'utf8');
    return JSON.parse(file)

}