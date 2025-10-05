# CardanoStream Development Guide

## Prerequisites

### Required Software

1. **Node.js 18+** ✅ (v22.16.0 detected)
2. **pnpm** - Fast, disk-space efficient package manager
   ```powershell
   npm install -g pnpm
   ```

3. **Aiken** - Cardano smart contract language
   ```powershell
   # Using Chocolatey
   choco install aiken

   # Or download from https://aiken-lang.org
   ```

4. **Git** - Version control
5. **Cardano CLI** (optional) - For testnet deployment

### Recommended Tools

- **Visual Studio Code** with extensions:
  - Aiken Language Support
  - TypeScript
  - Prettier
- **Blockfrost account** - Get API key from https://blockfrost.io

---

## Initial Setup

### 1. Clone and Install

```powershell
cd Project-Revolutionary
pnpm install
```

This will install dependencies for all packages in the monorepo.

### 2. Build All Packages

```powershell
pnpm build
```

This builds:
- Smart contracts (Aiken)
- TypeScript packages
- CDN node application

### 3. Setup Environment

```powershell
# Copy example env file
cp .env.example .env

# Edit with your values
notepad .env
```

Required variables:
- `BLOCKFROST_API_KEY` - Get from blockfrost.io
- `OPERATOR_ADDRESS` - Your Cardano testnet address
- `DATA_DIR` - Where to store content (default: ./data)

---

## Development Workflow

### Running the CDN Node

```powershell
# Development mode (auto-reload)
cd apps/cdn-node
pnpm dev

# Production mode
pnpm start
```

The node will:
1. Initialize storage at `./data`
2. Start libp2p peer on port 4001
3. Start HTTP server on port 3000
4. Begin discovering peers

### Testing Content Upload

```powershell
# Upload a file
curl -X POST -F "file=@test.jpg" http://localhost:3000/api/upload

# Response will include CID:
{
  "cid": "bafybei...",
  "url": "/content/bafybei...",
  "size": 102400
}

# Retrieve content
curl http://localhost:3000/content/bafybei...
```

### Building Smart Contracts

```powershell
cd contracts/cardano

# Build contracts
aiken build

# Run tests
aiken check

# Generate blueprints
aiken blueprint convert
```

### Working with P2P Network

```powershell
cd packages/p2p-network

# Build
pnpm build

# Run tests
pnpm test

# Watch mode
pnpm dev
```

---

## Project Structure Explained

### Smart Contracts (`contracts/cardano/`)

**storage_payment.ak**
- Handles storage agreements
- Enforces SLA penalties
- Manages refunds

**bandwidth_payment.ak**
- Payment channels for content delivery
- Micro-transaction settlements
- Dispute resolution

**node_registry.ak**
- Node registration and staking
- Reputation management
- Slashing for violations

### Packages

**@cardanostream/p2p-network**
- libp2p node implementation
- Content routing protocol
- Peer discovery (mDNS, DHT, Bootstrap)
- Replication protocol
- Bandwidth metering

**@cardanostream/storage**
- Content-addressed storage (CID)
- Erasure coding (Reed-Solomon)
- Merkle proofs for verification
- Garbage collection
- Metadata indexing

**@cardanostream/cardano-sdk**
- Lucid Evolution wrapper
- Smart contract interactions
- Payment channel management
- Node registration helpers

### Applications

**apps/cdn-node**
- Production CDN node software
- HTTP gateway (Express)
- Content upload/retrieval
- Storage proof generation
- Network statistics

---

## Common Tasks

### Adding a New Package

```powershell
# Create package directory
mkdir packages/my-package
cd packages/my-package

# Initialize
pnpm init

# Add to workspace (already configured in pnpm-workspace.yaml)

# Build configuration
# Create tsconfig.json, package.json
```

### Deploying Contracts to Testnet

```powershell
cd contracts/cardano

# Build
aiken build

# Generate addresses (requires Cardano CLI)
cardano-cli address build \
  --payment-script-file plutus.json \
  --testnet-magic 1 \
  --out-file contract.addr

# Deploy via Lucid in SDK
```

### Running Multiple Nodes

```powershell
# Terminal 1: Node A
$env:PORT = "3000"
$env:DATA_DIR = "./data-node-a"
pnpm start

# Terminal 2: Node B
$env:PORT = "3001"
$env:DATA_DIR = "./data-node-b"
$env:BOOTSTRAP_PEERS = "/ip4/127.0.0.1/tcp/4001/p2p/{PEER_ID_FROM_NODE_A}"
pnpm start
```

### Debugging P2P Connections

```powershell
# Check peer connections
curl http://localhost:3000/api/node/stats

# Enable debug logs
$env:LOG_LEVEL = "debug"
pnpm dev
```

---

## Testing

### Unit Tests

```powershell
# Test all packages
pnpm test

# Test specific package
cd packages/storage
pnpm test
```

### Integration Tests

```powershell
# Start node in background
pnpm dev &

# Run integration tests
cd test
node integration.test.js
```

### Smart Contract Tests

```powershell
cd contracts/cardano
aiken check -v
```

---

## Performance Optimization

### Enable Erasure Coding

```env
ERASURE_CODING=true
```

This spreads content across shards with parity, allowing recovery from partial data.

### Tune Connection Limits

```env
MAX_CONNECTIONS=200  # Higher for more peers
```

### Storage Quota

```env
MAX_STORAGE_GB=500  # Adjust based on available disk
```

---

## Troubleshooting

### "Module not found" errors

```powershell
# Rebuild all packages
pnpm build
```

### libp2p connection issues

- Check firewall allows ports 4001, 4002
- Verify bootstrap peers are reachable
- Try enabling mDNS for local discovery

### Smart contract build fails

- Ensure Aiken is installed: `aiken --version`
- Check syntax in `.ak` files
- Verify dependencies in `aiken.toml`

### Out of disk space

```powershell
# Run garbage collection
curl -X POST http://localhost:3000/api/gc
```

---

## Next Steps

1. **Deploy to Testnet**: Register your node on Cardano preprod
2. **Join Network**: Connect to other CardanoStream nodes
3. **Build Dashboard**: Create web UI for management
4. **Add Features**: Video streaming, edge functions, etc.

---

## Resources

- [Aiken Documentation](https://aiken-lang.org)
- [libp2p Docs](https://docs.libp2p.io)
- [Cardano Developer Portal](https://developers.cardano.org)
- [Lucid Evolution](https://github.com/Anastasia-Labs/lucid-evolution)
- [TASKS.md](./TASKS.md) - Full project roadmap

---

**Questions?** Check the main README.md or open an issue.
