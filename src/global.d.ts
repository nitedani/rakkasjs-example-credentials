import { User } from "@prisma/client";
import type { Request, Response } from "express";

declare module "@hattip/session" {
  interface SessionData {
    userId?: string;
  }
}

declare module "rakkasjs" {
  interface ServerSideLocals {
    user: Omit<User, "password"> | null;
  }
  interface RequestContext {
    platform: {
      request: Request;
      response: Response;
    };
  }
}
