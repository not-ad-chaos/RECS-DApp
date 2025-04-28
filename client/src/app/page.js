"use client"

import { useState, useEffect } from "react"
import { ethers } from "ethers"
import Web3Modal from "web3modal"
import Head from "next/head"

// Import ABI files - you would need to create these from the contracts
import EnergyTokenABI from "./EnergyToken.json"
import EnergyMarketplaceABI from "./EnergyMarketplace.json"
import RenewableEnergyCertificationABI from "./RenewableEnergyCertification.json"

// Contract addresses from deployment
import contracts from "./contracts.json"
const ENERGY_TOKEN_ADDRESS = contracts.EnergyToken
const ENERGY_MARKETPLACE_ADDRESS = contracts.EnergyMarketplace
const RENEWABLE_CERTIFICATION_ADDRESS = contracts.RenewableEnergyCertification

export default function Home() {
    // State variables
    const [account, setAccount] = useState("")
    const [energyTokenContract, setEnergyTokenContract] = useState(null)
    const [energyMarketplaceContract, setEnergyMarketplaceContract] = useState(null)
    const [renewableEnergyCerticiationContract, setRenewableEnergyCertificateContract] = useState(null)
    const [connected, setConnected] = useState(false)
    const [balance, setBalance] = useState("0")
    const [activeListings, setActiveListings] = useState([])
    const [certificates, setCertificates] = useState([])
    const [isProducer, setIsProducer] = useState(false)
    const [producerInfo, setProducerInfo] = useState(null)
    const [isAuditor, setIsAuditor] = useState(false)
    const [producersToVerify, setProducersToVerify] = useState([])
    const [accounts, setAccounts] = useState([])
    const [checkingWallet, setCheckingWallet] = useState(true) // New state to track initial wallet check

    // Known account labels mapping
    const knownAccounts = {
        "0x401EE82A841dc6B56DAe765bBBF3456Ea79F3B56": "Account 1",
        "0x7cc3C7E69e1aa0C941E8E34C9c4c9b52B1AfF017": "Account 2",
        "0x9A7AF3B3185bc257CBe60065f1C885F099df4202": "Account 3",
        "0xC8240797A9aB72eB604c58ac5EA158B27a0881c0": "Account 4",
    }

    // Check for active wallets when page loads
    useEffect(() => {
        const checkForActiveWallets = async () => {
            setCheckingWallet(true)
            try {
                // Check if Ethereum provider exists (like MetaMask)
                if (window.ethereum) {
                    // Check if accounts are already connected
                    const accounts = await window.ethereum.request({ method: "eth_accounts" })

                    if (accounts && accounts.length > 0) {
                        // Wallet is already connected, initialize
                        const success = await connectWallet()

                        if (success) {
                            console.log("Wallet auto-connected successfully")
                        }
                    }
                }
            } catch (error) {
                console.error("Error checking for active wallets:", error)
            } finally {
                setCheckingWallet(false)
            }
        }

        checkForActiveWallets()

        // Add event listener for account changes
        if (window.ethereum) {
            window.ethereum.on("accountsChanged", (accounts) => {
                if (accounts.length > 0) {
                    // Auto reconnect with new account
                    connectWallet()
                } else {
                    // Disconnect if all accounts disconnected
                    disconnectWallet()
                }
            })
        }

        return () => {
            // Remove event listener on component unmount
            if (window.ethereum && window.ethereum.removeListener) {
                window.ethereum.removeListener("accountsChanged", () => {
                    console.log("Removed accountsChanged event listener")
                })
            }
        }
    }, [])

    // Form state
    const [newListing, setNewListing] = useState({
        tokenAmount: "",
        pricePerToken: "",
        energySource: "Solar",
        kWhRepresented: "",
    })

    const [newCertificate, setNewCertificate] = useState({
        energySource: "Solar",
        kWhProduced: "",
        location: "",
    })

    const [producerRegistration, setProducerRegistration] = useState({
        name: "",
        location: "",
        energyTypes: ["Solar"],
        capacityKW: "",
    })

    const energySources = ["Solar", "Wind", "Hydro", "Biomass", "Geothermal"]

    // Add a specific function to refresh balance
    const refreshBalance = async () => {
        try {
            if (!energyTokenContract || !account) return

            console.log("Refreshing token balance for account:", account)
            const balance = await energyTokenContract.balanceOf(account)
            const formattedBalance = ethers.formatEther(balance)
            console.log("Updated balance:", formattedBalance, "REC")
            setBalance(formattedBalance)
        } catch (error) {
            console.error("Error refreshing balance:", error)
        }
    }

    // Call refreshBalance every 10 seconds and when the component mounts
    useEffect(() => {
        if (connected) {
            refreshBalance()

            // Set up interval to refresh balance
            const intervalId = setInterval(refreshBalance, 10000)

            // Clean up interval on component unmount
            return () => clearInterval(intervalId)
        }
    }, [connected, account, energyTokenContract])

    // Connect wallet - simplified to just connect with whatever is available
    const connectWallet = async () => {
        try {
            const web3Modal = new Web3Modal({
                cacheProvider: true,
            })

            const connection = await web3Modal.connect()
            const ethProvider = new ethers.BrowserProvider(connection)
            const allAccounts = await ethProvider.listAccounts()
            const signer = await ethProvider.getSigner()

            // Store all accounts
            setAccounts(allAccounts.map((acc) => acc.address))
            setAccount(allAccounts[0].address)
            setConnected(true)

            // Initialize contracts with signer
            const energyTokenContract = new ethers.Contract(ENERGY_TOKEN_ADDRESS, EnergyTokenABI.abi, signer)

            const energyMarketplaceContract = new ethers.Contract(
                ENERGY_MARKETPLACE_ADDRESS,
                EnergyMarketplaceABI.abi,
                signer
            )

            const renewableEnergyCerticiationContract = new ethers.Contract(
                RENEWABLE_CERTIFICATION_ADDRESS,
                RenewableEnergyCertificationABI.abi,
                signer
            )

            setEnergyTokenContract(energyTokenContract)
            setEnergyMarketplaceContract(energyMarketplaceContract)
            setRenewableEnergyCertificateContract(renewableEnergyCerticiationContract)

            // Now load user data after contracts are initialized
            await loadUserData(
                allAccounts[0].address,
                energyTokenContract,
                energyMarketplaceContract,
                renewableEnergyCerticiationContract
            )

            // Explicitly refresh balance after connection
            setTimeout(() => {
                refreshBalance()
            }, 2000)

            return true
        } catch (error) {
            console.error("Error connecting wallet:", error)
            return false
        }
    }

    // Disconnect wallet
    const disconnectWallet = async () => {
        setConnected(false)
        setAccount("")
        setAccounts([])
        setEnergyTokenContract(null)
        setEnergyMarketplaceContract(null)
        setRenewableEnergyCertificateContract(null)
        setBalance("0")
        setActiveListings([])
        setCertificates([])
        setIsProducer(false)
        setProducerInfo(null)
        setIsAuditor(false)
        setProducersToVerify([])

        // Clear Web3Modal cached provider
        if (window.localStorage.getItem("WEB3_CONNECT_CACHED_PROVIDER")) {
            window.localStorage.removeItem("WEB3_CONNECT_CACHED_PROVIDER")
        }

        // If using MetaMask or similar wallet
        if (window.ethereum && window.ethereum.disconnect) {
            try {
                await window.ethereum.disconnect()
            } catch (error) {
                console.error("Error disconnecting:", error)
            }
        }
    }

    // Add new function to handle account switching
    const switchAccount = async (newAddress) => {
        try {
            setAccount(newAddress)

            // Get new signer for the selected account
            const web3Modal = new Web3Modal()
            const connection = await web3Modal.connect()
            const ethProvider = new ethers.BrowserProvider(connection)
            const signer = await ethProvider.getSigner(newAddress)

            // Reinitialize contracts with new signer
            const energyTokenContract = new ethers.Contract(ENERGY_TOKEN_ADDRESS, EnergyTokenABI.abi, signer)

            const energyMarketplaceContract = new ethers.Contract(
                ENERGY_MARKETPLACE_ADDRESS,
                EnergyMarketplaceABI.abi,
                signer
            )

            const renewableEnergyCerticiationContract = new ethers.Contract(
                RENEWABLE_CERTIFICATION_ADDRESS,
                RenewableEnergyCertificationABI.abi,
                signer
            )

            setEnergyTokenContract(energyTokenContract)
            setEnergyMarketplaceContract(energyMarketplaceContract)
            setRenewableEnergyCertificateContract(renewableEnergyCerticiationContract)

            // Reload user data for new account
            await loadUserData(
                newAddress,
                energyTokenContract,
                energyMarketplaceContract,
                renewableEnergyCerticiationContract
            )

            // Explicitly refresh balance after switching accounts
            setTimeout(() => {
                refreshBalance()
            }, 2000)
        } catch (error) {
            console.error("Error switching account:", error)
        }
    }

    // Load user data
    const loadUserData = async (
        account,
        energyTokenContract,
        energyMarketplaceContract,
        renewableEnergyCerticiationContract
    ) => {
        try {
            // Get token balance
            const balance = await energyTokenContract.balanceOf(account)
            setBalance(ethers.formatEther(balance))

            // Check if user is registered producer
            const isRegistered = await renewableEnergyCerticiationContract.registeredProducers(account)
            setIsProducer(isRegistered)

            if (isRegistered) {
                const producer = await renewableEnergyCerticiationContract.producers(account)
                setProducerInfo({
                    name: producer.name,
                    location: producer.location,
                    energyTypes: Array.isArray(producer.energyTypes) ? producer.energyTypes : [],
                    totalCapacityKW: producer.totalCapacityKW.toString(),
                    verified: producer.verified,
                })
            }

            // Check if user is an auditor
            const isAuditor = await renewableEnergyCerticiationContract.authorizedAuditors(account)
            setIsAuditor(isAuditor)

            // If user is an auditor, load unverified producers
            if (isAuditor) {
                await loadUnverifiedProducers(renewableEnergyCerticiationContract)
            }

            // Load active listings
            await loadActiveListings(energyMarketplaceContract)

            // Load certificates with marketplace contract (CORRECTED)
            await loadCertificates(account, energyMarketplaceContract)

            console.log("User data loaded successfully for account:", account)
        } catch (error) {
            console.error("Error loading user data:", error)
        }
    }

    // Load certificates from marketplace contract
    const loadCertificates = async (account, marketplaceContract) => {
        try {
            if (!marketplaceContract) {
                console.error("Cannot load certificates - marketplace contract not initialized")
                return
            }

            // Get certificate count from marketplace contract
            console.log("Loading certificates from marketplace contract for account:", account)
            const certificateCount = await marketplaceContract.certificateCount()
            console.log("Total certificate count:", certificateCount.toString())
            const certs = []

            // Loop through all certificates
            for (let i = 1; i <= Number(certificateCount); i++) {
                try {
                    const cert = await marketplaceContract.certificates(i)

                    // Log certificate details for debugging
                    console.log(`Certificate ${i}:`, {
                        id: cert.id.toString(),
                        producer: cert.producer,
                        currentAccount: account,
                        match: cert.producer.toLowerCase() === account.toLowerCase(),
                    })

                    // Add certificates that belong to the current account
                    if (cert.producer.toLowerCase() === account.toLowerCase()) {
                        certs.push({
                            id: cert.id.toString(),
                            energySource: cert.energySource,
                            kWhProduced: cert.kWhProduced.toString(),
                            tokenAmount: cert.tokenAmount ? cert.tokenAmount.toString() : "0",
                            timestamp: new Date(Number(cert.timestamp) * 1000).toLocaleString(),
                            location: cert.location,
                            verified: cert.verified,
                        })
                        console.log("Added certificate to display list")
                    }
                } catch (certError) {
                    console.error(`Error loading certificate ${i}:`, certError)
                    // Continue to next certificate
                }
            }

            console.log("Loaded certificates for display:", certs.length)
            setCertificates(certs)
        } catch (error) {
            console.error("Error loading certificates:", error)
        }
    }

    // Load active marketplace listings
    const loadActiveListings = async (energyMarketplaceContract) => {
        try {
            // Get the count of all listings as a property (not a function)
            const count = await energyMarketplaceContract.listingCount()
            let listings = []
            console.log("Active listing count:", count.toString())

            // Loop through all listings and add the active ones to our state
            for (let i = 1; i <= Number(count); i++) {
                try {
                    const listing = await energyMarketplaceContract.listings(i)
                    if (listing.active) {
                        listings.push({
                            id: listing.id.toString(),
                            seller: listing.seller,
                            sellerLabel: knownAccounts[listing.seller] || null,
                            tokenAmount: ethers.formatEther(listing.tokenAmount),
                            pricePerToken: ethers.formatEther(listing.pricePerToken),
                            energySource: listing.energySource,
                            kWhRepresented: listing.kWhRepresented.toString(),
                            timestamp: new Date(Number(listing.timestamp) * 1000).toLocaleString(),
                        })
                    }
                } catch (listingError) {
                    console.error(`Error loading listing ${i}:`, listingError)
                    // Continue to next listing
                }
            }

            console.log("Loaded active listings:", listings.length)
            setActiveListings(listings)
        } catch (error) {
            console.error("Error loading listings:", error)
        }
    }

    // Create new listing
    const createListing = async (e) => {
        e.preventDefault()

        try {
            const tokenAmount = ethers.parseEther(newListing.tokenAmount)
            const pricePerToken = ethers.parseEther(newListing.pricePerToken)

            // First approve marketplace to spend tokens
            const approveTx = await energyTokenContract.approve(ENERGY_MARKETPLACE_ADDRESS, tokenAmount)
            await approveTx.wait()

            // Create listing
            const tx = await energyMarketplaceContract.createListing(
                tokenAmount,
                pricePerToken,
                newListing.energySource,
                newListing.kWhRepresented
            )

            await tx.wait()

            // Reset form and reload listings
            setNewListing({
                tokenAmount: "",
                pricePerToken: "",
                energySource: "Solar",
                kWhRepresented: "",
            })

            loadActiveListings(energyMarketplaceContract)
        } catch (error) {
            console.error("Error creating listing:", error)
        }
    }

    // Buy listing
    const buyListing = async (listingId, totalPrice) => {
        try {
            const tx = await energyMarketplaceContract.buyListing(listingId, {
                value: ethers.parseEther(totalPrice),
            })

            await tx.wait()

            // Reload data
            loadUserData(account, energyTokenContract, energyMarketplaceContract, renewableEnergyCerticiationContract)
        } catch (error) {
            console.error("Error buying listing:", error)
        }
    }

    // Create certificate
    const createCertificate = async (e) => {
        e.preventDefault()

        try {
            console.log("Creating certificate directly with marketplace contract...")

            // Call the marketplace contract directly instead of going through the certification contract
            const tx = await energyMarketplaceContract.createCertificate(
                account, // Pass the producer address explicitly (current wallet)
                newCertificate.energySource,
                newCertificate.kWhProduced,
                newCertificate.location
            )

            console.log("Transaction sent, waiting for confirmation...")
            const receipt = await tx.wait()
            console.log("Certificate created at tx hash:", receipt.hash)

            // Reset form and reload certificates
            setNewCertificate({
                energySource: "Solar",
                kWhProduced: "",
                location: "",
            })

            // Load certificates after a short delay to ensure blockchain state is updated
            setTimeout(() => {
                loadCertificates(account, energyMarketplaceContract)
            }, 2000)

            return true
        } catch (error) {
            console.error("Error creating certificate:", error)
            return false
        }
    }

    // Register as producer
    const registerProducer = async (e) => {
        e.preventDefault()

        try {
            const tx = await renewableEnergyCerticiationContract.registerProducer(
                producerRegistration.name,
                producerRegistration.location,
                producerRegistration.energyTypes,
                producerRegistration.capacityKW
            )

            await tx.wait()

            // Reload data
            loadUserData(account, energyTokenContract, energyMarketplaceContract, renewableEnergyCerticiationContract)
        } catch (error) {
            console.error("Error registering producer:", error)
        }
    }

    // Handle energy type selection
    const handleEnergyTypeChange = (type, checked) => {
        if (checked) {
            setProducerRegistration({
                ...producerRegistration,
                energyTypes: [...producerRegistration.energyTypes, type],
            })
        } else {
            setProducerRegistration({
                ...producerRegistration,
                energyTypes: producerRegistration.energyTypes.filter((t) => t !== type),
            })
        }
    }

    // Add function to load unverified producers
    const loadUnverifiedProducers = async (certContract) => {
        try {
            // We'll need to listen to ProducerRegistered events to get all producers
            const filter = certContract.filters.ProducerRegistered()
            const events = await certContract.queryFilter(filter)

            const unverifiedProducers = []

            for (const event of events) {
                const producerAddress = event.args.producerAddress
                const producer = await certContract.producers(producerAddress)

                if (!producer.verified) {
                    unverifiedProducers.push({
                        address: producerAddress,
                        accountLabel: knownAccounts[producerAddress] || null,
                        name: producer.name,
                        location: producer.location,
                        energyTypes: Array.isArray(producer.energyTypes) ? producer.energyTypes : [],
                        totalCapacityKW: producer.totalCapacityKW.toString(),
                        registrationTime: new Date(Number(producer.registrationTime) * 1000).toLocaleString(),
                    })
                }
            }

            setProducersToVerify(unverifiedProducers)
        } catch (error) {
            console.error("Error loading unverified producers:", error)
        }
    }

    // Add function to verify a producer
    const verifyProducer = async (producerAddress) => {
        try {
            // Create audit report and verify producer
            const tx = await renewableEnergyCerticiationContract.fileAuditReport(
                producerAddress,
                "ipfs://placeholder-uri", // You might want to add actual audit report URI
                "Producer verified through UI",
                true // passed verification
            )

            await tx.wait()

            // Reload unverified producers
            await loadUnverifiedProducers(renewableEnergyCerticiationContract)

            // If this was the current user being verified, reload their data
            if (producerAddress.toLowerCase() === account.toLowerCase()) {
                await loadUserData(
                    account,
                    energyTokenContract,
                    energyMarketplaceContract,
                    renewableEnergyCerticiationContract
                )
            }
        } catch (error) {
            console.error("Error verifying producer:", error)
        }
    }

    // Add a debug function to check contract interactions
    const debugContracts = async () => {
        if (!energyMarketplaceContract || !renewableEnergyCerticiationContract || !energyTokenContract) {
            console.error("Contracts not initialized")
            return
        }

        try {
            console.log("===== CONTRACT DEBUGGING =====")
            console.log("Current account:", account)

            // Check token balance directly
            try {
                const rawBalance = await energyTokenContract.balanceOf(account)
                console.log("Raw token balance for account:", rawBalance.toString(), account)
                console.log("Formatted token balance:", ethers.formatEther(rawBalance), "REC")

                // Check token contract address
                console.log("Token contract address:", energyTokenContract.target)
                console.log("Token contract in JSON:", ENERGY_TOKEN_ADDRESS)

                // Check total supply
                const totalSupply = await energyTokenContract.totalSupply()
                console.log("Total token supply:", ethers.formatEther(totalSupply), "REC")

                // Update the balance state for immediate UI feedback
                setBalance(ethers.formatEther(rawBalance))
            } catch (balanceError) {
                console.error("Error checking token balance:", balanceError)
            }

            // Check certificateCount
            const mpCertCount = await energyMarketplaceContract.certificateCount()
            console.log("Marketplace certificate count:", mpCertCount.toString())

            // Check certificate structure
            if (mpCertCount > 0) {
                const firstCert = await energyMarketplaceContract.certificates(1)
                console.log("First certificate in marketplace:", {
                    id: firstCert.id.toString(),
                    producer: firstCert.producer,
                    energySource: firstCert.energySource,
                    kWhProduced: firstCert.kWhProduced.toString(),
                })
            }

            console.log("============================")
        } catch (error) {
            console.error("Debug error:", error)
        }
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <Head>
                <title>Renewable Energy Marketplace</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <header className="bg-green-600 text-white p-4">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Renewable Energy Marketplace</h1>
                    {checkingWallet ? (
                        <div className="bg-white text-green-600 px-4 py-2 rounded-md font-medium">
                            Checking wallet...
                        </div>
                    ) : !connected ? (
                        <button
                            onClick={connectWallet}
                            className="bg-white text-green-600 px-4 py-2 rounded-md font-medium hover:bg-gray-100">
                            Connect Wallet
                        </button>
                    ) : (
                        <div className="flex items-center space-x-4">
                            <div className="relative">
                                <select
                                    value={account}
                                    onChange={(e) => switchAccount(e.target.value)}
                                    className="bg-white text-green-600 px-4 py-2 rounded-md font-medium appearance-none cursor-pointer pr-8">
                                    {accounts.map((addr) => (
                                        <option key={addr} value={addr}>
                                            {addr.substring(0, 6)}...{addr.substring(addr.length - 4)}
                                            {knownAccounts[addr] && ` (${knownAccounts[addr]})`}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-green-600">
                                    <svg
                                        className="fill-current h-4 w-4"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 20 20">
                                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                                    </svg>
                                </div>
                            </div>
                            <span
                                className="bg-green-700 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-green-800"
                                onClick={refreshBalance}
                                title="Click to refresh balance">
                                {balance} REC
                            </span>
                            <button
                                onClick={disconnectWallet}
                                className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700">
                                Disconnect
                            </button>
                            <button
                                onClick={debugContracts}
                                className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700">
                                Debug
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <main className="container mx-auto py-8 px-4">
                {checkingWallet ? (
                    <div className="text-center py-20">
                        <h2 className="text-xl font-bold mb-4">Loading...</h2>
                        <p className="text-gray-600">Checking for connected wallets</p>
                    </div>
                ) : !connected ? (
                    <div className="text-center py-20">
                        <h2 className="text-2xl font-bold mb-4">Welcome to the Renewable Energy Marketplace</h2>
                        <p className="mb-8 text-gray-600">
                            Connect your wallet to start trading renewable energy credits
                        </p>
                        <button
                            onClick={connectWallet}
                            className="bg-green-600 text-white px-6 py-3 rounded-md font-medium hover:bg-green-700">
                            Connect Wallet
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Left Column */}
                        <div className="lg:col-span-8">
                            <section className="bg-white rounded-lg shadow-md p-6 mb-8">
                                <h2 className="text-xl font-bold mb-4">Active Listings</h2>
                                {activeListings.length === 0 ? (
                                    <p className="text-gray-500">No active listings available</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left py-2">ID</th>
                                                    <th className="text-left py-2">Seller</th>
                                                    <th className="text-left py-2">Energy Source</th>
                                                    <th className="text-left py-2">Amount (REC)</th>
                                                    <th className="text-left py-2">Price (ETH)</th>
                                                    <th className="text-left py-2">kWh</th>
                                                    <th className="text-left py-2">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeListings.map((listing) => (
                                                    <tr key={listing.id} className="border-b hover:bg-gray-50">
                                                        <td className="py-3">{listing.id}</td>
                                                        <td className="py-3">
                                                            {listing.seller.substring(0, 6)}...
                                                            {listing.seller.substring(listing.seller.length - 4)}
                                                            {listing.sellerLabel && (
                                                                <span className="ml-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                                                    {listing.sellerLabel}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3">{listing.energySource}</td>
                                                        <td className="py-3">{listing.tokenAmount}</td>
                                                        <td className="py-3">{listing.pricePerToken}</td>
                                                        <td className="py-3">{listing.kWhRepresented}</td>
                                                        <td className="py-3">
                                                            {listing.seller.toLowerCase() !== account.toLowerCase() && (
                                                                <button
                                                                    onClick={() =>
                                                                        buyListing(
                                                                            listing.id,
                                                                            (
                                                                                parseFloat(listing.tokenAmount) *
                                                                                parseFloat(listing.pricePerToken)
                                                                            ).toString()
                                                                        )
                                                                    }
                                                                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                                                                    Buy
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>

                            {isProducer && producerInfo?.verified && (
                                <section className="bg-white rounded-lg shadow-md p-6 mb-8">
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-xl font-bold">Your Certificates</h2>
                                        <button
                                            onClick={() => loadCertificates(account, energyMarketplaceContract)}
                                            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 flex items-center">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                className="h-4 w-4 mr-1"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor">
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                                />
                                            </svg>
                                            Refresh
                                        </button>
                                    </div>
                                    {certificates.length === 0 ? (
                                        <p className="text-gray-500">You haven't created any certificates yet</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b">
                                                        <th className="text-left py-2">ID</th>
                                                        <th className="text-left py-2">Energy Source</th>
                                                        <th className="text-left py-2">kWh Produced</th>
                                                        <th className="text-left py-2">Tokens Minted</th>
                                                        <th className="text-left py-2">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {certificates.map((cert) => (
                                                        <tr key={cert.id} className="border-b hover:bg-gray-50">
                                                            <td className="py-3">{cert.id}</td>
                                                            <td className="py-3">{cert.energySource}</td>
                                                            <td className="py-3">{cert.kWhProduced}</td>
                                                            <td className="py-3">{cert.tokenAmount}</td>
                                                            <td className="py-3">
                                                                {cert.verified ? (
                                                                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                                                                        Verified
                                                                    </span>
                                                                ) : (
                                                                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm">
                                                                        Pending
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </section>
                            )}

                            {isProducer && producerInfo?.verified && (
                                <section className="bg-white rounded-lg shadow-md p-6 mb-8">
                                    <h2 className="text-xl font-bold mb-4">Submit Energy Certificate</h2>
                                    <form onSubmit={createCertificate}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Energy Source
                                                </label>
                                                <select
                                                    value={newCertificate.energySource}
                                                    onChange={(e) =>
                                                        setNewCertificate({
                                                            ...newCertificate,
                                                            energySource: e.target.value,
                                                        })
                                                    }
                                                    className="w-full p-2 border border-gray-300 rounded"
                                                    required>
                                                    {energySources.map((source) => (
                                                        <option key={source} value={source}>
                                                            {source}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    kWh Produced
                                                </label>
                                                <input
                                                    type="number"
                                                    value={newCertificate.kWhProduced}
                                                    onChange={(e) =>
                                                        setNewCertificate({
                                                            ...newCertificate,
                                                            kWhProduced: e.target.value,
                                                        })
                                                    }
                                                    className="w-full p-2 border border-gray-300 rounded"
                                                    placeholder="Amount of energy produced"
                                                    required
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Production Location
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newCertificate.location}
                                                    onChange={(e) =>
                                                        setNewCertificate({
                                                            ...newCertificate,
                                                            location: e.target.value,
                                                        })
                                                    }
                                                    className="w-full p-2 border border-gray-300 rounded"
                                                    placeholder="Location where energy was produced"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                                            Submit Certificate
                                        </button>
                                    </form>
                                </section>
                            )}
                        </div>

                        {/* Right Column */}
                        <div className="lg:col-span-4">
                            {isProducer ? (
                                <section className="bg-white rounded-lg shadow-md p-6 mb-8">
                                    <h2 className="text-xl font-bold mb-4">Producer Profile</h2>
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <p className="font-medium">Name</p>
                                            <p className="text-gray-600">{producerInfo?.name}</p>
                                        </div>
                                        {producerInfo?.verified ? (
                                            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                                                Verified Producer
                                            </span>
                                        ) : (
                                            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
                                                Pending Verification
                                            </span>
                                        )}
                                    </div>
                                    <div className="mb-4">
                                        <p className="font-medium">Location</p>
                                        <p className="text-gray-600">{producerInfo?.location}</p>
                                    </div>
                                    <div className="mb-4">
                                        <p className="font-medium">Energy Types</p>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {producerInfo?.energyTypes &&
                                                producerInfo.energyTypes.map((type) => (
                                                    <span
                                                        key={type}
                                                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                                        {type}
                                                    </span>
                                                ))}
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <p className="font-medium">Capacity</p>
                                        <p className="text-gray-600">{producerInfo?.totalCapacityKW} kW</p>
                                    </div>
                                </section>
                            ) : (
                                <section className="bg-white rounded-lg shadow-md p-6 mb-8">
                                    <h2 className="text-xl font-bold mb-4">Register as Producer</h2>
                                    <form onSubmit={registerProducer}>
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Producer Name
                                            </label>
                                            <input
                                                type="text"
                                                value={producerRegistration.name}
                                                onChange={(e) =>
                                                    setProducerRegistration({
                                                        ...producerRegistration,
                                                        name: e.target.value,
                                                    })
                                                }
                                                className="w-full p-2 border border-gray-300 rounded"
                                                placeholder="Company or individual name"
                                                required
                                            />
                                        </div>
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Location
                                            </label>
                                            <input
                                                type="text"
                                                value={producerRegistration.location}
                                                onChange={(e) =>
                                                    setProducerRegistration({
                                                        ...producerRegistration,
                                                        location: e.target.value,
                                                    })
                                                }
                                                className="w-full p-2 border border-gray-300 rounded"
                                                placeholder="Physical location of production"
                                                required
                                            />
                                        </div>
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Energy Types
                                            </label>
                                            <div className="space-y-2">
                                                {energySources.map((source) => (
                                                    <div key={source} className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            id={`energy-${source}`}
                                                            checked={producerRegistration.energyTypes.includes(source)}
                                                            onChange={(e) =>
                                                                handleEnergyTypeChange(source, e.target.checked)
                                                            }
                                                            className="mr-2"
                                                        />
                                                        <label htmlFor={`energy-${source}`}>{source}</label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Total Capacity (kW)
                                            </label>
                                            <input
                                                type="number"
                                                value={producerRegistration.capacityKW}
                                                onChange={(e) =>
                                                    setProducerRegistration({
                                                        ...producerRegistration,
                                                        capacityKW: e.target.value,
                                                    })
                                                }
                                                className="w-full p-2 border border-gray-300 rounded"
                                                placeholder="Production capacity"
                                                required
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                                            Register
                                        </button>
                                    </form>
                                </section>
                            )}

                            {isAuditor && (
                                <section className="bg-white rounded-lg shadow-md p-6 mb-8">
                                    <h2 className="text-xl font-bold mb-4">Auditor Panel</h2>
                                    {producersToVerify.length === 0 ? (
                                        <p className="text-gray-500">No producers waiting for verification</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b">
                                                        <th className="text-left py-2">Address</th>
                                                        <th className="text-left py-2">Name</th>
                                                        <th className="text-left py-2">Location</th>
                                                        <th className="text-left py-2">Energy Types</th>
                                                        <th className="text-left py-2">Capacity (kW)</th>
                                                        <th className="text-left py-2">Registration Date</th>
                                                        <th className="text-left py-2">Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {producersToVerify.map((producer) => (
                                                        <tr
                                                            key={producer.address}
                                                            className="border-b hover:bg-gray-50">
                                                            <td className="py-3">
                                                                {producer.address.substring(0, 6)}...
                                                                {producer.address.substring(
                                                                    producer.address.length - 4
                                                                )}
                                                                {producer.accountLabel && (
                                                                    <span className="ml-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                                                                        {producer.accountLabel}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="py-3">{producer.name}</td>
                                                            <td className="py-3">{producer.location}</td>
                                                            <td className="py-3">
                                                                <div className="flex flex-wrap gap-1">
                                                                    {producer.energyTypes.map((type) => (
                                                                        <span
                                                                            key={type}
                                                                            className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                                                            {type}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </td>
                                                            <td className="py-3">{producer.totalCapacityKW}</td>
                                                            <td className="py-3">{producer.registrationTime}</td>
                                                            <td className="py-3">
                                                                <button
                                                                    onClick={() => verifyProducer(producer.address)}
                                                                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                                                                    Verify
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </section>
                            )}

                            <section className="bg-white rounded-lg shadow-md p-6">
                                <h2 className="text-xl font-bold mb-4">Create Listing</h2>
                                <form onSubmit={createListing}>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Token Amount
                                        </label>
                                        <input
                                            type="text"
                                            value={newListing.tokenAmount}
                                            onChange={(e) =>
                                                setNewListing({ ...newListing, tokenAmount: e.target.value })
                                            }
                                            className="w-full p-2 border border-gray-300 rounded"
                                            placeholder="Amount of REC tokens"
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Price per Token (ETH)
                                        </label>
                                        <input
                                            type="text"
                                            value={newListing.pricePerToken}
                                            onChange={(e) =>
                                                setNewListing({ ...newListing, pricePerToken: e.target.value })
                                            }
                                            className="w-full p-2 border border-gray-300 rounded"
                                            placeholder="Price in ETH"
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Energy Source
                                        </label>
                                        <select
                                            value={newListing.energySource}
                                            onChange={(e) =>
                                                setNewListing({ ...newListing, energySource: e.target.value })
                                            }
                                            className="w-full p-2 border border-gray-300 rounded"
                                            required>
                                            {energySources.map((source) => (
                                                <option key={source} value={source}>
                                                    {source}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            kWh Represented
                                        </label>
                                        <input
                                            type="number"
                                            value={newListing.kWhRepresented}
                                            onChange={(e) =>
                                                setNewListing({ ...newListing, kWhRepresented: e.target.value })
                                            }
                                            className="w-full p-2 border border-gray-300 rounded"
                                            placeholder="Amount of energy in kWh"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                        disabled={parseFloat(balance) < parseFloat(newListing.tokenAmount)}>
                                        Create Listing
                                    </button>
                                    {parseFloat(balance) < parseFloat(newListing.tokenAmount) && (
                                        <p className="text-red-600 text-sm mt-2">Insufficient balance</p>
                                    )}
                                </form>
                            </section>
                        </div>
                    </div>
                )}
            </main>

            <footer className="bg-gray-800 text-white p-6">
                <div className="container mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        <p>© 2025 Renewable Energy Marketplace</p>
                        <div className="mt-4 md:mt-0">
                            <p>Powered by Ethereum Blockchain</p>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}
