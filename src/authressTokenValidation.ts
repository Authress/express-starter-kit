import { Request, Response, NextFunction } from "express";

import authressPermissionsWrapper from "./authressPermissionsWrapper";

export default async function authressTokenValidation (
  request: Request,
  response: Response,
  next: NextFunction
) {
  try {
    await authressPermissionsWrapper.getAuthressProperties();
  } catch (error: any) {
    if (error.code === 'InvalidAccessKeyError') {
      response.status(401).json({
        title: 'Your Authress service client access key is invalid. Go to the src/authressPermissionsWrapper.ts and set the serviceClientAccessKey at the top of the file. Instructions can be found in that file.'
      });
      return;
    }
    next(error);
  }

  const authorizationHeader = request.headers.authorization;
  if (!authorizationHeader) {
    response.status(401).json({
      title: 'The response is a 401 to your request to this starter-kit. Your request failed the Authress Token Validator check in the src/authressTokenValidation.ts file',
      error: 'No authorization header was specified'
    });
    return;
  }
  const token = authorizationHeader.replace(/Bearer\s+/i, '').trim();

  try {
    const userIdentity = await authressPermissionsWrapper.verifyUserToken(token);
    response.locals.userId = userIdentity.sub;
  } catch (error: any) {
    const authressProperties = await authressPermissionsWrapper.getAuthressProperties();
    if (authressProperties.authressDomain === 'https://authress.company.com') {
      response.status(401).json({
        title: 'Your Authress custom domain is not set. Go to the src/authressPermissionsWrapper.ts and set the authressDomain at the top of the file. This should match your Authress Custom domain.',
        error
      });
    }
    if (error.code === 'Unauthorized' || error.code === 'TokenVerificationError') {
      response.status(401).json({
        title: 'The response is a 401 to your request to this starter-kit. Your request failed the Authress Token Validator because the Authorization header token provided in the request is invalid. Verify that the auth token you are using in the request is valid',
        token,
        error: {
          code: error.code,
          name: error.name,
          reason: error.reason,
          message: error.message
        }
      });
      return;
    }
    next(error);
    return;
  }

  next();
};