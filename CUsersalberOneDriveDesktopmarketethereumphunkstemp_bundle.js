(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";

var _merkleTree = require("@openzeppelin/merkle-tree");
const ABI = [{
  "inputs": [{
    "internalType": "address",
    "name": "initialOwner",
    "type": "address"
  }, {
    "internalType": "address",
    "name": "contractAddr",
    "type": "address"
  }, {
    "internalType": "address",
    "name": "treasuryWalletAddr",
    "type": "address"
  }],
  "stateMutability": "nonpayable",
  "type": "constructor"
}, {
  "inputs": [{
    "internalType": "address",
    "name": "owner",
    "type": "address"
  }],
  "name": "OwnableInvalidOwner",
  "type": "error"
}, {
  "inputs": [{
    "internalType": "address",
    "name": "account",
    "type": "address"
  }],
  "name": "OwnableUnauthorizedAccount",
  "type": "error"
}, {
  "anonymous": false,
  "inputs": [{
    "indexed": true,
    "internalType": "address",
    "name": "previousOwner",
    "type": "address"
  }, {
    "indexed": true,
    "internalType": "address",
    "name": "newOwner",
    "type": "address"
  }],
  "name": "OwnershipTransferred",
  "type": "event"
}, {
  "anonymous": false,
  "inputs": [{
    "indexed": true,
    "internalType": "uint256",
    "name": "tokenId",
    "type": "uint256"
  }, {
    "indexed": true,
    "internalType": "address",
    "name": "destination",
    "type": "address"
  }],
  "name": "PhilipMinted",
  "type": "event"
}, {
  "inputs": [],
  "name": "getRandomPhunks",
  "outputs": [{
    "internalType": "uint256",
    "name": "",
    "type": "uint256"
  }],
  "stateMutability": "view",
  "type": "function"
}, {
  "inputs": [],
  "name": "merkleRoot",
  "outputs": [{
    "internalType": "bytes32",
    "name": "",
    "type": "bytes32"
  }],
  "stateMutability": "view",
  "type": "function"
}, {
  "inputs": [{
    "internalType": "bytes32[]",
    "name": "proof",
    "type": "bytes32[]"
  }],
  "name": "mint",
  "outputs": [{
    "internalType": "uint256",
    "name": "",
    "type": "uint256"
  }],
  "stateMutability": "nonpayable",
  "type": "function"
}, {
  "inputs": [],
  "name": "owner",
  "outputs": [{
    "internalType": "address",
    "name": "",
    "type": "address"
  }],
  "stateMutability": "view",
  "type": "function"
}, {
  "inputs": [],
  "name": "renounceOwnership",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}, {
  "inputs": [{
    "internalType": "bytes32",
    "name": "root",
    "type": "bytes32"
  }],
  "name": "setMerkleRoot",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}, {
  "inputs": [{
    "internalType": "address",
    "name": "newOwner",
    "type": "address"
  }],
  "name": "transferOwnership",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}];
const merkleTree = {
  "format": "standard-v1",
  "tree": ["0x8e32b96839d5c81ad278110ca6ec92ab306063724e9e6220a8d8e7b0f888dc33", "0x17a7ea750a376adf8c7f187171d10db4653c0393c54d2acf8466fcd2444d0626", "0xd0e89da6447d851271c83361e8c3d03589fbd57d7460f627fa43c29bf942f89c", "0x0a485bcd4c8a2e319e55fb74213bdf0e84c4fde75800af1d4b63b866ebb8222b", "0xc6f1dc7c081e1f93085be1fda14d981f2f7ef0e788255a08e807ce2c0639c1c6", "0x1e1a0c03519303f2f15f1ebb5a3f07dbd3a2aba3e9d69f75582ddcce55ebf414", "0x2b582897068752132ff539d1065776851e011ab548e7a1f98e9238f7e2ab9a00", "0x477604fdc1840970ed5b95bc4fbf37faceb5cf1fff39f960b51af0bc32b34318", "0x1334fcf16f1f158f87536568b158e336ddcd9e2750bd4e78b13eb339caca54e8", "0x12ade47785d49086ea93a026f5c49b4e8f1c33f7bd72729470684439915957db", "0x769447818e43fef444dee1b223a00491cc7d3ee7a2756a2eef07f80428e7a6c8", "0x4a7c73720eade90227594ec874d38cad64cd1b9c708063eec8b8e868be95feaf", "0xa138115147eefd1fd6928fd7a33afbd0b67325b1712989b655636991900e6c10", "0x22baf31c7760bedef7d13f1a5d30d5ccb4f6c1ed347798d3befbfb174a512f6d", "0x50e82e7f22394dc813c59f05585b32a7a04f84979984c0c0d9921b1c9fb16bfe", "0x67d2114f16a4dc20f3100574567ff51ee9d1c848b3eaed735b4ce0bb43184d3b", "0x353e94a135cffe2136ed63e82bfa6e5fd49bba52b824700fb67ea3430d47c6c9", "0x4000d2a967e0c2eb38f1763cf3df745aba7e6d4c3de3dfa95cce6eda0e648b7b", "0x5159cd56c1df929a60ea1b88361f56bd01473c56000645a5a945f4898a3edfff", "0x0e055ade633efd772ed9f268eee7c2c943a1da70f49ba2db85c357d019c63309", "0x5eab4925234a1a924043cc9394bfb3cf62c3bff0b0a4713d6854d037c5bd262d", "0x16225320c103372d8a258992899b90e9fd5eb978c7faca5fae5eb4241492cc3c", "0x5dc4eb891e044f5e6244d5630c96102b1ffb711680dd87f7708784e2a4d102b7", "0xa59c02fb19a75741e8f682fc4d7c24fff8ecdbc0d4b92454c8dab7094de30067", "0xcbc0c41ebb196d4fe9472de6f61bdd3d39330e9e2035b09b8f521996e51c752d", "0x0c82919978b20ee498bc3384c4567ff0f53e70f7a65ca51145aca20096471159", "0x194e6d935af2de2d23e4b8d85aa576e4b3eb73a465d0c85c3cd8259c64eb7df4", "0x4da4ff2ba955c9ae01ba3842cba400be8591bc5cfe07f19916bea763af3bb378", "0x45245a4fb350f94acfca74121f63c942662a76bfe5d6427035b8535406150edf", "0xe4602a9f9f6da589661b82dd3efd6495026c42a680b241534ee56e3e0e6d9270", "0xea0a569592bf54c84d366bafab2b24a4aa43b163d9fe97ab03f49ad889c5d064", "0x195f171c458c859c483d138dad1649f1f611006d47bb30e8dbe98a78d8a1b701", "0xa4b64d776476fbd90e386dd3c83816ec72f3e642c8ddd08dbfbbdb0f0a2ad13d", "0x2c6df64ae624864dac4e464722227cdc8523208d53d9a951ff267da8a845fec9", "0x71d31288e720ad4bb63be7590f92756e1d61536e9ed0ea89b649e9b496eb8fea", "0xe136acea0a073757941df4b41bf5b8612ebb9341f965c2aead33b37a12762abc", "0x94da189fb208db021c1a27ba2fee6585d2b7da594858d07e19fbc7cb998b2613", "0xb701be73e84bde9c11ce79acfecbe6cc635b9ddc9f971eaf2e7fb5fd32b1a3f6", "0xed7990e44ed01c6d71871f0cd003231118284dbe79bd475eaa1c15f3ab26bb11", "0x6ca02f25f04225c617f8d59c02f0dfa4d81feb0e775723e77ed78852f9fb8a47", "0x7ee8dcab3d22a43f05903fef002fc96bba748a56a501b34d7abe3c0e2c2bb792", "0x180cec933566286d45c5507b290f7b5d5c85ea34dd3c2f5e9164705b3e2b5a75", "0xfb5f57638d05d4579df245286c1a9fa9e0b027e02539001a870c73fdf137d683", "0x3708b8ccb015c4acf52d4fae8a986ba9bd4d1d8083a7fa53de4211cc3ca27fb9", "0x7f67f5ff132af13078a14ad67655894810891d26ac0d832205074bf7c545f0cf", "0x688a25f3ee7600d9abcdcae29d0844760592335e6f73980fda7a2a08763b9518", "0x872c569a8d60b0a080996d21cd88c1fed5108ae99cf3203ef09782687aa769ed", "0x82e003c5c10d7d0767e0640db81487f44222e2e57378a485d5a41600daed5ac0", "0xb27930c0efbfb7c765d30f3ea76f24f91241582d6a32d3ec42c13cc73fd0128c", "0x6b8e661599885451d6c9353ecb960ad29cbbfcdeb2ff22b27fb3663f5dba88e3", "0x04d840bc331fa4858e6b33cb895782048345e63735973816aeb408af90de6be7", "0xdd00f6399258a4c9732e9dfc33fd86da144b493c2e58c274e18ed65991f35a13", "0xdbc9c3cae0fd0f6fd2bc23a38e9003539b4f78be3273fd1324d5a17da765ce97", "0x851b10e6029bf941b17935408d0567c5760addf536b9a65ed65a71ff5debe43e", "0xc5db46b4d4348a4d12397259aeea2e5c236ff04b0333390b89f6761eb711cb50", "0xd1cb332c3033f60148a71d898483331606042abbe52c5d5da6238ba54c0a9a37", "0xc899dca827198a48085de1cb8ca3924ce00ef80f7372c83c85c0775d1d17227a", "0x0b5635441c4c695fb2f0c5d8e4de2759492bdd5b07086b6985ebe160d7430e57", "0xb2989550f58114f4b7928c91d6b38a2dac6584e87dc20664c339a55447589a7d", "0x2f391e1dc397181ae7e2521d5e3ccdf8f5b807c5ebe6b1dde6cf02ec768bcf08", "0x351e09e8f2b0dd0e6873855fb4e7a8096c6656cdbb873c00c65a1ba8f2dcc92c", "0x4b71a53bdb9c2da8810ca8b62b8147362ad2adfa8115b3adb61297fe6f19c936", "0xc97737a1b7c4f6c7200117695e4b19d8216e349efd22994305903a0ec8fdf860", "0x3f4518df44bb17daefa71543e2f8dec93f78b74d451ecb6aab2e611282364ae2", "0x0ea5923bf889b419d9a8800768cfcc00942c7548c2969ec32fcda68ef5836077", "0x45e6c5bb21bc9f2c05cb7b20a683ee05a132f7e26046adec37206f736ce39ac4", "0x6d46299d1c01e710352286c58731c5b81c71ce8314b224ff2f69c6dcdba266c9", "0x58c39e7ac3f3264a2ed62f83048d28887cf42da4ca593f54f2d4059835b645b6", "0xc2a559c56b7f433e909b9c997a679b9d468b15070e8f84582226bc623f4448a1", "0x4cc67ffed29bcd8c17f9ce67c9949607e40015468aba1c5a6c06ed690b320756", "0x8233bb1a6167da0dadeec4fc31efc6bddf24ae2384280fa6169e48b28458b225", "0x77b00c7106599e98d8cf01b206c3e793c0eb5fe9202b0bdf47ac5db272c0d771", "0x4a8b156a0effa3d9a54e3a5c21eeb8796d585e7a4430529b4e84a91fbde7cd43", "0xef22a1730ea9fc8a62d3258fd07f92770f652b273a92a140541b137558fc30bd", "0x08b216960a4420418a840afa9e20729a624111ad6c483471b6657e281a15189b", "0xfcbba8f512edb7158569de5831cf50d6d51e800922db3335bd956629e55da789", "0x4b63ed1e21f2742a1919ad7847930800a2cb40a8b7564f9a3b048fb113c8e5bc", "0x3364e31a6498ca098f0ad66b90e91e8e1103ff976b3a24c8f0e048a4d8f0501d", "0xfac6cc8bf463c12da19228eefb293a25255bebc62045b1f5f055c6e17df2a009", "0xf77c4f13e536f9d0381e44a9987229752b01697a2d4697861fe80e1565b26244", "0xf25526bf35be3528994679d7ea44dc365d7832fdae1847d3e42270b77ae35c4c", "0xf18893e2558dfb8691157e08a3f3fc63fd633583d6441ea4f8adb535e83cc12a", "0xefbc9651ad4496a8ea3cebade9a08399c0634bc93aa3347d6bc2afd3cb783cfd", "0xe8561dda745466d76a3e07be551b0300800223802bb75037e619046e618e896d", "0xe7a5994a389f47ff2d9fe1d1fd908537caaae7178c0b1cd60d75b1265028c7b6", "0xe642c85c823de95fd064b5f23afe89f66e51ed7ac03bae61341bce34e8027df1", "0xe5ef23ba0b9ba8fd36954a61195f61c8348bf5cd748aa00e4d0448860bb3266d", "0xe5a4023598e5cc270b4b6a96ee62baf422994d14b3e00a2eb42d6f0b0fc4a766", "0xe39aa08b4bb8c63f6e5ed95b8fde8559b9e789a69287eacbba0e737e15fa0068", "0xdf2021f83a7ac90c194eba549647a3b1f1f7b6ec01bbe6797466fdc69578660b", "0xde7b6a52ffc41d139dd528c2df25b97b094b60db474160f49cc2884c5d01cbc1", "0xda2b55e35fe0d458054f2c1559941f6073f7d4ae6a251ce3d09585cfe265be02", "0xd8c8048dadb845d4363641cc9269d66b77c1f811d81aded114a1a4afc845a5cf", "0xd36f229b0685943258ab44834a82402f30d62b1a4b8889f8a4ff2c9cc419cca6", "0xd215ab0cd8404de20fe74eae57dca941970cef9784ae9c0783d4f41175f199b0", "0xbf25d86320bd02b027ee35d97dd716357b484cdbf6bf767a785156944ca2ed92", "0xbad52ee5c5bb697ea61f4dc79a8a92e5a221e51f7ad27a3c434112323c6af41a", "0xba29a2843af82f2af065c5d9c371bba67fb6872db19d27d62fa8868305c83d19", "0xb9d399f18e05369ae23e15663d55ee1d8f6494e6ce9846ad52ec4dcca8ac0d52", "0xb0c81cbd0a36b13cee7f1a9c50a3f0b1262522f8aa71877cfacd974749f89b61", "0xb0b8e4b76116f5f4de7c84e913049a8ad1750a378e8d2b904214b29ff7775d3a", "0xb00740cecec519f1afe5c793d695743f9f8f44d0040cb69e3ddf7cbef4550a6b", "0xac49e8d11bc9913d946f23f0df1254e81241760207de4575b1f7204b42213d3d", "0xa11a6bf9e8dbc31037c8b43a777da63308756f791721761934e086b252824ee1", "0x9ee9bc8c5ee9c393cc092c8fae0fefff23cdcc9756ed57e8d202f494105d730b", "0x9cf3fa2fb436a526687ac5247189c8e0083207ade719c62aa405a603b6c3d6d7", "0x9a8a5f69289a7a31b6e3b3584128cfffab135826975251c33cc3bbb4364b83e0", "0x97799e3c02255e1cbe18367240c2a91a47d785319578f1eb5c7b4d782abaa00e", "0x8d86a09bd68063f051fd0f8b98f784a50eb1efb374bb6df256097b38989c718a", "0x8cf0fcb4c74b0f5d8c979dbe76682064b1b2bf478b3737a8e1bfd648884dbaed", "0x8a23ac363c6a9c7e43cfbc159c2ad8ebcafce3d5f46967c91ce5023c486e7dac", "0x7f35a6c717dec18ddc48ed3041ef6e581ef3cc28017d477da6141da36b777d08", "0x7b2e7119c62b87e355e86ab14850b347143d485f2812a925476acfa8441e9788", "0x7a0142fe4e0274909918658e619ce6d0d6b7b756cc5ae057d3c361dd138ecefb", "0x76e117921145ca1ba85ecd163206c28fc948d6a218e592aa1b401d90bef96d41", "0x755b17d3e8f01a3c77ec44272e6c614cdae5f90408ed34e88a8d742fc320c2ac", "0x7533a7a30ed38b47c52329883e3b01cf1700aa682394e6d830eee51d8a78605d", "0x73ad5f55e2c63cd7e78650395c249bd9400f7038eac6837fdb348239670ac198", "0x71d67959354f8d70b4a9be89b7831ca56afe75fb776de97d6ab5e27f1dd7a05e", "0x6f418e09c158b2df2c6731fca4df4f321a982fa0c5c7dd6df330320c84efde0d", "0x6c591a4eb00c26688a93b88fcc14d32ef81094b78246a1a626377d79611bc5e8", "0x6b862afcdf96199a873cd05f4b276fa98b8bece69def12d7d2e0b9ef64671449", "0x69808f366cda2da8117efc2e5842e56642f23d2776f7464d0aa0db8e4f2208c2", "0x64a4aafa1b14dce30f99d8f1c6aa725685f2d2192dc2980eac1175db45a0d811", "0x5feeede515cd4e374aa54f9752e2b9acedf65b2f9fdc85b52b60a89faecd8afa", "0x5f21f9a382ad83a7f428411b111da0e522f30b3e61fc72569c8a67ec81512056", "0x5e51af3fdcb29f1a2a2660e26003036ab7d544c0cc9c0ae99581659c13e4136f", "0x597ac419d75c8bcbe9bb5fbd6b1f2e905ba050bc109832469a4818b46567b2f0", "0x5762af64eb4d7702b347271b36856a4c37b5def94f93e0ea7ad32147e8ec0605", "0x56c4103c613d5448108488289db05a58c0888cad0a465825ab50063dbdbfc566", "0x50badf86b7f14c08cb5d35176ce8233926282435ebfbce510b271ab5e1f6d359", "0x504c2d73da68c1d29cdc10316203d0e0653d3ef80f9d9563b3eda995f2a6f1b9", "0x502b9b85d1d4a8600f5bde7e6c4d9544d1c6e304f37dab6f7e6064b13000a2eb", "0x4e071550bba8038843b0406f6e5c34da7bff314b7c05600a01f183e251176ceb", "0x447fa7a5dd7a74857dd1c9e3fb3bbbc89e9739dc94a0c33678baf5d9078a68bb", "0x3e9671f12c8fd9a6a59151fea8c5714c4ed401a12c0dd215080015ed413f8bf7", "0x3c73e7b83a0a23426db85dbed4acbdc1cbb24590efe6445b1853f80595686b81", "0x3a0fae6107f2ee5eb1e6835c0c2a92a86729cc85c27577b0addcd1eba06416b1", "0x39549ceff792a24128339c47b929f0a6da6e0f0d6cb1542f6a84ce68d2729dd5", "0x3850e7e43bceb68be5d87c98e83e968253e3eff9b8c2c8bd584e7aa909e6b760", "0x358cdd3efd06f67fc1f2c1e88fee9c1561d701a5344e2fd4086dad256b180222", "0x353fbb9712518325a78926699de202c7e89b497de4827d0f5ea437fec2dce53c", "0x33b5dd26f25ce27e73d78f7913cead5c22110805e8fa78afde5a64320a437f0d", "0x306240049c2fe3fc57591e055da16ede012ad52103e1dd104110e5e42c60735e", "0x29728caf6d3d9e1dadcc70be3f71e5f384cfd9e80fe71ec5251c88cf20c83df1", "0x27bba50f0e04f1dd66c09f78ce2285ed80ac4f4c34bfdda3de42cbe42b82fd20", "0x27810596db45d1acbfa3f40d5044237519038f3631a1781ecda30372c6cb8639", "0x1d2f97f2c9f7779d49df78734cd63896a9874790c14e477b0a6a4a4ef09768ca", "0x1a06124f838f10b1fbe1ea4c3de12048d7847a1ba3dbeccc72533a01b64b51f1", "0x143ec2c6bfec0c2eaaf0a59abe9321467c62992db32954bf8334ee035945378e", "0x1182e1a84d147773d7a94eb156152e50127ae378ef88d82a7202fe2467b3676c", "0x101ead93f10a289367a1662c6fe5d27e32dafdb067b9f177af85a2a3ff059d91", "0x0e576ceb5c2e4b561f9c976b23ae5c41ba86d36b87976629aaa5505f45b910a7", "0x0bee7bfa08325e37175c123132f793def08d3e2afa4073a34d634b38464c5863", "0x0940c4e513e8e7ba4c3ec2cb6c634789005fba51b565459459249e41c197ee25", "0x0883e44cb75e05f9ab9945d01b1b9bac0d997621698d4f7a5614e15d2ae97be5", "0x0314a9cbec1ec370abb35e3b1bbf2aef3ae1af6a3d5246575ef31fd0a69549a8"],
  "values": [{
    "value": ["0xaf2ab6d0e8f69656e7c8c967351de32f0d60fe76"],
    "treeIndex": 108
  }, {
    "value": ["0x45d6d9f604013b4f7442341b81a77fe4c391444f"],
    "treeIndex": 141
  }, {
    "value": ["0xd8ebbd43d9e4bed6edfeb78445ef64a721634552"],
    "treeIndex": 142
  }, {
    "value": ["0xf1aa941d56041d47a9a18e99609a047707fe96c7"],
    "treeIndex": 156
  }, {
    "value": ["0x1b0ba852d0b15143726d5d90f443f6939c6ae27a"],
    "treeIndex": 145
  }, {
    "value": ["0x1d5590436811f11e3b89ee74cb096abb4ecd0a2b"],
    "treeIndex": 122
  }, {
    "value": ["0x0659246fc6b9d0a0465da837865eff256b624fbc"],
    "treeIndex": 83
  }, {
    "value": ["0x99ec5fc2b35320ffb64b0ef55b231866b3acd727"],
    "treeIndex": 119
  }, {
    "value": ["0xaf583cfc0dd22bbaa9f3751db27509d497fa0c7a"],
    "treeIndex": 92
  }, {
    "value": ["0x5a202959d131e6c167c1b576387ccdc43be5acb8"],
    "treeIndex": 140
  }, {
    "value": ["0xd2e898bfbdb0dadee09d966920282d70ef7cc55b"],
    "treeIndex": 116
  }, {
    "value": ["0xf45cb82cf57390868feedf42a20ced61576a5a75"],
    "treeIndex": 153
  }, {
    "value": ["0xed8675eae36c0eff4163720019e40b2574ec6bd4"],
    "treeIndex": 120
  }, {
    "value": ["0x696ed7b26f4b019ceec78dc8b9140ad64a6f354b"],
    "treeIndex": 97
  }, {
    "value": ["0x02722a0842007112c67d3cf824bc8ee6cbc7858a"],
    "treeIndex": 154
  }, {
    "value": ["0x66bdc08a0db3a83d374670a57aa8ecd5b51b55e5"],
    "treeIndex": 114
  }, {
    "value": ["0x17ce637f49fa1025431262eac2cbc3bc9df6d4b8"],
    "treeIndex": 109
  }, {
    "value": ["0x1aa8fb4363fe0d3a0fc6decedcb083b79cde47c6"],
    "treeIndex": 131
  }, {
    "value": ["0x7345c5ebc0a037812a5e90b72c33a6decba9af83"],
    "treeIndex": 126
  }, {
    "value": ["0x0799f65277fcc80f717ffb6ac9a2921593cfc8d2"],
    "treeIndex": 90
  }, {
    "value": ["0x75e5536f29477db412f1f6e9d8756824a0240f2e"],
    "treeIndex": 136
  }, {
    "value": ["0x784f65ceb819372c35248b40787f12b165cc9acc"],
    "treeIndex": 80
  }, {
    "value": ["0x4b2b53ab8417452d77493c5e78bb6140d3951018"],
    "treeIndex": 130
  }, {
    "value": ["0x0b90c9a9fddbd99524f0a3ceaccbf2b81e8945f5"],
    "treeIndex": 155
  }, {
    "value": ["0x7cd7deb62fc17236fe411a9afcaa3b4936f624a2"],
    "treeIndex": 98
  }, {
    "value": ["0x0dcf7d7a78e19ac9d2cf1955259a2c733b09b7ec"],
    "treeIndex": 150
  }, {
    "value": ["0x322b9a4f95c8920eed3bd8338dedd0b309deb248"],
    "treeIndex": 112
  }, {
    "value": ["0xf15ff189ab4741c1501af7896956731a21404736"],
    "treeIndex": 143
  }, {
    "value": ["0x2f67a952b952593848d597102298acf9253b841b"],
    "treeIndex": 101
  }, {
    "value": ["0xac1eb7459af366444cc502d9b002e2eef577c02e"],
    "treeIndex": 100
  }, {
    "value": ["0x38012eaf414bfe674d6dd071d854e0bca4e39b1c"],
    "treeIndex": 106
  }, {
    "value": ["0x0d4178564cbf36e7eb7166bd9292080d2f7484c2"],
    "treeIndex": 94
  }, {
    "value": ["0xc8bfdfddf4c62a7a4d3d2c578e214fccd5f0f197"],
    "treeIndex": 86
  }, {
    "value": ["0xbb1513f5e6b7512f7fddfe1d26918eb58eb6b37e"],
    "treeIndex": 111
  }, {
    "value": ["0x20a0f9bab80d8f28ef33c4d1905cd5aa4ee1c2bd"],
    "treeIndex": 133
  }, {
    "value": ["0x8eb9c82469b52d2ace63b20ee04ad4d295921374"],
    "treeIndex": 151
  }, {
    "value": ["0xa18f4bad16c6756649fa3172a7de94d2b0d665d7"],
    "treeIndex": 132
  }, {
    "value": ["0xf42bea3d14951a476a7c58ca38524c408142c269"],
    "treeIndex": 110
  }, {
    "value": ["0x392bd6936f720056cfa331ed11f650c81447dc46"],
    "treeIndex": 128
  }, {
    "value": ["0x6d8a4ce3337c64d3aeb2136910c809b92ec829bf"],
    "treeIndex": 135
  }, {
    "value": ["0x2a878245b52a2d46cb4327541cbc96e403a84791"],
    "treeIndex": 78
  }, {
    "value": ["0x496182465b2bb36083043a77210836f421e61518"],
    "treeIndex": 146
  }, {
    "value": ["0x0e05fc263cb57db89aa9f32cc3f4743244520c45"],
    "treeIndex": 144
  }, {
    "value": ["0x1ba0558b8fac9c6c29dbc84ceaa654b9021937cb"],
    "treeIndex": 113
  }, {
    "value": ["0x753e4f46484ac89fdb55fb7083f1d3f43f6904a1"],
    "treeIndex": 99
  }, {
    "value": ["0x196d559eec9462b7c39f3d508290a2ceb9188291"],
    "treeIndex": 96
  }, {
    "value": ["0xf0c1d8c00190d7acefd6340d65fc5c8189315e61"],
    "treeIndex": 138
  }, {
    "value": ["0x380c6b58b66b88210ab2dcefe913e34588327f83"],
    "treeIndex": 148
  }, {
    "value": ["0x0f9ef34d0ad4b248742f5b4d2880ccef0415c3a8"],
    "treeIndex": 123
  }, {
    "value": ["0x139785b45a89b0922b23fe2401c3107917663ebd"],
    "treeIndex": 95
  }, {
    "value": ["0xbb610f0860599a70d0a85d80f806db1c8cff895c"],
    "treeIndex": 103
  }, {
    "value": ["0xfdc2b224cc1fd65d6cdccdd896510a7d89af81c3"],
    "treeIndex": 127
  }, {
    "value": ["0x0a105422135127f548ac9a6c9c6f0f2c46c8e1bf"],
    "treeIndex": 102
  }, {
    "value": ["0x490932e73525b9694a115e80edd717a0e56dca73"],
    "treeIndex": 89
  }, {
    "value": ["0x3860e090239d0dba44f2b8cb37adc81b0528a96f"],
    "treeIndex": 84
  }, {
    "value": ["0xac29c60b1876068daba2da7f6da933a65648f451"],
    "treeIndex": 134
  }, {
    "value": ["0x304018f69c2e3ad9564f52ac8acdddc28cf39dca"],
    "treeIndex": 124
  }, {
    "value": ["0x107a7478d00378a123f2f9b947e6213a7b38b23b"],
    "treeIndex": 93
  }, {
    "value": ["0xc87b84062304746351e0310afe0e3026b983be61"],
    "treeIndex": 82
  }, {
    "value": ["0x33d05eef1dec691c7006bd007f9826881d25aaaa"],
    "treeIndex": 129
  }, {
    "value": ["0x63a5922c11eeaaa090138001e5ba1cc13f8bc3dd"],
    "treeIndex": 118
  }, {
    "value": ["0xe9ad6041bfd863415fd483bc2471db2dfd065a0b"],
    "treeIndex": 104
  }, {
    "value": ["0x6608e406009c849ce17a49c1264f28b5d6bc31d2"],
    "treeIndex": 139
  }, {
    "value": ["0x0d869a936f7faf615e584dba700951b5972d5fb3"],
    "treeIndex": 147
  }, {
    "value": ["0x67159a44a0ebef5af3efd2502d6a96ddaf73fe97"],
    "treeIndex": 91
  }, {
    "value": ["0x516fc698fb46506aa983a14f40b30c908d86dc82"],
    "treeIndex": 85
  }, {
    "value": ["0xd88f08d57189bc1f1498d6851d45b9eca432ba26"],
    "treeIndex": 121
  }, {
    "value": ["0xd47fe7a287cd3025dfe1d09448ad9c592b7f16ef"],
    "treeIndex": 137
  }, {
    "value": ["0xedcb0669354f39b125343307cafde64d83e6707c"],
    "treeIndex": 115
  }, {
    "value": ["0xb04a0314abc2f6fb3a734d29e9d6b7668e171e8a"],
    "treeIndex": 107
  }, {
    "value": ["0xee54d24f450b000eceb12ef1514c9256da9f9235"],
    "treeIndex": 125
  }, {
    "value": ["0xf7b6409b12a540947688f054dbf5b629fb3fc7d8"],
    "treeIndex": 88
  }, {
    "value": ["0xed4d252909017999204d4eb4f1b02b467bb40fba"],
    "treeIndex": 87
  }, {
    "value": ["0xac8d3da0441d96841087956f1323a974b38ad798"],
    "treeIndex": 81
  }, {
    "value": ["0xd57a2b712e644c3eeb6555d2390e9b6b1201fbc3"],
    "treeIndex": 149
  }, {
    "value": ["0x8eec357d3816e04986c1c73edfc82f9988c7da6a"],
    "treeIndex": 117
  }, {
    "value": ["0x7b51ac1a0f44a63ccf73282a7ddb290007ee6f5b"],
    "treeIndex": 105
  }, {
    "value": ["0xe8c7d4d0c76f7363806d847f8059e493286bc88a"],
    "treeIndex": 152
  }, {
    "value": ["0x364da6fc06c67b246086edd0ba5650f420fe10a3"],
    "treeIndex": 79
  }],
  "leafEncoding": ["address"]
};
const contractAddress = '0x7BB93915Bc524BcF1DdFbD0ccfe6Fbda2dEac782';
function getRandomPhunkURL() {
  const id = Math.floor(Math.random() * 10000).toString();
  return getPhunkURL(id);
}
function getPhunkURL(id) {
  const url = `./original_punks_images/punk${id.padStart(4, '0')}.png`;
  return url;
}
let running = false;
let unlimited = true;
let stopUnlimitedRequested = false;
const phunkToFrame = [[15, 55], [15, 225], [15, 405], [15, 580], [170, 580], [170, 405], [170, 225], [170, 55]];
const urlParams = new URLSearchParams(window.location.search);
const demo = urlParams.get('demo') === 'true';
if (demo) {
  alert('demo mode activated');
}
let duration = 180,
  decay = 1.1;
let random = Math.floor(Math.random() * 8);
let ticks = 8 * 2 + random + 2; // the 2 is needed to get the random part to start from 0 after some turns

function animateFrameTo(phunkOffset, duration) {
  const id = `#phunk${phunkOffset + 1}`;
  // console.log('animateFrameTo', id, duration)
  const x = phunkToFrame[phunkOffset][0];
  const y = phunkToFrame[phunkOffset][1];
  $(".frame").each((_, elem) => {
    $(elem).animate({
      top: `${x}px`,
      left: `${y}px`
    }, duration, () => {
      if (!elem.classList.contains("frame-inner")) return;
      phunkOffset++;
      if (phunkOffset > 7) {
        phunkOffset = 0;
        if (stopUnlimitedRequested) {
          unlimited = false;
          stopUnlimitedRequested = false;
        }
      }
      if (!unlimited) ticks--;
      if (ticks > 0) {
        const newDuration = unlimited ? duration : duration * decay;
        animateFrameTo(phunkOffset, newDuration);
      } else {
        const container = document.querySelector('.firework');
        const fireworks = new Fireworks.default(container);
        fireworks.start();
      }
    });
  });
}
window.animateFrameTo = animateFrameTo;
function preload(arrayOfImages) {
  $(arrayOfImages).each(function () {
    $('<img/>')[0].src = this;
  });
}
function startFrameAnimation() {
  running = true;
  $("body").addClass("running");
  $(".frame").addClass("shown");
  setTimeout(() => {
    animateFrameTo(0, duration);
  }, 700);
}
const phunks = [getRandomPhunkURL(), getRandomPhunkURL(), getRandomPhunkURL(), getRandomPhunkURL(), getRandomPhunkURL(), getRandomPhunkURL(), getRandomPhunkURL(), getRandomPhunkURL()];
preload(phunks);
window.onload = () => {
  for (let i = 0; i < 8; i++) {
    const id = `#phunk${i + 1}`;
    $(id).data("phunk", phunks[i]).attr(`data-phunk`, phunks[i]);
    $(id).addClass("flipped");
  }
  setTimeout(() => {
    $(".container").addClass("shown");
  }, 300);
  setTimeout(() => {
    $(".images li").each((index, item) => {
      setTimeout(() => {
        $(item).removeClass("flipped").removeClass("hidden").css("background-image", `url('philip.png')`);
      }, index * 150 + 100);
    });
    setTimeout(() => $(".start").addClass("shown"), 1400);
  }, 1200);
  setInterval(() => {
    if (!running) return;
    const position = $(".frame-background").position();
    let x = null;
    if (position.top === 25) {
      if (position.left <= 165) x = 1;else if (position.left <= 325) x = 2;else if (position.left <= 520) x = 3;else x = 4;
    } else if (position.top > 150) {
      if (position.left >= 480) x = 8;else if (position.left >= 265) x = 7;else if (position.left >= 125) x = 6;else x = 5;
    }
    if (x) {
      const id = `#phunk${x}`;
      $(".images li").removeClass("flipped").css("background-image", `url('philip.png')`);
      $(id).addClass("flipped");
      if (!unlimited) $(id).css("background-image", `url(${$(id).data("phunk")})`);
    }
  }, 1000 / 25);
  window.ethereum.on("networkChanged", network => {
    window.reload();
  });
  $(".start").click(async () => {
    if ($(".start").hasClass("disabled")) {
      return;
    }
    $(".start").addClass("disabled");
    if (!demo) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const account = await provider.send("eth_requestAccounts", []);
      const signer = provider.getSigner();
      const chain = await provider.getNetwork();
      console.log(account, chain);
      const tree = _merkleTree.StandardMerkleTree.load(merkleTree);
      let proof = null;
      for (const [i, v] of tree.entries()) {
        if (v[0].toLowerCase() === account[0].toLowerCase()) {
          proof = tree.getProof(i);
        }
      }
      if (!proof) {
        alert(`Wallet ${account[0]} isn't eligible to mint!`);
        return;
      }
      const contract = new ethers.Contract(contractAddress, ABI, signer);
      try {
        const transaction = await contract.mint(proof);
        startFrameAnimation();
        await transaction.wait();
        console.log(transaction);
        const receipt = await provider.getTransactionReceipt(transaction.hash);
        console.log(receipt);
        const phunkId = receipt.logs.filter(l => l.topics[0] === "0x32dd7bdf9af0f300b46e907e075f2e53cb0f34041d6b036427c56d3949829c73")[0].topics[1];
        const phunkIdInt = parseInt(phunkId.substring(2), 16);
        stopUnlimitedRequested = true;
        // because the numbering is in the other way around for the bottom line
        const id = random === 4 ? `#phunk8` : random === 5 ? `#phunk7` : random === 6 ? `#phunk6` : random === 7 ? `#phunk5` : `#phunk${random + 1}`;
        const url = getPhunkURL(phunkIdInt.toString());
        console.log('minted', id, phunkId, phunkIdInt, 'random', random, 'ticks', 'ticks');
        $(id).data("phunk", url).attr(`data-phunk`, url);
      } catch (err) {
        if (err.error && err.error.hasOwnProperty('message')) {
          alert(err.error.message);
        }
        console.error(err);
        $(".start").removeClass("disabled");
        running = false;
        $("body").removeClass("running");
      }
    } else {
      startFrameAnimation();
      setTimeout(() => {
        stopUnlimitedRequested = true;
      }, 8000);
    }
  });
};

},{"@openzeppelin/merkle-tree":61}],2:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.version = void 0;
const version = exports.version = "abi/5.7.0";

},{}],3:[function(require,module,exports){
"use strict";

// See: https://github.com/ethereum/wiki/wiki/Ethereum-Contract-ABI
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defaultAbiCoder = exports.AbiCoder = void 0;
var _bytes = require("@ethersproject/bytes");
var _properties = require("@ethersproject/properties");
var _logger = require("@ethersproject/logger");
var _version = require("./_version");
var _abstractCoder = require("./coders/abstract-coder");
var _address = require("./coders/address");
var _array = require("./coders/array");
var _boolean = require("./coders/boolean");
var _bytes2 = require("./coders/bytes");
var _fixedBytes = require("./coders/fixed-bytes");
var _null = require("./coders/null");
var _number = require("./coders/number");
var _string = require("./coders/string");
var _tuple = require("./coders/tuple");
var _fragments = require("./fragments");
const logger = new _logger.Logger(_version.version);
const paramTypeBytes = new RegExp(/^bytes([0-9]*)$/);
const paramTypeNumber = new RegExp(/^(u?int)([0-9]*)$/);
class AbiCoder {
  constructor(coerceFunc) {
    (0, _properties.defineReadOnly)(this, "coerceFunc", coerceFunc || null);
  }
  _getCoder(param) {
    switch (param.baseType) {
      case "address":
        return new _address.AddressCoder(param.name);
      case "bool":
        return new _boolean.BooleanCoder(param.name);
      case "string":
        return new _string.StringCoder(param.name);
      case "bytes":
        return new _bytes2.BytesCoder(param.name);
      case "array":
        return new _array.ArrayCoder(this._getCoder(param.arrayChildren), param.arrayLength, param.name);
      case "tuple":
        return new _tuple.TupleCoder((param.components || []).map(component => {
          return this._getCoder(component);
        }), param.name);
      case "":
        return new _null.NullCoder(param.name);
    }
    // u?int[0-9]*
    let match = param.type.match(paramTypeNumber);
    if (match) {
      let size = parseInt(match[2] || "256");
      if (size === 0 || size > 256 || size % 8 !== 0) {
        logger.throwArgumentError("invalid " + match[1] + " bit length", "param", param);
      }
      return new _number.NumberCoder(size / 8, match[1] === "int", param.name);
    }
    // bytes[0-9]+
    match = param.type.match(paramTypeBytes);
    if (match) {
      let size = parseInt(match[1]);
      if (size === 0 || size > 32) {
        logger.throwArgumentError("invalid bytes length", "param", param);
      }
      return new _fixedBytes.FixedBytesCoder(size, param.name);
    }
    return logger.throwArgumentError("invalid type", "type", param.type);
  }
  _getWordSize() {
    return 32;
  }
  _getReader(data, allowLoose) {
    return new _abstractCoder.Reader(data, this._getWordSize(), this.coerceFunc, allowLoose);
  }
  _getWriter() {
    return new _abstractCoder.Writer(this._getWordSize());
  }
  getDefaultValue(types) {
    const coders = types.map(type => this._getCoder(_fragments.ParamType.from(type)));
    const coder = new _tuple.TupleCoder(coders, "_");
    return coder.defaultValue();
  }
  encode(types, values) {
    if (types.length !== values.length) {
      logger.throwError("types/values length mismatch", _logger.Logger.errors.INVALID_ARGUMENT, {
        count: {
          types: types.length,
          values: values.length
        },
        value: {
          types: types,
          values: values
        }
      });
    }
    const coders = types.map(type => this._getCoder(_fragments.ParamType.from(type)));
    const coder = new _tuple.TupleCoder(coders, "_");
    const writer = this._getWriter();
    coder.encode(writer, values);
    return writer.data;
  }
  decode(types, data, loose) {
    const coders = types.map(type => this._getCoder(_fragments.ParamType.from(type)));
    const coder = new _tuple.TupleCoder(coders, "_");
    return coder.decode(this._getReader((0, _bytes.arrayify)(data), loose));
  }
}
exports.AbiCoder = AbiCoder;
const defaultAbiCoder = exports.defaultAbiCoder = new AbiCoder();

},{"./_version":2,"./coders/abstract-coder":4,"./coders/address":5,"./coders/array":7,"./coders/boolean":8,"./coders/bytes":9,"./coders/fixed-bytes":10,"./coders/null":11,"./coders/number":12,"./coders/string":13,"./coders/tuple":14,"./fragments":15,"@ethersproject/bytes":27,"@ethersproject/logger":44,"@ethersproject/properties":46}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Writer = exports.Reader = exports.Coder = void 0;
exports.checkResultErrors = checkResultErrors;
var _bytes = require("@ethersproject/bytes");
var _bignumber = require("@ethersproject/bignumber");
var _properties = require("@ethersproject/properties");
var _logger = require("@ethersproject/logger");
var _version = require("../_version");
const logger = new _logger.Logger(_version.version);
function checkResultErrors(result) {
  // Find the first error (if any)
  const errors = [];
  const checkErrors = function (path, object) {
    if (!Array.isArray(object)) {
      return;
    }
    for (let key in object) {
      const childPath = path.slice();
      childPath.push(key);
      try {
        checkErrors(childPath, object[key]);
      } catch (error) {
        errors.push({
          path: childPath,
          error: error
        });
      }
    }
  };
  checkErrors([], result);
  return errors;
}
class Coder {
  constructor(name, type, localName, dynamic) {
    // @TODO: defineReadOnly these
    this.name = name;
    this.type = type;
    this.localName = localName;
    this.dynamic = dynamic;
  }
  _throwError(message, value) {
    logger.throwArgumentError(message, this.localName, value);
  }
}
exports.Coder = Coder;
class Writer {
  constructor(wordSize) {
    (0, _properties.defineReadOnly)(this, "wordSize", wordSize || 32);
    this._data = [];
    this._dataLength = 0;
    this._padding = new Uint8Array(wordSize);
  }
  get data() {
    return (0, _bytes.hexConcat)(this._data);
  }
  get length() {
    return this._dataLength;
  }
  _writeData(data) {
    this._data.push(data);
    this._dataLength += data.length;
    return data.length;
  }
  appendWriter(writer) {
    return this._writeData((0, _bytes.concat)(writer._data));
  }
  // Arrayish items; padded on the right to wordSize
  writeBytes(value) {
    let bytes = (0, _bytes.arrayify)(value);
    const paddingOffset = bytes.length % this.wordSize;
    if (paddingOffset) {
      bytes = (0, _bytes.concat)([bytes, this._padding.slice(paddingOffset)]);
    }
    return this._writeData(bytes);
  }
  _getValue(value) {
    let bytes = (0, _bytes.arrayify)(_bignumber.BigNumber.from(value));
    if (bytes.length > this.wordSize) {
      logger.throwError("value out-of-bounds", _logger.Logger.errors.BUFFER_OVERRUN, {
        length: this.wordSize,
        offset: bytes.length
      });
    }
    if (bytes.length % this.wordSize) {
      bytes = (0, _bytes.concat)([this._padding.slice(bytes.length % this.wordSize), bytes]);
    }
    return bytes;
  }
  // BigNumberish items; padded on the left to wordSize
  writeValue(value) {
    return this._writeData(this._getValue(value));
  }
  writeUpdatableValue() {
    const offset = this._data.length;
    this._data.push(this._padding);
    this._dataLength += this.wordSize;
    return value => {
      this._data[offset] = this._getValue(value);
    };
  }
}
exports.Writer = Writer;
class Reader {
  constructor(data, wordSize, coerceFunc, allowLoose) {
    (0, _properties.defineReadOnly)(this, "_data", (0, _bytes.arrayify)(data));
    (0, _properties.defineReadOnly)(this, "wordSize", wordSize || 32);
    (0, _properties.defineReadOnly)(this, "_coerceFunc", coerceFunc);
    (0, _properties.defineReadOnly)(this, "allowLoose", allowLoose);
    this._offset = 0;
  }
  get data() {
    return (0, _bytes.hexlify)(this._data);
  }
  get consumed() {
    return this._offset;
  }
  // The default Coerce function
  static coerce(name, value) {
    let match = name.match("^u?int([0-9]+)$");
    if (match && parseInt(match[1]) <= 48) {
      value = value.toNumber();
    }
    return value;
  }
  coerce(name, value) {
    if (this._coerceFunc) {
      return this._coerceFunc(name, value);
    }
    return Reader.coerce(name, value);
  }
  _peekBytes(offset, length, loose) {
    let alignedLength = Math.ceil(length / this.wordSize) * this.wordSize;
    if (this._offset + alignedLength > this._data.length) {
      if (this.allowLoose && loose && this._offset + length <= this._data.length) {
        alignedLength = length;
      } else {
        logger.throwError("data out-of-bounds", _logger.Logger.errors.BUFFER_OVERRUN, {
          length: this._data.length,
          offset: this._offset + alignedLength
        });
      }
    }
    return this._data.slice(this._offset, this._offset + alignedLength);
  }
  subReader(offset) {
    return new Reader(this._data.slice(this._offset + offset), this.wordSize, this._coerceFunc, this.allowLoose);
  }
  readBytes(length, loose) {
    let bytes = this._peekBytes(0, length, !!loose);
    this._offset += bytes.length;
    // @TODO: Make sure the length..end bytes are all 0?
    return bytes.slice(0, length);
  }
  readValue() {
    return _bignumber.BigNumber.from(this.readBytes(this.wordSize));
  }
}
exports.Reader = Reader;

},{"../_version":2,"@ethersproject/bignumber":25,"@ethersproject/bytes":27,"@ethersproject/logger":44,"@ethersproject/properties":46}],5:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AddressCoder = void 0;
var _address = require("@ethersproject/address");
var _bytes = require("@ethersproject/bytes");
var _abstractCoder = require("./abstract-coder");
class AddressCoder extends _abstractCoder.Coder {
  constructor(localName) {
    super("address", "address", localName, false);
  }
  defaultValue() {
    return "0x0000000000000000000000000000000000000000";
  }
  encode(writer, value) {
    try {
      value = (0, _address.getAddress)(value);
    } catch (error) {
      this._throwError(error.message, value);
    }
    return writer.writeValue(value);
  }
  decode(reader) {
    return (0, _address.getAddress)((0, _bytes.hexZeroPad)(reader.readValue().toHexString(), 20));
  }
}
exports.AddressCoder = AddressCoder;

},{"./abstract-coder":4,"@ethersproject/address":19,"@ethersproject/bytes":27}],6:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AnonymousCoder = void 0;
var _abstractCoder = require("./abstract-coder");
// Clones the functionality of an existing Coder, but without a localName
class AnonymousCoder extends _abstractCoder.Coder {
  constructor(coder) {
    super(coder.name, coder.type, undefined, coder.dynamic);
    this.coder = coder;
  }
  defaultValue() {
    return this.coder.defaultValue();
  }
  encode(writer, value) {
    return this.coder.encode(writer, value);
  }
  decode(reader) {
    return this.coder.decode(reader);
  }
}
exports.AnonymousCoder = AnonymousCoder;

},{"./abstract-coder":4}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ArrayCoder = void 0;
exports.pack = pack;
exports.unpack = unpack;
var _logger = require("@ethersproject/logger");
var _version = require("../_version");
var _abstractCoder = require("./abstract-coder");
var _anonymous = require("./anonymous");
const logger = new _logger.Logger(_version.version);
function pack(writer, coders, values) {
  let arrayValues = null;
  if (Array.isArray(values)) {
    arrayValues = values;
  } else if (values && typeof values === "object") {
    let unique = {};
    arrayValues = coders.map(coder => {
      const name = coder.localName;
      if (!name) {
        logger.throwError("cannot encode object for signature with missing names", _logger.Logger.errors.INVALID_ARGUMENT, {
          argument: "values",
          coder: coder,
          value: values
        });
      }
      if (unique[name]) {
        logger.throwError("cannot encode object for signature with duplicate names", _logger.Logger.errors.INVALID_ARGUMENT, {
          argument: "values",
          coder: coder,
          value: values
        });
      }
      unique[name] = true;
      return values[name];
    });
  } else {
    logger.throwArgumentError("invalid tuple value", "tuple", values);
  }
  if (coders.length !== arrayValues.length) {
    logger.throwArgumentError("types/value length mismatch", "tuple", values);
  }
  let staticWriter = new _abstractCoder.Writer(writer.wordSize);
  let dynamicWriter = new _abstractCoder.Writer(writer.wordSize);
  let updateFuncs = [];
  coders.forEach((coder, index) => {
    let value = arrayValues[index];
    if (coder.dynamic) {
      // Get current dynamic offset (for the future pointer)
      let dynamicOffset = dynamicWriter.length;
      // Encode the dynamic value into the dynamicWriter
      coder.encode(dynamicWriter, value);
      // Prepare to populate the correct offset once we are done
      let updateFunc = staticWriter.writeUpdatableValue();
      updateFuncs.push(baseOffset => {
        updateFunc(baseOffset + dynamicOffset);
      });
    } else {
      coder.encode(staticWriter, value);
    }
  });
  // Backfill all the dynamic offsets, now that we know the static length
  updateFuncs.forEach(func => {
    func(staticWriter.length);
  });
  let length = writer.appendWriter(staticWriter);
  length += writer.appendWriter(dynamicWriter);
  return length;
}
function unpack(reader, coders) {
  let values = [];
  // A reader anchored to this base
  let baseReader = reader.subReader(0);
  coders.forEach(coder => {
    let value = null;
    if (coder.dynamic) {
      let offset = reader.readValue();
      let offsetReader = baseReader.subReader(offset.toNumber());
      try {
        value = coder.decode(offsetReader);
      } catch (error) {
        // Cannot recover from this
        if (error.code === _logger.Logger.errors.BUFFER_OVERRUN) {
          throw error;
        }
        value = error;
        value.baseType = coder.name;
        value.name = coder.localName;
        value.type = coder.type;
      }
    } else {
      try {
        value = coder.decode(reader);
      } catch (error) {
        // Cannot recover from this
        if (error.code === _logger.Logger.errors.BUFFER_OVERRUN) {
          throw error;
        }
        value = error;
        value.baseType = coder.name;
        value.name = coder.localName;
        value.type = coder.type;
      }
    }
    if (value != undefined) {
      values.push(value);
    }
  });
  // We only output named properties for uniquely named coders
  const uniqueNames = coders.reduce((accum, coder) => {
    const name = coder.localName;
    if (name) {
      if (!accum[name]) {
        accum[name] = 0;
      }
      accum[name]++;
    }
    return accum;
  }, {});
  // Add any named parameters (i.e. tuples)
  coders.forEach((coder, index) => {
    let name = coder.localName;
    if (!name || uniqueNames[name] !== 1) {
      return;
    }
    if (name === "length") {
      name = "_length";
    }
    if (values[name] != null) {
      return;
    }
    const value = values[index];
    if (value instanceof Error) {
      Object.defineProperty(values, name, {
        enumerable: true,
        get: () => {
          throw value;
        }
      });
    } else {
      values[name] = value;
    }
  });
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (value instanceof Error) {
      Object.defineProperty(values, i, {
        enumerable: true,
        get: () => {
          throw value;
        }
      });
    }
  }
  return Object.freeze(values);
}
class ArrayCoder extends _abstractCoder.Coder {
  constructor(coder, length, localName) {
    const type = coder.type + "[" + (length >= 0 ? length : "") + "]";
    const dynamic = length === -1 || coder.dynamic;
    super("array", type, localName, dynamic);
    this.coder = coder;
    this.length = length;
  }
  defaultValue() {
    // Verifies the child coder is valid (even if the array is dynamic or 0-length)
    const defaultChild = this.coder.defaultValue();
    const result = [];
    for (let i = 0; i < this.length; i++) {
      result.push(defaultChild);
    }
    return result;
  }
  encode(writer, value) {
    if (!Array.isArray(value)) {
      this._throwError("expected array value", value);
    }
    let count = this.length;
    if (count === -1) {
      count = value.length;
      writer.writeValue(value.length);
    }
    logger.checkArgumentCount(value.length, count, "coder array" + (this.localName ? " " + this.localName : ""));
    let coders = [];
    for (let i = 0; i < value.length; i++) {
      coders.push(this.coder);
    }
    return pack(writer, coders, value);
  }
  decode(reader) {
    let count = this.length;
    if (count === -1) {
      count = reader.readValue().toNumber();
      // Check that there is *roughly* enough data to ensure
      // stray random data is not being read as a length. Each
      // slot requires at least 32 bytes for their value (or 32
      // bytes as a link to the data). This could use a much
      // tighter bound, but we are erroring on the side of safety.
      if (count * 32 > reader._data.length) {
        logger.throwError("insufficient data length", _logger.Logger.errors.BUFFER_OVERRUN, {
          length: reader._data.length,
          count: count
        });
      }
    }
    let coders = [];
    for (let i = 0; i < count; i++) {
      coders.push(new _anonymous.AnonymousCoder(this.coder));
    }
    return reader.coerce(this.name, unpack(reader, coders));
  }
}
exports.ArrayCoder = ArrayCoder;

},{"../_version":2,"./abstract-coder":4,"./anonymous":6,"@ethersproject/logger":44}],8:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BooleanCoder = void 0;
var _abstractCoder = require("./abstract-coder");
class BooleanCoder extends _abstractCoder.Coder {
  constructor(localName) {
    super("bool", "bool", localName, false);
  }
  defaultValue() {
    return false;
  }
  encode(writer, value) {
    return writer.writeValue(value ? 1 : 0);
  }
  decode(reader) {
    return reader.coerce(this.type, !reader.readValue().isZero());
  }
}
exports.BooleanCoder = BooleanCoder;

},{"./abstract-coder":4}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.DynamicBytesCoder = exports.BytesCoder = void 0;
var _bytes = require("@ethersproject/bytes");
var _abstractCoder = require("./abstract-coder");
class DynamicBytesCoder extends _abstractCoder.Coder {
  constructor(type, localName) {
    super(type, type, localName, true);
  }
  defaultValue() {
    return "0x";
  }
  encode(writer, value) {
    value = (0, _bytes.arrayify)(value);
    let length = writer.writeValue(value.length);
    length += writer.writeBytes(value);
    return length;
  }
  decode(reader) {
    return reader.readBytes(reader.readValue().toNumber(), true);
  }
}
exports.DynamicBytesCoder = DynamicBytesCoder;
class BytesCoder extends DynamicBytesCoder {
  constructor(localName) {
    super("bytes", localName);
  }
  decode(reader) {
    return reader.coerce(this.name, (0, _bytes.hexlify)(super.decode(reader)));
  }
}
exports.BytesCoder = BytesCoder;

},{"./abstract-coder":4,"@ethersproject/bytes":27}],10:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FixedBytesCoder = void 0;
var _bytes = require("@ethersproject/bytes");
var _abstractCoder = require("./abstract-coder");
// @TODO: Merge this with bytes
class FixedBytesCoder extends _abstractCoder.Coder {
  constructor(size, localName) {
    let name = "bytes" + String(size);
    super(name, name, localName, false);
    this.size = size;
  }
  defaultValue() {
    return "0x0000000000000000000000000000000000000000000000000000000000000000".substring(0, 2 + this.size * 2);
  }
  encode(writer, value) {
    let data = (0, _bytes.arrayify)(value);
    if (data.length !== this.size) {
      this._throwError("incorrect data length", value);
    }
    return writer.writeBytes(data);
  }
  decode(reader) {
    return reader.coerce(this.name, (0, _bytes.hexlify)(reader.readBytes(this.size)));
  }
}
exports.FixedBytesCoder = FixedBytesCoder;

},{"./abstract-coder":4,"@ethersproject/bytes":27}],11:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NullCoder = void 0;
var _abstractCoder = require("./abstract-coder");
class NullCoder extends _abstractCoder.Coder {
  constructor(localName) {
    super("null", "", localName, false);
  }
  defaultValue() {
    return null;
  }
  encode(writer, value) {
    if (value != null) {
      this._throwError("not null", value);
    }
    return writer.writeBytes([]);
  }
  decode(reader) {
    reader.readBytes(0);
    return reader.coerce(this.name, null);
  }
}
exports.NullCoder = NullCoder;

},{"./abstract-coder":4}],12:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.NumberCoder = void 0;
var _bignumber = require("@ethersproject/bignumber");
var _constants = require("@ethersproject/constants");
var _abstractCoder = require("./abstract-coder");
class NumberCoder extends _abstractCoder.Coder {
  constructor(size, signed, localName) {
    const name = (signed ? "int" : "uint") + size * 8;
    super(name, name, localName, false);
    this.size = size;
    this.signed = signed;
  }
  defaultValue() {
    return 0;
  }
  encode(writer, value) {
    let v = _bignumber.BigNumber.from(value);
    // Check bounds are safe for encoding
    let maxUintValue = _constants.MaxUint256.mask(writer.wordSize * 8);
    if (this.signed) {
      let bounds = maxUintValue.mask(this.size * 8 - 1);
      if (v.gt(bounds) || v.lt(bounds.add(_constants.One).mul(_constants.NegativeOne))) {
        this._throwError("value out-of-bounds", value);
      }
    } else if (v.lt(_constants.Zero) || v.gt(maxUintValue.mask(this.size * 8))) {
      this._throwError("value out-of-bounds", value);
    }
    v = v.toTwos(this.size * 8).mask(this.size * 8);
    if (this.signed) {
      v = v.fromTwos(this.size * 8).toTwos(8 * writer.wordSize);
    }
    return writer.writeValue(v);
  }
  decode(reader) {
    let value = reader.readValue().mask(this.size * 8);
    if (this.signed) {
      value = value.fromTwos(this.size * 8);
    }
    return reader.coerce(this.name, value);
  }
}
exports.NumberCoder = NumberCoder;

},{"./abstract-coder":4,"@ethersproject/bignumber":25,"@ethersproject/constants":31}],13:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.StringCoder = void 0;
var _strings = require("@ethersproject/strings");
var _bytes = require("./bytes");
class StringCoder extends _bytes.DynamicBytesCoder {
  constructor(localName) {
    super("string", localName);
  }
  defaultValue() {
    return "";
  }
  encode(writer, value) {
    return super.encode(writer, (0, _strings.toUtf8Bytes)(value));
  }
  decode(reader) {
    return (0, _strings.toUtf8String)(super.decode(reader));
  }
}
exports.StringCoder = StringCoder;

},{"./bytes":9,"@ethersproject/strings":52}],14:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TupleCoder = void 0;
var _abstractCoder = require("./abstract-coder");
var _array = require("./array");
class TupleCoder extends _abstractCoder.Coder {
  constructor(coders, localName) {
    let dynamic = false;
    const types = [];
    coders.forEach(coder => {
      if (coder.dynamic) {
        dynamic = true;
      }
      types.push(coder.type);
    });
    const type = "tuple(" + types.join(",") + ")";
    super("tuple", type, localName, dynamic);
    this.coders = coders;
  }
  defaultValue() {
    const values = [];
    this.coders.forEach(coder => {
      values.push(coder.defaultValue());
    });
    // We only output named properties for uniquely named coders
    const uniqueNames = this.coders.reduce((accum, coder) => {
      const name = coder.localName;
      if (name) {
        if (!accum[name]) {
          accum[name] = 0;
        }
        accum[name]++;
      }
      return accum;
    }, {});
    // Add named values
    this.coders.forEach((coder, index) => {
      let name = coder.localName;
      if (!name || uniqueNames[name] !== 1) {
        return;
      }
      if (name === "length") {
        name = "_length";
      }
      if (values[name] != null) {
        return;
      }
      values[name] = values[index];
    });
    return Object.freeze(values);
  }
  encode(writer, value) {
    return (0, _array.pack)(writer, this.coders, value);
  }
  decode(reader) {
    return reader.coerce(this.name, (0, _array.unpack)(reader, this.coders));
  }
}
exports.TupleCoder = TupleCoder;

},{"./abstract-coder":4,"./array":7}],15:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ParamType = exports.FunctionFragment = exports.Fragment = exports.FormatTypes = exports.EventFragment = exports.ErrorFragment = exports.ConstructorFragment = void 0;
var _bignumber = require("@ethersproject/bignumber");
var _properties = require("@ethersproject/properties");
var _logger = require("@ethersproject/logger");
var _version = require("./_version");
const logger = new _logger.Logger(_version.version);
;
const _constructorGuard = {};
let ModifiersBytes = {
  calldata: true,
  memory: true,
  storage: true
};
let ModifiersNest = {
  calldata: true,
  memory: true
};
function checkModifier(type, name) {
  if (type === "bytes" || type === "string") {
    if (ModifiersBytes[name]) {
      return true;
    }
  } else if (type === "address") {
    if (name === "payable") {
      return true;
    }
  } else if (type.indexOf("[") >= 0 || type === "tuple") {
    if (ModifiersNest[name]) {
      return true;
    }
  }
  if (ModifiersBytes[name] || name === "payable") {
    logger.throwArgumentError("invalid modifier", "name", name);
  }
  return false;
}
// @TODO: Make sure that children of an indexed tuple are marked with a null indexed
function parseParamType(param, allowIndexed) {
  let originalParam = param;
  function throwError(i) {
    logger.throwArgumentError(`unexpected character at position ${i}`, "param", param);
  }
  param = param.replace(/\s/g, " ");
  function newNode(parent) {
    let node = {
      type: "",
      name: "",
      parent: parent,
      state: {
        allowType: true
      }
    };
    if (allowIndexed) {
      node.indexed = false;
    }
    return node;
  }
  let parent = {
    type: "",
    name: "",
    state: {
      allowType: true
    }
  };
  let node = parent;
  for (let i = 0; i < param.length; i++) {
    let c = param[i];
    switch (c) {
      case "(":
        if (node.state.allowType && node.type === "") {
          node.type = "tuple";
        } else if (!node.state.allowParams) {
          throwError(i);
        }
        node.state.allowType = false;
        node.type = verifyType(node.type);
        node.components = [newNode(node)];
        node = node.components[0];
        break;
      case ")":
        delete node.state;
        if (node.name === "indexed") {
          if (!allowIndexed) {
            throwError(i);
          }
          node.indexed = true;
          node.name = "";
        }
        if (checkModifier(node.type, node.name)) {
          node.name = "";
        }
        node.type = verifyType(node.type);
        let child = node;
        node = node.parent;
        if (!node) {
          throwError(i);
        }
        delete child.parent;
        node.state.allowParams = false;
        node.state.allowName = true;
        node.state.allowArray = true;
        break;
      case ",":
        delete node.state;
        if (node.name === "indexed") {
          if (!allowIndexed) {
            throwError(i);
          }
          node.indexed = true;
          node.name = "";
        }
        if (checkModifier(node.type, node.name)) {
          node.name = "";
        }
        node.type = verifyType(node.type);
        let sibling = newNode(node.parent);
        //{ type: "", name: "", parent: node.parent, state: { allowType: true } };
        node.parent.components.push(sibling);
        delete node.parent;
        node = sibling;
        break;
      // Hit a space...
      case " ":
        // If reading type, the type is done and may read a param or name
        if (node.state.allowType) {
          if (node.type !== "") {
            node.type = verifyType(node.type);
            delete node.state.allowType;
            node.state.allowName = true;
            node.state.allowParams = true;
          }
        }
        // If reading name, the name is done
        if (node.state.allowName) {
          if (node.name !== "") {
            if (node.name === "indexed") {
              if (!allowIndexed) {
                throwError(i);
              }
              if (node.indexed) {
                throwError(i);
              }
              node.indexed = true;
              node.name = "";
            } else if (checkModifier(node.type, node.name)) {
              node.name = "";
            } else {
              node.state.allowName = false;
            }
          }
        }
        break;
      case "[":
        if (!node.state.allowArray) {
          throwError(i);
        }
        node.type += c;
        node.state.allowArray = false;
        node.state.allowName = false;
        node.state.readArray = true;
        break;
      case "]":
        if (!node.state.readArray) {
          throwError(i);
        }
        node.type += c;
        node.state.readArray = false;
        node.state.allowArray = true;
        node.state.allowName = true;
        break;
      default:
        if (node.state.allowType) {
          node.type += c;
          node.state.allowParams = true;
          node.state.allowArray = true;
        } else if (node.state.allowName) {
          node.name += c;
          delete node.state.allowArray;
        } else if (node.state.readArray) {
          node.type += c;
        } else {
          throwError(i);
        }
    }
  }
  if (node.parent) {
    logger.throwArgumentError("unexpected eof", "param", param);
  }
  delete parent.state;
  if (node.name === "indexed") {
    if (!allowIndexed) {
      throwError(originalParam.length - 7);
    }
    if (node.indexed) {
      throwError(originalParam.length - 7);
    }
    node.indexed = true;
    node.name = "";
  } else if (checkModifier(node.type, node.name)) {
    node.name = "";
  }
  parent.type = verifyType(parent.type);
  return parent;
}
function populate(object, params) {
  for (let key in params) {
    (0, _properties.defineReadOnly)(object, key, params[key]);
  }
}
const FormatTypes = exports.FormatTypes = Object.freeze({
  // Bare formatting, as is needed for computing a sighash of an event or function
  sighash: "sighash",
  // Human-Readable with Minimal spacing and without names (compact human-readable)
  minimal: "minimal",
  // Human-Readable with nice spacing, including all names
  full: "full",
  // JSON-format a la Solidity
  json: "json"
});
const paramTypeArray = new RegExp(/^(.*)\[([0-9]*)\]$/);
class ParamType {
  constructor(constructorGuard, params) {
    if (constructorGuard !== _constructorGuard) {
      logger.throwError("use fromString", _logger.Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "new ParamType()"
      });
    }
    populate(this, params);
    let match = this.type.match(paramTypeArray);
    if (match) {
      populate(this, {
        arrayLength: parseInt(match[2] || "-1"),
        arrayChildren: ParamType.fromObject({
          type: match[1],
          components: this.components
        }),
        baseType: "array"
      });
    } else {
      populate(this, {
        arrayLength: null,
        arrayChildren: null,
        baseType: this.components != null ? "tuple" : this.type
      });
    }
    this._isParamType = true;
    Object.freeze(this);
  }
  // Format the parameter fragment
  //   - sighash: "(uint256,address)"
  //   - minimal: "tuple(uint256,address) indexed"
  //   - full:    "tuple(uint256 foo, address bar) indexed baz"
  format(format) {
    if (!format) {
      format = FormatTypes.sighash;
    }
    if (!FormatTypes[format]) {
      logger.throwArgumentError("invalid format type", "format", format);
    }
    if (format === FormatTypes.json) {
      let result = {
        type: this.baseType === "tuple" ? "tuple" : this.type,
        name: this.name || undefined
      };
      if (typeof this.indexed === "boolean") {
        result.indexed = this.indexed;
      }
      if (this.components) {
        result.components = this.components.map(comp => JSON.parse(comp.format(format)));
      }
      return JSON.stringify(result);
    }
    let result = "";
    // Array
    if (this.baseType === "array") {
      result += this.arrayChildren.format(format);
      result += "[" + (this.arrayLength < 0 ? "" : String(this.arrayLength)) + "]";
    } else {
      if (this.baseType === "tuple") {
        if (format !== FormatTypes.sighash) {
          result += this.type;
        }
        result += "(" + this.components.map(comp => comp.format(format)).join(format === FormatTypes.full ? ", " : ",") + ")";
      } else {
        result += this.type;
      }
    }
    if (format !== FormatTypes.sighash) {
      if (this.indexed === true) {
        result += " indexed";
      }
      if (format === FormatTypes.full && this.name) {
        result += " " + this.name;
      }
    }
    return result;
  }
  static from(value, allowIndexed) {
    if (typeof value === "string") {
      return ParamType.fromString(value, allowIndexed);
    }
    return ParamType.fromObject(value);
  }
  static fromObject(value) {
    if (ParamType.isParamType(value)) {
      return value;
    }
    return new ParamType(_constructorGuard, {
      name: value.name || null,
      type: verifyType(value.type),
      indexed: value.indexed == null ? null : !!value.indexed,
      components: value.components ? value.components.map(ParamType.fromObject) : null
    });
  }
  static fromString(value, allowIndexed) {
    function ParamTypify(node) {
      return ParamType.fromObject({
        name: node.name,
        type: node.type,
        indexed: node.indexed,
        components: node.components
      });
    }
    return ParamTypify(parseParamType(value, !!allowIndexed));
  }
  static isParamType(value) {
    return !!(value != null && value._isParamType);
  }
}
exports.ParamType = ParamType;
;
function parseParams(value, allowIndex) {
  return splitNesting(value).map(param => ParamType.fromString(param, allowIndex));
}
class Fragment {
  constructor(constructorGuard, params) {
    if (constructorGuard !== _constructorGuard) {
      logger.throwError("use a static from method", _logger.Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "new Fragment()"
      });
    }
    populate(this, params);
    this._isFragment = true;
    Object.freeze(this);
  }
  static from(value) {
    if (Fragment.isFragment(value)) {
      return value;
    }
    if (typeof value === "string") {
      return Fragment.fromString(value);
    }
    return Fragment.fromObject(value);
  }
  static fromObject(value) {
    if (Fragment.isFragment(value)) {
      return value;
    }
    switch (value.type) {
      case "function":
        return FunctionFragment.fromObject(value);
      case "event":
        return EventFragment.fromObject(value);
      case "constructor":
        return ConstructorFragment.fromObject(value);
      case "error":
        return ErrorFragment.fromObject(value);
      case "fallback":
      case "receive":
        // @TODO: Something? Maybe return a FunctionFragment? A custom DefaultFunctionFragment?
        return null;
    }
    return logger.throwArgumentError("invalid fragment object", "value", value);
  }
  static fromString(value) {
    // Make sure the "returns" is surrounded by a space and all whitespace is exactly one space
    value = value.replace(/\s/g, " ");
    value = value.replace(/\(/g, " (").replace(/\)/g, ") ").replace(/\s+/g, " ");
    value = value.trim();
    if (value.split(" ")[0] === "event") {
      return EventFragment.fromString(value.substring(5).trim());
    } else if (value.split(" ")[0] === "function") {
      return FunctionFragment.fromString(value.substring(8).trim());
    } else if (value.split("(")[0].trim() === "constructor") {
      return ConstructorFragment.fromString(value.trim());
    } else if (value.split(" ")[0] === "error") {
      return ErrorFragment.fromString(value.substring(5).trim());
    }
    return logger.throwArgumentError("unsupported fragment", "value", value);
  }
  static isFragment(value) {
    return !!(value && value._isFragment);
  }
}
exports.Fragment = Fragment;
class EventFragment extends Fragment {
  format(format) {
    if (!format) {
      format = FormatTypes.sighash;
    }
    if (!FormatTypes[format]) {
      logger.throwArgumentError("invalid format type", "format", format);
    }
    if (format === FormatTypes.json) {
      return JSON.stringify({
        type: "event",
        anonymous: this.anonymous,
        name: this.name,
        inputs: this.inputs.map(input => JSON.parse(input.format(format)))
      });
    }
    let result = "";
    if (format !== FormatTypes.sighash) {
      result += "event ";
    }
    result += this.name + "(" + this.inputs.map(input => input.format(format)).join(format === FormatTypes.full ? ", " : ",") + ") ";
    if (format !== FormatTypes.sighash) {
      if (this.anonymous) {
        result += "anonymous ";
      }
    }
    return result.trim();
  }
  static from(value) {
    if (typeof value === "string") {
      return EventFragment.fromString(value);
    }
    return EventFragment.fromObject(value);
  }
  static fromObject(value) {
    if (EventFragment.isEventFragment(value)) {
      return value;
    }
    if (value.type !== "event") {
      logger.throwArgumentError("invalid event object", "value", value);
    }
    const params = {
      name: verifyIdentifier(value.name),
      anonymous: value.anonymous,
      inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : [],
      type: "event"
    };
    return new EventFragment(_constructorGuard, params);
  }
  static fromString(value) {
    let match = value.match(regexParen);
    if (!match) {
      logger.throwArgumentError("invalid event string", "value", value);
    }
    let anonymous = false;
    match[3].split(" ").forEach(modifier => {
      switch (modifier.trim()) {
        case "anonymous":
          anonymous = true;
          break;
        case "":
          break;
        default:
          logger.warn("unknown modifier: " + modifier);
      }
    });
    return EventFragment.fromObject({
      name: match[1].trim(),
      anonymous: anonymous,
      inputs: parseParams(match[2], true),
      type: "event"
    });
  }
  static isEventFragment(value) {
    return value && value._isFragment && value.type === "event";
  }
}
exports.EventFragment = EventFragment;
function parseGas(value, params) {
  params.gas = null;
  let comps = value.split("@");
  if (comps.length !== 1) {
    if (comps.length > 2) {
      logger.throwArgumentError("invalid human-readable ABI signature", "value", value);
    }
    if (!comps[1].match(/^[0-9]+$/)) {
      logger.throwArgumentError("invalid human-readable ABI signature gas", "value", value);
    }
    params.gas = _bignumber.BigNumber.from(comps[1]);
    return comps[0];
  }
  return value;
}
function parseModifiers(value, params) {
  params.constant = false;
  params.payable = false;
  params.stateMutability = "nonpayable";
  value.split(" ").forEach(modifier => {
    switch (modifier.trim()) {
      case "constant":
        params.constant = true;
        break;
      case "payable":
        params.payable = true;
        params.stateMutability = "payable";
        break;
      case "nonpayable":
        params.payable = false;
        params.stateMutability = "nonpayable";
        break;
      case "pure":
        params.constant = true;
        params.stateMutability = "pure";
        break;
      case "view":
        params.constant = true;
        params.stateMutability = "view";
        break;
      case "external":
      case "public":
      case "":
        break;
      default:
        console.log("unknown modifier: " + modifier);
    }
  });
}
function verifyState(value) {
  let result = {
    constant: false,
    payable: true,
    stateMutability: "payable"
  };
  if (value.stateMutability != null) {
    result.stateMutability = value.stateMutability;
    // Set (and check things are consistent) the constant property
    result.constant = result.stateMutability === "view" || result.stateMutability === "pure";
    if (value.constant != null) {
      if (!!value.constant !== result.constant) {
        logger.throwArgumentError("cannot have constant function with mutability " + result.stateMutability, "value", value);
      }
    }
    // Set (and check things are consistent) the payable property
    result.payable = result.stateMutability === "payable";
    if (value.payable != null) {
      if (!!value.payable !== result.payable) {
        logger.throwArgumentError("cannot have payable function with mutability " + result.stateMutability, "value", value);
      }
    }
  } else if (value.payable != null) {
    result.payable = !!value.payable;
    // If payable we can assume non-constant; otherwise we can't assume
    if (value.constant == null && !result.payable && value.type !== "constructor") {
      logger.throwArgumentError("unable to determine stateMutability", "value", value);
    }
    result.constant = !!value.constant;
    if (result.constant) {
      result.stateMutability = "view";
    } else {
      result.stateMutability = result.payable ? "payable" : "nonpayable";
    }
    if (result.payable && result.constant) {
      logger.throwArgumentError("cannot have constant payable function", "value", value);
    }
  } else if (value.constant != null) {
    result.constant = !!value.constant;
    result.payable = !result.constant;
    result.stateMutability = result.constant ? "view" : "payable";
  } else if (value.type !== "constructor") {
    logger.throwArgumentError("unable to determine stateMutability", "value", value);
  }
  return result;
}
class ConstructorFragment extends Fragment {
  format(format) {
    if (!format) {
      format = FormatTypes.sighash;
    }
    if (!FormatTypes[format]) {
      logger.throwArgumentError("invalid format type", "format", format);
    }
    if (format === FormatTypes.json) {
      return JSON.stringify({
        type: "constructor",
        stateMutability: this.stateMutability !== "nonpayable" ? this.stateMutability : undefined,
        payable: this.payable,
        gas: this.gas ? this.gas.toNumber() : undefined,
        inputs: this.inputs.map(input => JSON.parse(input.format(format)))
      });
    }
    if (format === FormatTypes.sighash) {
      logger.throwError("cannot format a constructor for sighash", _logger.Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "format(sighash)"
      });
    }
    let result = "constructor(" + this.inputs.map(input => input.format(format)).join(format === FormatTypes.full ? ", " : ",") + ") ";
    if (this.stateMutability && this.stateMutability !== "nonpayable") {
      result += this.stateMutability + " ";
    }
    return result.trim();
  }
  static from(value) {
    if (typeof value === "string") {
      return ConstructorFragment.fromString(value);
    }
    return ConstructorFragment.fromObject(value);
  }
  static fromObject(value) {
    if (ConstructorFragment.isConstructorFragment(value)) {
      return value;
    }
    if (value.type !== "constructor") {
      logger.throwArgumentError("invalid constructor object", "value", value);
    }
    let state = verifyState(value);
    if (state.constant) {
      logger.throwArgumentError("constructor cannot be constant", "value", value);
    }
    const params = {
      name: null,
      type: value.type,
      inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : [],
      payable: state.payable,
      stateMutability: state.stateMutability,
      gas: value.gas ? _bignumber.BigNumber.from(value.gas) : null
    };
    return new ConstructorFragment(_constructorGuard, params);
  }
  static fromString(value) {
    let params = {
      type: "constructor"
    };
    value = parseGas(value, params);
    let parens = value.match(regexParen);
    if (!parens || parens[1].trim() !== "constructor") {
      logger.throwArgumentError("invalid constructor string", "value", value);
    }
    params.inputs = parseParams(parens[2].trim(), false);
    parseModifiers(parens[3].trim(), params);
    return ConstructorFragment.fromObject(params);
  }
  static isConstructorFragment(value) {
    return value && value._isFragment && value.type === "constructor";
  }
}
exports.ConstructorFragment = ConstructorFragment;
class FunctionFragment extends ConstructorFragment {
  format(format) {
    if (!format) {
      format = FormatTypes.sighash;
    }
    if (!FormatTypes[format]) {
      logger.throwArgumentError("invalid format type", "format", format);
    }
    if (format === FormatTypes.json) {
      return JSON.stringify({
        type: "function",
        name: this.name,
        constant: this.constant,
        stateMutability: this.stateMutability !== "nonpayable" ? this.stateMutability : undefined,
        payable: this.payable,
        gas: this.gas ? this.gas.toNumber() : undefined,
        inputs: this.inputs.map(input => JSON.parse(input.format(format))),
        outputs: this.outputs.map(output => JSON.parse(output.format(format)))
      });
    }
    let result = "";
    if (format !== FormatTypes.sighash) {
      result += "function ";
    }
    result += this.name + "(" + this.inputs.map(input => input.format(format)).join(format === FormatTypes.full ? ", " : ",") + ") ";
    if (format !== FormatTypes.sighash) {
      if (this.stateMutability) {
        if (this.stateMutability !== "nonpayable") {
          result += this.stateMutability + " ";
        }
      } else if (this.constant) {
        result += "view ";
      }
      if (this.outputs && this.outputs.length) {
        result += "returns (" + this.outputs.map(output => output.format(format)).join(", ") + ") ";
      }
      if (this.gas != null) {
        result += "@" + this.gas.toString() + " ";
      }
    }
    return result.trim();
  }
  static from(value) {
    if (typeof value === "string") {
      return FunctionFragment.fromString(value);
    }
    return FunctionFragment.fromObject(value);
  }
  static fromObject(value) {
    if (FunctionFragment.isFunctionFragment(value)) {
      return value;
    }
    if (value.type !== "function") {
      logger.throwArgumentError("invalid function object", "value", value);
    }
    let state = verifyState(value);
    const params = {
      type: value.type,
      name: verifyIdentifier(value.name),
      constant: state.constant,
      inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : [],
      outputs: value.outputs ? value.outputs.map(ParamType.fromObject) : [],
      payable: state.payable,
      stateMutability: state.stateMutability,
      gas: value.gas ? _bignumber.BigNumber.from(value.gas) : null
    };
    return new FunctionFragment(_constructorGuard, params);
  }
  static fromString(value) {
    let params = {
      type: "function"
    };
    value = parseGas(value, params);
    let comps = value.split(" returns ");
    if (comps.length > 2) {
      logger.throwArgumentError("invalid function string", "value", value);
    }
    let parens = comps[0].match(regexParen);
    if (!parens) {
      logger.throwArgumentError("invalid function signature", "value", value);
    }
    params.name = parens[1].trim();
    if (params.name) {
      verifyIdentifier(params.name);
    }
    params.inputs = parseParams(parens[2], false);
    parseModifiers(parens[3].trim(), params);
    // We have outputs
    if (comps.length > 1) {
      let returns = comps[1].match(regexParen);
      if (returns[1].trim() != "" || returns[3].trim() != "") {
        logger.throwArgumentError("unexpected tokens", "value", value);
      }
      params.outputs = parseParams(returns[2], false);
    } else {
      params.outputs = [];
    }
    return FunctionFragment.fromObject(params);
  }
  static isFunctionFragment(value) {
    return value && value._isFragment && value.type === "function";
  }
}
//export class StructFragment extends Fragment {
//}
exports.FunctionFragment = FunctionFragment;
function checkForbidden(fragment) {
  const sig = fragment.format();
  if (sig === "Error(string)" || sig === "Panic(uint256)") {
    logger.throwArgumentError(`cannot specify user defined ${sig} error`, "fragment", fragment);
  }
  return fragment;
}
class ErrorFragment extends Fragment {
  format(format) {
    if (!format) {
      format = FormatTypes.sighash;
    }
    if (!FormatTypes[format]) {
      logger.throwArgumentError("invalid format type", "format", format);
    }
    if (format === FormatTypes.json) {
      return JSON.stringify({
        type: "error",
        name: this.name,
        inputs: this.inputs.map(input => JSON.parse(input.format(format)))
      });
    }
    let result = "";
    if (format !== FormatTypes.sighash) {
      result += "error ";
    }
    result += this.name + "(" + this.inputs.map(input => input.format(format)).join(format === FormatTypes.full ? ", " : ",") + ") ";
    return result.trim();
  }
  static from(value) {
    if (typeof value === "string") {
      return ErrorFragment.fromString(value);
    }
    return ErrorFragment.fromObject(value);
  }
  static fromObject(value) {
    if (ErrorFragment.isErrorFragment(value)) {
      return value;
    }
    if (value.type !== "error") {
      logger.throwArgumentError("invalid error object", "value", value);
    }
    const params = {
      type: value.type,
      name: verifyIdentifier(value.name),
      inputs: value.inputs ? value.inputs.map(ParamType.fromObject) : []
    };
    return checkForbidden(new ErrorFragment(_constructorGuard, params));
  }
  static fromString(value) {
    let params = {
      type: "error"
    };
    let parens = value.match(regexParen);
    if (!parens) {
      logger.throwArgumentError("invalid error signature", "value", value);
    }
    params.name = parens[1].trim();
    if (params.name) {
      verifyIdentifier(params.name);
    }
    params.inputs = parseParams(parens[2], false);
    return checkForbidden(ErrorFragment.fromObject(params));
  }
  static isErrorFragment(value) {
    return value && value._isFragment && value.type === "error";
  }
}
exports.ErrorFragment = ErrorFragment;
function verifyType(type) {
  // These need to be transformed to their full description
  if (type.match(/^uint($|[^1-9])/)) {
    type = "uint256" + type.substring(4);
  } else if (type.match(/^int($|[^1-9])/)) {
    type = "int256" + type.substring(3);
  }
  // @TODO: more verification
  return type;
}
// See: https://github.com/ethereum/solidity/blob/1f8f1a3db93a548d0555e3e14cfc55a10e25b60e/docs/grammar/SolidityLexer.g4#L234
const regexIdentifier = new RegExp("^[a-zA-Z$_][a-zA-Z0-9$_]*$");
function verifyIdentifier(value) {
  if (!value || !value.match(regexIdentifier)) {
    logger.throwArgumentError(`invalid identifier "${value}"`, "value", value);
  }
  return value;
}
const regexParen = new RegExp("^([^)(]*)\\((.*)\\)([^)(]*)$");
function splitNesting(value) {
  value = value.trim();
  let result = [];
  let accum = "";
  let depth = 0;
  for (let offset = 0; offset < value.length; offset++) {
    let c = value[offset];
    if (c === "," && depth === 0) {
      result.push(accum);
      accum = "";
    } else {
      accum += c;
      if (c === "(") {
        depth++;
      } else if (c === ")") {
        depth--;
        if (depth === -1) {
          logger.throwArgumentError("unbalanced parenthesis", "value", value);
        }
      }
    }
  }
  if (accum) {
    result.push(accum);
  }
  return result;
}

},{"./_version":2,"@ethersproject/bignumber":25,"@ethersproject/logger":44,"@ethersproject/properties":46}],16:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "AbiCoder", {
  enumerable: true,
  get: function () {
    return _abiCoder.AbiCoder;
  }
});
Object.defineProperty(exports, "ConstructorFragment", {
  enumerable: true,
  get: function () {
    return _fragments.ConstructorFragment;
  }
});
Object.defineProperty(exports, "ErrorFragment", {
  enumerable: true,
  get: function () {
    return _fragments.ErrorFragment;
  }
});
Object.defineProperty(exports, "EventFragment", {
  enumerable: true,
  get: function () {
    return _fragments.EventFragment;
  }
});
Object.defineProperty(exports, "FormatTypes", {
  enumerable: true,
  get: function () {
    return _fragments.FormatTypes;
  }
});
Object.defineProperty(exports, "Fragment", {
  enumerable: true,
  get: function () {
    return _fragments.Fragment;
  }
});
Object.defineProperty(exports, "FunctionFragment", {
  enumerable: true,
  get: function () {
    return _fragments.FunctionFragment;
  }
});
Object.defineProperty(exports, "Indexed", {
  enumerable: true,
  get: function () {
    return _interface.Indexed;
  }
});
Object.defineProperty(exports, "Interface", {
  enumerable: true,
  get: function () {
    return _interface.Interface;
  }
});
Object.defineProperty(exports, "LogDescription", {
  enumerable: true,
  get: function () {
    return _interface.LogDescription;
  }
});
Object.defineProperty(exports, "ParamType", {
  enumerable: true,
  get: function () {
    return _fragments.ParamType;
  }
});
Object.defineProperty(exports, "TransactionDescription", {
  enumerable: true,
  get: function () {
    return _interface.TransactionDescription;
  }
});
Object.defineProperty(exports, "checkResultErrors", {
  enumerable: true,
  get: function () {
    return _interface.checkResultErrors;
  }
});
Object.defineProperty(exports, "defaultAbiCoder", {
  enumerable: true,
  get: function () {
    return _abiCoder.defaultAbiCoder;
  }
});
var _fragments = require("./fragments");
var _abiCoder = require("./abi-coder");
var _interface = require("./interface");

},{"./abi-coder":3,"./fragments":15,"./interface":17}],17:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TransactionDescription = exports.LogDescription = exports.Interface = exports.Indexed = exports.ErrorDescription = void 0;
Object.defineProperty(exports, "checkResultErrors", {
  enumerable: true,
  get: function () {
    return _abstractCoder.checkResultErrors;
  }
});
var _address = require("@ethersproject/address");
var _bignumber = require("@ethersproject/bignumber");
var _bytes = require("@ethersproject/bytes");
var _hash = require("@ethersproject/hash");
var _keccak = require("@ethersproject/keccak256");
var _properties = require("@ethersproject/properties");
var _abiCoder = require("./abi-coder");
var _abstractCoder = require("./coders/abstract-coder");
var _fragments = require("./fragments");
var _logger = require("@ethersproject/logger");
var _version = require("./_version");
const logger = new _logger.Logger(_version.version);
class LogDescription extends _properties.Description {}
exports.LogDescription = LogDescription;
class TransactionDescription extends _properties.Description {}
exports.TransactionDescription = TransactionDescription;
class ErrorDescription extends _properties.Description {}
exports.ErrorDescription = ErrorDescription;
class Indexed extends _properties.Description {
  static isIndexed(value) {
    return !!(value && value._isIndexed);
  }
}
exports.Indexed = Indexed;
const BuiltinErrors = {
  "0x08c379a0": {
    signature: "Error(string)",
    name: "Error",
    inputs: ["string"],
    reason: true
  },
  "0x4e487b71": {
    signature: "Panic(uint256)",
    name: "Panic",
    inputs: ["uint256"]
  }
};
function wrapAccessError(property, error) {
  const wrap = new Error(`deferred error during ABI decoding triggered accessing ${property}`);
  wrap.error = error;
  return wrap;
}
/*
function checkNames(fragment: Fragment, type: "input" | "output", params: Array<ParamType>): void {
    params.reduce((accum, param) => {
        if (param.name) {
            if (accum[param.name]) {
                logger.throwArgumentError(`duplicate ${ type } parameter ${ JSON.stringify(param.name) } in ${ fragment.format("full") }`, "fragment", fragment);
            }
            accum[param.name] = true;
        }
        return accum;
    }, <{ [ name: string ]: boolean }>{ });
}
*/
class Interface {
  constructor(fragments) {
    let abi = [];
    if (typeof fragments === "string") {
      abi = JSON.parse(fragments);
    } else {
      abi = fragments;
    }
    (0, _properties.defineReadOnly)(this, "fragments", abi.map(fragment => {
      return _fragments.Fragment.from(fragment);
    }).filter(fragment => fragment != null));
    (0, _properties.defineReadOnly)(this, "_abiCoder", (0, _properties.getStatic)(new.target, "getAbiCoder")());
    (0, _properties.defineReadOnly)(this, "functions", {});
    (0, _properties.defineReadOnly)(this, "errors", {});
    (0, _properties.defineReadOnly)(this, "events", {});
    (0, _properties.defineReadOnly)(this, "structs", {});
    // Add all fragments by their signature
    this.fragments.forEach(fragment => {
      let bucket = null;
      switch (fragment.type) {
        case "constructor":
          if (this.deploy) {
            logger.warn("duplicate definition - constructor");
            return;
          }
          //checkNames(fragment, "input", fragment.inputs);
          (0, _properties.defineReadOnly)(this, "deploy", fragment);
          return;
        case "function":
          //checkNames(fragment, "input", fragment.inputs);
          //checkNames(fragment, "output", (<FunctionFragment>fragment).outputs);
          bucket = this.functions;
          break;
        case "event":
          //checkNames(fragment, "input", fragment.inputs);
          bucket = this.events;
          break;
        case "error":
          bucket = this.errors;
          break;
        default:
          return;
      }
      let signature = fragment.format();
      if (bucket[signature]) {
        logger.warn("duplicate definition - " + signature);
        return;
      }
      bucket[signature] = fragment;
    });
    // If we do not have a constructor add a default
    if (!this.deploy) {
      (0, _properties.defineReadOnly)(this, "deploy", _fragments.ConstructorFragment.from({
        payable: false,
        type: "constructor"
      }));
    }
    (0, _properties.defineReadOnly)(this, "_isInterface", true);
  }
  format(format) {
    if (!format) {
      format = _fragments.FormatTypes.full;
    }
    if (format === _fragments.FormatTypes.sighash) {
      logger.throwArgumentError("interface does not support formatting sighash", "format", format);
    }
    const abi = this.fragments.map(fragment => fragment.format(format));
    // We need to re-bundle the JSON fragments a bit
    if (format === _fragments.FormatTypes.json) {
      return JSON.stringify(abi.map(j => JSON.parse(j)));
    }
    return abi;
  }
  // Sub-classes can override these to handle other blockchains
  static getAbiCoder() {
    return _abiCoder.defaultAbiCoder;
  }
  static getAddress(address) {
    return (0, _address.getAddress)(address);
  }
  static getSighash(fragment) {
    return (0, _bytes.hexDataSlice)((0, _hash.id)(fragment.format()), 0, 4);
  }
  static getEventTopic(eventFragment) {
    return (0, _hash.id)(eventFragment.format());
  }
  // Find a function definition by any means necessary (unless it is ambiguous)
  getFunction(nameOrSignatureOrSighash) {
    if ((0, _bytes.isHexString)(nameOrSignatureOrSighash)) {
      for (const name in this.functions) {
        if (nameOrSignatureOrSighash === this.getSighash(name)) {
          return this.functions[name];
        }
      }
      logger.throwArgumentError("no matching function", "sighash", nameOrSignatureOrSighash);
    }
    // It is a bare name, look up the function (will return null if ambiguous)
    if (nameOrSignatureOrSighash.indexOf("(") === -1) {
      const name = nameOrSignatureOrSighash.trim();
      const matching = Object.keys(this.functions).filter(f => f.split("(" /* fix:) */)[0] === name);
      if (matching.length === 0) {
        logger.throwArgumentError("no matching function", "name", name);
      } else if (matching.length > 1) {
        logger.throwArgumentError("multiple matching functions", "name", name);
      }
      return this.functions[matching[0]];
    }
    // Normalize the signature and lookup the function
    const result = this.functions[_fragments.FunctionFragment.fromString(nameOrSignatureOrSighash).format()];
    if (!result) {
      logger.throwArgumentError("no matching function", "signature", nameOrSignatureOrSighash);
    }
    return result;
  }
  // Find an event definition by any means necessary (unless it is ambiguous)
  getEvent(nameOrSignatureOrTopic) {
    if ((0, _bytes.isHexString)(nameOrSignatureOrTopic)) {
      const topichash = nameOrSignatureOrTopic.toLowerCase();
      for (const name in this.events) {
        if (topichash === this.getEventTopic(name)) {
          return this.events[name];
        }
      }
      logger.throwArgumentError("no matching event", "topichash", topichash);
    }
    // It is a bare name, look up the function (will return null if ambiguous)
    if (nameOrSignatureOrTopic.indexOf("(") === -1) {
      const name = nameOrSignatureOrTopic.trim();
      const matching = Object.keys(this.events).filter(f => f.split("(" /* fix:) */)[0] === name);
      if (matching.length === 0) {
        logger.throwArgumentError("no matching event", "name", name);
      } else if (matching.length > 1) {
        logger.throwArgumentError("multiple matching events", "name", name);
      }
      return this.events[matching[0]];
    }
    // Normalize the signature and lookup the function
    const result = this.events[_fragments.EventFragment.fromString(nameOrSignatureOrTopic).format()];
    if (!result) {
      logger.throwArgumentError("no matching event", "signature", nameOrSignatureOrTopic);
    }
    return result;
  }
  // Find a function definition by any means necessary (unless it is ambiguous)
  getError(nameOrSignatureOrSighash) {
    if ((0, _bytes.isHexString)(nameOrSignatureOrSighash)) {
      const getSighash = (0, _properties.getStatic)(this.constructor, "getSighash");
      for (const name in this.errors) {
        const error = this.errors[name];
        if (nameOrSignatureOrSighash === getSighash(error)) {
          return this.errors[name];
        }
      }
      logger.throwArgumentError("no matching error", "sighash", nameOrSignatureOrSighash);
    }
    // It is a bare name, look up the function (will return null if ambiguous)
    if (nameOrSignatureOrSighash.indexOf("(") === -1) {
      const name = nameOrSignatureOrSighash.trim();
      const matching = Object.keys(this.errors).filter(f => f.split("(" /* fix:) */)[0] === name);
      if (matching.length === 0) {
        logger.throwArgumentError("no matching error", "name", name);
      } else if (matching.length > 1) {
        logger.throwArgumentError("multiple matching errors", "name", name);
      }
      return this.errors[matching[0]];
    }
    // Normalize the signature and lookup the function
    const result = this.errors[_fragments.FunctionFragment.fromString(nameOrSignatureOrSighash).format()];
    if (!result) {
      logger.throwArgumentError("no matching error", "signature", nameOrSignatureOrSighash);
    }
    return result;
  }
  // Get the sighash (the bytes4 selector) used by Solidity to identify a function
  getSighash(fragment) {
    if (typeof fragment === "string") {
      try {
        fragment = this.getFunction(fragment);
      } catch (error) {
        try {
          fragment = this.getError(fragment);
        } catch (_) {
          throw error;
        }
      }
    }
    return (0, _properties.getStatic)(this.constructor, "getSighash")(fragment);
  }
  // Get the topic (the bytes32 hash) used by Solidity to identify an event
  getEventTopic(eventFragment) {
    if (typeof eventFragment === "string") {
      eventFragment = this.getEvent(eventFragment);
    }
    return (0, _properties.getStatic)(this.constructor, "getEventTopic")(eventFragment);
  }
  _decodeParams(params, data) {
    return this._abiCoder.decode(params, data);
  }
  _encodeParams(params, values) {
    return this._abiCoder.encode(params, values);
  }
  encodeDeploy(values) {
    return this._encodeParams(this.deploy.inputs, values || []);
  }
  decodeErrorResult(fragment, data) {
    if (typeof fragment === "string") {
      fragment = this.getError(fragment);
    }
    const bytes = (0, _bytes.arrayify)(data);
    if ((0, _bytes.hexlify)(bytes.slice(0, 4)) !== this.getSighash(fragment)) {
      logger.throwArgumentError(`data signature does not match error ${fragment.name}.`, "data", (0, _bytes.hexlify)(bytes));
    }
    return this._decodeParams(fragment.inputs, bytes.slice(4));
  }
  encodeErrorResult(fragment, values) {
    if (typeof fragment === "string") {
      fragment = this.getError(fragment);
    }
    return (0, _bytes.hexlify)((0, _bytes.concat)([this.getSighash(fragment), this._encodeParams(fragment.inputs, values || [])]));
  }
  // Decode the data for a function call (e.g. tx.data)
  decodeFunctionData(functionFragment, data) {
    if (typeof functionFragment === "string") {
      functionFragment = this.getFunction(functionFragment);
    }
    const bytes = (0, _bytes.arrayify)(data);
    if ((0, _bytes.hexlify)(bytes.slice(0, 4)) !== this.getSighash(functionFragment)) {
      logger.throwArgumentError(`data signature does not match function ${functionFragment.name}.`, "data", (0, _bytes.hexlify)(bytes));
    }
    return this._decodeParams(functionFragment.inputs, bytes.slice(4));
  }
  // Encode the data for a function call (e.g. tx.data)
  encodeFunctionData(functionFragment, values) {
    if (typeof functionFragment === "string") {
      functionFragment = this.getFunction(functionFragment);
    }
    return (0, _bytes.hexlify)((0, _bytes.concat)([this.getSighash(functionFragment), this._encodeParams(functionFragment.inputs, values || [])]));
  }
  // Decode the result from a function call (e.g. from eth_call)
  decodeFunctionResult(functionFragment, data) {
    if (typeof functionFragment === "string") {
      functionFragment = this.getFunction(functionFragment);
    }
    let bytes = (0, _bytes.arrayify)(data);
    let reason = null;
    let message = "";
    let errorArgs = null;
    let errorName = null;
    let errorSignature = null;
    switch (bytes.length % this._abiCoder._getWordSize()) {
      case 0:
        try {
          return this._abiCoder.decode(functionFragment.outputs, bytes);
        } catch (error) {}
        break;
      case 4:
        {
          const selector = (0, _bytes.hexlify)(bytes.slice(0, 4));
          const builtin = BuiltinErrors[selector];
          if (builtin) {
            errorArgs = this._abiCoder.decode(builtin.inputs, bytes.slice(4));
            errorName = builtin.name;
            errorSignature = builtin.signature;
            if (builtin.reason) {
              reason = errorArgs[0];
            }
            if (errorName === "Error") {
              message = `; VM Exception while processing transaction: reverted with reason string ${JSON.stringify(errorArgs[0])}`;
            } else if (errorName === "Panic") {
              message = `; VM Exception while processing transaction: reverted with panic code ${errorArgs[0]}`;
            }
          } else {
            try {
              const error = this.getError(selector);
              errorArgs = this._abiCoder.decode(error.inputs, bytes.slice(4));
              errorName = error.name;
              errorSignature = error.format();
            } catch (error) {}
          }
          break;
        }
    }
    return logger.throwError("call revert exception" + message, _logger.Logger.errors.CALL_EXCEPTION, {
      method: functionFragment.format(),
      data: (0, _bytes.hexlify)(data),
      errorArgs,
      errorName,
      errorSignature,
      reason
    });
  }
  // Encode the result for a function call (e.g. for eth_call)
  encodeFunctionResult(functionFragment, values) {
    if (typeof functionFragment === "string") {
      functionFragment = this.getFunction(functionFragment);
    }
    return (0, _bytes.hexlify)(this._abiCoder.encode(functionFragment.outputs, values || []));
  }
  // Create the filter for the event with search criteria (e.g. for eth_filterLog)
  encodeFilterTopics(eventFragment, values) {
    if (typeof eventFragment === "string") {
      eventFragment = this.getEvent(eventFragment);
    }
    if (values.length > eventFragment.inputs.length) {
      logger.throwError("too many arguments for " + eventFragment.format(), _logger.Logger.errors.UNEXPECTED_ARGUMENT, {
        argument: "values",
        value: values
      });
    }
    let topics = [];
    if (!eventFragment.anonymous) {
      topics.push(this.getEventTopic(eventFragment));
    }
    const encodeTopic = (param, value) => {
      if (param.type === "string") {
        return (0, _hash.id)(value);
      } else if (param.type === "bytes") {
        return (0, _keccak.keccak256)((0, _bytes.hexlify)(value));
      }
      if (param.type === "bool" && typeof value === "boolean") {
        value = value ? "0x01" : "0x00";
      }
      if (param.type.match(/^u?int/)) {
        value = _bignumber.BigNumber.from(value).toHexString();
      }
      // Check addresses are valid
      if (param.type === "address") {
        this._abiCoder.encode(["address"], [value]);
      }
      return (0, _bytes.hexZeroPad)((0, _bytes.hexlify)(value), 32);
    };
    values.forEach((value, index) => {
      let param = eventFragment.inputs[index];
      if (!param.indexed) {
        if (value != null) {
          logger.throwArgumentError("cannot filter non-indexed parameters; must be null", "contract." + param.name, value);
        }
        return;
      }
      if (value == null) {
        topics.push(null);
      } else if (param.baseType === "array" || param.baseType === "tuple") {
        logger.throwArgumentError("filtering with tuples or arrays not supported", "contract." + param.name, value);
      } else if (Array.isArray(value)) {
        topics.push(value.map(value => encodeTopic(param, value)));
      } else {
        topics.push(encodeTopic(param, value));
      }
    });
    // Trim off trailing nulls
    while (topics.length && topics[topics.length - 1] === null) {
      topics.pop();
    }
    return topics;
  }
  encodeEventLog(eventFragment, values) {
    if (typeof eventFragment === "string") {
      eventFragment = this.getEvent(eventFragment);
    }
    const topics = [];
    const dataTypes = [];
    const dataValues = [];
    if (!eventFragment.anonymous) {
      topics.push(this.getEventTopic(eventFragment));
    }
    if (values.length !== eventFragment.inputs.length) {
      logger.throwArgumentError("event arguments/values mismatch", "values", values);
    }
    eventFragment.inputs.forEach((param, index) => {
      const value = values[index];
      if (param.indexed) {
        if (param.type === "string") {
          topics.push((0, _hash.id)(value));
        } else if (param.type === "bytes") {
          topics.push((0, _keccak.keccak256)(value));
        } else if (param.baseType === "tuple" || param.baseType === "array") {
          // @TODO
          throw new Error("not implemented");
        } else {
          topics.push(this._abiCoder.encode([param.type], [value]));
        }
      } else {
        dataTypes.push(param);
        dataValues.push(value);
      }
    });
    return {
      data: this._abiCoder.encode(dataTypes, dataValues),
      topics: topics
    };
  }
  // Decode a filter for the event and the search criteria
  decodeEventLog(eventFragment, data, topics) {
    if (typeof eventFragment === "string") {
      eventFragment = this.getEvent(eventFragment);
    }
    if (topics != null && !eventFragment.anonymous) {
      let topicHash = this.getEventTopic(eventFragment);
      if (!(0, _bytes.isHexString)(topics[0], 32) || topics[0].toLowerCase() !== topicHash) {
        logger.throwError("fragment/topic mismatch", _logger.Logger.errors.INVALID_ARGUMENT, {
          argument: "topics[0]",
          expected: topicHash,
          value: topics[0]
        });
      }
      topics = topics.slice(1);
    }
    let indexed = [];
    let nonIndexed = [];
    let dynamic = [];
    eventFragment.inputs.forEach((param, index) => {
      if (param.indexed) {
        if (param.type === "string" || param.type === "bytes" || param.baseType === "tuple" || param.baseType === "array") {
          indexed.push(_fragments.ParamType.fromObject({
            type: "bytes32",
            name: param.name
          }));
          dynamic.push(true);
        } else {
          indexed.push(param);
          dynamic.push(false);
        }
      } else {
        nonIndexed.push(param);
        dynamic.push(false);
      }
    });
    let resultIndexed = topics != null ? this._abiCoder.decode(indexed, (0, _bytes.concat)(topics)) : null;
    let resultNonIndexed = this._abiCoder.decode(nonIndexed, data, true);
    let result = [];
    let nonIndexedIndex = 0,
      indexedIndex = 0;
    eventFragment.inputs.forEach((param, index) => {
      if (param.indexed) {
        if (resultIndexed == null) {
          result[index] = new Indexed({
            _isIndexed: true,
            hash: null
          });
        } else if (dynamic[index]) {
          result[index] = new Indexed({
            _isIndexed: true,
            hash: resultIndexed[indexedIndex++]
          });
        } else {
          try {
            result[index] = resultIndexed[indexedIndex++];
          } catch (error) {
            result[index] = error;
          }
        }
      } else {
        try {
          result[index] = resultNonIndexed[nonIndexedIndex++];
        } catch (error) {
          result[index] = error;
        }
      }
      // Add the keyword argument if named and safe
      if (param.name && result[param.name] == null) {
        const value = result[index];
        // Make error named values throw on access
        if (value instanceof Error) {
          Object.defineProperty(result, param.name, {
            enumerable: true,
            get: () => {
              throw wrapAccessError(`property ${JSON.stringify(param.name)}`, value);
            }
          });
        } else {
          result[param.name] = value;
        }
      }
    });
    // Make all error indexed values throw on access
    for (let i = 0; i < result.length; i++) {
      const value = result[i];
      if (value instanceof Error) {
        Object.defineProperty(result, i, {
          enumerable: true,
          get: () => {
            throw wrapAccessError(`index ${i}`, value);
          }
        });
      }
    }
    return Object.freeze(result);
  }
  // Given a transaction, find the matching function fragment (if any) and
  // determine all its properties and call parameters
  parseTransaction(tx) {
    let fragment = this.getFunction(tx.data.substring(0, 10).toLowerCase());
    if (!fragment) {
      return null;
    }
    return new TransactionDescription({
      args: this._abiCoder.decode(fragment.inputs, "0x" + tx.data.substring(10)),
      functionFragment: fragment,
      name: fragment.name,
      signature: fragment.format(),
      sighash: this.getSighash(fragment),
      value: _bignumber.BigNumber.from(tx.value || "0")
    });
  }
  // @TODO
  //parseCallResult(data: BytesLike): ??
  // Given an event log, find the matching event fragment (if any) and
  // determine all its properties and values
  parseLog(log) {
    let fragment = this.getEvent(log.topics[0]);
    if (!fragment || fragment.anonymous) {
      return null;
    }
    // @TODO: If anonymous, and the only method, and the input count matches, should we parse?
    //        Probably not, because just because it is the only event in the ABI does
    //        not mean we have the full ABI; maybe just a fragment?
    return new LogDescription({
      eventFragment: fragment,
      name: fragment.name,
      signature: fragment.format(),
      topic: this.getEventTopic(fragment),
      args: this.decodeEventLog(fragment, log.data, log.topics)
    });
  }
  parseError(data) {
    const hexData = (0, _bytes.hexlify)(data);
    let fragment = this.getError(hexData.substring(0, 10).toLowerCase());
    if (!fragment) {
      return null;
    }
    return new ErrorDescription({
      args: this._abiCoder.decode(fragment.inputs, "0x" + hexData.substring(10)),
      errorFragment: fragment,
      name: fragment.name,
      signature: fragment.format(),
      sighash: this.getSighash(fragment)
    });
  }
  /*
  static from(value: Array<Fragment | string | JsonAbi> | string | Interface) {
      if (Interface.isInterface(value)) {
          return value;
      }
      if (typeof(value) === "string") {
          return new Interface(JSON.parse(value));
      }
      return new Interface(value);
  }
  */
  static isInterface(value) {
    return !!(value && value._isInterface);
  }
}
exports.Interface = Interface;

},{"./_version":2,"./abi-coder":3,"./coders/abstract-coder":4,"./fragments":15,"@ethersproject/address":19,"@ethersproject/bignumber":25,"@ethersproject/bytes":27,"@ethersproject/hash":38,"@ethersproject/keccak256":42,"@ethersproject/logger":44,"@ethersproject/properties":46}],18:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.version = void 0;
const version = exports.version = "address/5.7.0";

},{}],19:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getAddress = getAddress;
exports.getContractAddress = getContractAddress;
exports.getCreate2Address = getCreate2Address;
exports.getIcapAddress = getIcapAddress;
exports.isAddress = isAddress;
var _bytes = require("@ethersproject/bytes");
var _bignumber = require("@ethersproject/bignumber");
var _keccak = require("@ethersproject/keccak256");
var _rlp = require("@ethersproject/rlp");
var _logger = require("@ethersproject/logger");
var _version = require("./_version");
const logger = new _logger.Logger(_version.version);
function getChecksumAddress(address) {
  if (!(0, _bytes.isHexString)(address, 20)) {
    logger.throwArgumentError("invalid address", "address", address);
  }
  address = address.toLowerCase();
  const chars = address.substring(2).split("");
  const expanded = new Uint8Array(40);
  for (let i = 0; i < 40; i++) {
    expanded[i] = chars[i].charCodeAt(0);
  }
  const hashed = (0, _bytes.arrayify)((0, _keccak.keccak256)(expanded));
  for (let i = 0; i < 40; i += 2) {
    if (hashed[i >> 1] >> 4 >= 8) {
      chars[i] = chars[i].toUpperCase();
    }
    if ((hashed[i >> 1] & 0x0f) >= 8) {
      chars[i + 1] = chars[i + 1].toUpperCase();
    }
  }
  return "0x" + chars.join("");
}
// Shims for environments that are missing some required constants and functions
const MAX_SAFE_INTEGER = 0x1fffffffffffff;
function log10(x) {
  if (Math.log10) {
    return Math.log10(x);
  }
  return Math.log(x) / Math.LN10;
}
// See: https://en.wikipedia.org/wiki/International_Bank_Account_Number
// Create lookup table
const ibanLookup = {};
for (let i = 0; i < 10; i++) {
  ibanLookup[String(i)] = String(i);
}
for (let i = 0; i < 26; i++) {
  ibanLookup[String.fromCharCode(65 + i)] = String(10 + i);
}
// How many decimal digits can we process? (for 64-bit float, this is 15)
const safeDigits = Math.floor(log10(MAX_SAFE_INTEGER));
function ibanChecksum(address) {
  address = address.toUpperCase();
  address = address.substring(4) + address.substring(0, 2) + "00";
  let expanded = address.split("").map(c => {
    return ibanLookup[c];
  }).join("");
  // Javascript can handle integers safely up to 15 (decimal) digits
  while (expanded.length >= safeDigits) {
    let block = expanded.substring(0, safeDigits);
    expanded = parseInt(block, 10) % 97 + expanded.substring(block.length);
  }
  let checksum = String(98 - parseInt(expanded, 10) % 97);
  while (checksum.length < 2) {
    checksum = "0" + checksum;
  }
  return checksum;
}
;
function getAddress(address) {
  let result = null;
  if (typeof address !== "string") {
    logger.throwArgumentError("invalid address", "address", address);
  }
  if (address.match(/^(0x)?[0-9a-fA-F]{40}$/)) {
    // Missing the 0x prefix
    if (address.substring(0, 2) !== "0x") {
      address = "0x" + address;
    }
    result = getChecksumAddress(address);
    // It is a checksummed address with a bad checksum
    if (address.match(/([A-F].*[a-f])|([a-f].*[A-F])/) && result !== address) {
      logger.throwArgumentError("bad address checksum", "address", address);
    }
    // Maybe ICAP? (we only support direct mode)
  } else if (address.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)) {
    // It is an ICAP address with a bad checksum
    if (address.substring(2, 4) !== ibanChecksum(address)) {
      logger.throwArgumentError("bad icap checksum", "address", address);
    }
    result = (0, _bignumber._base36To16)(address.substring(4));
    while (result.length < 40) {
      result = "0" + result;
    }
    result = getChecksumAddress("0x" + result);
  } else {
    logger.throwArgumentError("invalid address", "address", address);
  }
  return result;
}
function isAddress(address) {
  try {
    getAddress(address);
    return true;
  } catch (error) {}
  return false;
}
function getIcapAddress(address) {
  let base36 = (0, _bignumber._base16To36)(getAddress(address).substring(2)).toUpperCase();
  while (base36.length < 30) {
    base36 = "0" + base36;
  }
  return "XE" + ibanChecksum("XE00" + base36) + base36;
}
// http://ethereum.stackexchange.com/questions/760/how-is-the-address-of-an-ethereum-contract-computed
function getContractAddress(transaction) {
  let from = null;
  try {
    from = getAddress(transaction.from);
  } catch (error) {
    logger.throwArgumentError("missing from address", "transaction", transaction);
  }
  const nonce = (0, _bytes.stripZeros)((0, _bytes.arrayify)(_bignumber.BigNumber.from(transaction.nonce).toHexString()));
  return getAddress((0, _bytes.hexDataSlice)((0, _keccak.keccak256)((0, _rlp.encode)([from, nonce])), 12));
}
function getCreate2Address(from, salt, initCodeHash) {
  if ((0, _bytes.hexDataLength)(salt) !== 32) {
    logger.throwArgumentError("salt must be 32 bytes", "salt", salt);
  }
  if ((0, _bytes.hexDataLength)(initCodeHash) !== 32) {
    logger.throwArgumentError("initCodeHash must be 32 bytes", "initCodeHash", initCodeHash);
  }
  return getAddress((0, _bytes.hexDataSlice)((0, _keccak.keccak256)((0, _bytes.concat)(["0xff", getAddress(from), salt, initCodeHash])), 12));
}

},{"./_version":18,"@ethersproject/bignumber":25,"@ethersproject/bytes":27,"@ethersproject/keccak256":42,"@ethersproject/logger":44,"@ethersproject/rlp":48}],20:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encode = exports.decode = void 0;
var bytes_1 = require("@ethersproject/bytes");
function decode(textData) {
    textData = atob(textData);
    var data = [];
    for (var i = 0; i < textData.length; i++) {
        data.push(textData.charCodeAt(i));
    }
    return (0, bytes_1.arrayify)(data);
}
exports.decode = decode;
function encode(data) {
    data = (0, bytes_1.arrayify)(data);
    var textData = "";
    for (var i = 0; i < data.length; i++) {
        textData += String.fromCharCode(data[i]);
    }
    return btoa(textData);
}
exports.encode = encode;

},{"@ethersproject/bytes":27}],21:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encode = exports.decode = void 0;
var base64_1 = require("./base64");
Object.defineProperty(exports, "decode", { enumerable: true, get: function () { return base64_1.decode; } });
Object.defineProperty(exports, "encode", { enumerable: true, get: function () { return base64_1.encode; } });

},{"./base64":20}],22:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.version = void 0;
const version = exports.version = "bignumber/5.7.0";

},{}],23:[function(require,module,exports){
"use strict";

/**
 *  BigNumber
 *
 *  A wrapper around the BN.js object. We use the BN.js library
 *  because it is used by elliptic, so it is required regardless.
 *
 */
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.BigNumber = void 0;
exports._base16To36 = _base16To36;
exports._base36To16 = _base36To16;
exports.isBigNumberish = isBigNumberish;
var _bn = _interopRequireDefault(require("bn.js"));
var _bytes = require("@ethersproject/bytes");
var _logger = require("@ethersproject/logger");
var _version = require("./_version");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
var BN = _bn.default.BN;
const logger = new _logger.Logger(_version.version);
const _constructorGuard = {};
const MAX_SAFE = 0x1fffffffffffff;
function isBigNumberish(value) {
  return value != null && (BigNumber.isBigNumber(value) || typeof value === "number" && value % 1 === 0 || typeof value === "string" && !!value.match(/^-?[0-9]+$/) || (0, _bytes.isHexString)(value) || typeof value === "bigint" || (0, _bytes.isBytes)(value));
}
// Only warn about passing 10 into radix once
let _warnedToStringRadix = false;
class BigNumber {
  constructor(constructorGuard, hex) {
    if (constructorGuard !== _constructorGuard) {
      logger.throwError("cannot call constructor directly; use BigNumber.from", _logger.Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "new (BigNumber)"
      });
    }
    this._hex = hex;
    this._isBigNumber = true;
    Object.freeze(this);
  }
  fromTwos(value) {
    return toBigNumber(toBN(this).fromTwos(value));
  }
  toTwos(value) {
    return toBigNumber(toBN(this).toTwos(value));
  }
  abs() {
    if (this._hex[0] === "-") {
      return BigNumber.from(this._hex.substring(1));
    }
    return this;
  }
  add(other) {
    return toBigNumber(toBN(this).add(toBN(other)));
  }
  sub(other) {
    return toBigNumber(toBN(this).sub(toBN(other)));
  }
  div(other) {
    const o = BigNumber.from(other);
    if (o.isZero()) {
      throwFault("division-by-zero", "div");
    }
    return toBigNumber(toBN(this).div(toBN(other)));
  }
  mul(other) {
    return toBigNumber(toBN(this).mul(toBN(other)));
  }
  mod(other) {
    const value = toBN(other);
    if (value.isNeg()) {
      throwFault("division-by-zero", "mod");
    }
    return toBigNumber(toBN(this).umod(value));
  }
  pow(other) {
    const value = toBN(other);
    if (value.isNeg()) {
      throwFault("negative-power", "pow");
    }
    return toBigNumber(toBN(this).pow(value));
  }
  and(other) {
    const value = toBN(other);
    if (this.isNegative() || value.isNeg()) {
      throwFault("unbound-bitwise-result", "and");
    }
    return toBigNumber(toBN(this).and(value));
  }
  or(other) {
    const value = toBN(other);
    if (this.isNegative() || value.isNeg()) {
      throwFault("unbound-bitwise-result", "or");
    }
    return toBigNumber(toBN(this).or(value));
  }
  xor(other) {
    const value = toBN(other);
    if (this.isNegative() || value.isNeg()) {
      throwFault("unbound-bitwise-result", "xor");
    }
    return toBigNumber(toBN(this).xor(value));
  }
  mask(value) {
    if (this.isNegative() || value < 0) {
      throwFault("negative-width", "mask");
    }
    return toBigNumber(toBN(this).maskn(value));
  }
  shl(value) {
    if (this.isNegative() || value < 0) {
      throwFault("negative-width", "shl");
    }
    return toBigNumber(toBN(this).shln(value));
  }
  shr(value) {
    if (this.isNegative() || value < 0) {
      throwFault("negative-width", "shr");
    }
    return toBigNumber(toBN(this).shrn(value));
  }
  eq(other) {
    return toBN(this).eq(toBN(other));
  }
  lt(other) {
    return toBN(this).lt(toBN(other));
  }
  lte(other) {
    return toBN(this).lte(toBN(other));
  }
  gt(other) {
    return toBN(this).gt(toBN(other));
  }
  gte(other) {
    return toBN(this).gte(toBN(other));
  }
  isNegative() {
    return this._hex[0] === "-";
  }
  isZero() {
    return toBN(this).isZero();
  }
  toNumber() {
    try {
      return toBN(this).toNumber();
    } catch (error) {
      throwFault("overflow", "toNumber", this.toString());
    }
    return null;
  }
  toBigInt() {
    try {
      return BigInt(this.toString());
    } catch (e) {}
    return logger.throwError("this platform does not support BigInt", _logger.Logger.errors.UNSUPPORTED_OPERATION, {
      value: this.toString()
    });
  }
  toString() {
    // Lots of people expect this, which we do not support, so check (See: #889)
    if (arguments.length > 0) {
      if (arguments[0] === 10) {
        if (!_warnedToStringRadix) {
          _warnedToStringRadix = true;
          logger.warn("BigNumber.toString does not accept any parameters; base-10 is assumed");
        }
      } else if (arguments[0] === 16) {
        logger.throwError("BigNumber.toString does not accept any parameters; use bigNumber.toHexString()", _logger.Logger.errors.UNEXPECTED_ARGUMENT, {});
      } else {
        logger.throwError("BigNumber.toString does not accept parameters", _logger.Logger.errors.UNEXPECTED_ARGUMENT, {});
      }
    }
    return toBN(this).toString(10);
  }
  toHexString() {
    return this._hex;
  }
  toJSON(key) {
    return {
      type: "BigNumber",
      hex: this.toHexString()
    };
  }
  static from(value) {
    if (value instanceof BigNumber) {
      return value;
    }
    if (typeof value === "string") {
      if (value.match(/^-?0x[0-9a-f]+$/i)) {
        return new BigNumber(_constructorGuard, toHex(value));
      }
      if (value.match(/^-?[0-9]+$/)) {
        return new BigNumber(_constructorGuard, toHex(new BN(value)));
      }
      return logger.throwArgumentError("invalid BigNumber string", "value", value);
    }
    if (typeof value === "number") {
      if (value % 1) {
        throwFault("underflow", "BigNumber.from", value);
      }
      if (value >= MAX_SAFE || value <= -MAX_SAFE) {
        throwFault("overflow", "BigNumber.from", value);
      }
      return BigNumber.from(String(value));
    }
    const anyValue = value;
    if (typeof anyValue === "bigint") {
      return BigNumber.from(anyValue.toString());
    }
    if ((0, _bytes.isBytes)(anyValue)) {
      return BigNumber.from((0, _bytes.hexlify)(anyValue));
    }
    if (anyValue) {
      // Hexable interface (takes priority)
      if (anyValue.toHexString) {
        const hex = anyValue.toHexString();
        if (typeof hex === "string") {
          return BigNumber.from(hex);
        }
      } else {
        // For now, handle legacy JSON-ified values (goes away in v6)
        let hex = anyValue._hex;
        // New-form JSON
        if (hex == null && anyValue.type === "BigNumber") {
          hex = anyValue.hex;
        }
        if (typeof hex === "string") {
          if ((0, _bytes.isHexString)(hex) || hex[0] === "-" && (0, _bytes.isHexString)(hex.substring(1))) {
            return BigNumber.from(hex);
          }
        }
      }
    }
    return logger.throwArgumentError("invalid BigNumber value", "value", value);
  }
  static isBigNumber(value) {
    return !!(value && value._isBigNumber);
  }
}
// Normalize the hex string
exports.BigNumber = BigNumber;
function toHex(value) {
  // For BN, call on the hex string
  if (typeof value !== "string") {
    return toHex(value.toString(16));
  }
  // If negative, prepend the negative sign to the normalized positive value
  if (value[0] === "-") {
    // Strip off the negative sign
    value = value.substring(1);
    // Cannot have multiple negative signs (e.g. "--0x04")
    if (value[0] === "-") {
      logger.throwArgumentError("invalid hex", "value", value);
    }
    // Call toHex on the positive component
    value = toHex(value);
    // Do not allow "-0x00"
    if (value === "0x00") {
      return value;
    }
    // Negate the value
    return "-" + value;
  }
  // Add a "0x" prefix if missing
  if (value.substring(0, 2) !== "0x") {
    value = "0x" + value;
  }
  // Normalize zero
  if (value === "0x") {
    return "0x00";
  }
  // Make the string even length
  if (value.length % 2) {
    value = "0x0" + value.substring(2);
  }
  // Trim to smallest even-length string
  while (value.length > 4 && value.substring(0, 4) === "0x00") {
    value = "0x" + value.substring(4);
  }
  return value;
}
function toBigNumber(value) {
  return BigNumber.from(toHex(value));
}
function toBN(value) {
  const hex = BigNumber.from(value).toHexString();
  if (hex[0] === "-") {
    return new BN("-" + hex.substring(3), 16);
  }
  return new BN(hex.substring(2), 16);
}
function throwFault(fault, operation, value) {
  const params = {
    fault: fault,
    operation: operation
  };
  if (value != null) {
    params.value = value;
  }
  return logger.throwError(fault, _logger.Logger.errors.NUMERIC_FAULT, params);
}
// value should have no prefix
function _base36To16(value) {
  return new BN(value, 36).toString(16);
}
// value should have no prefix
function _base16To36(value) {
  return new BN(value, 16).toString(36);
}

},{"./_version":22,"@ethersproject/bytes":27,"@ethersproject/logger":44,"bn.js":67}],24:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.FixedNumber = exports.FixedFormat = void 0;
exports.formatFixed = formatFixed;
exports.parseFixed = parseFixed;
var _bytes = require("@ethersproject/bytes");
var _logger = require("@ethersproject/logger");
var _version = require("./_version");
var _bignumber = require("./bignumber");
const logger = new _logger.Logger(_version.version);
const _constructorGuard = {};
const Zero = _bignumber.BigNumber.from(0);
const NegativeOne = _bignumber.BigNumber.from(-1);
function throwFault(message, fault, operation, value) {
  const params = {
    fault: fault,
    operation: operation
  };
  if (value !== undefined) {
    params.value = value;
  }
  return logger.throwError(message, _logger.Logger.errors.NUMERIC_FAULT, params);
}
// Constant to pull zeros from for multipliers
let zeros = "0";
while (zeros.length < 256) {
  zeros += zeros;
}
// Returns a string "1" followed by decimal "0"s
function getMultiplier(decimals) {
  if (typeof decimals !== "number") {
    try {
      decimals = _bignumber.BigNumber.from(decimals).toNumber();
    } catch (e) {}
  }
  if (typeof decimals === "number" && decimals >= 0 && decimals <= 256 && !(decimals % 1)) {
    return "1" + zeros.substring(0, decimals);
  }
  return logger.throwArgumentError("invalid decimal size", "decimals", decimals);
}
function formatFixed(value, decimals) {
  if (decimals == null) {
    decimals = 0;
  }
  const multiplier = getMultiplier(decimals);
  // Make sure wei is a big number (convert as necessary)
  value = _bignumber.BigNumber.from(value);
  const negative = value.lt(Zero);
  if (negative) {
    value = value.mul(NegativeOne);
  }
  let fraction = value.mod(multiplier).toString();
  while (fraction.length < multiplier.length - 1) {
    fraction = "0" + fraction;
  }
  // Strip training 0
  fraction = fraction.match(/^([0-9]*[1-9]|0)(0*)/)[1];
  const whole = value.div(multiplier).toString();
  if (multiplier.length === 1) {
    value = whole;
  } else {
    value = whole + "." + fraction;
  }
  if (negative) {
    value = "-" + value;
  }
  return value;
}
function parseFixed(value, decimals) {
  if (decimals == null) {
    decimals = 0;
  }
  const multiplier = getMultiplier(decimals);
  if (typeof value !== "string" || !value.match(/^-?[0-9.]+$/)) {
    logger.throwArgumentError("invalid decimal value", "value", value);
  }
  // Is it negative?
  const negative = value.substring(0, 1) === "-";
  if (negative) {
    value = value.substring(1);
  }
  if (value === ".") {
    logger.throwArgumentError("missing value", "value", value);
  }
  // Split it into a whole and fractional part
  const comps = value.split(".");
  if (comps.length > 2) {
    logger.throwArgumentError("too many decimal points", "value", value);
  }
  let whole = comps[0],
    fraction = comps[1];
  if (!whole) {
    whole = "0";
  }
  if (!fraction) {
    fraction = "0";
  }
  // Trim trailing zeros
  while (fraction[fraction.length - 1] === "0") {
    fraction = fraction.substring(0, fraction.length - 1);
  }
  // Check the fraction doesn't exceed our decimals size
  if (fraction.length > multiplier.length - 1) {
    throwFault("fractional component exceeds decimals", "underflow", "parseFixed");
  }
  // If decimals is 0, we have an empty string for fraction
  if (fraction === "") {
    fraction = "0";
  }
  // Fully pad the string with zeros to get to wei
  while (fraction.length < multiplier.length - 1) {
    fraction += "0";
  }
  const wholeValue = _bignumber.BigNumber.from(whole);
  const fractionValue = _bignumber.BigNumber.from(fraction);
  let wei = wholeValue.mul(multiplier).add(fractionValue);
  if (negative) {
    wei = wei.mul(NegativeOne);
  }
  return wei;
}
class FixedFormat {
  constructor(constructorGuard, signed, width, decimals) {
    if (constructorGuard !== _constructorGuard) {
      logger.throwError("cannot use FixedFormat constructor; use FixedFormat.from", _logger.Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "new FixedFormat"
      });
    }
    this.signed = signed;
    this.width = width;
    this.decimals = decimals;
    this.name = (signed ? "" : "u") + "fixed" + String(width) + "x" + String(decimals);
    this._multiplier = getMultiplier(decimals);
    Object.freeze(this);
  }
  static from(value) {
    if (value instanceof FixedFormat) {
      return value;
    }
    if (typeof value === "number") {
      value = `fixed128x${value}`;
    }
    let signed = true;
    let width = 128;
    let decimals = 18;
    if (typeof value === "string") {
      if (value === "fixed") {
        // defaults...
      } else if (value === "ufixed") {
        signed = false;
      } else {
        const match = value.match(/^(u?)fixed([0-9]+)x([0-9]+)$/);
        if (!match) {
          logger.throwArgumentError("invalid fixed format", "format", value);
        }
        signed = match[1] !== "u";
        width = parseInt(match[2]);
        decimals = parseInt(match[3]);
      }
    } else if (value) {
      const check = (key, type, defaultValue) => {
        if (value[key] == null) {
          return defaultValue;
        }
        if (typeof value[key] !== type) {
          logger.throwArgumentError("invalid fixed format (" + key + " not " + type + ")", "format." + key, value[key]);
        }
        return value[key];
      };
      signed = check("signed", "boolean", signed);
      width = check("width", "number", width);
      decimals = check("decimals", "number", decimals);
    }
    if (width % 8) {
      logger.throwArgumentError("invalid fixed format width (not byte aligned)", "format.width", width);
    }
    if (decimals > 80) {
      logger.throwArgumentError("invalid fixed format (decimals too large)", "format.decimals", decimals);
    }
    return new FixedFormat(_constructorGuard, signed, width, decimals);
  }
}
exports.FixedFormat = FixedFormat;
class FixedNumber {
  constructor(constructorGuard, hex, value, format) {
    if (constructorGuard !== _constructorGuard) {
      logger.throwError("cannot use FixedNumber constructor; use FixedNumber.from", _logger.Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "new FixedFormat"
      });
    }
    this.format = format;
    this._hex = hex;
    this._value = value;
    this._isFixedNumber = true;
    Object.freeze(this);
  }
  _checkFormat(other) {
    if (this.format.name !== other.format.name) {
      logger.throwArgumentError("incompatible format; use fixedNumber.toFormat", "other", other);
    }
  }
  addUnsafe(other) {
    this._checkFormat(other);
    const a = parseFixed(this._value, this.format.decimals);
    const b = parseFixed(other._value, other.format.decimals);
    return FixedNumber.fromValue(a.add(b), this.format.decimals, this.format);
  }
  subUnsafe(other) {
    this._checkFormat(other);
    const a = parseFixed(this._value, this.format.decimals);
    const b = parseFixed(other._value, other.format.decimals);
    return FixedNumber.fromValue(a.sub(b), this.format.decimals, this.format);
  }
  mulUnsafe(other) {
    this._checkFormat(other);
    const a = parseFixed(this._value, this.format.decimals);
    const b = parseFixed(other._value, other.format.decimals);
    return FixedNumber.fromValue(a.mul(b).div(this.format._multiplier), this.format.decimals, this.format);
  }
  divUnsafe(other) {
    this._checkFormat(other);
    const a = parseFixed(this._value, this.format.decimals);
    const b = parseFixed(other._value, other.format.decimals);
    return FixedNumber.fromValue(a.mul(this.format._multiplier).div(b), this.format.decimals, this.format);
  }
  floor() {
    const comps = this.toString().split(".");
    if (comps.length === 1) {
      comps.push("0");
    }
    let result = FixedNumber.from(comps[0], this.format);
    const hasFraction = !comps[1].match(/^(0*)$/);
    if (this.isNegative() && hasFraction) {
      result = result.subUnsafe(ONE.toFormat(result.format));
    }
    return result;
  }
  ceiling() {
    const comps = this.toString().split(".");
    if (comps.length === 1) {
      comps.push("0");
    }
    let result = FixedNumber.from(comps[0], this.format);
    const hasFraction = !comps[1].match(/^(0*)$/);
    if (!this.isNegative() && hasFraction) {
      result = result.addUnsafe(ONE.toFormat(result.format));
    }
    return result;
  }
  // @TODO: Support other rounding algorithms
  round(decimals) {
    if (decimals == null) {
      decimals = 0;
    }
    // If we are already in range, we're done
    const comps = this.toString().split(".");
    if (comps.length === 1) {
      comps.push("0");
    }
    if (decimals < 0 || decimals > 80 || decimals % 1) {
      logger.throwArgumentError("invalid decimal count", "decimals", decimals);
    }
    if (comps[1].length <= decimals) {
      return this;
    }
    const factor = FixedNumber.from("1" + zeros.substring(0, decimals), this.format);
    const bump = BUMP.toFormat(this.format);
    return this.mulUnsafe(factor).addUnsafe(bump).floor().divUnsafe(factor);
  }
  isZero() {
    return this._value === "0.0" || this._value === "0";
  }
  isNegative() {
    return this._value[0] === "-";
  }
  toString() {
    return this._value;
  }
  toHexString(width) {
    if (width == null) {
      return this._hex;
    }
    if (width % 8) {
      logger.throwArgumentError("invalid byte width", "width", width);
    }
    const hex = _bignumber.BigNumber.from(this._hex).fromTwos(this.format.width).toTwos(width).toHexString();
    return (0, _bytes.hexZeroPad)(hex, width / 8);
  }
  toUnsafeFloat() {
    return parseFloat(this.toString());
  }
  toFormat(format) {
    return FixedNumber.fromString(this._value, format);
  }
  static fromValue(value, decimals, format) {
    // If decimals looks more like a format, and there is no format, shift the parameters
    if (format == null && decimals != null && !(0, _bignumber.isBigNumberish)(decimals)) {
      format = decimals;
      decimals = null;
    }
    if (decimals == null) {
      decimals = 0;
    }
    if (format == null) {
      format = "fixed";
    }
    return FixedNumber.fromString(formatFixed(value, decimals), FixedFormat.from(format));
  }
  static fromString(value, format) {
    if (format == null) {
      format = "fixed";
    }
    const fixedFormat = FixedFormat.from(format);
    const numeric = parseFixed(value, fixedFormat.decimals);
    if (!fixedFormat.signed && numeric.lt(Zero)) {
      throwFault("unsigned value cannot be negative", "overflow", "value", value);
    }
    let hex = null;
    if (fixedFormat.signed) {
      hex = numeric.toTwos(fixedFormat.width).toHexString();
    } else {
      hex = numeric.toHexString();
      hex = (0, _bytes.hexZeroPad)(hex, fixedFormat.width / 8);
    }
    const decimal = formatFixed(numeric, fixedFormat.decimals);
    return new FixedNumber(_constructorGuard, hex, decimal, fixedFormat);
  }
  static fromBytes(value, format) {
    if (format == null) {
      format = "fixed";
    }
    const fixedFormat = FixedFormat.from(format);
    if ((0, _bytes.arrayify)(value).length > fixedFormat.width / 8) {
      throw new Error("overflow");
    }
    let numeric = _bignumber.BigNumber.from(value);
    if (fixedFormat.signed) {
      numeric = numeric.fromTwos(fixedFormat.width);
    }
    const hex = numeric.toTwos((fixedFormat.signed ? 0 : 1) + fixedFormat.width).toHexString();
    const decimal = formatFixed(numeric, fixedFormat.decimals);
    return new FixedNumber(_constructorGuard, hex, decimal, fixedFormat);
  }
  static from(value, format) {
    if (typeof value === "string") {
      return FixedNumber.fromString(value, format);
    }
    if ((0, _bytes.isBytes)(value)) {
      return FixedNumber.fromBytes(value, format);
    }
    try {
      return FixedNumber.fromValue(value, 0, format);
    } catch (error) {
      // Allow NUMERIC_FAULT to bubble up
      if (error.code !== _logger.Logger.errors.INVALID_ARGUMENT) {
        throw error;
      }
    }
    return logger.throwArgumentError("invalid FixedNumber value", "value", value);
  }
  static isFixedNumber(value) {
    return !!(value && value._isFixedNumber);
  }
}
exports.FixedNumber = FixedNumber;
const ONE = FixedNumber.from(1);
const BUMP = FixedNumber.from("0.5");

},{"./_version":22,"./bignumber":23,"@ethersproject/bytes":27,"@ethersproject/logger":44}],25:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "BigNumber", {
  enumerable: true,
  get: function () {
    return _bignumber.BigNumber;
  }
});
Object.defineProperty(exports, "FixedFormat", {
  enumerable: true,
  get: function () {
    return _fixednumber.FixedFormat;
  }
});
Object.defineProperty(exports, "FixedNumber", {
  enumerable: true,
  get: function () {
    return _fixednumber.FixedNumber;
  }
});
Object.defineProperty(exports, "_base16To36", {
  enumerable: true,
  get: function () {
    return _bignumber._base16To36;
  }
});
Object.defineProperty(exports, "_base36To16", {
  enumerable: true,
  get: function () {
    return _bignumber._base36To16;
  }
});
Object.defineProperty(exports, "formatFixed", {
  enumerable: true,
  get: function () {
    return _fixednumber.formatFixed;
  }
});
Object.defineProperty(exports, "parseFixed", {
  enumerable: true,
  get: function () {
    return _fixednumber.parseFixed;
  }
});
var _bignumber = require("./bignumber");
var _fixednumber = require("./fixednumber");

},{"./bignumber":23,"./fixednumber":24}],26:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.version = void 0;
const version = exports.version = "bytes/5.7.0";

},{}],27:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.arrayify = arrayify;
exports.concat = concat;
exports.hexConcat = hexConcat;
exports.hexDataLength = hexDataLength;
exports.hexDataSlice = hexDataSlice;
exports.hexStripZeros = hexStripZeros;
exports.hexValue = hexValue;
exports.hexZeroPad = hexZeroPad;
exports.hexlify = hexlify;
exports.isBytes = isBytes;
exports.isBytesLike = isBytesLike;
exports.isHexString = isHexString;
exports.joinSignature = joinSignature;
exports.splitSignature = splitSignature;
exports.stripZeros = stripZeros;
exports.zeroPad = zeroPad;
var _logger = require("@ethersproject/logger");
var _version = require("./_version");
const logger = new _logger.Logger(_version.version);
///////////////////////////////
function isHexable(value) {
  return !!value.toHexString;
}
function addSlice(array) {
  if (array.slice) {
    return array;
  }
  array.slice = function () {
    const args = Array.prototype.slice.call(arguments);
    return addSlice(new Uint8Array(Array.prototype.slice.apply(array, args)));
  };
  return array;
}
function isBytesLike(value) {
  return isHexString(value) && !(value.length % 2) || isBytes(value);
}
function isInteger(value) {
  return typeof value === "number" && value == value && value % 1 === 0;
}
function isBytes(value) {
  if (value == null) {
    return false;
  }
  if (value.constructor === Uint8Array) {
    return true;
  }
  if (typeof value === "string") {
    return false;
  }
  if (!isInteger(value.length) || value.length < 0) {
    return false;
  }
  for (let i = 0; i < value.length; i++) {
    const v = value[i];
    if (!isInteger(v) || v < 0 || v >= 256) {
      return false;
    }
  }
  return true;
}
function arrayify(value, options) {
  if (!options) {
    options = {};
  }
  if (typeof value === "number") {
    logger.checkSafeUint53(value, "invalid arrayify value");
    const result = [];
    while (value) {
      result.unshift(value & 0xff);
      value = parseInt(String(value / 256));
    }
    if (result.length === 0) {
      result.push(0);
    }
    return addSlice(new Uint8Array(result));
  }
  if (options.allowMissingPrefix && typeof value === "string" && value.substring(0, 2) !== "0x") {
    value = "0x" + value;
  }
  if (isHexable(value)) {
    value = value.toHexString();
  }
  if (isHexString(value)) {
    let hex = value.substring(2);
    if (hex.length % 2) {
      if (options.hexPad === "left") {
        hex = "0" + hex;
      } else if (options.hexPad === "right") {
        hex += "0";
      } else {
        logger.throwArgumentError("hex data is odd-length", "value", value);
      }
    }
    const result = [];
    for (let i = 0; i < hex.length; i += 2) {
      result.push(parseInt(hex.substring(i, i + 2), 16));
    }
    return addSlice(new Uint8Array(result));
  }
  if (isBytes(value)) {
    return addSlice(new Uint8Array(value));
  }
  return logger.throwArgumentError("invalid arrayify value", "value", value);
}
function concat(items) {
  const objects = items.map(item => arrayify(item));
  const length = objects.reduce((accum, item) => accum + item.length, 0);
  const result = new Uint8Array(length);
  objects.reduce((offset, object) => {
    result.set(object, offset);
    return offset + object.length;
  }, 0);
  return addSlice(result);
}
function stripZeros(value) {
  let result = arrayify(value);
  if (result.length === 0) {
    return result;
  }
  // Find the first non-zero entry
  let start = 0;
  while (start < result.length && result[start] === 0) {
    start++;
  }
  // If we started with zeros, strip them
  if (start) {
    result = result.slice(start);
  }
  return result;
}
function zeroPad(value, length) {
  value = arrayify(value);
  if (value.length > length) {
    logger.throwArgumentError("value out of range", "value", arguments[0]);
  }
  const result = new Uint8Array(length);
  result.set(value, length - value.length);
  return addSlice(result);
}
function isHexString(value, length) {
  if (typeof value !== "string" || !value.match(/^0x[0-9A-Fa-f]*$/)) {
    return false;
  }
  if (length && value.length !== 2 + 2 * length) {
    return false;
  }
  return true;
}
const HexCharacters = "0123456789abcdef";
function hexlify(value, options) {
  if (!options) {
    options = {};
  }
  if (typeof value === "number") {
    logger.checkSafeUint53(value, "invalid hexlify value");
    let hex = "";
    while (value) {
      hex = HexCharacters[value & 0xf] + hex;
      value = Math.floor(value / 16);
    }
    if (hex.length) {
      if (hex.length % 2) {
        hex = "0" + hex;
      }
      return "0x" + hex;
    }
    return "0x00";
  }
  if (typeof value === "bigint") {
    value = value.toString(16);
    if (value.length % 2) {
      return "0x0" + value;
    }
    return "0x" + value;
  }
  if (options.allowMissingPrefix && typeof value === "string" && value.substring(0, 2) !== "0x") {
    value = "0x" + value;
  }
  if (isHexable(value)) {
    return value.toHexString();
  }
  if (isHexString(value)) {
    if (value.length % 2) {
      if (options.hexPad === "left") {
        value = "0x0" + value.substring(2);
      } else if (options.hexPad === "right") {
        value += "0";
      } else {
        logger.throwArgumentError("hex data is odd-length", "value", value);
      }
    }
    return value.toLowerCase();
  }
  if (isBytes(value)) {
    let result = "0x";
    for (let i = 0; i < value.length; i++) {
      let v = value[i];
      result += HexCharacters[(v & 0xf0) >> 4] + HexCharacters[v & 0x0f];
    }
    return result;
  }
  return logger.throwArgumentError("invalid hexlify value", "value", value);
}
/*
function unoddify(value: BytesLike | Hexable | number): BytesLike | Hexable | number {
    if (typeof(value) === "string" && value.length % 2 && value.substring(0, 2) === "0x") {
        return "0x0" + value.substring(2);
    }
    return value;
}
*/
function hexDataLength(data) {
  if (typeof data !== "string") {
    data = hexlify(data);
  } else if (!isHexString(data) || data.length % 2) {
    return null;
  }
  return (data.length - 2) / 2;
}
function hexDataSlice(data, offset, endOffset) {
  if (typeof data !== "string") {
    data = hexlify(data);
  } else if (!isHexString(data) || data.length % 2) {
    logger.throwArgumentError("invalid hexData", "value", data);
  }
  offset = 2 + 2 * offset;
  if (endOffset != null) {
    return "0x" + data.substring(offset, 2 + 2 * endOffset);
  }
  return "0x" + data.substring(offset);
}
function hexConcat(items) {
  let result = "0x";
  items.forEach(item => {
    result += hexlify(item).substring(2);
  });
  return result;
}
function hexValue(value) {
  const trimmed = hexStripZeros(hexlify(value, {
    hexPad: "left"
  }));
  if (trimmed === "0x") {
    return "0x0";
  }
  return trimmed;
}
function hexStripZeros(value) {
  if (typeof value !== "string") {
    value = hexlify(value);
  }
  if (!isHexString(value)) {
    logger.throwArgumentError("invalid hex string", "value", value);
  }
  value = value.substring(2);
  let offset = 0;
  while (offset < value.length && value[offset] === "0") {
    offset++;
  }
  return "0x" + value.substring(offset);
}
function hexZeroPad(value, length) {
  if (typeof value !== "string") {
    value = hexlify(value);
  } else if (!isHexString(value)) {
    logger.throwArgumentError("invalid hex string", "value", value);
  }
  if (value.length > 2 * length + 2) {
    logger.throwArgumentError("value out of range", "value", arguments[1]);
  }
  while (value.length < 2 * length + 2) {
    value = "0x0" + value.substring(2);
  }
  return value;
}
function splitSignature(signature) {
  const result = {
    r: "0x",
    s: "0x",
    _vs: "0x",
    recoveryParam: 0,
    v: 0,
    yParityAndS: "0x",
    compact: "0x"
  };
  if (isBytesLike(signature)) {
    let bytes = arrayify(signature);
    // Get the r, s and v
    if (bytes.length === 64) {
      // EIP-2098; pull the v from the top bit of s and clear it
      result.v = 27 + (bytes[32] >> 7);
      bytes[32] &= 0x7f;
      result.r = hexlify(bytes.slice(0, 32));
      result.s = hexlify(bytes.slice(32, 64));
    } else if (bytes.length === 65) {
      result.r = hexlify(bytes.slice(0, 32));
      result.s = hexlify(bytes.slice(32, 64));
      result.v = bytes[64];
    } else {
      logger.throwArgumentError("invalid signature string", "signature", signature);
    }
    // Allow a recid to be used as the v
    if (result.v < 27) {
      if (result.v === 0 || result.v === 1) {
        result.v += 27;
      } else {
        logger.throwArgumentError("signature invalid v byte", "signature", signature);
      }
    }
    // Compute recoveryParam from v
    result.recoveryParam = 1 - result.v % 2;
    // Compute _vs from recoveryParam and s
    if (result.recoveryParam) {
      bytes[32] |= 0x80;
    }
    result._vs = hexlify(bytes.slice(32, 64));
  } else {
    result.r = signature.r;
    result.s = signature.s;
    result.v = signature.v;
    result.recoveryParam = signature.recoveryParam;
    result._vs = signature._vs;
    // If the _vs is available, use it to populate missing s, v and recoveryParam
    // and verify non-missing s, v and recoveryParam
    if (result._vs != null) {
      const vs = zeroPad(arrayify(result._vs), 32);
      result._vs = hexlify(vs);
      // Set or check the recid
      const recoveryParam = vs[0] >= 128 ? 1 : 0;
      if (result.recoveryParam == null) {
        result.recoveryParam = recoveryParam;
      } else if (result.recoveryParam !== recoveryParam) {
        logger.throwArgumentError("signature recoveryParam mismatch _vs", "signature", signature);
      }
      // Set or check the s
      vs[0] &= 0x7f;
      const s = hexlify(vs);
      if (result.s == null) {
        result.s = s;
      } else if (result.s !== s) {
        logger.throwArgumentError("signature v mismatch _vs", "signature", signature);
      }
    }
    // Use recid and v to populate each other
    if (result.recoveryParam == null) {
      if (result.v == null) {
        logger.throwArgumentError("signature missing v and recoveryParam", "signature", signature);
      } else if (result.v === 0 || result.v === 1) {
        result.recoveryParam = result.v;
      } else {
        result.recoveryParam = 1 - result.v % 2;
      }
    } else {
      if (result.v == null) {
        result.v = 27 + result.recoveryParam;
      } else {
        const recId = result.v === 0 || result.v === 1 ? result.v : 1 - result.v % 2;
        if (result.recoveryParam !== recId) {
          logger.throwArgumentError("signature recoveryParam mismatch v", "signature", signature);
        }
      }
    }
    if (result.r == null || !isHexString(result.r)) {
      logger.throwArgumentError("signature missing or invalid r", "signature", signature);
    } else {
      result.r = hexZeroPad(result.r, 32);
    }
    if (result.s == null || !isHexString(result.s)) {
      logger.throwArgumentError("signature missing or invalid s", "signature", signature);
    } else {
      result.s = hexZeroPad(result.s, 32);
    }
    const vs = arrayify(result.s);
    if (vs[0] >= 128) {
      logger.throwArgumentError("signature s out of range", "signature", signature);
    }
    if (result.recoveryParam) {
      vs[0] |= 0x80;
    }
    const _vs = hexlify(vs);
    if (result._vs) {
      if (!isHexString(result._vs)) {
        logger.throwArgumentError("signature invalid _vs", "signature", signature);
      }
      result._vs = hexZeroPad(result._vs, 32);
    }
    // Set or check the _vs
    if (result._vs == null) {
      result._vs = _vs;
    } else if (result._vs !== _vs) {
      logger.throwArgumentError("signature _vs mismatch v and s", "signature", signature);
    }
  }
  result.yParityAndS = result._vs;
  result.compact = result.r + result.yParityAndS.substring(2);
  return result;
}
function joinSignature(signature) {
  signature = splitSignature(signature);
  return hexlify(concat([signature.r, signature.s, signature.recoveryParam ? "0x1c" : "0x1b"]));
}

},{"./_version":26,"@ethersproject/logger":44}],28:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.AddressZero = void 0;
const AddressZero = exports.AddressZero = "0x0000000000000000000000000000000000000000";

},{}],29:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Zero = exports.WeiPerEther = exports.Two = exports.One = exports.NegativeOne = exports.MinInt256 = exports.MaxUint256 = exports.MaxInt256 = void 0;
var _bignumber = require("@ethersproject/bignumber");
const NegativeOne = exports.NegativeOne = /*#__PURE__*/_bignumber.BigNumber.from(-1);
const Zero = exports.Zero = /*#__PURE__*/_bignumber.BigNumber.from(0);
const One = exports.One = /*#__PURE__*/_bignumber.BigNumber.from(1);
const Two = exports.Two = /*#__PURE__*/_bignumber.BigNumber.from(2);
const WeiPerEther = exports.WeiPerEther = /*#__PURE__*/_bignumber.BigNumber.from("1000000000000000000");
const MaxUint256 = exports.MaxUint256 = /*#__PURE__*/_bignumber.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
const MinInt256 = exports.MinInt256 = /*#__PURE__*/_bignumber.BigNumber.from("-0x8000000000000000000000000000000000000000000000000000000000000000");
const MaxInt256 = exports.MaxInt256 = /*#__PURE__*/_bignumber.BigNumber.from("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

},{"@ethersproject/bignumber":25}],30:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.HashZero = void 0;
const HashZero = exports.HashZero = "0x0000000000000000000000000000000000000000000000000000000000000000";

},{}],31:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "AddressZero", {
  enumerable: true,
  get: function () {
    return _addresses.AddressZero;
  }
});
Object.defineProperty(exports, "EtherSymbol", {
  enumerable: true,
  get: function () {
    return _strings.EtherSymbol;
  }
});
Object.defineProperty(exports, "HashZero", {
  enumerable: true,
  get: function () {
    return _hashes.HashZero;
  }
});
Object.defineProperty(exports, "MaxInt256", {
  enumerable: true,
  get: function () {
    return _bignumbers.MaxInt256;
  }
});
Object.defineProperty(exports, "MaxUint256", {
  enumerable: true,
  get: function () {
    return _bignumbers.MaxUint256;
  }
});
Object.defineProperty(exports, "MinInt256", {
  enumerable: true,
  get: function () {
    return _bignumbers.MinInt256;
  }
});
Object.defineProperty(exports, "NegativeOne", {
  enumerable: true,
  get: function () {
    return _bignumbers.NegativeOne;
  }
});
Object.defineProperty(exports, "One", {
  enumerable: true,
  get: function () {
    return _bignumbers.One;
  }
});
Object.defineProperty(exports, "Two", {
  enumerable: true,
  get: function () {
    return _bignumbers.Two;
  }
});
Object.defineProperty(exports, "WeiPerEther", {
  enumerable: true,
  get: function () {
    return _bignumbers.WeiPerEther;
  }
});
Object.defineProperty(exports, "Zero", {
  enumerable: true,
  get: function () {
    return _bignumbers.Zero;
  }
});
var _addresses = require("./addresses");
var _bignumbers = require("./bignumbers");
var _hashes = require("./hashes");
var _strings = require("./strings");

},{"./addresses":28,"./bignumbers":29,"./hashes":30,"./strings":32}],32:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.EtherSymbol = void 0;
// NFKC (composed)             // (decomposed)
const EtherSymbol = exports.EtherSymbol = "\u039e"; // "\uD835\uDF63";

},{}],33:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.version = void 0;
const version = exports.version = "hash/5.7.0";

},{}],34:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.decode_arithmetic = decode_arithmetic;
exports.read_compressed_payload = read_compressed_payload;
exports.read_emoji_trie = read_emoji_trie;
exports.read_mapped_map = read_mapped_map;
exports.read_member_array = read_member_array;
exports.read_payload = read_payload;
exports.read_zero_terminated_array = read_zero_terminated_array;
exports.signed = signed;
/**
 * MIT License
 *
 * Copyright (c) 2021 Andrew Raffensperger
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * This is a near carbon-copy of the original source (link below) with the
 * TypeScript typings added and a few tweaks to make it ES3-compatible.
 *
 * See: https://github.com/adraffy/ens-normalize.js
 */
// https://github.com/behnammodi/polyfill/blob/master/array.polyfill.js
function flat(array, depth) {
  if (depth == null) {
    depth = 1;
  }
  const result = [];
  const forEach = result.forEach;
  const flatDeep = function (arr, depth) {
    forEach.call(arr, function (val) {
      if (depth > 0 && Array.isArray(val)) {
        flatDeep(val, depth - 1);
      } else {
        result.push(val);
      }
    });
  };
  flatDeep(array, depth);
  return result;
}
function fromEntries(array) {
  const result = {};
  for (let i = 0; i < array.length; i++) {
    const value = array[i];
    result[value[0]] = value[1];
  }
  return result;
}
function decode_arithmetic(bytes) {
  let pos = 0;
  function u16() {
    return bytes[pos++] << 8 | bytes[pos++];
  }
  // decode the frequency table
  let symbol_count = u16();
  let total = 1;
  let acc = [0, 1]; // first symbol has frequency 1
  for (let i = 1; i < symbol_count; i++) {
    acc.push(total += u16());
  }
  // skip the sized-payload that the last 3 symbols index into
  let skip = u16();
  let pos_payload = pos;
  pos += skip;
  let read_width = 0;
  let read_buffer = 0;
  function read_bit() {
    if (read_width == 0) {
      // this will read beyond end of buffer
      // but (undefined|0) => zero pad
      read_buffer = read_buffer << 8 | bytes[pos++];
      read_width = 8;
    }
    return read_buffer >> --read_width & 1;
  }
  const N = 31;
  const FULL = Math.pow(2, N);
  const HALF = FULL >>> 1;
  const QRTR = HALF >> 1;
  const MASK = FULL - 1;
  // fill register
  let register = 0;
  for (let i = 0; i < N; i++) register = register << 1 | read_bit();
  let symbols = [];
  let low = 0;
  let range = FULL; // treat like a float
  while (true) {
    let value = Math.floor(((register - low + 1) * total - 1) / range);
    let start = 0;
    let end = symbol_count;
    while (end - start > 1) {
      // binary search
      let mid = start + end >>> 1;
      if (value < acc[mid]) {
        end = mid;
      } else {
        start = mid;
      }
    }
    if (start == 0) break; // first symbol is end mark
    symbols.push(start);
    let a = low + Math.floor(range * acc[start] / total);
    let b = low + Math.floor(range * acc[start + 1] / total) - 1;
    while (((a ^ b) & HALF) == 0) {
      register = register << 1 & MASK | read_bit();
      a = a << 1 & MASK;
      b = b << 1 & MASK | 1;
    }
    while (a & ~b & QRTR) {
      register = register & HALF | register << 1 & MASK >>> 1 | read_bit();
      a = a << 1 ^ HALF;
      b = (b ^ HALF) << 1 | HALF | 1;
    }
    low = a;
    range = 1 + b - a;
  }
  let offset = symbol_count - 4;
  return symbols.map(x => {
    switch (x - offset) {
      case 3:
        return offset + 0x10100 + (bytes[pos_payload++] << 16 | bytes[pos_payload++] << 8 | bytes[pos_payload++]);
      case 2:
        return offset + 0x100 + (bytes[pos_payload++] << 8 | bytes[pos_payload++]);
      case 1:
        return offset + bytes[pos_payload++];
      default:
        return x - 1;
    }
  });
}
// returns an iterator which returns the next symbol
function read_payload(v) {
  let pos = 0;
  return () => v[pos++];
}
function read_compressed_payload(bytes) {
  return read_payload(decode_arithmetic(bytes));
}
// eg. [0,1,2,3...] => [0,-1,1,-2,...]
function signed(i) {
  return i & 1 ? ~i >> 1 : i >> 1;
}
function read_counts(n, next) {
  let v = Array(n);
  for (let i = 0; i < n; i++) v[i] = 1 + next();
  return v;
}
function read_ascending(n, next) {
  let v = Array(n);
  for (let i = 0, x = -1; i < n; i++) v[i] = x += 1 + next();
  return v;
}
function read_deltas(n, next) {
  let v = Array(n);
  for (let i = 0, x = 0; i < n; i++) v[i] = x += signed(next());
  return v;
}
function read_member_array(next, lookup) {
  let v = read_ascending(next(), next);
  let n = next();
  let vX = read_ascending(n, next);
  let vN = read_counts(n, next);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < vN[i]; j++) {
      v.push(vX[i] + j);
    }
  }
  return lookup ? v.map(x => lookup[x]) : v;
}
// returns array of 
// [x, ys] => single replacement rule
// [x, ys, n, dx, dx] => linear map
function read_mapped_map(next) {
  let ret = [];
  while (true) {
    let w = next();
    if (w == 0) break;
    ret.push(read_linear_table(w, next));
  }
  while (true) {
    let w = next() - 1;
    if (w < 0) break;
    ret.push(read_replacement_table(w, next));
  }
  return fromEntries(flat(ret));
}
function read_zero_terminated_array(next) {
  let v = [];
  while (true) {
    let i = next();
    if (i == 0) break;
    v.push(i);
  }
  return v;
}
function read_transposed(n, w, next) {
  let m = Array(n).fill(undefined).map(() => []);
  for (let i = 0; i < w; i++) {
    read_deltas(n, next).forEach((x, j) => m[j].push(x));
  }
  return m;
}
function read_linear_table(w, next) {
  let dx = 1 + next();
  let dy = next();
  let vN = read_zero_terminated_array(next);
  let m = read_transposed(vN.length, 1 + w, next);
  return flat(m.map((v, i) => {
    const x = v[0],
      ys = v.slice(1);
    //let [x, ...ys] = v;
    //return Array(vN[i]).fill().map((_, j) => {
    return Array(vN[i]).fill(undefined).map((_, j) => {
      let j_dy = j * dy;
      return [x + j * dx, ys.map(y => y + j_dy)];
    });
  }));
}
function read_replacement_table(w, next) {
  let n = 1 + next();
  let m = read_transposed(n, 1 + w, next);
  return m.map(v => [v[0], v.slice(1)]);
}
function read_emoji_trie(next) {
  let sorted = read_member_array(next).sort((a, b) => a - b);
  return read();
  function read() {
    let branches = [];
    while (true) {
      let keys = read_member_array(next, sorted);
      if (keys.length == 0) break;
      branches.push({
        set: new Set(keys),
        node: read()
      });
    }
    branches.sort((a, b) => b.set.size - a.set.size); // sort by likelihood
    let temp = next();
    let valid = temp % 3;
    temp = temp / 3 | 0;
    let fe0f = !!(temp & 1);
    temp >>= 1;
    let save = temp == 1;
    let check = temp == 2;
    return {
      branches,
      valid,
      fe0f,
      save,
      check
    };
  }
}

},{}],35:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getData = getData;
var _base = require("@ethersproject/base64");
var _decoder = require("./decoder.js");
/**
 * MIT License
 *
 * Copyright (c) 2021 Andrew Raffensperger
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * This is a near carbon-copy of the original source (link below) with the
 * TypeScript typings added and a few tweaks to make it ES3-compatible.
 *
 * See: https://github.com/adraffy/ens-normalize.js
 */

function getData() {
  return (0, _decoder.read_compressed_payload)((0, _base.decode)('AEQF2AO2DEsA2wIrAGsBRABxAN8AZwCcAEwAqgA0AGwAUgByADcATAAVAFYAIQAyACEAKAAYAFgAGwAjABQAMAAmADIAFAAfABQAKwATACoADgAbAA8AHQAYABoAGQAxADgALAAoADwAEwA9ABMAGgARAA4ADwAWABMAFgAIAA8AHgQXBYMA5BHJAS8JtAYoAe4AExozi0UAH21tAaMnBT8CrnIyhrMDhRgDygIBUAEHcoFHUPe8AXBjAewCjgDQR8IICIcEcQLwATXCDgzvHwBmBoHNAqsBdBcUAykgDhAMShskMgo8AY8jqAQfAUAfHw8BDw87MioGlCIPBwZCa4ELatMAAMspJVgsDl8AIhckSg8XAHdvTwBcIQEiDT4OPhUqbyECAEoAS34Aej8Ybx83JgT/Xw8gHxZ/7w8RICxPHA9vBw+Pfw8PHwAPFv+fAsAvCc8vEr8ivwD/EQ8Bol8OEBa/A78hrwAPCU8vESNvvwWfHwNfAVoDHr+ZAAED34YaAdJPAK7PLwSEgDLHAGo1Pz8Pvx9fUwMrpb8O/58VTzAPIBoXIyQJNF8hpwIVAT8YGAUADDNBaX3RAMomJCg9EhUeA29MABsZBTMNJipjOhc19gcIDR8bBwQHEggCWi6DIgLuAQYA+BAFCha3A5XiAEsqM7UFFgFLhAMjFTMYE1Klnw74nRVBG/ASCm0BYRN/BrsU3VoWy+S0vV8LQx+vN8gF2AC2AK5EAWwApgYDKmAAroQ0NDQ0AT+OCg7wAAIHRAbpNgVcBV0APTA5BfbPFgMLzcYL/QqqA82eBALKCjQCjqYCht0/k2+OAsXQAoP3ASTKDgDw6ACKAUYCMpIKJpRaAE4A5womABzZvs0REEKiACIQAd5QdAECAj4Ywg/wGqY2AVgAYADYvAoCGAEubA0gvAY2ALAAbpbvqpyEAGAEpgQAJgAG7gAgAEACmghUFwCqAMpAINQIwC4DthRAAPcycKgApoIdABwBfCisABoATwBqASIAvhnSBP8aH/ECeAKXAq40NjgDBTwFYQU6AXs3oABgAD4XNgmcCY1eCl5tIFZeUqGgyoNHABgAEQAaABNwWQAmABMATPMa3T34ADldyprmM1M2XociUQgLzvwAXT3xABgAEQAaABNwIGFAnADD8AAgAD4BBJWzaCcIAIEBFMAWwKoAAdq9BWAF5wLQpALEtQAKUSGkahR4GnJM+gsAwCgeFAiUAECQ0BQuL8AAIAAAADKeIheclvFqQAAETr4iAMxIARMgAMIoHhQIAn0E0pDQFC4HhznoAAAAIAI2C0/4lvFqQAAETgBJJwYCAy4ABgYAFAA8MBKYEH4eRhTkAjYeFcgACAYAeABsOqyQ5gRwDayqugEgaIIAtgoACgDmEABmBAWGme5OBJJA2m4cDeoAmITWAXwrMgOgAGwBCh6CBXYF1Tzg1wKAAFdiuABRAFwAXQBsAG8AdgBrAHYAbwCEAHEwfxQBVE5TEQADVFhTBwBDANILAqcCzgLTApQCrQL6vAAMAL8APLhNBKkE6glGKTAU4Dr4N2EYEwBCkABKk8rHAbYBmwIoAiU4Ajf/Aq4CowCAANIChzgaNBsCsTgeODcFXrgClQKdAqQBiQGYAqsCsjTsNHsfNPA0ixsAWTWiOAMFPDQSNCk2BDZHNow2TTZUNhk28Jk9VzI3QkEoAoICoQKwAqcAQAAxBV4FXbS9BW47YkIXP1ciUqs05DS/FwABUwJW11e6nHuYZmSh/RAYA8oMKvZ8KASoUAJYWAJ6ILAsAZSoqjpgA0ocBIhmDgDWAAawRDQoAAcuAj5iAHABZiR2AIgiHgCaAU68ACxuHAG0ygM8MiZIAlgBdF4GagJqAPZOHAMuBgoATkYAsABiAHgAMLoGDPj0HpKEBAAOJgAuALggTAHWAeAMEDbd20Uege0ADwAWADkAQgA9OHd+2MUQZBBhBgNNDkxxPxUQArEPqwvqERoM1irQ090ANK4H8ANYB/ADWANYB/AH8ANYB/ADWANYA1gDWBwP8B/YxRBkD00EcgWTBZAE2wiIJk4RhgctCNdUEnQjHEwDSgEBIypJITuYMxAlR0wRTQgIATZHbKx9PQNMMbBU+pCnA9AyVDlxBgMedhKlAC8PeCE1uk6DekxxpQpQT7NX9wBFBgASqwAS5gBJDSgAUCwGPQBI4zTYABNGAE2bAE3KAExdGABKaAbgAFBXAFCOAFBJABI2SWdObALDOq0//QomCZhvwHdTBkIQHCemEPgMNAG2ATwN7kvZBPIGPATKH34ZGg/OlZ0Ipi3eDO4m5C6igFsj9iqEBe5L9TzeC05RaQ9aC2YJ5DpkgU8DIgEOIowK3g06CG4Q9ArKbA3mEUYHOgPWSZsApgcCCxIdNhW2JhFirQsKOXgG/Br3C5AmsBMqev0F1BoiBk4BKhsAANAu6IWxWjJcHU9gBgQLJiPIFKlQIQ0mQLh4SRocBxYlqgKSQ3FKiFE3HpQh9zw+DWcuFFF9B/Y8BhlQC4I8n0asRQ8R0z6OPUkiSkwtBDaALDAnjAnQD4YMunxzAVoJIgmyDHITMhEYN8YIOgcaLpclJxYIIkaWYJsE+KAD9BPSAwwFQAlCBxQDthwuEy8VKgUOgSXYAvQ21i60ApBWgQEYBcwPJh/gEFFH4Q7qCJwCZgOEJewALhUiABginAhEZABgj9lTBi7MCMhqbSN1A2gU6GIRdAeSDlgHqBw0FcAc4nDJXgyGCSiksAlcAXYJmgFgBOQICjVcjKEgQmdUi1kYnCBiQUBd/QIyDGYVoES+h3kCjA9sEhwBNgF0BzoNAgJ4Ee4RbBCWCOyGBTW2M/k6JgRQIYQgEgooA1BszwsoJvoM+WoBpBJjAw00PnfvZ6xgtyUX/gcaMsZBYSHyC5NPzgydGsIYQ1QvGeUHwAP0GvQn60FYBgADpAQUOk4z7wS+C2oIjAlAAEoOpBgH2BhrCnKM0QEyjAG4mgNYkoQCcJAGOAcMAGgMiAV65gAeAqgIpAAGANADWAA6Aq4HngAaAIZCAT4DKDABIuYCkAOUCDLMAZYwAfQqBBzEDBYA+DhuSwLDsgKAa2ajBd5ZAo8CSjYBTiYEBk9IUgOwcuIA3ABMBhTgSAEWrEvMG+REAeBwLADIAPwABjYHBkIBzgH0bgC4AWALMgmjtLYBTuoqAIQAFmwB2AKKAN4ANgCA8gFUAE4FWvoF1AJQSgESMhksWGIBvAMgATQBDgB6BsyOpsoIIARuB9QCEBwV4gLvLwe2AgMi4BPOQsYCvd9WADIXUu5eZwqoCqdeaAC0YTQHMnM9UQAPH6k+yAdy/BZIiQImSwBQ5gBQQzSaNTFWSTYBpwGqKQK38AFtqwBI/wK37gK3rQK3sAK6280C0gK33AK3zxAAUEIAUD9SklKDArekArw5AEQAzAHCO147WTteO1k7XjtZO147WTteO1kDmChYI03AVU0oJqkKbV9GYewMpw3VRMk6ShPcYFJgMxPJLbgUwhXPJVcZPhq9JwYl5VUKDwUt1GYxCC00dhe9AEApaYNCY4ceMQpMHOhTklT5LRwAskujM7ANrRsWREEFSHXuYisWDwojAmSCAmJDXE6wXDchAqH4AmiZAmYKAp+FOBwMAmY8AmYnBG8EgAN/FAN+kzkHOXgYOYM6JCQCbB4CMjc4CwJtyAJtr/CLADRoRiwBaADfAOIASwYHmQyOAP8MwwAOtgJ3MAJ2o0ACeUxEAni7Hl3cRa9G9AJ8QAJ6yQJ9CgJ88UgBSH5kJQAsFklZSlwWGErNAtECAtDNSygDiFADh+dExpEzAvKiXQQDA69Lz0wuJgTQTU1NsAKLQAKK2cIcCB5EaAa4Ao44Ao5dQZiCAo7aAo5deVG1UzYLUtVUhgKT/AKTDQDqAB1VH1WwVdEHLBwplocy4nhnRTw6ApegAu+zWCKpAFomApaQApZ9nQCqWa1aCoJOADwClrYClk9cRVzSApnMApllXMtdCBoCnJw5wzqeApwXAp+cAp65iwAeEDIrEAKd8gKekwC2PmE1YfACntQCoG8BqgKeoCACnk+mY8lkKCYsAiewAiZ/AqD8AqBN2AKmMAKlzwKoAAB+AqfzaH1osgAESmodatICrOQCrK8CrWgCrQMCVx4CVd0CseLYAx9PbJgCsr4OArLpGGzhbWRtSWADJc4Ctl08QG6RAylGArhfArlIFgK5K3hwN3DiAr0aAy2zAzISAr6JcgMDM3ICvhtzI3NQAsPMAsMFc4N0TDZGdOEDPKgDPJsDPcACxX0CxkgCxhGKAshqUgLIRQLJUALJLwJkngLd03h6YniveSZL0QMYpGcDAmH1GfSVJXsMXpNevBICz2wCz20wTFTT9BSgAMeuAs90ASrrA04TfkwGAtwoAtuLAtJQA1JdA1NgAQIDVY2AikABzBfuYUZ2AILPg44C2sgC2d+EEYRKpz0DhqYAMANkD4ZyWvoAVgLfZgLeuXR4AuIw7RUB8zEoAfScAfLTiALr9ALpcXoAAur6AurlAPpIAboC7ooC652Wq5cEAu5AA4XhmHpw4XGiAvMEAGoDjheZlAL3FAORbwOSiAL3mQL52gL4Z5odmqy8OJsfA52EAv77ARwAOp8dn7QDBY4DpmsDptoA0sYDBmuhiaIGCgMMSgFgASACtgNGAJwEgLpoBgC8BGzAEowcggCEDC6kdjoAJAM0C5IKRoABZCgiAIzw3AYBLACkfng9ogigkgNmWAN6AEQCvrkEVqTGAwCsBRbAA+4iQkMCHR072jI2PTbUNsk2RjY5NvA23TZKNiU3EDcZN5I+RTxDRTBCJkK5VBYKFhZfwQCWygU3AJBRHpu+OytgNxa61A40GMsYjsn7BVwFXQVcBV0FaAVdBVwFXQVcBV0FXAVdBVwFXUsaCNyKAK4AAQUHBwKU7oICoW1e7jAEzgPxA+YDwgCkBFDAwADABKzAAOxFLhitA1UFTDeyPkM+bj51QkRCuwTQWWQ8X+0AWBYzsACNA8xwzAGm7EZ/QisoCTAbLDs6fnLfb8H2GccsbgFw13M1HAVkBW/Jxsm9CNRO8E8FDD0FBQw9FkcClOYCoMFegpDfADgcMiA2AJQACB8AsigKAIzIEAJKeBIApY5yPZQIAKQiHb4fvj5BKSRPQrZCOz0oXyxgOywfKAnGbgMClQaCAkILXgdeCD9IIGUgQj5fPoY+dT52Ao5CM0dAX9BTVG9SDzFwWTQAbxBzJF/lOEIQQglCCkKJIAls5AcClQICoKPMODEFxhi6KSAbiyfIRrMjtCgdWCAkPlFBIitCsEJRzAbMAV/OEyQzDg0OAQQEJ36i328/Mk9AybDJsQlq3tDRApUKAkFzXf1d/j9uALYP6hCoFgCTGD8kPsFKQiobrm0+zj0KSD8kPnVCRBwMDyJRTHFgMTJa5rwXQiQ2YfI/JD7BMEJEHGINTw4TOFlIRzwJO0icMQpyPyQ+wzJCRBv6DVgnKB01NgUKj2bwYzMqCoBkznBgEF+zYDIocwRIX+NgHj4HICNfh2C4CwdwFWpTG/lgUhYGAwRfv2Ts8mAaXzVgml/XYIJfuWC4HI1gUF9pYJZgMR6ilQHMAOwLAlDRefC0in4AXAEJA6PjCwc0IamOANMMCAECRQDFNRTZBgd+CwQlRA+r6+gLBDEFBnwUBXgKATIArwAGRAAHA3cDdAN2A3kDdwN9A3oDdQN7A30DfAN4A3oDfQAYEAAlAtYASwMAUAFsAHcKAHcAmgB3AHUAdQB2AHVu8UgAygDAAHcAdQB1AHYAdQALCgB3AAsAmgB3AAsCOwB3AAtu8UgAygDAAHgKAJoAdwB3AHUAdQB2AHUAeAB1AHUAdgB1bvFIAMoAwAALCgCaAHcACwB3AAsCOwB3AAtu8UgAygDAAH4ACwGgALcBpwC6AahdAu0COwLtbvFIAMoAwAALCgCaAu0ACwLtAAsCOwLtAAtu8UgAygDAA24ACwNvAAu0VsQAAzsAABCkjUIpAAsAUIusOggWcgMeBxVsGwL67U/2HlzmWOEeOgALASvuAAseAfpKUpnpGgYJDCIZM6YyARUE9ThqAD5iXQgnAJYJPnOzw0ZAEZxEKsIAkA4DhAHnTAIDxxUDK0lxCQlPYgIvIQVYJQBVqE1GakUAKGYiDToSBA1EtAYAXQJYAIF8GgMHRyAAIAjOe9YncekRAA0KACUrjwE7Ayc6AAYWAqaiKG4McEcqANoN3+Mg9TwCBhIkuCny+JwUQ29L008JluRxu3K+oAdqiHOqFH0AG5SUIfUJ5SxCGfxdipRzqTmT4V5Zb+r1Uo4Vm+NqSSEl2mNvR2JhIa8SpYO6ntdwFXHCWTCK8f2+Hxo7uiG3drDycAuKIMP5bhi06ACnqArH1rz4Rqg//lm6SgJGEVbF9xJHISaR6HxqxSnkw6shDnelHKNEfGUXSJRJ1GcsmtJw25xrZMDK9gXSm1/YMkdX4/6NKYOdtk/NQ3/NnDASjTc3fPjIjW/5sVfVObX2oTDWkr1dF9f3kxBsD3/3aQO8hPfRz+e0uEiJqt1161griu7gz8hDDwtpy+F+BWtefnKHZPAxcZoWbnznhJpy0e842j36bcNzGnIEusgGX0a8ZxsnjcSsPDZ09yZ36fCQbriHeQ72JRMILNl6ePPf2HWoVwgWAm1fb3V2sAY0+B6rAXqSwPBgseVmoqsBTSrm91+XasMYYySI8eeRxH3ZvHkMz3BQ5aJ3iUVbYPNM3/7emRtjlsMgv/9VyTsyt/mK+8fgWeT6SoFaclXqn42dAIsvAarF5vNNWHzKSkKQ/8Hfk5ZWK7r9yliOsooyBjRhfkHP4Q2DkWXQi6FG/9r/IwbmkV5T7JSopHKn1pJwm9tb5Ot0oyN1Z2mPpKXHTxx2nlK08fKk1hEYA8WgVVWL5lgx0iTv+KdojJeU23ZDjmiubXOxVXJKKi2Wjuh2HLZOFLiSC7Tls5SMh4f+Pj6xUSrNjFqLGehRNB8lC0QSLNmkJJx/wSG3MnjE9T1CkPwJI0wH2lfzwETIiVqUxg0dfu5q39Gt+hwdcxkhhNvQ4TyrBceof3Mhs/IxFci1HmHr4FMZgXEEczPiGCx0HRwzAqDq2j9AVm1kwN0mRVLWLylgtoPNapF5cY4Y1wJh/e0BBwZj44YgZrDNqvD/9Hv7GFYdUQeDJuQ3EWI4HaKqavU1XjC/n41kT4L79kqGq0kLhdTZvgP3TA3fS0ozVz+5piZsoOtIvBUFoMKbNcmBL6YxxaUAusHB38XrS8dQMnQwJfUUkpRoGr5AUeWicvBTzyK9g77+yCkf5PAysL7r/JjcZgrbvRpMW9iyaxZvKO6ceZN2EwIxKwVFPuvFuiEPGCoagbMo+SpydLrXqBzNCDGFCrO/rkcwa2xhokQZ5CdZ0AsU3JfSqJ6n5I14YA+P/uAgfhPU84Tlw7cEFfp7AEE8ey4sP12PTt4Cods1GRgDOB5xvyiR5m+Bx8O5nBCNctU8BevfV5A08x6RHd5jcwPTMDSZJOedIZ1cGQ704lxbAzqZOP05ZxaOghzSdvFBHYqomATARyAADK4elP8Ly3IrUZKfWh23Xy20uBUmLS4Pfagu9+oyVa2iPgqRP3F2CTUsvJ7+RYnN8fFZbU/HVvxvcFFDKkiTqV5UBZ3Gz54JAKByi9hkKMZJvuGgcSYXFmw08UyoQyVdfTD1/dMkCHXcTGAKeROgArsvmRrQTLUOXioOHGK2QkjHuoYFgXciZoTJd6Fs5q1QX1G+p/e26hYsEf7QZD1nnIyl/SFkNtYYmmBhpBrxl9WbY0YpHWRuw2Ll/tj9mD8P4snVzJl4F9J+1arVeTb9E5r2ILH04qStjxQNwn3m4YNqxmaNbLAqW2TN6LidwuJRqS+NXbtqxoeDXpxeGWmxzSkWxjkyCkX4NQRme6q5SAcC+M7+9ETfA/EwrzQajKakCwYyeunP6ZFlxU2oMEn1Pz31zeStW74G406ZJFCl1wAXIoUKkWotYEpOuXB1uVNxJ63dpJEqfxBeptwIHNrPz8BllZoIcBoXwgfJ+8VAUnVPvRvexnw0Ma/WiGYuJO5y8QTvEYBigFmhUxY5RqzE8OcywN/8m4UYrlaniJO75XQ6KSo9+tWHlu+hMi0UVdiKQp7NelnoZUzNaIyBPVeOwK6GNp+FfHuPOoyhaWuNvTYFkvxscMQWDh+zeFCFkgwbXftiV23ywJ4+uwRqmg9k3KzwIQpzppt8DBBOMbrqwQM5Gb05sEwdKzMiAqOloaA/lr0KA+1pr0/+HiWoiIjHA/wir2nIuS3PeU/ji3O6ZwoxcR1SZ9FhtLC5S0FIzFhbBWcGVP/KpxOPSiUoAdWUpqKH++6Scz507iCcxYI6rdMBICPJZea7OcmeFw5mObJSiqpjg2UoWNIs+cFhyDSt6geV5qgi3FunmwwDoGSMgerFOZGX1m0dMCYo5XOruxO063dwENK9DbnVM9wYFREzh4vyU1WYYJ/LRRp6oxgjqP/X5a8/4Af6p6NWkQferzBmXme0zY/4nwMJm/wd1tIqSwGz+E3xPEAOoZlJit3XddD7/BT1pllzOx+8bmQtANQ/S6fZexc6qi3W+Q2xcmXTUhuS5mpHQRvcxZUN0S5+PL9lXWUAaRZhEH8hTdAcuNMMCuVNKTEGtSUKNi3O6KhSaTzck8csZ2vWRZ+d7mW8c4IKwXIYd25S/zIftPkwPzufjEvOHWVD1m+FjpDVUTV0DGDuHj6QnaEwLu/dEgdLQOg9E1Sro9XHJ8ykLAwtPu+pxqKDuFexqON1sKQm7rwbE1E68UCfA/erovrTCG+DBSNg0l4goDQvZN6uNlbyLpcZAwj2UclycvLpIZMgv4yRlpb3YuMftozorbcGVHt/VeDV3+Fdf1TP0iuaCsPi2G4XeGhsyF1ubVDxkoJhmniQ0/jSg/eYML9KLfnCFgISWkp91eauR3IQvED0nAPXK+6hPCYs+n3+hCZbiskmVMG2da+0EsZPonUeIY8EbfusQXjsK/eFDaosbPjEfQS0RKG7yj5GG69M7MeO1HmiUYocgygJHL6M1qzUDDwUSmr99V7Sdr2F3JjQAJY+F0yH33Iv3+C9M38eML7gTgmNu/r2bUMiPvpYbZ6v1/IaESirBHNa7mPKn4dEmYg7v/+HQgPN1G79jBQ1+soydfDC2r+h2Bl/KIc5KjMK7OH6nb1jLsNf0EHVe2KBiE51ox636uyG6Lho0t3J34L5QY/ilE3mikaF4HKXG1mG1rCevT1Vv6GavltxoQe/bMrpZvRggnBxSEPEeEzkEdOxTnPXHVjUYdw8JYvjB/o7Eegc3Ma+NUxLLnsK0kJlinPmUHzHGtrk5+CAbVzFOBqpyy3QVUnzTDfC/0XD94/okH+OB+i7g9lolhWIjSnfIb+Eq43ZXOWmwvjyV/qqD+t0e+7mTEM74qP/Ozt8nmC7mRpyu63OB4KnUzFc074SqoyPUAgM+/TJGFo6T44EHnQU4X4z6qannVqgw/U7zCpwcmXV1AubIrvOmkKHazJAR55ePjp5tLBsN8vAqs3NAHdcEHOR2xQ0lsNAFzSUuxFQCFYvXLZJdOj9p4fNq6p0HBGUik2YzaI4xySy91KzhQ0+q1hjxvImRwPRf76tChlRkhRCi74NXZ9qUNeIwP+s5p+3m5nwPdNOHgSLD79n7O9m1n1uDHiMntq4nkYwV5OZ1ENbXxFd4PgrlvavZsyUO4MqYlqqn1O8W/I1dEZq5dXhrbETLaZIbC2Kj/Aa/QM+fqUOHdf0tXAQ1huZ3cmWECWSXy/43j35+Mvq9xws7JKseriZ1pEWKc8qlzNrGPUGcVgOa9cPJYIJsGnJTAUsEcDOEVULO5x0rXBijc1lgXEzQQKhROf8zIV82w8eswc78YX11KYLWQRcgHNJElBxfXr72lS2RBSl07qTKorO2uUDZr3sFhYsvnhLZn0A94KRzJ/7DEGIAhW5ZWFpL8gEwu1aLA9MuWZzNwl8Oze9Y+bX+v9gywRVnoB5I/8kXTXU3141yRLYrIOOz6SOnyHNy4SieqzkBXharjfjqq1q6tklaEbA8Qfm2DaIPs7OTq/nvJBjKfO2H9bH2cCMh1+5gspfycu8f/cuuRmtDjyqZ7uCIMyjdV3a+p3fqmXsRx4C8lujezIFHnQiVTXLXuI1XrwN3+siYYj2HHTvESUx8DlOTXpak9qFRK+L3mgJ1WsD7F4cu1aJoFoYQnu+wGDMOjJM3kiBQWHCcvhJ/HRdxodOQp45YZaOTA22Nb4XKCVxqkbwMYFhzYQYIAnCW8FW14uf98jhUG2zrKhQQ0q0CEq0t5nXyvUyvR8DvD69LU+g3i+HFWQMQ8PqZuHD+sNKAV0+M6EJC0szq7rEr7B5bQ8BcNHzvDMc9eqB5ZCQdTf80Obn4uzjwpYU7SISdtV0QGa9D3Wrh2BDQtpBKxaNFV+/Cy2P/Sv+8s7Ud0Fd74X4+o/TNztWgETUapy+majNQ68Lq3ee0ZO48VEbTZYiH1Co4OlfWef82RWeyUXo7woM03PyapGfikTnQinoNq5z5veLpeMV3HCAMTaZmA1oGLAn7XS3XYsz+XK7VMQsc4XKrmDXOLU/pSXVNUq8dIqTba///3x6LiLS6xs1xuCAYSfcQ3+rQgmu7uvf3THKt5Ooo97TqcbRqxx7EASizaQCBQllG/rYxVapMLgtLbZS64w1MDBMXX+PQpBKNwqUKOf2DDRDUXQf9EhOS0Qj4nTmlA8dzSLz/G1d+Ud8MTy/6ghhdiLpeerGY/UlDOfiuqFsMUU5/UYlP+BAmgRLuNpvrUaLlVkrqDievNVEAwF+4CoM1MZTmjxjJMsKJq+u8Zd7tNCUFy6LiyYXRJQ4VyvEQFFaCGKsxIwQkk7EzZ6LTJq2hUuPhvAW+gQnSG6J+MszC+7QCRHcnqDdyNRJ6T9xyS87A6MDutbzKGvGktpbXqtzWtXb9HsfK2cBMomjN9a4y+TaJLnXxAeX/HWzmf4cR4vALt/P4w4qgKY04ml4ZdLOinFYS6cup3G/1ie4+t1eOnpBNlqGqs75ilzkT4+DsZQxNvaSKJ//6zIbbk/M7LOhFmRc/1R+kBtz7JFGdZm/COotIdvQoXpTqP/1uqEUmCb/QWoGLMwO5ANcHzxdY48IGP5+J+zKOTBFZ4Pid+GTM+Wq12MV/H86xEJptBa6T+p3kgpwLedManBHC2GgNrFpoN2xnrMz9WFWX/8/ygSBkavq2Uv7FdCsLEYLu9LLIvAU0bNRDtzYl+/vXmjpIvuJFYjmI0im6QEYqnIeMsNjXG4vIutIGHijeAG/9EDBozKV5cldkHbLxHh25vT+ZEzbhXlqvpzKJwcEgfNwLAKFeo0/pvEE10XDB+EXRTXtSzJozQKFFAJhMxYkVaCW+E9AL7tMeU8acxidHqzb6lX4691UsDpy/LLRmT+epgW56+5Cw8tB4kMUv6s9lh3eRKbyGs+H/4mQMaYzPTf2OOdokEn+zzgvoD3FqNKk8QqGAXVsqcGdXrT62fSPkR2vROFi68A6se86UxRUk4cajfPyCC4G5wDhD+zNq4jodQ4u4n/m37Lr36n4LIAAsVr02dFi9AiwA81MYs2rm4eDlDNmdMRvEKRHfBwW5DdMNp0jPFZMeARqF/wL4XBfd+EMLBfMzpH5GH6NaW+1vrvMdg+VxDzatk3MXgO3ro3P/DpcC6+Mo4MySJhKJhSR01SGGGp5hPWmrrUgrv3lDnP+HhcI3nt3YqBoVAVTBAQT5iuhTg8nvPtd8ZeYj6w1x6RqGUBrSku7+N1+BaasZvjTk64RoIDlL8brpEcJx3OmY7jLoZsswdtmhfC/G21llXhITOwmvRDDeTTPbyASOa16cF5/A1fZAidJpqju3wYAy9avPR1ya6eNp9K8XYrrtuxlqi+bDKwlfrYdR0RRiKRVTLOH85+ZY7XSmzRpfZBJjaTa81VDcJHpZnZnSQLASGYW9l51ZV/h7eVzTi3Hv6hUsgc/51AqJRTkpbFVLXXszoBL8nBX0u/0jBLT8nH+fJePbrwURT58OY+UieRjd1vs04w0VG5VN2U6MoGZkQzKN/ptz0Q366dxoTGmj7i1NQGHi9GgnquXFYdrCfZBmeb7s0T6yrdlZH5cZuwHFyIJ/kAtGsTg0xH5taAAq44BAk1CPk9KVVbqQzrCUiFdF/6gtlPQ8bHHc1G1W92MXGZ5HEHftyLYs8mbD/9xYRUWkHmlM0zC2ilJlnNgV4bfALpQghxOUoZL7VTqtCHIaQSXm+YUMnpkXybnV+A6xlm2CVy8fn0Xlm2XRa0+zzOa21JWWmixfiPMSCZ7qA4rS93VN3pkpF1s5TonQjisHf7iU9ZGvUPOAKZcR1pbeVf/Ul7OhepGCaId9wOtqo7pJ7yLcBZ0pFkOF28y4zEI/kcUNmutBHaQpBdNM8vjCS6HZRokkeo88TBAjGyG7SR+6vUgTcyK9Imalj0kuxz0wmK+byQU11AiJFk/ya5dNduRClcnU64yGu/ieWSeOos1t3ep+RPIWQ2pyTYVbZltTbsb7NiwSi3AV+8KLWk7LxCnfZUetEM8ThnsSoGH38/nyAwFguJp8FjvlHtcWZuU4hPva0rHfr0UhOOJ/F6vS62FW7KzkmRll2HEc7oUq4fyi5T70Vl7YVIfsPHUCdHesf9Lk7WNVWO75JDkYbMI8TOW8JKVtLY9d6UJRITO8oKo0xS+o99Yy04iniGHAaGj88kEWgwv0OrHdY/nr76DOGNS59hXCGXzTKUvDl9iKpLSWYN1lxIeyywdNpTkhay74w2jFT6NS8qkjo5CxA1yfSYwp6AJIZNKIeEK5PJAW7ORgWgwp0VgzYpqovMrWxbu+DGZ6Lhie1RAqpzm8VUzKJOH3mCzWuTOLsN3VT/dv2eeYe9UjbR8YTBsLz7q60VN1sU51k+um1f8JxD5pPhbhSC8rRaB454tmh6YUWrJI3+GWY0qeWioj/tbkYITOkJaeuGt4JrJvHA+l0Gu7kY7XOaa05alMnRWVCXqFgLIwSY4uF59Ue5SU4QKuc/HamDxbr0x6csCetXGoP7Qn1Bk/J9DsynO/UD6iZ1Hyrz+jit0hDCwi/E9OjgKTbB3ZQKQ/0ZOvevfNHG0NK4Aj3Cp7NpRk07RT1i/S0EL93Ag8GRgKI9CfpajKyK6+Jj/PI1KO5/85VAwz2AwzP8FTBb075IxCXv6T9RVvWT2tUaqxDS92zrGUbWzUYk9mSs82pECH+fkqsDt93VW++4YsR/dHCYcQSYTO/KaBMDj9LSD/J/+z20Kq8XvZUAIHtm9hRPP3ItbuAu2Hm5lkPs92pd7kCxgRs0xOVBnZ13ccdA0aunrwv9SdqElJRC3g+oCu+nXyCgmXUs9yMjTMAIHfxZV+aPKcZeUBWt057Xo85Ks1Ir5gzEHCWqZEhrLZMuF11ziGtFQUds/EESajhagzcKsxamcSZxGth4UII+adPhQkUnx2WyN+4YWR+r3f8MnkyGFuR4zjzxJS8WsQYR5PTyRaD9ixa6Mh741nBHbzfjXHskGDq179xaRNrCIB1z1xRfWfjqw2pHc1zk9xlPpL8sQWAIuETZZhbnmL54rceXVNRvUiKrrqIkeogsl0XXb17ylNb0f4GA9Wd44vffEG8FSZGHEL2fbaTGRcSiCeA8PmA/f6Hz8HCS76fXUHwgwkzSwlI71ekZ7Fapmlk/KC+Hs8hUcw3N2LN5LhkVYyizYFl/uPeVP5lsoJHhhfWvvSWruCUW1ZcJOeuTbrDgywJ/qG07gZJplnTvLcYdNaH0KMYOYMGX+rB4NGPFmQsNaIwlWrfCezxre8zXBrsMT+edVLbLqN1BqB76JH4BvZTqUIMfGwPGEn+EnmTV86fPBaYbFL3DFEhjB45CewkXEAtJxk4/Ms2pPXnaRqdky0HOYdcUcE2zcXq4vaIvW2/v0nHFJH2XXe22ueDmq/18XGtELSq85j9X8q0tcNSSKJIX8FTuJF/Pf8j5PhqG2u+osvsLxYrvvfeVJL+4tkcXcr9JV7v0ERmj/X6fM3NC4j6dS1+9Umr2oPavqiAydTZPLMNRGY23LO9zAVDly7jD+70G5TPPLdhRIl4WxcYjLnM+SNcJ26FOrkrISUtPObIz5Zb3AG612krnpy15RMW+1cQjlnWFI6538qky9axd2oJmHIHP08KyP0ubGO+TQNOYuv2uh17yCIvR8VcStw7o1g0NM60sk+8Tq7YfIBJrtp53GkvzXH7OA0p8/n/u1satf/VJhtR1l8Wa6Gmaug7haSpaCaYQax6ta0mkutlb+eAOSG1aobM81D9A4iS1RRlzBBoVX6tU1S6WE2N9ORY6DfeLRC4l9Rvr5h95XDWB2mR1d4WFudpsgVYwiTwT31ljskD8ZyDOlm5DkGh9N/UB/0AI5Xvb8ZBmai2hQ4BWMqFwYnzxwB26YHSOv9WgY3JXnvoN+2R4rqGVh/LLDMtpFP+SpMGJNWvbIl5SOodbCczW2RKleksPoUeGEzrjtKHVdtZA+kfqO+rVx/iclCqwoopepvJpSTDjT+b9GWylGRF8EDbGlw6eUzmJM95Ovoz+kwLX3c2fTjFeYEsE7vUZm3mqdGJuKh2w9/QGSaqRHs99aScGOdDqkFcACoqdbBoQqqjamhH6Q9ng39JCg3lrGJwd50Qk9ovnqBTr8MME7Ps2wiVfygUmPoUBJJfJWX5Nda0nuncbFkA=='));
}

},{"./decoder.js":34,"@ethersproject/base64":21}],36:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ens_normalize = ens_normalize;
exports.ens_normalize_post_check = ens_normalize_post_check;
var _strings = require("@ethersproject/strings");
var _include = require("./include.js");
var _decoder = require("./decoder.js");
/**
 * MIT License
 *
 * Copyright (c) 2021 Andrew Raffensperger
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * This is a near carbon-copy of the original source (link below) with the
 * TypeScript typings added and a few tweaks to make it ES3-compatible.
 *
 * See: https://github.com/adraffy/ens-normalize.js
 */

const r = (0, _include.getData)();
// @TODO: This should be lazily loaded
const VALID = new Set((0, _decoder.read_member_array)(r));
const IGNORED = new Set((0, _decoder.read_member_array)(r));
const MAPPED = (0, _decoder.read_mapped_map)(r);
const EMOJI_ROOT = (0, _decoder.read_emoji_trie)(r);
//const NFC_CHECK = new Set(read_member_array(r, Array.from(VALID.values()).sort((a, b) => a - b)));
//const STOP = 0x2E;
const HYPHEN = 0x2D;
const UNDERSCORE = 0x5F;
function explode_cp(name) {
  return (0, _strings.toUtf8CodePoints)(name);
}
function filter_fe0f(cps) {
  return cps.filter(cp => cp != 0xFE0F);
}
function ens_normalize_post_check(name) {
  for (let label of name.split('.')) {
    let cps = explode_cp(label);
    try {
      for (let i = cps.lastIndexOf(UNDERSCORE) - 1; i >= 0; i--) {
        if (cps[i] !== UNDERSCORE) {
          throw new Error(`underscore only allowed at start`);
        }
      }
      if (cps.length >= 4 && cps.every(cp => cp < 0x80) && cps[2] === HYPHEN && cps[3] === HYPHEN) {
        throw new Error(`invalid label extension`);
      }
    } catch (err) {
      throw new Error(`Invalid label "${label}": ${err.message}`);
    }
  }
  return name;
}
function ens_normalize(name) {
  return ens_normalize_post_check(normalize(name, filter_fe0f));
}
function normalize(name, emoji_filter) {
  let input = explode_cp(name).reverse(); // flip for pop
  let output = [];
  while (input.length) {
    let emoji = consume_emoji_reversed(input);
    if (emoji) {
      output.push(...emoji_filter(emoji));
      continue;
    }
    let cp = input.pop();
    if (VALID.has(cp)) {
      output.push(cp);
      continue;
    }
    if (IGNORED.has(cp)) {
      continue;
    }
    let cps = MAPPED[cp];
    if (cps) {
      output.push(...cps);
      continue;
    }
    throw new Error(`Disallowed codepoint: 0x${cp.toString(16).toUpperCase()}`);
  }
  return ens_normalize_post_check(nfc(String.fromCodePoint(...output)));
}
function nfc(s) {
  return s.normalize('NFC');
}
function consume_emoji_reversed(cps, eaten) {
  var _a;
  let node = EMOJI_ROOT;
  let emoji;
  let saved;
  let stack = [];
  let pos = cps.length;
  if (eaten) eaten.length = 0; // clear input buffer (if needed)
  while (pos) {
    let cp = cps[--pos];
    node = (_a = node.branches.find(x => x.set.has(cp))) === null || _a === void 0 ? void 0 : _a.node;
    if (!node) break;
    if (node.save) {
      // remember
      saved = cp;
    } else if (node.check) {
      // check exclusion
      if (cp === saved) break;
    }
    stack.push(cp);
    if (node.fe0f) {
      stack.push(0xFE0F);
      if (pos > 0 && cps[pos - 1] == 0xFE0F) pos--; // consume optional FE0F
    }
    if (node.valid) {
      // this is a valid emoji (so far)
      emoji = stack.slice(); // copy stack
      if (node.valid == 2) emoji.splice(1, 1); // delete FE0F at position 1 (RGI ZWJ don't follow spec!)
      if (eaten) eaten.push(...cps.slice(pos).reverse()); // copy input (if needed)
      cps.length = pos; // truncate
    }
  }
  return emoji;
}

},{"./decoder.js":34,"./include.js":35,"@ethersproject/strings":52}],37:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.id = id;
var _keccak = require("@ethersproject/keccak256");
var _strings = require("@ethersproject/strings");
function id(text) {
  return (0, _keccak.keccak256)((0, _strings.toUtf8Bytes)(text));
}

},{"@ethersproject/keccak256":42,"@ethersproject/strings":52}],38:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "_TypedDataEncoder", {
  enumerable: true,
  get: function () {
    return _typedData.TypedDataEncoder;
  }
});
Object.defineProperty(exports, "dnsEncode", {
  enumerable: true,
  get: function () {
    return _namehash.dnsEncode;
  }
});
Object.defineProperty(exports, "ensNormalize", {
  enumerable: true,
  get: function () {
    return _namehash.ensNormalize;
  }
});
Object.defineProperty(exports, "hashMessage", {
  enumerable: true,
  get: function () {
    return _message.hashMessage;
  }
});
Object.defineProperty(exports, "id", {
  enumerable: true,
  get: function () {
    return _id.id;
  }
});
Object.defineProperty(exports, "isValidName", {
  enumerable: true,
  get: function () {
    return _namehash.isValidName;
  }
});
Object.defineProperty(exports, "messagePrefix", {
  enumerable: true,
  get: function () {
    return _message.messagePrefix;
  }
});
Object.defineProperty(exports, "namehash", {
  enumerable: true,
  get: function () {
    return _namehash.namehash;
  }
});
var _id = require("./id");
var _namehash = require("./namehash");
var _message = require("./message");
var _typedData = require("./typed-data");

},{"./id":37,"./message":39,"./namehash":40,"./typed-data":41}],39:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hashMessage = hashMessage;
exports.messagePrefix = void 0;
var _bytes = require("@ethersproject/bytes");
var _keccak = require("@ethersproject/keccak256");
var _strings = require("@ethersproject/strings");
const messagePrefix = exports.messagePrefix = "\x19Ethereum Signed Message:\n";
function hashMessage(message) {
  if (typeof message === "string") {
    message = (0, _strings.toUtf8Bytes)(message);
  }
  return (0, _keccak.keccak256)((0, _bytes.concat)([(0, _strings.toUtf8Bytes)(messagePrefix), (0, _strings.toUtf8Bytes)(String(message.length)), message]));
}

},{"@ethersproject/bytes":27,"@ethersproject/keccak256":42,"@ethersproject/strings":52}],40:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.dnsEncode = dnsEncode;
exports.ensNormalize = ensNormalize;
exports.isValidName = isValidName;
exports.namehash = namehash;
var _bytes = require("@ethersproject/bytes");
var _strings = require("@ethersproject/strings");
var _keccak = require("@ethersproject/keccak256");
var _logger = require("@ethersproject/logger");
var _version = require("./_version");
var _lib = require("./ens-normalize/lib");
const logger = new _logger.Logger(_version.version);
const Zeros = new Uint8Array(32);
Zeros.fill(0);
function checkComponent(comp) {
  if (comp.length === 0) {
    throw new Error("invalid ENS name; empty component");
  }
  return comp;
}
function ensNameSplit(name) {
  const bytes = (0, _strings.toUtf8Bytes)((0, _lib.ens_normalize)(name));
  const comps = [];
  if (name.length === 0) {
    return comps;
  }
  let last = 0;
  for (let i = 0; i < bytes.length; i++) {
    const d = bytes[i];
    // A separator (i.e. "."); copy this component
    if (d === 0x2e) {
      comps.push(checkComponent(bytes.slice(last, i)));
      last = i + 1;
    }
  }
  // There was a stray separator at the end of the name
  if (last >= bytes.length) {
    throw new Error("invalid ENS name; empty component");
  }
  comps.push(checkComponent(bytes.slice(last)));
  return comps;
}
function ensNormalize(name) {
  return ensNameSplit(name).map(comp => (0, _strings.toUtf8String)(comp)).join(".");
}
function isValidName(name) {
  try {
    return ensNameSplit(name).length !== 0;
  } catch (error) {}
  return false;
}
function namehash(name) {
  /* istanbul ignore if */
  if (typeof name !== "string") {
    logger.throwArgumentError("invalid ENS name; not a string", "name", name);
  }
  let result = Zeros;
  const comps = ensNameSplit(name);
  while (comps.length) {
    result = (0, _keccak.keccak256)((0, _bytes.concat)([result, (0, _keccak.keccak256)(comps.pop())]));
  }
  return (0, _bytes.hexlify)(result);
}
function dnsEncode(name) {
  return (0, _bytes.hexlify)((0, _bytes.concat)(ensNameSplit(name).map(comp => {
    // DNS does not allow components over 63 bytes in length
    if (comp.length > 63) {
      throw new Error("invalid DNS encoded entry; length exceeds 63 bytes");
    }
    const bytes = new Uint8Array(comp.length + 1);
    bytes.set(comp, 1);
    bytes[0] = bytes.length - 1;
    return bytes;
  }))) + "00";
}

},{"./_version":33,"./ens-normalize/lib":36,"@ethersproject/bytes":27,"@ethersproject/keccak256":42,"@ethersproject/logger":44,"@ethersproject/strings":52}],41:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.TypedDataEncoder = void 0;
var _address = require("@ethersproject/address");
var _bignumber = require("@ethersproject/bignumber");
var _bytes = require("@ethersproject/bytes");
var _keccak = require("@ethersproject/keccak256");
var _properties = require("@ethersproject/properties");
var _logger = require("@ethersproject/logger");
var _version = require("./_version");
var _id = require("./id");
var __awaiter = void 0 && (void 0).__awaiter || function (thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function (resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
const logger = new _logger.Logger(_version.version);
const padding = new Uint8Array(32);
padding.fill(0);
const NegativeOne = _bignumber.BigNumber.from(-1);
const Zero = _bignumber.BigNumber.from(0);
const One = _bignumber.BigNumber.from(1);
const MaxUint256 = _bignumber.BigNumber.from("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
function hexPadRight(value) {
  const bytes = (0, _bytes.arrayify)(value);
  const padOffset = bytes.length % 32;
  if (padOffset) {
    return (0, _bytes.hexConcat)([bytes, padding.slice(padOffset)]);
  }
  return (0, _bytes.hexlify)(bytes);
}
const hexTrue = (0, _bytes.hexZeroPad)(One.toHexString(), 32);
const hexFalse = (0, _bytes.hexZeroPad)(Zero.toHexString(), 32);
const domainFieldTypes = {
  name: "string",
  version: "string",
  chainId: "uint256",
  verifyingContract: "address",
  salt: "bytes32"
};
const domainFieldNames = ["name", "version", "chainId", "verifyingContract", "salt"];
function checkString(key) {
  return function (value) {
    if (typeof value !== "string") {
      logger.throwArgumentError(`invalid domain value for ${JSON.stringify(key)}`, `domain.${key}`, value);
    }
    return value;
  };
}
const domainChecks = {
  name: checkString("name"),
  version: checkString("version"),
  chainId: function (value) {
    try {
      return _bignumber.BigNumber.from(value).toString();
    } catch (error) {}
    return logger.throwArgumentError(`invalid domain value for "chainId"`, "domain.chainId", value);
  },
  verifyingContract: function (value) {
    try {
      return (0, _address.getAddress)(value).toLowerCase();
    } catch (error) {}
    return logger.throwArgumentError(`invalid domain value "verifyingContract"`, "domain.verifyingContract", value);
  },
  salt: function (value) {
    try {
      const bytes = (0, _bytes.arrayify)(value);
      if (bytes.length !== 32) {
        throw new Error("bad length");
      }
      return (0, _bytes.hexlify)(bytes);
    } catch (error) {}
    return logger.throwArgumentError(`invalid domain value "salt"`, "domain.salt", value);
  }
};
function getBaseEncoder(type) {
  // intXX and uintXX
  {
    const match = type.match(/^(u?)int(\d*)$/);
    if (match) {
      const signed = match[1] === "";
      const width = parseInt(match[2] || "256");
      if (width % 8 !== 0 || width > 256 || match[2] && match[2] !== String(width)) {
        logger.throwArgumentError("invalid numeric width", "type", type);
      }
      const boundsUpper = MaxUint256.mask(signed ? width - 1 : width);
      const boundsLower = signed ? boundsUpper.add(One).mul(NegativeOne) : Zero;
      return function (value) {
        const v = _bignumber.BigNumber.from(value);
        if (v.lt(boundsLower) || v.gt(boundsUpper)) {
          logger.throwArgumentError(`value out-of-bounds for ${type}`, "value", value);
        }
        return (0, _bytes.hexZeroPad)(v.toTwos(256).toHexString(), 32);
      };
    }
  }
  // bytesXX
  {
    const match = type.match(/^bytes(\d+)$/);
    if (match) {
      const width = parseInt(match[1]);
      if (width === 0 || width > 32 || match[1] !== String(width)) {
        logger.throwArgumentError("invalid bytes width", "type", type);
      }
      return function (value) {
        const bytes = (0, _bytes.arrayify)(value);
        if (bytes.length !== width) {
          logger.throwArgumentError(`invalid length for ${type}`, "value", value);
        }
        return hexPadRight(value);
      };
    }
  }
  switch (type) {
    case "address":
      return function (value) {
        return (0, _bytes.hexZeroPad)((0, _address.getAddress)(value), 32);
      };
    case "bool":
      return function (value) {
        return !value ? hexFalse : hexTrue;
      };
    case "bytes":
      return function (value) {
        return (0, _keccak.keccak256)(value);
      };
    case "string":
      return function (value) {
        return (0, _id.id)(value);
      };
  }
  return null;
}
function encodeType(name, fields) {
  return `${name}(${fields.map(({
    name,
    type
  }) => type + " " + name).join(",")})`;
}
class TypedDataEncoder {
  constructor(types) {
    (0, _properties.defineReadOnly)(this, "types", Object.freeze((0, _properties.deepCopy)(types)));
    (0, _properties.defineReadOnly)(this, "_encoderCache", {});
    (0, _properties.defineReadOnly)(this, "_types", {});
    // Link struct types to their direct child structs
    const links = {};
    // Link structs to structs which contain them as a child
    const parents = {};
    // Link all subtypes within a given struct
    const subtypes = {};
    Object.keys(types).forEach(type => {
      links[type] = {};
      parents[type] = [];
      subtypes[type] = {};
    });
    for (const name in types) {
      const uniqueNames = {};
      types[name].forEach(field => {
        // Check each field has a unique name
        if (uniqueNames[field.name]) {
          logger.throwArgumentError(`duplicate variable name ${JSON.stringify(field.name)} in ${JSON.stringify(name)}`, "types", types);
        }
        uniqueNames[field.name] = true;
        // Get the base type (drop any array specifiers)
        const baseType = field.type.match(/^([^\x5b]*)(\x5b|$)/)[1];
        if (baseType === name) {
          logger.throwArgumentError(`circular type reference to ${JSON.stringify(baseType)}`, "types", types);
        }
        // Is this a base encoding type?
        const encoder = getBaseEncoder(baseType);
        if (encoder) {
          return;
        }
        if (!parents[baseType]) {
          logger.throwArgumentError(`unknown type ${JSON.stringify(baseType)}`, "types", types);
        }
        // Add linkage
        parents[baseType].push(name);
        links[name][baseType] = true;
      });
    }
    // Deduce the primary type
    const primaryTypes = Object.keys(parents).filter(n => parents[n].length === 0);
    if (primaryTypes.length === 0) {
      logger.throwArgumentError("missing primary type", "types", types);
    } else if (primaryTypes.length > 1) {
      logger.throwArgumentError(`ambiguous primary types or unused types: ${primaryTypes.map(t => JSON.stringify(t)).join(", ")}`, "types", types);
    }
    (0, _properties.defineReadOnly)(this, "primaryType", primaryTypes[0]);
    // Check for circular type references
    function checkCircular(type, found) {
      if (found[type]) {
        logger.throwArgumentError(`circular type reference to ${JSON.stringify(type)}`, "types", types);
      }
      found[type] = true;
      Object.keys(links[type]).forEach(child => {
        if (!parents[child]) {
          return;
        }
        // Recursively check children
        checkCircular(child, found);
        // Mark all ancestors as having this decendant
        Object.keys(found).forEach(subtype => {
          subtypes[subtype][child] = true;
        });
      });
      delete found[type];
    }
    checkCircular(this.primaryType, {});
    // Compute each fully describe type
    for (const name in subtypes) {
      const st = Object.keys(subtypes[name]);
      st.sort();
      this._types[name] = encodeType(name, types[name]) + st.map(t => encodeType(t, types[t])).join("");
    }
  }
  getEncoder(type) {
    let encoder = this._encoderCache[type];
    if (!encoder) {
      encoder = this._encoderCache[type] = this._getEncoder(type);
    }
    return encoder;
  }
  _getEncoder(type) {
    // Basic encoder type (address, bool, uint256, etc)
    {
      const encoder = getBaseEncoder(type);
      if (encoder) {
        return encoder;
      }
    }
    // Array
    const match = type.match(/^(.*)(\x5b(\d*)\x5d)$/);
    if (match) {
      const subtype = match[1];
      const subEncoder = this.getEncoder(subtype);
      const length = parseInt(match[3]);
      return value => {
        if (length >= 0 && value.length !== length) {
          logger.throwArgumentError("array length mismatch; expected length ${ arrayLength }", "value", value);
        }
        let result = value.map(subEncoder);
        if (this._types[subtype]) {
          result = result.map(_keccak.keccak256);
        }
        return (0, _keccak.keccak256)((0, _bytes.hexConcat)(result));
      };
    }
    // Struct
    const fields = this.types[type];
    if (fields) {
      const encodedType = (0, _id.id)(this._types[type]);
      return value => {
        const values = fields.map(({
          name,
          type
        }) => {
          const result = this.getEncoder(type)(value[name]);
          if (this._types[type]) {
            return (0, _keccak.keccak256)(result);
          }
          return result;
        });
        values.unshift(encodedType);
        return (0, _bytes.hexConcat)(values);
      };
    }
    return logger.throwArgumentError(`unknown type: ${type}`, "type", type);
  }
  encodeType(name) {
    const result = this._types[name];
    if (!result) {
      logger.throwArgumentError(`unknown type: ${JSON.stringify(name)}`, "name", name);
    }
    return result;
  }
  encodeData(type, value) {
    return this.getEncoder(type)(value);
  }
  hashStruct(name, value) {
    return (0, _keccak.keccak256)(this.encodeData(name, value));
  }
  encode(value) {
    return this.encodeData(this.primaryType, value);
  }
  hash(value) {
    return this.hashStruct(this.primaryType, value);
  }
  _visit(type, value, callback) {
    // Basic encoder type (address, bool, uint256, etc)
    {
      const encoder = getBaseEncoder(type);
      if (encoder) {
        return callback(type, value);
      }
    }
    // Array
    const match = type.match(/^(.*)(\x5b(\d*)\x5d)$/);
    if (match) {
      const subtype = match[1];
      const length = parseInt(match[3]);
      if (length >= 0 && value.length !== length) {
        logger.throwArgumentError("array length mismatch; expected length ${ arrayLength }", "value", value);
      }
      return value.map(v => this._visit(subtype, v, callback));
    }
    // Struct
    const fields = this.types[type];
    if (fields) {
      return fields.reduce((accum, {
        name,
        type
      }) => {
        accum[name] = this._visit(type, value[name], callback);
        return accum;
      }, {});
    }
    return logger.throwArgumentError(`unknown type: ${type}`, "type", type);
  }
  visit(value, callback) {
    return this._visit(this.primaryType, value, callback);
  }
  static from(types) {
    return new TypedDataEncoder(types);
  }
  static getPrimaryType(types) {
    return TypedDataEncoder.from(types).primaryType;
  }
  static hashStruct(name, types, value) {
    return TypedDataEncoder.from(types).hashStruct(name, value);
  }
  static hashDomain(domain) {
    const domainFields = [];
    for (const name in domain) {
      const type = domainFieldTypes[name];
      if (!type) {
        logger.throwArgumentError(`invalid typed-data domain key: ${JSON.stringify(name)}`, "domain", domain);
      }
      domainFields.push({
        name,
        type
      });
    }
    domainFields.sort((a, b) => {
      return domainFieldNames.indexOf(a.name) - domainFieldNames.indexOf(b.name);
    });
    return TypedDataEncoder.hashStruct("EIP712Domain", {
      EIP712Domain: domainFields
    }, domain);
  }
  static encode(domain, types, value) {
    return (0, _bytes.hexConcat)(["0x1901", TypedDataEncoder.hashDomain(domain), TypedDataEncoder.from(types).hash(value)]);
  }
  static hash(domain, types, value) {
    return (0, _keccak.keccak256)(TypedDataEncoder.encode(domain, types, value));
  }
  // Replaces all address types with ENS names with their looked up address
  static resolveNames(domain, types, value, resolveName) {
    return __awaiter(this, void 0, void 0, function* () {
      // Make a copy to isolate it from the object passed in
      domain = (0, _properties.shallowCopy)(domain);
      // Look up all ENS names
      const ensCache = {};
      // Do we need to look up the domain's verifyingContract?
      if (domain.verifyingContract && !(0, _bytes.isHexString)(domain.verifyingContract, 20)) {
        ensCache[domain.verifyingContract] = "0x";
      }
      // We are going to use the encoder to visit all the base values
      const encoder = TypedDataEncoder.from(types);
      // Get a list of all the addresses
      encoder.visit(value, (type, value) => {
        if (type === "address" && !(0, _bytes.isHexString)(value, 20)) {
          ensCache[value] = "0x";
        }
        return value;
      });
      // Lookup each name
      for (const name in ensCache) {
        ensCache[name] = yield resolveName(name);
      }
      // Replace the domain verifyingContract if needed
      if (domain.verifyingContract && ensCache[domain.verifyingContract]) {
        domain.verifyingContract = ensCache[domain.verifyingContract];
      }
      // Replace all ENS names with their address
      value = encoder.visit(value, (type, value) => {
        if (type === "address" && ensCache[value]) {
          return ensCache[value];
        }
        return value;
      });
      return {
        domain,
        value
      };
    });
  }
  static getPayload(domain, types, value) {
    // Validate the domain fields
    TypedDataEncoder.hashDomain(domain);
    // Derive the EIP712Domain Struct reference type
    const domainValues = {};
    const domainTypes = [];
    domainFieldNames.forEach(name => {
      const value = domain[name];
      if (value == null) {
        return;
      }
      domainValues[name] = domainChecks[name](value);
      domainTypes.push({
        name,
        type: domainFieldTypes[name]
      });
    });
    const encoder = TypedDataEncoder.from(types);
    const typesWithDomain = (0, _properties.shallowCopy)(types);
    if (typesWithDomain.EIP712Domain) {
      logger.throwArgumentError("types must not contain EIP712Domain type", "types.EIP712Domain", types);
    } else {
      typesWithDomain.EIP712Domain = domainTypes;
    }
    // Validate the data structures and types
    encoder.encode(value);
    return {
      types: typesWithDomain,
      domain: domainValues,
      primaryType: encoder.primaryType,
      message: encoder.visit(value, (type, value) => {
        // bytes
        if (type.match(/^bytes(\d*)/)) {
          return (0, _bytes.hexlify)((0, _bytes.arrayify)(value));
        }
        // uint or int
        if (type.match(/^u?int/)) {
          return _bignumber.BigNumber.from(value).toString();
        }
        switch (type) {
          case "address":
            return value.toLowerCase();
          case "bool":
            return !!value;
          case "string":
            if (typeof value !== "string") {
              logger.throwArgumentError(`invalid string`, "value", value);
            }
            return value;
        }
        return logger.throwArgumentError("unsupported type", "type", type);
      })
    };
  }
}
exports.TypedDataEncoder = TypedDataEncoder;

},{"./_version":33,"./id":37,"@ethersproject/address":19,"@ethersproject/bignumber":25,"@ethersproject/bytes":27,"@ethersproject/keccak256":42,"@ethersproject/logger":44,"@ethersproject/properties":46}],42:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.keccak256 = keccak256;
var _jsSha = _interopRequireDefault(require("js-sha3"));
var _bytes = require("@ethersproject/bytes");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
function keccak256(data) {
  return '0x' + _jsSha.default.keccak_256((0, _bytes.arrayify)(data));
}

},{"@ethersproject/bytes":27,"js-sha3":71}],43:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.version = void 0;
const version = exports.version = "logger/5.7.0";

},{}],44:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Logger = exports.LogLevel = exports.ErrorCode = void 0;
var _version = require("./_version");
let _permanentCensorErrors = false;
let _censorErrors = false;
const LogLevels = {
  debug: 1,
  "default": 2,
  info: 2,
  warning: 3,
  error: 4,
  off: 5
};
let _logLevel = LogLevels["default"];
let _globalLogger = null;
function _checkNormalize() {
  try {
    const missing = [];
    // Make sure all forms of normalization are supported
    ["NFD", "NFC", "NFKD", "NFKC"].forEach(form => {
      try {
        if ("test".normalize(form) !== "test") {
          throw new Error("bad normalize");
        }
        ;
      } catch (error) {
        missing.push(form);
      }
    });
    if (missing.length) {
      throw new Error("missing " + missing.join(", "));
    }
    if (String.fromCharCode(0xe9).normalize("NFD") !== String.fromCharCode(0x65, 0x0301)) {
      throw new Error("broken implementation");
    }
  } catch (error) {
    return error.message;
  }
  return null;
}
const _normalizeError = _checkNormalize();
var LogLevel;
(function (LogLevel) {
  LogLevel["DEBUG"] = "DEBUG";
  LogLevel["INFO"] = "INFO";
  LogLevel["WARNING"] = "WARNING";
  LogLevel["ERROR"] = "ERROR";
  LogLevel["OFF"] = "OFF";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var ErrorCode;
(function (ErrorCode) {
  ///////////////////
  // Generic Errors
  // Unknown Error
  ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
  // Not Implemented
  ErrorCode["NOT_IMPLEMENTED"] = "NOT_IMPLEMENTED";
  // Unsupported Operation
  //   - operation
  ErrorCode["UNSUPPORTED_OPERATION"] = "UNSUPPORTED_OPERATION";
  // Network Error (i.e. Ethereum Network, such as an invalid chain ID)
  //   - event ("noNetwork" is not re-thrown in provider.ready; otherwise thrown)
  ErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
  // Some sort of bad response from the server
  ErrorCode["SERVER_ERROR"] = "SERVER_ERROR";
  // Timeout
  ErrorCode["TIMEOUT"] = "TIMEOUT";
  ///////////////////
  // Operational  Errors
  // Buffer Overrun
  ErrorCode["BUFFER_OVERRUN"] = "BUFFER_OVERRUN";
  // Numeric Fault
  //   - operation: the operation being executed
  //   - fault: the reason this faulted
  ErrorCode["NUMERIC_FAULT"] = "NUMERIC_FAULT";
  ///////////////////
  // Argument Errors
  // Missing new operator to an object
  //  - name: The name of the class
  ErrorCode["MISSING_NEW"] = "MISSING_NEW";
  // Invalid argument (e.g. value is incompatible with type) to a function:
  //   - argument: The argument name that was invalid
  //   - value: The value of the argument
  ErrorCode["INVALID_ARGUMENT"] = "INVALID_ARGUMENT";
  // Missing argument to a function:
  //   - count: The number of arguments received
  //   - expectedCount: The number of arguments expected
  ErrorCode["MISSING_ARGUMENT"] = "MISSING_ARGUMENT";
  // Too many arguments
  //   - count: The number of arguments received
  //   - expectedCount: The number of arguments expected
  ErrorCode["UNEXPECTED_ARGUMENT"] = "UNEXPECTED_ARGUMENT";
  ///////////////////
  // Blockchain Errors
  // Call exception
  //  - transaction: the transaction
  //  - address?: the contract address
  //  - args?: The arguments passed into the function
  //  - method?: The Solidity method signature
  //  - errorSignature?: The EIP848 error signature
  //  - errorArgs?: The EIP848 error parameters
  //  - reason: The reason (only for EIP848 "Error(string)")
  ErrorCode["CALL_EXCEPTION"] = "CALL_EXCEPTION";
  // Insufficient funds (< value + gasLimit * gasPrice)
  //   - transaction: the transaction attempted
  ErrorCode["INSUFFICIENT_FUNDS"] = "INSUFFICIENT_FUNDS";
  // Nonce has already been used
  //   - transaction: the transaction attempted
  ErrorCode["NONCE_EXPIRED"] = "NONCE_EXPIRED";
  // The replacement fee for the transaction is too low
  //   - transaction: the transaction attempted
  ErrorCode["REPLACEMENT_UNDERPRICED"] = "REPLACEMENT_UNDERPRICED";
  // The gas limit could not be estimated
  //   - transaction: the transaction passed to estimateGas
  ErrorCode["UNPREDICTABLE_GAS_LIMIT"] = "UNPREDICTABLE_GAS_LIMIT";
  // The transaction was replaced by one with a higher gas price
  //   - reason: "cancelled", "replaced" or "repriced"
  //   - cancelled: true if reason == "cancelled" or reason == "replaced")
  //   - hash: original transaction hash
  //   - replacement: the full TransactionsResponse for the replacement
  //   - receipt: the receipt of the replacement
  ErrorCode["TRANSACTION_REPLACED"] = "TRANSACTION_REPLACED";
  ///////////////////
  // Interaction Errors
  // The user rejected the action, such as signing a message or sending
  // a transaction
  ErrorCode["ACTION_REJECTED"] = "ACTION_REJECTED";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
;
const HEX = "0123456789abcdef";
class Logger {
  constructor(version) {
    Object.defineProperty(this, "version", {
      enumerable: true,
      value: version,
      writable: false
    });
  }
  _log(logLevel, args) {
    const level = logLevel.toLowerCase();
    if (LogLevels[level] == null) {
      this.throwArgumentError("invalid log level name", "logLevel", logLevel);
    }
    if (_logLevel > LogLevels[level]) {
      return;
    }
    console.log.apply(console, args);
  }
  debug(...args) {
    this._log(Logger.levels.DEBUG, args);
  }
  info(...args) {
    this._log(Logger.levels.INFO, args);
  }
  warn(...args) {
    this._log(Logger.levels.WARNING, args);
  }
  makeError(message, code, params) {
    // Errors are being censored
    if (_censorErrors) {
      return this.makeError("censored error", code, {});
    }
    if (!code) {
      code = Logger.errors.UNKNOWN_ERROR;
    }
    if (!params) {
      params = {};
    }
    const messageDetails = [];
    Object.keys(params).forEach(key => {
      const value = params[key];
      try {
        if (value instanceof Uint8Array) {
          let hex = "";
          for (let i = 0; i < value.length; i++) {
            hex += HEX[value[i] >> 4];
            hex += HEX[value[i] & 0x0f];
          }
          messageDetails.push(key + "=Uint8Array(0x" + hex + ")");
        } else {
          messageDetails.push(key + "=" + JSON.stringify(value));
        }
      } catch (error) {
        messageDetails.push(key + "=" + JSON.stringify(params[key].toString()));
      }
    });
    messageDetails.push(`code=${code}`);
    messageDetails.push(`version=${this.version}`);
    const reason = message;
    let url = "";
    switch (code) {
      case ErrorCode.NUMERIC_FAULT:
        {
          url = "NUMERIC_FAULT";
          const fault = message;
          switch (fault) {
            case "overflow":
            case "underflow":
            case "division-by-zero":
              url += "-" + fault;
              break;
            case "negative-power":
            case "negative-width":
              url += "-unsupported";
              break;
            case "unbound-bitwise-result":
              url += "-unbound-result";
              break;
          }
          break;
        }
      case ErrorCode.CALL_EXCEPTION:
      case ErrorCode.INSUFFICIENT_FUNDS:
      case ErrorCode.MISSING_NEW:
      case ErrorCode.NONCE_EXPIRED:
      case ErrorCode.REPLACEMENT_UNDERPRICED:
      case ErrorCode.TRANSACTION_REPLACED:
      case ErrorCode.UNPREDICTABLE_GAS_LIMIT:
        url = code;
        break;
    }
    if (url) {
      message += " [ See: https:/\/links.ethers.org/v5-errors-" + url + " ]";
    }
    if (messageDetails.length) {
      message += " (" + messageDetails.join(", ") + ")";
    }
    // @TODO: Any??
    const error = new Error(message);
    error.reason = reason;
    error.code = code;
    Object.keys(params).forEach(function (key) {
      error[key] = params[key];
    });
    return error;
  }
  throwError(message, code, params) {
    throw this.makeError(message, code, params);
  }
  throwArgumentError(message, name, value) {
    return this.throwError(message, Logger.errors.INVALID_ARGUMENT, {
      argument: name,
      value: value
    });
  }
  assert(condition, message, code, params) {
    if (!!condition) {
      return;
    }
    this.throwError(message, code, params);
  }
  assertArgument(condition, message, name, value) {
    if (!!condition) {
      return;
    }
    this.throwArgumentError(message, name, value);
  }
  checkNormalize(message) {
    if (message == null) {
      message = "platform missing String.prototype.normalize";
    }
    if (_normalizeError) {
      this.throwError("platform missing String.prototype.normalize", Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "String.prototype.normalize",
        form: _normalizeError
      });
    }
  }
  checkSafeUint53(value, message) {
    if (typeof value !== "number") {
      return;
    }
    if (message == null) {
      message = "value not safe";
    }
    if (value < 0 || value >= 0x1fffffffffffff) {
      this.throwError(message, Logger.errors.NUMERIC_FAULT, {
        operation: "checkSafeInteger",
        fault: "out-of-safe-range",
        value: value
      });
    }
    if (value % 1) {
      this.throwError(message, Logger.errors.NUMERIC_FAULT, {
        operation: "checkSafeInteger",
        fault: "non-integer",
        value: value
      });
    }
  }
  checkArgumentCount(count, expectedCount, message) {
    if (message) {
      message = ": " + message;
    } else {
      message = "";
    }
    if (count < expectedCount) {
      this.throwError("missing argument" + message, Logger.errors.MISSING_ARGUMENT, {
        count: count,
        expectedCount: expectedCount
      });
    }
    if (count > expectedCount) {
      this.throwError("too many arguments" + message, Logger.errors.UNEXPECTED_ARGUMENT, {
        count: count,
        expectedCount: expectedCount
      });
    }
  }
  checkNew(target, kind) {
    if (target === Object || target == null) {
      this.throwError("missing new", Logger.errors.MISSING_NEW, {
        name: kind.name
      });
    }
  }
  checkAbstract(target, kind) {
    if (target === kind) {
      this.throwError("cannot instantiate abstract class " + JSON.stringify(kind.name) + " directly; use a sub-class", Logger.errors.UNSUPPORTED_OPERATION, {
        name: target.name,
        operation: "new"
      });
    } else if (target === Object || target == null) {
      this.throwError("missing new", Logger.errors.MISSING_NEW, {
        name: kind.name
      });
    }
  }
  static globalLogger() {
    if (!_globalLogger) {
      _globalLogger = new Logger(_version.version);
    }
    return _globalLogger;
  }
  static setCensorship(censorship, permanent) {
    if (!censorship && permanent) {
      this.globalLogger().throwError("cannot permanently disable censorship", Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "setCensorship"
      });
    }
    if (_permanentCensorErrors) {
      if (!censorship) {
        return;
      }
      this.globalLogger().throwError("error censorship permanent", Logger.errors.UNSUPPORTED_OPERATION, {
        operation: "setCensorship"
      });
    }
    _censorErrors = !!censorship;
    _permanentCensorErrors = !!permanent;
  }
  static setLogLevel(logLevel) {
    const level = LogLevels[logLevel.toLowerCase()];
    if (level == null) {
      Logger.globalLogger().warn("invalid log level - " + logLevel);
      return;
    }
    _logLevel = level;
  }
  static from(version) {
    return new Logger(version);
  }
}
exports.Logger = Logger;
Logger.errors = ErrorCode;
Logger.levels = LogLevel;

},{"./_version":43}],45:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.version = void 0;
const version = exports.version = "properties/5.7.0";

},{}],46:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Description = void 0;
exports.checkProperties = checkProperties;
exports.deepCopy = deepCopy;
exports.defineReadOnly = defineReadOnly;
exports.getStatic = getStatic;
exports.resolveProperties = resolveProperties;
exports.shallowCopy = shallowCopy;
var _logger = require("@ethersproject/logger");
var _version = require("./_version");
var __awaiter = void 0 && (void 0).__awaiter || function (thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function (resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function (resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
const logger = new _logger.Logger(_version.version);
function defineReadOnly(object, name, value) {
  Object.defineProperty(object, name, {
    enumerable: true,
    value: value,
    writable: false
  });
}
// Crawl up the constructor chain to find a static method
function getStatic(ctor, key) {
  for (let i = 0; i < 32; i++) {
    if (ctor[key]) {
      return ctor[key];
    }
    if (!ctor.prototype || typeof ctor.prototype !== "object") {
      break;
    }
    ctor = Object.getPrototypeOf(ctor.prototype).constructor;
  }
  return null;
}
function resolveProperties(object) {
  return __awaiter(this, void 0, void 0, function* () {
    const promises = Object.keys(object).map(key => {
      const value = object[key];
      return Promise.resolve(value).then(v => ({
        key: key,
        value: v
      }));
    });
    const results = yield Promise.all(promises);
    return results.reduce((accum, result) => {
      accum[result.key] = result.value;
      return accum;
    }, {});
  });
}
function checkProperties(object, properties) {
  if (!object || typeof object !== "object") {
    logger.throwArgumentError("invalid object", "object", object);
  }
  Object.keys(object).forEach(key => {
    if (!properties[key]) {
      logger.throwArgumentError("invalid object key - " + key, "transaction:" + key, object);
    }
  });
}
function shallowCopy(object) {
  const result = {};
  for (const key in object) {
    result[key] = object[key];
  }
  return result;
}
const opaque = {
  bigint: true,
  boolean: true,
  "function": true,
  number: true,
  string: true
};
function _isFrozen(object) {
  // Opaque objects are not mutable, so safe to copy by assignment
  if (object === undefined || object === null || opaque[typeof object]) {
    return true;
  }
  if (Array.isArray(object) || typeof object === "object") {
    if (!Object.isFrozen(object)) {
      return false;
    }
    const keys = Object.keys(object);
    for (let i = 0; i < keys.length; i++) {
      let value = null;
      try {
        value = object[keys[i]];
      } catch (error) {
        // If accessing a value triggers an error, it is a getter
        // designed to do so (e.g. Result) and is therefore "frozen"
        continue;
      }
      if (!_isFrozen(value)) {
        return false;
      }
    }
    return true;
  }
  return logger.throwArgumentError(`Cannot deepCopy ${typeof object}`, "object", object);
}
// Returns a new copy of object, such that no properties may be replaced.
// New properties may be added only to objects.
function _deepCopy(object) {
  if (_isFrozen(object)) {
    return object;
  }
  // Arrays are mutable, so we need to create a copy
  if (Array.isArray(object)) {
    return Object.freeze(object.map(item => deepCopy(item)));
  }
  if (typeof object === "object") {
    const result = {};
    for (const key in object) {
      const value = object[key];
      if (value === undefined) {
        continue;
      }
      defineReadOnly(result, key, deepCopy(value));
    }
    return result;
  }
  return logger.throwArgumentError(`Cannot deepCopy ${typeof object}`, "object", object);
}
function deepCopy(object) {
  return _deepCopy(object);
}
class Description {
  constructor(info) {
    for (const key in info) {
      this[key] = deepCopy(info[key]);
    }
  }
}
exports.Description = Description;

},{"./_version":45,"@ethersproject/logger":44}],47:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.version = void 0;
const version = exports.version = "rlp/5.7.0";

},{}],48:[function(require,module,exports){
"use strict";

//See: https://github.com/ethereum/wiki/wiki/RLP
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.decode = decode;
exports.encode = encode;
var _bytes = require("@ethersproject/bytes");
var _logger = require("@ethersproject/logger");
var _version = require("./_version");
const logger = new _logger.Logger(_version.version);
function arrayifyInteger(value) {
  const result = [];
  while (value) {
    result.unshift(value & 0xff);
    value >>= 8;
  }
  return result;
}
function unarrayifyInteger(data, offset, length) {
  let result = 0;
  for (let i = 0; i < length; i++) {
    result = result * 256 + data[offset + i];
  }
  return result;
}
function _encode(object) {
  if (Array.isArray(object)) {
    let payload = [];
    object.forEach(function (child) {
      payload = payload.concat(_encode(child));
    });
    if (payload.length <= 55) {
      payload.unshift(0xc0 + payload.length);
      return payload;
    }
    const length = arrayifyInteger(payload.length);
    length.unshift(0xf7 + length.length);
    return length.concat(payload);
  }
  if (!(0, _bytes.isBytesLike)(object)) {
    logger.throwArgumentError("RLP object must be BytesLike", "object", object);
  }
  const data = Array.prototype.slice.call((0, _bytes.arrayify)(object));
  if (data.length === 1 && data[0] <= 0x7f) {
    return data;
  } else if (data.length <= 55) {
    data.unshift(0x80 + data.length);
    return data;
  }
  const length = arrayifyInteger(data.length);
  length.unshift(0xb7 + length.length);
  return length.concat(data);
}
function encode(object) {
  return (0, _bytes.hexlify)(_encode(object));
}
function _decodeChildren(data, offset, childOffset, length) {
  const result = [];
  while (childOffset < offset + 1 + length) {
    const decoded = _decode(data, childOffset);
    result.push(decoded.result);
    childOffset += decoded.consumed;
    if (childOffset > offset + 1 + length) {
      logger.throwError("child data too short", _logger.Logger.errors.BUFFER_OVERRUN, {});
    }
  }
  return {
    consumed: 1 + length,
    result: result
  };
}
// returns { consumed: number, result: Object }
function _decode(data, offset) {
  if (data.length === 0) {
    logger.throwError("data too short", _logger.Logger.errors.BUFFER_OVERRUN, {});
  }
  // Array with extra length prefix
  if (data[offset] >= 0xf8) {
    const lengthLength = data[offset] - 0xf7;
    if (offset + 1 + lengthLength > data.length) {
      logger.throwError("data short segment too short", _logger.Logger.errors.BUFFER_OVERRUN, {});
    }
    const length = unarrayifyInteger(data, offset + 1, lengthLength);
    if (offset + 1 + lengthLength + length > data.length) {
      logger.throwError("data long segment too short", _logger.Logger.errors.BUFFER_OVERRUN, {});
    }
    return _decodeChildren(data, offset, offset + 1 + lengthLength, lengthLength + length);
  } else if (data[offset] >= 0xc0) {
    const length = data[offset] - 0xc0;
    if (offset + 1 + length > data.length) {
      logger.throwError("data array too short", _logger.Logger.errors.BUFFER_OVERRUN, {});
    }
    return _decodeChildren(data, offset, offset + 1, length);
  } else if (data[offset] >= 0xb8) {
    const lengthLength = data[offset] - 0xb7;
    if (offset + 1 + lengthLength > data.length) {
      logger.throwError("data array too short", _logger.Logger.errors.BUFFER_OVERRUN, {});
    }
    const length = unarrayifyInteger(data, offset + 1, lengthLength);
    if (offset + 1 + lengthLength + length > data.length) {
      logger.throwError("data array too short", _logger.Logger.errors.BUFFER_OVERRUN, {});
    }
    const result = (0, _bytes.hexlify)(data.slice(offset + 1 + lengthLength, offset + 1 + lengthLength + length));
    return {
      consumed: 1 + lengthLength + length,
      result: result
    };
  } else if (data[offset] >= 0x80) {
    const length = data[offset] - 0x80;
    if (offset + 1 + length > data.length) {
      logger.throwError("data too short", _logger.Logger.errors.BUFFER_OVERRUN, {});
    }
    const result = (0, _bytes.hexlify)(data.slice(offset + 1, offset + 1 + length));
    return {
      consumed: 1 + length,
      result: result
    };
  }
  return {
    consumed: 1,
    result: (0, _bytes.hexlify)(data[offset])
  };
}
function decode(data) {
  const bytes = (0, _bytes.arrayify)(data);
  const decoded = _decode(bytes, 0);
  if (decoded.consumed !== bytes.length) {
    logger.throwArgumentError("invalid rlp data", "data", data);
  }
  return decoded.result;
}

},{"./_version":47,"@ethersproject/bytes":27,"@ethersproject/logger":44}],49:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.version = void 0;
const version = exports.version = "strings/5.7.0";

},{}],50:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.formatBytes32String = formatBytes32String;
exports.parseBytes32String = parseBytes32String;
var _constants = require("@ethersproject/constants");
var _bytes = require("@ethersproject/bytes");
var _utf = require("./utf8");
function formatBytes32String(text) {
  // Get the bytes
  const bytes = (0, _utf.toUtf8Bytes)(text);
  // Check we have room for null-termination
  if (bytes.length > 31) {
    throw new Error("bytes32 string must be less than 32 bytes");
  }
  // Zero-pad (implicitly null-terminates)
  return (0, _bytes.hexlify)((0, _bytes.concat)([bytes, _constants.HashZero]).slice(0, 32));
}
function parseBytes32String(bytes) {
  const data = (0, _bytes.arrayify)(bytes);
  // Must be 32 bytes with a null-termination
  if (data.length !== 32) {
    throw new Error("invalid bytes32 - not 32 bytes long");
  }
  if (data[31] !== 0) {
    throw new Error("invalid bytes32 string - no null terminator");
  }
  // Find the null termination
  let length = 31;
  while (data[length - 1] === 0) {
    length--;
  }
  // Determine the string value
  return (0, _utf.toUtf8String)(data.slice(0, length));
}

},{"./utf8":53,"@ethersproject/bytes":27,"@ethersproject/constants":31}],51:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports._nameprepTableA1 = _nameprepTableA1;
exports._nameprepTableB2 = _nameprepTableB2;
exports._nameprepTableC = _nameprepTableC;
exports.nameprep = nameprep;
var _utf = require("./utf8");
function bytes2(data) {
  if (data.length % 4 !== 0) {
    throw new Error("bad data");
  }
  let result = [];
  for (let i = 0; i < data.length; i += 4) {
    result.push(parseInt(data.substring(i, i + 4), 16));
  }
  return result;
}
function createTable(data, func) {
  if (!func) {
    func = function (value) {
      return [parseInt(value, 16)];
    };
  }
  let lo = 0;
  let result = {};
  data.split(",").forEach(pair => {
    let comps = pair.split(":");
    lo += parseInt(comps[0], 16);
    result[lo] = func(comps[1]);
  });
  return result;
}
function createRangeTable(data) {
  let hi = 0;
  return data.split(",").map(v => {
    let comps = v.split("-");
    if (comps.length === 1) {
      comps[1] = "0";
    } else if (comps[1] === "") {
      comps[1] = "1";
    }
    let lo = hi + parseInt(comps[0], 16);
    hi = parseInt(comps[1], 16);
    return {
      l: lo,
      h: hi
    };
  });
}
function matchMap(value, ranges) {
  let lo = 0;
  for (let i = 0; i < ranges.length; i++) {
    let range = ranges[i];
    lo += range.l;
    if (value >= lo && value <= lo + range.h && (value - lo) % (range.d || 1) === 0) {
      if (range.e && range.e.indexOf(value - lo) !== -1) {
        continue;
      }
      return range;
    }
  }
  return null;
}
const Table_A_1_ranges = createRangeTable("221,13-1b,5f-,40-10,51-f,11-3,3-3,2-2,2-4,8,2,15,2d,28-8,88,48,27-,3-5,11-20,27-,8,28,3-5,12,18,b-a,1c-4,6-16,2-d,2-2,2,1b-4,17-9,8f-,10,f,1f-2,1c-34,33-14e,4,36-,13-,6-2,1a-f,4,9-,3-,17,8,2-2,5-,2,8-,3-,4-8,2-3,3,6-,16-6,2-,7-3,3-,17,8,3,3,3-,2,6-3,3-,4-a,5,2-6,10-b,4,8,2,4,17,8,3,6-,b,4,4-,2-e,2-4,b-10,4,9-,3-,17,8,3-,5-,9-2,3-,4-7,3-3,3,4-3,c-10,3,7-2,4,5-2,3,2,3-2,3-2,4-2,9,4-3,6-2,4,5-8,2-e,d-d,4,9,4,18,b,6-3,8,4,5-6,3-8,3-3,b-11,3,9,4,18,b,6-3,8,4,5-6,3-6,2,3-3,b-11,3,9,4,18,11-3,7-,4,5-8,2-7,3-3,b-11,3,13-2,19,a,2-,8-2,2-3,7,2,9-11,4-b,3b-3,1e-24,3,2-,3,2-,2-5,5,8,4,2,2-,3,e,4-,6,2,7-,b-,3-21,49,23-5,1c-3,9,25,10-,2-2f,23,6,3,8-2,5-5,1b-45,27-9,2a-,2-3,5b-4,45-4,53-5,8,40,2,5-,8,2,5-,28,2,5-,20,2,5-,8,2,5-,8,8,18,20,2,5-,8,28,14-5,1d-22,56-b,277-8,1e-2,52-e,e,8-a,18-8,15-b,e,4,3-b,5e-2,b-15,10,b-5,59-7,2b-555,9d-3,5b-5,17-,7-,27-,7-,9,2,2,2,20-,36,10,f-,7,14-,4,a,54-3,2-6,6-5,9-,1c-10,13-1d,1c-14,3c-,10-6,32-b,240-30,28-18,c-14,a0,115-,3,66-,b-76,5,5-,1d,24,2,5-2,2,8-,35-2,19,f-10,1d-3,311-37f,1b,5a-b,d7-19,d-3,41,57-,68-4,29-3,5f,29-37,2e-2,25-c,2c-2,4e-3,30,78-3,64-,20,19b7-49,51a7-59,48e-2,38-738,2ba5-5b,222f-,3c-94,8-b,6-4,1b,6,2,3,3,6d-20,16e-f,41-,37-7,2e-2,11-f,5-b,18-,b,14,5-3,6,88-,2,bf-2,7-,7-,7-,4-2,8,8-9,8-2ff,20,5-b,1c-b4,27-,27-cbb1,f7-9,28-2,b5-221,56,48,3-,2-,3-,5,d,2,5,3,42,5-,9,8,1d,5,6,2-2,8,153-3,123-3,33-27fd,a6da-5128,21f-5df,3-fffd,3-fffd,3-fffd,3-fffd,3-fffd,3-fffd,3-fffd,3-fffd,3-fffd,3-fffd,3-fffd,3,2-1d,61-ff7d");
// @TODO: Make this relative...
const Table_B_1_flags = "ad,34f,1806,180b,180c,180d,200b,200c,200d,2060,feff".split(",").map(v => parseInt(v, 16));
const Table_B_2_ranges = [{
  h: 25,
  s: 32,
  l: 65
}, {
  h: 30,
  s: 32,
  e: [23],
  l: 127
}, {
  h: 54,
  s: 1,
  e: [48],
  l: 64,
  d: 2
}, {
  h: 14,
  s: 1,
  l: 57,
  d: 2
}, {
  h: 44,
  s: 1,
  l: 17,
  d: 2
}, {
  h: 10,
  s: 1,
  e: [2, 6, 8],
  l: 61,
  d: 2
}, {
  h: 16,
  s: 1,
  l: 68,
  d: 2
}, {
  h: 84,
  s: 1,
  e: [18, 24, 66],
  l: 19,
  d: 2
}, {
  h: 26,
  s: 32,
  e: [17],
  l: 435
}, {
  h: 22,
  s: 1,
  l: 71,
  d: 2
}, {
  h: 15,
  s: 80,
  l: 40
}, {
  h: 31,
  s: 32,
  l: 16
}, {
  h: 32,
  s: 1,
  l: 80,
  d: 2
}, {
  h: 52,
  s: 1,
  l: 42,
  d: 2
}, {
  h: 12,
  s: 1,
  l: 55,
  d: 2
}, {
  h: 40,
  s: 1,
  e: [38],
  l: 15,
  d: 2
}, {
  h: 14,
  s: 1,
  l: 48,
  d: 2
}, {
  h: 37,
  s: 48,
  l: 49
}, {
  h: 148,
  s: 1,
  l: 6351,
  d: 2
}, {
  h: 88,
  s: 1,
  l: 160,
  d: 2
}, {
  h: 15,
  s: 16,
  l: 704
}, {
  h: 25,
  s: 26,
  l: 854
}, {
  h: 25,
  s: 32,
  l: 55915
}, {
  h: 37,
  s: 40,
  l: 1247
}, {
  h: 25,
  s: -119711,
  l: 53248
}, {
  h: 25,
  s: -119763,
  l: 52
}, {
  h: 25,
  s: -119815,
  l: 52
}, {
  h: 25,
  s: -119867,
  e: [1, 4, 5, 7, 8, 11, 12, 17],
  l: 52
}, {
  h: 25,
  s: -119919,
  l: 52
}, {
  h: 24,
  s: -119971,
  e: [2, 7, 8, 17],
  l: 52
}, {
  h: 24,
  s: -120023,
  e: [2, 7, 13, 15, 16, 17],
  l: 52
}, {
  h: 25,
  s: -120075,
  l: 52
}, {
  h: 25,
  s: -120127,
  l: 52
}, {
  h: 25,
  s: -120179,
  l: 52
}, {
  h: 25,
  s: -120231,
  l: 52
}, {
  h: 25,
  s: -120283,
  l: 52
}, {
  h: 25,
  s: -120335,
  l: 52
}, {
  h: 24,
  s: -119543,
  e: [17],
  l: 56
}, {
  h: 24,
  s: -119601,
  e: [17],
  l: 58
}, {
  h: 24,
  s: -119659,
  e: [17],
  l: 58
}, {
  h: 24,
  s: -119717,
  e: [17],
  l: 58
}, {
  h: 24,
  s: -119775,
  e: [17],
  l: 58
}];
const Table_B_2_lut_abs = createTable("b5:3bc,c3:ff,7:73,2:253,5:254,3:256,1:257,5:259,1:25b,3:260,1:263,2:269,1:268,5:26f,1:272,2:275,7:280,3:283,5:288,3:28a,1:28b,5:292,3f:195,1:1bf,29:19e,125:3b9,8b:3b2,1:3b8,1:3c5,3:3c6,1:3c0,1a:3ba,1:3c1,1:3c3,2:3b8,1:3b5,1bc9:3b9,1c:1f76,1:1f77,f:1f7a,1:1f7b,d:1f78,1:1f79,1:1f7c,1:1f7d,107:63,5:25b,4:68,1:68,1:68,3:69,1:69,1:6c,3:6e,4:70,1:71,1:72,1:72,1:72,7:7a,2:3c9,2:7a,2:6b,1:e5,1:62,1:63,3:65,1:66,2:6d,b:3b3,1:3c0,6:64,1b574:3b8,1a:3c3,20:3b8,1a:3c3,20:3b8,1a:3c3,20:3b8,1a:3c3,20:3b8,1a:3c3");
const Table_B_2_lut_rel = createTable("179:1,2:1,2:1,5:1,2:1,a:4f,a:1,8:1,2:1,2:1,3:1,5:1,3:1,4:1,2:1,3:1,4:1,8:2,1:1,2:2,1:1,2:2,27:2,195:26,2:25,1:25,1:25,2:40,2:3f,1:3f,33:1,11:-6,1:-9,1ac7:-3a,6d:-8,1:-8,1:-8,1:-8,1:-8,1:-8,1:-8,1:-8,9:-8,1:-8,1:-8,1:-8,1:-8,1:-8,b:-8,1:-8,1:-8,1:-8,1:-8,1:-8,1:-8,1:-8,9:-8,1:-8,1:-8,1:-8,1:-8,1:-8,1:-8,1:-8,9:-8,1:-8,1:-8,1:-8,1:-8,1:-8,c:-8,2:-8,2:-8,2:-8,9:-8,1:-8,1:-8,1:-8,1:-8,1:-8,1:-8,1:-8,49:-8,1:-8,1:-4a,1:-4a,d:-56,1:-56,1:-56,1:-56,d:-8,1:-8,f:-8,1:-8,3:-7");
const Table_B_2_complex = createTable("df:00730073,51:00690307,19:02BC006E,a7:006A030C,18a:002003B9,16:03B903080301,20:03C503080301,1d7:05650582,190f:00680331,1:00740308,1:0077030A,1:0079030A,1:006102BE,b6:03C50313,2:03C503130300,2:03C503130301,2:03C503130342,2a:1F0003B9,1:1F0103B9,1:1F0203B9,1:1F0303B9,1:1F0403B9,1:1F0503B9,1:1F0603B9,1:1F0703B9,1:1F0003B9,1:1F0103B9,1:1F0203B9,1:1F0303B9,1:1F0403B9,1:1F0503B9,1:1F0603B9,1:1F0703B9,1:1F2003B9,1:1F2103B9,1:1F2203B9,1:1F2303B9,1:1F2403B9,1:1F2503B9,1:1F2603B9,1:1F2703B9,1:1F2003B9,1:1F2103B9,1:1F2203B9,1:1F2303B9,1:1F2403B9,1:1F2503B9,1:1F2603B9,1:1F2703B9,1:1F6003B9,1:1F6103B9,1:1F6203B9,1:1F6303B9,1:1F6403B9,1:1F6503B9,1:1F6603B9,1:1F6703B9,1:1F6003B9,1:1F6103B9,1:1F6203B9,1:1F6303B9,1:1F6403B9,1:1F6503B9,1:1F6603B9,1:1F6703B9,3:1F7003B9,1:03B103B9,1:03AC03B9,2:03B10342,1:03B1034203B9,5:03B103B9,6:1F7403B9,1:03B703B9,1:03AE03B9,2:03B70342,1:03B7034203B9,5:03B703B9,6:03B903080300,1:03B903080301,3:03B90342,1:03B903080342,b:03C503080300,1:03C503080301,1:03C10313,2:03C50342,1:03C503080342,b:1F7C03B9,1:03C903B9,1:03CE03B9,2:03C90342,1:03C9034203B9,5:03C903B9,ac:00720073,5b:00B00063,6:00B00066,d:006E006F,a:0073006D,1:00740065006C,1:0074006D,124f:006800700061,2:00610075,2:006F0076,b:00700061,1:006E0061,1:03BC0061,1:006D0061,1:006B0061,1:006B0062,1:006D0062,1:00670062,3:00700066,1:006E0066,1:03BC0066,4:0068007A,1:006B0068007A,1:006D0068007A,1:00670068007A,1:00740068007A,15:00700061,1:006B00700061,1:006D00700061,1:006700700061,8:00700076,1:006E0076,1:03BC0076,1:006D0076,1:006B0076,1:006D0076,1:00700077,1:006E0077,1:03BC0077,1:006D0077,1:006B0077,1:006D0077,1:006B03C9,1:006D03C9,2:00620071,3:00632215006B0067,1:0063006F002E,1:00640062,1:00670079,2:00680070,2:006B006B,1:006B006D,9:00700068,2:00700070006D,1:00700072,2:00730076,1:00770062,c723:00660066,1:00660069,1:0066006C,1:006600660069,1:00660066006C,1:00730074,1:00730074,d:05740576,1:05740565,1:0574056B,1:057E0576,1:0574056D", bytes2);
const Table_C_ranges = createRangeTable("80-20,2a0-,39c,32,f71,18e,7f2-f,19-7,30-4,7-5,f81-b,5,a800-20ff,4d1-1f,110,fa-6,d174-7,2e84-,ffff-,ffff-,ffff-,ffff-,ffff-,ffff-,ffff-,ffff-,ffff-,ffff-,ffff-,ffff-,2,1f-5f,ff7f-20001");
function flatten(values) {
  return values.reduce((accum, value) => {
    value.forEach(value => {
      accum.push(value);
    });
    return accum;
  }, []);
}
function _nameprepTableA1(codepoint) {
  return !!matchMap(codepoint, Table_A_1_ranges);
}
function _nameprepTableB2(codepoint) {
  let range = matchMap(codepoint, Table_B_2_ranges);
  if (range) {
    return [codepoint + range.s];
  }
  let codes = Table_B_2_lut_abs[codepoint];
  if (codes) {
    return codes;
  }
  let shift = Table_B_2_lut_rel[codepoint];
  if (shift) {
    return [codepoint + shift[0]];
  }
  let complex = Table_B_2_complex[codepoint];
  if (complex) {
    return complex;
  }
  return null;
}
function _nameprepTableC(codepoint) {
  return !!matchMap(codepoint, Table_C_ranges);
}
function nameprep(value) {
  // This allows platforms with incomplete normalize to bypass
  // it for very basic names which the built-in toLowerCase
  // will certainly handle correctly
  if (value.match(/^[a-z0-9-]*$/i) && value.length <= 59) {
    return value.toLowerCase();
  }
  // Get the code points (keeping the current normalization)
  let codes = (0, _utf.toUtf8CodePoints)(value);
  codes = flatten(codes.map(code => {
    // Substitute Table B.1 (Maps to Nothing)
    if (Table_B_1_flags.indexOf(code) >= 0) {
      return [];
    }
    if (code >= 0xfe00 && code <= 0xfe0f) {
      return [];
    }
    // Substitute Table B.2 (Case Folding)
    let codesTableB2 = _nameprepTableB2(code);
    if (codesTableB2) {
      return codesTableB2;
    }
    // No Substitution
    return [code];
  }));
  // Normalize using form KC
  codes = (0, _utf.toUtf8CodePoints)((0, _utf._toUtf8String)(codes), _utf.UnicodeNormalizationForm.NFKC);
  // Prohibit Tables C.1.2, C.2.2, C.3, C.4, C.5, C.6, C.7, C.8, C.9
  codes.forEach(code => {
    if (_nameprepTableC(code)) {
      throw new Error("STRINGPREP_CONTAINS_PROHIBITED");
    }
  });
  // Prohibit Unassigned Code Points (Table A.1)
  codes.forEach(code => {
    if (_nameprepTableA1(code)) {
      throw new Error("STRINGPREP_CONTAINS_UNASSIGNED");
    }
  });
  // IDNA extras
  let name = (0, _utf._toUtf8String)(codes);
  // IDNA: 4.2.3.1
  if (name.substring(0, 1) === "-" || name.substring(2, 4) === "--" || name.substring(name.length - 1) === "-") {
    throw new Error("invalid hyphen");
  }
  return name;
}

},{"./utf8":53}],52:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "UnicodeNormalizationForm", {
  enumerable: true,
  get: function () {
    return _utf.UnicodeNormalizationForm;
  }
});
Object.defineProperty(exports, "Utf8ErrorFuncs", {
  enumerable: true,
  get: function () {
    return _utf.Utf8ErrorFuncs;
  }
});
Object.defineProperty(exports, "Utf8ErrorReason", {
  enumerable: true,
  get: function () {
    return _utf.Utf8ErrorReason;
  }
});
Object.defineProperty(exports, "_toEscapedUtf8String", {
  enumerable: true,
  get: function () {
    return _utf._toEscapedUtf8String;
  }
});
Object.defineProperty(exports, "formatBytes32String", {
  enumerable: true,
  get: function () {
    return _bytes.formatBytes32String;
  }
});
Object.defineProperty(exports, "nameprep", {
  enumerable: true,
  get: function () {
    return _idna.nameprep;
  }
});
Object.defineProperty(exports, "parseBytes32String", {
  enumerable: true,
  get: function () {
    return _bytes.parseBytes32String;
  }
});
Object.defineProperty(exports, "toUtf8Bytes", {
  enumerable: true,
  get: function () {
    return _utf.toUtf8Bytes;
  }
});
Object.defineProperty(exports, "toUtf8CodePoints", {
  enumerable: true,
  get: function () {
    return _utf.toUtf8CodePoints;
  }
});
Object.defineProperty(exports, "toUtf8String", {
  enumerable: true,
  get: function () {
    return _utf.toUtf8String;
  }
});
var _bytes = require("./bytes32");
var _idna = require("./idna");
var _utf = require("./utf8");

},{"./bytes32":50,"./idna":51,"./utf8":53}],53:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Utf8ErrorReason = exports.Utf8ErrorFuncs = exports.UnicodeNormalizationForm = void 0;
exports._toEscapedUtf8String = _toEscapedUtf8String;
exports._toUtf8String = _toUtf8String;
exports.toUtf8Bytes = toUtf8Bytes;
exports.toUtf8CodePoints = toUtf8CodePoints;
exports.toUtf8String = toUtf8String;
var _bytes = require("@ethersproject/bytes");
var _logger = require("@ethersproject/logger");
var _version = require("./_version");
const logger = new _logger.Logger(_version.version);
///////////////////////////////
var UnicodeNormalizationForm;
(function (UnicodeNormalizationForm) {
  UnicodeNormalizationForm["current"] = "";
  UnicodeNormalizationForm["NFC"] = "NFC";
  UnicodeNormalizationForm["NFD"] = "NFD";
  UnicodeNormalizationForm["NFKC"] = "NFKC";
  UnicodeNormalizationForm["NFKD"] = "NFKD";
})(UnicodeNormalizationForm || (exports.UnicodeNormalizationForm = UnicodeNormalizationForm = {}));
;
var Utf8ErrorReason;
(function (Utf8ErrorReason) {
  // A continuation byte was present where there was nothing to continue
  // - offset = the index the codepoint began in
  Utf8ErrorReason["UNEXPECTED_CONTINUE"] = "unexpected continuation byte";
  // An invalid (non-continuation) byte to start a UTF-8 codepoint was found
  // - offset = the index the codepoint began in
  Utf8ErrorReason["BAD_PREFIX"] = "bad codepoint prefix";
  // The string is too short to process the expected codepoint
  // - offset = the index the codepoint began in
  Utf8ErrorReason["OVERRUN"] = "string overrun";
  // A missing continuation byte was expected but not found
  // - offset = the index the continuation byte was expected at
  Utf8ErrorReason["MISSING_CONTINUE"] = "missing continuation byte";
  // The computed code point is outside the range for UTF-8
  // - offset       = start of this codepoint
  // - badCodepoint = the computed codepoint; outside the UTF-8 range
  Utf8ErrorReason["OUT_OF_RANGE"] = "out of UTF-8 range";
  // UTF-8 strings may not contain UTF-16 surrogate pairs
  // - offset       = start of this codepoint
  // - badCodepoint = the computed codepoint; inside the UTF-16 surrogate range
  Utf8ErrorReason["UTF16_SURROGATE"] = "UTF-16 surrogate";
  // The string is an overlong representation
  // - offset       = start of this codepoint
  // - badCodepoint = the computed codepoint; already bounds checked
  Utf8ErrorReason["OVERLONG"] = "overlong representation";
})(Utf8ErrorReason || (exports.Utf8ErrorReason = Utf8ErrorReason = {}));
;
function errorFunc(reason, offset, bytes, output, badCodepoint) {
  return logger.throwArgumentError(`invalid codepoint at offset ${offset}; ${reason}`, "bytes", bytes);
}
function ignoreFunc(reason, offset, bytes, output, badCodepoint) {
  // If there is an invalid prefix (including stray continuation), skip any additional continuation bytes
  if (reason === Utf8ErrorReason.BAD_PREFIX || reason === Utf8ErrorReason.UNEXPECTED_CONTINUE) {
    let i = 0;
    for (let o = offset + 1; o < bytes.length; o++) {
      if (bytes[o] >> 6 !== 0x02) {
        break;
      }
      i++;
    }
    return i;
  }
  // This byte runs us past the end of the string, so just jump to the end
  // (but the first byte was read already read and therefore skipped)
  if (reason === Utf8ErrorReason.OVERRUN) {
    return bytes.length - offset - 1;
  }
  // Nothing to skip
  return 0;
}
function replaceFunc(reason, offset, bytes, output, badCodepoint) {
  // Overlong representations are otherwise "valid" code points; just non-deistingtished
  if (reason === Utf8ErrorReason.OVERLONG) {
    output.push(badCodepoint);
    return 0;
  }
  // Put the replacement character into the output
  output.push(0xfffd);
  // Otherwise, process as if ignoring errors
  return ignoreFunc(reason, offset, bytes, output, badCodepoint);
}
// Common error handing strategies
const Utf8ErrorFuncs = exports.Utf8ErrorFuncs = Object.freeze({
  error: errorFunc,
  ignore: ignoreFunc,
  replace: replaceFunc
});
// http://stackoverflow.com/questions/13356493/decode-utf-8-with-javascript#13691499
function getUtf8CodePoints(bytes, onError) {
  if (onError == null) {
    onError = Utf8ErrorFuncs.error;
  }
  bytes = (0, _bytes.arrayify)(bytes);
  const result = [];
  let i = 0;
  // Invalid bytes are ignored
  while (i < bytes.length) {
    const c = bytes[i++];
    // 0xxx xxxx
    if (c >> 7 === 0) {
      result.push(c);
      continue;
    }
    // Multibyte; how many bytes left for this character?
    let extraLength = null;
    let overlongMask = null;
    // 110x xxxx 10xx xxxx
    if ((c & 0xe0) === 0xc0) {
      extraLength = 1;
      overlongMask = 0x7f;
      // 1110 xxxx 10xx xxxx 10xx xxxx
    } else if ((c & 0xf0) === 0xe0) {
      extraLength = 2;
      overlongMask = 0x7ff;
      // 1111 0xxx 10xx xxxx 10xx xxxx 10xx xxxx
    } else if ((c & 0xf8) === 0xf0) {
      extraLength = 3;
      overlongMask = 0xffff;
    } else {
      if ((c & 0xc0) === 0x80) {
        i += onError(Utf8ErrorReason.UNEXPECTED_CONTINUE, i - 1, bytes, result);
      } else {
        i += onError(Utf8ErrorReason.BAD_PREFIX, i - 1, bytes, result);
      }
      continue;
    }
    // Do we have enough bytes in our data?
    if (i - 1 + extraLength >= bytes.length) {
      i += onError(Utf8ErrorReason.OVERRUN, i - 1, bytes, result);
      continue;
    }
    // Remove the length prefix from the char
    let res = c & (1 << 8 - extraLength - 1) - 1;
    for (let j = 0; j < extraLength; j++) {
      let nextChar = bytes[i];
      // Invalid continuation byte
      if ((nextChar & 0xc0) != 0x80) {
        i += onError(Utf8ErrorReason.MISSING_CONTINUE, i, bytes, result);
        res = null;
        break;
      }
      ;
      res = res << 6 | nextChar & 0x3f;
      i++;
    }
    // See above loop for invalid continuation byte
    if (res === null) {
      continue;
    }
    // Maximum code point
    if (res > 0x10ffff) {
      i += onError(Utf8ErrorReason.OUT_OF_RANGE, i - 1 - extraLength, bytes, result, res);
      continue;
    }
    // Reserved for UTF-16 surrogate halves
    if (res >= 0xd800 && res <= 0xdfff) {
      i += onError(Utf8ErrorReason.UTF16_SURROGATE, i - 1 - extraLength, bytes, result, res);
      continue;
    }
    // Check for overlong sequences (more bytes than needed)
    if (res <= overlongMask) {
      i += onError(Utf8ErrorReason.OVERLONG, i - 1 - extraLength, bytes, result, res);
      continue;
    }
    result.push(res);
  }
  return result;
}
// http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
function toUtf8Bytes(str, form = UnicodeNormalizationForm.current) {
  if (form != UnicodeNormalizationForm.current) {
    logger.checkNormalize();
    str = str.normalize(form);
  }
  let result = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c < 0x80) {
      result.push(c);
    } else if (c < 0x800) {
      result.push(c >> 6 | 0xc0);
      result.push(c & 0x3f | 0x80);
    } else if ((c & 0xfc00) == 0xd800) {
      i++;
      const c2 = str.charCodeAt(i);
      if (i >= str.length || (c2 & 0xfc00) !== 0xdc00) {
        throw new Error("invalid utf-8 string");
      }
      // Surrogate Pair
      const pair = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);
      result.push(pair >> 18 | 0xf0);
      result.push(pair >> 12 & 0x3f | 0x80);
      result.push(pair >> 6 & 0x3f | 0x80);
      result.push(pair & 0x3f | 0x80);
    } else {
      result.push(c >> 12 | 0xe0);
      result.push(c >> 6 & 0x3f | 0x80);
      result.push(c & 0x3f | 0x80);
    }
  }
  return (0, _bytes.arrayify)(result);
}
;
function escapeChar(value) {
  const hex = "0000" + value.toString(16);
  return "\\u" + hex.substring(hex.length - 4);
}
function _toEscapedUtf8String(bytes, onError) {
  return '"' + getUtf8CodePoints(bytes, onError).map(codePoint => {
    if (codePoint < 256) {
      switch (codePoint) {
        case 8:
          return "\\b";
        case 9:
          return "\\t";
        case 10:
          return "\\n";
        case 13:
          return "\\r";
        case 34:
          return "\\\"";
        case 92:
          return "\\\\";
      }
      if (codePoint >= 32 && codePoint < 127) {
        return String.fromCharCode(codePoint);
      }
    }
    if (codePoint <= 0xffff) {
      return escapeChar(codePoint);
    }
    codePoint -= 0x10000;
    return escapeChar((codePoint >> 10 & 0x3ff) + 0xd800) + escapeChar((codePoint & 0x3ff) + 0xdc00);
  }).join("") + '"';
}
function _toUtf8String(codePoints) {
  return codePoints.map(codePoint => {
    if (codePoint <= 0xffff) {
      return String.fromCharCode(codePoint);
    }
    codePoint -= 0x10000;
    return String.fromCharCode((codePoint >> 10 & 0x3ff) + 0xd800, (codePoint & 0x3ff) + 0xdc00);
  }).join("");
}
function toUtf8String(bytes, onError) {
  return _toUtf8String(getUtf8CodePoints(bytes, onError));
}
function toUtf8CodePoints(str, form = UnicodeNormalizationForm.current) {
  return getUtf8CodePoints(toUtf8Bytes(str, form));
}

},{"./_version":49,"@ethersproject/bytes":27,"@ethersproject/logger":44}],54:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.output = exports.exists = exports.hash = exports.bytes = exports.bool = exports.number = void 0;
function number(n) {
    if (!Number.isSafeInteger(n) || n < 0)
        throw new Error(`Wrong positive integer: ${n}`);
}
exports.number = number;
function bool(b) {
    if (typeof b !== 'boolean')
        throw new Error(`Expected boolean, not ${b}`);
}
exports.bool = bool;
function bytes(b, ...lengths) {
    if (!(b instanceof Uint8Array))
        throw new TypeError('Expected Uint8Array');
    if (lengths.length > 0 && !lengths.includes(b.length))
        throw new TypeError(`Expected Uint8Array of length ${lengths}, not of length=${b.length}`);
}
exports.bytes = bytes;
function hash(hash) {
    if (typeof hash !== 'function' || typeof hash.create !== 'function')
        throw new Error('Hash should be wrapped by utils.wrapConstructor');
    number(hash.outputLen);
    number(hash.blockLen);
}
exports.hash = hash;
function exists(instance, checkFinished = true) {
    if (instance.destroyed)
        throw new Error('Hash instance has been destroyed');
    if (checkFinished && instance.finished)
        throw new Error('Hash#digest() has already been called');
}
exports.exists = exists;
function output(out, instance) {
    bytes(out);
    const min = instance.outputLen;
    if (out.length < min) {
        throw new Error(`digestInto() expects output buffer of length at least ${min}`);
    }
}
exports.output = output;
const assert = {
    number,
    bool,
    bytes,
    hash,
    exists,
    output,
};
exports.default = assert;

},{}],55:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.add = exports.toBig = exports.split = exports.fromBig = void 0;
const U32_MASK64 = BigInt(2 ** 32 - 1);
const _32n = BigInt(32);
// We are not using BigUint64Array, because they are extremely slow as per 2022
function fromBig(n, le = false) {
  if (le) return {
    h: Number(n & U32_MASK64),
    l: Number(n >> _32n & U32_MASK64)
  };
  return {
    h: Number(n >> _32n & U32_MASK64) | 0,
    l: Number(n & U32_MASK64) | 0
  };
}
exports.fromBig = fromBig;
function split(lst, le = false) {
  let Ah = new Uint32Array(lst.length);
  let Al = new Uint32Array(lst.length);
  for (let i = 0; i < lst.length; i++) {
    const {
      h,
      l
    } = fromBig(lst[i], le);
    [Ah[i], Al[i]] = [h, l];
  }
  return [Ah, Al];
}
exports.split = split;
const toBig = (h, l) => BigInt(h >>> 0) << _32n | BigInt(l >>> 0);
exports.toBig = toBig;
// for Shift in [0, 32)
const shrSH = (h, l, s) => h >>> s;
const shrSL = (h, l, s) => h << 32 - s | l >>> s;
// Right rotate for Shift in [1, 32)
const rotrSH = (h, l, s) => h >>> s | l << 32 - s;
const rotrSL = (h, l, s) => h << 32 - s | l >>> s;
// Right rotate for Shift in (32, 64), NOTE: 32 is special case.
const rotrBH = (h, l, s) => h << 64 - s | l >>> s - 32;
const rotrBL = (h, l, s) => h >>> s - 32 | l << 64 - s;
// Right rotate for shift===32 (just swaps l&h)
const rotr32H = (h, l) => l;
const rotr32L = (h, l) => h;
// Left rotate for Shift in [1, 32)
const rotlSH = (h, l, s) => h << s | l >>> 32 - s;
const rotlSL = (h, l, s) => l << s | h >>> 32 - s;
// Left rotate for Shift in (32, 64), NOTE: 32 is special case.
const rotlBH = (h, l, s) => l << s - 32 | h >>> 64 - s;
const rotlBL = (h, l, s) => h << s - 32 | l >>> 64 - s;
// JS uses 32-bit signed integers for bitwise operations which means we cannot
// simple take carry out of low bit sum by shift, we need to use division.
// Removing "export" has 5% perf penalty -_-
function add(Ah, Al, Bh, Bl) {
  const l = (Al >>> 0) + (Bl >>> 0);
  return {
    h: Ah + Bh + (l / 2 ** 32 | 0) | 0,
    l: l | 0
  };
}
exports.add = add;
// Addition with more than 2 elements
const add3L = (Al, Bl, Cl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0);
const add3H = (low, Ah, Bh, Ch) => Ah + Bh + Ch + (low / 2 ** 32 | 0) | 0;
const add4L = (Al, Bl, Cl, Dl) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0);
const add4H = (low, Ah, Bh, Ch, Dh) => Ah + Bh + Ch + Dh + (low / 2 ** 32 | 0) | 0;
const add5L = (Al, Bl, Cl, Dl, El) => (Al >>> 0) + (Bl >>> 0) + (Cl >>> 0) + (Dl >>> 0) + (El >>> 0);
const add5H = (low, Ah, Bh, Ch, Dh, Eh) => Ah + Bh + Ch + Dh + Eh + (low / 2 ** 32 | 0) | 0;
// prettier-ignore
const u64 = {
  fromBig,
  split,
  toBig: exports.toBig,
  shrSH,
  shrSL,
  rotrSH,
  rotrSL,
  rotrBH,
  rotrBL,
  rotr32H,
  rotr32L,
  rotlSH,
  rotlSL,
  rotlBH,
  rotlBL,
  add,
  add3L,
  add3H,
  add4L,
  add4H,
  add5H,
  add5L
};
exports.default = u64;

},{}],56:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crypto = void 0;
exports.crypto = {
    node: undefined,
    web: typeof self === 'object' && 'crypto' in self ? self.crypto : undefined,
};

},{}],57:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shake256 = exports.shake128 = exports.keccak_512 = exports.keccak_384 = exports.keccak_256 = exports.keccak_224 = exports.sha3_512 = exports.sha3_384 = exports.sha3_256 = exports.sha3_224 = exports.Keccak = exports.keccakP = void 0;
const _assert_js_1 = require("./_assert.js");
const _u64_js_1 = require("./_u64.js");
const utils_js_1 = require("./utils.js");
// Various per round constants calculations
const [SHA3_PI, SHA3_ROTL, _SHA3_IOTA] = [[], [], []];
const _0n = BigInt(0);
const _1n = BigInt(1);
const _2n = BigInt(2);
const _7n = BigInt(7);
const _256n = BigInt(256);
const _0x71n = BigInt(0x71);
for (let round = 0, R = _1n, x = 1, y = 0; round < 24; round++) {
    // Pi
    [x, y] = [y, (2 * x + 3 * y) % 5];
    SHA3_PI.push(2 * (5 * y + x));
    // Rotational
    SHA3_ROTL.push((((round + 1) * (round + 2)) / 2) % 64);
    // Iota
    let t = _0n;
    for (let j = 0; j < 7; j++) {
        R = ((R << _1n) ^ ((R >> _7n) * _0x71n)) % _256n;
        if (R & _2n)
            t ^= _1n << ((_1n << BigInt(j)) - _1n);
    }
    _SHA3_IOTA.push(t);
}
const [SHA3_IOTA_H, SHA3_IOTA_L] = _u64_js_1.default.split(_SHA3_IOTA, true);
// Left rotation (without 0, 32, 64)
const rotlH = (h, l, s) => s > 32 ? _u64_js_1.default.rotlBH(h, l, s) : _u64_js_1.default.rotlSH(h, l, s);
const rotlL = (h, l, s) => s > 32 ? _u64_js_1.default.rotlBL(h, l, s) : _u64_js_1.default.rotlSL(h, l, s);
// Same as keccakf1600, but allows to skip some rounds
function keccakP(s, rounds = 24) {
    const B = new Uint32Array(5 * 2);
    // NOTE: all indices are x2 since we store state as u32 instead of u64 (bigints to slow in js)
    for (let round = 24 - rounds; round < 24; round++) {
        // Theta θ
        for (let x = 0; x < 10; x++)
            B[x] = s[x] ^ s[x + 10] ^ s[x + 20] ^ s[x + 30] ^ s[x + 40];
        for (let x = 0; x < 10; x += 2) {
            const idx1 = (x + 8) % 10;
            const idx0 = (x + 2) % 10;
            const B0 = B[idx0];
            const B1 = B[idx0 + 1];
            const Th = rotlH(B0, B1, 1) ^ B[idx1];
            const Tl = rotlL(B0, B1, 1) ^ B[idx1 + 1];
            for (let y = 0; y < 50; y += 10) {
                s[x + y] ^= Th;
                s[x + y + 1] ^= Tl;
            }
        }
        // Rho (ρ) and Pi (π)
        let curH = s[2];
        let curL = s[3];
        for (let t = 0; t < 24; t++) {
            const shift = SHA3_ROTL[t];
            const Th = rotlH(curH, curL, shift);
            const Tl = rotlL(curH, curL, shift);
            const PI = SHA3_PI[t];
            curH = s[PI];
            curL = s[PI + 1];
            s[PI] = Th;
            s[PI + 1] = Tl;
        }
        // Chi (χ)
        for (let y = 0; y < 50; y += 10) {
            for (let x = 0; x < 10; x++)
                B[x] = s[y + x];
            for (let x = 0; x < 10; x++)
                s[y + x] ^= ~B[(x + 2) % 10] & B[(x + 4) % 10];
        }
        // Iota (ι)
        s[0] ^= SHA3_IOTA_H[round];
        s[1] ^= SHA3_IOTA_L[round];
    }
    B.fill(0);
}
exports.keccakP = keccakP;
class Keccak extends utils_js_1.Hash {
    // NOTE: we accept arguments in bytes instead of bits here.
    constructor(blockLen, suffix, outputLen, enableXOF = false, rounds = 24) {
        super();
        this.blockLen = blockLen;
        this.suffix = suffix;
        this.outputLen = outputLen;
        this.enableXOF = enableXOF;
        this.rounds = rounds;
        this.pos = 0;
        this.posOut = 0;
        this.finished = false;
        this.destroyed = false;
        // Can be passed from user as dkLen
        _assert_js_1.default.number(outputLen);
        // 1600 = 5x5 matrix of 64bit.  1600 bits === 200 bytes
        if (0 >= this.blockLen || this.blockLen >= 200)
            throw new Error('Sha3 supports only keccak-f1600 function');
        this.state = new Uint8Array(200);
        this.state32 = (0, utils_js_1.u32)(this.state);
    }
    keccak() {
        keccakP(this.state32, this.rounds);
        this.posOut = 0;
        this.pos = 0;
    }
    update(data) {
        _assert_js_1.default.exists(this);
        const { blockLen, state } = this;
        data = (0, utils_js_1.toBytes)(data);
        const len = data.length;
        for (let pos = 0; pos < len;) {
            const take = Math.min(blockLen - this.pos, len - pos);
            for (let i = 0; i < take; i++)
                state[this.pos++] ^= data[pos++];
            if (this.pos === blockLen)
                this.keccak();
        }
        return this;
    }
    finish() {
        if (this.finished)
            return;
        this.finished = true;
        const { state, suffix, pos, blockLen } = this;
        // Do the padding
        state[pos] ^= suffix;
        if ((suffix & 0x80) !== 0 && pos === blockLen - 1)
            this.keccak();
        state[blockLen - 1] ^= 0x80;
        this.keccak();
    }
    writeInto(out) {
        _assert_js_1.default.exists(this, false);
        _assert_js_1.default.bytes(out);
        this.finish();
        const bufferOut = this.state;
        const { blockLen } = this;
        for (let pos = 0, len = out.length; pos < len;) {
            if (this.posOut >= blockLen)
                this.keccak();
            const take = Math.min(blockLen - this.posOut, len - pos);
            out.set(bufferOut.subarray(this.posOut, this.posOut + take), pos);
            this.posOut += take;
            pos += take;
        }
        return out;
    }
    xofInto(out) {
        // Sha3/Keccak usage with XOF is probably mistake, only SHAKE instances can do XOF
        if (!this.enableXOF)
            throw new Error('XOF is not possible for this instance');
        return this.writeInto(out);
    }
    xof(bytes) {
        _assert_js_1.default.number(bytes);
        return this.xofInto(new Uint8Array(bytes));
    }
    digestInto(out) {
        _assert_js_1.default.output(out, this);
        if (this.finished)
            throw new Error('digest() was already called');
        this.writeInto(out);
        this.destroy();
        return out;
    }
    digest() {
        return this.digestInto(new Uint8Array(this.outputLen));
    }
    destroy() {
        this.destroyed = true;
        this.state.fill(0);
    }
    _cloneInto(to) {
        const { blockLen, suffix, outputLen, rounds, enableXOF } = this;
        to || (to = new Keccak(blockLen, suffix, outputLen, enableXOF, rounds));
        to.state32.set(this.state32);
        to.pos = this.pos;
        to.posOut = this.posOut;
        to.finished = this.finished;
        to.rounds = rounds;
        // Suffix can change in cSHAKE
        to.suffix = suffix;
        to.outputLen = outputLen;
        to.enableXOF = enableXOF;
        to.destroyed = this.destroyed;
        return to;
    }
}
exports.Keccak = Keccak;
const gen = (suffix, blockLen, outputLen) => (0, utils_js_1.wrapConstructor)(() => new Keccak(blockLen, suffix, outputLen));
exports.sha3_224 = gen(0x06, 144, 224 / 8);
/**
 * SHA3-256 hash function
 * @param message - that would be hashed
 */
exports.sha3_256 = gen(0x06, 136, 256 / 8);
exports.sha3_384 = gen(0x06, 104, 384 / 8);
exports.sha3_512 = gen(0x06, 72, 512 / 8);
exports.keccak_224 = gen(0x01, 144, 224 / 8);
/**
 * keccak-256 hash function. Different from SHA3-256.
 * @param message - that would be hashed
 */
exports.keccak_256 = gen(0x01, 136, 256 / 8);
exports.keccak_384 = gen(0x01, 104, 384 / 8);
exports.keccak_512 = gen(0x01, 72, 512 / 8);
const genShake = (suffix, blockLen, outputLen) => (0, utils_js_1.wrapConstructorWithOpts)((opts = {}) => new Keccak(blockLen, suffix, opts.dkLen === undefined ? outputLen : opts.dkLen, true));
exports.shake128 = genShake(0x1f, 168, 128 / 8);
exports.shake256 = genShake(0x1f, 136, 256 / 8);

},{"./_assert.js":54,"./_u64.js":55,"./utils.js":58}],58:[function(require,module,exports){
"use strict";

/*! noble-hashes - MIT License (c) 2022 Paul Miller (paulmillr.com) */
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.randomBytes = exports.wrapConstructorWithOpts = exports.wrapConstructor = exports.checkOpts = exports.Hash = exports.concatBytes = exports.toBytes = exports.utf8ToBytes = exports.asyncLoop = exports.nextTick = exports.hexToBytes = exports.bytesToHex = exports.isLE = exports.rotr = exports.createView = exports.u32 = exports.u8 = void 0;
// The import here is via the package name. This is to ensure
// that exports mapping/resolution does fall into place.
const crypto_1 = require("@noble/hashes/crypto");
// Cast array to different type
const u8 = arr => new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
exports.u8 = u8;
const u32 = arr => new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(arr.byteLength / 4));
exports.u32 = u32;
// Cast array to view
const createView = arr => new DataView(arr.buffer, arr.byteOffset, arr.byteLength);
exports.createView = createView;
// The rotate right (circular right shift) operation for uint32
const rotr = (word, shift) => word << 32 - shift | word >>> shift;
exports.rotr = rotr;
exports.isLE = new Uint8Array(new Uint32Array([0x11223344]).buffer)[0] === 0x44;
// There is almost no big endian hardware, but js typed arrays uses platform specific endianness.
// So, just to be sure not to corrupt anything.
if (!exports.isLE) throw new Error('Non little-endian hardware is not supported');
const hexes = Array.from({
  length: 256
}, (v, i) => i.toString(16).padStart(2, '0'));
/**
 * @example bytesToHex(Uint8Array.from([0xde, 0xad, 0xbe, 0xef]))
 */
function bytesToHex(uint8a) {
  // pre-caching improves the speed 6x
  if (!(uint8a instanceof Uint8Array)) throw new Error('Uint8Array expected');
  let hex = '';
  for (let i = 0; i < uint8a.length; i++) {
    hex += hexes[uint8a[i]];
  }
  return hex;
}
exports.bytesToHex = bytesToHex;
/**
 * @example hexToBytes('deadbeef')
 */
function hexToBytes(hex) {
  if (typeof hex !== 'string') {
    throw new TypeError('hexToBytes: expected string, got ' + typeof hex);
  }
  if (hex.length % 2) throw new Error('hexToBytes: received invalid unpadded hex');
  const array = new Uint8Array(hex.length / 2);
  for (let i = 0; i < array.length; i++) {
    const j = i * 2;
    const hexByte = hex.slice(j, j + 2);
    const byte = Number.parseInt(hexByte, 16);
    if (Number.isNaN(byte) || byte < 0) throw new Error('Invalid byte sequence');
    array[i] = byte;
  }
  return array;
}
exports.hexToBytes = hexToBytes;
// There is no setImmediate in browser and setTimeout is slow. However, call to async function will return Promise
// which will be fullfiled only on next scheduler queue processing step and this is exactly what we need.
const nextTick = async () => {};
exports.nextTick = nextTick;
// Returns control to thread each 'tick' ms to avoid blocking
async function asyncLoop(iters, tick, cb) {
  let ts = Date.now();
  for (let i = 0; i < iters; i++) {
    cb(i);
    // Date.now() is not monotonic, so in case if clock goes backwards we return return control too
    const diff = Date.now() - ts;
    if (diff >= 0 && diff < tick) continue;
    await (0, exports.nextTick)();
    ts += diff;
  }
}
exports.asyncLoop = asyncLoop;
function utf8ToBytes(str) {
  if (typeof str !== 'string') {
    throw new TypeError(`utf8ToBytes expected string, got ${typeof str}`);
  }
  return new TextEncoder().encode(str);
}
exports.utf8ToBytes = utf8ToBytes;
function toBytes(data) {
  if (typeof data === 'string') data = utf8ToBytes(data);
  if (!(data instanceof Uint8Array)) throw new TypeError(`Expected input type is Uint8Array (got ${typeof data})`);
  return data;
}
exports.toBytes = toBytes;
/**
 * Concats Uint8Array-s into one; like `Buffer.concat([buf1, buf2])`
 * @example concatBytes(buf1, buf2)
 */
function concatBytes(...arrays) {
  if (!arrays.every(a => a instanceof Uint8Array)) throw new Error('Uint8Array list expected');
  if (arrays.length === 1) return arrays[0];
  const length = arrays.reduce((a, arr) => a + arr.length, 0);
  const result = new Uint8Array(length);
  for (let i = 0, pad = 0; i < arrays.length; i++) {
    const arr = arrays[i];
    result.set(arr, pad);
    pad += arr.length;
  }
  return result;
}
exports.concatBytes = concatBytes;
// For runtime check if class implements interface
class Hash {
  // Safe version that clones internal state
  clone() {
    return this._cloneInto();
  }
}
exports.Hash = Hash;
// Check if object doens't have custom constructor (like Uint8Array/Array)
const isPlainObject = obj => Object.prototype.toString.call(obj) === '[object Object]' && obj.constructor === Object;
function checkOpts(defaults, opts) {
  if (opts !== undefined && (typeof opts !== 'object' || !isPlainObject(opts))) throw new TypeError('Options should be object or undefined');
  const merged = Object.assign(defaults, opts);
  return merged;
}
exports.checkOpts = checkOpts;
function wrapConstructor(hashConstructor) {
  const hashC = message => hashConstructor().update(toBytes(message)).digest();
  const tmp = hashConstructor();
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = () => hashConstructor();
  return hashC;
}
exports.wrapConstructor = wrapConstructor;
function wrapConstructorWithOpts(hashCons) {
  const hashC = (msg, opts) => hashCons(opts).update(toBytes(msg)).digest();
  const tmp = hashCons({});
  hashC.outputLen = tmp.outputLen;
  hashC.blockLen = tmp.blockLen;
  hashC.create = opts => hashCons(opts);
  return hashC;
}
exports.wrapConstructorWithOpts = wrapConstructorWithOpts;
/**
 * Secure PRNG
 */
function randomBytes(bytesLength = 32) {
  if (crypto_1.crypto.web) {
    return crypto_1.crypto.web.getRandomValues(new Uint8Array(bytesLength));
  } else if (crypto_1.crypto.node) {
    return new Uint8Array(crypto_1.crypto.node.randomBytes(bytesLength).buffer);
  } else {
    throw new Error("The environment doesn't have randomBytes function");
  }
}
exports.randomBytes = randomBytes;

},{"@noble/hashes/crypto":56}],59:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hex = exports.compareBytes = void 0;
const utils_1 = require("ethereum-cryptography/utils");
function compareBytes(a, b) {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        if (a[i] !== b[i]) {
            return a[i] - b[i];
        }
    }
    return a.length - b.length;
}
exports.compareBytes = compareBytes;
function hex(b) {
    return '0x' + (0, utils_1.bytesToHex)(b);
}
exports.hex = hex;

},{"ethereum-cryptography/utils":70}],60:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderMerkleTree = exports.isValidMerkleTree = exports.processMultiProof = exports.getMultiProof = exports.processProof = exports.getProof = exports.makeMerkleTree = void 0;
const keccak_1 = require("ethereum-cryptography/keccak");
const utils_1 = require("ethereum-cryptography/utils");
const bytes_1 = require("./bytes");
const throw_error_1 = require("./utils/throw-error");
const hashPair = (a, b) => (0, keccak_1.keccak256)((0, utils_1.concatBytes)(...[a, b].sort(bytes_1.compareBytes)));
const leftChildIndex = (i) => 2 * i + 1;
const rightChildIndex = (i) => 2 * i + 2;
const parentIndex = (i) => i > 0 ? Math.floor((i - 1) / 2) : (0, throw_error_1.throwError)('Root has no parent');
const siblingIndex = (i) => i > 0 ? i - (-1) ** (i % 2) : (0, throw_error_1.throwError)('Root has no siblings');
const isTreeNode = (tree, i) => i >= 0 && i < tree.length;
const isInternalNode = (tree, i) => isTreeNode(tree, leftChildIndex(i));
const isLeafNode = (tree, i) => isTreeNode(tree, i) && !isInternalNode(tree, i);
const isValidMerkleNode = (node) => node instanceof Uint8Array && node.length === 32;
const checkTreeNode = (tree, i) => void (isTreeNode(tree, i) || (0, throw_error_1.throwError)('Index is not in tree'));
const checkInternalNode = (tree, i) => void (isInternalNode(tree, i) || (0, throw_error_1.throwError)('Index is not an internal tree node'));
const checkLeafNode = (tree, i) => void (isLeafNode(tree, i) || (0, throw_error_1.throwError)('Index is not a leaf'));
const checkValidMerkleNode = (node) => void (isValidMerkleNode(node) || (0, throw_error_1.throwError)('Merkle tree nodes must be Uint8Array of length 32'));
function makeMerkleTree(leaves) {
    leaves.forEach(checkValidMerkleNode);
    if (leaves.length === 0) {
        throw new Error('Expected non-zero number of leaves');
    }
    const tree = new Array(2 * leaves.length - 1);
    for (const [i, leaf] of leaves.entries()) {
        tree[tree.length - 1 - i] = leaf;
    }
    for (let i = tree.length - 1 - leaves.length; i >= 0; i--) {
        tree[i] = hashPair(tree[leftChildIndex(i)], tree[rightChildIndex(i)]);
    }
    return tree;
}
exports.makeMerkleTree = makeMerkleTree;
function getProof(tree, index) {
    checkLeafNode(tree, index);
    const proof = [];
    while (index > 0) {
        proof.push(tree[siblingIndex(index)]);
        index = parentIndex(index);
    }
    return proof;
}
exports.getProof = getProof;
function processProof(leaf, proof) {
    checkValidMerkleNode(leaf);
    proof.forEach(checkValidMerkleNode);
    return proof.reduce(hashPair, leaf);
}
exports.processProof = processProof;
function getMultiProof(tree, indices) {
    indices.forEach(i => checkLeafNode(tree, i));
    indices.sort((a, b) => b - a);
    if (indices.slice(1).some((i, p) => i === indices[p])) {
        throw new Error('Cannot prove duplicated index');
    }
    const stack = indices.concat(); // copy
    const proof = [];
    const proofFlags = [];
    while (stack.length > 0 && stack[0] > 0) {
        const j = stack.shift(); // take from the beginning
        const s = siblingIndex(j);
        const p = parentIndex(j);
        if (s === stack[0]) {
            proofFlags.push(true);
            stack.shift(); // consume from the stack
        }
        else {
            proofFlags.push(false);
            proof.push(tree[s]);
        }
        stack.push(p);
    }
    if (indices.length === 0) {
        proof.push(tree[0]);
    }
    return {
        leaves: indices.map(i => tree[i]),
        proof,
        proofFlags,
    };
}
exports.getMultiProof = getMultiProof;
function processMultiProof(multiproof) {
    multiproof.leaves.forEach(checkValidMerkleNode);
    multiproof.proof.forEach(checkValidMerkleNode);
    if (multiproof.proof.length < multiproof.proofFlags.filter(b => !b).length) {
        throw new Error('Invalid multiproof format');
    }
    if (multiproof.leaves.length + multiproof.proof.length !== multiproof.proofFlags.length + 1) {
        throw new Error('Provided leaves and multiproof are not compatible');
    }
    const stack = multiproof.leaves.concat(); // copy
    const proof = multiproof.proof.concat(); // copy
    for (const flag of multiproof.proofFlags) {
        const a = stack.shift();
        const b = flag ? stack.shift() : proof.shift();
        if (a === undefined || b === undefined) {
            throw new Error('Broken invariant');
        }
        stack.push(hashPair(a, b));
    }
    if (stack.length + proof.length !== 1) {
        throw new Error('Broken invariant');
    }
    return stack.pop() ?? proof.shift();
}
exports.processMultiProof = processMultiProof;
function isValidMerkleTree(tree) {
    for (const [i, node] of tree.entries()) {
        if (!isValidMerkleNode(node)) {
            return false;
        }
        const l = leftChildIndex(i);
        const r = rightChildIndex(i);
        if (r >= tree.length) {
            if (l < tree.length) {
                return false;
            }
        }
        else if (!(0, utils_1.equalsBytes)(node, hashPair(tree[l], tree[r]))) {
            return false;
        }
    }
    return tree.length > 0;
}
exports.isValidMerkleTree = isValidMerkleTree;
function renderMerkleTree(tree) {
    if (tree.length === 0) {
        throw new Error('Expected non-zero number of nodes');
    }
    const stack = [[0, []]];
    const lines = [];
    while (stack.length > 0) {
        const [i, path] = stack.pop();
        lines.push(path.slice(0, -1).map(p => ['   ', '│  '][p]).join('') +
            path.slice(-1).map(p => ['└─ ', '├─ '][p]).join('') +
            i + ') ' +
            (0, utils_1.bytesToHex)(tree[i]));
        if (rightChildIndex(i) < tree.length) {
            stack.push([rightChildIndex(i), path.concat(0)]);
            stack.push([leftChildIndex(i), path.concat(1)]);
        }
    }
    return lines.join('\n');
}
exports.renderMerkleTree = renderMerkleTree;

},{"./bytes":59,"./utils/throw-error":66,"ethereum-cryptography/keccak":69,"ethereum-cryptography/utils":70}],61:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardMerkleTree = void 0;
var standard_1 = require("./standard");
Object.defineProperty(exports, "StandardMerkleTree", { enumerable: true, get: function () { return standard_1.StandardMerkleTree; } });

},{"./standard":63}],62:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultOptions = void 0;
// Recommended (default) options.
// - leaves are sorted by default to facilitate onchain verification of multiproofs.
exports.defaultOptions = {
    sortLeaves: true,
};

},{}],63:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardMerkleTree = void 0;
const utils_1 = require("ethereum-cryptography/utils");
const bytes_1 = require("./bytes");
const core_1 = require("./core");
const options_1 = require("./options");
const check_bounds_1 = require("./utils/check-bounds");
const throw_error_1 = require("./utils/throw-error");
const standard_leaf_hash_1 = require("./utils/standard-leaf-hash");
class StandardMerkleTree {
    constructor(tree, values, leafEncoding) {
        this.tree = tree;
        this.values = values;
        this.leafEncoding = leafEncoding;
        this.hashLookup =
            Object.fromEntries(values.map(({ value }, valueIndex) => [
                (0, bytes_1.hex)((0, standard_leaf_hash_1.standardLeafHash)(value, leafEncoding)),
                valueIndex,
            ]));
    }
    static of(values, leafEncoding, options = {}) {
        const sortLeaves = options.sortLeaves ?? options_1.defaultOptions.sortLeaves;
        const hashedValues = values.map((value, valueIndex) => ({ value, valueIndex, hash: (0, standard_leaf_hash_1.standardLeafHash)(value, leafEncoding) }));
        if (sortLeaves) {
            hashedValues.sort((a, b) => (0, bytes_1.compareBytes)(a.hash, b.hash));
        }
        const tree = (0, core_1.makeMerkleTree)(hashedValues.map(v => v.hash));
        const indexedValues = values.map(value => ({ value, treeIndex: 0 }));
        for (const [leafIndex, { valueIndex }] of hashedValues.entries()) {
            indexedValues[valueIndex].treeIndex = tree.length - leafIndex - 1;
        }
        return new StandardMerkleTree(tree, indexedValues, leafEncoding);
    }
    static load(data) {
        if (data.format !== 'standard-v1') {
            throw new Error(`Unknown format '${data.format}'`);
        }
        return new StandardMerkleTree(data.tree.map(utils_1.hexToBytes), data.values, data.leafEncoding);
    }
    static verify(root, leafEncoding, leaf, proof) {
        const impliedRoot = (0, core_1.processProof)((0, standard_leaf_hash_1.standardLeafHash)(leaf, leafEncoding), proof.map(utils_1.hexToBytes));
        return (0, utils_1.equalsBytes)(impliedRoot, (0, utils_1.hexToBytes)(root));
    }
    static verifyMultiProof(root, leafEncoding, multiproof) {
        const leafHashes = multiproof.leaves.map(leaf => (0, standard_leaf_hash_1.standardLeafHash)(leaf, leafEncoding));
        const proofBytes = multiproof.proof.map(utils_1.hexToBytes);
        const impliedRoot = (0, core_1.processMultiProof)({
            leaves: leafHashes,
            proof: proofBytes,
            proofFlags: multiproof.proofFlags,
        });
        return (0, utils_1.equalsBytes)(impliedRoot, (0, utils_1.hexToBytes)(root));
    }
    dump() {
        return {
            format: 'standard-v1',
            tree: this.tree.map(bytes_1.hex),
            values: this.values,
            leafEncoding: this.leafEncoding,
        };
    }
    render() {
        return (0, core_1.renderMerkleTree)(this.tree);
    }
    get root() {
        return (0, bytes_1.hex)(this.tree[0]);
    }
    *entries() {
        for (const [i, { value }] of this.values.entries()) {
            yield [i, value];
        }
    }
    validate() {
        for (let i = 0; i < this.values.length; i++) {
            this.validateValue(i);
        }
        if (!(0, core_1.isValidMerkleTree)(this.tree)) {
            throw new Error('Merkle tree is invalid');
        }
    }
    leafHash(leaf) {
        return (0, bytes_1.hex)((0, standard_leaf_hash_1.standardLeafHash)(leaf, this.leafEncoding));
    }
    leafLookup(leaf) {
        return this.hashLookup[this.leafHash(leaf)] ?? (0, throw_error_1.throwError)('Leaf is not in tree');
    }
    getProof(leaf) {
        // input validity
        const valueIndex = typeof leaf === 'number' ? leaf : this.leafLookup(leaf);
        this.validateValue(valueIndex);
        // rebuild tree index and generate proof
        const { treeIndex } = this.values[valueIndex];
        const proof = (0, core_1.getProof)(this.tree, treeIndex);
        // sanity check proof
        if (!this._verify(this.tree[treeIndex], proof)) {
            throw new Error('Unable to prove value');
        }
        // return proof in hex format
        return proof.map(bytes_1.hex);
    }
    getMultiProof(leaves) {
        // input validity
        const valueIndices = leaves.map(leaf => typeof leaf === 'number' ? leaf : this.leafLookup(leaf));
        for (const valueIndex of valueIndices)
            this.validateValue(valueIndex);
        // rebuild tree indices and generate proof
        const indices = valueIndices.map(i => this.values[i].treeIndex);
        const proof = (0, core_1.getMultiProof)(this.tree, indices);
        // sanity check proof
        if (!this._verifyMultiProof(proof)) {
            throw new Error('Unable to prove values');
        }
        // return multiproof in hex format
        return {
            leaves: proof.leaves.map(hash => this.values[this.hashLookup[(0, bytes_1.hex)(hash)]].value),
            proof: proof.proof.map(bytes_1.hex),
            proofFlags: proof.proofFlags,
        };
    }
    verify(leaf, proof) {
        return this._verify(this.getLeafHash(leaf), proof.map(utils_1.hexToBytes));
    }
    _verify(leafHash, proof) {
        const impliedRoot = (0, core_1.processProof)(leafHash, proof);
        return (0, utils_1.equalsBytes)(impliedRoot, this.tree[0]);
    }
    verifyMultiProof(multiproof) {
        return this._verifyMultiProof({
            leaves: multiproof.leaves.map(l => this.getLeafHash(l)),
            proof: multiproof.proof.map(utils_1.hexToBytes),
            proofFlags: multiproof.proofFlags,
        });
    }
    _verifyMultiProof(multiproof) {
        const impliedRoot = (0, core_1.processMultiProof)(multiproof);
        return (0, utils_1.equalsBytes)(impliedRoot, this.tree[0]);
    }
    validateValue(valueIndex) {
        (0, check_bounds_1.checkBounds)(this.values, valueIndex);
        const { value, treeIndex } = this.values[valueIndex];
        (0, check_bounds_1.checkBounds)(this.tree, treeIndex);
        const leaf = (0, standard_leaf_hash_1.standardLeafHash)(value, this.leafEncoding);
        if (!(0, utils_1.equalsBytes)(leaf, this.tree[treeIndex])) {
            throw new Error('Merkle tree does not contain the expected value');
        }
        return leaf;
    }
    getLeafHash(leaf) {
        if (typeof leaf === 'number') {
            return this.validateValue(leaf);
        }
        else {
            return (0, standard_leaf_hash_1.standardLeafHash)(leaf, this.leafEncoding);
        }
    }
}
exports.StandardMerkleTree = StandardMerkleTree;

},{"./bytes":59,"./core":60,"./options":62,"./utils/check-bounds":64,"./utils/standard-leaf-hash":65,"./utils/throw-error":66,"ethereum-cryptography/utils":70}],64:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkBounds = void 0;
function checkBounds(array, index) {
    if (index < 0 || index >= array.length) {
        throw new Error('Index out of bounds');
    }
}
exports.checkBounds = checkBounds;

},{}],65:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.standardLeafHash = void 0;
const keccak_1 = require("ethereum-cryptography/keccak");
const utils_1 = require("ethereum-cryptography/utils");
const abi_1 = require("@ethersproject/abi");
function standardLeafHash(value, types) {
    return (0, keccak_1.keccak256)((0, keccak_1.keccak256)((0, utils_1.hexToBytes)(abi_1.defaultAbiCoder.encode(types, value))));
}
exports.standardLeafHash = standardLeafHash;

},{"@ethersproject/abi":16,"ethereum-cryptography/keccak":69,"ethereum-cryptography/utils":70}],66:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.throwError = void 0;
function throwError(message) {
    throw new Error(message);
}
exports.throwError = throwError;

},{}],67:[function(require,module,exports){
(function (module, exports) {
  'use strict';

  // Utils
  function assert (val, msg) {
    if (!val) throw new Error(msg || 'Assertion failed');
  }

  // Could use `inherits` module, but don't want to move from single file
  // architecture yet.
  function inherits (ctor, superCtor) {
    ctor.super_ = superCtor;
    var TempCtor = function () {};
    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  }

  // BN

  function BN (number, base, endian) {
    if (BN.isBN(number)) {
      return number;
    }

    this.negative = 0;
    this.words = null;
    this.length = 0;

    // Reduction context
    this.red = null;

    if (number !== null) {
      if (base === 'le' || base === 'be') {
        endian = base;
        base = 10;
      }

      this._init(number || 0, base || 10, endian || 'be');
    }
  }
  if (typeof module === 'object') {
    module.exports = BN;
  } else {
    exports.BN = BN;
  }

  BN.BN = BN;
  BN.wordSize = 26;

  var Buffer;
  try {
    if (typeof window !== 'undefined' && typeof window.Buffer !== 'undefined') {
      Buffer = window.Buffer;
    } else {
      Buffer = require('buffer').Buffer;
    }
  } catch (e) {
  }

  BN.isBN = function isBN (num) {
    if (num instanceof BN) {
      return true;
    }

    return num !== null && typeof num === 'object' &&
      num.constructor.wordSize === BN.wordSize && Array.isArray(num.words);
  };

  BN.max = function max (left, right) {
    if (left.cmp(right) > 0) return left;
    return right;
  };

  BN.min = function min (left, right) {
    if (left.cmp(right) < 0) return left;
    return right;
  };

  BN.prototype._init = function init (number, base, endian) {
    if (typeof number === 'number') {
      return this._initNumber(number, base, endian);
    }

    if (typeof number === 'object') {
      return this._initArray(number, base, endian);
    }

    if (base === 'hex') {
      base = 16;
    }
    assert(base === (base | 0) && base >= 2 && base <= 36);

    number = number.toString().replace(/\s+/g, '');
    var start = 0;
    if (number[0] === '-') {
      start++;
      this.negative = 1;
    }

    if (start < number.length) {
      if (base === 16) {
        this._parseHex(number, start, endian);
      } else {
        this._parseBase(number, base, start);
        if (endian === 'le') {
          this._initArray(this.toArray(), base, endian);
        }
      }
    }
  };

  BN.prototype._initNumber = function _initNumber (number, base, endian) {
    if (number < 0) {
      this.negative = 1;
      number = -number;
    }
    if (number < 0x4000000) {
      this.words = [number & 0x3ffffff];
      this.length = 1;
    } else if (number < 0x10000000000000) {
      this.words = [
        number & 0x3ffffff,
        (number / 0x4000000) & 0x3ffffff
      ];
      this.length = 2;
    } else {
      assert(number < 0x20000000000000); // 2 ^ 53 (unsafe)
      this.words = [
        number & 0x3ffffff,
        (number / 0x4000000) & 0x3ffffff,
        1
      ];
      this.length = 3;
    }

    if (endian !== 'le') return;

    // Reverse the bytes
    this._initArray(this.toArray(), base, endian);
  };

  BN.prototype._initArray = function _initArray (number, base, endian) {
    // Perhaps a Uint8Array
    assert(typeof number.length === 'number');
    if (number.length <= 0) {
      this.words = [0];
      this.length = 1;
      return this;
    }

    this.length = Math.ceil(number.length / 3);
    this.words = new Array(this.length);
    for (var i = 0; i < this.length; i++) {
      this.words[i] = 0;
    }

    var j, w;
    var off = 0;
    if (endian === 'be') {
      for (i = number.length - 1, j = 0; i >= 0; i -= 3) {
        w = number[i] | (number[i - 1] << 8) | (number[i - 2] << 16);
        this.words[j] |= (w << off) & 0x3ffffff;
        this.words[j + 1] = (w >>> (26 - off)) & 0x3ffffff;
        off += 24;
        if (off >= 26) {
          off -= 26;
          j++;
        }
      }
    } else if (endian === 'le') {
      for (i = 0, j = 0; i < number.length; i += 3) {
        w = number[i] | (number[i + 1] << 8) | (number[i + 2] << 16);
        this.words[j] |= (w << off) & 0x3ffffff;
        this.words[j + 1] = (w >>> (26 - off)) & 0x3ffffff;
        off += 24;
        if (off >= 26) {
          off -= 26;
          j++;
        }
      }
    }
    return this._strip();
  };

  function parseHex4Bits (string, index) {
    var c = string.charCodeAt(index);
    // '0' - '9'
    if (c >= 48 && c <= 57) {
      return c - 48;
    // 'A' - 'F'
    } else if (c >= 65 && c <= 70) {
      return c - 55;
    // 'a' - 'f'
    } else if (c >= 97 && c <= 102) {
      return c - 87;
    } else {
      assert(false, 'Invalid character in ' + string);
    }
  }

  function parseHexByte (string, lowerBound, index) {
    var r = parseHex4Bits(string, index);
    if (index - 1 >= lowerBound) {
      r |= parseHex4Bits(string, index - 1) << 4;
    }
    return r;
  }

  BN.prototype._parseHex = function _parseHex (number, start, endian) {
    // Create possibly bigger array to ensure that it fits the number
    this.length = Math.ceil((number.length - start) / 6);
    this.words = new Array(this.length);
    for (var i = 0; i < this.length; i++) {
      this.words[i] = 0;
    }

    // 24-bits chunks
    var off = 0;
    var j = 0;

    var w;
    if (endian === 'be') {
      for (i = number.length - 1; i >= start; i -= 2) {
        w = parseHexByte(number, start, i) << off;
        this.words[j] |= w & 0x3ffffff;
        if (off >= 18) {
          off -= 18;
          j += 1;
          this.words[j] |= w >>> 26;
        } else {
          off += 8;
        }
      }
    } else {
      var parseLength = number.length - start;
      for (i = parseLength % 2 === 0 ? start + 1 : start; i < number.length; i += 2) {
        w = parseHexByte(number, start, i) << off;
        this.words[j] |= w & 0x3ffffff;
        if (off >= 18) {
          off -= 18;
          j += 1;
          this.words[j] |= w >>> 26;
        } else {
          off += 8;
        }
      }
    }

    this._strip();
  };

  function parseBase (str, start, end, mul) {
    var r = 0;
    var b = 0;
    var len = Math.min(str.length, end);
    for (var i = start; i < len; i++) {
      var c = str.charCodeAt(i) - 48;

      r *= mul;

      // 'a'
      if (c >= 49) {
        b = c - 49 + 0xa;

      // 'A'
      } else if (c >= 17) {
        b = c - 17 + 0xa;

      // '0' - '9'
      } else {
        b = c;
      }
      assert(c >= 0 && b < mul, 'Invalid character');
      r += b;
    }
    return r;
  }

  BN.prototype._parseBase = function _parseBase (number, base, start) {
    // Initialize as zero
    this.words = [0];
    this.length = 1;

    // Find length of limb in base
    for (var limbLen = 0, limbPow = 1; limbPow <= 0x3ffffff; limbPow *= base) {
      limbLen++;
    }
    limbLen--;
    limbPow = (limbPow / base) | 0;

    var total = number.length - start;
    var mod = total % limbLen;
    var end = Math.min(total, total - mod) + start;

    var word = 0;
    for (var i = start; i < end; i += limbLen) {
      word = parseBase(number, i, i + limbLen, base);

      this.imuln(limbPow);
      if (this.words[0] + word < 0x4000000) {
        this.words[0] += word;
      } else {
        this._iaddn(word);
      }
    }

    if (mod !== 0) {
      var pow = 1;
      word = parseBase(number, i, number.length, base);

      for (i = 0; i < mod; i++) {
        pow *= base;
      }

      this.imuln(pow);
      if (this.words[0] + word < 0x4000000) {
        this.words[0] += word;
      } else {
        this._iaddn(word);
      }
    }

    this._strip();
  };

  BN.prototype.copy = function copy (dest) {
    dest.words = new Array(this.length);
    for (var i = 0; i < this.length; i++) {
      dest.words[i] = this.words[i];
    }
    dest.length = this.length;
    dest.negative = this.negative;
    dest.red = this.red;
  };

  function move (dest, src) {
    dest.words = src.words;
    dest.length = src.length;
    dest.negative = src.negative;
    dest.red = src.red;
  }

  BN.prototype._move = function _move (dest) {
    move(dest, this);
  };

  BN.prototype.clone = function clone () {
    var r = new BN(null);
    this.copy(r);
    return r;
  };

  BN.prototype._expand = function _expand (size) {
    while (this.length < size) {
      this.words[this.length++] = 0;
    }
    return this;
  };

  // Remove leading `0` from `this`
  BN.prototype._strip = function strip () {
    while (this.length > 1 && this.words[this.length - 1] === 0) {
      this.length--;
    }
    return this._normSign();
  };

  BN.prototype._normSign = function _normSign () {
    // -0 = 0
    if (this.length === 1 && this.words[0] === 0) {
      this.negative = 0;
    }
    return this;
  };

  // Check Symbol.for because not everywhere where Symbol defined
  // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol#Browser_compatibility
  if (typeof Symbol !== 'undefined' && typeof Symbol.for === 'function') {
    try {
      BN.prototype[Symbol.for('nodejs.util.inspect.custom')] = inspect;
    } catch (e) {
      BN.prototype.inspect = inspect;
    }
  } else {
    BN.prototype.inspect = inspect;
  }

  function inspect () {
    return (this.red ? '<BN-R: ' : '<BN: ') + this.toString(16) + '>';
  }

  /*

  var zeros = [];
  var groupSizes = [];
  var groupBases = [];

  var s = '';
  var i = -1;
  while (++i < BN.wordSize) {
    zeros[i] = s;
    s += '0';
  }
  groupSizes[0] = 0;
  groupSizes[1] = 0;
  groupBases[0] = 0;
  groupBases[1] = 0;
  var base = 2 - 1;
  while (++base < 36 + 1) {
    var groupSize = 0;
    var groupBase = 1;
    while (groupBase < (1 << BN.wordSize) / base) {
      groupBase *= base;
      groupSize += 1;
    }
    groupSizes[base] = groupSize;
    groupBases[base] = groupBase;
  }

  */

  var zeros = [
    '',
    '0',
    '00',
    '000',
    '0000',
    '00000',
    '000000',
    '0000000',
    '00000000',
    '000000000',
    '0000000000',
    '00000000000',
    '000000000000',
    '0000000000000',
    '00000000000000',
    '000000000000000',
    '0000000000000000',
    '00000000000000000',
    '000000000000000000',
    '0000000000000000000',
    '00000000000000000000',
    '000000000000000000000',
    '0000000000000000000000',
    '00000000000000000000000',
    '000000000000000000000000',
    '0000000000000000000000000'
  ];

  var groupSizes = [
    0, 0,
    25, 16, 12, 11, 10, 9, 8,
    8, 7, 7, 7, 7, 6, 6,
    6, 6, 6, 6, 6, 5, 5,
    5, 5, 5, 5, 5, 5, 5,
    5, 5, 5, 5, 5, 5, 5
  ];

  var groupBases = [
    0, 0,
    33554432, 43046721, 16777216, 48828125, 60466176, 40353607, 16777216,
    43046721, 10000000, 19487171, 35831808, 62748517, 7529536, 11390625,
    16777216, 24137569, 34012224, 47045881, 64000000, 4084101, 5153632,
    6436343, 7962624, 9765625, 11881376, 14348907, 17210368, 20511149,
    24300000, 28629151, 33554432, 39135393, 45435424, 52521875, 60466176
  ];

  BN.prototype.toString = function toString (base, padding) {
    base = base || 10;
    padding = padding | 0 || 1;

    var out;
    if (base === 16 || base === 'hex') {
      out = '';
      var off = 0;
      var carry = 0;
      for (var i = 0; i < this.length; i++) {
        var w = this.words[i];
        var word = (((w << off) | carry) & 0xffffff).toString(16);
        carry = (w >>> (24 - off)) & 0xffffff;
        off += 2;
        if (off >= 26) {
          off -= 26;
          i--;
        }
        if (carry !== 0 || i !== this.length - 1) {
          out = zeros[6 - word.length] + word + out;
        } else {
          out = word + out;
        }
      }
      if (carry !== 0) {
        out = carry.toString(16) + out;
      }
      while (out.length % padding !== 0) {
        out = '0' + out;
      }
      if (this.negative !== 0) {
        out = '-' + out;
      }
      return out;
    }

    if (base === (base | 0) && base >= 2 && base <= 36) {
      // var groupSize = Math.floor(BN.wordSize * Math.LN2 / Math.log(base));
      var groupSize = groupSizes[base];
      // var groupBase = Math.pow(base, groupSize);
      var groupBase = groupBases[base];
      out = '';
      var c = this.clone();
      c.negative = 0;
      while (!c.isZero()) {
        var r = c.modrn(groupBase).toString(base);
        c = c.idivn(groupBase);

        if (!c.isZero()) {
          out = zeros[groupSize - r.length] + r + out;
        } else {
          out = r + out;
        }
      }
      if (this.isZero()) {
        out = '0' + out;
      }
      while (out.length % padding !== 0) {
        out = '0' + out;
      }
      if (this.negative !== 0) {
        out = '-' + out;
      }
      return out;
    }

    assert(false, 'Base should be between 2 and 36');
  };

  BN.prototype.toNumber = function toNumber () {
    var ret = this.words[0];
    if (this.length === 2) {
      ret += this.words[1] * 0x4000000;
    } else if (this.length === 3 && this.words[2] === 0x01) {
      // NOTE: at this stage it is known that the top bit is set
      ret += 0x10000000000000 + (this.words[1] * 0x4000000);
    } else if (this.length > 2) {
      assert(false, 'Number can only safely store up to 53 bits');
    }
    return (this.negative !== 0) ? -ret : ret;
  };

  BN.prototype.toJSON = function toJSON () {
    return this.toString(16, 2);
  };

  if (Buffer) {
    BN.prototype.toBuffer = function toBuffer (endian, length) {
      return this.toArrayLike(Buffer, endian, length);
    };
  }

  BN.prototype.toArray = function toArray (endian, length) {
    return this.toArrayLike(Array, endian, length);
  };

  var allocate = function allocate (ArrayType, size) {
    if (ArrayType.allocUnsafe) {
      return ArrayType.allocUnsafe(size);
    }
    return new ArrayType(size);
  };

  BN.prototype.toArrayLike = function toArrayLike (ArrayType, endian, length) {
    this._strip();

    var byteLength = this.byteLength();
    var reqLength = length || Math.max(1, byteLength);
    assert(byteLength <= reqLength, 'byte array longer than desired length');
    assert(reqLength > 0, 'Requested array length <= 0');

    var res = allocate(ArrayType, reqLength);
    var postfix = endian === 'le' ? 'LE' : 'BE';
    this['_toArrayLike' + postfix](res, byteLength);
    return res;
  };

  BN.prototype._toArrayLikeLE = function _toArrayLikeLE (res, byteLength) {
    var position = 0;
    var carry = 0;

    for (var i = 0, shift = 0; i < this.length; i++) {
      var word = (this.words[i] << shift) | carry;

      res[position++] = word & 0xff;
      if (position < res.length) {
        res[position++] = (word >> 8) & 0xff;
      }
      if (position < res.length) {
        res[position++] = (word >> 16) & 0xff;
      }

      if (shift === 6) {
        if (position < res.length) {
          res[position++] = (word >> 24) & 0xff;
        }
        carry = 0;
        shift = 0;
      } else {
        carry = word >>> 24;
        shift += 2;
      }
    }

    if (position < res.length) {
      res[position++] = carry;

      while (position < res.length) {
        res[position++] = 0;
      }
    }
  };

  BN.prototype._toArrayLikeBE = function _toArrayLikeBE (res, byteLength) {
    var position = res.length - 1;
    var carry = 0;

    for (var i = 0, shift = 0; i < this.length; i++) {
      var word = (this.words[i] << shift) | carry;

      res[position--] = word & 0xff;
      if (position >= 0) {
        res[position--] = (word >> 8) & 0xff;
      }
      if (position >= 0) {
        res[position--] = (word >> 16) & 0xff;
      }

      if (shift === 6) {
        if (position >= 0) {
          res[position--] = (word >> 24) & 0xff;
        }
        carry = 0;
        shift = 0;
      } else {
        carry = word >>> 24;
        shift += 2;
      }
    }

    if (position >= 0) {
      res[position--] = carry;

      while (position >= 0) {
        res[position--] = 0;
      }
    }
  };

  if (Math.clz32) {
    BN.prototype._countBits = function _countBits (w) {
      return 32 - Math.clz32(w);
    };
  } else {
    BN.prototype._countBits = function _countBits (w) {
      var t = w;
      var r = 0;
      if (t >= 0x1000) {
        r += 13;
        t >>>= 13;
      }
      if (t >= 0x40) {
        r += 7;
        t >>>= 7;
      }
      if (t >= 0x8) {
        r += 4;
        t >>>= 4;
      }
      if (t >= 0x02) {
        r += 2;
        t >>>= 2;
      }
      return r + t;
    };
  }

  BN.prototype._zeroBits = function _zeroBits (w) {
    // Short-cut
    if (w === 0) return 26;

    var t = w;
    var r = 0;
    if ((t & 0x1fff) === 0) {
      r += 13;
      t >>>= 13;
    }
    if ((t & 0x7f) === 0) {
      r += 7;
      t >>>= 7;
    }
    if ((t & 0xf) === 0) {
      r += 4;
      t >>>= 4;
    }
    if ((t & 0x3) === 0) {
      r += 2;
      t >>>= 2;
    }
    if ((t & 0x1) === 0) {
      r++;
    }
    return r;
  };

  // Return number of used bits in a BN
  BN.prototype.bitLength = function bitLength () {
    var w = this.words[this.length - 1];
    var hi = this._countBits(w);
    return (this.length - 1) * 26 + hi;
  };

  function toBitArray (num) {
    var w = new Array(num.bitLength());

    for (var bit = 0; bit < w.length; bit++) {
      var off = (bit / 26) | 0;
      var wbit = bit % 26;

      w[bit] = (num.words[off] >>> wbit) & 0x01;
    }

    return w;
  }

  // Number of trailing zero bits
  BN.prototype.zeroBits = function zeroBits () {
    if (this.isZero()) return 0;

    var r = 0;
    for (var i = 0; i < this.length; i++) {
      var b = this._zeroBits(this.words[i]);
      r += b;
      if (b !== 26) break;
    }
    return r;
  };

  BN.prototype.byteLength = function byteLength () {
    return Math.ceil(this.bitLength() / 8);
  };

  BN.prototype.toTwos = function toTwos (width) {
    if (this.negative !== 0) {
      return this.abs().inotn(width).iaddn(1);
    }
    return this.clone();
  };

  BN.prototype.fromTwos = function fromTwos (width) {
    if (this.testn(width - 1)) {
      return this.notn(width).iaddn(1).ineg();
    }
    return this.clone();
  };

  BN.prototype.isNeg = function isNeg () {
    return this.negative !== 0;
  };

  // Return negative clone of `this`
  BN.prototype.neg = function neg () {
    return this.clone().ineg();
  };

  BN.prototype.ineg = function ineg () {
    if (!this.isZero()) {
      this.negative ^= 1;
    }

    return this;
  };

  // Or `num` with `this` in-place
  BN.prototype.iuor = function iuor (num) {
    while (this.length < num.length) {
      this.words[this.length++] = 0;
    }

    for (var i = 0; i < num.length; i++) {
      this.words[i] = this.words[i] | num.words[i];
    }

    return this._strip();
  };

  BN.prototype.ior = function ior (num) {
    assert((this.negative | num.negative) === 0);
    return this.iuor(num);
  };

  // Or `num` with `this`
  BN.prototype.or = function or (num) {
    if (this.length > num.length) return this.clone().ior(num);
    return num.clone().ior(this);
  };

  BN.prototype.uor = function uor (num) {
    if (this.length > num.length) return this.clone().iuor(num);
    return num.clone().iuor(this);
  };

  // And `num` with `this` in-place
  BN.prototype.iuand = function iuand (num) {
    // b = min-length(num, this)
    var b;
    if (this.length > num.length) {
      b = num;
    } else {
      b = this;
    }

    for (var i = 0; i < b.length; i++) {
      this.words[i] = this.words[i] & num.words[i];
    }

    this.length = b.length;

    return this._strip();
  };

  BN.prototype.iand = function iand (num) {
    assert((this.negative | num.negative) === 0);
    return this.iuand(num);
  };

  // And `num` with `this`
  BN.prototype.and = function and (num) {
    if (this.length > num.length) return this.clone().iand(num);
    return num.clone().iand(this);
  };

  BN.prototype.uand = function uand (num) {
    if (this.length > num.length) return this.clone().iuand(num);
    return num.clone().iuand(this);
  };

  // Xor `num` with `this` in-place
  BN.prototype.iuxor = function iuxor (num) {
    // a.length > b.length
    var a;
    var b;
    if (this.length > num.length) {
      a = this;
      b = num;
    } else {
      a = num;
      b = this;
    }

    for (var i = 0; i < b.length; i++) {
      this.words[i] = a.words[i] ^ b.words[i];
    }

    if (this !== a) {
      for (; i < a.length; i++) {
        this.words[i] = a.words[i];
      }
    }

    this.length = a.length;

    return this._strip();
  };

  BN.prototype.ixor = function ixor (num) {
    assert((this.negative | num.negative) === 0);
    return this.iuxor(num);
  };

  // Xor `num` with `this`
  BN.prototype.xor = function xor (num) {
    if (this.length > num.length) return this.clone().ixor(num);
    return num.clone().ixor(this);
  };

  BN.prototype.uxor = function uxor (num) {
    if (this.length > num.length) return this.clone().iuxor(num);
    return num.clone().iuxor(this);
  };

  // Not ``this`` with ``width`` bitwidth
  BN.prototype.inotn = function inotn (width) {
    assert(typeof width === 'number' && width >= 0);

    var bytesNeeded = Math.ceil(width / 26) | 0;
    var bitsLeft = width % 26;

    // Extend the buffer with leading zeroes
    this._expand(bytesNeeded);

    if (bitsLeft > 0) {
      bytesNeeded--;
    }

    // Handle complete words
    for (var i = 0; i < bytesNeeded; i++) {
      this.words[i] = ~this.words[i] & 0x3ffffff;
    }

    // Handle the residue
    if (bitsLeft > 0) {
      this.words[i] = ~this.words[i] & (0x3ffffff >> (26 - bitsLeft));
    }

    // And remove leading zeroes
    return this._strip();
  };

  BN.prototype.notn = function notn (width) {
    return this.clone().inotn(width);
  };

  // Set `bit` of `this`
  BN.prototype.setn = function setn (bit, val) {
    assert(typeof bit === 'number' && bit >= 0);

    var off = (bit / 26) | 0;
    var wbit = bit % 26;

    this._expand(off + 1);

    if (val) {
      this.words[off] = this.words[off] | (1 << wbit);
    } else {
      this.words[off] = this.words[off] & ~(1 << wbit);
    }

    return this._strip();
  };

  // Add `num` to `this` in-place
  BN.prototype.iadd = function iadd (num) {
    var r;

    // negative + positive
    if (this.negative !== 0 && num.negative === 0) {
      this.negative = 0;
      r = this.isub(num);
      this.negative ^= 1;
      return this._normSign();

    // positive + negative
    } else if (this.negative === 0 && num.negative !== 0) {
      num.negative = 0;
      r = this.isub(num);
      num.negative = 1;
      return r._normSign();
    }

    // a.length > b.length
    var a, b;
    if (this.length > num.length) {
      a = this;
      b = num;
    } else {
      a = num;
      b = this;
    }

    var carry = 0;
    for (var i = 0; i < b.length; i++) {
      r = (a.words[i] | 0) + (b.words[i] | 0) + carry;
      this.words[i] = r & 0x3ffffff;
      carry = r >>> 26;
    }
    for (; carry !== 0 && i < a.length; i++) {
      r = (a.words[i] | 0) + carry;
      this.words[i] = r & 0x3ffffff;
      carry = r >>> 26;
    }

    this.length = a.length;
    if (carry !== 0) {
      this.words[this.length] = carry;
      this.length++;
    // Copy the rest of the words
    } else if (a !== this) {
      for (; i < a.length; i++) {
        this.words[i] = a.words[i];
      }
    }

    return this;
  };

  // Add `num` to `this`
  BN.prototype.add = function add (num) {
    var res;
    if (num.negative !== 0 && this.negative === 0) {
      num.negative = 0;
      res = this.sub(num);
      num.negative ^= 1;
      return res;
    } else if (num.negative === 0 && this.negative !== 0) {
      this.negative = 0;
      res = num.sub(this);
      this.negative = 1;
      return res;
    }

    if (this.length > num.length) return this.clone().iadd(num);

    return num.clone().iadd(this);
  };

  // Subtract `num` from `this` in-place
  BN.prototype.isub = function isub (num) {
    // this - (-num) = this + num
    if (num.negative !== 0) {
      num.negative = 0;
      var r = this.iadd(num);
      num.negative = 1;
      return r._normSign();

    // -this - num = -(this + num)
    } else if (this.negative !== 0) {
      this.negative = 0;
      this.iadd(num);
      this.negative = 1;
      return this._normSign();
    }

    // At this point both numbers are positive
    var cmp = this.cmp(num);

    // Optimization - zeroify
    if (cmp === 0) {
      this.negative = 0;
      this.length = 1;
      this.words[0] = 0;
      return this;
    }

    // a > b
    var a, b;
    if (cmp > 0) {
      a = this;
      b = num;
    } else {
      a = num;
      b = this;
    }

    var carry = 0;
    for (var i = 0; i < b.length; i++) {
      r = (a.words[i] | 0) - (b.words[i] | 0) + carry;
      carry = r >> 26;
      this.words[i] = r & 0x3ffffff;
    }
    for (; carry !== 0 && i < a.length; i++) {
      r = (a.words[i] | 0) + carry;
      carry = r >> 26;
      this.words[i] = r & 0x3ffffff;
    }

    // Copy rest of the words
    if (carry === 0 && i < a.length && a !== this) {
      for (; i < a.length; i++) {
        this.words[i] = a.words[i];
      }
    }

    this.length = Math.max(this.length, i);

    if (a !== this) {
      this.negative = 1;
    }

    return this._strip();
  };

  // Subtract `num` from `this`
  BN.prototype.sub = function sub (num) {
    return this.clone().isub(num);
  };

  function smallMulTo (self, num, out) {
    out.negative = num.negative ^ self.negative;
    var len = (self.length + num.length) | 0;
    out.length = len;
    len = (len - 1) | 0;

    // Peel one iteration (compiler can't do it, because of code complexity)
    var a = self.words[0] | 0;
    var b = num.words[0] | 0;
    var r = a * b;

    var lo = r & 0x3ffffff;
    var carry = (r / 0x4000000) | 0;
    out.words[0] = lo;

    for (var k = 1; k < len; k++) {
      // Sum all words with the same `i + j = k` and accumulate `ncarry`,
      // note that ncarry could be >= 0x3ffffff
      var ncarry = carry >>> 26;
      var rword = carry & 0x3ffffff;
      var maxJ = Math.min(k, num.length - 1);
      for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
        var i = (k - j) | 0;
        a = self.words[i] | 0;
        b = num.words[j] | 0;
        r = a * b + rword;
        ncarry += (r / 0x4000000) | 0;
        rword = r & 0x3ffffff;
      }
      out.words[k] = rword | 0;
      carry = ncarry | 0;
    }
    if (carry !== 0) {
      out.words[k] = carry | 0;
    } else {
      out.length--;
    }

    return out._strip();
  }

  // TODO(indutny): it may be reasonable to omit it for users who don't need
  // to work with 256-bit numbers, otherwise it gives 20% improvement for 256-bit
  // multiplication (like elliptic secp256k1).
  var comb10MulTo = function comb10MulTo (self, num, out) {
    var a = self.words;
    var b = num.words;
    var o = out.words;
    var c = 0;
    var lo;
    var mid;
    var hi;
    var a0 = a[0] | 0;
    var al0 = a0 & 0x1fff;
    var ah0 = a0 >>> 13;
    var a1 = a[1] | 0;
    var al1 = a1 & 0x1fff;
    var ah1 = a1 >>> 13;
    var a2 = a[2] | 0;
    var al2 = a2 & 0x1fff;
    var ah2 = a2 >>> 13;
    var a3 = a[3] | 0;
    var al3 = a3 & 0x1fff;
    var ah3 = a3 >>> 13;
    var a4 = a[4] | 0;
    var al4 = a4 & 0x1fff;
    var ah4 = a4 >>> 13;
    var a5 = a[5] | 0;
    var al5 = a5 & 0x1fff;
    var ah5 = a5 >>> 13;
    var a6 = a[6] | 0;
    var al6 = a6 & 0x1fff;
    var ah6 = a6 >>> 13;
    var a7 = a[7] | 0;
    var al7 = a7 & 0x1fff;
    var ah7 = a7 >>> 13;
    var a8 = a[8] | 0;
    var al8 = a8 & 0x1fff;
    var ah8 = a8 >>> 13;
    var a9 = a[9] | 0;
    var al9 = a9 & 0x1fff;
    var ah9 = a9 >>> 13;
    var b0 = b[0] | 0;
    var bl0 = b0 & 0x1fff;
    var bh0 = b0 >>> 13;
    var b1 = b[1] | 0;
    var bl1 = b1 & 0x1fff;
    var bh1 = b1 >>> 13;
    var b2 = b[2] | 0;
    var bl2 = b2 & 0x1fff;
    var bh2 = b2 >>> 13;
    var b3 = b[3] | 0;
    var bl3 = b3 & 0x1fff;
    var bh3 = b3 >>> 13;
    var b4 = b[4] | 0;
    var bl4 = b4 & 0x1fff;
    var bh4 = b4 >>> 13;
    var b5 = b[5] | 0;
    var bl5 = b5 & 0x1fff;
    var bh5 = b5 >>> 13;
    var b6 = b[6] | 0;
    var bl6 = b6 & 0x1fff;
    var bh6 = b6 >>> 13;
    var b7 = b[7] | 0;
    var bl7 = b7 & 0x1fff;
    var bh7 = b7 >>> 13;
    var b8 = b[8] | 0;
    var bl8 = b8 & 0x1fff;
    var bh8 = b8 >>> 13;
    var b9 = b[9] | 0;
    var bl9 = b9 & 0x1fff;
    var bh9 = b9 >>> 13;

    out.negative = self.negative ^ num.negative;
    out.length = 19;
    /* k = 0 */
    lo = Math.imul(al0, bl0);
    mid = Math.imul(al0, bh0);
    mid = (mid + Math.imul(ah0, bl0)) | 0;
    hi = Math.imul(ah0, bh0);
    var w0 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w0 >>> 26)) | 0;
    w0 &= 0x3ffffff;
    /* k = 1 */
    lo = Math.imul(al1, bl0);
    mid = Math.imul(al1, bh0);
    mid = (mid + Math.imul(ah1, bl0)) | 0;
    hi = Math.imul(ah1, bh0);
    lo = (lo + Math.imul(al0, bl1)) | 0;
    mid = (mid + Math.imul(al0, bh1)) | 0;
    mid = (mid + Math.imul(ah0, bl1)) | 0;
    hi = (hi + Math.imul(ah0, bh1)) | 0;
    var w1 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w1 >>> 26)) | 0;
    w1 &= 0x3ffffff;
    /* k = 2 */
    lo = Math.imul(al2, bl0);
    mid = Math.imul(al2, bh0);
    mid = (mid + Math.imul(ah2, bl0)) | 0;
    hi = Math.imul(ah2, bh0);
    lo = (lo + Math.imul(al1, bl1)) | 0;
    mid = (mid + Math.imul(al1, bh1)) | 0;
    mid = (mid + Math.imul(ah1, bl1)) | 0;
    hi = (hi + Math.imul(ah1, bh1)) | 0;
    lo = (lo + Math.imul(al0, bl2)) | 0;
    mid = (mid + Math.imul(al0, bh2)) | 0;
    mid = (mid + Math.imul(ah0, bl2)) | 0;
    hi = (hi + Math.imul(ah0, bh2)) | 0;
    var w2 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w2 >>> 26)) | 0;
    w2 &= 0x3ffffff;
    /* k = 3 */
    lo = Math.imul(al3, bl0);
    mid = Math.imul(al3, bh0);
    mid = (mid + Math.imul(ah3, bl0)) | 0;
    hi = Math.imul(ah3, bh0);
    lo = (lo + Math.imul(al2, bl1)) | 0;
    mid = (mid + Math.imul(al2, bh1)) | 0;
    mid = (mid + Math.imul(ah2, bl1)) | 0;
    hi = (hi + Math.imul(ah2, bh1)) | 0;
    lo = (lo + Math.imul(al1, bl2)) | 0;
    mid = (mid + Math.imul(al1, bh2)) | 0;
    mid = (mid + Math.imul(ah1, bl2)) | 0;
    hi = (hi + Math.imul(ah1, bh2)) | 0;
    lo = (lo + Math.imul(al0, bl3)) | 0;
    mid = (mid + Math.imul(al0, bh3)) | 0;
    mid = (mid + Math.imul(ah0, bl3)) | 0;
    hi = (hi + Math.imul(ah0, bh3)) | 0;
    var w3 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w3 >>> 26)) | 0;
    w3 &= 0x3ffffff;
    /* k = 4 */
    lo = Math.imul(al4, bl0);
    mid = Math.imul(al4, bh0);
    mid = (mid + Math.imul(ah4, bl0)) | 0;
    hi = Math.imul(ah4, bh0);
    lo = (lo + Math.imul(al3, bl1)) | 0;
    mid = (mid + Math.imul(al3, bh1)) | 0;
    mid = (mid + Math.imul(ah3, bl1)) | 0;
    hi = (hi + Math.imul(ah3, bh1)) | 0;
    lo = (lo + Math.imul(al2, bl2)) | 0;
    mid = (mid + Math.imul(al2, bh2)) | 0;
    mid = (mid + Math.imul(ah2, bl2)) | 0;
    hi = (hi + Math.imul(ah2, bh2)) | 0;
    lo = (lo + Math.imul(al1, bl3)) | 0;
    mid = (mid + Math.imul(al1, bh3)) | 0;
    mid = (mid + Math.imul(ah1, bl3)) | 0;
    hi = (hi + Math.imul(ah1, bh3)) | 0;
    lo = (lo + Math.imul(al0, bl4)) | 0;
    mid = (mid + Math.imul(al0, bh4)) | 0;
    mid = (mid + Math.imul(ah0, bl4)) | 0;
    hi = (hi + Math.imul(ah0, bh4)) | 0;
    var w4 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w4 >>> 26)) | 0;
    w4 &= 0x3ffffff;
    /* k = 5 */
    lo = Math.imul(al5, bl0);
    mid = Math.imul(al5, bh0);
    mid = (mid + Math.imul(ah5, bl0)) | 0;
    hi = Math.imul(ah5, bh0);
    lo = (lo + Math.imul(al4, bl1)) | 0;
    mid = (mid + Math.imul(al4, bh1)) | 0;
    mid = (mid + Math.imul(ah4, bl1)) | 0;
    hi = (hi + Math.imul(ah4, bh1)) | 0;
    lo = (lo + Math.imul(al3, bl2)) | 0;
    mid = (mid + Math.imul(al3, bh2)) | 0;
    mid = (mid + Math.imul(ah3, bl2)) | 0;
    hi = (hi + Math.imul(ah3, bh2)) | 0;
    lo = (lo + Math.imul(al2, bl3)) | 0;
    mid = (mid + Math.imul(al2, bh3)) | 0;
    mid = (mid + Math.imul(ah2, bl3)) | 0;
    hi = (hi + Math.imul(ah2, bh3)) | 0;
    lo = (lo + Math.imul(al1, bl4)) | 0;
    mid = (mid + Math.imul(al1, bh4)) | 0;
    mid = (mid + Math.imul(ah1, bl4)) | 0;
    hi = (hi + Math.imul(ah1, bh4)) | 0;
    lo = (lo + Math.imul(al0, bl5)) | 0;
    mid = (mid + Math.imul(al0, bh5)) | 0;
    mid = (mid + Math.imul(ah0, bl5)) | 0;
    hi = (hi + Math.imul(ah0, bh5)) | 0;
    var w5 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w5 >>> 26)) | 0;
    w5 &= 0x3ffffff;
    /* k = 6 */
    lo = Math.imul(al6, bl0);
    mid = Math.imul(al6, bh0);
    mid = (mid + Math.imul(ah6, bl0)) | 0;
    hi = Math.imul(ah6, bh0);
    lo = (lo + Math.imul(al5, bl1)) | 0;
    mid = (mid + Math.imul(al5, bh1)) | 0;
    mid = (mid + Math.imul(ah5, bl1)) | 0;
    hi = (hi + Math.imul(ah5, bh1)) | 0;
    lo = (lo + Math.imul(al4, bl2)) | 0;
    mid = (mid + Math.imul(al4, bh2)) | 0;
    mid = (mid + Math.imul(ah4, bl2)) | 0;
    hi = (hi + Math.imul(ah4, bh2)) | 0;
    lo = (lo + Math.imul(al3, bl3)) | 0;
    mid = (mid + Math.imul(al3, bh3)) | 0;
    mid = (mid + Math.imul(ah3, bl3)) | 0;
    hi = (hi + Math.imul(ah3, bh3)) | 0;
    lo = (lo + Math.imul(al2, bl4)) | 0;
    mid = (mid + Math.imul(al2, bh4)) | 0;
    mid = (mid + Math.imul(ah2, bl4)) | 0;
    hi = (hi + Math.imul(ah2, bh4)) | 0;
    lo = (lo + Math.imul(al1, bl5)) | 0;
    mid = (mid + Math.imul(al1, bh5)) | 0;
    mid = (mid + Math.imul(ah1, bl5)) | 0;
    hi = (hi + Math.imul(ah1, bh5)) | 0;
    lo = (lo + Math.imul(al0, bl6)) | 0;
    mid = (mid + Math.imul(al0, bh6)) | 0;
    mid = (mid + Math.imul(ah0, bl6)) | 0;
    hi = (hi + Math.imul(ah0, bh6)) | 0;
    var w6 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w6 >>> 26)) | 0;
    w6 &= 0x3ffffff;
    /* k = 7 */
    lo = Math.imul(al7, bl0);
    mid = Math.imul(al7, bh0);
    mid = (mid + Math.imul(ah7, bl0)) | 0;
    hi = Math.imul(ah7, bh0);
    lo = (lo + Math.imul(al6, bl1)) | 0;
    mid = (mid + Math.imul(al6, bh1)) | 0;
    mid = (mid + Math.imul(ah6, bl1)) | 0;
    hi = (hi + Math.imul(ah6, bh1)) | 0;
    lo = (lo + Math.imul(al5, bl2)) | 0;
    mid = (mid + Math.imul(al5, bh2)) | 0;
    mid = (mid + Math.imul(ah5, bl2)) | 0;
    hi = (hi + Math.imul(ah5, bh2)) | 0;
    lo = (lo + Math.imul(al4, bl3)) | 0;
    mid = (mid + Math.imul(al4, bh3)) | 0;
    mid = (mid + Math.imul(ah4, bl3)) | 0;
    hi = (hi + Math.imul(ah4, bh3)) | 0;
    lo = (lo + Math.imul(al3, bl4)) | 0;
    mid = (mid + Math.imul(al3, bh4)) | 0;
    mid = (mid + Math.imul(ah3, bl4)) | 0;
    hi = (hi + Math.imul(ah3, bh4)) | 0;
    lo = (lo + Math.imul(al2, bl5)) | 0;
    mid = (mid + Math.imul(al2, bh5)) | 0;
    mid = (mid + Math.imul(ah2, bl5)) | 0;
    hi = (hi + Math.imul(ah2, bh5)) | 0;
    lo = (lo + Math.imul(al1, bl6)) | 0;
    mid = (mid + Math.imul(al1, bh6)) | 0;
    mid = (mid + Math.imul(ah1, bl6)) | 0;
    hi = (hi + Math.imul(ah1, bh6)) | 0;
    lo = (lo + Math.imul(al0, bl7)) | 0;
    mid = (mid + Math.imul(al0, bh7)) | 0;
    mid = (mid + Math.imul(ah0, bl7)) | 0;
    hi = (hi + Math.imul(ah0, bh7)) | 0;
    var w7 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w7 >>> 26)) | 0;
    w7 &= 0x3ffffff;
    /* k = 8 */
    lo = Math.imul(al8, bl0);
    mid = Math.imul(al8, bh0);
    mid = (mid + Math.imul(ah8, bl0)) | 0;
    hi = Math.imul(ah8, bh0);
    lo = (lo + Math.imul(al7, bl1)) | 0;
    mid = (mid + Math.imul(al7, bh1)) | 0;
    mid = (mid + Math.imul(ah7, bl1)) | 0;
    hi = (hi + Math.imul(ah7, bh1)) | 0;
    lo = (lo + Math.imul(al6, bl2)) | 0;
    mid = (mid + Math.imul(al6, bh2)) | 0;
    mid = (mid + Math.imul(ah6, bl2)) | 0;
    hi = (hi + Math.imul(ah6, bh2)) | 0;
    lo = (lo + Math.imul(al5, bl3)) | 0;
    mid = (mid + Math.imul(al5, bh3)) | 0;
    mid = (mid + Math.imul(ah5, bl3)) | 0;
    hi = (hi + Math.imul(ah5, bh3)) | 0;
    lo = (lo + Math.imul(al4, bl4)) | 0;
    mid = (mid + Math.imul(al4, bh4)) | 0;
    mid = (mid + Math.imul(ah4, bl4)) | 0;
    hi = (hi + Math.imul(ah4, bh4)) | 0;
    lo = (lo + Math.imul(al3, bl5)) | 0;
    mid = (mid + Math.imul(al3, bh5)) | 0;
    mid = (mid + Math.imul(ah3, bl5)) | 0;
    hi = (hi + Math.imul(ah3, bh5)) | 0;
    lo = (lo + Math.imul(al2, bl6)) | 0;
    mid = (mid + Math.imul(al2, bh6)) | 0;
    mid = (mid + Math.imul(ah2, bl6)) | 0;
    hi = (hi + Math.imul(ah2, bh6)) | 0;
    lo = (lo + Math.imul(al1, bl7)) | 0;
    mid = (mid + Math.imul(al1, bh7)) | 0;
    mid = (mid + Math.imul(ah1, bl7)) | 0;
    hi = (hi + Math.imul(ah1, bh7)) | 0;
    lo = (lo + Math.imul(al0, bl8)) | 0;
    mid = (mid + Math.imul(al0, bh8)) | 0;
    mid = (mid + Math.imul(ah0, bl8)) | 0;
    hi = (hi + Math.imul(ah0, bh8)) | 0;
    var w8 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w8 >>> 26)) | 0;
    w8 &= 0x3ffffff;
    /* k = 9 */
    lo = Math.imul(al9, bl0);
    mid = Math.imul(al9, bh0);
    mid = (mid + Math.imul(ah9, bl0)) | 0;
    hi = Math.imul(ah9, bh0);
    lo = (lo + Math.imul(al8, bl1)) | 0;
    mid = (mid + Math.imul(al8, bh1)) | 0;
    mid = (mid + Math.imul(ah8, bl1)) | 0;
    hi = (hi + Math.imul(ah8, bh1)) | 0;
    lo = (lo + Math.imul(al7, bl2)) | 0;
    mid = (mid + Math.imul(al7, bh2)) | 0;
    mid = (mid + Math.imul(ah7, bl2)) | 0;
    hi = (hi + Math.imul(ah7, bh2)) | 0;
    lo = (lo + Math.imul(al6, bl3)) | 0;
    mid = (mid + Math.imul(al6, bh3)) | 0;
    mid = (mid + Math.imul(ah6, bl3)) | 0;
    hi = (hi + Math.imul(ah6, bh3)) | 0;
    lo = (lo + Math.imul(al5, bl4)) | 0;
    mid = (mid + Math.imul(al5, bh4)) | 0;
    mid = (mid + Math.imul(ah5, bl4)) | 0;
    hi = (hi + Math.imul(ah5, bh4)) | 0;
    lo = (lo + Math.imul(al4, bl5)) | 0;
    mid = (mid + Math.imul(al4, bh5)) | 0;
    mid = (mid + Math.imul(ah4, bl5)) | 0;
    hi = (hi + Math.imul(ah4, bh5)) | 0;
    lo = (lo + Math.imul(al3, bl6)) | 0;
    mid = (mid + Math.imul(al3, bh6)) | 0;
    mid = (mid + Math.imul(ah3, bl6)) | 0;
    hi = (hi + Math.imul(ah3, bh6)) | 0;
    lo = (lo + Math.imul(al2, bl7)) | 0;
    mid = (mid + Math.imul(al2, bh7)) | 0;
    mid = (mid + Math.imul(ah2, bl7)) | 0;
    hi = (hi + Math.imul(ah2, bh7)) | 0;
    lo = (lo + Math.imul(al1, bl8)) | 0;
    mid = (mid + Math.imul(al1, bh8)) | 0;
    mid = (mid + Math.imul(ah1, bl8)) | 0;
    hi = (hi + Math.imul(ah1, bh8)) | 0;
    lo = (lo + Math.imul(al0, bl9)) | 0;
    mid = (mid + Math.imul(al0, bh9)) | 0;
    mid = (mid + Math.imul(ah0, bl9)) | 0;
    hi = (hi + Math.imul(ah0, bh9)) | 0;
    var w9 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w9 >>> 26)) | 0;
    w9 &= 0x3ffffff;
    /* k = 10 */
    lo = Math.imul(al9, bl1);
    mid = Math.imul(al9, bh1);
    mid = (mid + Math.imul(ah9, bl1)) | 0;
    hi = Math.imul(ah9, bh1);
    lo = (lo + Math.imul(al8, bl2)) | 0;
    mid = (mid + Math.imul(al8, bh2)) | 0;
    mid = (mid + Math.imul(ah8, bl2)) | 0;
    hi = (hi + Math.imul(ah8, bh2)) | 0;
    lo = (lo + Math.imul(al7, bl3)) | 0;
    mid = (mid + Math.imul(al7, bh3)) | 0;
    mid = (mid + Math.imul(ah7, bl3)) | 0;
    hi = (hi + Math.imul(ah7, bh3)) | 0;
    lo = (lo + Math.imul(al6, bl4)) | 0;
    mid = (mid + Math.imul(al6, bh4)) | 0;
    mid = (mid + Math.imul(ah6, bl4)) | 0;
    hi = (hi + Math.imul(ah6, bh4)) | 0;
    lo = (lo + Math.imul(al5, bl5)) | 0;
    mid = (mid + Math.imul(al5, bh5)) | 0;
    mid = (mid + Math.imul(ah5, bl5)) | 0;
    hi = (hi + Math.imul(ah5, bh5)) | 0;
    lo = (lo + Math.imul(al4, bl6)) | 0;
    mid = (mid + Math.imul(al4, bh6)) | 0;
    mid = (mid + Math.imul(ah4, bl6)) | 0;
    hi = (hi + Math.imul(ah4, bh6)) | 0;
    lo = (lo + Math.imul(al3, bl7)) | 0;
    mid = (mid + Math.imul(al3, bh7)) | 0;
    mid = (mid + Math.imul(ah3, bl7)) | 0;
    hi = (hi + Math.imul(ah3, bh7)) | 0;
    lo = (lo + Math.imul(al2, bl8)) | 0;
    mid = (mid + Math.imul(al2, bh8)) | 0;
    mid = (mid + Math.imul(ah2, bl8)) | 0;
    hi = (hi + Math.imul(ah2, bh8)) | 0;
    lo = (lo + Math.imul(al1, bl9)) | 0;
    mid = (mid + Math.imul(al1, bh9)) | 0;
    mid = (mid + Math.imul(ah1, bl9)) | 0;
    hi = (hi + Math.imul(ah1, bh9)) | 0;
    var w10 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w10 >>> 26)) | 0;
    w10 &= 0x3ffffff;
    /* k = 11 */
    lo = Math.imul(al9, bl2);
    mid = Math.imul(al9, bh2);
    mid = (mid + Math.imul(ah9, bl2)) | 0;
    hi = Math.imul(ah9, bh2);
    lo = (lo + Math.imul(al8, bl3)) | 0;
    mid = (mid + Math.imul(al8, bh3)) | 0;
    mid = (mid + Math.imul(ah8, bl3)) | 0;
    hi = (hi + Math.imul(ah8, bh3)) | 0;
    lo = (lo + Math.imul(al7, bl4)) | 0;
    mid = (mid + Math.imul(al7, bh4)) | 0;
    mid = (mid + Math.imul(ah7, bl4)) | 0;
    hi = (hi + Math.imul(ah7, bh4)) | 0;
    lo = (lo + Math.imul(al6, bl5)) | 0;
    mid = (mid + Math.imul(al6, bh5)) | 0;
    mid = (mid + Math.imul(ah6, bl5)) | 0;
    hi = (hi + Math.imul(ah6, bh5)) | 0;
    lo = (lo + Math.imul(al5, bl6)) | 0;
    mid = (mid + Math.imul(al5, bh6)) | 0;
    mid = (mid + Math.imul(ah5, bl6)) | 0;
    hi = (hi + Math.imul(ah5, bh6)) | 0;
    lo = (lo + Math.imul(al4, bl7)) | 0;
    mid = (mid + Math.imul(al4, bh7)) | 0;
    mid = (mid + Math.imul(ah4, bl7)) | 0;
    hi = (hi + Math.imul(ah4, bh7)) | 0;
    lo = (lo + Math.imul(al3, bl8)) | 0;
    mid = (mid + Math.imul(al3, bh8)) | 0;
    mid = (mid + Math.imul(ah3, bl8)) | 0;
    hi = (hi + Math.imul(ah3, bh8)) | 0;
    lo = (lo + Math.imul(al2, bl9)) | 0;
    mid = (mid + Math.imul(al2, bh9)) | 0;
    mid = (mid + Math.imul(ah2, bl9)) | 0;
    hi = (hi + Math.imul(ah2, bh9)) | 0;
    var w11 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w11 >>> 26)) | 0;
    w11 &= 0x3ffffff;
    /* k = 12 */
    lo = Math.imul(al9, bl3);
    mid = Math.imul(al9, bh3);
    mid = (mid + Math.imul(ah9, bl3)) | 0;
    hi = Math.imul(ah9, bh3);
    lo = (lo + Math.imul(al8, bl4)) | 0;
    mid = (mid + Math.imul(al8, bh4)) | 0;
    mid = (mid + Math.imul(ah8, bl4)) | 0;
    hi = (hi + Math.imul(ah8, bh4)) | 0;
    lo = (lo + Math.imul(al7, bl5)) | 0;
    mid = (mid + Math.imul(al7, bh5)) | 0;
    mid = (mid + Math.imul(ah7, bl5)) | 0;
    hi = (hi + Math.imul(ah7, bh5)) | 0;
    lo = (lo + Math.imul(al6, bl6)) | 0;
    mid = (mid + Math.imul(al6, bh6)) | 0;
    mid = (mid + Math.imul(ah6, bl6)) | 0;
    hi = (hi + Math.imul(ah6, bh6)) | 0;
    lo = (lo + Math.imul(al5, bl7)) | 0;
    mid = (mid + Math.imul(al5, bh7)) | 0;
    mid = (mid + Math.imul(ah5, bl7)) | 0;
    hi = (hi + Math.imul(ah5, bh7)) | 0;
    lo = (lo + Math.imul(al4, bl8)) | 0;
    mid = (mid + Math.imul(al4, bh8)) | 0;
    mid = (mid + Math.imul(ah4, bl8)) | 0;
    hi = (hi + Math.imul(ah4, bh8)) | 0;
    lo = (lo + Math.imul(al3, bl9)) | 0;
    mid = (mid + Math.imul(al3, bh9)) | 0;
    mid = (mid + Math.imul(ah3, bl9)) | 0;
    hi = (hi + Math.imul(ah3, bh9)) | 0;
    var w12 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w12 >>> 26)) | 0;
    w12 &= 0x3ffffff;
    /* k = 13 */
    lo = Math.imul(al9, bl4);
    mid = Math.imul(al9, bh4);
    mid = (mid + Math.imul(ah9, bl4)) | 0;
    hi = Math.imul(ah9, bh4);
    lo = (lo + Math.imul(al8, bl5)) | 0;
    mid = (mid + Math.imul(al8, bh5)) | 0;
    mid = (mid + Math.imul(ah8, bl5)) | 0;
    hi = (hi + Math.imul(ah8, bh5)) | 0;
    lo = (lo + Math.imul(al7, bl6)) | 0;
    mid = (mid + Math.imul(al7, bh6)) | 0;
    mid = (mid + Math.imul(ah7, bl6)) | 0;
    hi = (hi + Math.imul(ah7, bh6)) | 0;
    lo = (lo + Math.imul(al6, bl7)) | 0;
    mid = (mid + Math.imul(al6, bh7)) | 0;
    mid = (mid + Math.imul(ah6, bl7)) | 0;
    hi = (hi + Math.imul(ah6, bh7)) | 0;
    lo = (lo + Math.imul(al5, bl8)) | 0;
    mid = (mid + Math.imul(al5, bh8)) | 0;
    mid = (mid + Math.imul(ah5, bl8)) | 0;
    hi = (hi + Math.imul(ah5, bh8)) | 0;
    lo = (lo + Math.imul(al4, bl9)) | 0;
    mid = (mid + Math.imul(al4, bh9)) | 0;
    mid = (mid + Math.imul(ah4, bl9)) | 0;
    hi = (hi + Math.imul(ah4, bh9)) | 0;
    var w13 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w13 >>> 26)) | 0;
    w13 &= 0x3ffffff;
    /* k = 14 */
    lo = Math.imul(al9, bl5);
    mid = Math.imul(al9, bh5);
    mid = (mid + Math.imul(ah9, bl5)) | 0;
    hi = Math.imul(ah9, bh5);
    lo = (lo + Math.imul(al8, bl6)) | 0;
    mid = (mid + Math.imul(al8, bh6)) | 0;
    mid = (mid + Math.imul(ah8, bl6)) | 0;
    hi = (hi + Math.imul(ah8, bh6)) | 0;
    lo = (lo + Math.imul(al7, bl7)) | 0;
    mid = (mid + Math.imul(al7, bh7)) | 0;
    mid = (mid + Math.imul(ah7, bl7)) | 0;
    hi = (hi + Math.imul(ah7, bh7)) | 0;
    lo = (lo + Math.imul(al6, bl8)) | 0;
    mid = (mid + Math.imul(al6, bh8)) | 0;
    mid = (mid + Math.imul(ah6, bl8)) | 0;
    hi = (hi + Math.imul(ah6, bh8)) | 0;
    lo = (lo + Math.imul(al5, bl9)) | 0;
    mid = (mid + Math.imul(al5, bh9)) | 0;
    mid = (mid + Math.imul(ah5, bl9)) | 0;
    hi = (hi + Math.imul(ah5, bh9)) | 0;
    var w14 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w14 >>> 26)) | 0;
    w14 &= 0x3ffffff;
    /* k = 15 */
    lo = Math.imul(al9, bl6);
    mid = Math.imul(al9, bh6);
    mid = (mid + Math.imul(ah9, bl6)) | 0;
    hi = Math.imul(ah9, bh6);
    lo = (lo + Math.imul(al8, bl7)) | 0;
    mid = (mid + Math.imul(al8, bh7)) | 0;
    mid = (mid + Math.imul(ah8, bl7)) | 0;
    hi = (hi + Math.imul(ah8, bh7)) | 0;
    lo = (lo + Math.imul(al7, bl8)) | 0;
    mid = (mid + Math.imul(al7, bh8)) | 0;
    mid = (mid + Math.imul(ah7, bl8)) | 0;
    hi = (hi + Math.imul(ah7, bh8)) | 0;
    lo = (lo + Math.imul(al6, bl9)) | 0;
    mid = (mid + Math.imul(al6, bh9)) | 0;
    mid = (mid + Math.imul(ah6, bl9)) | 0;
    hi = (hi + Math.imul(ah6, bh9)) | 0;
    var w15 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w15 >>> 26)) | 0;
    w15 &= 0x3ffffff;
    /* k = 16 */
    lo = Math.imul(al9, bl7);
    mid = Math.imul(al9, bh7);
    mid = (mid + Math.imul(ah9, bl7)) | 0;
    hi = Math.imul(ah9, bh7);
    lo = (lo + Math.imul(al8, bl8)) | 0;
    mid = (mid + Math.imul(al8, bh8)) | 0;
    mid = (mid + Math.imul(ah8, bl8)) | 0;
    hi = (hi + Math.imul(ah8, bh8)) | 0;
    lo = (lo + Math.imul(al7, bl9)) | 0;
    mid = (mid + Math.imul(al7, bh9)) | 0;
    mid = (mid + Math.imul(ah7, bl9)) | 0;
    hi = (hi + Math.imul(ah7, bh9)) | 0;
    var w16 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w16 >>> 26)) | 0;
    w16 &= 0x3ffffff;
    /* k = 17 */
    lo = Math.imul(al9, bl8);
    mid = Math.imul(al9, bh8);
    mid = (mid + Math.imul(ah9, bl8)) | 0;
    hi = Math.imul(ah9, bh8);
    lo = (lo + Math.imul(al8, bl9)) | 0;
    mid = (mid + Math.imul(al8, bh9)) | 0;
    mid = (mid + Math.imul(ah8, bl9)) | 0;
    hi = (hi + Math.imul(ah8, bh9)) | 0;
    var w17 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w17 >>> 26)) | 0;
    w17 &= 0x3ffffff;
    /* k = 18 */
    lo = Math.imul(al9, bl9);
    mid = Math.imul(al9, bh9);
    mid = (mid + Math.imul(ah9, bl9)) | 0;
    hi = Math.imul(ah9, bh9);
    var w18 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w18 >>> 26)) | 0;
    w18 &= 0x3ffffff;
    o[0] = w0;
    o[1] = w1;
    o[2] = w2;
    o[3] = w3;
    o[4] = w4;
    o[5] = w5;
    o[6] = w6;
    o[7] = w7;
    o[8] = w8;
    o[9] = w9;
    o[10] = w10;
    o[11] = w11;
    o[12] = w12;
    o[13] = w13;
    o[14] = w14;
    o[15] = w15;
    o[16] = w16;
    o[17] = w17;
    o[18] = w18;
    if (c !== 0) {
      o[19] = c;
      out.length++;
    }
    return out;
  };

  // Polyfill comb
  if (!Math.imul) {
    comb10MulTo = smallMulTo;
  }

  function bigMulTo (self, num, out) {
    out.negative = num.negative ^ self.negative;
    out.length = self.length + num.length;

    var carry = 0;
    var hncarry = 0;
    for (var k = 0; k < out.length - 1; k++) {
      // Sum all words with the same `i + j = k` and accumulate `ncarry`,
      // note that ncarry could be >= 0x3ffffff
      var ncarry = hncarry;
      hncarry = 0;
      var rword = carry & 0x3ffffff;
      var maxJ = Math.min(k, num.length - 1);
      for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
        var i = k - j;
        var a = self.words[i] | 0;
        var b = num.words[j] | 0;
        var r = a * b;

        var lo = r & 0x3ffffff;
        ncarry = (ncarry + ((r / 0x4000000) | 0)) | 0;
        lo = (lo + rword) | 0;
        rword = lo & 0x3ffffff;
        ncarry = (ncarry + (lo >>> 26)) | 0;

        hncarry += ncarry >>> 26;
        ncarry &= 0x3ffffff;
      }
      out.words[k] = rword;
      carry = ncarry;
      ncarry = hncarry;
    }
    if (carry !== 0) {
      out.words[k] = carry;
    } else {
      out.length--;
    }

    return out._strip();
  }

  function jumboMulTo (self, num, out) {
    // Temporary disable, see https://github.com/indutny/bn.js/issues/211
    // var fftm = new FFTM();
    // return fftm.mulp(self, num, out);
    return bigMulTo(self, num, out);
  }

  BN.prototype.mulTo = function mulTo (num, out) {
    var res;
    var len = this.length + num.length;
    if (this.length === 10 && num.length === 10) {
      res = comb10MulTo(this, num, out);
    } else if (len < 63) {
      res = smallMulTo(this, num, out);
    } else if (len < 1024) {
      res = bigMulTo(this, num, out);
    } else {
      res = jumboMulTo(this, num, out);
    }

    return res;
  };

  // Cooley-Tukey algorithm for FFT
  // slightly revisited to rely on looping instead of recursion

  function FFTM (x, y) {
    this.x = x;
    this.y = y;
  }

  FFTM.prototype.makeRBT = function makeRBT (N) {
    var t = new Array(N);
    var l = BN.prototype._countBits(N) - 1;
    for (var i = 0; i < N; i++) {
      t[i] = this.revBin(i, l, N);
    }

    return t;
  };

  // Returns binary-reversed representation of `x`
  FFTM.prototype.revBin = function revBin (x, l, N) {
    if (x === 0 || x === N - 1) return x;

    var rb = 0;
    for (var i = 0; i < l; i++) {
      rb |= (x & 1) << (l - i - 1);
      x >>= 1;
    }

    return rb;
  };

  // Performs "tweedling" phase, therefore 'emulating'
  // behaviour of the recursive algorithm
  FFTM.prototype.permute = function permute (rbt, rws, iws, rtws, itws, N) {
    for (var i = 0; i < N; i++) {
      rtws[i] = rws[rbt[i]];
      itws[i] = iws[rbt[i]];
    }
  };

  FFTM.prototype.transform = function transform (rws, iws, rtws, itws, N, rbt) {
    this.permute(rbt, rws, iws, rtws, itws, N);

    for (var s = 1; s < N; s <<= 1) {
      var l = s << 1;

      var rtwdf = Math.cos(2 * Math.PI / l);
      var itwdf = Math.sin(2 * Math.PI / l);

      for (var p = 0; p < N; p += l) {
        var rtwdf_ = rtwdf;
        var itwdf_ = itwdf;

        for (var j = 0; j < s; j++) {
          var re = rtws[p + j];
          var ie = itws[p + j];

          var ro = rtws[p + j + s];
          var io = itws[p + j + s];

          var rx = rtwdf_ * ro - itwdf_ * io;

          io = rtwdf_ * io + itwdf_ * ro;
          ro = rx;

          rtws[p + j] = re + ro;
          itws[p + j] = ie + io;

          rtws[p + j + s] = re - ro;
          itws[p + j + s] = ie - io;

          /* jshint maxdepth : false */
          if (j !== l) {
            rx = rtwdf * rtwdf_ - itwdf * itwdf_;

            itwdf_ = rtwdf * itwdf_ + itwdf * rtwdf_;
            rtwdf_ = rx;
          }
        }
      }
    }
  };

  FFTM.prototype.guessLen13b = function guessLen13b (n, m) {
    var N = Math.max(m, n) | 1;
    var odd = N & 1;
    var i = 0;
    for (N = N / 2 | 0; N; N = N >>> 1) {
      i++;
    }

    return 1 << i + 1 + odd;
  };

  FFTM.prototype.conjugate = function conjugate (rws, iws, N) {
    if (N <= 1) return;

    for (var i = 0; i < N / 2; i++) {
      var t = rws[i];

      rws[i] = rws[N - i - 1];
      rws[N - i - 1] = t;

      t = iws[i];

      iws[i] = -iws[N - i - 1];
      iws[N - i - 1] = -t;
    }
  };

  FFTM.prototype.normalize13b = function normalize13b (ws, N) {
    var carry = 0;
    for (var i = 0; i < N / 2; i++) {
      var w = Math.round(ws[2 * i + 1] / N) * 0x2000 +
        Math.round(ws[2 * i] / N) +
        carry;

      ws[i] = w & 0x3ffffff;

      if (w < 0x4000000) {
        carry = 0;
      } else {
        carry = w / 0x4000000 | 0;
      }
    }

    return ws;
  };

  FFTM.prototype.convert13b = function convert13b (ws, len, rws, N) {
    var carry = 0;
    for (var i = 0; i < len; i++) {
      carry = carry + (ws[i] | 0);

      rws[2 * i] = carry & 0x1fff; carry = carry >>> 13;
      rws[2 * i + 1] = carry & 0x1fff; carry = carry >>> 13;
    }

    // Pad with zeroes
    for (i = 2 * len; i < N; ++i) {
      rws[i] = 0;
    }

    assert(carry === 0);
    assert((carry & ~0x1fff) === 0);
  };

  FFTM.prototype.stub = function stub (N) {
    var ph = new Array(N);
    for (var i = 0; i < N; i++) {
      ph[i] = 0;
    }

    return ph;
  };

  FFTM.prototype.mulp = function mulp (x, y, out) {
    var N = 2 * this.guessLen13b(x.length, y.length);

    var rbt = this.makeRBT(N);

    var _ = this.stub(N);

    var rws = new Array(N);
    var rwst = new Array(N);
    var iwst = new Array(N);

    var nrws = new Array(N);
    var nrwst = new Array(N);
    var niwst = new Array(N);

    var rmws = out.words;
    rmws.length = N;

    this.convert13b(x.words, x.length, rws, N);
    this.convert13b(y.words, y.length, nrws, N);

    this.transform(rws, _, rwst, iwst, N, rbt);
    this.transform(nrws, _, nrwst, niwst, N, rbt);

    for (var i = 0; i < N; i++) {
      var rx = rwst[i] * nrwst[i] - iwst[i] * niwst[i];
      iwst[i] = rwst[i] * niwst[i] + iwst[i] * nrwst[i];
      rwst[i] = rx;
    }

    this.conjugate(rwst, iwst, N);
    this.transform(rwst, iwst, rmws, _, N, rbt);
    this.conjugate(rmws, _, N);
    this.normalize13b(rmws, N);

    out.negative = x.negative ^ y.negative;
    out.length = x.length + y.length;
    return out._strip();
  };

  // Multiply `this` by `num`
  BN.prototype.mul = function mul (num) {
    var out = new BN(null);
    out.words = new Array(this.length + num.length);
    return this.mulTo(num, out);
  };

  // Multiply employing FFT
  BN.prototype.mulf = function mulf (num) {
    var out = new BN(null);
    out.words = new Array(this.length + num.length);
    return jumboMulTo(this, num, out);
  };

  // In-place Multiplication
  BN.prototype.imul = function imul (num) {
    return this.clone().mulTo(num, this);
  };

  BN.prototype.imuln = function imuln (num) {
    var isNegNum = num < 0;
    if (isNegNum) num = -num;

    assert(typeof num === 'number');
    assert(num < 0x4000000);

    // Carry
    var carry = 0;
    for (var i = 0; i < this.length; i++) {
      var w = (this.words[i] | 0) * num;
      var lo = (w & 0x3ffffff) + (carry & 0x3ffffff);
      carry >>= 26;
      carry += (w / 0x4000000) | 0;
      // NOTE: lo is 27bit maximum
      carry += lo >>> 26;
      this.words[i] = lo & 0x3ffffff;
    }

    if (carry !== 0) {
      this.words[i] = carry;
      this.length++;
    }

    return isNegNum ? this.ineg() : this;
  };

  BN.prototype.muln = function muln (num) {
    return this.clone().imuln(num);
  };

  // `this` * `this`
  BN.prototype.sqr = function sqr () {
    return this.mul(this);
  };

  // `this` * `this` in-place
  BN.prototype.isqr = function isqr () {
    return this.imul(this.clone());
  };

  // Math.pow(`this`, `num`)
  BN.prototype.pow = function pow (num) {
    var w = toBitArray(num);
    if (w.length === 0) return new BN(1);

    // Skip leading zeroes
    var res = this;
    for (var i = 0; i < w.length; i++, res = res.sqr()) {
      if (w[i] !== 0) break;
    }

    if (++i < w.length) {
      for (var q = res.sqr(); i < w.length; i++, q = q.sqr()) {
        if (w[i] === 0) continue;

        res = res.mul(q);
      }
    }

    return res;
  };

  // Shift-left in-place
  BN.prototype.iushln = function iushln (bits) {
    assert(typeof bits === 'number' && bits >= 0);
    var r = bits % 26;
    var s = (bits - r) / 26;
    var carryMask = (0x3ffffff >>> (26 - r)) << (26 - r);
    var i;

    if (r !== 0) {
      var carry = 0;

      for (i = 0; i < this.length; i++) {
        var newCarry = this.words[i] & carryMask;
        var c = ((this.words[i] | 0) - newCarry) << r;
        this.words[i] = c | carry;
        carry = newCarry >>> (26 - r);
      }

      if (carry) {
        this.words[i] = carry;
        this.length++;
      }
    }

    if (s !== 0) {
      for (i = this.length - 1; i >= 0; i--) {
        this.words[i + s] = this.words[i];
      }

      for (i = 0; i < s; i++) {
        this.words[i] = 0;
      }

      this.length += s;
    }

    return this._strip();
  };

  BN.prototype.ishln = function ishln (bits) {
    // TODO(indutny): implement me
    assert(this.negative === 0);
    return this.iushln(bits);
  };

  // Shift-right in-place
  // NOTE: `hint` is a lowest bit before trailing zeroes
  // NOTE: if `extended` is present - it will be filled with destroyed bits
  BN.prototype.iushrn = function iushrn (bits, hint, extended) {
    assert(typeof bits === 'number' && bits >= 0);
    var h;
    if (hint) {
      h = (hint - (hint % 26)) / 26;
    } else {
      h = 0;
    }

    var r = bits % 26;
    var s = Math.min((bits - r) / 26, this.length);
    var mask = 0x3ffffff ^ ((0x3ffffff >>> r) << r);
    var maskedWords = extended;

    h -= s;
    h = Math.max(0, h);

    // Extended mode, copy masked part
    if (maskedWords) {
      for (var i = 0; i < s; i++) {
        maskedWords.words[i] = this.words[i];
      }
      maskedWords.length = s;
    }

    if (s === 0) {
      // No-op, we should not move anything at all
    } else if (this.length > s) {
      this.length -= s;
      for (i = 0; i < this.length; i++) {
        this.words[i] = this.words[i + s];
      }
    } else {
      this.words[0] = 0;
      this.length = 1;
    }

    var carry = 0;
    for (i = this.length - 1; i >= 0 && (carry !== 0 || i >= h); i--) {
      var word = this.words[i] | 0;
      this.words[i] = (carry << (26 - r)) | (word >>> r);
      carry = word & mask;
    }

    // Push carried bits as a mask
    if (maskedWords && carry !== 0) {
      maskedWords.words[maskedWords.length++] = carry;
    }

    if (this.length === 0) {
      this.words[0] = 0;
      this.length = 1;
    }

    return this._strip();
  };

  BN.prototype.ishrn = function ishrn (bits, hint, extended) {
    // TODO(indutny): implement me
    assert(this.negative === 0);
    return this.iushrn(bits, hint, extended);
  };

  // Shift-left
  BN.prototype.shln = function shln (bits) {
    return this.clone().ishln(bits);
  };

  BN.prototype.ushln = function ushln (bits) {
    return this.clone().iushln(bits);
  };

  // Shift-right
  BN.prototype.shrn = function shrn (bits) {
    return this.clone().ishrn(bits);
  };

  BN.prototype.ushrn = function ushrn (bits) {
    return this.clone().iushrn(bits);
  };

  // Test if n bit is set
  BN.prototype.testn = function testn (bit) {
    assert(typeof bit === 'number' && bit >= 0);
    var r = bit % 26;
    var s = (bit - r) / 26;
    var q = 1 << r;

    // Fast case: bit is much higher than all existing words
    if (this.length <= s) return false;

    // Check bit and return
    var w = this.words[s];

    return !!(w & q);
  };

  // Return only lowers bits of number (in-place)
  BN.prototype.imaskn = function imaskn (bits) {
    assert(typeof bits === 'number' && bits >= 0);
    var r = bits % 26;
    var s = (bits - r) / 26;

    assert(this.negative === 0, 'imaskn works only with positive numbers');

    if (this.length <= s) {
      return this;
    }

    if (r !== 0) {
      s++;
    }
    this.length = Math.min(s, this.length);

    if (r !== 0) {
      var mask = 0x3ffffff ^ ((0x3ffffff >>> r) << r);
      this.words[this.length - 1] &= mask;
    }

    return this._strip();
  };

  // Return only lowers bits of number
  BN.prototype.maskn = function maskn (bits) {
    return this.clone().imaskn(bits);
  };

  // Add plain number `num` to `this`
  BN.prototype.iaddn = function iaddn (num) {
    assert(typeof num === 'number');
    assert(num < 0x4000000);
    if (num < 0) return this.isubn(-num);

    // Possible sign change
    if (this.negative !== 0) {
      if (this.length === 1 && (this.words[0] | 0) <= num) {
        this.words[0] = num - (this.words[0] | 0);
        this.negative = 0;
        return this;
      }

      this.negative = 0;
      this.isubn(num);
      this.negative = 1;
      return this;
    }

    // Add without checks
    return this._iaddn(num);
  };

  BN.prototype._iaddn = function _iaddn (num) {
    this.words[0] += num;

    // Carry
    for (var i = 0; i < this.length && this.words[i] >= 0x4000000; i++) {
      this.words[i] -= 0x4000000;
      if (i === this.length - 1) {
        this.words[i + 1] = 1;
      } else {
        this.words[i + 1]++;
      }
    }
    this.length = Math.max(this.length, i + 1);

    return this;
  };

  // Subtract plain number `num` from `this`
  BN.prototype.isubn = function isubn (num) {
    assert(typeof num === 'number');
    assert(num < 0x4000000);
    if (num < 0) return this.iaddn(-num);

    if (this.negative !== 0) {
      this.negative = 0;
      this.iaddn(num);
      this.negative = 1;
      return this;
    }

    this.words[0] -= num;

    if (this.length === 1 && this.words[0] < 0) {
      this.words[0] = -this.words[0];
      this.negative = 1;
    } else {
      // Carry
      for (var i = 0; i < this.length && this.words[i] < 0; i++) {
        this.words[i] += 0x4000000;
        this.words[i + 1] -= 1;
      }
    }

    return this._strip();
  };

  BN.prototype.addn = function addn (num) {
    return this.clone().iaddn(num);
  };

  BN.prototype.subn = function subn (num) {
    return this.clone().isubn(num);
  };

  BN.prototype.iabs = function iabs () {
    this.negative = 0;

    return this;
  };

  BN.prototype.abs = function abs () {
    return this.clone().iabs();
  };

  BN.prototype._ishlnsubmul = function _ishlnsubmul (num, mul, shift) {
    var len = num.length + shift;
    var i;

    this._expand(len);

    var w;
    var carry = 0;
    for (i = 0; i < num.length; i++) {
      w = (this.words[i + shift] | 0) + carry;
      var right = (num.words[i] | 0) * mul;
      w -= right & 0x3ffffff;
      carry = (w >> 26) - ((right / 0x4000000) | 0);
      this.words[i + shift] = w & 0x3ffffff;
    }
    for (; i < this.length - shift; i++) {
      w = (this.words[i + shift] | 0) + carry;
      carry = w >> 26;
      this.words[i + shift] = w & 0x3ffffff;
    }

    if (carry === 0) return this._strip();

    // Subtraction overflow
    assert(carry === -1);
    carry = 0;
    for (i = 0; i < this.length; i++) {
      w = -(this.words[i] | 0) + carry;
      carry = w >> 26;
      this.words[i] = w & 0x3ffffff;
    }
    this.negative = 1;

    return this._strip();
  };

  BN.prototype._wordDiv = function _wordDiv (num, mode) {
    var shift = this.length - num.length;

    var a = this.clone();
    var b = num;

    // Normalize
    var bhi = b.words[b.length - 1] | 0;
    var bhiBits = this._countBits(bhi);
    shift = 26 - bhiBits;
    if (shift !== 0) {
      b = b.ushln(shift);
      a.iushln(shift);
      bhi = b.words[b.length - 1] | 0;
    }

    // Initialize quotient
    var m = a.length - b.length;
    var q;

    if (mode !== 'mod') {
      q = new BN(null);
      q.length = m + 1;
      q.words = new Array(q.length);
      for (var i = 0; i < q.length; i++) {
        q.words[i] = 0;
      }
    }

    var diff = a.clone()._ishlnsubmul(b, 1, m);
    if (diff.negative === 0) {
      a = diff;
      if (q) {
        q.words[m] = 1;
      }
    }

    for (var j = m - 1; j >= 0; j--) {
      var qj = (a.words[b.length + j] | 0) * 0x4000000 +
        (a.words[b.length + j - 1] | 0);

      // NOTE: (qj / bhi) is (0x3ffffff * 0x4000000 + 0x3ffffff) / 0x2000000 max
      // (0x7ffffff)
      qj = Math.min((qj / bhi) | 0, 0x3ffffff);

      a._ishlnsubmul(b, qj, j);
      while (a.negative !== 0) {
        qj--;
        a.negative = 0;
        a._ishlnsubmul(b, 1, j);
        if (!a.isZero()) {
          a.negative ^= 1;
        }
      }
      if (q) {
        q.words[j] = qj;
      }
    }
    if (q) {
      q._strip();
    }
    a._strip();

    // Denormalize
    if (mode !== 'div' && shift !== 0) {
      a.iushrn(shift);
    }

    return {
      div: q || null,
      mod: a
    };
  };

  // NOTE: 1) `mode` can be set to `mod` to request mod only,
  //       to `div` to request div only, or be absent to
  //       request both div & mod
  //       2) `positive` is true if unsigned mod is requested
  BN.prototype.divmod = function divmod (num, mode, positive) {
    assert(!num.isZero());

    if (this.isZero()) {
      return {
        div: new BN(0),
        mod: new BN(0)
      };
    }

    var div, mod, res;
    if (this.negative !== 0 && num.negative === 0) {
      res = this.neg().divmod(num, mode);

      if (mode !== 'mod') {
        div = res.div.neg();
      }

      if (mode !== 'div') {
        mod = res.mod.neg();
        if (positive && mod.negative !== 0) {
          mod.iadd(num);
        }
      }

      return {
        div: div,
        mod: mod
      };
    }

    if (this.negative === 0 && num.negative !== 0) {
      res = this.divmod(num.neg(), mode);

      if (mode !== 'mod') {
        div = res.div.neg();
      }

      return {
        div: div,
        mod: res.mod
      };
    }

    if ((this.negative & num.negative) !== 0) {
      res = this.neg().divmod(num.neg(), mode);

      if (mode !== 'div') {
        mod = res.mod.neg();
        if (positive && mod.negative !== 0) {
          mod.isub(num);
        }
      }

      return {
        div: res.div,
        mod: mod
      };
    }

    // Both numbers are positive at this point

    // Strip both numbers to approximate shift value
    if (num.length > this.length || this.cmp(num) < 0) {
      return {
        div: new BN(0),
        mod: this
      };
    }

    // Very short reduction
    if (num.length === 1) {
      if (mode === 'div') {
        return {
          div: this.divn(num.words[0]),
          mod: null
        };
      }

      if (mode === 'mod') {
        return {
          div: null,
          mod: new BN(this.modrn(num.words[0]))
        };
      }

      return {
        div: this.divn(num.words[0]),
        mod: new BN(this.modrn(num.words[0]))
      };
    }

    return this._wordDiv(num, mode);
  };

  // Find `this` / `num`
  BN.prototype.div = function div (num) {
    return this.divmod(num, 'div', false).div;
  };

  // Find `this` % `num`
  BN.prototype.mod = function mod (num) {
    return this.divmod(num, 'mod', false).mod;
  };

  BN.prototype.umod = function umod (num) {
    return this.divmod(num, 'mod', true).mod;
  };

  // Find Round(`this` / `num`)
  BN.prototype.divRound = function divRound (num) {
    var dm = this.divmod(num);

    // Fast case - exact division
    if (dm.mod.isZero()) return dm.div;

    var mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;

    var half = num.ushrn(1);
    var r2 = num.andln(1);
    var cmp = mod.cmp(half);

    // Round down
    if (cmp < 0 || (r2 === 1 && cmp === 0)) return dm.div;

    // Round up
    return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
  };

  BN.prototype.modrn = function modrn (num) {
    var isNegNum = num < 0;
    if (isNegNum) num = -num;

    assert(num <= 0x3ffffff);
    var p = (1 << 26) % num;

    var acc = 0;
    for (var i = this.length - 1; i >= 0; i--) {
      acc = (p * acc + (this.words[i] | 0)) % num;
    }

    return isNegNum ? -acc : acc;
  };

  // WARNING: DEPRECATED
  BN.prototype.modn = function modn (num) {
    return this.modrn(num);
  };

  // In-place division by number
  BN.prototype.idivn = function idivn (num) {
    var isNegNum = num < 0;
    if (isNegNum) num = -num;

    assert(num <= 0x3ffffff);

    var carry = 0;
    for (var i = this.length - 1; i >= 0; i--) {
      var w = (this.words[i] | 0) + carry * 0x4000000;
      this.words[i] = (w / num) | 0;
      carry = w % num;
    }

    this._strip();
    return isNegNum ? this.ineg() : this;
  };

  BN.prototype.divn = function divn (num) {
    return this.clone().idivn(num);
  };

  BN.prototype.egcd = function egcd (p) {
    assert(p.negative === 0);
    assert(!p.isZero());

    var x = this;
    var y = p.clone();

    if (x.negative !== 0) {
      x = x.umod(p);
    } else {
      x = x.clone();
    }

    // A * x + B * y = x
    var A = new BN(1);
    var B = new BN(0);

    // C * x + D * y = y
    var C = new BN(0);
    var D = new BN(1);

    var g = 0;

    while (x.isEven() && y.isEven()) {
      x.iushrn(1);
      y.iushrn(1);
      ++g;
    }

    var yp = y.clone();
    var xp = x.clone();

    while (!x.isZero()) {
      for (var i = 0, im = 1; (x.words[0] & im) === 0 && i < 26; ++i, im <<= 1);
      if (i > 0) {
        x.iushrn(i);
        while (i-- > 0) {
          if (A.isOdd() || B.isOdd()) {
            A.iadd(yp);
            B.isub(xp);
          }

          A.iushrn(1);
          B.iushrn(1);
        }
      }

      for (var j = 0, jm = 1; (y.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1);
      if (j > 0) {
        y.iushrn(j);
        while (j-- > 0) {
          if (C.isOdd() || D.isOdd()) {
            C.iadd(yp);
            D.isub(xp);
          }

          C.iushrn(1);
          D.iushrn(1);
        }
      }

      if (x.cmp(y) >= 0) {
        x.isub(y);
        A.isub(C);
        B.isub(D);
      } else {
        y.isub(x);
        C.isub(A);
        D.isub(B);
      }
    }

    return {
      a: C,
      b: D,
      gcd: y.iushln(g)
    };
  };

  // This is reduced incarnation of the binary EEA
  // above, designated to invert members of the
  // _prime_ fields F(p) at a maximal speed
  BN.prototype._invmp = function _invmp (p) {
    assert(p.negative === 0);
    assert(!p.isZero());

    var a = this;
    var b = p.clone();

    if (a.negative !== 0) {
      a = a.umod(p);
    } else {
      a = a.clone();
    }

    var x1 = new BN(1);
    var x2 = new BN(0);

    var delta = b.clone();

    while (a.cmpn(1) > 0 && b.cmpn(1) > 0) {
      for (var i = 0, im = 1; (a.words[0] & im) === 0 && i < 26; ++i, im <<= 1);
      if (i > 0) {
        a.iushrn(i);
        while (i-- > 0) {
          if (x1.isOdd()) {
            x1.iadd(delta);
          }

          x1.iushrn(1);
        }
      }

      for (var j = 0, jm = 1; (b.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1);
      if (j > 0) {
        b.iushrn(j);
        while (j-- > 0) {
          if (x2.isOdd()) {
            x2.iadd(delta);
          }

          x2.iushrn(1);
        }
      }

      if (a.cmp(b) >= 0) {
        a.isub(b);
        x1.isub(x2);
      } else {
        b.isub(a);
        x2.isub(x1);
      }
    }

    var res;
    if (a.cmpn(1) === 0) {
      res = x1;
    } else {
      res = x2;
    }

    if (res.cmpn(0) < 0) {
      res.iadd(p);
    }

    return res;
  };

  BN.prototype.gcd = function gcd (num) {
    if (this.isZero()) return num.abs();
    if (num.isZero()) return this.abs();

    var a = this.clone();
    var b = num.clone();
    a.negative = 0;
    b.negative = 0;

    // Remove common factor of two
    for (var shift = 0; a.isEven() && b.isEven(); shift++) {
      a.iushrn(1);
      b.iushrn(1);
    }

    do {
      while (a.isEven()) {
        a.iushrn(1);
      }
      while (b.isEven()) {
        b.iushrn(1);
      }

      var r = a.cmp(b);
      if (r < 0) {
        // Swap `a` and `b` to make `a` always bigger than `b`
        var t = a;
        a = b;
        b = t;
      } else if (r === 0 || b.cmpn(1) === 0) {
        break;
      }

      a.isub(b);
    } while (true);

    return b.iushln(shift);
  };

  // Invert number in the field F(num)
  BN.prototype.invm = function invm (num) {
    return this.egcd(num).a.umod(num);
  };

  BN.prototype.isEven = function isEven () {
    return (this.words[0] & 1) === 0;
  };

  BN.prototype.isOdd = function isOdd () {
    return (this.words[0] & 1) === 1;
  };

  // And first word and num
  BN.prototype.andln = function andln (num) {
    return this.words[0] & num;
  };

  // Increment at the bit position in-line
  BN.prototype.bincn = function bincn (bit) {
    assert(typeof bit === 'number');
    var r = bit % 26;
    var s = (bit - r) / 26;
    var q = 1 << r;

    // Fast case: bit is much higher than all existing words
    if (this.length <= s) {
      this._expand(s + 1);
      this.words[s] |= q;
      return this;
    }

    // Add bit and propagate, if needed
    var carry = q;
    for (var i = s; carry !== 0 && i < this.length; i++) {
      var w = this.words[i] | 0;
      w += carry;
      carry = w >>> 26;
      w &= 0x3ffffff;
      this.words[i] = w;
    }
    if (carry !== 0) {
      this.words[i] = carry;
      this.length++;
    }
    return this;
  };

  BN.prototype.isZero = function isZero () {
    return this.length === 1 && this.words[0] === 0;
  };

  BN.prototype.cmpn = function cmpn (num) {
    var negative = num < 0;

    if (this.negative !== 0 && !negative) return -1;
    if (this.negative === 0 && negative) return 1;

    this._strip();

    var res;
    if (this.length > 1) {
      res = 1;
    } else {
      if (negative) {
        num = -num;
      }

      assert(num <= 0x3ffffff, 'Number is too big');

      var w = this.words[0] | 0;
      res = w === num ? 0 : w < num ? -1 : 1;
    }
    if (this.negative !== 0) return -res | 0;
    return res;
  };

  // Compare two numbers and return:
  // 1 - if `this` > `num`
  // 0 - if `this` == `num`
  // -1 - if `this` < `num`
  BN.prototype.cmp = function cmp (num) {
    if (this.negative !== 0 && num.negative === 0) return -1;
    if (this.negative === 0 && num.negative !== 0) return 1;

    var res = this.ucmp(num);
    if (this.negative !== 0) return -res | 0;
    return res;
  };

  // Unsigned comparison
  BN.prototype.ucmp = function ucmp (num) {
    // At this point both numbers have the same sign
    if (this.length > num.length) return 1;
    if (this.length < num.length) return -1;

    var res = 0;
    for (var i = this.length - 1; i >= 0; i--) {
      var a = this.words[i] | 0;
      var b = num.words[i] | 0;

      if (a === b) continue;
      if (a < b) {
        res = -1;
      } else if (a > b) {
        res = 1;
      }
      break;
    }
    return res;
  };

  BN.prototype.gtn = function gtn (num) {
    return this.cmpn(num) === 1;
  };

  BN.prototype.gt = function gt (num) {
    return this.cmp(num) === 1;
  };

  BN.prototype.gten = function gten (num) {
    return this.cmpn(num) >= 0;
  };

  BN.prototype.gte = function gte (num) {
    return this.cmp(num) >= 0;
  };

  BN.prototype.ltn = function ltn (num) {
    return this.cmpn(num) === -1;
  };

  BN.prototype.lt = function lt (num) {
    return this.cmp(num) === -1;
  };

  BN.prototype.lten = function lten (num) {
    return this.cmpn(num) <= 0;
  };

  BN.prototype.lte = function lte (num) {
    return this.cmp(num) <= 0;
  };

  BN.prototype.eqn = function eqn (num) {
    return this.cmpn(num) === 0;
  };

  BN.prototype.eq = function eq (num) {
    return this.cmp(num) === 0;
  };

  //
  // A reduce context, could be using montgomery or something better, depending
  // on the `m` itself.
  //
  BN.red = function red (num) {
    return new Red(num);
  };

  BN.prototype.toRed = function toRed (ctx) {
    assert(!this.red, 'Already a number in reduction context');
    assert(this.negative === 0, 'red works only with positives');
    return ctx.convertTo(this)._forceRed(ctx);
  };

  BN.prototype.fromRed = function fromRed () {
    assert(this.red, 'fromRed works only with numbers in reduction context');
    return this.red.convertFrom(this);
  };

  BN.prototype._forceRed = function _forceRed (ctx) {
    this.red = ctx;
    return this;
  };

  BN.prototype.forceRed = function forceRed (ctx) {
    assert(!this.red, 'Already a number in reduction context');
    return this._forceRed(ctx);
  };

  BN.prototype.redAdd = function redAdd (num) {
    assert(this.red, 'redAdd works only with red numbers');
    return this.red.add(this, num);
  };

  BN.prototype.redIAdd = function redIAdd (num) {
    assert(this.red, 'redIAdd works only with red numbers');
    return this.red.iadd(this, num);
  };

  BN.prototype.redSub = function redSub (num) {
    assert(this.red, 'redSub works only with red numbers');
    return this.red.sub(this, num);
  };

  BN.prototype.redISub = function redISub (num) {
    assert(this.red, 'redISub works only with red numbers');
    return this.red.isub(this, num);
  };

  BN.prototype.redShl = function redShl (num) {
    assert(this.red, 'redShl works only with red numbers');
    return this.red.shl(this, num);
  };

  BN.prototype.redMul = function redMul (num) {
    assert(this.red, 'redMul works only with red numbers');
    this.red._verify2(this, num);
    return this.red.mul(this, num);
  };

  BN.prototype.redIMul = function redIMul (num) {
    assert(this.red, 'redMul works only with red numbers');
    this.red._verify2(this, num);
    return this.red.imul(this, num);
  };

  BN.prototype.redSqr = function redSqr () {
    assert(this.red, 'redSqr works only with red numbers');
    this.red._verify1(this);
    return this.red.sqr(this);
  };

  BN.prototype.redISqr = function redISqr () {
    assert(this.red, 'redISqr works only with red numbers');
    this.red._verify1(this);
    return this.red.isqr(this);
  };

  // Square root over p
  BN.prototype.redSqrt = function redSqrt () {
    assert(this.red, 'redSqrt works only with red numbers');
    this.red._verify1(this);
    return this.red.sqrt(this);
  };

  BN.prototype.redInvm = function redInvm () {
    assert(this.red, 'redInvm works only with red numbers');
    this.red._verify1(this);
    return this.red.invm(this);
  };

  // Return negative clone of `this` % `red modulo`
  BN.prototype.redNeg = function redNeg () {
    assert(this.red, 'redNeg works only with red numbers');
    this.red._verify1(this);
    return this.red.neg(this);
  };

  BN.prototype.redPow = function redPow (num) {
    assert(this.red && !num.red, 'redPow(normalNum)');
    this.red._verify1(this);
    return this.red.pow(this, num);
  };

  // Prime numbers with efficient reduction
  var primes = {
    k256: null,
    p224: null,
    p192: null,
    p25519: null
  };

  // Pseudo-Mersenne prime
  function MPrime (name, p) {
    // P = 2 ^ N - K
    this.name = name;
    this.p = new BN(p, 16);
    this.n = this.p.bitLength();
    this.k = new BN(1).iushln(this.n).isub(this.p);

    this.tmp = this._tmp();
  }

  MPrime.prototype._tmp = function _tmp () {
    var tmp = new BN(null);
    tmp.words = new Array(Math.ceil(this.n / 13));
    return tmp;
  };

  MPrime.prototype.ireduce = function ireduce (num) {
    // Assumes that `num` is less than `P^2`
    // num = HI * (2 ^ N - K) + HI * K + LO = HI * K + LO (mod P)
    var r = num;
    var rlen;

    do {
      this.split(r, this.tmp);
      r = this.imulK(r);
      r = r.iadd(this.tmp);
      rlen = r.bitLength();
    } while (rlen > this.n);

    var cmp = rlen < this.n ? -1 : r.ucmp(this.p);
    if (cmp === 0) {
      r.words[0] = 0;
      r.length = 1;
    } else if (cmp > 0) {
      r.isub(this.p);
    } else {
      if (r.strip !== undefined) {
        // r is a BN v4 instance
        r.strip();
      } else {
        // r is a BN v5 instance
        r._strip();
      }
    }

    return r;
  };

  MPrime.prototype.split = function split (input, out) {
    input.iushrn(this.n, 0, out);
  };

  MPrime.prototype.imulK = function imulK (num) {
    return num.imul(this.k);
  };

  function K256 () {
    MPrime.call(
      this,
      'k256',
      'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f');
  }
  inherits(K256, MPrime);

  K256.prototype.split = function split (input, output) {
    // 256 = 9 * 26 + 22
    var mask = 0x3fffff;

    var outLen = Math.min(input.length, 9);
    for (var i = 0; i < outLen; i++) {
      output.words[i] = input.words[i];
    }
    output.length = outLen;

    if (input.length <= 9) {
      input.words[0] = 0;
      input.length = 1;
      return;
    }

    // Shift by 9 limbs
    var prev = input.words[9];
    output.words[output.length++] = prev & mask;

    for (i = 10; i < input.length; i++) {
      var next = input.words[i] | 0;
      input.words[i - 10] = ((next & mask) << 4) | (prev >>> 22);
      prev = next;
    }
    prev >>>= 22;
    input.words[i - 10] = prev;
    if (prev === 0 && input.length > 10) {
      input.length -= 10;
    } else {
      input.length -= 9;
    }
  };

  K256.prototype.imulK = function imulK (num) {
    // K = 0x1000003d1 = [ 0x40, 0x3d1 ]
    num.words[num.length] = 0;
    num.words[num.length + 1] = 0;
    num.length += 2;

    // bounded at: 0x40 * 0x3ffffff + 0x3d0 = 0x100000390
    var lo = 0;
    for (var i = 0; i < num.length; i++) {
      var w = num.words[i] | 0;
      lo += w * 0x3d1;
      num.words[i] = lo & 0x3ffffff;
      lo = w * 0x40 + ((lo / 0x4000000) | 0);
    }

    // Fast length reduction
    if (num.words[num.length - 1] === 0) {
      num.length--;
      if (num.words[num.length - 1] === 0) {
        num.length--;
      }
    }
    return num;
  };

  function P224 () {
    MPrime.call(
      this,
      'p224',
      'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001');
  }
  inherits(P224, MPrime);

  function P192 () {
    MPrime.call(
      this,
      'p192',
      'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff');
  }
  inherits(P192, MPrime);

  function P25519 () {
    // 2 ^ 255 - 19
    MPrime.call(
      this,
      '25519',
      '7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed');
  }
  inherits(P25519, MPrime);

  P25519.prototype.imulK = function imulK (num) {
    // K = 0x13
    var carry = 0;
    for (var i = 0; i < num.length; i++) {
      var hi = (num.words[i] | 0) * 0x13 + carry;
      var lo = hi & 0x3ffffff;
      hi >>>= 26;

      num.words[i] = lo;
      carry = hi;
    }
    if (carry !== 0) {
      num.words[num.length++] = carry;
    }
    return num;
  };

  // Exported mostly for testing purposes, use plain name instead
  BN._prime = function prime (name) {
    // Cached version of prime
    if (primes[name]) return primes[name];

    var prime;
    if (name === 'k256') {
      prime = new K256();
    } else if (name === 'p224') {
      prime = new P224();
    } else if (name === 'p192') {
      prime = new P192();
    } else if (name === 'p25519') {
      prime = new P25519();
    } else {
      throw new Error('Unknown prime ' + name);
    }
    primes[name] = prime;

    return prime;
  };

  //
  // Base reduction engine
  //
  function Red (m) {
    if (typeof m === 'string') {
      var prime = BN._prime(m);
      this.m = prime.p;
      this.prime = prime;
    } else {
      assert(m.gtn(1), 'modulus must be greater than 1');
      this.m = m;
      this.prime = null;
    }
  }

  Red.prototype._verify1 = function _verify1 (a) {
    assert(a.negative === 0, 'red works only with positives');
    assert(a.red, 'red works only with red numbers');
  };

  Red.prototype._verify2 = function _verify2 (a, b) {
    assert((a.negative | b.negative) === 0, 'red works only with positives');
    assert(a.red && a.red === b.red,
      'red works only with red numbers');
  };

  Red.prototype.imod = function imod (a) {
    if (this.prime) return this.prime.ireduce(a)._forceRed(this);

    move(a, a.umod(this.m)._forceRed(this));
    return a;
  };

  Red.prototype.neg = function neg (a) {
    if (a.isZero()) {
      return a.clone();
    }

    return this.m.sub(a)._forceRed(this);
  };

  Red.prototype.add = function add (a, b) {
    this._verify2(a, b);

    var res = a.add(b);
    if (res.cmp(this.m) >= 0) {
      res.isub(this.m);
    }
    return res._forceRed(this);
  };

  Red.prototype.iadd = function iadd (a, b) {
    this._verify2(a, b);

    var res = a.iadd(b);
    if (res.cmp(this.m) >= 0) {
      res.isub(this.m);
    }
    return res;
  };

  Red.prototype.sub = function sub (a, b) {
    this._verify2(a, b);

    var res = a.sub(b);
    if (res.cmpn(0) < 0) {
      res.iadd(this.m);
    }
    return res._forceRed(this);
  };

  Red.prototype.isub = function isub (a, b) {
    this._verify2(a, b);

    var res = a.isub(b);
    if (res.cmpn(0) < 0) {
      res.iadd(this.m);
    }
    return res;
  };

  Red.prototype.shl = function shl (a, num) {
    this._verify1(a);
    return this.imod(a.ushln(num));
  };

  Red.prototype.imul = function imul (a, b) {
    this._verify2(a, b);
    return this.imod(a.imul(b));
  };

  Red.prototype.mul = function mul (a, b) {
    this._verify2(a, b);
    return this.imod(a.mul(b));
  };

  Red.prototype.isqr = function isqr (a) {
    return this.imul(a, a.clone());
  };

  Red.prototype.sqr = function sqr (a) {
    return this.mul(a, a);
  };

  Red.prototype.sqrt = function sqrt (a) {
    if (a.isZero()) return a.clone();

    var mod3 = this.m.andln(3);
    assert(mod3 % 2 === 1);

    // Fast case
    if (mod3 === 3) {
      var pow = this.m.add(new BN(1)).iushrn(2);
      return this.pow(a, pow);
    }

    // Tonelli-Shanks algorithm (Totally unoptimized and slow)
    //
    // Find Q and S, that Q * 2 ^ S = (P - 1)
    var q = this.m.subn(1);
    var s = 0;
    while (!q.isZero() && q.andln(1) === 0) {
      s++;
      q.iushrn(1);
    }
    assert(!q.isZero());

    var one = new BN(1).toRed(this);
    var nOne = one.redNeg();

    // Find quadratic non-residue
    // NOTE: Max is such because of generalized Riemann hypothesis.
    var lpow = this.m.subn(1).iushrn(1);
    var z = this.m.bitLength();
    z = new BN(2 * z * z).toRed(this);

    while (this.pow(z, lpow).cmp(nOne) !== 0) {
      z.redIAdd(nOne);
    }

    var c = this.pow(z, q);
    var r = this.pow(a, q.addn(1).iushrn(1));
    var t = this.pow(a, q);
    var m = s;
    while (t.cmp(one) !== 0) {
      var tmp = t;
      for (var i = 0; tmp.cmp(one) !== 0; i++) {
        tmp = tmp.redSqr();
      }
      assert(i < m);
      var b = this.pow(c, new BN(1).iushln(m - i - 1));

      r = r.redMul(b);
      c = b.redSqr();
      t = t.redMul(c);
      m = i;
    }

    return r;
  };

  Red.prototype.invm = function invm (a) {
    var inv = a._invmp(this.m);
    if (inv.negative !== 0) {
      inv.negative = 0;
      return this.imod(inv).redNeg();
    } else {
      return this.imod(inv);
    }
  };

  Red.prototype.pow = function pow (a, num) {
    if (num.isZero()) return new BN(1).toRed(this);
    if (num.cmpn(1) === 0) return a.clone();

    var windowSize = 4;
    var wnd = new Array(1 << windowSize);
    wnd[0] = new BN(1).toRed(this);
    wnd[1] = a;
    for (var i = 2; i < wnd.length; i++) {
      wnd[i] = this.mul(wnd[i - 1], a);
    }

    var res = wnd[0];
    var current = 0;
    var currentLen = 0;
    var start = num.bitLength() % 26;
    if (start === 0) {
      start = 26;
    }

    for (i = num.length - 1; i >= 0; i--) {
      var word = num.words[i];
      for (var j = start - 1; j >= 0; j--) {
        var bit = (word >> j) & 1;
        if (res !== wnd[0]) {
          res = this.sqr(res);
        }

        if (bit === 0 && current === 0) {
          currentLen = 0;
          continue;
        }

        current <<= 1;
        current |= bit;
        currentLen++;
        if (currentLen !== windowSize && (i !== 0 || j !== 0)) continue;

        res = this.mul(res, wnd[current]);
        currentLen = 0;
        current = 0;
      }
      start = 26;
    }

    return res;
  };

  Red.prototype.convertTo = function convertTo (num) {
    var r = num.umod(this.m);

    return r === num ? r.clone() : r;
  };

  Red.prototype.convertFrom = function convertFrom (num) {
    var res = num.clone();
    res.red = null;
    return res;
  };

  //
  // Montgomery method engine
  //

  BN.mont = function mont (num) {
    return new Mont(num);
  };

  function Mont (m) {
    Red.call(this, m);

    this.shift = this.m.bitLength();
    if (this.shift % 26 !== 0) {
      this.shift += 26 - (this.shift % 26);
    }

    this.r = new BN(1).iushln(this.shift);
    this.r2 = this.imod(this.r.sqr());
    this.rinv = this.r._invmp(this.m);

    this.minv = this.rinv.mul(this.r).isubn(1).div(this.m);
    this.minv = this.minv.umod(this.r);
    this.minv = this.r.sub(this.minv);
  }
  inherits(Mont, Red);

  Mont.prototype.convertTo = function convertTo (num) {
    return this.imod(num.ushln(this.shift));
  };

  Mont.prototype.convertFrom = function convertFrom (num) {
    var r = this.imod(num.mul(this.rinv));
    r.red = null;
    return r;
  };

  Mont.prototype.imul = function imul (a, b) {
    if (a.isZero() || b.isZero()) {
      a.words[0] = 0;
      a.length = 1;
      return a;
    }

    var t = a.imul(b);
    var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
    var u = t.isub(c).iushrn(this.shift);
    var res = u;

    if (u.cmp(this.m) >= 0) {
      res = u.isub(this.m);
    } else if (u.cmpn(0) < 0) {
      res = u.iadd(this.m);
    }

    return res._forceRed(this);
  };

  Mont.prototype.mul = function mul (a, b) {
    if (a.isZero() || b.isZero()) return new BN(0)._forceRed(this);

    var t = a.mul(b);
    var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
    var u = t.isub(c).iushrn(this.shift);
    var res = u;
    if (u.cmp(this.m) >= 0) {
      res = u.isub(this.m);
    } else if (u.cmpn(0) < 0) {
      res = u.iadd(this.m);
    }

    return res._forceRed(this);
  };

  Mont.prototype.invm = function invm (a) {
    // (AR)^-1 * R^2 = (A^-1 * R^-1) * R^2 = A^-1 * R
    var res = this.imod(a._invmp(this.m).mul(this.r2));
    return res._forceRed(this);
  };
})(typeof module === 'undefined' || module, this);

},{"buffer":68}],68:[function(require,module,exports){

},{}],69:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.keccak512 = exports.keccak384 = exports.keccak256 = exports.keccak224 = void 0;
const sha3_1 = require("@noble/hashes/sha3");
const utils_1 = require("./utils");
exports.keccak224 = (0, utils_1.wrapHash)(sha3_1.keccak_224);
exports.keccak256 = (() => {
    const k = (0, utils_1.wrapHash)(sha3_1.keccak_256);
    k.create = sha3_1.keccak_256.create;
    return k;
})();
exports.keccak384 = (0, utils_1.wrapHash)(sha3_1.keccak_384);
exports.keccak512 = (0, utils_1.wrapHash)(sha3_1.keccak_512);

},{"./utils":70,"@noble/hashes/sha3":57}],70:[function(require,module,exports){
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.crypto = exports.wrapHash = exports.equalsBytes = exports.hexToBytes = exports.bytesToUtf8 = exports.utf8ToBytes = exports.createView = exports.concatBytes = exports.toHex = exports.bytesToHex = exports.assertBytes = exports.assertBool = void 0;
// buf.toString('hex') -> toHex(buf)
const _assert_1 = __importDefault(require("@noble/hashes/_assert"));
const utils_1 = require("@noble/hashes/utils");
const assertBool = _assert_1.default.bool;
exports.assertBool = assertBool;
const assertBytes = _assert_1.default.bytes;
exports.assertBytes = assertBytes;
var utils_2 = require("@noble/hashes/utils");
Object.defineProperty(exports, "bytesToHex", { enumerable: true, get: function () { return utils_2.bytesToHex; } });
Object.defineProperty(exports, "toHex", { enumerable: true, get: function () { return utils_2.bytesToHex; } });
Object.defineProperty(exports, "concatBytes", { enumerable: true, get: function () { return utils_2.concatBytes; } });
Object.defineProperty(exports, "createView", { enumerable: true, get: function () { return utils_2.createView; } });
Object.defineProperty(exports, "utf8ToBytes", { enumerable: true, get: function () { return utils_2.utf8ToBytes; } });
// buf.toString('utf8') -> bytesToUtf8(buf)
function bytesToUtf8(data) {
    if (!(data instanceof Uint8Array)) {
        throw new TypeError(`bytesToUtf8 expected Uint8Array, got ${typeof data}`);
    }
    return new TextDecoder().decode(data);
}
exports.bytesToUtf8 = bytesToUtf8;
function hexToBytes(data) {
    const sliced = data.startsWith("0x") ? data.substring(2) : data;
    return (0, utils_1.hexToBytes)(sliced);
}
exports.hexToBytes = hexToBytes;
// buf.equals(buf2) -> equalsBytes(buf, buf2)
function equalsBytes(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}
exports.equalsBytes = equalsBytes;
// Internal utils
function wrapHash(hash) {
    return (msg) => {
        _assert_1.default.bytes(msg);
        return hash(msg);
    };
}
exports.wrapHash = wrapHash;
exports.crypto = (() => {
    const webCrypto = typeof self === "object" && "crypto" in self ? self.crypto : undefined;
    const nodeRequire = typeof module !== "undefined" &&
        typeof module.require === "function" &&
        module.require.bind(module);
    return {
        node: nodeRequire && !webCrypto ? nodeRequire("crypto") : undefined,
        web: webCrypto
    };
})();

},{"@noble/hashes/_assert":54,"@noble/hashes/utils":58}],71:[function(require,module,exports){
(function (process,global){(function (){
/**
 * [js-sha3]{@link https://github.com/emn178/js-sha3}
 *
 * @version 0.8.0
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2015-2018
 * @license MIT
 */
/*jslint bitwise: true */
(function () {
  'use strict';

  var INPUT_ERROR = 'input is invalid type';
  var FINALIZE_ERROR = 'finalize already called';
  var WINDOW = typeof window === 'object';
  var root = WINDOW ? window : {};
  if (root.JS_SHA3_NO_WINDOW) {
    WINDOW = false;
  }
  var WEB_WORKER = !WINDOW && typeof self === 'object';
  var NODE_JS = !root.JS_SHA3_NO_NODE_JS && typeof process === 'object' && process.versions && process.versions.node;
  if (NODE_JS) {
    root = global;
  } else if (WEB_WORKER) {
    root = self;
  }
  var COMMON_JS = !root.JS_SHA3_NO_COMMON_JS && typeof module === 'object' && module.exports;
  var AMD = typeof define === 'function' && define.amd;
  var ARRAY_BUFFER = !root.JS_SHA3_NO_ARRAY_BUFFER && typeof ArrayBuffer !== 'undefined';
  var HEX_CHARS = '0123456789abcdef'.split('');
  var SHAKE_PADDING = [31, 7936, 2031616, 520093696];
  var CSHAKE_PADDING = [4, 1024, 262144, 67108864];
  var KECCAK_PADDING = [1, 256, 65536, 16777216];
  var PADDING = [6, 1536, 393216, 100663296];
  var SHIFT = [0, 8, 16, 24];
  var RC = [1, 0, 32898, 0, 32906, 2147483648, 2147516416, 2147483648, 32907, 0, 2147483649,
    0, 2147516545, 2147483648, 32777, 2147483648, 138, 0, 136, 0, 2147516425, 0,
    2147483658, 0, 2147516555, 0, 139, 2147483648, 32905, 2147483648, 32771,
    2147483648, 32770, 2147483648, 128, 2147483648, 32778, 0, 2147483658, 2147483648,
    2147516545, 2147483648, 32896, 2147483648, 2147483649, 0, 2147516424, 2147483648];
  var BITS = [224, 256, 384, 512];
  var SHAKE_BITS = [128, 256];
  var OUTPUT_TYPES = ['hex', 'buffer', 'arrayBuffer', 'array', 'digest'];
  var CSHAKE_BYTEPAD = {
    '128': 168,
    '256': 136
  };

  if (root.JS_SHA3_NO_NODE_JS || !Array.isArray) {
    Array.isArray = function (obj) {
      return Object.prototype.toString.call(obj) === '[object Array]';
    };
  }

  if (ARRAY_BUFFER && (root.JS_SHA3_NO_ARRAY_BUFFER_IS_VIEW || !ArrayBuffer.isView)) {
    ArrayBuffer.isView = function (obj) {
      return typeof obj === 'object' && obj.buffer && obj.buffer.constructor === ArrayBuffer;
    };
  }

  var createOutputMethod = function (bits, padding, outputType) {
    return function (message) {
      return new Keccak(bits, padding, bits).update(message)[outputType]();
    };
  };

  var createShakeOutputMethod = function (bits, padding, outputType) {
    return function (message, outputBits) {
      return new Keccak(bits, padding, outputBits).update(message)[outputType]();
    };
  };

  var createCshakeOutputMethod = function (bits, padding, outputType) {
    return function (message, outputBits, n, s) {
      return methods['cshake' + bits].update(message, outputBits, n, s)[outputType]();
    };
  };

  var createKmacOutputMethod = function (bits, padding, outputType) {
    return function (key, message, outputBits, s) {
      return methods['kmac' + bits].update(key, message, outputBits, s)[outputType]();
    };
  };

  var createOutputMethods = function (method, createMethod, bits, padding) {
    for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
      var type = OUTPUT_TYPES[i];
      method[type] = createMethod(bits, padding, type);
    }
    return method;
  };

  var createMethod = function (bits, padding) {
    var method = createOutputMethod(bits, padding, 'hex');
    method.create = function () {
      return new Keccak(bits, padding, bits);
    };
    method.update = function (message) {
      return method.create().update(message);
    };
    return createOutputMethods(method, createOutputMethod, bits, padding);
  };

  var createShakeMethod = function (bits, padding) {
    var method = createShakeOutputMethod(bits, padding, 'hex');
    method.create = function (outputBits) {
      return new Keccak(bits, padding, outputBits);
    };
    method.update = function (message, outputBits) {
      return method.create(outputBits).update(message);
    };
    return createOutputMethods(method, createShakeOutputMethod, bits, padding);
  };

  var createCshakeMethod = function (bits, padding) {
    var w = CSHAKE_BYTEPAD[bits];
    var method = createCshakeOutputMethod(bits, padding, 'hex');
    method.create = function (outputBits, n, s) {
      if (!n && !s) {
        return methods['shake' + bits].create(outputBits);
      } else {
        return new Keccak(bits, padding, outputBits).bytepad([n, s], w);
      }
    };
    method.update = function (message, outputBits, n, s) {
      return method.create(outputBits, n, s).update(message);
    };
    return createOutputMethods(method, createCshakeOutputMethod, bits, padding);
  };

  var createKmacMethod = function (bits, padding) {
    var w = CSHAKE_BYTEPAD[bits];
    var method = createKmacOutputMethod(bits, padding, 'hex');
    method.create = function (key, outputBits, s) {
      return new Kmac(bits, padding, outputBits).bytepad(['KMAC', s], w).bytepad([key], w);
    };
    method.update = function (key, message, outputBits, s) {
      return method.create(key, outputBits, s).update(message);
    };
    return createOutputMethods(method, createKmacOutputMethod, bits, padding);
  };

  var algorithms = [
    { name: 'keccak', padding: KECCAK_PADDING, bits: BITS, createMethod: createMethod },
    { name: 'sha3', padding: PADDING, bits: BITS, createMethod: createMethod },
    { name: 'shake', padding: SHAKE_PADDING, bits: SHAKE_BITS, createMethod: createShakeMethod },
    { name: 'cshake', padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createCshakeMethod },
    { name: 'kmac', padding: CSHAKE_PADDING, bits: SHAKE_BITS, createMethod: createKmacMethod }
  ];

  var methods = {}, methodNames = [];

  for (var i = 0; i < algorithms.length; ++i) {
    var algorithm = algorithms[i];
    var bits = algorithm.bits;
    for (var j = 0; j < bits.length; ++j) {
      var methodName = algorithm.name + '_' + bits[j];
      methodNames.push(methodName);
      methods[methodName] = algorithm.createMethod(bits[j], algorithm.padding);
      if (algorithm.name !== 'sha3') {
        var newMethodName = algorithm.name + bits[j];
        methodNames.push(newMethodName);
        methods[newMethodName] = methods[methodName];
      }
    }
  }

  function Keccak(bits, padding, outputBits) {
    this.blocks = [];
    this.s = [];
    this.padding = padding;
    this.outputBits = outputBits;
    this.reset = true;
    this.finalized = false;
    this.block = 0;
    this.start = 0;
    this.blockCount = (1600 - (bits << 1)) >> 5;
    this.byteCount = this.blockCount << 2;
    this.outputBlocks = outputBits >> 5;
    this.extraBytes = (outputBits & 31) >> 3;

    for (var i = 0; i < 50; ++i) {
      this.s[i] = 0;
    }
  }

  Keccak.prototype.update = function (message) {
    if (this.finalized) {
      throw new Error(FINALIZE_ERROR);
    }
    var notString, type = typeof message;
    if (type !== 'string') {
      if (type === 'object') {
        if (message === null) {
          throw new Error(INPUT_ERROR);
        } else if (ARRAY_BUFFER && message.constructor === ArrayBuffer) {
          message = new Uint8Array(message);
        } else if (!Array.isArray(message)) {
          if (!ARRAY_BUFFER || !ArrayBuffer.isView(message)) {
            throw new Error(INPUT_ERROR);
          }
        }
      } else {
        throw new Error(INPUT_ERROR);
      }
      notString = true;
    }
    var blocks = this.blocks, byteCount = this.byteCount, length = message.length,
      blockCount = this.blockCount, index = 0, s = this.s, i, code;

    while (index < length) {
      if (this.reset) {
        this.reset = false;
        blocks[0] = this.block;
        for (i = 1; i < blockCount + 1; ++i) {
          blocks[i] = 0;
        }
      }
      if (notString) {
        for (i = this.start; index < length && i < byteCount; ++index) {
          blocks[i >> 2] |= message[index] << SHIFT[i++ & 3];
        }
      } else {
        for (i = this.start; index < length && i < byteCount; ++index) {
          code = message.charCodeAt(index);
          if (code < 0x80) {
            blocks[i >> 2] |= code << SHIFT[i++ & 3];
          } else if (code < 0x800) {
            blocks[i >> 2] |= (0xc0 | (code >> 6)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          } else if (code < 0xd800 || code >= 0xe000) {
            blocks[i >> 2] |= (0xe0 | (code >> 12)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          } else {
            code = 0x10000 + (((code & 0x3ff) << 10) | (message.charCodeAt(++index) & 0x3ff));
            blocks[i >> 2] |= (0xf0 | (code >> 18)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | ((code >> 12) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          }
        }
      }
      this.lastByteIndex = i;
      if (i >= byteCount) {
        this.start = i - byteCount;
        this.block = blocks[blockCount];
        for (i = 0; i < blockCount; ++i) {
          s[i] ^= blocks[i];
        }
        f(s);
        this.reset = true;
      } else {
        this.start = i;
      }
    }
    return this;
  };

  Keccak.prototype.encode = function (x, right) {
    var o = x & 255, n = 1;
    var bytes = [o];
    x = x >> 8;
    o = x & 255;
    while (o > 0) {
      bytes.unshift(o);
      x = x >> 8;
      o = x & 255;
      ++n;
    }
    if (right) {
      bytes.push(n);
    } else {
      bytes.unshift(n);
    }
    this.update(bytes);
    return bytes.length;
  };

  Keccak.prototype.encodeString = function (str) {
    var notString, type = typeof str;
    if (type !== 'string') {
      if (type === 'object') {
        if (str === null) {
          throw new Error(INPUT_ERROR);
        } else if (ARRAY_BUFFER && str.constructor === ArrayBuffer) {
          str = new Uint8Array(str);
        } else if (!Array.isArray(str)) {
          if (!ARRAY_BUFFER || !ArrayBuffer.isView(str)) {
            throw new Error(INPUT_ERROR);
          }
        }
      } else {
        throw new Error(INPUT_ERROR);
      }
      notString = true;
    }
    var bytes = 0, length = str.length;
    if (notString) {
      bytes = length;
    } else {
      for (var i = 0; i < str.length; ++i) {
        var code = str.charCodeAt(i);
        if (code < 0x80) {
          bytes += 1;
        } else if (code < 0x800) {
          bytes += 2;
        } else if (code < 0xd800 || code >= 0xe000) {
          bytes += 3;
        } else {
          code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(++i) & 0x3ff));
          bytes += 4;
        }
      }
    }
    bytes += this.encode(bytes * 8);
    this.update(str);
    return bytes;
  };

  Keccak.prototype.bytepad = function (strs, w) {
    var bytes = this.encode(w);
    for (var i = 0; i < strs.length; ++i) {
      bytes += this.encodeString(strs[i]);
    }
    var paddingBytes = w - bytes % w;
    var zeros = [];
    zeros.length = paddingBytes;
    this.update(zeros);
    return this;
  };

  Keccak.prototype.finalize = function () {
    if (this.finalized) {
      return;
    }
    this.finalized = true;
    var blocks = this.blocks, i = this.lastByteIndex, blockCount = this.blockCount, s = this.s;
    blocks[i >> 2] |= this.padding[i & 3];
    if (this.lastByteIndex === this.byteCount) {
      blocks[0] = blocks[blockCount];
      for (i = 1; i < blockCount + 1; ++i) {
        blocks[i] = 0;
      }
    }
    blocks[blockCount - 1] |= 0x80000000;
    for (i = 0; i < blockCount; ++i) {
      s[i] ^= blocks[i];
    }
    f(s);
  };

  Keccak.prototype.toString = Keccak.prototype.hex = function () {
    this.finalize();

    var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks,
      extraBytes = this.extraBytes, i = 0, j = 0;
    var hex = '', block;
    while (j < outputBlocks) {
      for (i = 0; i < blockCount && j < outputBlocks; ++i, ++j) {
        block = s[i];
        hex += HEX_CHARS[(block >> 4) & 0x0F] + HEX_CHARS[block & 0x0F] +
          HEX_CHARS[(block >> 12) & 0x0F] + HEX_CHARS[(block >> 8) & 0x0F] +
          HEX_CHARS[(block >> 20) & 0x0F] + HEX_CHARS[(block >> 16) & 0x0F] +
          HEX_CHARS[(block >> 28) & 0x0F] + HEX_CHARS[(block >> 24) & 0x0F];
      }
      if (j % blockCount === 0) {
        f(s);
        i = 0;
      }
    }
    if (extraBytes) {
      block = s[i];
      hex += HEX_CHARS[(block >> 4) & 0x0F] + HEX_CHARS[block & 0x0F];
      if (extraBytes > 1) {
        hex += HEX_CHARS[(block >> 12) & 0x0F] + HEX_CHARS[(block >> 8) & 0x0F];
      }
      if (extraBytes > 2) {
        hex += HEX_CHARS[(block >> 20) & 0x0F] + HEX_CHARS[(block >> 16) & 0x0F];
      }
    }
    return hex;
  };

  Keccak.prototype.arrayBuffer = function () {
    this.finalize();

    var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks,
      extraBytes = this.extraBytes, i = 0, j = 0;
    var bytes = this.outputBits >> 3;
    var buffer;
    if (extraBytes) {
      buffer = new ArrayBuffer((outputBlocks + 1) << 2);
    } else {
      buffer = new ArrayBuffer(bytes);
    }
    var array = new Uint32Array(buffer);
    while (j < outputBlocks) {
      for (i = 0; i < blockCount && j < outputBlocks; ++i, ++j) {
        array[j] = s[i];
      }
      if (j % blockCount === 0) {
        f(s);
      }
    }
    if (extraBytes) {
      array[i] = s[i];
      buffer = buffer.slice(0, bytes);
    }
    return buffer;
  };

  Keccak.prototype.buffer = Keccak.prototype.arrayBuffer;

  Keccak.prototype.digest = Keccak.prototype.array = function () {
    this.finalize();

    var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks,
      extraBytes = this.extraBytes, i = 0, j = 0;
    var array = [], offset, block;
    while (j < outputBlocks) {
      for (i = 0; i < blockCount && j < outputBlocks; ++i, ++j) {
        offset = j << 2;
        block = s[i];
        array[offset] = block & 0xFF;
        array[offset + 1] = (block >> 8) & 0xFF;
        array[offset + 2] = (block >> 16) & 0xFF;
        array[offset + 3] = (block >> 24) & 0xFF;
      }
      if (j % blockCount === 0) {
        f(s);
      }
    }
    if (extraBytes) {
      offset = j << 2;
      block = s[i];
      array[offset] = block & 0xFF;
      if (extraBytes > 1) {
        array[offset + 1] = (block >> 8) & 0xFF;
      }
      if (extraBytes > 2) {
        array[offset + 2] = (block >> 16) & 0xFF;
      }
    }
    return array;
  };

  function Kmac(bits, padding, outputBits) {
    Keccak.call(this, bits, padding, outputBits);
  }

  Kmac.prototype = new Keccak();

  Kmac.prototype.finalize = function () {
    this.encode(this.outputBits, true);
    return Keccak.prototype.finalize.call(this);
  };

  var f = function (s) {
    var h, l, n, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9,
      b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17,
      b18, b19, b20, b21, b22, b23, b24, b25, b26, b27, b28, b29, b30, b31, b32, b33,
      b34, b35, b36, b37, b38, b39, b40, b41, b42, b43, b44, b45, b46, b47, b48, b49;
    for (n = 0; n < 48; n += 2) {
      c0 = s[0] ^ s[10] ^ s[20] ^ s[30] ^ s[40];
      c1 = s[1] ^ s[11] ^ s[21] ^ s[31] ^ s[41];
      c2 = s[2] ^ s[12] ^ s[22] ^ s[32] ^ s[42];
      c3 = s[3] ^ s[13] ^ s[23] ^ s[33] ^ s[43];
      c4 = s[4] ^ s[14] ^ s[24] ^ s[34] ^ s[44];
      c5 = s[5] ^ s[15] ^ s[25] ^ s[35] ^ s[45];
      c6 = s[6] ^ s[16] ^ s[26] ^ s[36] ^ s[46];
      c7 = s[7] ^ s[17] ^ s[27] ^ s[37] ^ s[47];
      c8 = s[8] ^ s[18] ^ s[28] ^ s[38] ^ s[48];
      c9 = s[9] ^ s[19] ^ s[29] ^ s[39] ^ s[49];

      h = c8 ^ ((c2 << 1) | (c3 >>> 31));
      l = c9 ^ ((c3 << 1) | (c2 >>> 31));
      s[0] ^= h;
      s[1] ^= l;
      s[10] ^= h;
      s[11] ^= l;
      s[20] ^= h;
      s[21] ^= l;
      s[30] ^= h;
      s[31] ^= l;
      s[40] ^= h;
      s[41] ^= l;
      h = c0 ^ ((c4 << 1) | (c5 >>> 31));
      l = c1 ^ ((c5 << 1) | (c4 >>> 31));
      s[2] ^= h;
      s[3] ^= l;
      s[12] ^= h;
      s[13] ^= l;
      s[22] ^= h;
      s[23] ^= l;
      s[32] ^= h;
      s[33] ^= l;
      s[42] ^= h;
      s[43] ^= l;
      h = c2 ^ ((c6 << 1) | (c7 >>> 31));
      l = c3 ^ ((c7 << 1) | (c6 >>> 31));
      s[4] ^= h;
      s[5] ^= l;
      s[14] ^= h;
      s[15] ^= l;
      s[24] ^= h;
      s[25] ^= l;
      s[34] ^= h;
      s[35] ^= l;
      s[44] ^= h;
      s[45] ^= l;
      h = c4 ^ ((c8 << 1) | (c9 >>> 31));
      l = c5 ^ ((c9 << 1) | (c8 >>> 31));
      s[6] ^= h;
      s[7] ^= l;
      s[16] ^= h;
      s[17] ^= l;
      s[26] ^= h;
      s[27] ^= l;
      s[36] ^= h;
      s[37] ^= l;
      s[46] ^= h;
      s[47] ^= l;
      h = c6 ^ ((c0 << 1) | (c1 >>> 31));
      l = c7 ^ ((c1 << 1) | (c0 >>> 31));
      s[8] ^= h;
      s[9] ^= l;
      s[18] ^= h;
      s[19] ^= l;
      s[28] ^= h;
      s[29] ^= l;
      s[38] ^= h;
      s[39] ^= l;
      s[48] ^= h;
      s[49] ^= l;

      b0 = s[0];
      b1 = s[1];
      b32 = (s[11] << 4) | (s[10] >>> 28);
      b33 = (s[10] << 4) | (s[11] >>> 28);
      b14 = (s[20] << 3) | (s[21] >>> 29);
      b15 = (s[21] << 3) | (s[20] >>> 29);
      b46 = (s[31] << 9) | (s[30] >>> 23);
      b47 = (s[30] << 9) | (s[31] >>> 23);
      b28 = (s[40] << 18) | (s[41] >>> 14);
      b29 = (s[41] << 18) | (s[40] >>> 14);
      b20 = (s[2] << 1) | (s[3] >>> 31);
      b21 = (s[3] << 1) | (s[2] >>> 31);
      b2 = (s[13] << 12) | (s[12] >>> 20);
      b3 = (s[12] << 12) | (s[13] >>> 20);
      b34 = (s[22] << 10) | (s[23] >>> 22);
      b35 = (s[23] << 10) | (s[22] >>> 22);
      b16 = (s[33] << 13) | (s[32] >>> 19);
      b17 = (s[32] << 13) | (s[33] >>> 19);
      b48 = (s[42] << 2) | (s[43] >>> 30);
      b49 = (s[43] << 2) | (s[42] >>> 30);
      b40 = (s[5] << 30) | (s[4] >>> 2);
      b41 = (s[4] << 30) | (s[5] >>> 2);
      b22 = (s[14] << 6) | (s[15] >>> 26);
      b23 = (s[15] << 6) | (s[14] >>> 26);
      b4 = (s[25] << 11) | (s[24] >>> 21);
      b5 = (s[24] << 11) | (s[25] >>> 21);
      b36 = (s[34] << 15) | (s[35] >>> 17);
      b37 = (s[35] << 15) | (s[34] >>> 17);
      b18 = (s[45] << 29) | (s[44] >>> 3);
      b19 = (s[44] << 29) | (s[45] >>> 3);
      b10 = (s[6] << 28) | (s[7] >>> 4);
      b11 = (s[7] << 28) | (s[6] >>> 4);
      b42 = (s[17] << 23) | (s[16] >>> 9);
      b43 = (s[16] << 23) | (s[17] >>> 9);
      b24 = (s[26] << 25) | (s[27] >>> 7);
      b25 = (s[27] << 25) | (s[26] >>> 7);
      b6 = (s[36] << 21) | (s[37] >>> 11);
      b7 = (s[37] << 21) | (s[36] >>> 11);
      b38 = (s[47] << 24) | (s[46] >>> 8);
      b39 = (s[46] << 24) | (s[47] >>> 8);
      b30 = (s[8] << 27) | (s[9] >>> 5);
      b31 = (s[9] << 27) | (s[8] >>> 5);
      b12 = (s[18] << 20) | (s[19] >>> 12);
      b13 = (s[19] << 20) | (s[18] >>> 12);
      b44 = (s[29] << 7) | (s[28] >>> 25);
      b45 = (s[28] << 7) | (s[29] >>> 25);
      b26 = (s[38] << 8) | (s[39] >>> 24);
      b27 = (s[39] << 8) | (s[38] >>> 24);
      b8 = (s[48] << 14) | (s[49] >>> 18);
      b9 = (s[49] << 14) | (s[48] >>> 18);

      s[0] = b0 ^ (~b2 & b4);
      s[1] = b1 ^ (~b3 & b5);
      s[10] = b10 ^ (~b12 & b14);
      s[11] = b11 ^ (~b13 & b15);
      s[20] = b20 ^ (~b22 & b24);
      s[21] = b21 ^ (~b23 & b25);
      s[30] = b30 ^ (~b32 & b34);
      s[31] = b31 ^ (~b33 & b35);
      s[40] = b40 ^ (~b42 & b44);
      s[41] = b41 ^ (~b43 & b45);
      s[2] = b2 ^ (~b4 & b6);
      s[3] = b3 ^ (~b5 & b7);
      s[12] = b12 ^ (~b14 & b16);
      s[13] = b13 ^ (~b15 & b17);
      s[22] = b22 ^ (~b24 & b26);
      s[23] = b23 ^ (~b25 & b27);
      s[32] = b32 ^ (~b34 & b36);
      s[33] = b33 ^ (~b35 & b37);
      s[42] = b42 ^ (~b44 & b46);
      s[43] = b43 ^ (~b45 & b47);
      s[4] = b4 ^ (~b6 & b8);
      s[5] = b5 ^ (~b7 & b9);
      s[14] = b14 ^ (~b16 & b18);
      s[15] = b15 ^ (~b17 & b19);
      s[24] = b24 ^ (~b26 & b28);
      s[25] = b25 ^ (~b27 & b29);
      s[34] = b34 ^ (~b36 & b38);
      s[35] = b35 ^ (~b37 & b39);
      s[44] = b44 ^ (~b46 & b48);
      s[45] = b45 ^ (~b47 & b49);
      s[6] = b6 ^ (~b8 & b0);
      s[7] = b7 ^ (~b9 & b1);
      s[16] = b16 ^ (~b18 & b10);
      s[17] = b17 ^ (~b19 & b11);
      s[26] = b26 ^ (~b28 & b20);
      s[27] = b27 ^ (~b29 & b21);
      s[36] = b36 ^ (~b38 & b30);
      s[37] = b37 ^ (~b39 & b31);
      s[46] = b46 ^ (~b48 & b40);
      s[47] = b47 ^ (~b49 & b41);
      s[8] = b8 ^ (~b0 & b2);
      s[9] = b9 ^ (~b1 & b3);
      s[18] = b18 ^ (~b10 & b12);
      s[19] = b19 ^ (~b11 & b13);
      s[28] = b28 ^ (~b20 & b22);
      s[29] = b29 ^ (~b21 & b23);
      s[38] = b38 ^ (~b30 & b32);
      s[39] = b39 ^ (~b31 & b33);
      s[48] = b48 ^ (~b40 & b42);
      s[49] = b49 ^ (~b41 & b43);

      s[0] ^= RC[n];
      s[1] ^= RC[n + 1];
    }
  };

  if (COMMON_JS) {
    module.exports = methods;
  } else {
    for (i = 0; i < methodNames.length; ++i) {
      root[methodNames[i]] = methods[methodNames[i]];
    }
    if (AMD) {
      define(function () {
        return methods;
      });
    }
  }
})();

}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":72}],72:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}]},{},[1]);
