import express from 'express';
import { createServer, Server } from 'http';
import cors from 'cors';
import { Connection, IDatabaseDriver, MikroORM } from '@mikro-orm/core';
import { PRODUCTION } from '.';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import Message from './entities/message.entity';
import { buildSchema } from 'type-graphql';
import { MessageResolver } from './resolvers/message.resolver';
import { ApolloServer } from 'apollo-server-express';
import ws from 'ws';
import path from 'path';
import { useServer } from 'graphql-ws/lib/use/ws';
import { PubSub } from 'graphql-subscriptions';

export default class Application {
  public orm!: MikroORM<IDatabaseDriver<Connection>>;
  public expressApp!: express.Application;
  public httpServer!: Server;
  public apolloServer!: ApolloServer;
  public subscriptionServer!: ws.Server;

  public async connect() {
    try {
      this.orm = await MikroORM.init({
        entities: [Message],
        type: 'sqlite',
        dbName: 'db.sqlite',
        debug: !PRODUCTION,
        highlighter: !PRODUCTION ? new SqlHighlighter() : undefined,
      });
    } catch (error) {
      console.error('📌 Could not connect to the database', error);
    }
  }

  public async seedDb() {
    const generator = this.orm.getSchemaGenerator();

    await generator.dropSchema(); // drops all the tables
    await generator.createSchema(); // creates all the tables

    const testMessage = new Message('Aaron', 'Hello, World!');

    await this.orm.em
      .persistAndFlush(testMessage)
      .then(() => console.log('💪 message persisted to database'))
      .catch((err) => console.log('😱 something went wrong!:', err));
  }

  public async init() {
    this.expressApp = express();
    this.httpServer = createServer(this.expressApp);

    const corsOptions = {
      origin: '*', // FIXME: change me to fit your configuration
    };

    this.expressApp.use(cors(corsOptions));

    this.expressApp.get('/graphql', (_req, res) => {
      res.sendFile(path.join(__dirname, './assets/playground.html'));
    });

    // create the PubSub (not the sandwich 😩)
    const pubSub = new PubSub();

    // generate the graphql schema
    const schema = await buildSchema({
      resolvers: [MessageResolver],
      pubSub,
    });

    // initialize the ws server to handle subscriptions
    this.subscriptionServer = new ws.Server({
      server: this.httpServer,
      path: '/graphql',
    });

    // initalize the apollo server, passing in the schema and then
    // defining the context each query/mutation will have access to
    this.apolloServer = new ApolloServer({
      schema,
      context: ({ req, res }) => ({
        req,
        res,
        // I am injecting the entity manager into my context. This will let me
        // use it directly by extracting it from the context of my queries/mutations.
        em: this.orm.em.fork(),
      }),
      plugins: [
        // we need to use a callback here since the subscriptionServer is scoped
        // to the class and would not exist otherwise in the plugin definition
        (subscriptionServer = this.subscriptionServer) => {
          return {
            async serverWillStart() {
              return {
                async drainServer() {
                  subscriptionServer.close();
                },
              };
            },
          };
        },
      ],
    });

    // you need to start the server BEFORE applying middleware
    await this.apolloServer.start();
    // pass the express app and the cors config to the middleware
    this.apolloServer.applyMiddleware({
      app: this.expressApp,
      cors: corsOptions,
    });

    const port = process.env.PORT || 5000;
    this.httpServer.listen(port, () => {
      // pass in the schema and then the subscription server
      useServer(
        { schema, context: { em: this.orm.em.fork() } },
        this.subscriptionServer
      );
      console.log(`httpServer listening at http://localhost:${port}`);
    });
  }
}
