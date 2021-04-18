pragma solidity ^0.6.0;

import "./Token20.sol";

contract StandardTokenMock6 is Token20 {

  constructor(address initialAccount, uint initialBalance) Token20(6) public {
    _mint(initialAccount, initialBalance);
  }
}
