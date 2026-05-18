// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

/**
 * @title RNG
 * @dev A contract to generate random numbers using the SKALE Network RNG endpoint.
 * The RNG endpoint code for the function getRandomBytes() is taken from the SKALE Network Documentation:
 * https://docs.skale.network/tools/skale-specific/random-number-generator
 */
contract RNG {

    /**
     * @notice Fetches 32 random bytes from the SKALE Network RNG endpoint.
     * @dev The assembly code retrieves random bytes from the SKALE Network.
     * For more details on how it works, refer to the SKALE Network documentation:
     * https://docs.skale.network/tools/skale-specific/random-number-generator
     * @return addr A 32-byte random value.
     */
    function getRandomBytes() public view returns (bytes32 addr) {
        assembly {
            let freemem := mload(0x40)
            let start_addr := add(freemem, 0)
            if iszero(staticcall(gas(), 0x18, 0, 0, start_addr, 32)) {
                invalid()
            }
            addr := mload(freemem)
        }
    }
    
    /**
     * @notice Generates a random number.
     * @return A random number as a uint256.
     */
    function getRandomNumber() public view returns (uint256) {
        return uint256(getRandomBytes());
    }
    
    /**
     * @notice Generates a random number with an additional index iteration. 
     * This should be used for multiple values in the same block.
     * @param nextIndex The index to iterate the RNG value by.
     * @return A random number as a uint256.
     */
    function getNextRandomNumber(uint256 nextIndex) public view returns (uint256) {
        return uint256(keccak256(abi.encode(getRandomNumber() | nextIndex)));
    }

    /**
     * @notice Generates a random number within a specified range with an additional index iteration.
     * This should be used for multiple values in the same block.
     * @param nextIndex The index to iterate the RNG value by.
     * @param max The maximum value (inclusive) that the random number can be.
     * @return A random number between 0 and max (inclusive).
     */
    function getNextRandomRange(uint256 nextIndex, uint256 max) public view returns (uint256) {
        return uint256(keccak256(abi.encode(getRandomNumber() | nextIndex))) % max;
    }
    
    /**
     * @notice Generates a random number within a specified range.
     * @param max The maximum value (inclusive) that the random number can be.
     * @return A random number between 0 and max (inclusive).
     */
    function getRandomRange(uint256 max) public view returns (uint256) {
        return getRandomNumber() % max;
    }
}
