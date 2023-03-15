# Authress Starter Kit for Express + Typscript
The Express Starter Kit for Authress includes Authentication, Authorization, user identity and role management

This is an example built specifically for using Authress with Typescript & Express.

## How to use this repository

To test and run the example:
* `npm install` or `yarn`
* `npm start` or `yarn start`

## See the code
If you just want to see the code, it's available right here. Most of it is boilerplate to run the example the interesting part starts a bit lower down.

* [Microservice.js](./src/index.ts#L43)

## Details

### The middleware
The important part of the integration is to get the userId and Authress client to authorize the user. This is done by adding a middleware to parse out the caller, and one line in the service to validate this.
