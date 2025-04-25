// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract EnergyToken {
    string public name = "Renewable Energy Credit";
    string public symbol = "REC";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event Mint(address indexed to, uint256 value, string energySource, uint256 kWhProduced);
    event MarketControllerChanged(address indexed previousController, address indexed newController);

    // Energy source types for minting
    enum EnergySource { Solar, Wind, Hydro, Biomass, Geothermal }

    // Market controller permissions
    address public marketController;

    constructor(address _marketController) {
        marketController = _marketController;
    }

    modifier onlyMarketController() {
        require(msg.sender == marketController, "Only market controller can perform this action");
        _;
    }

    function transfer(address to, uint256 value) public returns (bool success) {
        require(balanceOf[msg.sender] >= value, "Insufficient balance");

        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;

        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) public returns (bool success) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool success) {
        require(balanceOf[from] >= value, "Insufficient balance");
        require(allowance[from][msg.sender] >= value, "Insufficient allowance");

        balanceOf[from] -= value;
        balanceOf[to] += value;
        allowance[from][msg.sender] -= value;

        emit Transfer(from, to, value);
        return true;
    }

    function mint(address to, uint256 value, EnergySource energySource, uint256 kWhProduced) public onlyMarketController returns (bool success) {
        balanceOf[to] += value;
        totalSupply += value;

        string memory energySourceString;
        if (energySource == EnergySource.Solar) energySourceString = "Solar";
        else if (energySource == EnergySource.Wind) energySourceString = "Wind";
        else if (energySource == EnergySource.Hydro) energySourceString = "Hydro";
        else if (energySource == EnergySource.Biomass) energySourceString = "Biomass";
        else if (energySource == EnergySource.Geothermal) energySourceString = "Geothermal";

        emit Mint(to, value, energySourceString, kWhProduced);
        emit Transfer(address(0), to, value);
        return true;
    }

    function changeMarketController(address newController) public onlyMarketController {
        require(newController != address(0), "New controller cannot be zero address");
        address oldController = marketController;
        marketController = newController;
        emit MarketControllerChanged(oldController, newController);
    }
}

