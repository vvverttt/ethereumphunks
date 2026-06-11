import { Inject, Injectable, Logger } from '@nestjs/common';

import { UtilityService } from '@/modules/shared/services/utility.service';
import { Web3Service } from '@/modules/shared/services/web3.service';
import { StorageService } from '@/modules/storage/storage.service';

import { esip1Abi, esip2Abi } from '@/abi/EthscriptionsProtocol';
import * as esips from '@/constants/esips';

import { auctionAbiV2, auctionAddressL1, auctionAddressesL1, chain, evolveAddressL1, lotteryAddressesL1, marketAbiL1, marketAddressL1, marketAddressesL1, mutationAbi, oldMarketAddressL1, pointsAbiL1, pointsAddressL1 } from '@/constants/ethereum';

import { AttributeItem, Ethscription, Event } from '@/modules/storage/models/db';

import { DecodeEventLogReturnType, Log, Transaction, TransactionReceipt, decodeEventLog, hexToString, zeroAddress } from 'viem';

import { mkdir, writeFile } from 'fs/promises';
import { createHash } from 'crypto';

@Injectable()
export class EthscriptionsService {

  constructor(
    @Inject('WEB3_SERVICE_L1') private readonly web3SvcL1: Web3Service,
    private readonly storageSvc: StorageService,
    private readonly utilitySvc: UtilityService
  ) {}

