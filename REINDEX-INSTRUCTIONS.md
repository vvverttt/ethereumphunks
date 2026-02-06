# Reindexing QuantumPhunks Collection

Your QuantumPhunks collection is an **Ethscriptions collection** - the images are stored on-chain in Ethereum transaction calldata!

To populate the ownership data and make the collection fully functional, follow these steps:

## Step 1: Restart the Indexer

The indexer needs to be restarted with the new API key configuration.

1. **Stop the current indexer** (if running):
   - Find the terminal window where the indexer is running
   - Press `Ctrl+C` to stop it

2. **Start the indexer again**:
   ```bash
   cd indexer
   yarn run start
   ```

## Step 2: Run the Reindex Script

Once the indexer is running, open a NEW terminal and run:

```bash
cd C:\Users\alber\OneDrive\Desktop\market\ethereumphunks
node reindex-collection.js
```

This will:
- Fetch all 4,337 QuantumPhunks transaction hashes from the database
- Call the indexer to reindex each transaction
- Process them in batches of 10 for efficiency
- Show progress updates

**Expected time:** ~10-20 minutes (depending on RPC speed)

## Step 3: Refresh the Marketplace

Once reindexing is complete:
1. Go to http://localhost:9000/cryptophunksv67
2. Hard refresh: `Ctrl+Shift+R`
3. You should now see:
   - Owner information populated
   - Items available for sale
   - Full attribute filtering
   - Recent activity feed

## What This Does

The indexer will:
- Look up each transaction hash on Ethereum mainnet
- Extract the current owner from on-chain data
- Track all transfer events
- Populate the `owner` field in the database
- Enable trading functionality

## Monitoring Progress

Watch the console output - it will show:
- Number of transactions processed
- Success/error counts
- Final summary with owned items count

Enjoy your fully functional Ethscriptions marketplace!
