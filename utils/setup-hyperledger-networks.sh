#!/bin/bash

# SCIMP Hyperledger Fabric Network Setup Script
# This script sets up three Hyperledger Fabric networks for SCIMP testing

echo "🚀 SCIMP Hyperledger Fabric Multi-Network Setup"
echo "=============================================="

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker and Docker Compose are available"

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p scimp-networks/{mainchain,sidechain-a,sidechain-b}
mkdir -p scimp-networks/{crypto-config,channel-artifacts,scripts}

# Network configuration
SCIMP_ROOT=$(pwd)/scimp-networks
COMPOSE_PROJECT_NAME="scimp"

echo "📂 Network root: $SCIMP_ROOT"

# Create crypto configuration
echo "🔐 Creating crypto configuration..."
cat > $SCIMP_ROOT/crypto-config/crypto-config.yaml << 'EOF'
OrdererOrgs:
  - Name: Orderer
    Domain: example.com
    Specs:
      - Hostname: orderer

PeerOrgs:
  - Name: Org1
    Domain: org1.example.com
    Template:
      Count: 2
    Users:
      Count: 1

  - Name: Org2
    Domain: org2.example.com
    Template:
      Count: 2
    Users:
      Count: 1
EOF

# Create configtx.yaml for channel configuration
echo "⚙️ Creating channel configuration..."
cat > $SCIMP_ROOT/channel-artifacts/configtx.yaml << 'EOF'
Organizations:
  - &OrdererOrg
      Name: OrdererOrg
      ID: OrdererMSP
      MSPDir: ../crypto-config/ordererOrganizations/example.com/msp
      Policies:
        Readers:
          Type: Signature
          Rule: "OR('OrdererMSP.member')"
        Writers:
          Type: Signature
          Rule: "OR('OrdererMSP.member')"
        Admins:
          Type: Signature
          Rule: "OR('OrdererMSP.admin')"

  - &Org1
      Name: Org1MSP
      ID: Org1MSP
      MSPDir: ../crypto-config/peerOrganizations/org1.example.com/msp
      Policies:
        Readers:
          Type: Signature
          Rule: "OR('Org1MSP.admin', 'Org1MSP.peer', 'Org1MSP.client')"
        Writers:
          Type: Signature
          Rule: "OR('Org1MSP.admin', 'Org1MSP.client')"
        Admins:
          Type: Signature
          Rule: "OR('Org1MSP.admin')"

  - &Org2
      Name: Org2MSP
      ID: Org2MSP
      MSPDir: ../crypto-config/peerOrganizations/org2.example.com/msp
      Policies:
        Readers:
          Type: Signature
          Rule: "OR('Org2MSP.admin', 'Org2MSP.peer', 'Org2MSP.client')"
        Writers:
          Type: Signature
          Rule: "OR('Org2MSP.admin', 'Org2MSP.client')"
        Admins:
          Type: Signature
          Rule: "OR('Org2MSP.admin')"

Capabilities:
  Channel: &ChannelCapabilities
    V2_0: true
  Orderer: &OrdererCapabilities
    V2_0: true
  Application: &ApplicationCapabilities
    V2_0: true

Application: &ApplicationDefaults
  Organizations:
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
  Capabilities:
    <<: *ApplicationCapabilities

Orderer: &OrdererDefaults
  OrdererType: solo
  Addresses:
    - orderer.example.com:7050
  BatchTimeout: 2s
  BatchSize:
    MaxMessageCount: 10
    AbsoluteMaxBytes: 99 MB
    PreferredMaxBytes: 512 KB
  Organizations:
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    BlockValidation:
      Type: ImplicitMeta
      Rule: "ANY Writers"

Channel: &ChannelDefaults
  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
  Capabilities:
    <<: *ChannelCapabilities

Profiles:
  ThreeOrgsOrdererGenesis:
    <<: *ChannelDefaults
    Orderer:
      <<: *OrdererDefaults
      Organizations:
        - *OrdererOrg
      Capabilities:
        <<: *OrdererCapabilities
    Consortiums:
      SampleConsortium:
        Organizations:
          - *Org1
          - *Org2

  ThreeOrgsChannel:
    Consortium: SampleConsortium
    <<: *ChannelDefaults
    Application:
      <<: *ApplicationDefaults
      Organizations:
        - *Org1
        - *Org2
      Capabilities:
        <<: *ApplicationCapabilities
