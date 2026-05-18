/** @type import('hardhat/config').HardhatUserConfig */
require("solidity-docgen");
const compilers = require("./compilers.json");

module.exports = {
  solidity: {
    compilers
  },
  docgen: {
    pages: "files",
    output: 'docs',
  }
};
