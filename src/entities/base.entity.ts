import { PrimaryKey, Property } from '@mikro-orm/core';
import { Field, ID, ObjectType } from 'type-graphql';

@ObjectType({ isAbstract: true })
export default abstract class BaseEntity {
  @Field(() => ID)
  @PrimaryKey()
  id!: number;

  @Field(() => Date)
  @Property()
  createdAt = new Date();

  @Field(() => Date)
  @Property({ onUpdate: () => new Date() })
  updatedAt = new Date();
}
