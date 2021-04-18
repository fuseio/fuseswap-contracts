pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token20 is ERC20 {
  string private constant NAME = "Example ERC20 Token";
  string private constant SYMBOL = "ERC20";

  constructor(uint8 decimals_) ERC20(NAME, SYMBOL) public {
    _setupDecimals(decimals_);
  } 
}
