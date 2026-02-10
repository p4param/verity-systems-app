INSERT INTO Permissions (PermissionCode, Description)
VALUES
-- User management
('USER_VIEW', 'View users'),
('USER_CREATE', 'Create users'),
('USER_UPDATE', 'Update users'),
('USER_DELETE', 'Delete users'),

-- Role management
('ROLE_VIEW', 'View roles'),
('ROLE_CREATE', 'Create roles'),
('ROLE_UPDATE', 'Update roles'),
('ROLE_DELETE', 'Delete roles'),
('ROLE_ASSIGN', 'Assign roles to users'),

-- Permission visibility
('PERMISSION_VIEW', 'View permissions');

Select * from Roles

INSERT INTO Roles (TenantId, RoleName, Description, IsSystem, IsActive)
VALUES
--(1, 'Admin', 'System administrator with full access', 1, 1),
(1, 'User', 'Standard application user', 1, 1);

update roles
set Description='System administrator with full access' where roleid=1

INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT
    r.RoleId,
    p.PermissionId
FROM Roles r
JOIN Permissions p
    ON p.PermissionCode IN (
        'USER_VIEW',
        'USER_CREATE',
        'USER_UPDATE',
        'USER_DELETE',
        'ROLE_VIEW',
        'ROLE_CREATE',
        'ROLE_UPDATE',
        'ROLE_DELETE',
        'ROLE_ASSIGN',
        'PERMISSION_VIEW'
    )
WHERE r.RoleName = 'Admin'
  AND r.TenantId = 1;


  INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT
    r.RoleId,
    p.PermissionId
FROM Roles r
JOIN Permissions p
    ON p.PermissionCode IN (
        'USER_VIEW'
    )
WHERE r.RoleName = 'User'
  AND r.TenantId = 1;



  SELECT
    r.RoleName,
    p.PermissionCode
FROM RolePermissions rp
JOIN Roles r ON r.RoleId = rp.RoleId
JOIN Permissions p ON p.PermissionId = rp.PermissionId
WHERE r.TenantId = 1
ORDER BY r.RoleName, p.PermissionCode;

select * from users

select * from UserRoles
select * from users