const EnergyToken = artifacts.require("EnergyToken");
const EnergyMarketplace = artifacts.require("EnergyMarketplace");
const RenewableEnergyCertification = artifacts.require("RenewableEnergyCertification");

module.exports = async function(deployer, network, accounts) {
  // Deploy EnergyToken first with deployer as temporary market controller
  await deployer.deploy(EnergyToken, accounts[0]);
  const energyToken = await EnergyToken.deployed();
  console.log("EnergyToken deployed at:", energyToken.address);
  
  // Deploy EnergyMarketplace with the token address
  await deployer.deploy(EnergyMarketplace, energyToken.address);
  const energyMarketplace = await EnergyMarketplace.deployed();
  console.log("EnergyMarketplace deployed at:", energyMarketplace.address);
  
  // Deploy RenewableEnergyCertification with the marketplace address
  await deployer.deploy(RenewableEnergyCertification, energyMarketplace.address);
  const renewableCertification = await RenewableEnergyCertification.deployed();
  console.log("RenewableEnergyCertification deployed at:", renewableCertification.address);
  
  // Update the market controller in EnergyToken to be the marketplace
  console.log("Updating market controller in EnergyToken...");
  await energyToken.changeMarketController(energyMarketplace.address);
  console.log("Market controller updated");
  
  console.log("Deployment complete!");
};
