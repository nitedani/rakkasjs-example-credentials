import createEmotionServer from "@emotion/server/create-instance";
import { cookie } from "@hattip/cookie";
import { session, SignedCookieStore } from "@hattip/session";
import { defaultMantineEmotionCache } from "@mantine/core";
import { createRequestHandler, RequestContext } from "rakkasjs";
import { Readable } from "stream";
import { prisma } from "./prisma";

const cookieMiddleware = cookie();
const sessionMiddleware = [
  session({
    store: new SignedCookieStore(
      await SignedCookieStore.generateKeysFromSecrets(["secret"])
    ),
    defaultSessionData: {},
    cookieOptions: { path: "/" },
  }),
  async (ctx: RequestContext) => {
    const userId = ctx.session.data.userId;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: {
          id: userId,
        },
      });
      if (user) {
        const { password, ...rest } = user;
        ctx.locals.user = rest;
      } else {
        ctx.session.destroy();
      }
    }
  },
];

const { renderStylesToNodeStream } = createEmotionServer(
  defaultMantineEmotionCache
);

export default createRequestHandler({
  middleware: {
    beforePages: [cookieMiddleware, ...sessionMiddleware],
    beforeApiRoutes: [cookieMiddleware, ...sessionMiddleware],
  },
  //@ts-ignore
  createPageHooks: () => ({
    wrapSsrStream: (stream) =>
      //@ts-ignore
      Readable.toWeb(Readable.fromWeb(stream).pipe(renderStylesToNodeStream())),
  }),
});
