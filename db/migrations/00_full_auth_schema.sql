
-- 00_full_auth_schema.sql
-- Complete Auth & Authorization schema
-- SQL Server compatible
-- Order of execution is important

/* =====================================================
   TENANTS
===================================================== */
CREATE TABLE Tenants (
  TenantId INT IDENTITY(1,1) PRIMARY KEY,
  TenantCode NVARCHAR(50) NOT NULL UNIQUE,
  TenantName NVARCHAR(150) NOT NULL,
  IsActive BIT NOT NULL DEFAULT 1,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

/* =====================================================
   USERS
===================================================== */
CREATE TABLE Users (
  UserId INT IDENTITY(1,1) PRIMARY KEY,
  TenantId INT NOT NULL,
  FullName NVARCHAR(150) NOT NULL,
  Email NVARCHAR(150) NOT NULL,
  PasswordHash NVARCHAR(255) NOT NULL,
  IsActive BIT NOT NULL DEFAULT 1,
  IsLocked BIT NOT NULL DEFAULT 0,
  LastLoginAt DATETIME2 NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CreatedBy INT NULL,
  UpdatedAt DATETIME2 NULL,
  UpdatedBy INT NULL,
  CONSTRAINT UX_Users_Tenant_Email UNIQUE (TenantId, Email),
  CONSTRAINT FK_Users_Tenant FOREIGN KEY (TenantId) REFERENCES Tenants(TenantId)
);

/* =====================================================
   ROLES
===================================================== */
CREATE TABLE Roles (
  RoleId INT IDENTITY(1,1) PRIMARY KEY,
  TenantId INT NOT NULL,
  RoleName NVARCHAR(100) NOT NULL,
  Description NVARCHAR(255) NULL,
  IsSystem BIT NOT NULL DEFAULT 0,
  IsActive BIT NOT NULL DEFAULT 1,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UX_Roles_Tenant_RoleName UNIQUE (TenantId, RoleName),
  CONSTRAINT FK_Roles_Tenant FOREIGN KEY (TenantId) REFERENCES Tenants(TenantId)
);

/* =====================================================
   PERMISSIONS
===================================================== */
CREATE TABLE Permissions (
  PermissionId INT IDENTITY(1,1) PRIMARY KEY,
  PermissionCode NVARCHAR(100) NOT NULL UNIQUE,
  Description NVARCHAR(255) NULL
);

/* =====================================================
   ROLE PERMISSIONS
===================================================== */
CREATE TABLE RolePermissions (
  RoleId INT NOT NULL,
  PermissionId INT NOT NULL,
  CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionId),
  CONSTRAINT FK_RolePermissions_Role FOREIGN KEY (RoleId) REFERENCES Roles(RoleId),
  CONSTRAINT FK_RolePermissions_Permission FOREIGN KEY (PermissionId) REFERENCES Permissions(PermissionId)
);

/* =====================================================
   USER ROLES
===================================================== */
CREATE TABLE UserRoles (
  UserId INT NOT NULL,
  RoleId INT NOT NULL,
  AssignedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  AssignedBy INT NULL,
  CONSTRAINT PK_UserRoles PRIMARY KEY (UserId, RoleId),
  CONSTRAINT FK_UserRoles_User FOREIGN KEY (UserId) REFERENCES Users(UserId),
  CONSTRAINT FK_UserRoles_Role FOREIGN KEY (RoleId) REFERENCES Roles(RoleId)
);

/* =====================================================
   REFRESH TOKENS
===================================================== */
CREATE TABLE RefreshTokens (
  RefreshTokenId INT IDENTITY(1,1) PRIMARY KEY,
  UserId INT NOT NULL,
  TokenHash NVARCHAR(255) NOT NULL,
  ExpiresAt DATETIME2 NOT NULL,
  RevokedAt DATETIME2 NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_RefreshTokens_User FOREIGN KEY (UserId) REFERENCES Users(UserId)
);
CREATE INDEX IX_RefreshTokens_TokenHash ON RefreshTokens(TokenHash);

/* =====================================================
   PASSWORD RESET TOKENS
===================================================== */
CREATE TABLE PasswordResetTokens (
  PasswordResetTokenId INT IDENTITY(1,1) PRIMARY KEY,
  UserId INT NOT NULL,
  TokenHash NVARCHAR(255) NOT NULL,
  ExpiresAt DATETIME2 NOT NULL,
  UsedAt DATETIME2 NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_PasswordResetTokens_User FOREIGN KEY (UserId) REFERENCES Users(UserId)
);
CREATE INDEX IX_PasswordResetTokens_TokenHash ON PasswordResetTokens(TokenHash);

/* =====================================================
   PASSWORD RESET REQUESTS (RATE LIMITING)
===================================================== */
CREATE TABLE PasswordResetRequests (
  PasswordResetRequestId INT IDENTITY(1,1) PRIMARY KEY,
  Email NVARCHAR(150) NOT NULL,
  IpAddress NVARCHAR(50) NOT NULL,
  RequestedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_PasswordResetRequests_Email_Time
  ON PasswordResetRequests(Email, RequestedAt);
CREATE INDEX IX_PasswordResetRequests_Ip_Time
  ON PasswordResetRequests(IpAddress, RequestedAt);
