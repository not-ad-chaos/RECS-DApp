const fs = require("fs")
const path = require("path")
const EnergyToken = artifacts.require("EnergyToken")
const EnergyMarketplace = artifacts.require("EnergyMarketplace")
const RenewableEnergyCertification = artifacts.require("RenewableEnergyCertification")

module.exports = async function (deployer, network, accounts) {
    try {
        console.log("Starting deployment with account:", accounts[0])

        // Deploy EnergyToken first with a temporary market controller
        console.log("Deploying EnergyToken...")
        await deployer.deploy(EnergyToken, accounts[0])
        const energyToken = await EnergyToken.deployed()
        console.log("EnergyToken deployed at:", energyToken.address)

        // Deploy EnergyMarketplace with the token address
        console.log("Deploying EnergyMarketplace...")
        await deployer.deploy(EnergyMarketplace, energyToken.address)
        const energyMarketplace = await EnergyMarketplace.deployed()
        console.log("EnergyMarketplace deployed at:", energyMarketplace.address)

        // Deploy RenewableEnergyCertification with the marketplace address
        console.log("Deploying RenewableEnergyCertification...")
        await deployer.deploy(RenewableEnergyCertification, energyMarketplace.address)
        const renewableCertification = await RenewableEnergyCertification.deployed()
        console.log("RenewableEnergyCertification deployed at:", renewableCertification.address)

        // Update the market controller in EnergyToken to be the marketplace
        console.log("Updating market controller in EnergyToken...")
        const updateTx = await energyToken.changeMarketController(energyMarketplace.address)
        console.log("Market controller updated. Transaction:", updateTx.tx)

        // Verify the update
        const currentController = await energyToken.marketController()
        console.log("Current market controller:", currentController)
        console.log("EnergyMarketplace address:", energyMarketplace.address)

        if (currentController.toLowerCase() !== energyMarketplace.address.toLowerCase()) {
            console.error("ERROR: Market controller was not properly updated!")
        } else {
            console.log("Market controller successfully updated to marketplace address")
        }

        // Add the first auditor to the certification system
        console.log("Adding first auditor to certification system...")
        await renewableCertification.authorizeAuditor(accounts[1])
        console.log("First auditor added:", accounts[1])

        // Write contract addresses to file
        const contracts = {
            EnergyToken: energyToken.address,
            EnergyMarketplace: energyMarketplace.address,
            RenewableEnergyCertification: renewableCertification.address,
        }

        const clientAppDir = path.join(__dirname, "../client/src/app")

        // Ensure directory exists
        if (!fs.existsSync(clientAppDir)) {
            fs.mkdirSync(clientAppDir, { recursive: true })
        }

        // Write contract addresses
        const contractsPath = path.join(clientAppDir, "contracts.json")
        fs.writeFileSync(contractsPath, JSON.stringify(contracts, null, 2))
        console.log("Contract addresses written to:", contractsPath)

        // Copy contract JSON files from build
        const buildDir = path.join(__dirname, "../build/contracts")
        fs.copyFileSync(path.join(buildDir, "EnergyToken.json"), path.join(clientAppDir, "EnergyToken.json"))
        fs.copyFileSync(
            path.join(buildDir, "EnergyMarketplace.json"),
            path.join(clientAppDir, "EnergyMarketplace.json")
        )
        fs.copyFileSync(
            path.join(buildDir, "RenewableEnergyCertification.json"),
            path.join(clientAppDir, "RenewableEnergyCertification.json")
        )
        console.log("Contract ABIs copied to client directory")

        console.log("Deployment complete!")
    } catch (error) {
        console.error("Deployment failed:", error)
    }
}