  /**
   * Processes the ethscriptions for a given transaction.
   *
   * @param transaction - The transaction object.
   * @param receipt - The transaction receipt object.
   * @param createdAt - The creation date of the transaction.
   * @returns An array of events generated from the transaction.
   */
  async processEthscriptionsEvents(
    transaction: Transaction,
    receipt: TransactionReceipt,
    createdAt: Date
  ) {
    const { input } = transaction;
    const events: Event[] = [];

    // Get the data from the transaction
    // Remove null bytes from the string
    const stringData = hexToString(input.toString() as `0x${string}`);
    const cleanedString = stringData.replace(/\x00/g, '');

    // Check if possible ethPhunk creation
    const possibleEthPhunk =
      cleanedString.startsWith('data:image/svg+xml,') ||
      cleanedString.startsWith('data:image/png;base64,') ||
      cleanedString.startsWith('data:image/gif;base64,');

    if (possibleEthPhunk) {
      const sha = createHash('sha256').update(cleanedString).digest('hex');

      // Check if the sha exists
      const attributesData = await this.storageSvc.checkIsCuratedCollection(sha);
      if (!attributesData) return;

      // Check if its a duplicate (already been inscribed)
      const isDuplicate = await this.storageSvc.checkEthscriptionExistsBySha(sha);
      if (isDuplicate) return

      Logger.debug('Processing ethscription', transaction.hash);
      const event = await this.processEthscriptionCreationEvent(transaction as Transaction, createdAt, attributesData);
      return [event];
    }

    // Check if possible transfer
    // Skip auction contracts — their event processors handle ownership + activity
    // Lottery deposits are processed here; prize awards are handled by lottery event processor
    const possibleTransfer = this.utilitySvc.possibleTransfer(input);
    const toAddress = transaction.to?.toLowerCase();
    if (possibleTransfer && !auctionAddressesL1.has(toAddress)) {
      const event = await this.processTransferEvent(
        input,
        transaction as Transaction,
        createdAt
      );
      if (event) events.push(event);
    }

    // Check if possible batch transfer
    const possibleBatchTransfer = this.utilitySvc.possibleBatchTransfer(input);
    if (!possibleTransfer && possibleBatchTransfer) {
      // console.log({ possibleBatchTransfer });
      const eventArr = await this.processEsip5(
        transaction as Transaction,
        createdAt
      );
      if (eventArr?.length) events.push(...eventArr);
    }

    // Filter logs for ethscription transfers (esip1)
    const esip1Transfers = receipt.logs.filter(
      (log: any) => log.topics[0] === esips.TransferEthscriptionSignature
    );
    if (esip1Transfers.length) {
      Logger.debug(
        `Processing marketplace event (ESIP1)`,
        transaction.hash
      );
      const eventArr = await this.processEsip1(
        esip1Transfers,
        transaction,
        createdAt
      );
      if (eventArr?.length) events.push(...eventArr);
    }

    // Filter logs for ethscription transfers (esip2)
    // Skip auction contracts — ownership is handled by its own event processor
    // Lottery ESIP-2 logs are allowed through: withdrawals need them for ownership updates,
    // and for prize awards the lottery processor cleans up duplicates
    const esip2Transfers = receipt.logs.filter(
      (log: any) => log.topics[0] === esips.TransferEthscriptionForPreviousOwnerSignature
        && !auctionAddressesL1.has(log.address?.toLowerCase())
    );
    if (esip2Transfers.length) {
      Logger.debug(
        `Processing marketplace event (ESIP2)`,
        transaction.hash
      );
      const eventArr = await this.processEsip2(esip2Transfers, transaction, createdAt);
      if (eventArr?.length) events.push(...eventArr);
    }

    // console.log(receipt);

    // Filter logs for Mutation (Evolve) contract events
    if (evolveAddressL1) {
      const evolveLogs = receipt.logs.filter(
        (log: any) => log.address?.toLowerCase() === evolveAddressL1
      );
      if (evolveLogs.length) {
        Logger.debug(`Processing Mutation event (L1)`, transaction.hash);
        const eventArr = await this.processMutationEvents(evolveLogs, transaction, createdAt);
        if (eventArr?.length) events.push(...eventArr);
      }
    }

    // Filter logs for Auction House V2 events
    if (auctionAddressesL1.size) {
      const auctionLogs = receipt.logs.filter(
        (log: any) => auctionAddressesL1.has(log.address?.toLowerCase())
      );
      if (auctionLogs.length) {
        Logger.debug(`Processing Auction event (L1)`, transaction.hash);
        try {
          const eventArr = await this.processAuctionEvents(auctionLogs, transaction, createdAt);
          if (eventArr?.length) events.push(...eventArr);
        } catch (error) {
          Logger.error(
            '❌',
            `Auction event processing failed for tx ${transaction.hash}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    // Filter logs for EtherPhunk Marketplace events (exclude evolve contract)
    const marketplaceLogs = receipt.logs.filter(
      (log: any) => marketAddressesL1.has(log.address.toLowerCase())
        && log.address?.toLowerCase() !== evolveAddressL1
    );
    if (marketplaceLogs.length) {
      Logger.debug(
        `Processing EtherPhunk Marketplace event (L1)`,
        transaction.hash
      );
      try {
        const eventArr = await this.processEtherPhunkMarketplaceEvents(
          marketplaceLogs,
          transaction,
          createdAt
        );
        // Empty eventArr means the marketplace logs were spurious (e.g. listing
        // wasn't created by the previous owner). Continue to points/lottery
        // processing — DO NOT early-return; that previously caused points
        // and other downstream events to be silently dropped.
        if (eventArr?.length) events.push(...eventArr);
      } catch (error) {
        Logger.error(
          '❌',
          `Marketplace event processing failed for tx ${transaction.hash}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    const pointsLogs = receipt.logs.filter(
      (log: any) => log.address.toLowerCase() === pointsAddressL1.toLowerCase()
    );
    if (pointsLogs.length) {
      Logger.debug(
        `Processing Points event (${chain})`,
        transaction.hash
      );
      try {
        await this.processPointsEvent(pointsLogs);
      } catch (error) {
        Logger.error(
          '❌',
          `Points event processing failed for tx ${transaction.hash}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return events;
  }

  /**
   * Processes the EtherPhunk creation event.
   *
   * @param txn - The transaction object.
   * @param createdAt - The creation date of the transaction.
   * @param phunkShaData - The PhunkSha data.
   * @returns The processed event object.
   */
  async processEthscriptionCreationEvent(
    txn: Transaction,
    createdAt: Date,
    attributesData: AttributeItem,
  ): Promise<Event> {
    const { from, to, hash: hashId } = txn;

    // Add the ethscription
    await this.storageSvc.addEthscription(txn, createdAt, attributesData);
    Logger.log('Added ethscription', `${hashId.toLowerCase()}`);

    return {
      txId: txn.hash.toLowerCase() + txn.transactionIndex,
      type: 'created',
      hashId: hashId.toLowerCase(),
      from: from.toLowerCase(),
      to: (to || zeroAddress).toLowerCase(),
      blockHash: txn.blockHash.toLowerCase(),
      txIndex: txn.transactionIndex,
      txHash: (txn.hash).toLowerCase(),
      blockNumber: Number(txn.blockNumber),
      blockTimestamp: createdAt,
      value: BigInt(0).toString(),
    };
  }

  /**
   * Processes the points event logs and updates the users' points.
   * @param pointsLogs - An array of points event logs.
   * @returns A Promise that resolves when the processing is complete.
   */
  async processPointsEvent(pointsLogs: any[]): Promise<void> {

    const usersToUpdate = new Set<`0x${string}`>();

    for (const log of pointsLogs) {
      const decoded = decodeEventLog({
        abi: pointsAbiL1,
        data: log.data,
        topics: log.topics,
      });

      const { eventName } = decoded;
      const { args } = decoded as any;

      if (!eventName || !args) return;
      if (eventName === 'PointsAdded') {
        const { user, amount } = args;
        usersToUpdate.add(user);
      }
    }

    for (const user of usersToUpdate) {
      await this.distributePoints(user);
    }
  }

  /**
   * Distributes points to a user from a given address.
   * @param fromAddress The address from which the points will be distributed.
   * @returns A Promise that resolves when the points are successfully distributed.
   */
  async distributePoints(
    fromAddress: `0x${string}`,
  ): Promise<void> {
    try {
      const points = await this.web3SvcL1.getPoints(fromAddress);

      await this.storageSvc.updateUserPoints(fromAddress, Number(points));
      Logger.log(
        `Updated user points for ${points.toString()}`,
        fromAddress
      );
    } catch (error) {
      console.log(error);
    }
  }

  /**
   * Processes a calldata transfer event.
   *
   * @param hashId - The hash ID of the event.
   * @param txn - The transaction object.
   * @param createdAt - The creation date of the event.
   * @param index - The optional index of the event.
   * @returns A Promise that resolves to the processed event or null if the event is not valid.
   */
  async processTransferEvent(
    hashId: string,
    txn: Transaction,
    createdAt: Date,
    index?: number
  ): Promise<Event | null> {
    const ethscript: Ethscription = await this.storageSvc.checkEthscriptionExistsByHashId(hashId);
    // console.log({ethscript})
    if (!ethscript) return null;

    const { from, to } = txn;
    const isMatchedHashId = ethscript.hashId.toLowerCase() === hashId.toLowerCase();
    const transferrerIsOwner = ethscript.owner.toLowerCase() === txn.from.toLowerCase();

    // console.log({ isMatchedHashId, transferrerIsOwner, ethscript })

    if (!isMatchedHashId || !transferrerIsOwner) return null;

    Logger.debug(
      `Processing transfer (L1)`,
      txn.hash
    );

    // Update the eth phunk owner
    await this.storageSvc.updateEthscriptionOwner(hashId, ethscript.owner, txn.to);
    Logger.log(
      `Updated ethscript owner to ${txn.to} (transfer event)`,
      ethscript.hashId
    );

    return {
      txId: txn.hash + (index || txn.transactionIndex),
      type: 'transfer',
      hashId: ethscript.hashId.toLowerCase(),
      from: from.toLowerCase(),
      to: (to || zeroAddress).toLowerCase(),
      blockHash: txn.blockHash,
      txIndex: txn.transactionIndex,
      txHash: txn.hash,
      blockNumber: Number(txn.blockNumber),
      blockTimestamp: createdAt,
      value: txn.value.toString(),
    };
  }

  /**
   * Processes a contract transfer event.
   *
   * @param txn - The transaction object.
   * @param createdAt - The creation date of the event.
   * @param from - The address of the sender.
   * @param to - The address of the recipient.
   * @param hashId - The hash ID of the event.
   * @param log - The log object.
   * @param value - The value of the transfer (optional).
   * @param prevOwner - The previous owner of the event (optional).
   * @returns A Promise that resolves to an Event object or null.
   */
  async processContractTransferEvent(
    txn: Transaction,
    createdAt: Date,
    from: string,
    to: string,
    hashId: string,
    log: Log,
    value?: bigint,
    prevOwner?: string,
  ): Promise<Event | null> {
    const ethscript: Ethscription = await this.storageSvc.checkEthscriptionExistsByHashId(hashId);
    if (!ethscript) return null;

    const isMatchedHashId = ethscript.hashId.toLowerCase() === hashId.toLowerCase();
    const transferrerIsOwner = ethscript.owner.toLowerCase() === from.toLowerCase();

    const samePrevOwner = (ethscript.prevOwner && prevOwner)
      ? ethscript.prevOwner.toLowerCase() === prevOwner.toLowerCase()
      : true;

    if (!isMatchedHashId || !transferrerIsOwner || !samePrevOwner) {
      // Fake-deposit / spoofed-transfer guard: contract emitted a transfer event whose
      // claimed previousOwner doesn't match the indexer's ground-truth owner history.
      // Ownership is NOT updated; we just log so operators can audit.
      Logger.warn(
        `🚨 Rejected suspicious transfer for ${hashId} in tx ${txn.hash} — ` +
        `claimed prevOwner=${prevOwner ?? '(none)'}, ` +
        `actual owner=${ethscript.owner}, actual prevOwner=${ethscript.prevOwner ?? '(none)'}, ` +
        `event sender=${from}, recipient=${to}`,
      );
      return null;
    }

    // Update the eth phunk owner
    await this.storageSvc.updateEthscriptionOwner(ethscript.hashId, ethscript.owner, to);
    Logger.log(
      `Updated ethscript owner to ${to} (contract event)`,
      ethscript.hashId
    );

    return {
      txId: txn.hash + (log?.logIndex || txn.transactionIndex || new Date().getTime()),
      type: 'transfer',
      hashId: ethscript.hashId.toLowerCase(),
      from: from.toLowerCase(),
      to: (to || zeroAddress).toLowerCase(),
      blockHash: txn.blockHash,
      txIndex: txn.transactionIndex,
      txHash: txn.hash,
      blockNumber: Number(txn.blockNumber),
      blockTimestamp: createdAt,
      value: value?.toString(),
    };
  }

  /**
   * Processes ESIP1 transfers and returns the corresponding events.
   *
   * @param ethscriptionTransfers - An array of ESIP1 transfer logs.
   * @param transaction - The transaction associated with the transfers.
   * @param createdAt - The creation date of the transaction.
   * @returns An array of events.
   */
  async processEsip1(
    ethscriptionTransfers: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<Event[]> {

    const events = [];
    for (const log of ethscriptionTransfers) {
      const decoded = decodeEventLog({
        abi: esip1Abi,
        data: log.data,
        topics: log.topics,
      });

      const sender = log.address;
      const recipient = decoded.args['recipient'];
      const hashId = decoded.args['id'] || decoded.args['ethscriptionId'];

      const event = await this.processContractTransferEvent(
        transaction,
        createdAt,
        sender,
        recipient,
        hashId,
        log,
        transaction.value,
        null,
      );
      if (event) events.push(event);
    }

    return events;
  }

  /**
   * Processes the ESIP2 events and returns an array of Event objects.
   *
   * @param previousOwnerTransfers - An array of previous owner transfers.
   * @param transaction - The transaction object.
   * @param createdAt - The creation date of the transaction.
   * @returns A promise that resolves to an array of Event objects.
   */
  async processEsip2(
    previousOwnerTransfers: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<Event[]> {

    const events = [];
    for (const log of previousOwnerTransfers) {
      const decoded = decodeEventLog({
        abi: esip2Abi,
        data: log.data,
        topics: log.topics,
      });

      const sender = log.address;
      const prevOwner = decoded.args['previousOwner'];
      const recipient = decoded.args['recipient'];
      const hashId = decoded.args['id'] || decoded.args['ethscriptionId'];

      const event = await this.processContractTransferEvent(
        transaction,
        createdAt,
        sender,
        recipient,
        hashId,
        log,
        transaction.value,
        prevOwner
      );

      if (event) events.push(event);
    }

    return events;
  }

  /**
   * Processes an ESIP5 (batch transfer) transaction and returns the corresponding events.
   * @param txn - The transaction to process.
   * @param createdAt - The creation date of the transaction.
   * @returns A promise that resolves to an array of events.
   */
  async processEsip5(
    txn: Transaction,
    createdAt: Date
  ): Promise<Event[]> {

    const { input } = txn;
    const data = input.substring(2);
    if (!this.utilitySvc.possibleBatchTransfer(input)) return [];

    const allHashes = data.match(/.{1,64}/g).map((hash) => '0x' + hash);
    // console.log(allHashes.length);
    const validItems = await this.storageSvc.checkEthscriptionsExistsByHashIds(allHashes);

    if (!validItems?.length) return [];
    const validHashes = validItems.map((item) => item.hashId);

    const events = [];
    Logger.debug(
      `Processing batch transfer (L1)`,
      txn.hash
    );

    for (let i = 0; i < validHashes.length; i++) {
      try {
        const hashId = validHashes[i].toLowerCase();
        const event = await this.processTransferEvent(hashId, txn, createdAt, i);
        if (event) events.push(event);
      } catch (error) {
        console.log(error);
      }
    }
    return events;
  }

  /**
   * Processes the EtherPhunk marketplace contract events.
   *
   * @param marketplaceLogs - The array of marketplace logs.
   * @param transaction - The transaction object.
   * @param createdAt - The creation date of the events.
   * @returns A promise that resolves to an array of events.
   */
  async processEtherPhunkMarketplaceEvents(
    marketplaceLogs: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<Event[]> {

    // Decode all logs and identify PhunkBought hashIds
    // DystoLabzMarket emits PhunkNoLongerForSale before PhunkBought in buys;
    // skip the redundant delist when a buy follows for the same item
    const decodedLogs: Array<{ decoded: DecodeEventLogReturnType; log: any } | null> = [];
    const boughtHashIds = new Set<string>();

    for (const log of marketplaceLogs) {
      if (!marketAddressesL1.has(log.address?.toLowerCase())) {
        decodedLogs.push(null);
        continue;
      }
      try {
        const decoded = decodeEventLog({
          abi: marketAbiL1,
          data: log.data,
          topics: log.topics,
        });
        decodedLogs.push({ decoded, log });
        if (decoded.eventName === 'PhunkBought' || decoded.eventName === 'BidAccepted' || decoded.eventName === 'BidConfirmed') {
          const hashId = (decoded.args as any).phunkId;
          if (hashId) boughtHashIds.add(hashId.toLowerCase());
        }
      } catch (error) {
        console.log(error);
        decodedLogs.push(null);
      }
    }

    const events = [];
    for (const entry of decodedLogs) {
      if (!entry) continue;
      const { decoded, log } = entry;

      // Skip PhunkNoLongerForSale when PhunkBought follows for the same item
      if (decoded.eventName === 'PhunkNoLongerForSale') {
        const hashId = (decoded.args as any).phunkId;
        if (hashId && boughtHashIds.has(hashId.toLowerCase())) continue;
      }

      const event = await this.processEtherPhunkMarketplaceEvent(
        transaction,
        createdAt,
        decoded,
        log
      );

      if (event) events.push(event);
    }

    return events;
  }

  /**
   * Processes an individual EtherPhunk marketplace event.
   *
   * @param txn - The transaction object.
   * @param createdAt - The timestamp when the event was created.
   * @param decoded - The decoded event log.
   * @param log - The log object.
   * @returns A promise that resolves to an Event object.
   */
  async processEtherPhunkMarketplaceEvent(
    txn: Transaction,
    createdAt: Date,
    decoded: DecodeEventLogReturnType,
    log: Log
  ): Promise<Event> {
    const { eventName } = decoded;
    const { args } = decoded as any;

    if (!eventName || !args) return;

    const hashId =
      args.id ||
      args.phunkId ||
      args.potentialEthscriptionId;

    if (!hashId) return;

    const phunk = await this.storageSvc.checkEthscriptionExistsByHashId(hashId);
    if (!phunk) return;

    // Flat allowlist: only record marketplace events whose phunk belongs to one of our
    // tracked collections — regardless of WHICH marketplace contract emitted the event.
    // This way missing-phunks/dysto-phunks get indexed whether listed on the old
    // DystoLabz market or on ours. Configure via TRACKED_MARKETPLACE_SLUGS env var.
    const trackedSlugs = new Set(
      (process.env.TRACKED_MARKETPLACE_SLUGS ||
        'cryptophunksv67,ethsrocks,quantummissingphunksv67,quantumdystophunkzv67,og-missing-phunks,og-dysto-phunks')
        .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    );
    if (!trackedSlugs.has((phunk.slug || '').toLowerCase())) return;

    if (eventName === 'PhunkBought') {
      const { phunkId: hashId, fromAddress, toAddress, value } = args;

      // Remove listing (may already be removed by PhunkNoLongerForSale in the same tx)
      await this.storageSvc.removeListing(hashId);

      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: fromAddress.toLowerCase(),
        to: toAddress.toLowerCase(),
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: new Date(createdAt.getTime() - 1000),
        value: value.toString(),
      };
    }

    if (eventName === 'PhunkNoLongerForSale') {
      const { phunkId: hashId } = args;

      const removedListing = await this.storageSvc.removeListing(hashId);
      if (!removedListing) return;

      if (txn.from === phunk.prevOwner) {
        return {
          txId: txn.hash + log.logIndex,
          type: eventName,
          hashId: hashId.toLowerCase(),
          from: txn.from?.toLowerCase(),
          to: zeroAddress,
          blockHash: txn.blockHash,
          txIndex: txn.transactionIndex,
          txHash: txn.hash,
          blockNumber: Number(txn.blockNumber),
          blockTimestamp: createdAt,
          value: BigInt(0).toString(),
        };
      }
    }

    // ─── V3_2 bid events ─────────────────────────────────────────
    if (eventName === 'BidEntered') {
      const { phunkId: hashId, owner, bidder, value } = args;
      await this.storageSvc.createBid(txn, createdAt, hashId, bidder, value, owner);
      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: bidder?.toLowerCase(),
        to: owner?.toLowerCase(),
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: createdAt,
        value: value.toString(),
      };
    }

    if (eventName === 'BidWithdrawn' || eventName === 'BidRefunded') {
      const { phunkId: hashId, owner, bidder, value } = args;
      await this.storageSvc.removeBid(hashId);
      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: bidder?.toLowerCase(),
        to: owner?.toLowerCase(),
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: createdAt,
        value: value.toString(),
      };
    }

    if (eventName === 'BidAccepted') {
      const { phunkId: hashId, owner, bidder, value, acceptedBlock } = args;
      // Listing auto-invalidated in the same tx by acceptBid; mirror that here.
      await this.storageSvc.removeListing(hashId);
      // Stamp the acceptedBlock so the UI / activity feed knows the 5-block confirm cooldown is running.
      await this.storageSvc.setBidAccepted(hashId, Number(acceptedBlock));
      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: owner?.toLowerCase(),
        to: bidder?.toLowerCase(),
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: createdAt,
        value: value.toString(),
      };
    }

    if (eventName === 'BidConfirmed') {
      const { phunkId: hashId, owner, bidder, value } = args;
      await this.storageSvc.removeBid(hashId);
      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: owner?.toLowerCase(),
        to: bidder?.toLowerCase(),
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: createdAt,
        value: value.toString(),
      };
    }

    if (eventName === 'PhunkOffered') {
      const { phunkId: hashId, toAddress, minValue } = args;

      // We do this here because this event is emitted after
      // transfer of ownership. If the listing was NOT created
      // by the previous owner, we should ignore it.
      // Note: for the OG market (DystoLabz), the transfer event fires before
      // PhunkOffered in the same tx, so prevOwner becomes the market contract.
      // Accept the listing if prevOwner is the market contract (item was just escrowed).
      const isEscrowedInMarket = marketAddressesL1.has(phunk.prevOwner?.toLowerCase());
      if (phunk.prevOwner && (phunk.prevOwner !== txn.from) && !isEscrowedInMarket) {

        // Write the failed listing to a file
        try { await mkdir('./failed'); } catch (error) {}
        await writeFile(`./failed/${hashId}.json`, JSON.stringify({ txn: txn.hash, phunk }));
        Logger.error(
          'Listing not created by previous owner',
          hashId
        );

        // Since this listing will STILL overwrite existing listings
        // on the smart contract, we must delete it from the database
        await this.storageSvc.removeListing(hashId);
        return;
      }

      // console.log({ hashId, toAddress, minValue });

      await this.storageSvc.createListing(txn, createdAt, hashId, toAddress, minValue);
      return {
        txId: txn.hash + log.logIndex,
        type: eventName,
        hashId: hashId.toLowerCase(),
        from: txn.from?.toLowerCase(),
        to: toAddress?.toLowerCase(),
        blockHash: txn.blockHash,
        txIndex: txn.transactionIndex,
        txHash: txn.hash,
        blockNumber: Number(txn.blockNumber),
        blockTimestamp: createdAt,
        value: minValue.toString(),
      };
    }
  }

  // /**
  //  * Adds an ethscription to the database.
  //  * @param body - The body of the ethscription.
  //  * @returns A promise that resolves to an array of events.
  //  */
  // async addEthscription(body: { hash: string, attributes: AttributeItem }): Promise<any> {

  //   let { hash, attributes } = body;

  //   const transaction = await this.web3SvcL1.getTransaction(hash as `0x${string}`)
  //   const block = await this.web3SvcL1.getBlock({ blockNumber: Number(transaction.blockNumber) });
  //   const timestamp = new Date(Number(block.timestamp) * 1000);

  //   const { input } = transaction;

  //   // Make sure its an ethscription
  //   const stringData = hexToString(input.toString() as `0x${string}`);
  //   const cleanedString = stringData.replace(/\x00/g, '');
  //   if (!cleanedString.startsWith('data:')) return [];

  //   // Create sha and check if it exists
  //   const sha = createHash('sha256').update(cleanedString).digest('hex');
  //   const [ existsLocal, existsGlobal ] = await Promise.all([
  //     this.sbSvc.checkEthscriptionExistsBySha(sha),
  //     this.dataSvc.getEthscriptionByHashId(hash)
  //   ]);

  //   // Only process ones that don't already exist locally
  //   if (existsLocal) return;

  //   // Only process ones that already exist globally (ethscriptions)
  //   if (!existsGlobal) return;

  //   // Set the sha
  //   attributes.sha = sha;

  //   // Mime type
  //   const base64Header = cleanedString.split(',')[0];
  //   const mimeType = base64Header.match(/data:([^;]*);?/)[1];

  //   // Create image buffer from data uri
  //   const imageBuffer = Buffer.from(cleanedString.split(',')[1], 'base64');

  //   // Upload image to storage bucket
  //   await this.sbSvc.uploadImage(sha, imageBuffer, mimeType);

  //   const event = await this.processEthscriptionCreationEvent(transaction, timestamp, attributes);
  //   if (event) await this.sbSvc.addEvents([event]);
  // }

  /**
   * Processes Mutation (Evolve/Devolve) contract events.
   * Creates Evolved/Devolved activity events for the swapped ethscriptions.
   */
  async processMutationEvents(
    evolveLogs: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<Event[]> {
    const events: Event[] = [];

    for (const log of evolveLogs) {
      try {
        const decoded = decodeEventLog({
          abi: mutationAbi,
          data: log.data,
          topics: log.topics,
        });

        const { eventName } = decoded;
        const { args } = decoded as any;
        if (!eventName || !args) continue;

        if (eventName === 'Evolved') {
          const { user, ogHashId, quantumHashId } = args;
          const userAddr = user.toLowerCase();
          const value = transaction.value.toString();

          // Event for OG collection (OG was sent to contract)
          events.push({
            txId: transaction.hash + '-evolve-og-' + log.logIndex,
            type: 'Evolved',
            hashId: ogHashId.toLowerCase(),
            from: userAddr,
            to: evolveAddressL1,
            blockHash: transaction.blockHash,
            txIndex: transaction.transactionIndex,
            txHash: transaction.hash,
            blockNumber: Number(transaction.blockNumber),
            blockTimestamp: createdAt,
            value,
          });

          // Event for Quantum collection (quantum was received by user)
          events.push({
            txId: transaction.hash + '-evolve-q-' + log.logIndex,
            type: 'Evolved',
            hashId: quantumHashId.toLowerCase(),
            from: userAddr,
            to: evolveAddressL1,
            blockHash: transaction.blockHash,
            txIndex: transaction.transactionIndex,
            txHash: transaction.hash,
            blockNumber: Number(transaction.blockNumber),
            blockTimestamp: createdAt,
            value,
          });
        }

        if (eventName === 'Devolved') {
          const { user, quantumHashId, ogHashId } = args;
          const userAddr = user.toLowerCase();

          // Event for Quantum collection (quantum was sent to contract)
          events.push({
            txId: transaction.hash + '-devolve-q-' + log.logIndex,
            type: 'Devolved',
            hashId: quantumHashId.toLowerCase(),
            from: userAddr,
            to: evolveAddressL1,
            blockHash: transaction.blockHash,
            txIndex: transaction.transactionIndex,
            txHash: transaction.hash,
            blockNumber: Number(transaction.blockNumber),
            blockTimestamp: createdAt,
            value: BigInt(0).toString(),
          });

          // Event for OG collection (OG was received by user)
          events.push({
            txId: transaction.hash + '-devolve-og-' + log.logIndex,
            type: 'Devolved',
            hashId: ogHashId.toLowerCase(),
            from: userAddr,
            to: evolveAddressL1,
            blockHash: transaction.blockHash,
            txIndex: transaction.transactionIndex,
            txHash: transaction.hash,
            blockNumber: Number(transaction.blockNumber),
            blockTimestamp: createdAt,
            value: BigInt(0).toString(),
          });
        }
      } catch (error) {
        // Skip logs that don't match Mutation ABI (e.g. TransferEthscriptionForPreviousOwner)
        continue;
      }
    }

    return events;
  }

  /**
   * Processes Auction House V2 events.
   * Updates auctions table and creates activity events for history.
   */
  async processAuctionEvents(
    auctionLogs: any[],
    transaction: Transaction,
    createdAt: Date
  ): Promise<Event[]> {
    const events: Event[] = [];

    for (const log of auctionLogs) {
      let decoded: any;
      try {
        decoded = decodeEventLog({
          abi: auctionAbiV2,
          data: log.data,
          topics: log.topics,
        });
      } catch (error) {
        // Skip logs that don't match Auction ABI (e.g. TransferEthscriptionForPreviousOwner)
        continue;
      }

      const { eventName } = decoded;
      const { args } = decoded as any;
      if (!eventName || !args) continue;

      // Use the address of the contract that emitted this log (supports multiple auction contracts)
      const auctionAddr = log.address?.toLowerCase();

      // Wrap each handler so a single failed event (e.g. duplicate-key when
      // backfilled rows exist, RPC hiccup, etc.) does NOT abort processing of
      // the other events in the same transaction.
      try {

      if (eventName === 'PoolDeposited') {
        const { hashId } = args;

        // Update ownership to auction contract
        await this.storageSvc.updateEthscriptionOwner(
          hashId.toLowerCase(),
          transaction.from.toLowerCase(),
          auctionAddr
        );

        // Transfer event so deposit shows in activity
        events.push({
          txId: transaction.hash + '-pool-deposit-' + log.logIndex,
          type: 'transfer',
          hashId: hashId.toLowerCase(),
          from: transaction.from.toLowerCase(),
          to: auctionAddr,
          blockHash: transaction.blockHash,
          txIndex: transaction.transactionIndex,
          txHash: transaction.hash,
          blockNumber: Number(transaction.blockNumber),
          blockTimestamp: createdAt,
          value: BigInt(0).toString(),
        });
      }

      if (eventName === 'PoolWithdrawn') {
        const { hashId } = args;

        // Update ownership back to the depositor (tx sender = contract owner)
        await this.storageSvc.updateEthscriptionOwner(
          hashId.toLowerCase(),
          auctionAddr,
          transaction.from.toLowerCase()
        );

        // Transfer event so withdrawal shows in activity
        events.push({
          txId: transaction.hash + '-pool-withdrawn-' + log.logIndex,
          type: 'transfer',
          hashId: hashId.toLowerCase(),
          from: auctionAddr,
          to: transaction.from.toLowerCase(),
          blockHash: transaction.blockHash,
          txIndex: transaction.transactionIndex,
          txHash: transaction.hash,
          blockNumber: Number(transaction.blockNumber),
          blockTimestamp: createdAt,
          value: BigInt(0).toString(),
        });
      }

      if (eventName === 'AuctionCreated') {
        const { hashId, auctionId, startTime, endTime } = args;

        await this.storageSvc.createAuction(
          { hashId, auctionId, startTime, endTime, contractAddress: auctionAddr },
          createdAt
        );

        events.push({
          txId: transaction.hash + '-auction-created-' + log.logIndex,
          type: 'AuctionCreated',
          hashId: hashId.toLowerCase(),
          from: auctionAddr,
          to: zeroAddress,
          blockHash: transaction.blockHash,
          txIndex: transaction.transactionIndex,
          txHash: transaction.hash,
          blockNumber: Number(transaction.blockNumber),
          blockTimestamp: createdAt,
          value: BigInt(0).toString(),
        });
      }

      if (eventName === 'AuctionBid') {
        const { hashId, auctionId, sender, value } = args;

        await this.storageSvc.createAuctionBid(
          { hashId, auctionId, sender, value, contractAddress: auctionAddr },
          transaction,
          createdAt
        );

        events.push({
          txId: transaction.hash + '-auction-bid-' + log.logIndex,
          type: 'AuctionBid',
          hashId: hashId.toLowerCase(),
          from: sender.toLowerCase(),
          to: auctionAddr,
          blockHash: transaction.blockHash,
          txIndex: transaction.transactionIndex,
          txHash: transaction.hash,
          blockNumber: Number(transaction.blockNumber),
          blockTimestamp: createdAt,
          value: value.toString(),
        });
      }

      if (eventName === 'AuctionExtended') {
        const { hashId, auctionId, endTime } = args;

        await this.storageSvc.extendAuction(
          { hashId, auctionId, endTime, contractAddress: auctionAddr }
        );
      }

      if (eventName === 'AuctionSettled') {
        const { hashId, auctionId, winner, amount } = args;
        const zeroAddress = '0x0000000000000000000000000000000000000000';

        await this.storageSvc.settleAuction(
          { hashId, auctionId, winner, amount, contractAddress: auctionAddr },
          createdAt
        );

        // Only update ownership and create events if there was a winner
        // (no-bid auctions have winner = address(0), item stays in pool)
        if (winner.toLowerCase() !== zeroAddress) {
          // Update ownership so the winner's wallet shows the phunk
          await this.storageSvc.updateEthscriptionOwner(
            hashId.toLowerCase(),
            auctionAddr,
            winner.toLowerCase()
          );

          // Transfer event so it shows in activity and details page
          events.push({
            txId: transaction.hash + '-auction-transfer-' + log.logIndex,
            type: 'transfer',
            hashId: hashId.toLowerCase(),
            from: auctionAddr,
            to: winner.toLowerCase(),
            blockHash: transaction.blockHash,
            txIndex: transaction.transactionIndex,
            txHash: transaction.hash,
            blockNumber: Number(transaction.blockNumber),
            blockTimestamp: new Date(createdAt.getTime() - 1000),
            value: BigInt(0).toString(),
          });
        }

        events.push({
          txId: transaction.hash + '-auction-settled-' + log.logIndex,
          type: 'AuctionSettled',
          hashId: hashId.toLowerCase(),
          from: auctionAddr,
          to: winner.toLowerCase(),
          blockHash: transaction.blockHash,
          txIndex: transaction.transactionIndex,
          txHash: transaction.hash,
          blockNumber: Number(transaction.blockNumber),
          blockTimestamp: createdAt,
          value: amount.toString(),
        });
      }

      } catch (handlerError) {
        Logger.error(
          '❌',
          `Auction handler '${eventName}' failed for tx ${transaction.hash} (log index ${log.logIndex}): ${handlerError instanceof Error ? handlerError.message : String(handlerError)}`
        );
        // Continue to next log — do not abort the whole batch.
      }
    }

    return events;
  }
}