EOF

# Create mainchain network (anchor registry)
echo "🌐 Creating mainchain network configuration..."
cat > $SCIMP_ROOT/mainchain/docker-compose.yml << 'EOF'
version: '2'

volumes:
  orderer.example.com:
  peer0.org1.example.com:
  peer1.org1.example.com:
  peer0.org2.example.com:
  peer1.org2.example.com:

networks:
  scimp-mainchain:

services:
  orderer.example.com:
    extends:
      file: ../scripts/docker-compose-base.yaml
      service: orderer.example.com
    container_name: orderer.example.com
    networks:
      - scimp-mainchain

  peer0.org1.example.com:
    container_name: peer0.org1.example.com
    extends:
      file: ../scripts/docker-compose-base.yaml
      service: peer0.org1.example.com
    networks:
      - scimp-mainchain

  peer1.org1.example.com:
    container_name: peer1.org1.example.com
    extends:
      file: ../scripts/docker-compose-base.yaml
      service: peer1.org1.example.com
    networks:
      - scimp-mainchain

  peer0.org2.example.com:
    container_name: peer0.org2.example.com
    extends:
      file: ../scripts/docker-compose-base.yaml
      service: peer0.org2.example.com
    networks:
      - scimp-mainchain

  peer1.org2.example.com:
    container_name: peer1.org2.example.com
    extends:
      file: ../scripts/docker-compose-base.yaml
      service: peer1.org2.example.com
    networks:
      - scimp-mainchain

  cli:
    container_name: cli
    image: hyperledger/fabric-tools:latest
    tty: true
    stdin_open: true
    environment:
      - GOPATH=/opt/gopath
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=cli
      - CORE_PEER_ADDRESS=peer0.org1.example.com:7051
      - CORE_PEER_LOCALMSPID=Org1MSP
      - CORE_PEER_TLS_ENABLED=false
      - CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric/peer
    command: /bin/bash
    volumes:
      - /var/run/:/host/var/run/
      - ./../chaincode/:/opt/gopath/src/github.com/chaincode
      - ../crypto-config:/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/
      - ../scripts:/opt/gopath/src/github.com/hyperledger/fabric/peer/scripts/
      - ../channel-artifacts:/opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts
    depends_on:
      - orderer.example.com
      - peer0.org1.example.com
      - peer1.org1.example.com
      - peer0.org2.example.com
      - peer1.org2.example.com
    networks:
      - scimp-mainchain
EOF

# Create sidechain A configuration
echo "🔗 Creating sidechain A network configuration..."
cat > $SCIMP_ROOT/sidechain-a/docker-compose.yml << 'EOF'
version: '2'

volumes:
  orderer-a.example.com:
  peer0.orga.example.com:
  peer1.orga.example.com:

networks:
  scimp-sidechain-a:

