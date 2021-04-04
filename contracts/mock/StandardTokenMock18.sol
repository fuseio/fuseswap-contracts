pragma solidity ^0.6.0;

import "./Token20.sol";

contract StandardTokenMock18 is Token20 {

  constructor(address initialAccount, uint initialBalance) Token20("StandardTokenMock", "STM", 18) public {
    _mint(initialAccount, initialBalance);
  }
}
