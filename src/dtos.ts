import { Connection } from 'authress-sdk';

export interface AssignedUserRoles {
  userId: string;
  roles: Array<string>;
}

export interface SsoConnection {
  type?: Connection.TypeEnum;
  authenticationUrl: string;
  issuerUrl?: string;
  tokenUrl?: string;
  providerCertificate?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface SsoTenant {
  tenantLookupIdentifier?: string;
}

export interface SsoConfiguration {
  connection: SsoConnection;
  tenant: SsoTenant;
}