services:
  orderer-a.example.com:
    container_name: orderer-a.example.com
    image: hyperledger/fabric-orderer:latest
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_LISTENPORT=8050
      - ORDERER_GENERAL_GENESISMETHOD=file
      - ORDERER_GENERAL_GENESISFILE=/var/hyperledger/orderer/orderer.genesis.block
      - ORDERER_GENERAL_LOCALMSPID=OrdererMSP
      - ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp
      - ORDERER_GENERAL_TLS_ENABLED=false
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric
    command: orderer
    volumes:
      - ../channel-artifacts/genesis.block:/var/hyperledger/orderer/orderer.genesis.block
      - ../crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp:/var/hyperledger/orderer/msp
      - orderer-a.example.com:/var/hyperledger/production/orderer
    ports:
      - 8050:8050
    networks:
      - scimp-sidechain-a

  peer0.orga.example.com:
    container_name: peer0.orga.example.com
    image: hyperledger/fabric-peer:latest
    environment:
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=scimp_scimp-sidechain-a
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_TLS_ENABLED=false
      - CORE_PEER_GOSSIP_USELEADERELECTION=true
      - CORE_PEER_GOSSIP_ORGLEADER=false
      - CORE_PEER_PROFILE_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_PEER_ID=peer0.orga.example.com
      - CORE_PEER_ADDRESS=peer0.orga.example.com:8051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:8051
      - CORE_PEER_CHAINCODEADDRESS=peer0.orga.example.com:8052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:8052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer1.orga.example.com:8053
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.orga.example.com:8051
      - CORE_PEER_LOCALMSPID=Org1MSP
    volumes:
      - /var/run/:/host/var/run/
      - ../crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp:/etc/hyperledger/fabric/msp
      - peer0.orga.example.com:/var/hyperledger/production
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric/peer
    command: peer node start
    ports:
      - 8051:8051
    networks:
      - scimp-sidechain-a

  peer1.orga.example.com:
    container_name: peer1.orga.example.com
    image: hyperledger/fabric-peer:latest
    environment:
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=scimp_scimp-sidechain-a
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_TLS_ENABLED=false
      - CORE_PEER_GOSSIP_USELEADERELECTION=true
      - CORE_PEER_GOSSIP_ORGLEADER=false
      - CORE_PEER_PROFILE_ENABLED=true
      - CORE_PEER_ID=peer1.orga.example.com
      - CORE_PEER_ADDRESS=peer1.orga.example.com:8053
      - CORE_PEER_LISTENADDRESS=0.0.0.0:8053
      - CORE_PEER_CHAINCODEADDRESS=peer1.orga.example.com:8054
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:8054
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.orga.example.com:8051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer1.orga.example.com:8053
      - CORE_PEER_LOCALMSPID=Org1MSP
    volumes:
      - /var/run/:/host/var/run/
      - ../crypto-config/peerOrganizations/org1.example.com/peers/peer1.org1.example.com/msp:/etc/hyperledger/fabric/msp
      - peer1.orga.example.com:/var/hyperledger/production
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric/peer
    command: peer node start
    ports:
      - 8053:8053
    networks:
      - scimp-sidechain-a
EOF

# Create sidechain B configuration
echo "🔗 Creating sidechain B network configuration..."
cat > $SCIMP_ROOT/sidechain-b/docker-compose.yml << 'EOF'
version: '2'

volumes:
  orderer-b.example.com:
  peer0.orgb.example.com:
  peer1.orgb.example.com:

networks:
  scimp-sidechain-b:

services:
  orderer-b.example.com:
    container_name: orderer-b.example.com
    image: hyperledger/fabric-orderer:latest
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_LISTENPORT=9050
      - ORDERER_GENERAL_GENESISMETHOD=file
      - ORDERER_GENERAL_GENESISFILE=/var/hyperledger/orderer/orderer.genesis.block
      - ORDERER_GENERAL_LOCALMSPID=OrdererMSP
      - ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp
      - ORDERER_GENERAL_TLS_ENABLED=false
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric
    command: orderer
    volumes:
      - ../channel-artifacts/genesis.block:/var/hyperledger/orderer/orderer.genesis.block
      - ../crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp:/var/hyperledger/orderer/msp
      - orderer-b.example.com:/var/hyperledger/production/orderer
    ports:
      - 9050:9050
    networks:
      - scimp-sidechain-b

  peer0.orgb.example.com:
    container_name: peer0.orgb.example.com
    image: hyperledger/fabric-peer:latest
    environment:
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=scimp_scimp-sidechain-b
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_TLS_ENABLED=false
      - CORE_PEER_GOSSIP_USELEADERELECTION=true
      - CORE_PEER_GOSSIP_ORGLEADER=false
      - CORE_PEER_PROFILE_ENABLED=true
      - CORE_PEER_ID=peer0.orgb.example.com
      - CORE_PEER_ADDRESS=peer0.orgb.example.com:9051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:9051
      - CORE_PEER_CHAINCODEADDRESS=peer0.orgb.example.com:9052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:9052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer1.orgb.example.com:9053
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.orgb.example.com:9051
      - CORE_PEER_LOCALMSPID=Org2MSP
    volumes:
      - /var/run/:/host/var/run/
      - ../crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/msp:/etc/hyperledger/fabric/msp
      - peer0.orgb.example.com:/var/hyperledger/production
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric/peer
    command: peer node start
    ports:
      - 9051:9051
    networks:
      - scimp-sidechain-b

  peer1.orgb.example.com:
    container_name: peer1.orgb.example.com
    image: hyperledger/fabric-peer:latest
    environment:
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=scimp_scimp-sidechain-b
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_TLS_ENABLED=false
      - CORE_PEER_GOSSIP_USELEADERELECTION=true
      - CORE_PEER_GOSSIP_ORGLEADER=false
      - CORE_PEER_PROFILE_ENABLED=true
      - CORE_PEER_ID=peer1.orgb.example.com
      - CORE_PEER_ADDRESS=peer1.orgb.example.com:9053
      - CORE_PEER_LISTENADDRESS=0.0.0.0:9053
      - CORE_PEER_CHAINCODEADDRESS=peer1.orgb.example.com:9054
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:9054
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.orgb.example.com:9051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer1.orgb.example.com:9053
      - CORE_PEER_LOCALMSPID=Org2MSP
    volumes:
      - /var/run/:/host/var/run/
      - ../crypto-config/peerOrganizations/org2.example.com/peers/peer1.org2.example.com/msp:/etc/hyperledger/fabric/msp
      - peer1.orgb.example.com:/var/hyperledger/production
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric/peer
    command: peer node start
    ports:
      - 9053:9053
    networks:
      - scimp-sidechain-b
