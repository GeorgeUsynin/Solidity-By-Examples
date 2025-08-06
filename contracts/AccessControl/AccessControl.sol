// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

import './IAccessControl.sol';

error NoSuchRole(bytes32 role, address account);
error AccountAlreadyHasThisRole(bytes32 role, address account);
error CanOnlyRenounceForSelf(bytes32 role, address account);
error TransferRoleToAnotherAccount();

abstract contract AccessControl is IAccessControl {
    struct RoleData {
        mapping(address => bool) members;
        bytes32 adminRole;
        uint membersCount;
    }

    mapping(bytes32 => RoleData) private _roles;

    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    modifier onlyRole(bytes32 role) {
        _checkRole(role);
        _;
    }

    function hasRole(
        bytes32 role,
        address account
    ) public view virtual returns (bool) {
        return _roles[role].members[account];
    }

    function getRoleAdmin(bytes32 role) public view returns (bytes32) {
        return _roles[role].adminRole;
    }

    function grantRole(
        bytes32 role,
        address account
    ) public virtual onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    function revokeRole(
        bytes32 role,
        address account
    ) public virtual onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
    }

    function renounceRole(bytes32 role, address account) public virtual {
        require(account == msg.sender, CanOnlyRenounceForSelf(role, account));

        _revokeRole(role, account);
    }

    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal virtual {
        bytes32 previousAdmin = getRoleAdmin(role);

        _roles[role].adminRole = adminRole;

        emit RoleAdminChanged(role, previousAdmin, adminRole);
    }

    function _grantRole(bytes32 role, address account) internal virtual {
        require(
            !hasRole(role, account),
            AccountAlreadyHasThisRole(role, account)
        );

        _roles[role].members[account] = true;
        _roles[role].membersCount += 1;

        emit RoleGranted(role, account, msg.sender);
    }

    function _revokeRole(bytes32 role, address account) internal virtual {
        require(hasRole(role, account), NoSuchRole(role, account));
        require(_roles[role].membersCount != 1, TransferRoleToAnotherAccount());

        _roles[role].members[account] = false;
        _roles[role].membersCount -= 1;

        emit RoleRevoked(role, account, msg.sender);
    }

    function _checkRole(bytes32 role) internal view virtual {
        _checkRole(role, msg.sender);
    }

    function _checkRole(bytes32 role, address account) internal view virtual {
        require(hasRole(role, account), NoSuchRole(role, account));
    }
}
