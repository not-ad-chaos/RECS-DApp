// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract EnergyMarketplace {
    struct EnergyListing {
        uint256 id;
        address seller;
        uint256 tokenAmount;
        uint256 pricePerToken;
        string energySource;
        uint256 kWhRepresented;
        bool active;
        uint256 timestamp;
    }

    struct Certificate {
        uint256 id;
        address producer;
        string energySource;
        uint256 kWhProduced;
        uint256 tokenAmount;
        uint256 timestamp;
        string location;
        bool verified;
    }

    EnergyToken public tokenContract;
    uint256 public listingCount;
    uint256 public certificateCount;
    uint256 public platformFeePercent = 2; // 2% fee
    address public admin;

    mapping(uint256 => EnergyListing) public listings;
    mapping(uint256 => Certificate) public certificates;
    mapping(address => bool) public verifiers;

    event ListingCreated(uint256 indexed id, address indexed seller, uint256 tokenAmount, uint256 pricePerToken);
    event ListingPurchased(uint256 indexed id, address indexed buyer, address indexed seller, uint256 tokenAmount, uint256 totalPrice);
    event ListingCancelled(uint256 indexed id, address indexed seller);
    event CertificateCreated(uint256 indexed id, address indexed producer, string energySource, uint256 kWhProduced);
    event CertificateVerified(uint256 indexed id, address indexed verifier);

    constructor(address _tokenAddress) {
        tokenContract = EnergyToken(_tokenAddress);
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyVerifier() {
        require(verifiers[msg.sender], "Only authorized verifiers can perform this action");
        _;
    }

    function addVerifier(address verifier) public onlyAdmin {
        verifiers[verifier] = true;
    }

    function removeVerifier(address verifier) public onlyAdmin {
        verifiers[verifier] = false;
    }

    function createCertificate(
        string memory energySource,
        uint256 kWhProduced,
        string memory location
    ) public returns (uint256) {
        certificateCount++;

        certificates[certificateCount] = Certificate({
            id: certificateCount,
            producer: msg.sender,
            energySource: energySource,
            kWhProduced: kWhProduced,
            tokenAmount: 0, // Will be set when verified
            timestamp: block.timestamp,
            location: location,
            verified: false
        });

        emit CertificateCreated(certificateCount, msg.sender, energySource, kWhProduced);
        return certificateCount;
    }

    function verifyCertificate(uint256 certificateId, uint256 tokenAmount) public onlyVerifier {
        Certificate storage cert = certificates[certificateId];
        require(!cert.verified, "Certificate already verified");

        // Determine energy source enum
        EnergyToken.EnergySource energySourceEnum;
        if (keccak256(abi.encodePacked(cert.energySource)) == keccak256(abi.encodePacked("Solar"))) {
            energySourceEnum = EnergyToken.EnergySource.Solar;
        } else if (keccak256(abi.encodePacked(cert.energySource)) == keccak256(abi.encodePacked("Wind"))) {
            energySourceEnum = EnergyToken.EnergySource.Wind;
        } else if (keccak256(abi.encodePacked(cert.energySource)) == keccak256(abi.encodePacked("Hydro"))) {
            energySourceEnum = EnergyToken.EnergySource.Hydro;
        } else if (keccak256(abi.encodePacked(cert.energySource)) == keccak256(abi.encodePacked("Biomass"))) {
            energySourceEnum = EnergyToken.EnergySource.Biomass;
        } else if (keccak256(abi.encodePacked(cert.energySource)) == keccak256(abi.encodePacked("Geothermal"))) {
            energySourceEnum = EnergyToken.EnergySource.Geothermal;
        } else {
            revert("Invalid energy source");
        }

        // Mint tokens to the producer
        tokenContract.mint(cert.producer, tokenAmount, energySourceEnum, cert.kWhProduced);

        // Update certificate
        cert.verified = true;
        cert.tokenAmount = tokenAmount;

        emit CertificateVerified(certificateId, msg.sender);
    }

    function createListing(uint256 tokenAmount, uint256 pricePerToken, string memory energySource, uint256 kWhRepresented) public {
        require(tokenAmount > 0, "Token amount must be greater than 0");
        require(pricePerToken > 0, "Price per token must be greater than 0");

        // Transfer tokens from seller to this contract
        require(
            tokenContract.transferFrom(msg.sender, address(this), tokenAmount),
            "Token transfer failed"
        );

        listingCount++;

        listings[listingCount] = EnergyListing({
            id: listingCount,
            seller: msg.sender,
            tokenAmount: tokenAmount,
            pricePerToken: pricePerToken,
            energySource: energySource,
            kWhRepresented: kWhRepresented,
            active: true,
            timestamp: block.timestamp
        });

        emit ListingCreated(listingCount, msg.sender, tokenAmount, pricePerToken);
    }

    function buyListing(uint256 listingId) public payable {
        EnergyListing storage listing = listings[listingId];
        require(listing.active, "Listing is not active");

        uint256 totalPrice = listing.tokenAmount * listing.pricePerToken;
        require(msg.value >= totalPrice, "Insufficient payment");

        // Calculate platform fee
        uint256 platformFee = (totalPrice * platformFeePercent) / 100;
        uint256 sellerPayment = totalPrice - platformFee;

        // Transfer tokens to buyer
        require(
            tokenContract.transfer(msg.sender, listing.tokenAmount),
            "Token transfer failed"
        );

        // Transfer ETH to seller
        payable(listing.seller).transfer(sellerPayment);

        // Refund excess payment
        if (msg.value > totalPrice) {
            payable(msg.sender).transfer(msg.value - totalPrice);
        }

        // Mark listing as inactive
        listing.active = false;

        emit ListingPurchased(listingId, msg.sender, listing.seller, listing.tokenAmount, totalPrice);
    }

    function cancelListing(uint256 listingId) public {
        EnergyListing storage listing = listings[listingId];
        require(listing.seller == msg.sender, "Only seller can cancel listing");
        require(listing.active, "Listing is not active");

        // Return tokens to seller
        require(
            tokenContract.transfer(listing.seller, listing.tokenAmount),
            "Token transfer failed"
        );

        // Mark listing as inactive
        listing.active = false;

        emit ListingCancelled(listingId, msg.sender);
    }

    function withdrawFees() public onlyAdmin {
        payable(admin).transfer(address(this).balance);
    }

    function updatePlatformFee(uint256 newFeePercent) public onlyAdmin {
        require(newFeePercent <= 10, "Fee cannot exceed 10%");
        platformFeePercent = newFeePercent;
    }
}

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
        marketController = newController;
    }
}


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

        return marketplace.createCertificate(energySource, kWhProduced, location);
    }

    function transferOwnership(address newAdmin) public onlyAdmin {
        admin = newAdmin;
    }
}
