#!/bin/bash

# SCIMP Chaincode Approval and Commit - Quick Fix
set -e

echo "🚀 SCIMP Chaincode Approval & Commit"
echo "===================================="

CHANNEL_NAME="mychannel"

echo "🔍 Getting package IDs..."
ANCHOR_PACKAGE_ID=$(sudo docker exec cli peer lifecycle chaincode queryinstalled | grep anchor-registry_1.0 | cut -d' ' -f3 | cut -d',' -f1)
echo "Anchor Registry Package ID: $ANCHOR_PACKAGE_ID"

echo ""
echo "👍 Approving chaincode for Org1..."

# Approve for Org1 with simple policy
sudo docker exec -e CORE_PEER_LOCALMSPID="Org1MSP" \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 \
    cli peer lifecycle chaincode approveformyorg \
    -o orderer.example.com:7050 \
    --channelID $CHANNEL_NAME \
    --name anchor-registry \
    --version 1.0 \
    --package-id $ANCHOR_PACKAGE_ID \
    --sequence 1 \
    --signature-policy "OR('Org1MSP.member','Org2MSP.member')" \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

echo ""
echo "👍 Approving chaincode for Org2..."

# Approve for Org2
sudo docker exec -e CORE_PEER_LOCALMSPID="Org2MSP" \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.org2.example.com:9051 \
    cli peer lifecycle chaincode approveformyorg \
    -o orderer.example.com:7050 \
    --channelID $CHANNEL_NAME \
    --name anchor-registry \
    --version 1.0 \
    --package-id $ANCHOR_PACKAGE_ID \
    --sequence 1 \
    --signature-policy "OR('Org1MSP.member','Org2MSP.member')" \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem

echo ""
echo "📋 Checking commit readiness..."

sudo docker exec cli peer lifecycle chaincode checkcommitreadiness \
    --channelID $CHANNEL_NAME \
    --name anchor-registry \
    --version 1.0 \
    --sequence 1 \
    --signature-policy "OR('Org1MSP.member','Org2MSP.member')" \
    --output json

echo ""
echo "📝 Committing chaincode..."

sudo docker exec -e CORE_PEER_LOCALMSPID="Org1MSP" \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp \
    -e CORE_PEER_ADDRESS=peer0.org1.example.com:7051 \
    cli peer lifecycle chaincode commit \
    -o orderer.example.com:7050 \
    --channelID $CHANNEL_NAME \
    --name anchor-registry \
    --version 1.0 \
    --sequence 1 \
    --signature-policy "OR('Org1MSP.member','Org2MSP.member')" \
    --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem \
    --peerAddresses peer0.org1.example.com:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt \
    --peerAddresses peer0.org2.example.com:9051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt

echo ""
echo "🎯 Verifying deployment..."
sudo docker exec cli peer lifecycle chaincode querycommitted --channelID $CHANNEL_NAME

echo ""
echo "✅ SUCCESS! Chaincode is deployed and ready for transactions!"