EOF

# Create base docker-compose configuration
echo "⚙️ Creating base docker-compose configuration..."
cat > $SCIMP_ROOT/scripts/docker-compose-base.yaml << 'EOF'
version: '2'

services:
  orderer.example.com:
    container_name: orderer.example.com
    image: hyperledger/fabric-orderer:latest
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_GENESISMETHOD=file
      - ORDERER_GENERAL_GENESISFILE=/var/hyperledger/orderer/orderer.genesis.block
      - ORDERER_GENERAL_LOCALMSPID=OrdererMSP
      - ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp
      - ORDERER_GENERAL_TLS_ENABLED=false
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric
    command: orderer
    volumes:
      - ../channel-artifacts/genesis.block:/var/hyperledger/orderer/orderer.genesis.block
      - ../crypto-config/ordererOrganizations/example.com/orderers/orderer.example.com/msp:/var/hyperledger/orderer/msp
      - orderer.example.com:/var/hyperledger/production/orderer
    ports:
      - 7050:7050

  peer0.org1.example.com:
    container_name: peer0.org1.example.com
    image: hyperledger/fabric-peer:latest
    environment:
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=scimp_scimp-mainchain
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_TLS_ENABLED=false
      - CORE_PEER_GOSSIP_USELEADERELECTION=true
      - CORE_PEER_GOSSIP_ORGLEADER=false
      - CORE_PEER_PROFILE_ENABLED=true
      - CORE_PEER_ID=peer0.org1.example.com
      - CORE_PEER_ADDRESS=peer0.org1.example.com:7051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:7051
      - CORE_PEER_CHAINCODEADDRESS=peer0.org1.example.com:7052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer1.org1.example.com:8051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org1.example.com:7051
      - CORE_PEER_LOCALMSPID=Org1MSP
    volumes:
      - /var/run/:/host/var/run/
      - ../crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp:/etc/hyperledger/fabric/msp
      - peer0.org1.example.com:/var/hyperledger/production
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric/peer
    command: peer node start
    ports:
      - 7051:7051

  peer1.org1.example.com:
    container_name: peer1.org1.example.com
    image: hyperledger/fabric-peer:latest
    environment:
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=scimp_scimp-mainchain
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_TLS_ENABLED=false
      - CORE_PEER_GOSSIP_USELEADERELECTION=true
      - CORE_PEER_GOSSIP_ORGLEADER=false
      - CORE_PEER_PROFILE_ENABLED=true
      - CORE_PEER_ID=peer1.org1.example.com
      - CORE_PEER_ADDRESS=peer1.org1.example.com:8051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:8051
      - CORE_PEER_CHAINCODEADDRESS=peer1.org1.example.com:8052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:8052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org1.example.com:7051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer1.org1.example.com:8051
      - CORE_PEER_LOCALMSPID=Org1MSP
    volumes:
      - /var/run/:/host/var/run/
      - ../crypto-config/peerOrganizations/org1.example.com/peers/peer1.org1.example.com/msp:/etc/hyperledger/fabric/msp
      - peer1.org1.example.com:/var/hyperledger/production
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric/peer
    command: peer node start
    ports:
      - 8051:8051

  peer0.org2.example.com:
    container_name: peer0.org2.example.com
    image: hyperledger/fabric-peer:latest
    environment:
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=scimp_scimp-mainchain
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_TLS_ENABLED=false
      - CORE_PEER_GOSSIP_USELEADERELECTION=true
      - CORE_PEER_GOSSIP_ORGLEADER=false
      - CORE_PEER_PROFILE_ENABLED=true
      - CORE_PEER_ID=peer0.org2.example.com
      - CORE_PEER_ADDRESS=peer0.org2.example.com:9051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:9051
      - CORE_PEER_CHAINCODEADDRESS=peer0.org2.example.com:9052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:9052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer1.org2.example.com:10051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org2.example.com:9051
      - CORE_PEER_LOCALMSPID=Org2MSP
    volumes:
      - /var/run/:/host/var/run/
      - ../crypto-config/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/msp:/etc/hyperledger/fabric/msp
      - peer0.org2.example.com:/var/hyperledger/production
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric/peer
    command: peer node start
    ports:
      - 9051:9051

  peer1.org2.example.com:
    container_name: peer1.org2.example.com
    image: hyperledger/fabric-peer:latest
    environment:
      - CORE_VM_ENDPOINT=unix:///host/var/run/docker.sock
      - CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=scimp_scimp-mainchain
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_TLS_ENABLED=false
      - CORE_PEER_GOSSIP_USELEADERELECTION=true
      - CORE_PEER_GOSSIP_ORGLEADER=false
      - CORE_PEER_PROFILE_ENABLED=true
      - CORE_PEER_ID=peer1.org2.example.com
      - CORE_PEER_ADDRESS=peer1.org2.example.com:10051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:10051
      - CORE_PEER_CHAINCODEADDRESS=peer1.org2.example.com:10052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:10052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org2.example.com:9051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer1.org2.example.com:10051
      - CORE_PEER_LOCALMSPID=Org2MSP
    volumes:
      - /var/run/:/host/var/run/
      - ../crypto-config/peerOrganizations/org2.example.com/peers/peer1.org2.example.com/msp:/etc/hyperledger/fabric/msp
      - peer1.org2.example.com:/var/hyperledger/production
    working_dir: /opt/gopath/src/github.com/hyperledger/fabric/peer
    command: peer node start
    ports:
      - 10051:10051
