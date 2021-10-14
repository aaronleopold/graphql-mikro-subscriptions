import { Request, Response } from 'express';
import { EntityManager } from '@mikro-orm/sqlite';

export default interface ReqContext {
  req: Request;
  res: Response;
  em: EntityManager;
}
