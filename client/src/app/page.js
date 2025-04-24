"use client";

import { useState } from 'react';
import { ethers } from 'ethers';
import Web3Modal from 'web3modal';
import Head from 'next/head';

// Import ABI files - you would need to create these from the contracts
import EnergyTokenABI from './EnergyToken.json';
import EnergyMarketplaceABI from './EnergyMarketplace.json';
import RenewableEnergyCertificationABI from './RenewableEnergyCertification.json';

// Contract addresses - replace with your deployed contract addresses
const ENERGY_TOKEN_ADDRESS = '0xa417bb88629Bb0Ab57Bbb245b4414071902953AF';
const ENERGY_MARKETPLACE_ADDRESS = '0x51fFECC16e2755a3568cCc7928C1CFC6fbEd710c';
const RENEWABLE_CERTIFICATION_ADDRESS = '0xDab2041bCD1434459506Bba651938aaf7322c5F0';

export default function Home() {
    // State variables
    const [account, setAccount] = useState('');
    const [tokenContract, setTokenContract] = useState(null);
    const [marketplaceContract, setMarketplaceContract] = useState(null);
    const [certificationContract, setCertificationContract] = useState(null);
    const [connected, setConnected] = useState(false);
    const [balance, setBalance] = useState('0');
    const [activeListings, setActiveListings] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [isProducer, setIsProducer] = useState(false);
    const [producerInfo, setProducerInfo] = useState(null);

    // Form state
    const [newListing, setNewListing] = useState({
        tokenAmount: '',
        pricePerToken: '',
        energySource: 'Solar',
        kWhRepresented: ''
    });

    const [newCertificate, setNewCertificate] = useState({
        energySource: 'Solar',
        kWhProduced: '',
        location: ''
    });

    const [producerRegistration, setProducerRegistration] = useState({
        name: '',
        location: '',
        energyTypes: ['Solar'],
        capacityKW: ''
    });

    const energySources = ['Solar', 'Wind', 'Hydro', 'Biomass', 'Geothermal'];

    // Connect wallet
    // Connect wallet
    // Connect wallet
    const connectWallet = async () => {
        try {
            const web3Modal = new Web3Modal();
            const connection = await web3Modal.connect();
            const ethProvider = new ethers.BrowserProvider(connection);
            const accounts = await ethProvider.listAccounts();
            const signer = await ethProvider.getSigner();

            setAccount(accounts[0].address);
            setConnected(true);

            // Initialize contracts with signer
            const tokenContract = new ethers.Contract(
                ENERGY_TOKEN_ADDRESS,
                EnergyTokenABI.abi,
                signer
            );

            const marketplaceContract = new ethers.Contract(
                ENERGY_MARKETPLACE_ADDRESS,
                EnergyMarketplaceABI.abi,
                signer
            );

            const certificationContract = new ethers.Contract(
                RENEWABLE_CERTIFICATION_ADDRESS,
                RenewableEnergyCertificationABI.abi,
                signer
            );

            setTokenContract(tokenContract);
            setMarketplaceContract(marketplaceContract);
            setCertificationContract(certificationContract);

            // Now load user data after contracts are initialized
            await loadUserData(accounts[0].address, tokenContract, marketplaceContract, certificationContract);
        } catch (error) {
            console.error('Error connecting wallet:', error);
        }
    };

    // Load user data
    const loadUserData = async (account, tokenContract, marketplaceContract, certificationContract) => {
        try {
            // Get token balance
            const balance = await tokenContract.balanceOf(account);
            setBalance(ethers.formatEther(balance));

            // Check if user is registered producer
            const isRegistered = await certificationContract.registeredProducers(account);
            setIsProducer(isRegistered);

            if (isRegistered) {
                const producer = await certificationContract.producers(account);
                setProducerInfo({
                    name: producer.name,
                    location: producer.location,
                    energyTypes: Array.isArray(producer.energyTypes) ? producer.energyTypes : [],
                    totalCapacityKW: producer.totalCapacityKW.toString(),
                    verified: producer.verified
                });
            }

            // Load active listings
            await loadActiveListings(marketplaceContract);

            // Load certificates
            await loadCertificates(account, certificationContract);
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    };

    // Load certificates - Updated to use the correct contract and parameter
    const loadCertificates = async (account, certificationContract) => {
        try {
            const certificateCount = await certificationContract.certificateCount();
            const certs = [];

            for (let i = 1; i <= certificateCount.toNumber(); i++) {
                const cert = await certificationContract.certificates(i);
                if (cert.producer === account) {
                    certs.push({
                        id: cert.id.toString(),
                        energySource: cert.energySource,
                        kWhProduced: cert.kWhProduced.toString(),
                        tokenAmount: cert.tokenAmount.toString(),
                        timestamp: new Date(cert.timestamp.toNumber() * 1000).toLocaleString(),
                        location: cert.location,
                        verified: cert.verified
                    });
                }
            }

            setCertificates(certs);
        } catch (error) {
            console.error('Error loading certificates:', error);
        }
    };

    // Load active marketplace listings
    const loadActiveListings = async (marketplaceContract) => {
        try {
            const listingCount = await marketplaceContract.listingCount();
            const listings = [];

            console.log(listingCount)
            for (let i = 1; i <= listingCount; i++) {
                const listing = await marketplaceContract.listings(i);
                if (listing.active) {
                    listings.push({
                        id: listing.id.toString(),
                        seller: listing.seller,
                        tokenAmount: ethers.formatEther(listing.tokenAmount),
                        pricePerToken: ethers.formatEther(listing.pricePerToken),
                        energySource: listing.energySource,
                        kWhRepresented: listing.kWhRepresented.toString(),
                        timestamp: new Date(listing.timestamp.toNumber() * 1000).toLocaleString()
                    });
                }
            }

            setActiveListings(listings);
        } catch (error) {
            console.error('Error loading listings:', error);
        }
    };

    // Create new listing
    const createListing = async (e) => {
        e.preventDefault();

        try {
            const tokenAmount = ethers.parseEther(newListing.tokenAmount);
            const pricePerToken = ethers.parseEther(newListing.pricePerToken);

            // First approve marketplace to spend tokens
            const approveTx = await tokenContract.approve(
                ENERGY_MARKETPLACE_ADDRESS,
                tokenAmount
            );
            await approveTx.wait();

            // Create listing
            const tx = await marketplaceContract.createListing(
                tokenAmount,
                pricePerToken,
                newListing.energySource,
                newListing.kWhRepresented
            );

            await tx.wait();

            // Reset form and reload listings
            setNewListing({
                tokenAmount: '',
                pricePerToken: '',
                energySource: 'Solar',
                kWhRepresented: ''
            });

            loadActiveListings(marketplaceContract);
        } catch (error) {
            console.error('Error creating listing:', error);
        }
    };

    // Buy listing
    const buyListing = async (listingId, totalPrice) => {
        try {
            const tx = await marketplaceContract.buyListing(listingId, {
                value: ethers.parseEther(totalPrice)
            });

            await tx.wait();

            // Reload data
            loadUserData(account, tokenContract, marketplaceContract, certificationContract);
        } catch (error) {
            console.error('Error buying listing:', error);
        }
    };

    // Create certificate
    const createCertificate = async (e) => {
        e.preventDefault();

        try {
            const tx = await certificationContract.submitEnergyCertificate(
                newCertificate.energySource,
                newCertificate.kWhProduced,
                newCertificate.location
            );

            await tx.wait();

            // Reset form and reload certificates
            setNewCertificate({
                energySource: 'Solar',
                kWhProduced: '',
                location: ''
            });

            loadCertificates(marketplaceContract);
        } catch (error) {
            console.error('Error creating certificate:', error);
        }
    };

    // Register as producer
    const registerProducer = async (e) => {
        e.preventDefault();

        try {
            const tx = await certificationContract.registerProducer(
                producerRegistration.name,
                producerRegistration.location,
                producerRegistration.energyTypes,
                producerRegistration.capacityKW
            );

            await tx.wait();

            // Reload data
            loadUserData(account, tokenContract, marketplaceContract, certificationContract);
        } catch (error) {
            console.error('Error registering producer:', error);
        }
    };

    // Handle energy type selection
    const handleEnergyTypeChange = (type, checked) => {
        if (checked) {
            setProducerRegistration({
                ...producerRegistration,
                energyTypes: [...producerRegistration.energyTypes, type]
            });
        } else {
            setProducerRegistration({
                ...producerRegistration,
                energyTypes: producerRegistration.energyTypes.filter(t => t !== type)
            });
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <Head>
                <title>Renewable Energy Marketplace</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <header className="bg-green-600 text-white p-4">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Renewable Energy Marketplace</h1>
                    {!connected ? (
                        <button
                            onClick={connectWallet}
                            className="bg-white text-green-600 px-4 py-2 rounded-md font-medium hover:bg-gray-100"
                        >
                            Connect Wallet
                        </button>
                    ) : (
                        <div className="flex items-center">
                            <span className="mr-4">
                                {account.substring(0, 6)}...{account.substring(account.length - 4)}
                            </span>
                            <span className="bg-green-700 px-3 py-1 rounded-full text-sm">
                                {balance} REC
                            </span>
                        </div>
                    )}
                </div>
            </header>

            <main className="container mx-auto py-8 px-4">
                {!connected ? (
                    <div className="text-center py-20">
                        <h2 className="text-2xl font-bold mb-4">Welcome to the Renewable Energy Marketplace</h2>
                        <p className="mb-8 text-gray-600">Connect your wallet to start trading renewable energy credits</p>
                        <button
                            onClick={connectWallet}
                            className="bg-green-600 text-white px-6 py-3 rounded-md font-medium hover:bg-green-700"
                        >
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
                                                    <th className="text-left py-2">Energy Source</th>
                                                    <th className="text-left py-2">Amount (REC)</th>
                                                    <th className="text-left py-2">Price (ETH)</th>
                                                    <th className="text-left py-2">kWh</th>
                                                    <th className="text-left py-2">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {activeListings.map(listing => (
                                                    <tr key={listing.id} className="border-b hover:bg-gray-50">
                                                        <td className="py-3">{listing.id}</td>
                                                        <td className="py-3">{listing.energySource}</td>
                                                        <td className="py-3">{listing.tokenAmount}</td>
                                                        <td className="py-3">{listing.pricePerToken}</td>
                                                        <td className="py-3">{listing.kWhRepresented}</td>
                                                        <td className="py-3">
                                                            {listing.seller.toLowerCase() !== account.toLowerCase() && (
                                                                <button
                                                                    onClick={() => buyListing(listing.id, (parseFloat(listing.tokenAmount) * parseFloat(listing.pricePerToken)).toString())}
                                                                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                                                                >
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
                                    <h2 className="text-xl font-bold mb-4">Your Certificates</h2>
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
                                                    {certificates.map(cert => (
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
                                                    onChange={(e) => setNewCertificate({ ...newCertificate, energySource: e.target.value })}
                                                    className="w-full p-2 border border-gray-300 rounded"
                                                    required
                                                >
                                                    {energySources.map(source => (
                                                        <option key={source} value={source}>{source}</option>
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
                                                    onChange={(e) => setNewCertificate({ ...newCertificate, kWhProduced: e.target.value })}
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
                                                    onChange={(e) => setNewCertificate({ ...newCertificate, location: e.target.value })}
                                                    className="w-full p-2 border border-gray-300 rounded"
                                                    placeholder="Location where energy was produced"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                        >
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
                                    <div className="mb-4">
                                        <p className="font-medium">Name</p>
                                        <p className="text-gray-600">{producerInfo?.name}</p>
                                    </div>
                                    <div className="mb-4">
                                        <p className="font-medium">Location</p>
                                        <p className="text-gray-600">{producerInfo?.location}</p>
                                    </div>
                                    <div className="mb-4">
                                        <p className="font-medium">Energy Types</p>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {(producerInfo?.energyTypes || []).map(type => (
                                                <span key={type} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                                                    {type}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <p className="font-medium">Capacity</p>
                                        <p className="text-gray-600">{producerInfo?.totalCapacityKW} kW</p>
                                    </div>
                                    <div className="mb-4">
                                        <p className="font-medium">Status</p>
                                        {producerInfo?.verified ? (
                                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                                                Verified Producer
                                            </span>
                                        ) : (
                                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm">
                                                Pending Verification
                                            </span>
                                        )}
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
                                                onChange={(e) => setProducerRegistration({ ...producerRegistration, name: e.target.value })}
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
                                                onChange={(e) => setProducerRegistration({ ...producerRegistration, location: e.target.value })}
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
                                                {energySources.map(source => (
                                                    <div key={source} className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            id={`energy-${source}`}
                                                            checked={producerRegistration.energyTypes.includes(source)}
                                                            onChange={(e) => handleEnergyTypeChange(source, e.target.checked)}
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
                                                onChange={(e) => setProducerRegistration({ ...producerRegistration, capacityKW: e.target.value })}
                                                className="w-full p-2 border border-gray-300 rounded"
                                                placeholder="Production capacity"
                                                required
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                        >
                                            Register
                                        </button>
                                    </form>
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
                                            onChange={(e) => setNewListing({ ...newListing, tokenAmount: e.target.value })}
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
                                            onChange={(e) => setNewListing({ ...newListing, pricePerToken: e.target.value })}
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
                                            onChange={(e) => setNewListing({ ...newListing, energySource: e.target.value })}
                                            className="w-full p-2 border border-gray-300 rounded"
                                            required
                                        >
                                            {energySources.map(source => (
                                                <option key={source} value={source}>{source}</option>
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
                                            onChange={(e) => setNewListing({ ...newListing, kWhRepresented: e.target.value })}
                                            className="w-full p-2 border border-gray-300 rounded"
                                            placeholder="Amount of energy in kWh"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                        disabled={parseFloat(balance) < parseFloat(newListing.tokenAmount)}
                                    >
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
    );
}
