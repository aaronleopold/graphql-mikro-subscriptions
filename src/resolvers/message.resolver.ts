import { PubSubEngine } from 'graphql-subscriptions';
import {
  Resolver,
  Query,
  Mutation,
  Ctx,
  Subscription,
  Root,
  PubSub,
} from 'type-graphql';
import Message from '../entities/message.entity';
import SubscriptionEvent from '../enums/SubscriptionEvent';
import ReqContext from '../interfaces/ReqContext';

@Resolver()
export class MessageResolver {
  @Query(() => [Message])
  async getMessages(@Ctx() ctx: ReqContext): Promise<Message[]> {
    return ctx.em.find(Message, {});
  }

  @Mutation(() => Message)
  async createMessage(
    @Ctx() ctx: ReqContext,
    @PubSub() pubSub: PubSubEngine
  ): Promise<Message> {
    // grab the entity manager from context
    const { em } = ctx;

    // create the message
    const message = new Message('GraphQL', 'Hello, Aaron!');

    // persist the new message to the database
    await em.persistAndFlush(message);

    // publish the message
    await pubSub.publish(SubscriptionEvent.NEW_MESSAGE, message);

    // return the message
    return message;
  }

  @Subscription(() => Message, { topics: SubscriptionEvent.NEW_MESSAGE })
  async createdMessage(@Root() payload: Message) {
    return payload;
  }
}
