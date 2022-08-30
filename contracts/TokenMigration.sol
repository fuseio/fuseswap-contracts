pragma solidity >=0.6.0 <0.8.0;

import "@chainlink/contracts/src/v0.6/Owned.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./token/ERC677Receiver.sol";

/**
 * @notice This contract provides a one-to-one swap between pairs of tokens. It
 * is controlled by an owner who manages liquidity pools for all pairs. Most
 * users should only interact with the swap, onTokenTransfer, and
 * getSwappableAmount functions.
 */
contract TokenMigration is Owned, ReentrancyGuard {
  using SafeMath for uint256;

  event LiquidityUpdated(
    uint256 amount,
    address indexed source,
    address indexed target
  );
  event TokensSwapped(
    address indexed source,
    address indexed target,
    address indexed caller,
    uint256 sourceAmount,
    uint256 targetAmount
  );
  event StuckTokensRecovered(
    uint256 amount,
    address indexed target
  );

  address public oldToken;
  address public newToken;
  mapping(address => mapping(address => uint256)) private s_swappableAmount;

  constructor (address _oldToken, address _newToken) public {
    oldToken = _oldToken;
    newToken = _newToken;    
  }

  /**
   * @dev Disallows direct send by setting a default function without the `payable` flag.
   */
  fallback()
    external
  {}

  /**
   * @notice deposits tokens from the target of a swap pair but does not return
   * any. WARNING: Liquidity added through this method is only retrievable by
   * the owner of the contract.
   * @param amount count of liquidity being added
   * @param source the token that can be swapped for what is being deposited
   * @param target the token that can is being deposited for swapping
   */
  function addLiquidity(
    uint256 amount,
    address source,
    address target
  )
    external
  {
    require(source == oldToken && target == newToken, "Can only add newToken liquidity");
    
    bool allowed = owner == msg.sender || _hasLiquidity(source, target);
    // By only allowing the owner to add a new pair, we reduce the potential of
    // possible attacks mounted by malicious token contracts.
    require(allowed, "only owner can add pairs");

    _addLiquidity(amount, source, target);

    require(ERC20(target).transferFrom(msg.sender, address(this), amount), "transferFrom failed");
  }

  /**
   * @notice withdraws tokens from the target of a swap pair.
   * @dev Only callable by owner
   * @param amount count of liquidity being removed
   * @param source the token that can be swapped for what is being removed
   * @param target the token that can is being withdrawn from swapping
   */
  function removeLiquidity(
    uint256 amount,
    address source,
    address target
  )
    external
    onlyOwner()
  {
    require(source == oldToken && target == newToken, "Can only remove newToken liquidity");

    _removeLiquidity(amount, source, target);

    require(ERC20(target).transfer(msg.sender, amount), "transfer failed");
  }

  /**
   * @notice exchanges the source token for target token
   * @param sourceAmount count of tokens being swapped
   * @param source the token that is being given
   * @param target the token that is being taken
   */
  function swap(
    uint256 sourceAmount,
    address source,
    address target
  )
    external
    nonReentrant()
  {
    require(source == oldToken && target == newToken, "Can only swap from oldToken to newToken");

    uint256 targetAmount = _getTargetAmount(source, target, sourceAmount);
    require(targetAmount != 0);

    _removeLiquidity(targetAmount, source, target);

    emit TokensSwapped(source, target, msg.sender, sourceAmount, targetAmount);

    require(ERC20(source).transferFrom(msg.sender, address(this), sourceAmount), "transferFrom failed");
    ERC20Burnable(source).burn(sourceAmount); // burn old token
    require(ERC20(target).transfer(msg.sender, targetAmount), "transfer failed");
  }

  /**
   * @notice send funds that were accidentally transferred back to the owner. This
   * allows rescuing of funds, and poses no additional risk as the owner could
   * already withdraw any funds intended to be swapped. WARNING: If not called
   * correctly this method can throw off the swappable token balances, but that
   * can be recovered from by transferring the discrepancy back to the swap.
   * @dev Only callable by owner
   * @param amount count of tokens being moved
   * @param target the token that is being moved
   */
  function recoverStuckTokens(
    uint256 amount,
    address target
  )
    external
    onlyOwner()
  {
    emit StuckTokensRecovered(amount, target);

    require(ERC20(target).transfer(msg.sender, amount), "transfer failed");
  }

  /**
   * @notice returns the amount of tokens for a pair that are available to swap
   * @param source the token that is being given
   * @param target the token that is being taken
   * @return amount count of tokens available to swap
   */
  function getSwappableAmount(
    address source,
    address target
  )
    public
    view
    returns(
      uint256 amount
    )
  {
    return s_swappableAmount[source][target];
  }


  // PRIVATE

  function _addLiquidity(
    uint256 amount,
    address source,
    address target
  )
    private
  {
    uint256 newAmount = getSwappableAmount(source, target).add(amount);
    s_swappableAmount[source][target] = newAmount;

    emit LiquidityUpdated(newAmount, source, target);
  }

  function _removeLiquidity(
    uint256 amount,
    address source,
    address target
  )
    private
  {
    uint256 newAmount = getSwappableAmount(source, target).sub(amount);
    s_swappableAmount[source][target] = newAmount;

    emit LiquidityUpdated(newAmount, source, target);
  }

  function _hasLiquidity(
    address source,
    address target
  )
    private
    returns (
      bool hasLiquidity
    )
  {
    if (getSwappableAmount(source, target) > 0) return true;
    if (getSwappableAmount(target, source) > 0) return true;
    return false;
  }

  function _getTargetAmount(
    address source,
    address target,
    uint256 amount
  ) 
    private
    returns (uint256)
  {
    uint8 sourceDecimals = ERC20(source).decimals();
    uint8 targetDecimals = ERC20(target).decimals();

    uint256 targetAmount;
    if (sourceDecimals > targetDecimals) {
      targetAmount = amount / (10 ** uint256(sourceDecimals - targetDecimals));
    } else if (sourceDecimals < targetDecimals) {
      targetAmount = amount * (10 ** uint256(targetDecimals - sourceDecimals));
    } else {
      targetAmount = amount;
    }

    return targetAmount;
  }
}
