// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IMockVRFConsumer {
    function rawFulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external;
}

contract MockVRFWrapper {
    uint256 public requestPriceNative;
    uint256 public lastRequestId;
    mapping(uint256 => address) public requester;

    constructor(uint256 price) {
        requestPriceNative = price;
    }

    function setRequestPriceNative(uint256 price) external {
        requestPriceNative = price;
    }

    function calculateRequestPrice(uint32, uint32) external view returns (uint256) {
        return requestPriceNative;
    }

    function calculateRequestPriceNative(uint32, uint32) external view returns (uint256) {
        return requestPriceNative;
    }

    function estimateRequestPrice(uint32, uint32, uint256) external view returns (uint256) {
        return requestPriceNative;
    }

    function estimateRequestPriceNative(uint32, uint32, uint256) external view returns (uint256) {
        return requestPriceNative;
    }

    function requestRandomWordsInNative(uint32, uint16, uint32, bytes calldata extraArgs) external payable returns (uint256 requestId) {
        require(msg.value >= requestPriceNative, "insufficient vrf fee");
        // Mimic the real wrapper: the native function requires extraArgs that
        // flag nativePayment=true, else it reverts LINKPaymentInRequestRandomWordsInNative.
        require(extraArgs.length >= 36, "LINKPaymentInRequestRandomWordsInNative");
        require(extraArgs[extraArgs.length - 1] != 0, "LINKPaymentInRequestRandomWordsInNative");
        requestId = ++lastRequestId;
        requester[requestId] = msg.sender;
    }

    function fulfill(uint256 requestId, uint256 randomWord) external {
        uint256[] memory words = new uint256[](1);
        words[0] = randomWord;
        IMockVRFConsumer(requester[requestId]).rawFulfillRandomWords(requestId, words);
    }

    function link() external pure returns (address) {
        return address(0);
    }

    function linkNativeFeed() external pure returns (address) {
        return address(0);
    }
}
