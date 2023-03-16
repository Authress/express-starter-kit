// public imports
import * as dotenv from "dotenv";
import express, { Request, Response } from "express";
import boilerplate from "./boilerplate";

// Authress token validation
import authressTokenValidation from './authressTokenValidation';

// Example Express route controllers
// Accounts Manages a customer account that users have access to
import AccountsController from './accounts/accountController';

// Resources Manages a specific resource in a customer account
import ExampleResourceController from './resourceManagement/exampleResourceController';

// Manage user roles for an account or specific resource
import UsersController from './users/usersController';

dotenv.config();

const app = express();
boilerplate.setup(app);
app.use(authressTokenValidation);

app.use('/accounts/:accountId/items', ExampleResourceController);
app.use('/accounts', AccountsController)
app.use('/accounts/:accountId/users', UsersController);

// Express requires error handlers to be at the end
boilerplate.addErrorHandlers(app);