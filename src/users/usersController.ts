import shortUuid from 'short-uuid';
import { AuthressClient } from 'authress-sdk';
import express, { NextFunction, Request, Response } from 'express';

import authressPermissionsWrapper from '../authressPermissionsWrapper';
import accountsRepository from '../accounts/accountsRepository';

const usersController = express.Router();
export default usersController;

// set a user role
usersController.post('/users', async (request: Request, response: Response, next: NextFunction) => {
  const callerUserId = response.locals.userId;
  const accountId = request.params.accountId;
  const userId = request.body.userId;
  const newRoles = request.body.roles;


  if (!accountId) {
    response.status(404);
    return;
  }

  const hasAccess = await authressPermissionsWrapper.hasAccessToResource(callerUserId, `accounts/${accountId}/users/${userId}`, 'users:update');
  if (!hasAccess) {
    response.status(403).json({});
    return;
  }

  const account = await accountsRepository.getAccount(accountId);
    if (!account) {
      response.status(404).json({});
    return;
    }

    await authressPermissionsWrapper.setRoleForUser(accountId, userId, `accounts/${accountId}`, newRoles);

  response.status(202).json({});
});

// Get users for the account
usersController.get('/users', async (request: Request, response: Response, next: NextFunction) => {
  const callerUserId = response.locals.userId;
  const accountId = request.params.accountId;
  const userId = request.body.userId;
  const newRoles = request.body.roles;


  if (!accountId) {
    response.status(404);
    return;
  }

  const hasAccess = await authressPermissionsWrapper.hasAccessToResource(callerUserId, `accounts/${accountId}/users`, 'users:read');
  if (!hasAccess) {
    response.status(403).json({});
    return;
  }

  const account = await accountsRepository.getAccount(accountId);
  if (!account) {
    response.status(404).json({});
    return;
  }

  const usersWithRoles = await authressPermissionsWrapper.getUsersThatHaveAccessToAccount(accountId);
  const userDataMap = await authressPermissionsWrapper.getUserDataMap(usersWithRoles.map(u => u.userId));

  response.status(200).json({
    users: usersWithRoles.map(u => ({
      userId: u.userId,
      roles: u.roles,
      data: {
        picture: userDataMap[u.userId]?.picture,
        name: userDataMap[u.userId]?.name
      }
    }))
  });
});

// remove a user from the account
usersController.delete('/users/:userId', async (request: Request, response: Response, next: NextFunction) => {
  const callerUserId = response.locals.userId;
  const accountId = request.params.accountId;
  const userId = request.params.userId;

  if (!accountId) {
    response.status(404).json({});
    return;
  }

  const hasAccess = await authressPermissionsWrapper.hasAccessToResource(callerUserId, `accounts/${accountId}/users`, 'users:update');
  if (!hasAccess) {
    response.status(403).json({});
    return;
  }

  const account = await accountsRepository.getAccount(accountId);
  if (!account) {
    response.status(404).json({});
    return;
  }

  await authressPermissionsWrapper.removeUserFromAccount(accountId, userId);

  response.status(204);
});
