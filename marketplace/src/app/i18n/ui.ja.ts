// Japanese interface strings (footer, collection pages, menu box, search, map controls).
// Same keys as ui.en.ts; a missing key falls back to English.
// {placeholders} are filled by PhunkPreferencesService.t(key, params).
export const UI_JA: Record<string, string> = {
  indonesian: 'インドネシア語',

  // footer
  explore: '探索',
  allCollection: 'すべての {name}',
  turtles: 'Turtles',
  activity: 'アクティビティ',
  sales: '販売',
  contracts: 'コントラクト',
  collection: 'コレクション',
  aboutUs: '私たちについて',
  shellArchive: 'The Shell Archive',

  // collection intro
  colourBlue: '青',
  colourLime: 'ライム',
  colourAqua: 'アクア',
  colourViolet: 'バイオレット',
  colourYellow: '黄',

  // collection map
  zoomIn: '拡大',
  zoomOut: '縮小',
  resetView: '表示をリセット',
  fullscreen: '全画面',

  // collection search
  searchCollection: '{name} を検索',
  searchButton: '検索',
  searchPlaceholderV67: '「turtle」や「turtle and hoodie」、または番号で検索',
  searchPlaceholderOther: '「zombie」や「zombie and beard」、または番号で検索',
  searchNoPiece: '{name} #{n} はありません。',
  searchNoTrait: '「{q}」に一致する属性はありません。',

  // types and attributes
  downloadCsv: 'CSV をダウンロード',
  moreExamples: 'その他の例',
  phunkTypes: 'Phunk タイプ',
  attributeCounts: '属性数',
  nAttributes: '属性 {n} 個',
  oneAttribute: '属性 1 個',

  // index sections
  bidsHeading: '入札',
  salesHeading: '販売',
  averageOpenBid: '有効な入札の平均額は',
  totalOpenBids: '有効な入札の合計額は',
  showingTopBids: '上位の入札を表示中、',

  // menu wallet box
  yourPhunks: 'あなたの Phunks',
  open: 'オープン',
  escrowed: 'エスクロー中',

  // app intro popup
  introTitle: 'QuantumPhunks オークションハウス',
  introForked: 'Chopperdad からフォークしてアップグレードしました。',
  introPhunklloween: 'Phunklloween が開始しました。手作りの Phunk ハロウィン 1/1 作品をここでオークションにかけます。1日1点、各24時間、開始価格は 0.001 ETH。67点のうち19点が毎日オークションハウスに登場し、最後の1点はハロウィン当日に決済されます。残りはマーケットに出品されます。',
  introBidRules: '各入札は直前の入札を少なくとも10%上回る必要があります。終了前の10分以内に入札があると時間が10分延長されるため、終了間際の滑り込みはできません。上回る入札があった場合、あなたの ETH は引き出し可能残高に戻ります。タイマー終了後は誰でも決済でき、アイテムは落札者に渡り、次のオークションが始まります。',
  introMadeBy: '制作: DystoLabz、別名',
  introAndMe: 'と私。',
  introQuestions: 'ご質問は',
  introOnX: 'まで X でどうぞ。',
  introEnter: '入る',

  // lottery (Phupreme)
  lotteryPrize: '賞品',
  lotteryNotWhitelisted: 'このフェーズはホワイトリスト限定で、あなたのウォレットはまだリストに登録されていません。',
  lotteryRefundNotice: '以前のスピンから {amount} ETH を回収できます。',
  lotteryWithdrawAmount: '{amount} ETH を引き出す',
  lotteryQuantity: '数量',
  lotterySurrender: '差し出して割引',
  lotterySurrenderHint: 'Phunk V2 / Philip を差し出すと安くなります。当選時にトレジャリーへ移動します。',
  lotteryLoadingEligible: '対象アイテムを読み込み中…',
  lotteryNoEligible: 'ウォレットに対象アイテムが見つかりません。',
  lotteryDiscount: '割引',
  lotteryVrfFee: 'Chainlink VRF 手数料（概算）',
  lotteryTotal: '合計',
  lotteryComingSoonTag: '近日公開',
  lotteryComingSoon: '近日公開',
  lotteryConfirmInWallet: 'ウォレットで確認...',
  lotterySubmittingMint: 'ミントを送信中... {s}秒',
  lotteryDrawingPrize: '賞品を抽選中... {s}秒',
  lotterySpinning: 'スピン中...',
  lotterySlowingDown: '減速中...',
  lotteryMintAgain: 'もう一度ミント',
  lotteryMint: 'ミント',
  lotteryDemo: 'デモ',
  lotteryMintPrice: 'ミント: {price} ETH',
  lotteryLeft: '残り {n} QuantumPhunks',
  lotteryYouWon: '当選しました！',
  lotteryYouWonN: '{n} 個当選しました！',
  lotteryHowItWorks: '仕組み',
  lotteryStep1Title: '数量を選ぶ',
  lotteryStep1Text: '任意で Phunk V2 または Philip を差し出すと ETH 割引が受けられます。価格はリアルタイムで更新されます。',
  lotteryStep2Text: '1回のトランザクションでミント価格と少額の Chainlink VRF 手数料を支払います。超過分は自動的に返金されます。',
  lotteryStep3Title: 'ランダム公開',
  lotteryStep3Text: 'Chainlink VRF があなたの QuantumPhunk をランダムに選び、そのままウォレットにミントされます — 公開手順は不要です。',
  lotteryViewPool: 'プール内のすべての QuantumPhunks を見る。',
  lotteryViewPoolN: 'プール内の {n} 個の QuantumPhunks をすべて見る。',
  lotteryRecentWins: '最近の当選',
  lotteryViewWins: '当選したすべての QuantumPhunks を見る。',
  lotteryCreditExceeds: '差し出すアイテムの価値が注文額を超えています — 選択を外すか数量を増やしてください。',
  lotteryCouldNotPrice: 'この選択の価格を計算できませんでした。',
  lotteryInactive: '宝くじは現在停止中です',
  lotteryNoPrizes: '利用可能な賞品がありません',
  lotteryWhitelistOnlyNotListed: 'このフェーズはホワイトリスト限定です。あなたのウォレットはまだリストに登録されていません。',
  lotteryNothingToMint: 'ミントできるものがありません',
  lotteryInsufficientEth: 'ミントとガス代に必要な ETH が不足しています',
  lotteryStillSettling: 'ミントは確認されましたが、結果はまだ確定中です。まもなく「最近の当選」に表示されます。',
  lotteryNoContractWallets: 'スマートコントラクトウォレットには対応していません。通常のウォレットをご利用ください。',
  lotteryWhitelistOnly: 'このフェーズはホワイトリスト限定です。',
  lotteryWalletLimit: 'ウォレットごとのミント上限に達しました。',
  lotteryNotEnoughPrizes: 'その数量に足りる賞品が残っていません。',
  lotteryMintTxFailed: 'ミントトランザクションに失敗しました',

  // shared errors
  txFailed: 'トランザクションに失敗しました',
  withdrawFailed: '引き出しに失敗しました',

  // lottery pool / wins pages
  lotteryPool: '宝くじプール',
  lotteryInPool: 'プール内の QuantumPhunks',
  lotteryLoadingPool: 'プールを読み込み中...',
  lotteryPoolEmpty: 'プールは空です。',
  loadMore: 'さらに読み込む',
  lotteryAllWon: '当選したすべてのアーティファクト',
  lotteryWinsWord: '当選',
  lotteryNoWins: 'まだ当選はありません。',

  // auction page
  auctionLoading: 'オークションを読み込み中...',
  auctionNotice: 'リザーブ 0 の EthsRocks でのオークションテストは成功しました。今後のオークションは V67 コレクションの最もレアなアイテムに移り、リザーブ価格が設定されます。また、小規模なコレクションや、ここにある任意のコレクションのアイテムも扱う可能性があります。',
  auctionEthscriptionsTag: 'ここでオークションされるアイテムは Ethscriptions であり、CryptoPhunksV67 ERC-721 コレクションではありません',
  auctionNewBidUpdating: '新しい入札を検出、更新中...',
  auctionPoolItems: 'オークションプールのアイテム ({n})',
  auctionSwapHint: 'あなたの CryptoPhunksV67 をプール内のものと交換。無料、1:1。',
  auctionWithdrawAll: 'すべて引き出す ({n})',
  auctionSwapStep2: 'ステップ 2: プールから選ぶ',
  auctionSwapFor: '#{id} と交換',
  auctionYourV67: 'あなたの CryptoPhunksV67',
  auctionSendToSwap: '交換に送る',
  auctionConnectToSeeV67: 'ウォレットを接続して CryptoPhunksV67 を表示。',
  auctionWaitingConfirmation: '確認待ち...',
  auctionDepositNotConfirmed: '入金はまだ確認されていません...',
  auctionReadyToSwap: '交換の準備ができました！',
  auctionBlocksRemaining: '残り {n} ブロック...',
  auctionEnterBid: '入札額を入力してください',
  auctionBidFailed: '入札に失敗しました',
  auctionBuyNowUnavailable: 'このウォレットでは今すぐ購入を利用できません',
  auctionBuyNowFailed: '今すぐ購入に失敗しました',
  auctionSettleFailed: '決済に失敗しました',

  // shared status words
  processing: '処理中...',
  waiting: '待機中...',
  sending: '送信中...',

  // item view
  itemAvailableNow: 'は現在購入可能です',
  itemBuyNowFor: '{price} ETH で今すぐ購入',
  itemDiamondHandsPrice: 'Diamond Hands 価格',
  itemDiamondHands: 'Diamond Hands',
  itemAddressPlaceholder: '0x または .ens',
  itemQpListingNote: '出品すると、売れた場合に限り QuantumPhunks マーケットがこの NFT を転送することを承認します — それまではあなたのウォレットに残ります（エスクローなし）。いつでも出品取消できます。',
  itemQpBidNote: '入札はノンカストディアルです。あなたの ETH はオーナーが承認するまで QuantumPhunks マーケットにロックされます（1回のトランザクションのみ — 確認手順やクールダウンはありません）。アイテムが売れた場合は自動的に返金され、承認される前ならいつでも入札を引き出せます。',
  itemBiddingRestricted: 'このコレクションへの入札は現在制限されています。',
  itemNotForSale: '非売品',
  itemNoConsensus: 'コンセンサスに達していません。サポート @etherphunks にご連絡ください',

  // shared errors 2
  couldNotProcessTx: 'トランザクションを処理できませんでした',
  invalidAddress: '無効なアドレス',

  // market (bulk actions)
  marketShowFilters: 'フィルターを表示',
  marketHideFilters: 'フィルターを隠す',
  marketBulkList: '一括出品',
  marketItems: 'アイテム',
  marketPhunks: 'Phunks',
  marketIneligibleList: '選択したアイテムのうち {n} 個は出品できません',
  marketNoValueNotListed: '価格が未設定のアイテムは出品されません。',
  marketListPrice: '出品価格',
  marketCopy: 'コピー',
  marketListAll: 'すべて出品',
  marketBulkTransfer: '一括転送',
  marketIneligibleTransfer: '選択したアイテムのうち {n} 個は転送できません',
  marketTransferAll: 'すべて転送',
  marketBulkEscrow: '一括エスクロー',
  marketIneligibleEscrow: '選択したアイテムのうち {n} 個はエスクローに入れられません',
  marketEscrowAll: 'すべてエスクロー',
  marketBulkWithdraw: '一括引き出し',
  marketIneligibleWithdraw: '選択したアイテムのうち {n} 個は引き出せません',
  marketWithdrawAll: 'すべて引き出す',
  marketIneligibleBuy: '選択したアイテムのうち {n} 個は購入できません',
  marketBuyAll: 'すべて購入',
  marketClose: '閉じる',
  marketSweepSoon: 'このコレクションの一括購入は近日公開です。',
  marketNoneForSale: '選択したアイテムに販売中のものはありません。',
  marketNoLongerForSale: '1つ以上のアイテムが販売終了しました。',
  marketInvalidSelection: '無効な選択',

  // ordex withdrawal banner
  ordexYouHave: 'あなたには',
  ordexEscrowedOne: '個の ethscription が Ordex でエスクロー中です。今引き出さないと、永久に失われる可能性があります！',
  ordexEscrowedMany: '個の ethscriptions が Ordex でエスクロー中です。今引き出さないと、永久に失われる可能性があります！',
  ordexWithdrawing: '引き出し中...',
  ordexWithdrawComplete: '引き出し完了',
  ordexWithdrawNow: '今すぐ引き出す',
  ordexTxHash: 'トランザクションハッシュ:',
  ordexSignNotice: '引き出すには、メッセージへの署名とトランザクションの送信が必要です。',

  // mint
  mintInscribed: 'インスクライブ済み',
  mintTooltip: "インスクリプションは先着順です。<a href='https://docs.ethscriptions.com/overview/protocol-specification#creating-ethscriptions' target='_blank'>こちらのプロトコルルール</a>に基づき、それぞれが固有で複製できません。",
  mintIdiotAlt: 'おバカさん',
  mintPenalty: 'クリックしすぎたためペナルティ中です。再試行まであと',
  mintSeconds: '秒。',
  mintRandom: 'ランダム',
  mintAlreadyInscribed: 'インスクライブ済み',
  mintInscribe: 'インスクライブ',
  mintAgree: '「inscribe」ボタンをクリックすると、以下に同意したことになります:',
  mintTerms: '利用規約',
  mintNetworkFees: 'ネットワーク手数料がかかります',
  mintFailed: 'インスクライブに失敗しました',

  // auction strip
  stripPhunkAlt: 'Phunk #{id}',
  stripCurrentBid: '現在の入札',
  stripOpeningBid: '開始入札',
  stripEndsIn: '終了まで',
  stripEnded: '終了',
  stripBidding: '入札中…',
  stripSettleAtHouse: 'オークションハウスで決済',
  stripBidsLower: '入札',
  stripOpenHouse: 'オークションハウスを開く',
  stripAuctionHouse: 'オークションハウス',
  stripBidSent: '入札を送信しました — 確認待ち…',
  stripNoBidsMin: 'まだ入札はありません。最低 {min} ETH。',
  stripNextBidMin: '次の入札は {min} ETH 以上である必要があります。',
  stripMinBidIs: '最低入札額は {min} ETH',

  // auction widgets (auction, phunk-info, timer, easter egg)
  viewCurrentAuction: '現在のオークションを見る',
  infoTrait: '{n} 属性',
  infoTraits: '{n} 属性',
  infoPoolItem: 'プール内 {n} アイテム',
  infoPoolItems: 'プール内 {n} アイテム',
  timerDay: '日',
  timerHr: '時間',
  timerMin: '分',
  timerSec: '秒',
  eggYouBid: 'あなたの入札',

  // activity tables (user activity, recent activity, tx history)
  bidCap: '入札',
  uaEvent: 'イベント',
  uaTokenId: 'トークンID',
  uaFrom: 'From',
  uaValue: '金額',
  uaBoughtFor: '購入価格',
  uaCreatedBy: '作成者',
  uaBridgedBy: 'ブリッジ by',
  actAcceptedFrom: '承認 from',
  actConfirmedBy: '確認 by',
  actWithdrawnBy: '引き出し by',
  txBidAccepted: '入札承認',
  txBidConfirmed: '入札確認',
  txBidRefunded: '入札返金',

  // activity tables 2
  actErc721Title: 'ERC-721 トークン — Ethereum 上のコントラクトの状態に存在します。Ethscription ではありません。コントラクトを見る。',
  actEthscriptionTitle: 'Ethscription — Ethereum の calldata に直接インスクライブされています。ドキュメントを読む。',

  // phunk grid
  gridLoad: 'さらに',
  gridMore: '読み込む',
  gridDeadBid: '無効な入札',

  // collection stat bar
  statFloor: 'フロア',
  statArtifacts: 'アーティファクト',
  statListed: '出品中',
  statVolume: '取引量',

  // PFP download options (breadcrumbs)
  pfpShape: '形',
  pfpSquare: '四角',
  pfpRound: '丸',
  pfpHexagon: '六角形',
  pfpBackground: '背景',
  pfpCollectionDefault: 'コレクション標準',
  pfpCustomColour: 'カスタムカラー',
  pfpBorder: '枠線',
  pfpOn: 'オン',
  pfpBorderColour: '枠線の色',
  pfpSize: 'サイズ',
  pfpExtras: 'その他',

  // collection sales / billboard / comments / filters
  salesNone: 'まだ販売はありません。',
  billboardUnsupported: '未対応のコンテンツタイプ: {type}',
  commentsTicTooltip: "TIC（Transaction Inscribed Comments）は、Ethereum トランザクションの calldata を通じてオンチェーンでのコメントを可能にします。アドレス、トランザクションハッシュ、その他のオンチェーン識別子などのブロックチェーン上の対象にコメントを関連付ける標準的な方法を提供します。<a href='https://github.com/chopperdaddy/ethereumphunks.com/blob/sepolia/tic-protocol.md' target='_blank'>詳しく見る</a>。",
  commentsFailed: 'コメントのインスクライブに失敗しました',
  filtersNoMatch: '一致なし',

  // sales page / owners page
  salesAllTitle: 'すべての {name} の販売',
  salesShowing: '{n} 件の販売を表示中。',
  salesLoading: '販売を読み込み中...',
  salesNoneForCollection: 'このコレクションの販売はまだありません。',
  ownersAllTitle: 'すべての QuantumPhunk オーナー',
  ownersCount: '（{n} オーナー）',
  ownersNumberOwned: '所有数',

  // shared aria labels
  breadcrumb: 'パンくずリスト',

  // market filters
  filters: 'フィルター',

  // menu table keys missing from the service's ja table
  sweep: '一括購入',
  bidOrphanedOwner: '古い入札: この入札は以前のオーナーがアイテムを保有していた時に行われたため、オンチェーンではそのアドレスに紐付けられており、ここから承認することはできません。引き出せるのは入札者のみです。',
  bidOrphanedBidder: 'あなたの入札は無効になりました — 入札後にこのアイテムの所有者が変わったため、承認されることはありません。以下から ETH を引き出してください。',

  // late additions: index sales link, pixel stats, footer link
  viewAllSales: "{name}のすべての販売を見る。",
  uniqueColors: "ユニークカラー",
  coloredPixels: "着色ピクセル",
  allTypesFooter: "すべてのタイプと属性",

  // market sort options
  sortPriceLow: "価格の安い順",
  sortPriceHigh: "価格の高い順",
  sortTokenId: "トークンID",
  sortRecent: "新着順",
};
