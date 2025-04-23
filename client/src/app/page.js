"use client"

import { useState, useEffect } from 'react';
import { BrowserProvider, Contract, formatEther, parseEther, id } from 'ethers';
import SimpleRECABI from './REC.json';

export default function Home() {

  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [myCertificates, setMyCertificates] = useState([]);
  const [availableCertificates, setAvailableCertificates] = useState([]);
  const [energyAmount, setEnergyAmount] = useState('');
  const [energySource, setEnergySource] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [selectedCertId, setSelectedCertId] = useState('');


  async function connectWallet() {
    try {
      setLoading(true);
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      setAccount(accounts[0]);

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contractAddress = '0x7aCCB84c044f4446d29638CDc503F3A8EAddD8C5';

      const recContract = new Contract(
        contractAddress,
        SimpleRECABI.abi,
        signer
      );

      setContract(recContract);
      setLoading(false);

      fetchCertificates(recContract, accounts[0]);

      window.ethereum.on('accountsChanged', (accounts) => {
        setAccount(accounts[0]);
        fetchCertificates(recContract, accounts[0]);
      });
    } catch (error) {
      console.error("Error connecting to wallet:", error);
      setLoading(false);
    }
  }


  async function fetchCertificates(contractInstance, userAccount) {
    try {
      const myIds = await contractInstance.getMyCertificates();
      const availableIds = await contractInstance.getAvailableCertificates();

      const fetchedMyCerts = [];
      const fetchedAvailableCerts = [];


      for (let i = 0; i < myIds.length; i++) {
        const cert = await contractInstance.getCertificateDetails(myIds[i]);
        fetchedMyCerts.push({
          id: cert.id.toString(),
          energyAmount: cert.energyAmount.toString(),
          energySource: cert.energySource,
          isForSale: cert.isForSale,
          price: formatEther(cert.price)
        });
      }


      for (let i = 0; i < availableIds.length; i++) {
        const cert = await contractInstance.getCertificateDetails(availableIds[i]);

        if (cert.owner.toLowerCase() !== userAccount.toLowerCase()) {
          fetchedAvailableCerts.push({
            id: cert.id.toString(),
            energyAmount: cert.energyAmount.toString(),
            energySource: cert.energySource,
            owner: cert.owner,
            price: formatEther(cert.price)
          });
        }
      }

      setMyCertificates(fetchedMyCerts);
      setAvailableCertificates(fetchedAvailableCerts);
    } catch (error) {
      console.error("Error fetching certificates:", error);
    }
  }


  async function createCertificate(e) {
    e.preventDefault();
    if (!energyAmount || !energySource) return;

    try {
      setLoading(true);
    console.log(contract)
      const tx = await contract.createCertificate(energyAmount, energySource);
      await tx.wait();


      setEnergyAmount('');
      setEnergySource('');


      fetchCertificates(contract, account);
      setLoading(false);
    } catch (error) {
      console.error("Error creating certificate:", error);
      setLoading(false);
    }
  }


  async function listForSale(e) {
    e.preventDefault();
    if (!selectedCertId || !salePrice) return;

    try {
      setLoading(true);
      const priceInWei = parseEther(salePrice);
      const tx = await contract.listForSale(selectedCertId, priceInWei);
      await tx.wait();


      setSelectedCertId('');
      setSalePrice('');


      fetchCertificates(contract, account);
      setLoading(false);
    } catch (error) {
      console.error("Error listing certificate:", error);
      setLoading(false);
    }
  }


  async function buyCertificate(id, price) {
    try {
      setLoading(true);
      const tx = await contract.buyCertificate(id, {
        value: parseEther(price)
      });
      await tx.wait();


      fetchCertificates(contract, account);
      setLoading(false);
    } catch (error) {
      console.error("Error buying certificate:", error);
      setLoading(false);
    }
  }


  useEffect(() => {
    if (window.ethereum) {
      connectWallet();
    } else {
      setLoading(false);
      alert("Please install MetaMask to use this application");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Renewable Energy Certificate Marketplace</h1>

        {!account ? (
          <div className="text-center">
            <button
              onClick={connectWallet}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              Connect Wallet
            </button>
          </div>
        ) : (
          <div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Connected Account</h2>
              <p className="font-mono break-all">{account}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Create Certificate</h2>
                <form onSubmit={createCertificate}>
                  <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Energy Amount (kWh)</label>
                    <input
                      type="number"
                      value={energyAmount}
                      onChange={(e) => setEnergyAmount(e.target.value)}
                      className="w-full px-3 py-2 border rounded"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Energy Source</label>
                    <select
                      value={energySource}
                      onChange={(e) => setEnergySource(e.target.value)}
                      className="w-full px-3 py-2 border rounded"
                      required
                    >
                      <option value="">Select Source</option>
                      <option value="solar">Solar</option>
                      <option value="wind">Wind</option>
                      <option value="hydro">Hydro</option>
                      <option value="biomass">Biomass</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded w-full"
                  >
                    {loading ? 'Processing...' : 'Create Certificate'}
                  </button>
                </form>
              </div>


              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">List Certificate for Sale</h2>
                <form onSubmit={listForSale}>
                  <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Select Certificate</label>
                    <select
                      value={selectedCertId}
                      onChange={(e) => setSelectedCertId(e.target.value)}
                      className="w-full px-3 py-2 border rounded"
                      required
                    >
                      <option value="">Select Certificate</option>
                      {myCertificates
                        .filter(cert => !cert.isForSale)
                        .map(cert => (
                          <option key={cert.id} value={cert.id}>
                            ID: {cert.id} - {cert.energyAmount} kWh ({cert.energySource})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-gray-700 mb-2">Price (ETH)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      className="w-full px-3 py-2 border rounded"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded w-full"
                  >
                    {loading ? 'Processing...' : 'List for Sale'}
                  </button>
                </form>
              </div>
            </div>


            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">My Certificates</h2>
              {myCertificates.length === 0 ? (
                <p className="text-gray-500">You don't own any certificates yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left">ID</th>
                        <th className="px-4 py-2 text-left">Energy</th>
                        <th className="px-4 py-2 text-left">Source</th>
                        <th className="px-4 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myCertificates.map(cert => (
                        <tr key={cert.id} className="border-t">
                          <td className="px-4 py-2">{cert.id}</td>
                          <td className="px-4 py-2">{cert.energyAmount} kWh</td>
                          <td className="px-4 py-2">{cert.energySource}</td>
                          <td className="px-4 py-2">
                            {cert.isForSale ? (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm">
                                For Sale ({cert.price} ETH)
                              </span>
                            ) : (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                                Owned
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Certificates for Sale</h2>
              {availableCertificates.length === 0 ? (
                <p className="text-gray-500">No certificates available for purchase.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr>
                        <th className="px-4 py-2 text-left">ID</th>
                        <th className="px-4 py-2 text-left">Energy</th>
                        <th className="px-4 py-2 text-left">Source</th>
                        <th className="px-4 py-2 text-left">Price (ETH)</th>
                        <th className="px-4 py-2 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableCertificates.map(cert => (
                        <tr key={cert.id} className="border-t">
                          <td className="px-4 py-2">{cert.id}</td>
                          <td className="px-4 py-2">{cert.energyAmount} kWh</td>
                          <td className="px-4 py-2">{cert.energySource}</td>
                          <td className="px-4 py-2">{cert.price}</td>
                          <td className="px-4 py-2">
                            <button
                              onClick={() => buyCertificate(cert.id, cert.price)}
                              disabled={loading}
                              className="bg-purple-500 hover:bg-purple-600 text-white font-bold py-1 px-3 rounded text-sm"
                            >
                              Buy
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
