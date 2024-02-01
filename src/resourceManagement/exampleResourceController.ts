import { AuthressClient } from '@authress/sdk';
import express, { NextFunction, Request, Response } from 'express';

import resourceRepository from './exampleDataRepository';
import authressPermissionsWrapper from '../authressPermissionsWrapper';

const exampleResourceController = express.Router();
export default exampleResourceController;

/** Routes */
// Get all resources
exampleResourceController.get('/', async (request: Request, response: Response, next: NextFunction) => {
  const userId = response.locals.userId;
  const accountId = request.params.accountId;

  // Ensure user has permissions to read the resource resources (userId, resourceUri, permission)
  const userHasPermissionToResource = await authressPermissionsWrapper.hasAccessToResource(userId, `/accounts/${accountId}/resources`, 'READ');
  if (!userHasPermissionToResource) {
    response.status(403).json({ title: 'User does not have access to read resources' });
    return;
  }

  try {
    const resources = await resourceRepository.getAllThings();

    response.status(200).json({
      resources
    });
  } catch (error) {
    next(error);
  }
});

// Get a resource
exampleResourceController.get('/:id', async (request: Request, response: Response, next: NextFunction) => {
  const userId = response.locals.userId;
  const accountId = request.params.accountId;
  const resourceId = request.params.id;

  // Ensure user has permissions to read the resource resources (userId, resourceUri, permission)
  const userHasPermissionToResource = await authressPermissionsWrapper.hasAccessToResource(userId, `/accounts/${accountId}/resources/${resourceId}`, 'READ');
  if (!userHasPermissionToResource) {
    response.status(403).json({ title: 'User does not have access to read this resource.' });
    return;
  }

  try {
    const resourceObject = await resourceRepository.getThing(`${accountId}|${resourceId}`);

    response.status(200).json(resourceObject);
  } catch (error) {
    next(error);
  }
});

// Create a resource
exampleResourceController.post('/', async (request: Request, response: Response, next: NextFunction) => {
  const userId = response.locals.userId;
  const accountId = request.params.accountId;

  // Ensure user has permissions to create resources (userId, resourceUri, permission)
  const userHasPermissionToResource = await authressPermissionsWrapper.hasAccessToResource(userId, `/accounts/${accountId}/resources`, 'CREATE');
  if (!userHasPermissionToResource) {
    response.status(403).json({ title: 'User does not have access to create resources' });
    return;
  }

  try {
    // Create the resource in the database
    const newResourceId = `new-resource-1`;
    // Resources are scoped to an account, that means that for the user they will see `newResourceId` but our Database and Authress have to see `accountId/newResourceId` which includes the accountId
    const globalIdentifierForResourceId = `${accountId}|${newResourceId}`;
    const newResourceObject = await resourceRepository.createThing(globalIdentifierForResourceId, request.body);

    // Grant the user access own the resource
    // Owner by default gives full control over this new resource, including the ability to grant others access as well.
    await authressPermissionsWrapper.setRoleFrorUser(accountId, userId, globalIdentifierForResourceId, 'Authress:Owner')

    // Return the new resource
    response.status(200).json({ resourceId: newResourceId });
  } catch (error) {
    next(error);
  }
});