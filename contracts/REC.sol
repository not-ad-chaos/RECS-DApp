// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract REC {
    struct Certificate {
        uint256 id;
        uint256 energyAmount;
        string energySource;
        address owner;
        bool isForSale;
        uint256 price;
    }

    mapping(uint256 => Certificate) public certificates;
    uint256 private certificateCount = 0;


    event CertificateCreated(uint256 id, uint256 energyAmount, string energySource, address owner);
    event CertificateForSale(uint256 id, uint256 price);
    event CertificateSold(uint256 id, address from, address to, uint256 price);

    function createCertificate(uint256 energyAmount, string memory energySource) public {
        certificateCount++;

        certificates[certificateCount] = Certificate({
            id: certificateCount,
            energyAmount: energyAmount,
            energySource: energySource,
            owner: msg.sender,
            isForSale: false,
            price: 0
        });

        emit CertificateCreated(certificateCount, energyAmount, energySource, msg.sender);
    }

    function listForSale(uint256 certificateId, uint256 price) public {
        Certificate storage cert = certificates[certificateId];
        require(cert.owner == msg.sender, "Only the owner can sell a certificate");
        require(cert.id > 0, "Certificate does not exist");

        cert.isForSale = true;
        cert.price = price;

        emit CertificateForSale(certificateId, price);
    }

    function buyCertificate(uint256 certificateId) public payable {
        Certificate storage cert = certificates[certificateId];

        require(cert.id > 0, "Certificate does not exist");
        require(cert.isForSale, "Certificate is not for sale");
        require(msg.value >= cert.price, "Insufficient funds sent");
        require(cert.owner != msg.sender, "You already own this certificate");

        address previousOwner = cert.owner;

        cert.owner = msg.sender;
        cert.isForSale = false;

        payable(previousOwner).transfer(msg.value);

        emit CertificateSold(certificateId, previousOwner, msg.sender, msg.value);
    }

    function getMyCertificates() public view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= certificateCount; i++) {
            if (certificates[i].owner == msg.sender) {
                count++;
            }
        }

        uint256[] memory ownedCertificates = new uint256[](count);
        uint256 index = 0;

        for (uint256 i = 1; i <= certificateCount; i++) {
            if (certificates[i].owner == msg.sender) {
                ownedCertificates[index] = i;
                index++;
            }
        }

        return ownedCertificates;
    }

    function getAvailableCertificates() public view returns (uint256[] memory) {

        uint256 count = 0;
        for (uint256 i = 1; i <= certificateCount; i++) {
            if (certificates[i].isForSale) {
                count++;
            }
        }


        uint256[] memory availableCertificates = new uint256[](count);
        uint256 index = 0;

        for (uint256 i = 1; i <= certificateCount; i++) {
            if (certificates[i].isForSale) {
                availableCertificates[index] = i;
                index++;
            }
        }

        return availableCertificates;
    }

    function getCertificateDetails(uint256 certificateId) public view returns (
        uint256 id,
        uint256 energyAmount,
        string memory energySource,
        address owner,
        bool isForSale,
        uint256 price
    ) {
        Certificate memory cert = certificates[certificateId];
        require(cert.id > 0, "Certificate does not exist");

        return (
            cert.id,
            cert.energyAmount,
            cert.energySource,
            cert.owner,
            cert.isForSale,
            cert.price
        );
    }
}
