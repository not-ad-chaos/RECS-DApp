// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./EnergyMarketplace.sol";

contract RenewableEnergyCertification {
    struct Producer {
        address wallet;
        string name;
        string location;
        string[] energyTypes;
        uint256 totalCapacityKW;
        bool verified;
        uint256 registrationTime;
    }

    struct AuditReport {
        uint256 id;
        address producer;
        address auditor;
        uint256 timestamp;
        string reportUri;
        string comments;
        bool passed;
    }

    mapping(address => Producer) public producers;
    mapping(address => bool) public registeredProducers;
    mapping(address => bool) public authorizedAuditors;
    mapping(uint256 => AuditReport) public auditReports;

    address public admin;
    uint256 public auditReportCount;
    EnergyMarketplace public marketplace;

    event ProducerRegistered(address indexed producerAddress, string name, uint256 capacityKW);
    event ProducerVerified(address indexed producerAddress, address indexed auditor);
    event AuditorAuthorized(address indexed auditor);
    event AuditorRevoked(address indexed auditor);
    event AuditReportFiled(uint256 indexed reportId, address indexed producer, address indexed auditor, bool passed);

    constructor(address _marketplaceAddress) {
        admin = msg.sender;
        marketplace = EnergyMarketplace(_marketplaceAddress);
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyAuditor() {
        require(authorizedAuditors[msg.sender], "Only authorized auditors can perform this action");
        _;
    }

    function registerProducer(
        string memory name,
        string memory location,
        string[] memory energyTypes,
        uint256 capacityKW
    ) public {
        require(!registeredProducers[msg.sender], "Producer already registered");

        producers[msg.sender] = Producer({
            wallet: msg.sender,
            name: name,
            location: location,
            energyTypes: energyTypes,
            totalCapacityKW: capacityKW,
            verified: false,
            registrationTime: block.timestamp
        });

        registeredProducers[msg.sender] = true;

        emit ProducerRegistered(msg.sender, name, capacityKW);
    }

    function authorizeAuditor(address auditor) public onlyAdmin {
        authorizedAuditors[auditor] = true;
        emit AuditorAuthorized(auditor);
    }

    function revokeAuditor(address auditor) public onlyAdmin {
        authorizedAuditors[auditor] = false;
        emit AuditorRevoked(auditor);
    }

    function verifyProducer(address producerAddress) public onlyAuditor {
        require(registeredProducers[producerAddress], "Producer not registered");
        producers[producerAddress].verified = true;
        emit ProducerVerified(producerAddress, msg.sender);
    }

    function fileAuditReport(
        address producerAddress,
        string memory reportUri,
        string memory comments,
        bool passed
    ) public onlyAuditor returns (uint256) {
        require(registeredProducers[producerAddress], "Producer not registered");

        auditReportCount++;

        auditReports[auditReportCount] = AuditReport({
            id: auditReportCount,
            producer: producerAddress,
            auditor: msg.sender,
            timestamp: block.timestamp,
            reportUri: reportUri,
            comments: comments,
            passed: passed
        });

        if (passed) {
            producers[producerAddress].verified = true;
        }

        emit AuditReportFiled(auditReportCount, producerAddress, msg.sender, passed);
        return auditReportCount;
    }

    function submitEnergyCertificate(
        string memory energySource,
        uint256 kWhProduced,
        string memory location
    ) public returns (uint256) {
        require(registeredProducers[msg.sender], "Must be a registered producer");
        require(producers[msg.sender].verified, "Producer must be verified");

        // Check if the energy source is valid
        bool validEnergySource = false;
        for (uint i = 0; i < producers[msg.sender].energyTypes.length; i++) {
            if (keccak256(abi.encodePacked(producers[msg.sender].energyTypes[i])) == 
                keccak256(abi.encodePacked(energySource))) {
                validEnergySource = true;
                break;
            }
        }
        require(validEnergySource, "Energy source not registered for this producer");

        // Call the marketplace contract to create a certificate
        try marketplace.createCertificate(energySource, kWhProduced, location) returns (uint256 certificateId) {
            return certificateId;
        } catch {
            revert("Failed to create certificate in marketplace");
        }
    }

    function transferOwnership(address newAdmin) public onlyAdmin {
        admin = newAdmin;
    }
}