EOF

echo ""
echo "📋 NETWORK SETUP SUMMARY"
echo "========================"
echo "🌐 Mainchain Network:"
echo "   - Orderer: orderer.example.com:7050"
echo "   - Peer0 Org1: peer0.org1.example.com:7051"
echo "   - Peer1 Org1: peer1.org1.example.com:8051"
echo "   - Peer0 Org2: peer0.org2.example.com:9051"
echo "   - Peer1 Org2: peer1.org2.example.com:10051"
echo ""
echo "🔗 Sidechain A Network:"
echo "   - Orderer: orderer-a.example.com:8050"
echo "   - Peer0: peer0.orga.example.com:8051"
echo "   - Peer1: peer1.orga.example.com:8053"
echo ""
echo "🔗 Sidechain B Network:"
echo "   - Orderer: orderer-b.example.com:9050"
echo "   - Peer0: peer0.orgb.example.com:9051"
echo "   - Peer1: peer1.orgb.example.com:9053"
echo ""
echo "⚠️  NOTE: This setup requires Hyperledger Fabric Docker images."
echo "   Run: docker pull hyperledger/fabric-peer:latest"
echo "   Run: docker pull hyperledger/fabric-orderer:latest"
echo "   Run: docker pull hyperledger/fabric-tools:latest"
echo ""
echo "🚀 To start networks:"
echo "   cd scimp-networks/mainchain && docker-compose up -d"
echo "   cd scimp-networks/sidechain-a && docker-compose up -d"
echo "   cd scimp-networks/sidechain-b && docker-compose up -d"
echo ""
echo "✅ Network configuration complete!"
