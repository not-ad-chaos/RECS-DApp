const fs = require("fs")
const path = require("path")
const EnergyToken = artifacts.require("EnergyToken")
const EnergyMarketplace = artifacts.require("EnergyMarketplace")
const RenewableEnergyCertification = artifacts.require("RenewableEnergyCertification")
const ethers = require("ethers")

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

        // Add verifier role to deployer account
        console.log("Adding marketplace verifier...")
        await energyMarketplace.addVerifier(accounts[0])
        console.log("Verifier added:", accounts[0])

        // Add the first auditor to the certification system
        console.log("Adding first auditor to certification system...")
        await renewableCertification.authorizeAuditor(accounts[1])
        console.log("First auditor added:", accounts[1])

        // Create arrays for energy sources and locations
        const energySources = ["Solar", "Wind", "Hydro", "Biomass", "Geothermal"]
        const locations = ["California", "Texas", "New York", "Florida", "Washington"]

        // Target accounts to receive tokens
        const accountsToMint = [
            "0x401EE82A841dc6B56DAe765bBBF3456Ea79F3B56",
            "0x7cc3C7E69e1aa0C941E8E34C9c4c9b52B1AfF017",
            "0x9A7AF3B3185bc257CBe60065f1C885F099df4202",
            "0xC8240797A9aB72eB604c58ac5EA158B27a0881c0",
            "0xd69aA3AFc727e578B3648E9b27a549c03D251CC6",
        ]

        // Create initial token balances via proper flow
        console.log("Creating tokens through the full registration-certification-verification flow...")

        for (let i = 0; i < accountsToMint.length; i++) {
            const account = accountsToMint[i]
            // First register and verify each producer
            const energySource = energySources[i % energySources.length]
            const location = locations[i % locations.length]

            try {
                console.log(`Processing account ${i}: ${account} (${energySource})`)

                // Register producer
                await renewableCertification.registerProducer(
                    `Producer${i + 1}`,
                    location,
                    [energySource],
                    1000 + i * 500,
                    { from: account }
                )

                // Verify producer
                await renewableCertification.verifyProducer(account, { from: accounts[0] })
                console.log(`Registered and verified producer ${i} (${energySource})`)

                // Create certificates and mint tokens
                const certificateAmount = 50 // 50 tokens for each account
                console.log(`Creating verified certificate with ${certificateAmount} tokens for account ${account}`)

                // 1. Create certificate
                await energyMarketplace.createCertificate(
                    account,
                    energySource,
                    certificateAmount * 100, // 100 kWh per token
                    location
                )

                // 2. Get certificate ID
                const certId = await energyMarketplace.certificateCount()
                console.log(`Certificate created with ID: ${certId}`)

                // 3. Verify certificate and mint tokens
                await energyMarketplace.verifyCertificate(certId, ethers.utils.parseEther(certificateAmount.toString()))

                console.log(
                    `Certificate ${certId} verified and ${certificateAmount} tokens minted to account ${account}`
                )

                // Verify balance was correctly minted
                const balance = await energyToken.balanceOf(account)
                console.log(`Account ${account} balance after minting: ${ethers.utils.formatEther(balance)} REC`)
            } catch (error) {
                console.error(`Error processing account ${account}:`, error.message)
            }
        }

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
