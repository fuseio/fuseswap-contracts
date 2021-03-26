pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract StandardTokenMock is ERC20 {

  constructor(address initialAccount, uint initialBalance) ERC20("StandardTokenMock", "STM") public {
    _mint(initialAccount, initialBalance);
  }
}
