// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "./EnergyToken.sol";
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
