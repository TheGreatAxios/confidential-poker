# SKALE RNG

## Installation

Add this repo to your application by running ```npm add @dirtroad/skale-rng```. This will make the **RNG** contract available to import into your other Solidity contracts
via ```import "@dirtroad/skale-rng/contracts/RNG.sol"```.

## Usage

When using this contract you can add it as an inherited contract to take advantage of all of the functions. Example:

```solidity

// SPDX-License-Identifer: MIT
pragma solidity ^0.8.19;

import "@dirtroad/skale-rng/contracts/RNG.sol";

contract ExampleRNG is RNG {

    uin256 public amount;

    constructor() {
        amount = getRandomNumber();
    }

    function updateAmount() external {
        amount = getRandomNumber(); 
    }
}
```

### Security and Liability
All code found in this directory/repository including the RNG.sol smart contract is WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
