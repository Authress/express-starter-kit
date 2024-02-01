import shortUuid from 'short-uuid';
import { AuthressClient } from '@authress/sdk';
import express, { NextFunction, Request, Response } from 'express';

import accountsRepository, { Account } from './accountsRepository';
import authressPermissionsWrapper from '../authressPermissionsWrapper';


const accountsController = express.Router();
export default accountsController;

function formatAccount(account: { accountId: string }) {
  if (!account) {
    return null;
  }

  return {
    accountId: account.accountId,
    links: {
      self: { href: `http://localhost:8080/accounts/${account.accountId}` }
    }
  };
}


accountsController.post('/', async (request: Request, response: Response, next: NextFunction) => {
  const userId = response.locals.userId;

  const newAccountId = `acc_${shortUuid('abcdefghijklmnopqrstuvwxyz0123456789').generate()}`;

  const existingAccounts = await authressPermissionsWrapper.getUserResources('accounts', 'accounts:read');
  if (existingAccounts.resources?.length) {
    console.log({ title: 'User creating a second account with the same identity.', level: 'TRACK', request, existingAccounts, count: existingAccounts.resources.length });
    if (existingAccounts.resources.length >= 3) {
      response.status(429).json({
        errorCode: 'TooManyAccounts',
        title: 'Accounts per user is limited, for more information, please contact support@rhosys.ch'
      });
      return;
    }
  }

  const account = await accountsRepository.createAccount(newAccountId, { accountCreatorId: userId });

  await authressPermissionsWrapper.setRoleForUser(newAccountId, userId, `accounts/${newAccountId}`, ['AccountOwner']);
  response.status(200).json(formatAccount(account));
});


accountsController.get('/:accountId/sso', async (request: Request, response: Response, next: NextFunction) => {
  const userId = response.locals.userId;
  const accountId = request.params.accountId;

  if (!accountId) {
    response.status(403).json({
      errorCode: 'Forbidden',
      title: 'Cannot update any account without having a user account that is linked to an existing account.'
    });
    return;
  }

  const hasAccess = await authressPermissionsWrapper.hasAccessToResource(userId, `accounts/${accountId}/sso`, 'sso:read');
  if (!hasAccess) {
    response.status(403).json({});
    return;
  }

  const sso = await authressPermissionsWrapper.getSsoConfiguration(accountId);

  response.status(200).json({
    domain: sso?.tenant?.tenantLookupIdentifier,
    connection: sso?.connection
  });
});

accountsController.put('/:accountId/sso', async (request: Request, response: Response, next: NextFunction) => {
  const userId = response.locals.userId;
  const accountId = request.params.accountId;

  if (!accountId) {
    response.status(403).json({
      errorCode: 'Forbidden',
      title: 'Cannot update any account without having a user account that is linked to an existing account.'
    });
  }

  const hasAccess = await authressPermissionsWrapper.hasAccessToResource(userId, `accounts/${accountId}/sso`, 'sso:update');
  if (!hasAccess) {
    response.status(403);
    return;
  }

  const account = await accountsRepository.getAccount(accountId);
  if (!account) {
    response.status(404);
    return;
  }

  if (request.body.domain) {
    await authressPermissionsWrapper.updateSsoConfiguration(accountId, request.body.domain, request.body.connection);
  } else {
    await authressPermissionsWrapper.deleteSsoConfiguration(accountId);
  }

  response.status(202).json({});
});

accountsController.put('/:accountId', async (request: Request, response: Response, next: NextFunction) => {
  const userId = response.locals.userId;
  const accountId = request.params.accountId;

  if (!accountId) {
    response.status(403).json({
      errorCode: 'Forbidden',
      title: 'Cannot update any account without having a user account that is linked to an existing account.'
    });
    return;
  }

  const hasAccess = await authressPermissionsWrapper.hasAccessToResource(userId, `accounts/${accountId}`, 'accounts:update');
  if (!hasAccess) {
    response.status(403);
    return;
  }

  const account = await accountsRepository.getAccount(accountId);
  if (!account) {
    response.status(404);
    return;
  }

  const company = request.body.company;
  const updatedAccount = await accountsRepository.updateAccount(accountId, { company });
  response.status(200).json(formatAccount(updatedAccount));
  return;
});

accountsController.get('/:accountId', async (request: Request, response: Response, next: NextFunction) => {
  const userId = response.locals.userId;
  const accountId = request.params.accountId;

  if (!accountId) {
    response.status(404);
    return;
  }

  const hasAccess = await authressPermissionsWrapper.hasAccessToResource(userId, `accounts/${accountId}`, 'accounts:read');
  if (!hasAccess) {
    response.status(403);
    return;
  }

  const account = await accountsRepository.getAccount(accountId);
  if (!account) {
    response.status(404);
    return;
  }

  response.status(200).json(formatAccount(account));
  return;
});

accountsController.get('/', async (request: Request, response: Response, next: NextFunction) => {
  const userId = response.locals.userId;

  const resourcePermissions = await authressPermissionsWrapper.getUserResources('accounts', 'accounts:read');
  if (resourcePermissions.accessToAllSubResources) {
    const accounts = await accountsRepository.getAllAccounts();
    response.status(200).json({
      accounts: accounts.map(a => formatAccount(a))
    });
    return;
  }

  const accounts: Account[] = await Promise.all(resourcePermissions.resources?.map(s => accountsRepository.getAccount(s.resourceUri.replace('accounts/', ''))) || []);
  if (accounts.length) {
    response.status(200).json({
      accounts: accounts.filter(a => a).map(a => formatAccount(a))
    });
    return;
  }

  const usersTenantAccountId = response.locals.tenantId;
  if (!usersTenantAccountId) {
    response.status(200).json({
      accounts: []
    });
    return;
  }

  // The user's came from an SSO connection, we know that because their JWT access token has a `tenantId` in the `aud` claim.
  // * We'll assume that our service automatically gives READ access to everything in the account if they work at that company
  const account = await accountsRepository.getAccount(usersTenantAccountId);
  if (!account) {
    response.status(200).json({
      accounts: []
    });
    return;
  }

  // Since we assume that everyone in the tenant should have READ permissions even if they never got an invite, set the role for this user
  await authressPermissionsWrapper.setRoleForUser(usersTenantAccountId, userId, `accounts/${usersTenantAccountId}`, ['Authress:ReadResource']);

  response.status(200).json({
      accounts: [formatAccount(account)]
  });
});