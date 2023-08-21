// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./BasedDistributorV2.sol";
import "./rewarders/IComplexRewarder.sol";



//"Proxy" controller contract for interacting with MasterChef
//You set it as the owner of Masterchef and call the functions you need
//It has a differential timelock setting:
// - innocuous functions such as adding farms or setting farm multiplier are not timelocked for flexibility and security reasons
// (imagine a farm loses 100% of value due to hack/depeg/whatever - you want to immediately cut rewards)
// - setting depositFees and overall token emissions are timelocked to be rug proof
// - other features such as changeowner, setting team/treasury addresses and emissions also timelocked

contract DistributorController is Ownable {

    address public masterChef;
    using BoringERC20 for IBoringERC20;

    //All timelocked functions, notably excludes updateAllocPoint, set and add (they have differential rules)
    enum Functions {
        UPDATE_EMISSIONS,
        SET_TEAM_ADDR,
        SET_TEAM_PERCENT,
        SET_TREASURY_ADDR,
        SET_TREASURY_PERCENT,
        SET_INVESTOR_ADDRESS,
        SET_INVESTOR_PERCENT,
        CHANGE_SELF_OWNER,
        CHANGE_MASTERCHEF_OWNER,
        CHANGE_DELAY,
        ADD_REWARDER
    }
    uint256 public delay = 7 days;
    mapping(Functions => uint256) public timelock;


    modifier notLocked(Functions _fn) {
        require(
            timelock[_fn] != 0 && timelock[_fn] <= block.timestamp,
            "TIMELOCK"
        );
        _;
    }

    constructor(address _masterChef) {
        masterChef = _masterChef;
    }


    //called to prep a timelocked function for execution
    function prepareFunction(Functions _fn) public onlyOwner {
        timelock[_fn] = block.timestamp + delay;
    }
    //lock function execution
    function lockFunction(Functions _fn) public onlyOwner {
        timelock[_fn] = 0;
    }

    //not locked, but we put limits to the max allocPoint increase
    function add(
        uint256 _allocPoint,
        IBoringERC20 _lpToken,
        uint16 _depositFeeBP,
        uint256 _harvestInterval,
        IComplexRewarder[] calldata _rewarders
    ) public onlyOwner {

        //Can't create a pool taking more than half of existing rewards
        //deposit fee can be non zero when adding
        BasedDistributorV2 _masterChef = BasedDistributorV2(masterChef);
        uint _totalAlloc = _masterChef.totalAllocPoint();
        //override with min totalAlloc so that we can init pools from scratch
        require(_allocPoint < _totalAlloc || _totalAlloc < 800, "MAX_ALLO");
        return _masterChef.add(_allocPoint, _lpToken, _depositFeeBP, _harvestInterval, _rewarders);

    }

    //not locked, but there are limits to allocPoint and depositFee
    //also special timelock for setting new rewarders
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        uint16 _depositFeeBP,
        uint256 _harvestInterval,
        IComplexRewarder[] calldata _rewarders
    ) public onlyOwner notLocked(Functions.ADD_REWARDER) {


        //an existing pool cannot have more allocPoints than the existing total
        BasedDistributorV2 _masterChef = BasedDistributorV2(masterChef);
        require(_allocPoint < _masterChef.totalAllocPoint(), "MAX_ALLO");

        //can't add a higher deposit fee than what already exists
        (,,,activeDepositBP,,,) = _masterChef.poolInfo(_pid);
        require(_depositFeeBP <= activeDepositBP, "MAX_DEPOSIT");

        _masterChef.set(_pid, _allocPoint, _depositFeeBP, _harvestInterval, _rewarders);

    }

    //not timelocked
    function updateAllocPoint(uint256 _pid, uint256 _allocPoint) public onlyOwner {
        BasedDistributorV2 _masterChef = BasedDistributorV2(masterChef);
        require(_allocPoint < _masterChef.totalAllocPoint(), "MAX_ALLO");
        _masterChef.updateAllocPoint(_pid, _allocPoint);
    }


    // ---- TIMELOCKED FUNCTIONS ---- //

    function transferOwnership(address newOwner) public override onlyOwner notLocked(Functions.CHANGE_SELF_OWNER) {
        super.transferOwnership(newOwner);
        timelock[Functions.CHANGE_SELF_OWNER] = 0;
    }

    function transferMasterChefOwnership(address newOwner) public onlyOwner notLocked(Functions.CHANGE_MASTERCHEF_OWNER) {
        BasedDistributorV2 _masterChef = BasedDistributorV2(masterChef);
        _masterChef.transferOwnership(newOwner);
        timelock[Functions.CHANGE_MASTERCHEF_OWNER] = 0;
    }

    function changeDelay(uint256 newDelay) public onlyOwner notLocked(Functions.CHANGE_DELAY) {
        delay = newDelay;
        timelock[Functions.CHANGE_DELAY] = 0;
    }

    function updateEmissionRate(uint256 _albPerSec) public onlyOwner notLocked(Functions.UPDATE_EMISSIONS){
        BasedDistributorV2 _masterChef = BasedDistributorV2(masterChef);
        //function is timelocked, but we also set so that the reward rate can be at most doubled in a single call

        require(_albPerSec <= _masterChef.albPerSec() * 2, "MAX_EMISSION");
        _masterChef.updateEmissionRate(_albPerSec);
        //reset timelock to zero immediately
        timelock[Functions.UPDATE_EMISSIONS] = 0;
    }

    //@notice Setting dev/investor/treasury addresses is callable by the addresses themselves, not by owner, so no need to put it here

    function setTeamPercent(uint256 _newTeamPercent) public onlyOwner notLocked(Functions.SET_TEAM_PERCENT) {
        BasedDistributorV2 _masterChef = BasedDistributorV2(masterChef);

        _masterChef.setTeamPercent(_newTeamPercent);
        timelock[Functions.SET_TEAM_PERCENT] = 0; //reset timelock
    }

    function setTreasuryPercent(uint256 _newTreasuryPercent) public onlyOwner notLocked(Functions.SET_TREASURY_PERCENT) {
        BasedDistributorV2 _masterChef = BasedDistributorV2(masterChef);

        _masterChef.setTreasuryPercent(_newTreasuryPercent);
        timelock[Functions.SET_TREASURY_PERCENT] = 0; //reset timelock
    }

    function setInvestorPercent(uint256 _newInvestorPercent) public onlyOwner notLocked(Functions.SET_INVESTOR_PERCENT) {
        BasedDistributorV2 _masterChef = BasedDistributorV2(masterChef);

        _masterChef.setInvestorPercent(_newInvestorPercent);
        timelock[Functions.SET_INVESTOR_PERCENT] = 0; //reset timelock
    }
}
