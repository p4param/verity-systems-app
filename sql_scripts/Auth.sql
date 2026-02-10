/* Users */
CREATE TABLE Users (
    UserId          INT IDENTITY(1,1) PRIMARY KEY,
    TenantId        INT NOT NULL,

    FullName        NVARCHAR(150) NOT NULL,
    Email           NVARCHAR(150) NOT NULL,
    PasswordHash    NVARCHAR(255) NOT NULL,

    IsActive        BIT NOT NULL DEFAULT 1,
    IsLocked        BIT NOT NULL DEFAULT 0,

    LastLoginAt     DATETIME2 NULL,

    CreatedAt       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CreatedBy       INT NULL,
    UpdatedAt       DATETIME2 NULL,
    UpdatedBy       INT NULL
);

CREATE UNIQUE INDEX UX_Users_Tenant_Email
ON Users (TenantId, Email);
Go

/* Roles */
CREATE TABLE Roles (
    RoleId      INT IDENTITY(1,1) PRIMARY KEY,
    TenantId    INT NOT NULL,

    RoleName    NVARCHAR(100) NOT NULL,
    Description NVARCHAR(255) NULL,

    IsSystem    BIT NOT NULL DEFAULT 0,
    IsActive    BIT NOT NULL DEFAULT 1,

    CreatedAt   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE UNIQUE INDEX UX_Roles_Tenant_RoleName
ON Roles (TenantId, RoleName);
Go

/*User Roles*/
CREATE TABLE UserRoles (
    UserId     INT NOT NULL,
    RoleId     INT NOT NULL,

    AssignedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    AssignedBy INT NULL,

    CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),

    CONSTRAINT FK_UserRoles_User
        FOREIGN KEY (UserId) REFERENCES Users(UserId),

    CONSTRAINT FK_UserRoles_Role
        FOREIGN KEY (RoleId) REFERENCES Roles(RoleId)
)
Go

/**/
CREATE TABLE Permissions (
    PermissionId    INT IDENTITY(1,1) PRIMARY KEY,

    PermissionCode  NVARCHAR(100) NOT NULL,
    Description     NVARCHAR(255) NULL
);

CREATE UNIQUE INDEX UX_Permissions_Code
ON Permissions (PermissionCode);
Go

/*RolePermissions*/
CREATE TABLE RolePermissions (
    RoleId        INT NOT NULL,
    PermissionId  INT NOT NULL,

    CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionId),

    CONSTRAINT FK_RolePermissions_Role
        FOREIGN KEY (RoleId) REFERENCES Roles(RoleId),

    CONSTRAINT FK_RolePermissions_Permission
        FOREIGN KEY (PermissionId) REFERENCES Permissions(PermissionId)
)
Go

/*Tenants*/
CREATE TABLE Tenants (
    TenantId    INT IDENTITY(1,1) PRIMARY KEY,
    TenantCode  NVARCHAR(50) NOT NULL,
    TenantName  NVARCHAR(150) NOT NULL,

    IsActive    BIT NOT NULL DEFAULT 1,

    CreatedAt  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE UNIQUE INDEX UX_Tenants_Code
ON Tenants (TenantCode);
Go


CREATE TABLE PasswordResetTokens (
  PasswordResetTokenId INT IDENTITY(1,1) PRIMARY KEY,
  UserId               INT NOT NULL,
  TokenHash            NVARCHAR(255) NOT NULL,
  ExpiresAt            DATETIME2 NOT NULL,
  UsedAt               DATETIME2 NULL,
  CreatedAt            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),

  CONSTRAINT FK_PasswordResetTokens_User
    FOREIGN KEY (UserId) REFERENCES Users(UserId)
);

CREATE INDEX IX_PasswordResetTokens_TokenHash
  ON PasswordResetTokens (TokenHash);
Go

CREATE TABLE PasswordResetRequests (
  PasswordResetRequestId INT IDENTITY(1,1) PRIMARY KEY,
  Email                  NVARCHAR(150) NOT NULL,
  IpAddress              NVARCHAR(50) NOT NULL,
  RequestedAt            DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE INDEX IX_PasswordResetRequests_Email_Time
  ON PasswordResetRequests (Email, RequestedAt);

CREATE INDEX IX_PasswordResetRequests_Ip_Time
  ON PasswordResetRequests (IpAddress, RequestedAt);
Go