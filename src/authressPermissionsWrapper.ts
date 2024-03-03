import authress, { AuthressClient, ServiceClientTokenProvider, UserResources, UserIdentity, Connection, Tenant, UnauthorizedError, ApiError } from '@authress/sdk';
const { ConnectionData } = authress;
import { AssignedUserRoles, SsoConnection, SsoConfiguration} from './dtos';

// * We need to use an Authress client that is locked to the service client's token to generate the new access record
// Generate the service client access key at https://authress.io/app/#/settings?focus=clients
const serviceClientAccessKey = 'sc_001.access_key';
// // Generate the authress domain at https://authress.io/app/#/settings?focus=domain
const authressApiUrl = 'https://authress.company.com';
const authressClient = new AuthressClient({ authressApiUrl }, serviceClientAccessKey);

class AuthressPermissionsWrapper {
  async getAuthressProperties() {
    await new ServiceClientTokenProvider(serviceClientAccessKey).getToken();
    return {
      authressApiUrl
    };
  }

  async verifyUserToken(token: string) {
    return authressClient.verifyToken(token);
  }

  async hasAccessToResource(userId: string, resourceId: string, permission: string): Promise<boolean> {
    try {
      await authressClient.userPermissions.authorizeUser(userId, resourceId, permission);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return false;
      }
      throw error;
    }
  }

  // Get all the resources by permission that a user has access to. This only contains explicit permissions specified in Authress
  async getUserResources(resourceUri: string, permission: string = 'READ'): Promise<UserResources> {
    const response = await authressClient.userPermissions.getUserResources(null, resourceUri, 20, null, permission);
    return response.data;
  }

  // Convert a list of userIds to list of  user data objects
  async getUserDataMap(userIds: Array<string>): Promise<Record<string, UserIdentity>> {
    const userList: Array<UserIdentity | null> = await Promise.all(userIds.map(async userId => {
      try {
        const result = await authressClient.users.getUser(userId);
        return result.data;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        console.log({ title: 'Failed to resolve user', level: 'ERROR', userId, error });
        throw error;
      }
    }));

    const filteredUserList: Array<UserIdentity> = userList.filter((u): u is UserIdentity => !!u);
    return filteredUserList.reduce((acc: Record<string, UserIdentity>, user: UserIdentity) => { acc[user.userId] = user; return acc; }, {});
  }

  /*************************************************/
  /*********** USER ROLE MANAGEMENT ****************/
  /*************************************************/

  async getUsersThatHaveAccessToAccount(accountId: string): Promise<Array<AssignedUserRoles>> {
    const result = await authressClient.resources.getResourceUsers(`accounts/${accountId}`);
    return result.data.users.map(u => ({
      userId: u.userId,
      roles: u.roles.map(r => r.roleId)
    }));
  }

  async getUsersThatHaveAccessToResource(accountId: string, resourceId: string): Promise<Array<AssignedUserRoles>> {
    const result = await authressClient.resources.getResourceUsers(`accounts/${accountId}/resources/${resourceId}`);
    return result.data.users.map(u => ({
      userId: u.userId,
      roles: u.roles.map(r => r.roleId)
    }));
  }

  async removeUserFromAccount(accountId: string, userId: string): Promise<void> {
    // See {@link setRoleForUser} for where this value comes from
    const recordId = `rec_A:${accountId}:U:${userId}`;

    try {
      await authressClient.accessRecords.deleteRecord(recordId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return;
      }
      console.log({ title: 'Failed to remove user from account', level: 'ERROR', error, accountId, userId });
      throw error;
    }
  }

  async setRoleForUser(accountId: string, userId: string, rawResourceUris: string | string[], newRoles: string | string[]): Promise<void> {
    // We are creating an access record to dedicated to this user to define their permissions
    // * In this case we decided that `A` the account and `U` the userId would make up the user's record For different accounts the user will have separate records. Although this doesn't have to be the case, it makes it much easier to delete the access record later.
    const recordId = `rec_A:${accountId}:U:${userId}`;
    const resourceUris: string[] = Array.isArray(rawResourceUris) ? rawResourceUris : [rawResourceUris];


    try {
      const response = await authressClient.accessRecords.getRecord(recordId);
      if (response.data.status === 'DELETED') {
        throw { status: 404 };
      }
      // Update the roles just for the resource specified
      const resourceUriMap = resourceUris.reduce((acc: Record<string, boolean>, r: string) => { acc[r] = true; return acc; }, {});
      const newStatements = response.data.statements.filter(s => !s.resources.some(r => resourceUriMap[r.resourceUri.replace(/[/][*]$/, '')]))
        .concat(newRoles ? { resources: resourceUris.map(resourceUri => ({ resourceUri })), roles: Array.isArray(newRoles) ? newRoles : [newRoles] } : []);

      await authressClient.accessRecords.updateRecord(recordId, Object.assign({}, response.data,
        { users: [{ userId }], statements: newStatements }
      ));

      return;
    } catch (error) {
      if (error.status !== 404) {
        throw error;
      }

      await authressClient.accessRecords.createRecord({
        recordId,
        name: `Account: ${accountId}, User: ${userId}`,
        users: [{ userId }],
        statements: [{ resources: resourceUris.map(resourceUri => ({ resourceUri })), roles: Array.isArray(newRoles) ? newRoles : [newRoles] }]
      });
    }
  }

  /*************************************************/

  async getExplicitUserResources(userId: string, resourceUri: string, permission: string = 'READ'): Promise<UserResources> {
    const response = await authressClient.userPermissions.getUserResources(userId, resourceUri, 20, undefined, permission);
    return response.data;
  }

  async getSsoConfiguration(accountId: string): Promise<SsoConfiguration | null> {
    const connectionId = `con_sso-${accountId}`;

    try {
      const connectionResponse = await authressClient.connections.getConnection(connectionId);
      const tenantResponse = await authressClient.tenants.getTenant(accountId);
      return {
        connection: {
          type: connectionResponse.data.type,
          authenticationUrl: connectionResponse.data.authenticationUrl,
          issuerUrl: connectionResponse.data.issuerUrl,
          tokenUrl: connectionResponse.data.tokenUrl,
          providerCertificate: connectionResponse.data.providerCertificate,
          clientId: connectionResponse.data.clientId,
          clientSecret: connectionResponse.data.clientSecret
        },
        tenant: {
          tenantLookupIdentifier: tenantResponse.data.tenantLookupIdentifier
        }
      };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }

      console.log({ title: 'Failed to get sso configuration for account', level: 'ERROR', accountId, error });
      return null;
    }
  }

  async updateSsoConfiguration(accountId: string, domain: string, connectionConfiguration: SsoConnection) {
    const updateConnectionData: Connection = {
      authenticationUrl: connectionConfiguration.authenticationUrl,
      clientId: connectionConfiguration.clientId,
      clientSecret: connectionConfiguration.clientSecret,
      issuerUrl: connectionConfiguration.issuerUrl,
      providerCertificate: connectionConfiguration.providerCertificate,
      tokenUrl: connectionConfiguration.tokenUrl,
      type: connectionConfiguration.type,
      data: {
        name: `[ExpressStarterKitPOC] SSO login (${accountId})`,
        supportedContentType: ConnectionData.SupportedContentTypeEnum.XWwwFormUrlencoded
      },
    }
    const connectionId = `con_sso-${accountId}`;
    await authressClient.connections.updateConnection(connectionId, connectionConfiguration);

    const tenant: Tenant = {
      tenantId: accountId,
      tenantLookupIdentifier: domain,
      data: { name: `SSO for ${accountId}` },
      connection: { connectionId }
    };

    try {
      await authressClient.tenants.updateTenant(accountId, tenant);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        console.log({ title: 'Failed to update sso configuration for account', level: 'ERROR', accountId, error, tenant });
        throw error;
      }
      await authressClient.tenants.createTenant(tenant);
    }
  }

  async deleteSsoConfiguration(accountId: string): Promise<void> {
    try {
      const connectionId = `con_sso-${accountId}`;
      await authressClient.connections.deleteConnection(connectionId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return;
      }
      console.log({ title: 'Failed to delete sso configuration for account', level: 'ERROR', accountId, error });
      throw error;
    }

    try {
      await authressClient.tenants.deleteTenant(accountId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return;
      }
      console.log({ title: 'Failed to delete sso configuration for account', level: 'ERROR', accountId, error });
      throw error;
    }
  }
}

export default new AuthressPermissionsWrapper();