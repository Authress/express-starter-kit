/*

Note: This file only used to quickly set up the app and run it on the specified port. It can be completely replaced.
See the controller at {@link resourceController.ts} for how to build a Controller or Router using Express utilizing Authress

*/

import express, { NextFunction, Request, Response, Express } from "express";
import cors from "cors";
import helmet from "helmet";
import http from 'http';
import stringify from 'json-stringify-safe';
import bodyParser from 'body-parser';
import { UnauthorizedError } from "@authress/sdk";

class BoilerPlate {
  setup(app: Express) {
    app.use(helmet());
    app.use(cors());
    app.use(express.json());

    const port: number = parseInt((process.env.PORT || 8080) as string, 10);
    const httpServer = http.createServer(app);
    httpServer.setTimeout(60 * 1000);
    httpServer.listen(port, () => {
      console.log(`App Running on http://localhost:${port}`);
      console.log(`\n*******************************************\nTry hitting one of the existing endpoints: curl -XGET http://localhost:${port}/accounts -H"Authorization: Bearer YOUR_TOKEN"`)
    });

    // Body handling
    app.use(bodyParser.text({ type: ['application/x-www-form-urlencoded', 'text/css', 'text/csv', 'text/html', 'text/plain', 'text/html'] }));
    app.use(bodyParser.raw({ type: ['application/octet-stream', 'application/binary', 'image/*', 'audio/*', 'video/*', 'application/pdf', 'application/x-tar', 'application/zip'], limit: '10mb' }));
    app.use(bodyParser.json({ type: '*/*', limit: '10mb' }));

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.log(stringify({ title: 'Failed to parse the body', error }));
      res.status(400).send({ title: 'Invalid body parsing, it is not a valid body object.' });
    });
  }

  addErrorHandlers(app: Express) {
    app.options(/.*/, (req: Request, res: Response) => {
      res.status(200).json({});
    });

    // Catch bad requests
    app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      if (error instanceof UnauthorizedError) {
        return res.status(403).json({ error: 'User does not have access to resource', userId: error.userId, resourceUri: error.resourceUri, permission: error.permission });
      }
      return next(error);
    });

    app.all(/.*/, (req: Request, res: Response) => {
      res.status(404).json({
        statusCode: 404,
        title: `Resource not found at ${req.originalUrl}`
      });
    });

    /** Global Error handler */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error(`Catch-all Error: ${error.stack || error} - ${stringify(error, null, 2)}`);
      res.status(500).json({
        statusCode: 500,
        title: 'Catch-all Error',
        detail: error.stack || error.toString()
      });
    });

  }
}

export default new BoilerPlate();