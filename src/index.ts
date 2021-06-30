import { MikroORM } from "@mikro-orm/core";
import mikroOrmConfig from "./mikro-orm.config";
import {
  __dbName__,
  __dbPassword__,
  __dbUser__,
  __debug__,
  __port__,
  __prod__,
  __sessionCookie__,
  __sessionSecret__,
} from "./constants";
import express from "express";
import { Post } from "./entities/Post";
import { ApolloServer } from "apollo-server-express";
import { buildSchema } from "type-graphql";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import redis from "redis";
import connectRedis from "connect-redis";
import session from "express-session";
import { EntityManagerContext } from "./types";
import sendEmail from "./utils/sendEmail";

async function main() {
  sendEmail({
    to: "bob@bob.com",
    subject: "Change password?",
    text: "Hello bob",
  });
  const app = express();

  // Set up ExpressSession and Redis.
  const RedisStore = connectRedis(session);
  const redisClient = redis.createClient();

  app.use(
    session({
      name: __sessionCookie__,
      store: new RedisStore({
        client: redisClient,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 5 * 30 * 24 * 60 * 60 * 1000,
        httpOnly: __prod__,
        secure: __prod__,
        sameSite: "lax",
      }, // 5 months.
      saveUninitialized: false,
      secret: __sessionSecret__!,
      resave: false,
    })
  );

  // Set up MikroORM.
  const orm = await MikroORM.init(mikroOrmConfig);
  // await orm.getMigrator().up();

  // Set up ApolloServer.
  const apolloServer = new ApolloServer({
    playground: { settings: { "request.credentials": "include" } },
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): EntityManagerContext => ({ em: orm.em, req, res }),
  });

  apolloServer.applyMiddleware({
    app,
    cors: {
      credentials: true,
      origin: "http://localhost:3000",
    },
  });

  // API endpoints.
  app.get("/", async (_, res) => {
    const posts = await orm.em.find(Post, {});
    res.send(posts);
  });

  app.listen(__port__, () => {
    console.log(`Server started on port ${__port__}`);
  });
}

main().catch((e) => console.log(e));
